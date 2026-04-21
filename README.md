# sequencer-svg

A standalone Node.js tool for building UML-style sequence diagrams from JSON, YAML, or Mermaid input and outputting SVG.

## Quick Start

The simplest way to use sequencer-svg is the opinionated mode — pass a single filename:

```bash
# From Mermaid
node sequencer.js diagram.mmd

# From YAML
node sequencer.js diagram.yaml

# From JSON
node sequencer.js diagram.json
```

This auto-detects the input format and writes all output artefacts (SVG, JSON, YAML) to the same directory.

## Installation

```bash
npm install
```

## Usage

### Opinionated Mode (Recommended)

Pass a single filename to auto-detect format and rebuild in place:

```bash
node sequencer.js diagram.mmd    # writes .sequencer.yaml, .json, .svg
node sequencer.js diagram.yaml   # writes .json, .svg, .yaml
node sequencer.js diagram.json   # writes .yaml, .svg, .json
```

### Standard Mode

For more control, use explicit flags:

```bash
# YAML input to SVG
node sequencer.js -y -i diagram.yaml -o -f

# JSON input to SVG
node sequencer.js -i diagram.json -o -f

# Mermaid input to SVG (also writes .sequencer.yaml sidecar)
node sequencer.js --mermaid -i diagram.mmd -o -f

# Mermaid transform only (no SVG)
node sequencer.js --mermaid --transformOnly -i diagram.mmd

# Write to specific directory
node sequencer.js -y -i diagram.yaml -o -f -t ./output

# Stdin to stdout
cat diagram.json | node sequencer.js > diagram.svg
```

### Command-Line Options

| Flag | Alias | Description |
|------|-------|-------------|
| `file` | (positional) | Input file — triggers opinionated mode with auto-detection |
| `-i` | `--inputFile` | Read input from file instead of stdin |
| `-o` | `--outputFile` | Write primary output to file (derives name if value omitted) |
| `-t` | `--targetDir` | Directory for output files |
| `-y` | `--yaml` | Treat input as YAML instead of JSON |
| `-m` | `--mermaid` | Treat input as Mermaid sequence-diagram syntax |
| `-T` | `--transformOnly` | Stop after writing transformed YAML (Mermaid only) |
| `-f` | `--force` | Overwrite existing output files |
| `-J` | `--outjson` | Also write formatted JSON file |
| `-Y` | `--outyaml` | Also write formatted YAML file |
| `-c` | `--nocovertext` | Skip title/version/description cover text |
| `-v` | `--verbose` | Emit debug messages to stderr |
| `-I` | `--id` | Correlation ID for verbose logs |
| `-?` | `--help` | Show help text |

---

## Document Format

Sequencer documents can be written in YAML or JSON. The structure is identical in both formats.

### Minimal Example

```yaml
title: Hello World
version: "1.0"
actors:
  - name: Alice
    alias: A
  - name: Bob
    alias: B
lines:
  - type: call
    from: A
    to: B
    text: Hello!
  - type: return
    from: B
    to: A
    text: Hi there!
```

### Root Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `title` | string | Yes | Document title (rendered at top) |
| `version` | string | Yes | Version string (e.g. "1.0", "2.1.3") |
| `description` | string or string[] | No | Multi-line description |
| `actors` | array | Yes | Actor definitions |
| `actorGroups` | array | No | Visual groupings of actors |
| `lines` | array | Yes | Diagram content (messages, fragments, etc.) |
| `autonumber` | boolean | No | Enable automatic message numbering |
| `params` | object | No | Document-wide styling defaults |

---

## Actors

Actors are the participants in your sequence diagram. They appear as boxes at the top and bottom of the diagram with a dashed timeline connecting them.

### Actor Definition

```yaml
actors:
  - name: User Interface
    alias: UI
    actorType: boundary
    bgColour: "rgb(200,220,255)"
    gapToNext: 200
    links:
      - label: Documentation
        url: https://example.com/docs
```

