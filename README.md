# sequencer-svg

A standalone Node.js tool for building UML-style sequence diagrams from JSON, YAML, or Mermaid input and outputting SVG.

![Example sequence diagram](examples/Example_3.1.1.svg)

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

This auto-detects the input format and writes all output artefacts (SVG, PNG, JSON, YAML) to the same directory.

## Installation

```bash
npm install
```

## Usage

### Opinionated Mode (Recommended)

Pass a single filename to auto-detect format and rebuild in place:

```bash
node sequencer.js diagram.mmd    # writes .sequencer.yaml, .json, .svg, .png
node sequencer.js diagram.mmd --outpng   # explicit but redundant in opinionated mode
node sequencer.js diagram.yaml   # writes .json, .svg, .png, .yaml
node sequencer.js diagram.json   # writes .yaml, .svg, .png, .json
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

# Mermaid input to SVG + PNG (also writes .sequencer.yaml sidecar)
node sequencer.js --mermaid --outpng -i diagram.mmd -o -f

# Mermaid transform only (no SVG)
node sequencer.js --mermaid --transformOnly -i diagram.mmd

# Write to specific directory
node sequencer.js -y -i diagram.yaml -o -f -t ./output

# Stdin to stdout
cat diagram.json | node sequencer.js > diagram.svg
```

Opinionated mode writes a PNG beside the SVG using the same file stem by default. In standard mode, `--outpng` enables the same sidecar behaviour. Because the CLI cannot send both SVG and PNG to stdout in one stream, PNG output requires a file-based SVG output path such as opinionated mode or `-o`.

### Mermaid Compatibility

When you want the Mermaid input to remain portable to tools such as mermaid.live or `mmdc`, prefer Mermaid's documented configured participant syntax:

```text
participant API@{"type":"boundary"} as Public API
```

Avoid transformer-only compatibility forms such as `participant API as {...}` and bare `participant {...}` or `actor {...}` in checked-in `.mmd` files. The transformer still accepts them for compatibility, but Mermaid itself does not treat them as standard sequence-diagram syntax.

