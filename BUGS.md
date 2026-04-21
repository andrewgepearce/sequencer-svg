# Renderer bugs under investigation

This file is the renderer-comparison handoff for the SVG port.

## Bug summary

Keep this summary list in sync whenever any bug below is added, removed, reopened, fixed, or reclassified.

- 1 - **Resolved** - fragment-end activation/timeline mismatch against old PNG
- 2 - **Fixed** - Y accumulation drift between old and new
- 3 - **Fixed** - new tool runs extra mimic/resize passes
- 4 - **Resolved** - fragment borders cut across activation bars
- 5 - **Resolved** - activation continuation geometry around nested fragments
- 6 - **Fixed** - mimic passes emit measurement-only paths into the SVG
- 7 - **Fixed** - zero-height activation rectangle emitted at the final tail
- 8 - **Fixed** - timelines are over-drawn multiple times within a single transition region
- 9 - **Open** - fragment closing-band stroke path semantics are awkward for SVG
- 10 - **Open, non-blocking** - width mismatch against old PNG is primarily font-driven
- 11 - **Fixed** - activation bar stroke paths omit the bottom closing edge

The canonical comparison fixture is [test/mermaid-features/06-fragments/](/Users/andrewpearce/dev/github/sequencer-svg/test/mermaid-features/06-fragments/), with:

- Old tool (canvas/PNG): `/Users/andrewpearce/dev/github/sequencer/sequencer.js`
- Old reference code copied into this repo: [scratch/sequencer](/Users/andrewpearce/dev/github/sequencer-svg/scratch/sequencer)
- New tool (SVG): [sequencer.js](/Users/andrewpearce/dev/github/sequencer-svg/sequencer.js)
- Shared comparison YAML: `/tmp/seq-compare/fragments.yml`

Run the two tools apples-to-apples with:

```bash
cd /tmp/seq-compare
node /Users/andrewpearce/dev/github/sequencer/sequencer.js -y -f -o -Y -i fragments.yml
node /Users/andrewpearce/dev/github/sequencer-svg/sequencer.js -y -f -o -Y -i fragments.yml
```

Useful generated artefacts under `/tmp/seq-compare/`:

- `Mermaid_fragments.1.0.png`: old PNG baseline
- `fragments.svg`: latest SVG from this repo
- `fragments-return-y-test.png`: latest rasterized SVG comparison image
- `old-bottom.png`, `old-bottom-zoom*.png`: old bottom-region crops
- `new-bottom.png`, `return-y-bottom-zoom*.png`: new bottom-region crops

## Current state

- Bug 1 appears resolved in the current renderer after the Bug 6 and Bug 8 cleanup work.
- Bug 2 is now fixed in the current renderer after the blank-note spacing correction.
- Bug 3 is now fixed in the current renderer after the blank-note negative-X correction.
- Bug 4 no longer appears independently reproducible after the Bug 2 fix.
- Bug 5 no longer appears independently reproducible after the Bug 2 fix.
- Bug 7 is fixed in current `main`: zero-height activation tail rectangles are no longer emitted.
- The current working tree keeps two renderer changes:
  - [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js) now redraws structural fragment end-band borders before the end-band timeline/activation pass.
  - [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js) again returns the `Actor.drawTimelines(...)` Y from fragment end-bands, matching [scratch/sequencer/Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/scratch/sequencer/Fragment.js).
- Mermaid `expected.svg` fixtures have been regenerated for all affected slices through the Bug 3 cleanup.
- `npx jest --runInBand test/mermaid-features` passes with 27 suites and 57 tests.

The important caveat is: passing snapshots only proves the fixtures match the current renderer. It does **not** prove visual parity with the old PNG baseline on every renderer bug, but Bug 1 was rechecked visually against a fresh rasterized current build before being downgraded.

## Bug 1 — fragment-end activation/timeline mismatch against old PNG

### Status

Resolved in current `main` as of 2026-04-21, based on fresh rasterized comparison against the old PNG baseline.

### Target behaviour from old renderer

Confirmed from both the old PNG and [scratch/sequencer/Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/scratch/sequencer/Actor.js:737):

- The activation bar **does extend below** the fragment closing band.
- The dashed timeline is drawn first, then the activation rectangle is drawn over it.
- The dashed tail resumes **from the bottom of the activation extension**, not from the fragment border.
- The activation bar has its own visible bottom cap line.

So the goal is **not** “clamp the activation to the fragment bottom”. That earlier interpretation was wrong and was reverted.