### Actor Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `name` | string or string[] | Required | Display name (array for multi-line) |
| `alias` | string | Required | Short identifier used in `from`/`to` |
| `actorType` | string | "participant" | Visual style (see Actor Types) |
| `gapToNext` | number | 150 | Pixels to next actor |
| `links` | array | — | Clickable links rendered below actor |
| `bgColour` | colour | — | Background colour |
| `borderColour` | colour | — | Border colour |
| `fgColour` | colour | — | Text colour |
| `fontFamily` | string | — | Font family |
| `fontSizePx` | number | — | Font size in pixels |
| `radius` | number | — | Corner radius |

### Actor Types

The `actorType` property controls the visual representation:

| Type | Description |
|------|-------------|
| `participant` | Standard box (default) |
| `actor` | Stick figure icon |
| `boundary` | Boundary symbol (UI/external interface) |
| `control` | Control symbol (controller/coordinator) |
| `entity` | Entity symbol (data/model) |
| `database` | Database cylinder |
| `collections` | Stacked boxes (collection/array) |
| `queue` | Queue symbol |

### Actor Groups

Group actors visually with a labelled box:

```yaml
actorGroups:
  - title: Frontend Services
    bgColour: "rgba(200,200,255,0.3)"
    startActor: UI
    endActor: API
```

Or by explicit list:

```yaml
actorGroups:
  - title: Backend
    actors: [DB, Cache, Queue]
```

---

## Line Types

The `lines` array contains the content of your diagram. Each line has a `type` that determines its behaviour.

### call — Standard Message

A solid arrow from one actor to another:

```yaml
- type: call
  from: A
  to: B
  text: Request data
```

#### Call Properties

| Property | Type | Description |
|----------|------|-------------|
| `from` | string | Source actor alias |
| `to` | string | Target actor alias |
| `text` | string or string[] | Message label |
| `arrow` | string | Arrow style at target (default: "fill") |
| `fromArrow` | string | Arrow style at source |
| `toArrow` | string | Arrow style at target |
| `fromAnchor` | string | Connection point: "edge" or "central" |
| `toAnchor` | string | Connection point: "edge" or "central" |
| `async` | boolean | Render as async (open arrow, no wait) |
| `breakFromFlow` | boolean | Deactivate source after this call |
| `breakToFlow` | boolean | Don't activate target |
| `destroyFrom` | boolean | Terminate source actor lifecycle |
| `destroyTo` | boolean | Terminate target actor lifecycle |
| `comment` | object | Attached comment block |

#### Arrow Styles

| Style | Description |
|-------|-------------|
| `fill` | Filled arrowhead (synchronous) |
| `open` | Open arrowhead (asynchronous) |
| `cross` | X mark (lost message) |
| `empty` | Empty triangle |
| `none` | No arrowhead |
| `halfTop` | Half arrow (top) |
| `halfBottom` | Half arrow (bottom) |

### return — Return Message

A dashed arrow typically representing a response:

```yaml
- type: return
  from: B
  to: A
  text: Response data
```

Return lines use the same properties as `call` but render with a dashed line.

### create — Actor Creation

A message that creates a new actor mid-sequence:

```yaml
- type: create
  from: Factory
  to: Instance
  text: new()
```

The target actor's header box appears at the point of creation rather than at the top.

### blank — Vertical Space

Add vertical spacing, optionally with activation changes or comments:

```yaml
# Simple spacing
- type: blank
  height: 20

# With activation
- type: blank
  height: 30
  activate: [A, B]
  deactivate: [C]

# With a note
- type: blank
  height: 40
  actor: A
  comment:
    text: This is a note
    bgColour: "rgb(255,255,200)"
```

#### Blank Properties

| Property | Type | Description |
|----------|------|-------------|
| `height` | number | Vertical space in pixels |
| `actor` | string | Single actor for attached comment |
| `actors` | string[] | Actor range for spanning comment |
| `activate` | string[] | Actors to activate |
| `deactivate` | string[] | Actors to deactivate |
| `comment` | object | Note/comment block |

### fragment — Control Structure

Fragments represent control structures like loops, conditions, and parallel execution:

```yaml
- type: fragment
  fragmentType: loop
  title: Retry logic
  condition: while attempts < 3
  lines:
    - type: call
      from: Client
      to: Server
      text: retry()
```

#### Fragment Properties

