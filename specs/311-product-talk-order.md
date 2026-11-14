# Product talk: context versus tracker before how they shape each other, one heading

## What this changes
In `/product-presentation`, after the diagram (beat 4, "One way in") the talk now
says why the context and the tracker are separate before how the context drives
and absorbs decisions: beat 5 "The context is today; the tracker is past and
future", then "Every decision starts from the context", "When new information
comes in, the context changes", then the hero "A sample implementation", then
straight into "A context is the project's memory, written for people and AI".
"Pick tasks from the state; the state moves with the tasks" and the hero "The
project context" are gone. The deck drops from 22 beats to 20; wording and
visuals of the remaining slides are unchanged.

## Where
- `src/components/presentation/product/workflow.jsx`
  - `WORKFLOW` — move the `tracking` chapter ahead of `loop`; delete its second
    beat ("They shape each other"); its `rail` becomes the plain `{ lit: ['raise'] }`.
    Update the order comment above `WORKFLOW`.
  - `TrackingScene` — drop the `step` prop and the two `step === 1` `<Show>`s
    (the ←/→ arrows and the "Each shapes the other" band); the `step === 0` band
    shows unconditionally.
  - `context` chapter — delete the `hero: true` beat "The project context".
  - `ContextScene` — the hero picture (`step === 0`, 📚 + `CHIPS`) goes, and with
    it the now-unused `CHIPS` constant; shift the rest down one: the docs list
    shows on every beat (`step >= 1` → always), "The advanced README" on
    `step === 0`, the index Q&A and `asking` on `step === 1`.
- `src/components/presentation/product/chapters.js` — the order comment above
  `PRODUCT_CHAPTERS` (context vs tasks, then the two-fold trick).
- `context/engineering-context/ui.md` — the product chapter list (~line 196–200):
  "Context and tasks" before "The two-fold trick (two beats)", and "The project
  context" no longer has a chapter slide.
- `tests/presentation.spec.js`
  - `NAMES`: 'Context and tasks' before 'The two-fold trick'.
  - `RAIL` (20 beats): after 'One way in', `['Context and tasks', 'raise', false]`,
    then two `['The two-fold trick', 'remember', false]`, `['A sample implementation', ALL, true]`,
    then two `['The project context', 'remember', true]`; comment says 20 beats.
  - hero test: `heroes` equals `['Asampleimplementation']`.
  - "rail sits clear": beat list re-pointed at the same scenes after the shift
    (old 7, 9, 11, 13, 15, 21 → `[2, 5, 8, 9, 11, 13, 19]`), and the `?beat=9` sample-implementation
    check becomes `?beat=8`.
  - new test in `The product presentation`: from `?beat=4`, press ArrowRight five
    times and read `presentation-caption`'s h2 each time (spaces stripped, as the
    hero test does) — the five titles in the ticket's order; then walk every beat
    and assert neither removed title ever appears.
  No attendee state, so no data lane or pinned clock is needed.
- `tests/unit/presentation.test.js` — unchanged: its `litAt` function case is a
  generic fixture, not the tracking chapter.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| From slide 4 the five titles follow in order | new "from the diagram the talk runs tracker, context, implementation" test: captions at beats 5–9 equal the five titles (on main beat 5 is "Every decision…") | spec |
| Neither removed slide appears anywhere | same test walks all beats: no caption h2 matches "Pick tasks from the state" or equals "The project context"; plus hero list is `['Asampleimplementation']` and counter total is 20 | spec |
| Rail lights `raise` on the tracker slide, `remember` on the two context slides | `RAIL` table in "one node is lit per chapter": beat 5 `raise`, beats 6–7 `remember` (on main beat 5 is `remember`, beat 6 `raise`, beat 7 `remember raise`) | spec |
| `npm test` and `npm run verify` pass | the gate | unit + spec |

## Decisions
- The unit test's `litAt` function case (`step === 0 ? ['raise'] : ['remember', 'raise']`)
  mirrors the old tracking rail but is a generic fixture of `litAt`; it stays, since
  function-valued rails remain supported.

## Out of scope
Any wording or visual change beyond the removals; the context slide's file listing (#301).