### What was learned

1. Old and new renderers both enter the continuation branch for the fragment end-band.
   - Flow state at fragment-end entry matched in both renderers during earlier tracing.
   - The old renderer also uses the full continuation height in the `isFlowStateContinue()` branch.

2. The old fragment end-band advances layout to the bottom of the activation extension.
   - Old code at [scratch/sequencer/Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/scratch/sequencer/Fragment.js:403-417) assigns:
     - `xy = Actor.drawTimelines(...)`
     - then returns that `xy`
   - That means later timeline passes start below the extended activation, not at the fragment border.

3. The current SVG port had drifted from that in one of the attempted fixes.
   - A clamp in `Actor.drawTimelinesWithBreak` was tried to stop the bar at the fragment border.
   - That clamp was incorrect relative to the old renderer and has been reverted.
   - Another temporary change made fragment end-bands return the end-rectangle Y instead of the timeline Y.
   - That also diverged from old behaviour and has been reverted.

4. One code change remains intentional:
   - structural fragment end-band borders are currently drawn before end-band timelines/activations in [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js)
   - this was kept because the old/new visual mismatch includes border-vs-activation stacking

### Resolution

After Bug 6 and Bug 8 were fixed, the fragment-end comparison was rerun from a fresh current build rather than relying on the older `/tmp/seq-compare` raster artifacts.

Fresh comparison outputs used:

- current rasterized SVG: `/tmp/bug1-current.png`
- current bottom crop, 4x: `/tmp/bug1-current-bottom-4x.png`
- old baseline bottom crop, 4x: `/tmp/bug1-old-bottom-4x.png`

That fresh comparison no longer showed the original Bug 1 symptoms:

- the activation bar still extends below the fragment, matching old
- the dashed tail resumes below the bar
- the fragment-edge stroke is no longer visibly cutting across the activation bar
- the activation bar cap is visible at the join

The older `/tmp/seq-compare/new-bottom-zoom-4x.png` comparison image still shows the classic crossing artefact, but that image predates the later Bug 6 and Bug 8 fixes and is no longer representative of the current renderer state.

### Current code state that remains important

In the current renderer:

- [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js) end-band path does:
  1. active structural fragment backgrounds
  2. current fragment end fill
  3. active rect highlights
  4. active structural fragment borders
  5. current fragment end border
  6. `Actor.drawTimelines(...)`

- [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) still draws timelines first, then activation rectangles, matching the old general pattern inside `drawTimelinesWithBreak`.

This means the old Bug 1 lesson still stands: do not reintroduce the activation-height clamp unless new evidence contradicts the old PNG and old code.

### Follow-on notes

- Two nearby issues remain and may have been confused with Bug 1 earlier:
  - Bug 2: the Y-placement drift versus the old renderer
  - Bug 7: the zero-height activation-tail rectangle still emitted at the very end
- If the visual fragment-end crossing symptom reappears, regenerate fresh comparison crops before trusting older `/tmp/seq-compare` zoom images.

## Bug 2 — Y accumulation drift between old and new

### Status

Fixed in current `main` as of 2026-04-21.

### Earlier evidence

At each fragment `drawEndLine` entry on the same input:

| Fragment | Old `endLineTop` | New `endLineTop` | Delta |
|----------|------------------|------------------|-------|
| loop     | 331              | 331              | 0     |
| opt      | 686              | 666              | −20   |
| alt      | 854              | 820              | −34   |

The first delta is exactly one `globalSpacing`. The second adds another 14 px.

### Root cause

The first mismatching Y advance was not in the fragment wrapper itself.

Tracing `Fragment.drawLines(...)` line-by-line against the old renderer showed that both renderers stayed aligned through:

- the outer `loop`
- the first `alt` call
- the `else` condition line
- the nested `opt`

The first drift appeared on the note-style `blank` line inside the `alt` body:

- old blank-note end Y: `799`
- new blank-note end Y: `805`

That drift came from [Blank.js](/Users/andrewpearce/dev/github/sequencer-svg/Blank.js):

- blank-line comments were adding a small bottom gap below the note box
- the added gap increased the blank-line minimum height
- timeline dash alignment then rounded that extra height up again, amplifying the drift

So the visible `opt` and `alt` fragment-end deltas were downstream effects of the blank-note spacing, not a fragment-end-band calculation bug.

### Implemented fix