| Property | Type | Description |
|----------|------|-------------|
| `fragmentType` | string | Type of fragment (see below) |
| `title` | string | Label in fragment header |
| `condition` | string | Condition text (shown below title) |
| `lines` | array | Nested content |
| `startActor` | string | Left boundary actor |
| `endActor` | string | Right boundary actor |
| `bgColour` | colour | Background colour |
| `borderColour` | colour | Border colour |

#### Fragment Types

| Type | Description |
|------|-------------|
| `loop` | Iteration/repetition |
| `alt` | Alternative (if/else) — use with `condition` lines |
| `opt` | Optional block |
| `par` | Parallel execution |
| `critical` | Critical section |
| `break` | Break/exception handling |
| `rect` | Highlight region (no structural meaning) |

### condition — Fragment Divider

Divides a fragment into sections (e.g., else branches):

```yaml
- type: fragment
  fragmentType: alt
  title: Check result
  condition: success
  lines:
    - type: call
      from: A
      to: B
      text: process()
    - type: condition
      condition: failure
    - type: call
      from: A
      to: C
      text: handleError()
```

---

## Mermaid Support

sequencer-svg can transform Mermaid sequence diagram syntax into its native format.

### Basic Syntax

```mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B-->>A: Hi Alice!
```

Transform with:

```bash
node sequencer.js diagram.mmd
```

### Supported Mermaid Features

#### Participants and Actors

```mermaid
sequenceDiagram
    participant A as Alice
    actor B as Bob
    participant C as Charlie
```

Actor types are preserved:

```mermaid
sequenceDiagram
    participant UI as User Interface
    boundary API as API Gateway
    control Svc as Service
    entity DB as Database
    database Cache as Redis
    collections Queue as Job Queue
```

#### Messages and Arrows

| Mermaid | Description |
|---------|-------------|
| `A->B: text` | Solid line, no arrow |
| `A-->B: text` | Dashed line, no arrow |
| `A->>B: text` | Solid line, filled arrow (sync call) |
| `A-->>B: text` | Dashed line, filled arrow (return) |
| `A-xB: text` | Solid line, cross (lost message) |
| `A--xB: text` | Dashed line, cross |
| `A-)B: text` | Solid line, open arrow (async) |
| `A--)B: text` | Dashed line, open arrow |

#### Activations

```mermaid
sequenceDiagram
    A->>B: request
    activate B
    B-->>A: response
    deactivate B
```

Or using `+` and `-` shortcuts:

```mermaid
sequenceDiagram
    A->>+B: request
    B-->>-A: response
```

#### Notes

```mermaid
sequenceDiagram
    Note over A: Single actor note
    Note over A,B: Spanning note
    Note right of A: Right-side note
    Note left of B: Left-side note
```

#### Fragments

```mermaid
sequenceDiagram
    loop Every minute
        A->>B: ping
    end

    alt Success
        A->>B: process
    else Failure
        A->>C: handleError
    end

    opt Optional step
        A->>B: optional()
    end

    par Parallel A
        A->>B: task1
    and Parallel B
        A->>C: task2
    end

    critical Critical section
        A->>B: critical()
    option Fallback
        A->>C: fallback()
    end

    break On error
        A->>B: cleanup()
    end
```

#### Rect Highlighting

```mermaid
sequenceDiagram
    rect rgb(200, 220, 255)
        A->>B: highlighted region
        B-->>A: response
    end
```

#### Create and Destroy

```mermaid
sequenceDiagram
    create participant C as Charlie
    A->>C: new instance
    A-xC: destroy
```

#### Autonumber

```mermaid
sequenceDiagram
    autonumber
    A->>B: First message
    B->>C: Second message
```

#### Actor Links

```mermaid
sequenceDiagram
    participant A as Alice
    link A: Dashboard @ https://example.com/dashboard
    links A: {"Docs": "https://docs.example.com", "API": "https://api.example.com"}
```

#### Accessibility

```mermaid
sequenceDiagram
    accTitle: Login Flow
    accDescr: Shows the authentication sequence between user and server

    A->>B: authenticate
```

#### Box Grouping

```mermaid
sequenceDiagram
    box Frontend
        participant UI
        participant API
    end
    box Backend
        participant Svc
        participant DB
    end
```

### Mermaid Colour Support

Colours can be specified in several places:

```mermaid
sequenceDiagram
    participant A as Alice #lightblue
    rect rgba(255, 200, 200, 0.5)
        A->>B: coloured region
    end
```

