# sequencer-svg

A standalone Node.js tool for building UML-style sequence diagrams from JSON or YAML input and outputting SVG.

This repository is the SVG-only successor to the original `sequencer` project. It is intentionally separate so the legacy renderer can remain stable while this tool evolves independently.

## Purpose

`sequencer-svg` reads a sequence-diagram document, lays it out using the existing sequencer model, and emits SVG output.

The project exists to provide:

- a standalone SVG renderer with no dependency on the legacy parent repository
- a cleaner base for future SVG-specific improvements
- more consistent in-diagram reporting of semantic input-document errors

## Scope

This tool currently focuses on:

- JSON and YAML input
- incremental Mermaid sequence-diagram input support via transform into sequencer YAML
- SVG output only
- bundled font measurement using `opentype.js` and Liberation TTF fonts
- rendering semantic document errors directly into the generated SVG

This repository does not aim to preserve the full output surface of the original project. In particular, it does not output PNG or PDF.

## Repository Structure

```text
.
├── sequencer.js
├── SvgStart.js
├── SvgContext.js
├── SvgBuilder.js
├── FontManager.js
├── fonts.js
├── Actor.js
├── Blank.js
├── Call.js
├── Comment.js
├── ErrorLine.js
├── Fragment.js
├── FragmentCondition.js
├── InputDocumentError.js
├── Reference.js
├── ReturnCall.js
├── SortedMap.js
├── State.js
├── Terminate.js
├── TextMetadata.js
├── Utilities.js
├── Working.js
├── schema*.js
├── fonts/
└── examples/
```

## Typical Code Path

A normal render follows this path:

1. `sequencer.js` parses command-line options and loads JSON or YAML input.
2. When `--mermaid` is used, the Mermaid source is transformed into sequencer YAML first.
3. Source objects are annotated with source-line metadata where possible.
4. `SvgStart.js` initialises the rendering pass and runs the layout loop.
5. `Working.js` stores shared layout state during rendering.
6. `Actor.js`, `Fragment.js`, and the line-type modules render the diagram content.
7. `SvgContext.js` provides the Canvas-like drawing API used by the ported drawing logic.
8. `SvgBuilder.js` serialises the collected primitives into final SVG output.

## Error Reporting

The renderer distinguishes between two broad error classes.

### Parse errors

Invalid YAML or invalid JSON is reported on stderr and stops processing. These failures happen before a usable document tree exists, so they cannot be rendered into the SVG itself.

### Semantic document errors

If the input is valid YAML or JSON but semantically wrong for the renderer, the tool attempts to keep rendering and inserts structured red error boxes into the SVG output.

Examples include:

- missing or invalid `type`
- unknown actor aliases
- malformed fragment definitions
- conditions placed outside fragments
- bad comment payloads
- invalid line-specific field combinations

These errors are also logged as warnings with source-line information when available.

## Installation

```bash
npm install
```

## Usage

Read YAML from a file and write the SVG to a generated output file name:

```bash
node sequencer.js -y -i ./examples/Example_1.1.0.yaml -o -f
```

Read Mermaid sequence syntax, transform it to sequencer YAML, and render SVG. A `.sequencer.yaml` sidecar is also written:

```bash
node sequencer.js --mermaid -i ./test/mermaid-features/01-participants-and-aliases/input.mmd -o -f
```

Transform Mermaid input to sequencer YAML only:

```bash
node sequencer.js --mermaid --transformOnly -i ./test/mermaid-features/01-participants-and-aliases/input.mmd -f
```

Write into a specific directory:

```bash
node sequencer.js -y -i ./examples/Example_1.1.0.yaml -o -f -t ./examples
```

Read JSON from stdin and write SVG to stdout:

```bash
cat input.json | node sequencer.js
```

Show help:

```bash
node sequencer.js --help
```

## Command-Line Options

- `-i`, `--inputFile`: Read input from a file instead of stdin.
- `-o`, `--outputFile`: Write SVG to a specific file. If provided without a value, the file name is derived from title and version.
- `-t`, `--targetDir`: Directory for generated output files.
- `-y`, `--yaml`: Treat input as YAML instead of JSON.
- `-m`, `--mermaid`: Treat input as Mermaid sequence-diagram syntax.
- `-T`, `--transformOnly`: Stop after writing the transformed sequencer YAML.
- `-f`, `--force`: Overwrite existing output files.
- `-J`, `--outjson`: Also write formatted JSON output.
- `-Y`, `--outyaml`: Also write formatted YAML output.
- `-c`, `--nocovertext`: Skip title, version, and description cover text.
- `-v`, `--verbose`: Emit verbose debug logging.
- `-I`, `--id`: Set the log correlation identifier.
- `-?`, `--help`: Show usage information.

## Examples

Generate the checked-in example SVGs:

```bash
npm run examples
```

The generated SVG outputs are written into `examples/`.

Run the Mermaid feature-slice Jest tests:

```bash
npm test
```

Notable examples:

- `examples/Example_1.1.0.yaml` through `examples/Example_4.1.0.yaml`: normal feature and behaviour examples
- `examples/Example_5.1.0.yaml`: comprehensive semantic-error demonstration
- `test/mermaid-features/01-participants-and-aliases/`: the first Mermaid feature slice, including Mermaid input, transformed sequencer YAML, expected SVG, and Jest coverage

## Fonts

The project uses bundled Liberation fonts for text measurement and SVG font-family fallback stacks for rendering.

Font assets are stored under `fonts/`.

If you add new font-family support, you must also add the matching bundled font files and update `fonts.js`.

## Development Notes

This codebase intentionally preserves much of the original drawing model by using a Canvas-like shim in `SvgContext.js`. That keeps the rendering logic close to the original behaviour while allowing SVG output.

If you extend the renderer:

- prefer keeping drawing semantics compatible with the current modules
- route semantic input-document failures through the shared error-reporting path
- avoid reintroducing PNG- or PDF-specific assumptions into the standalone SVG tool

## Security and Dependencies

This repository is intended to be maintained independently from the legacy `sequencer` repository. Dependency upgrades should be evaluated in the context of this SVG-only tool, not the older mixed-output package.

## Licence

Licensed under AGPL-3.0-only. See [LICENSE](./LICENSE).
