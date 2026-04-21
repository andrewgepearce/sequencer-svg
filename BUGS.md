# Renderer bugs under investigation

This file is the renderer-comparison handoff for the SVG port.

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

- Bug 1 is **not closed**. Several wrong hypotheses were tried and one incorrect clamp was reverted.
- The current working tree keeps two renderer changes:
  - [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js) now redraws structural fragment end-band borders before the end-band timeline/activation pass.
  - [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js) again returns the `Actor.drawTimelines(...)` Y from fragment end-bands, matching [scratch/sequencer/Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/scratch/sequencer/Fragment.js).
- The fragment-related Mermaid SVG fixtures were regenerated from the current renderer for:
  - `06-fragments`
  - `10-parallel`
  - `11-critical-regions`
  - `12-break`
  - `15-rect-nesting-and-fragments`
- Targeted Jest verification passes for those slices plus:
  - `13-activation-flow-defaults`
  - `14-rect-highlighting`

The important caveat is: passing snapshots only proves the fixtures match the current renderer. It does **not** prove visual parity with the old PNG baseline.

## Bug 1 — fragment-end activation/timeline mismatch against old PNG

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

### Current remaining problem

Bug 1 is now narrower than at the start, but still open.

The remaining questions are:

- Does the current end-band border ordering now fully match the old PNG around the activation-bar/body overlap?
- Is there still a visible fragment-edge stroke crossing the activation bar where the old PNG does not show one?
- Is the activation bottom cap rendered at the correct Y and with the correct visibility compared to the old PNG?
- Is any dashed timeline still appearing above the activation fill in the end-band region?

The user’s latest review explicitly called out these still-visible problems:

- activation bar extends below the fragment, which is correct
- activation bar ends do not clearly match the old bottom-cap appearance
- a line still appears to cross the activation bars on the fragment edge
- dashed tail must start from the bottom of the activation bar
- dashed timeline must never appear above the activation bar

### Current code state for Bug 1

In the current renderer:

- [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js) end-band path does:
  1. active structural fragment backgrounds
  2. current fragment end fill
  3. active rect highlights
  4. active structural fragment borders
  5. current fragment end border
  6. `Actor.drawTimelines(...)`

- [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) still draws timelines first, then activation rectangles, matching the old general pattern inside `drawTimelinesWithBreak`.

This means the current open issue is no longer about clamping height. It is about whether the remaining draw ordering and Y positions truly reproduce the old canvas output.

### Next investigation steps

1. Compare the current rasterized SVG bottom zoom directly against `old-bottom-zoom-4x.png`.
2. If a crossing line is still visible, identify which exact SVG path creates it:
   - fragment end-band border path from [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js)
   - activation-bar border path from [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js)
   - dashed timeline path from [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js)
3. If needed, add short-lived tracing or targeted path suppression to isolate:
   - fragment end border only
   - activation rectangle border only
   - dashed tail only
4. Do not reintroduce the activation-height clamp unless new evidence contradicts the old PNG and old code.

## Bug 2 — Y accumulation drift between old and new

### Status

Still open. Not yet addressed after the Bug 1 work.

### Earlier evidence

At each fragment `drawEndLine` entry on the same input:

| Fragment | Old `endLineTop` | New `endLineTop` | Delta |
|----------|------------------|------------------|-------|
| loop     | 331              | 331              | 0     |
| opt      | 686              | 666              | −20   |
| alt      | 854              | 820              | −34   |

The first delta is exactly one `globalSpacing`. The second adds another 14 px.

### Current suspicion

Still most likely one of:

- [Blank.js](/Users/andrewpearce/dev/github/sequencer-svg/Blank.js) flow-state capture/restore
- lifecycle-aware branches in [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js)
- different line-height accumulation inside fragment inner lines

### Next step

Trace `Fragment.drawLines` / `Fragment.drawInnerLines` line-by-line for the `alt` body and compare to the old renderer to find the first mismatching Y advance.

## Bug 3 — new tool runs extra mimic/resize passes

### Status

Still open. Lower priority.

### Known state

- Old tool: 2 passes for the fragment repro
- New tool: 5 passes for the fragment repro
- The measured fragment end-line tops were stable across those new-tool passes, so this is waste rather than instability

### Next step

Instrument the resize loop and log measured width/height per pass. Do this only after Bug 1 and Bug 2 are in better shape.

## Bug 4 — fragment borders cut across activation bars

### Status

Still open, but partly overlaps with Bug 1.

### What changed

The current working tree moved fragment **end-band** border redraw below the activation/timeline pass by drawing those borders earlier in [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js).

### What is still unknown

Whether all remaining “line crossing the activation bar” problems are now reduced to:

- incorrect end-band border layering
- incorrect activation bottom-cap stroke
- or a wrong Y alignment caused by Bug 2

## Bug 5 — activation continuation geometry around nested fragments

### Status

Still open. No dedicated fix yet.

### Current view

Do not treat this as separate from Bug 1/4 until the basic fragment-end comparison is truly correct.

Once Bug 1 is visually matched, re-check the nested `opt` region to see whether Bug 5 still exists independently.

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

Open. Newly identified.

### Symptom

The final activation-tail region can emit a zero-height rectangle where all four rectangle corners share the same Y coordinate.

This is mostly harmless visually right now, but it is a real geometry bug and a source of unnecessary SVG noise.

### Evidence

Example from `06-fragments`:

- a path equivalent to:
  - `M ... 1100 L ... 1100 L ... 1100 L ... 1100 ...`

This comes from the “we have a start and an end” branch in [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js) when `flowEndYPos === flowStartYPos`.

### Current suspicion

The likely trigger is [Actor.clearAllFlows](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js), which sets `flowEndYPos = starty` for actors marked continue, allowing the later tail draw to re-enter a branch that constructs a zero-length activation rectangle.

### Expected fix

Guard against zero-height activation-rectangle emission in `drawTimelinesWithBreak`, or prevent `clearAllFlows` from creating a same-start same-end rectangle state for continuation tails.

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

## Trace-revert checklist

Older investigation notes referred to temporary stderr traces in:

- [Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/Fragment.js)
- [Actor.js](/Users/andrewpearce/dev/github/sequencer-svg/Actor.js)
- `/Users/andrewpearce/dev/github/sequencer/Fragment.js`
- `/Users/andrewpearce/dev/github/sequencer/Actor.js`
- [scratch/sequencer/Fragment.js](/Users/andrewpearce/dev/github/sequencer-svg/scratch/sequencer/Fragment.js)

Before committing, verify none of those temporary trace statements remain.