---

## Text Formatting

### Built-in Tags

The renderer supports built-in text markup tags:

| Tag | Effect |
|-----|--------|
| `<code>...</code>` | Blue monospace text |
| `<comment>...</comment>` | Dark italic text |
| `<emph>...</emph>` | Bold italic text |
| `<//>...<////>` | Dark italic with `// ` prefix |

Example:

```yaml
- type: call
  from: A
  to: B
  text: "Call <code>process()</code> method"
```

### Custom Tags

Define custom tags in the `params` section:

```yaml
params:
  tags:
    - "<warn>=<rgb(255,100,0)><b>"
    - "</warn>=</b></rgb>"
    - "<ok>=<rgb(0,150,0)>"
    - "</ok>=</rgb>"
```

### Inline Formatting

Within text values, you can use:

| Tag | Effect |
|-----|--------|
| `<b>`, `</b>` | Bold |
| `<i>`, `</i>` | Italic |
| `<rgb(r,g,b)>`, `</rgb>` | Text colour |
| `<px##>`, `</px>` | Font size |
| `<font=family>`, `</font>` | Font family |
| `<sz+>`, `<sz->` | Relative size adjustment |

---

## Styling

### Colour Formats

Colours can be specified as:

- **RGB**: `rgb(255, 128, 0)`
- **RGBA**: `rgba(255, 128, 0, 0.5)`
- **Hex**: `#FF8800` or `#F80`
- **Named**: `red`, `blue`, `lightgray`

### Dash Patterns

Line dashes are specified as arrays of on/off pixel values:

```yaml
borderDash: [4, 2]     # 4px on, 2px off
lineDash: [6, 3, 2, 3] # alternating pattern
```

An empty array `[]` means solid line.

### Document-Level Defaults

Use `params` to set defaults for the entire document:

```yaml
params:
  globalSpacing: 30
  comment:
    bgColour: "rgb(255,255,220)"
    spacing: 1.2
  fragment:
    borderColour: "rgb(100,100,100)"
```

---

## Error Handling

### Parse Errors

Invalid YAML or JSON syntax is reported to stderr and stops processing:

```
Error whilst parsing YAML: bad indentation at line 15
```

### Semantic Errors

If the document structure is valid but contains semantic errors (unknown actors, invalid types, etc.), the renderer:

1. Continues processing
2. Renders red error boxes in the SVG at the error location
3. Logs warnings to stderr with source-line numbers

Example error box content:

```
Error: Unknown actor alias "X" at line 23
```

---

## Examples

### Generating Examples

```bash
npm run examples
```

This generates SVG outputs in `examples/` from the checked-in YAML files.

### Running Tests

```bash
npm test
```

This runs the Mermaid feature-slice Jest tests.

### Example Files

| File | Description |
|------|-------------|
| `examples/Example_1.1.0.yaml` | Basic sequence with styling |
| `examples/Example_2.1.0.yaml` | Custom tag overrides |
| `examples/Example_3.1.1.yaml` | Fragment nesting |
| `examples/Example_4.1.0.yaml` | Advanced arrows and flow |
| `examples/Example_5.1.0.yaml` | Error rendering demonstration |
| `test/mermaid-features/*/` | Mermaid feature test fixtures |

---

## Development Notes

This codebase preserves much of the original drawing model using a Canvas-like shim in `SvgContext.js`. This keeps rendering logic close to the original while producing SVG output.

### Repository Structure

```
sequencer.js          CLI entrypoint
SvgStart.js           Render initialisation
SvgContext.js         Canvas-like drawing API
SvgBuilder.js         SVG serialisation
FontManager.js        Text measurement
Actor.js              Actor rendering
Fragment.js           Fragment rendering
Call.js               Message rendering
Blank.js              Spacing and notes
schema.js             Document validation
MermaidSequenceTransformer.js   Mermaid parser
fonts/                Bundled Liberation fonts
examples/             Example documents
test/                 Jest test suites
```

### Fonts

The project bundles Liberation fonts for consistent text measurement. Font files are in `fonts/` and registered in `fonts.js`.

---

## Licence

Licensed under AGPL-3.0-only. See [LICENSE](./LICENSE).