- [Blank.js](/Users/andrewpearce/dev/github/sequencer-svg/Blank.js) now returns `0` from `_getCommentBottomGap(...)`, restoring the legacy blank-note spacing behaviour.
- [Comment.js](/Users/andrewpearce/dev/github/sequencer-svg/Comment.js) comment-spacing defaults were also realigned with the published schema and legacy default value of `1`.

### Verification

- A fresh line-by-line trace of `06-fragments` now matches the old renderer through the full `alt` body:
  - nested `opt` still ends at `739`
  - the blank note now ends at `799`, matching old
  - the following `Failure path` call now starts at `799` and the enclosing `alt` now ends at `949`, matching old
- Mermaid `expected.svg` fixtures were regenerated for all affected slices.
- `npx jest --runInBand test/mermaid-features` passes with 27 suites and 57 tests.

## Bug 3 — new tool runs extra mimic/resize passes

### Status

Fixed in current `main` as of 2026-04-21.

### Root cause

The extra render pass was not primarily a generic `SvgStart.js` resize-loop problem.

It came from [Blank.js](/Users/andrewpearce/dev/github/sequencer-svg/Blank.js) recording `working.negativeX` for blank-line comments before the final left-edge clamp was applied:

- the current SVG port captured the raw centred note left edge
- if that raw left edge was off-canvas, `Working.init()` shifted `startX` right on the next pass
- that wider actor layout then forced one more width growth pass

The copied legacy renderer in [scratch/sequencer/Blank.js](/Users/andrewpearce/dev/github/sequencer-svg/scratch/sequencer/Blank.js) does **not** update `negativeX` for blank-line comments, so this was an SVG-port drift rather than an intentional optimisation gap.

### Implemented fix

- [Blank.js](/Users/andrewpearce/dev/github/sequencer-svg/Blank.js) no longer updates `working.negativeX` from blank-line comment placement.
- The rejected temporary `SvgStart.js` width-projection experiment was removed; the final fix is local to blank-note layout rather than the global resize loop.

### Verification

- The fragment repro now matches the old pass count:
  - old tool baseline artifact: `test/mermaid-features/06-fragments/Mermaid_fragments.1.0.png` is `973x940`
  - current SVG render of `/tmp/seq-compare/fragments.yml` now stabilises in `2` total passes and rasterizes to the matching `974x940` content box plus the normal SVG margin
- The accessibility-metadata repro also drops from `3` total passes to `2`.
- Mermaid `expected.svg` fixtures were regenerated for the affected note-driven slices:
  - `03-notes`
  - `04-accessibility-metadata`
  - `06-fragments`
- `npx jest --runInBand test/mermaid-features` passes with 27 suites and 57 tests.

## Bug 4 — fragment borders cut across activation bars

### Status

Resolved in current `main` as of 2026-04-21.

### Why this is now closed

This bug overlapped heavily with Bug 1 and Bug 2:

- Bug 1 covered the fragment-end activation/timeline join itself
- Bug 2 covered the Y drift that changed where the join landed
- the retained end-band border ordering change in [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js) addressed the main stroke-order concern

After the Bug 2 fix, a fresh rasterized crop of the current `06-fragments` output no longer showed a distinct “fragment border cutting across the activation bar” artefact relative to the old PNG baseline.

At this point there is no separate live repro that justifies keeping Bug 4 open as its own issue.

### Follow-on note

If a future fragment-edge crossing artefact is found, treat it first as a regression of Bug 1 or as a new specific repro, rather than reopening this broad placeholder bug by default.

## Bug 5 — activation continuation geometry around nested fragments

### Status

Resolved in current `main` as of 2026-04-21.

### Why this is now closed

This bug was always suspected to overlap with the fragment-end issues rather than stand fully alone.

After the Bug 2 fix, the nested `opt` region was re-checked against the old PNG baseline using a fresh current rasterized build:

- the nested `opt` body geometry aligned with the old baseline
- the activation continuation below the nested fragment no longer showed a distinct mismatch
- the note/call transition below the nested `opt` also aligned after the blank-note spacing correction

At this point there is no separate live repro that justifies keeping Bug 5 open as its own issue.

### Follow-on note

If a future nested-fragment activation mismatch is found, treat it as a new specific repro or as a regression of the fragment parity fixes, rather than reopening this placeholder bug by default.

## Bug 6 — mimic passes emit measurement-only paths into the SVG

### Status

Fixed in the working tree on 2026-04-21.

### Symptom