For the full configured-participant field rules, including which JSON fields Mermaid itself uses versus which are only interpreted by `sequencer-svg`, see [Actor Types](#actor-types) under [Mermaid Support](#mermaid-support).

### Command-Line Options

| Flag | Alias | Description |
| ------ | ------- | ------------- |
| `file` | (positional) | Input file — triggers opinionated mode with auto-detection |
| `-i` | `--inputFile` | Read input from file instead of stdin |
| `-o` | `--outputFile` | Write primary output to file (derives name if value omitted) |
| `-t` | `--targetDir` | Directory for output files |
| `-y` | `--yaml` | Treat input as YAML instead of JSON |
| `-m` | `--mermaid` | Treat input as Mermaid sequence-diagram syntax |
| `-T` | `--transformOnly` | Stop after writing transformed YAML (Mermaid only) |
| `-f` | `--force` | Overwrite existing output files |
| `-J` | `--outjson` | Also write formatted JSON file |
| `-P` | `--outpng` | Also write a PNG beside the SVG using the same file stem |
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

**Rendered output:**

![Minimal example](examples/minimal.svg)

### Root Properties

| Property | Type | Required | Default | Description |
| ---------- | ------ | ---------- | --------- | ------------- |
| `title` | string | Yes | — | Document title rendered at the top of the diagram |
| `version` | string | Yes | — | Version string displayed below the title (e.g. "1.0", "2.1.3") |
| `description` | string or string[] | No | — | Description text rendered below the version; use an array for multiple lines |
| `actors` | array | Yes | — | Array of actor definition objects (see Actor Properties) |
| `actorGroups` | array | No | — | Array of actor group objects for visual groupings (see Actor Groups) |
| `lines` | array | Yes | — | Array of line objects defining messages, fragments, and spacing |
| `autonumber` | boolean | No | `false` | When `true`, prefixes each message with a sequential number; when `false`, no numbering |
| `params` | object | No | — | Document-wide styling defaults that apply to all elements unless overridden |

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

| Property | Type | Required | Default | Description |
| ---------- | ------ | ---------- | --------- | ------------- |
| `name` | string or string[] | Yes | — | Display name shown in the actor header; use an array for multiple lines |
| `alias` | string | Yes | — | Short identifier used to reference this actor in `from`/`to` fields |
| `actorType` | string | No | `"participant"` | Visual style of the actor header icon (see Actor Types below) |
| `gapToNext` | number | No | `150` | Horizontal gap in pixels between this actor and the next actor |
| `links` | array | No | — | Array of `{label, url}` objects rendered as clickable links below the actor |
| `bgColour` | colour | No | `"rgb(95,183,224)"` | Fill colour of the actor header box |
| `borderColour` | colour | No | `"rgb(0,0,0)"` | Stroke colour of the actor header box border |
| `fgColour` | colour | No | `"rgb(0,0,0)"` | Text colour of the actor name |
| `fontFamily` | string | No | `"sans-serif"` | Font family for the actor name text |
| `fontSizePx` | number | No | `18` | Font size in pixels for the actor name text |
| `radius` | number | No | `5` | Corner radius in pixels for the actor header box |

### Mermaid Actor Types

The `actorType` property controls the visual representation of the actor header:

| Type | Description |
| ------ | ------------- |
| `participant` | Standard rectangular box; the default when no type is specified |
| `actor` | Stick figure icon representing a human user or external agent |
| `boundary` | Circle with vertical line; represents a UI or external system interface |
| `control` | Circle with arrow; represents a controller or coordinator component |
| `entity` | Circle with horizontal underline; represents a data entity or domain model |
| `database` | Cylinder shape; represents a database or persistent storage |
| `collections` | Stacked rectangles; represents a collection, array, or set of items |
| `queue` | Rectangle with internal dividers; represents a message queue or buffer |

```yaml
actors:
  - {name: Caller Service, alias: Caller, actorType: participant}
  - {name: Human operator, alias: User, actorType: actor, bgColour: 'rgb(255,232,204)'}
  - {name: External boundary, alias: Edge, actorType: boundary, bgColour: 'rgb(196,232,255)'}
  - {name: Flow controller, alias: Control, actorType: control, bgColour: 'rgb(255,244,179)'}
  - {name: Order entity, alias: Entity, actorType: entity, bgColour: 'rgb(220,255,214)'}
  - {name: Database Layer, alias: DB, actorType: database, bgColour: 'rgb(255,221,234)'}
  - {name: Collections store, alias: Collections, actorType: collections, bgColour: 'rgb(226,220,255)'}
  - {name: Job queue, alias: Queue, actorType: queue, bgColour: 'rgb(255,235,186)'}
  - {name: API, alias: API, actorType: participant}
```

**Rendered output:**

![Actor types](test/mermaid-features/01-participants-and-aliases/expected.svg)

### Actor Groups

Group actors visually with a labelled box.

#### Actor Group Properties

| Property | Type | Required | Default | Description |
| ---------- | ------ | ---------- | --------- | ------------- |
| `title` | string | No | `""` | Label displayed at the top of the group box; empty string shows no label |
| `bgColour` | colour | No | `"rgba(220,220,220,0.35)"` | Fill colour of the group box background |
| `actors` | string[] | One of | — | Explicit list of actor aliases to include in this group |
| `startActor` | string | One of | — | Alias of the first (leftmost) actor in a contiguous range |
| `endActor` | string | One of | — | Alias of the last (rightmost) actor in a contiguous range |

You must specify either `actors` (explicit list) or both `startActor` and `endActor` (contiguous range).

**Example using actor list:**

```yaml
actors:
  - {name: Caller, alias: Caller}
  - {name: Browser, alias: Browser}
  - {name: DB, alias: DB}
  - {name: Cache, alias: Cache}
  - {name: Service, alias: Service}
  - {name: Audit, alias: Audit}
actorGroups:
  - {title: Client tier, bgColour: Aqua, actors: [Caller, Browser]}
  - {title: Data tier, bgColour: 'rgba(255, 230, 200, 0.55)', actors: [DB, Cache]}
  - {title: Data tier, bgColour: 'rgba(255, 230, 200, 0.55)', actors: [Audit]}
```

**Example using start/end range:**

```yaml
actorGroups:
  - title: Client tier
    bgColour: Aqua
    startActor: Caller
    endActor: Browser
```

**Rendered output:**

![Actor groups](test/mermaid-features/19-box-actor-groups/expected.svg)

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

| Property | Type | Required | Default | Description |
| ---------- | ------ | ---------- | --------- | ------------- |
| `from` | string | Yes | — | Alias of the source actor sending the message |
| `to` | string | Yes | — | Alias of the target actor receiving the message |
| `text` | string or string[] | Yes | — | Message label displayed on the arrow; use an array for multiple lines |
| `arrow` | string | No | `"fill"` | Arrow style at target end; shorthand for `toArrow` (see Arrow Styles below) |
| `fromArrow` | string | No | `"none"` | Arrow style at source end (see Arrow Styles below) |
| `toArrow` | string | No | `"fill"` | Arrow style at target end; if specified, overrides `arrow` |
| `fromAnchor` | string | No | `"edge"` | Where the line connects to the source: `"edge"` attaches at the activation bar edge, `"central"` attaches at the actor timeline centre |
| `toAnchor` | string | No | `"edge"` | Where the line connects to the target: `"edge"` attaches at the activation bar edge, `"central"` attaches at the actor timeline centre |
| `async` | boolean | No | `false` | When `true`, renders with open arrowhead and does not keep source active while awaiting response; when `false`, renders as synchronous call |
| `breakFromFlow` | boolean | No | `false` | When `true`, deactivates the source actor after sending this message; when `false`, source remains active |
| `breakToFlow` | boolean | No | `false` | When `true`, the target actor is not activated by this message; when `false`, target becomes active |
| `destroyFrom` | boolean | No | `false` | When `true`, terminates the source actor's lifecycle with an X marker; when `false`, source continues |
| `destroyTo` | boolean | No | `false` | When `true`, terminates the target actor's lifecycle with an X marker; when `false`, target continues |
| `comment` | object | No | — | Comment/note block attached to this message (see comment syntax) |

#### Arrow Styles

| Style | Description |
| ------- | ------------- |
| `fill` | Solid filled triangular arrowhead; typically indicates synchronous call |
| `open` | Open (unfilled) arrowhead; typically indicates asynchronous message |
| `cross` | X mark at the line end; indicates a lost or failed message |
| `empty` | Outlined triangular arrowhead with no fill |
| `none` | No arrowhead; just a plain line end |
| `halfTop` | Half arrowhead pointing upward from the line |
| `halfBottom` | Half arrowhead pointing downward from the line |

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

| Property | Type | Required | Default | Description |
| ---------- | ------ | ---------- | --------- | ------------- |
| `height` | number | Yes | — | Vertical space in pixels added to the diagram at this point |
| `actor` | string | No | — | Alias of the actor to anchor a comment to; comment appears beside this actor's timeline |
| `actors` | string[] | No | — | Array of two actor aliases; comment spans horizontally between these actors |
| `activate` | string[] | No | — | Array of actor aliases whose activation bars begin at this point |
| `deactivate` | string[] | No | — | Array of actor aliases whose activation bars end at this point |
| `comment` | object | No | — | Note/comment block to display; requires `actor` or `actors` to position it |

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

| Property | Type | Required | Default | Description |
| ---------- | ------ | ---------- | --------- | ------------- |
| `fragmentType` | string | Yes | — | Type of fragment controlling its semantics and header label (see Fragment Types below) |
| `title` | string | Yes | — | Label displayed in the fragment header tab (e.g. "Retry logic") |
| `condition` | string | Yes | — | Condition text displayed in brackets below the title (e.g. "while x < 3"); use empty string if none |
| `lines` | array | Yes | — | Array of line objects contained within this fragment |
| `startActor` | string | No | — | Alias of the leftmost actor; if omitted, fragment spans all actors used within it |
| `endActor` | string | No | — | Alias of the rightmost actor; if omitted, fragment spans all actors used within it |
| `bgColour` | colour | No | `"rgb(255,255,255)"` | Fill colour of the fragment background |
| `borderColour` | colour | No | `"rgb(0,0,0)"` | Stroke colour of the fragment border |

#### Fragment Types

| Type | Description |
| ------ | ------------- |
| `loop` | Iteration/repetition block; condition specifies the loop guard (e.g. "while x < 3") |
| `alt` | Alternative paths (if/else); use nested `condition` lines to define else branches |
| `opt` | Optional block; contents execute only if condition is met |
| `par` | Parallel execution; use nested `condition` lines with `and` to show concurrent paths |
| `critical` | Critical section; rendered with heavier border to indicate mutual exclusion |
| `break` | Break/exception handling; exits the enclosing fragment when condition is met |
| `rect` | Highlight region with coloured background; purely visual, no control-flow semantics |

**Example: Nested fragments with loop, alt, else, and opt:**

![Fragment example](test/mermaid-features/06-fragments/expected.svg)

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

sequencer-svg transforms Mermaid sequence diagram syntax into its native format. Each example below shows the Mermaid input, the transformed sequencer YAML, and the rendered SVG.

### Basic Syntax

**Mermaid diagram:**

```mermaid
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B-->>A: Hi Alice!
```

**Mermaid source:**

```text
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob!
    B-->>A: Hi Alice!
```

**Transformed sequencer YAML:**

```yaml
title: Basic Syntax
version: '1.0'
actors:
  - {name: Alice, alias: A, actorType: participant}
  - {name: Bob, alias: B, actorType: participant}
lines:
  - {type: call, from: A, to: B, text: Hello Bob!, toArrow: fill, arrow: fill}
  - {type: return, from: B, to: A, text: Hi Alice!, lineDash: [4, 2], toArrow: fill, arrow: fill}
```

**Rendered output:**

![Basic syntax](examples/readme/basic-syntax.svg)

### Messages and Arrows

**Mermaid diagram:**

```mermaid
sequenceDiagram
    participant A
    participant B
    A->>B: Sync call (filled arrow)
    B-->>A: Return (dashed, filled)
    A-)B: Async (open arrow)
    B--)A: Async return (dashed, open)
    A-xB: Lost message (cross)
    A->B: Solid line, no arrow
    A-->B: Dashed line, no arrow
```

**Mermaid source:**

```text
sequenceDiagram
    participant A
    participant B
    A->>B: Sync call (filled arrow)
    B-->>A: Return (dashed, filled)
    A-)B: Async (open arrow)
    B--)A: Async return (dashed, open)
    A-xB: Lost message (cross)
    A->B: Solid line, no arrow
    A-->B: Dashed line, no arrow
```

**Transformed sequencer YAML:**

```yaml
title: Messages Arrows
version: '1.0'
actors:
  - {name: A, alias: A, actorType: participant}
  - {name: B, alias: B, actorType: participant}
lines:
  - {type: call, from: A, to: B, text: Sync call (filled arrow), toArrow: fill, arrow: fill}
  - {type: return, from: B, to: A, text: 'Return (dashed, filled)', lineDash: [4, 2], toArrow: fill, arrow: fill}
  - {type: call, from: A, to: B, text: Async (open arrow), toArrow: open, arrow: open, async: true}
  - {type: return, from: B, to: A, text: 'Async return (dashed, open)', lineDash: [4, 2], toArrow: open, arrow: open}
  - {type: call, from: A, to: B, text: Lost message (cross), toArrow: cross, arrow: cross}
  - {type: call, from: A, to: B, text: 'Solid line, no arrow', arrow: none}
  - {type: return, from: A, to: B, text: 'Dashed line, no arrow', lineDash: [4, 2], arrow: none}
```

**Rendered output:**

![Messages and arrows](examples/readme/messages-arrows.svg)

**Arrow syntax reference:**

| Mermaid | Description | Sequencer `arrow` |
| --------- | ------------- | ------------------- |
| `A->>B` | Solid line, filled arrow (sync call) | `fill` |
| `A-->>B` | Dashed line, filled arrow (return) | `fill` + `lineDash` |
| `A-)B` | Solid line, open arrow (async) | `open` |
| `A--)B` | Dashed line, open arrow | `open` + `lineDash` |
| `A-xB` | Solid line, cross (lost message) | `cross` |
| `A--xB` | Dashed line, cross | `cross` + `lineDash` |
| `A->B` | Solid line, no arrow | `none` |
| `A-->B` | Dashed line, no arrow | `none` + `lineDash` |

### Activations

**Mermaid diagram:**

```mermaid
sequenceDiagram
    participant A
    participant B
    A->>+B: Request (activates B)
    B-->>-A: Response (deactivates B)
```

**Mermaid source:**

```text
sequenceDiagram
    participant A
    participant B
    A->>+B: Request (activates B)
    B-->>-A: Response (deactivates B)
```

**Transformed sequencer YAML:**

```yaml
title: Activations
version: '1.0'
actors:
  - {name: A, alias: A, actorType: participant}
  - {name: B, alias: B, actorType: participant}
lines:
  - {type: call, from: A, to: B, text: Request (activates B), toArrow: fill, arrow: fill}
  - type: return
    from: B
    to: A
    text: Response (deactivates B)
    continueFromFlow: true
    breakToFlow: true
    lineDash: [4, 2]
    toArrow: fill
    arrow: fill
```

**Rendered output:**

![Activations](examples/readme/activations.svg)

The `+` suffix activates the target; the `-` suffix deactivates it. You can also use explicit `activate`/`deactivate` statements.

### Notes

**Mermaid diagram:**

```mermaid
sequenceDiagram
    participant A
    participant B
    Note over A: Single actor note
    Note over A,B: Spanning note
    Note right of A: Right-side note
    Note left of B: Left-side note
```

**Mermaid source:**

```text
sequenceDiagram
    participant A
    participant B
    Note over A: Single actor note
    Note over A,B: Spanning note
    Note right of A: Right-side note
    Note left of B: Left-side note
```

**Transformed sequencer YAML:**

```yaml
title: Notes
version: '1.0'
actors:
  - {name: A, alias: A, actorType: participant}
  - {name: B, alias: B, actorType: participant}
lines:
  - {type: blank, height: 0, comment: Single actor note, actor: A}
  - {type: blank, height: 0, comment: Spanning note, actors: [A, B]}
  - {type: blank, height: 0, comment: Right-side note, actor: A}
  - {type: blank, height: 0, comment: Left-side note, actor: B}
```

**Rendered output:**

![Notes](examples/readme/notes.svg)

Notes transform to `blank` lines with a `comment` property. Use `actor` for single-actor notes or `actors` array for spanning notes.

### Fragments

**Mermaid diagram:**

```mermaid
sequenceDiagram
    participant A
    participant B
    participant C

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
```

**Mermaid source:**

```text
sequenceDiagram
    participant A
    participant B
    participant C

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
```

**Transformed sequencer YAML:**

```yaml
title: Fragments
version: '1.0'
actors:
  - {name: A, alias: A, actorType: participant}
  - {name: B, alias: B, actorType: participant}
  - {name: C, alias: C, actorType: participant}
lines:
  - type: fragment
    fragmentType: loop
    title: ''
    condition: Every minute
    lines:
      - {type: call, from: A, to: B, text: ping, toArrow: fill, arrow: fill}
  - type: fragment
    fragmentType: alt
    title: ''
    condition: Success
    lines:
      - {type: call, from: A, to: B, text: process, toArrow: fill, arrow: fill}
      - {type: condition, condition: Failure}
      - {type: call, from: A, to: C, text: handleError, toArrow: fill, arrow: fill}
  - type: fragment
    fragmentType: opt
    title: ''
    condition: Optional step
    lines:
      - {type: call, from: A, to: B, text: optional(), toArrow: fill, arrow: fill}
```

**Rendered output:**

![Fragments](examples/readme/fragments.svg)

The `else` keyword becomes a `condition` line inside the fragment. Additional fragment types include `par`/`and`, `critical`/`option`, and `break`.

### Rect Highlighting

**Mermaid diagram:**

```mermaid
sequenceDiagram
    participant A
    participant B
    A->>B: Before highlight
    rect rgb(200, 220, 255)
        A->>B: Inside highlight
        B-->>A: Response
    end
    A->>B: After highlight
```

**Mermaid source:**

```text
sequenceDiagram
    participant A
    participant B
    A->>B: Before highlight
    rect rgb(200, 220, 255)
        A->>B: Inside highlight
        B-->>A: Response
    end
    A->>B: After highlight
```

**Transformed sequencer YAML:**

```yaml
title: Rect Highlight
version: '1.0'
actors:
  - {name: A, alias: A, actorType: participant}
  - {name: B, alias: B, actorType: participant}
lines:
  - {type: call, from: A, to: B, text: Before highlight, toArrow: fill, arrow: fill}
  - type: fragment
    fragmentType: rect
    title: ''
    condition: ''
    bgColour: 'rgb(200, 220, 255)'
    borderWidth: 0
    lines:
      - {type: call, from: A, to: B, text: Inside highlight, toArrow: fill, arrow: fill}
      - {type: return, from: B, to: A, text: Response, continueFromFlow: true, lineDash: [4, 2], toArrow: fill, arrow: fill}
    startActor: A
    endActor: B
  - {type: call, from: A, to: B, text: After highlight, toArrow: fill, arrow: fill}
```

**Rendered output:**

![Rect highlighting](examples/readme/rect-highlight.svg)

Rect regions become `fragmentType: rect` with a `bgColour` and `borderWidth: 0` for no border.

### Autonumber

**Mermaid diagram:**

```mermaid
sequenceDiagram
    autonumber
    participant A
    participant B
    participant C
    A->>B: First message
    B->>C: Second message
    C-->>A: Third message
```

**Mermaid source:**

```text
sequenceDiagram
    autonumber
    participant A
    participant B
    participant C
    A->>B: First message
    B->>C: Second message
    C-->>A: Third message
```

**Transformed sequencer YAML:**

```yaml
title: Autonumber
version: '1.0'
actors:
  - {name: A, alias: A, actorType: participant}
  - {name: B, alias: B, actorType: participant}
  - {name: C, alias: C, actorType: participant}
lines:
  - {type: call, from: A, to: B, text: First message, toArrow: fill, arrow: fill}
  - {type: call, from: B, to: C, text: Second message, toArrow: fill, arrow: fill}
  - {type: return, from: C, to: A, text: Third message, lineDash: [4, 2], toArrow: fill, arrow: fill}
autonumber: true
```

**Rendered output:**

![Autonumber](examples/readme/autonumber.svg)

The `autonumber` directive sets the root-level `autonumber: true` property.

### Box Grouping

**Mermaid diagram:**

```mermaid
sequenceDiagram
    box rgb(200,220,255) Frontend
        participant UI
        participant API
    end
    box rgb(255,220,200) Backend
        participant Svc
        participant DB
    end
    UI->>API: Request
    API->>Svc: Forward
    Svc->>DB: Query
    DB-->>Svc: Result
    Svc-->>API: Response
    API-->>UI: Display
```

**Mermaid source:**

```text
sequenceDiagram
    box rgb(200,220,255) Frontend
        participant UI
        participant API
    end
    box rgb(255,220,200) Backend
        participant Svc
        participant DB
    end
    UI->>API: Request
    API->>Svc: Forward
    Svc->>DB: Query
    DB-->>Svc: Result
    Svc-->>API: Response
    API-->>UI: Display
```

**Transformed sequencer YAML:**

```yaml
title: Box Grouping
version: '1.0'
actors:
  - {name: UI, alias: UI, actorType: participant}
  - {name: API, alias: API, actorType: participant}
  - {name: Svc, alias: Svc, actorType: participant}
  - {name: DB, alias: DB, actorType: participant}
actorGroups:
  - {title: Frontend, bgColour: 'rgb(200,220,255)', actors: [UI, API]}
  - {title: Backend, bgColour: 'rgb(255,220,200)', actors: [Svc, DB]}
lines:
  - {type: call, from: UI, to: API, text: Request, toArrow: fill, arrow: fill}
  - {type: call, from: API, to: Svc, text: Forward, toArrow: fill, arrow: fill}
  - {type: call, from: Svc, to: DB, text: Query, toArrow: fill, arrow: fill}
  - {type: return, from: DB, to: Svc, text: Result, lineDash: [4, 2], toArrow: fill, arrow: fill}
  - {type: return, from: Svc, to: API, text: Response, lineDash: [4, 2], toArrow: fill, arrow: fill}
  - {type: return, from: API, to: UI, text: Display, lineDash: [4, 2], toArrow: fill, arrow: fill}
```

**Rendered output:**

![Box grouping](examples/readme/box-grouping.svg)

Mermaid `box` regions become `actorGroups` entries with a `title`, `bgColour`, and `actors` list.

### Actor Types

Mermaid supports specialised actor types using JSON configuration syntax.

**Mermaid diagram:**

```mermaid
sequenceDiagram
    participant UI as User Interface
    actor User as Human User
    participant API@{"type":"boundary"} as API Gateway
    participant Svc@{"type":"control","alias":"Service Controller"}
    participant Data@{"type":"entity","label":"Data Model"}
    participant DB@{"type":"database","name":"Database"}
    participant Items@{"type":"collections","label":"Item Collection"}
    participant Jobs@{"type":"queue","alias":"Job Queue"}
```

**Mermaid source:**

```text
sequenceDiagram
    participant UI as User Interface
    actor User as Human User
    participant API@{"type":"boundary"} as API Gateway
    participant Svc@{"type":"control","alias":"Service Controller"}
    participant Data@{"type":"entity","label":"Data Model"}
    participant DB@{"type":"database","name":"Database"}
    participant Items@{"type":"collections","label":"Item Collection"}
    participant Jobs@{"type":"queue","alias":"Job Queue"}
```

**Transformed sequencer YAML:**

```yaml
title: Actor Types
version: '1.0'
actors:
  - {name: User Interface, alias: UI, actorType: participant}
  - {name: Human User, alias: User, actorType: actor, bgColour: 'rgb(255,232,204)'}
  - {name: API Gateway, alias: API, actorType: boundary, bgColour: 'rgb(196,232,255)'}
  - {name: Service Controller, alias: Svc, actorType: control, bgColour: 'rgb(255,244,179)'}
  - {name: Data Model, alias: Data, actorType: entity, bgColour: 'rgb(220,255,214)'}
  - {name: Database, alias: DB, actorType: database, bgColour: 'rgb(255,221,234)'}
  - {name: Item Collection, alias: Items, actorType: collections, bgColour: 'rgb(226,220,255)'}
  - {name: Job Queue, alias: Jobs, actorType: queue, bgColour: 'rgb(255,235,186)'}
lines: []
```

**Rendered output:**

![Actor types](examples/readme/actor-types.svg)

Use Mermaid's configured participant syntax: `participant Alias@{"type":"typename"} as Display Name`. The `actor` keyword produces `actorType: actor` (stick figure). Default background colours are applied per type.

#### Configured Participant Fields

The configured participant JSON has two layers of behaviour:

- Mermaid-native behaviour: fields that Mermaid itself documents and uses when rendering on mermaid.live or via `mmdc`
- Transformer-only behaviour: extra fields that `sequencer-svg` reads when building sequencer actor data, even though Mermaid itself does not use them for display

| Field or syntax | Mermaid-valid syntax | Used by Mermaid renderer | Used by transformer | Notes |
| ------ | ------ | ------ | ------ | ------ |
| `Alias@{...}` | Yes | Yes | Yes | Preferred declaration form for specialised participants |
| trailing `as Display Name` | Yes | Yes | Yes | Mermaid display label; also highest-precedence source for sequencer `name` |
| `type` | Yes | Yes | Yes | Mermaid uses this for specialised visuals such as `boundary`, `control`, `entity`, `database`, `collections`, and `queue` |
| `alias` inside `@{...}` | Yes | Yes | Yes | Mermaid treats this as an inline display alias; if both inline `alias` and trailing `as ...` are present, Mermaid gives precedence to trailing `as ...` |
| `name` inside `@{...}` | Yes | No documented Mermaid effect | Yes | Transformer-only display-name source |
| `label` inside `@{...}` | Yes | No documented Mermaid effect | Yes | Transformer-only fallback display-name source |
| `bgColour` / `bgColor` / `backgroundColor` | Yes | No documented Mermaid effect on participant headers | Yes | Transformer maps these to sequencer actor colours |
| `fgColour` / `fgColor` / `textColor` | Yes | No documented Mermaid effect on participant headers | Yes | Transformer maps these to sequencer text colours |
| `borderColour` / `borderColor` / `lineColor` | Yes | No documented Mermaid effect on participant headers | Yes | Transformer maps these to sequencer border colours |

The transformer still accepts older compatibility forms such as `participant Alias as {...}` and bare `participant {...}` or `actor {...}`, but those are not standard Mermaid sequence syntax and should not be used in checked-in `.mmd` files.

#### Sequencer Actor Name Precedence

For a plain Mermaid declaration such as `participant API as Public API`, the transformer sets sequencer `name` from:

1. trailing `as Display Name`
2. otherwise the participant alias token

For a configured participant such as `participant API@{"type":"boundary"} as Public API`, the transformer sets sequencer `name` from:

1. trailing `as Display Name`
2. `config.name`
3. `config.label`
4. `config.alias` when there is an explicit alias token before `@` and no higher-precedence display source is present
5. otherwise the resolved actor alias

If an actor is created implicitly first from a message, activation, or link, it starts with `name == alias`. A later explicit declaration overwrites that implicit name.

### Additional Mermaid Features

The transformer also supports:

- **Actor links**: `link A: Label @ URL` and `links A: {"Label": "URL"}`
- **Accessibility**: `accTitle` and `accDescr` become `title` and `description`
- **Create/destroy**: `create participant` and destroy markers
- **Colours**: Participant colours (`#colour`), rect colours, box colours

---

## Text Formatting

### Built-in Tags

The renderer supports built-in text markup tags:

| Tag | Effect |
| ----- | -------- |
| `<code>...</code>` | Blue monospace text |
| `<comment>...</comment>` | Dark italic text |
| `<emph>...</emph>` | Bold italic text |
| `<//>...<////>` | Dark italic with `//` prefix |

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
| ----- | -------- |
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

```text
Error whilst parsing YAML: bad indentation at line 15
```

### Semantic Errors

If the document structure is valid but contains semantic errors (unknown actors, invalid types, etc.), the renderer:

1. Continues processing
2. Renders red error boxes in the SVG at the error location
3. Logs warnings to stderr with source-line numbers

Example error box content:

```text
Error: Unknown actor alias "X" at line 23
```

**Example showing rendered error boxes:**

![Error handling](examples/Example_5.1.0.svg)

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
| ------ | ------------- |
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

```text
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