The renderer runs multiple mimic/layout passes before the real draw pass, but some mimic-mode drawing still serializes into the final SVG as degenerate `moveTo`-only paths.

These paths render nothing useful, bloat the SVG, and make inspection harder because they sit adjacent to real geometry.

### Evidence

Two concrete sources have been identified:

- [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) timeline path generation uses:
  - `mimic ? ctx.moveTo(actorcl.middle, timelineEnd) : ctx.lineTo(...)`
  - This produces degenerate timeline subpaths such as `M x y M x y2`.
- [Utilities.js](/Users/andrewpearce/dev/github/sequencer-svg/Utilities.js) rectangle path construction uses `moveTo` in mimic mode when building rectangle perimeter paths.
  - This shows up around note-box shadow/fill geometry and other measurement-only rectangles.

### Why it matters

- Bloats emitted SVG unnecessarily
- Pollutes manual diffing and visual inspection
- Risks masking real path-order issues when reading the SVG by eye

### Implemented fix

- [Utilities.js](/Users/andrewpearce/dev/github/sequencer-svg/Utilities.js) now returns early from `drawRectangle(...)` in mimic mode, so measurement-only rectangle and rounded-rectangle passes no longer build SVG paths.
- [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) now skips timeline-path emission entirely when `mimic === true`.
- [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) now also skips lifecycle end-marker path emission in mimic mode, so the same bug does not persist there.

### Verification

- Regenerated all Mermaid `expected.svg` fixtures from the current renderer.
- `npx jest --runInBand test/mermaid-features` passes with 27 suites and 57 tests.

## Bug 7 — zero-height activation rectangle emitted at the final tail

### Status

Fixed in the working tree on 2026-04-21.

### Symptom

The final activation-tail region can emit a zero-height rectangle where all four rectangle corners share the same Y coordinate.

This is mostly harmless visually right now, but it is a real geometry bug and a source of unnecessary SVG noise.

### Evidence

Example from `06-fragments`:

- a path equivalent to:
  - `M ... 1100 L ... 1100 L ... 1100 L ... 1100 ...`

This comes from the “we have a start and an end” branch in [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) when `flowEndYPos === flowStartYPos`.

### Implemented fix

- [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) now routes activation/flow rectangle emission through a small helper that skips zero-area rectangles.
- This keeps the fix local to flow geometry in `drawTimelinesWithBreak` without changing the general semantics of [Utilities.drawRectangle](/Users/andrewpearce/dev/github/sequencer-svg/Utilities.js).
- The dashed tail remains, but the empty activation box at the same Y is no longer emitted.

### Verification

- Fresh `06-fragments` output no longer emits the zero-height tail rectangle paths at the final `1100` Y.
- Mermaid `expected.svg` fixtures were regenerated for the affected slices.
- `npx jest --runInBand test/mermaid-features` passes with 27 suites and 57 tests.

## Bug 8 — timelines are over-drawn multiple times within a single transition region

### Status

Fixed in the working tree on 2026-04-21.

### Symptom

The same dashed timeline segment can be emitted multiple times at identical coordinates inside one fragment transition region.

This is distinct from the “extra mimic passes” problem in Bug 3. Bug 3 is about whole render passes; Bug 8 is about duplicate timeline drawing inside one final render.

### Evidence

Fragment rendering currently calls timeline drawing multiple times around the same regions, especially at fragment boundaries:

- [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js) calls `Actor.drawTimelines(...)` in multiple fragment-band stages
- other active-fragment/background/border paths are interleaved around those same regions

The net effect is repeated dashed timeline paths at identical coordinates in the final SVG.

### Why it matters

- Unnecessary SVG size
- Harder visual diffing
- Potential dash-phase artefacts at fragment boundaries when the same dashed line is stroked multiple times

### Implemented fix

- [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js) now treats the fragment height-probing timeline pass as measurement-only.
- That pass now runs with `mimic === true`, and fragment-local actor state is captured/restored around it so the later visible timeline pass still sees the same flow/lifecycle state.
- The result is that fragment transition regions now emit one visible dashed timeline segment per final pass instead of a measurement pass plus a visible pass.

### Verification

- The fragment repro SVG no longer repeats identical dashed timeline segments at the same coordinates in the same output file.
- `npx jest --runInBand test/mermaid-features` passes with 27 suites and 57 tests.

## Bug 9 — fragment closing-band stroke path semantics are awkward for SVG

### Status

Open. Newly identified. Related to Bug 4, but more specific.

### Symptom

Some fragment closing-band border paths are intentionally “partial rectangles” with only selected sides, but the current path-construction pattern uses move/line alternation that is canvas-tolerant and SVG-awkward.

This can produce edge-order and dash-phase asymmetry that is hard to reason about in the emitted SVG.

### Evidence

Closing-band border paths of the form:

- `M left top L left bottom M right bottom L right top M left top`

are valid for the intended border selection, but the path-construction style in [Utilities.js](/Users/andrewpearce/dev/github/sequencer-svg/Utilities.js) makes the right edge effectively traverse in the opposite direction from the left edge.

### Why it matters

- Makes SVG output harder to inspect
- Can create subtle dashed-stroke inconsistencies if dashed borders are ever used here
- Overlaps with the visual “line crossing the activation bar” investigations in Bugs 1 and 4

### Expected fix

Refactor rectangle-border path construction for partial-border cases so the SVG path semantics are explicit and stable, rather than relying on canvas-style move/line alternation.

## Bug 10 — width mismatch against old PNG is primarily font-driven

### Status

Open, but not currently treated as a correctness blocker.

### Symptom

The new SVG output is materially wider than the old PNG baseline, and the dominant cause appears to be text metrics rather than fragment geometry.

### Evidence

The most obvious contributor is call-text width:

- SVG output uses the bundled Liberation font stack
- the old PNG renderer used different canvas text metrics

That width difference propagates into actor spacing and `working.manageMaxWidth(...)`, stretching the whole diagram.

### Current view

This is likely the single biggest source of overall width mismatch between old PNG and current SVG, but it is separate from the fragment/activation bugs above.

### Expected fix

Decide whether this should be treated as:

- acceptable port drift due to different font metrics
- or a compatibility bug requiring closer font-metric emulation

For now, do not mix this with Bug 1 or Bug 2. It should stay isolated as a font-measurement compatibility question.

## Bug 11 — activation bar stroke paths omit the bottom closing edge

### Status

Fixed in the working tree on 2026-04-21.

### Symptom

Activation bars can render without the terminating horizontal stroke at the bottom of the bar outline.

This is visible outside fragment handling, so it is not just a fragment-end layering problem.

### Evidence

In [test/mermaid-features/07-autonumber/expected.svg](/Users/andrewpearce/dev/github/sequencer-svg/test/mermaid-features/07-autonumber/expected.svg), activation-bar outline paths such as:

- `M 60.5 297 L 60.5 381 M 65.5 381 L 65.5 297 M 60.5 297`
- `M 283 297 L 283 381 M 288 381 L 288 297 M 283 297`

draw the two vertical sides, but do not draw the bottom edge from left-bottom to right-bottom.

The fill path is still a full rectangle, so the bug is specifically in the emitted stroke geometry.

### Why it matters

- visible activation-bar outline defect in normal SVG output
- weakens confidence in the current activation path-construction logic
- may be related to the same canvas-oriented stroke construction style noted in Bug 9

### Expected fix

Inspect the activation-bar stroke path generation in [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) and any shared rectangle helpers in [Utilities.js](/Users/andrewpearce/dev/github/sequencer-svg/Utilities.js), then make the stroke path explicitly include the bottom closing segment when activation rectangles are drawn.

### Implemented fix

- [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) now treats zero-height flow rectangles as a visible termination-cap case instead of dropping them completely.
- When a zero-height activation tail still needs a top or bottom border, the renderer now emits a single explicit horizontal stroke across the bar width.
- This preserves the Bug 7 cleanup that removed zero-area rectangle noise, while restoring the missing bottom cap line at final activation tails.

### Verification

- [test/mermaid-features/07-autonumber/expected.svg](/Users/andrewpearce/dev/github/sequencer-svg/test/mermaid-features/07-autonumber/expected.svg) now contains explicit cap lines at the activation-tail end.
- Mermaid `expected.svg` fixtures were regenerated for all affected slices.
- `npx jest --runInBand test/mermaid-features` passes with 27 suites and 57 tests.

## Trace-revert checklist

Older investigation notes referred to temporary stderr traces in:

- [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js)
- [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js)
- `/Users/andrewpearce/dev/github/sequencer/Fragment.js`
- `/Users/andrewpearce/dev/github/sequencer/Actor.js`
- [scratch/sequencer/Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/scratch/sequencer/Fragment.js)

Before committing, verify none of those temporary trace statements remain.
