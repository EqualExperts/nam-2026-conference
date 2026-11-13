# Give the product talk a workflow rail and put its chapters in teaching order

## What this changes
`/product-presentation` gets a persistent rail across the top of the stage, *Information -> Distil -> Remember . Raise* (Remember and Raise are peers), and each chapter lights its station. The chapters run problem -> flow -> implementation: the bare diagram right after "Where tickets come from", then the two-fold trick (now two beats) and "Context and tasks", then "A sample implementation", then "The project context" (the implementation's first content), then "One way to do it" and the skills as before. From "A sample implementation" on, each node shows its skill command. Numbered kickers ("7 . create-tasks") go. The engineering and opening talks are unchanged. The beat count is unchanged.

## Where
- `src/components/presentation/Deck.jsx` — new optional prop `Rail`. Resolve `chapter.rail` (a value, or `(step) => value`) for the current beat into `{ lit: [ids], cmds?, problem? }`. Draw `<Rail>` inside the stage div but outside the parallax/fly-through layers, so only the lit node changes between chapters. While a rail is up the layers' wrapper (`motion.div` holding the `CHAPTERS.map`) scales to 0.86 with `transformOrigin: 'bottom'`, so scenes drawn from y = 60 start below the rail (rail occupies stage y 44-110; the top chrome bar is outside the stage). Under reduced motion `MotionConfig` already removes the animation; state still changes.
- `src/components/presentation/product/rail.jsx` (new) — `ProductRail({ lit, cmds, problem })`: four nodes with ids `information`, `distil`, `remember`, `raise`, `data-testid="presentation-rail"` on the wrapper with `data-lit={lit.join(' ')}`, per-node `data-testid="presentation-rail-node-<id>"` and `data-lit` true/false; a command line (`/winnow`, `/update-context`, `/create-tasks`) under Distil, Remember, Raise only when `cmds`. With `problem`, non-lit nodes are ghosted. With no `rail` the wrapper stays mounted but `visibility: hidden`, `aria-hidden`, `data-lit=""`.
- `src/pages/ProductPresentationPage.jsx` — pass `Rail={ProductRail}`.
- `src/components/presentation/product/chapters.js` — new order: title, where, wayin, loop, tracking, implementation, context, skills, raise, remember, input, winnow, ways, demo, handoff (update the doc comment).
- `src/components/presentation/product/intro.jsx` — `where` gets `rail: { lit: ['information'], problem: true }`; strip the numeric prefix from every kicker; `ways`/`demo` as in the table (`demo` all three with cmds).
- `src/components/presentation/product/workflow.jsx` — split `LoopScene`'s step 2 into `WayInScene` (its own chapter `wayin`, one beat "New information -> Distil -> Remember or Raise", no rail, placed after `where` in the intro group or the first of `WORKFLOW`); `loop` keeps two beats (rail Remember); `tracking` rail `(s) => ({ lit: s === 0 ? ['raise'] : ['remember', 'raise'] })`; `implementation` rail all three with cmds; `context` moves after it (rail Remember with cmds, its hero beat stays); `skills` all three with cmds; strip kicker numbers. Reorder the exported array accordingly.
- `src/components/presentation/product/raise.jsx` — `rail` on `raise` (Raise, cmds) and `remember` (Remember, cmds); kicker numbers off. `winnow.jsx` — both chapters `rail` Distil with cmds; kicker numbers off.
- `context/engineering-context/ui.md` — the `/product-presentation` section: the new chapter order, the rail and the `rail` chapter field (fixes #273).
- Tests in `tests/presentation.spec.js`, product describe; no data lane, no clock (the talk touches no attendee state). Helpers `counter`, `readCounter`, `failOnPageErrors` already in the file.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Rail with `data-lit` on every table chapter; empty on title, diagram, whole flow, hand-off | Walk the beats; at the first beat of each chapter read `presentation-rail`'s `data-lit`; assert empty and not visible on the four bare chapters | spec |
| Where: only Information; context: only Remember; create-tasks: only Raise; winnow: only Distil | Jump with `?beat=` to each chapter by its caption heading and assert `data-lit` equals exactly that id | spec |
| Context and tasks: Raise, then Remember and Raise | `data-lit` is `raise` on beat 1 and `remember raise` on beat 2 | spec |
| Commands from "A sample implementation" on, not before | Rail text contains `/winnow`, `/update-context`, `/create-tasks` from the implementation chapter's beat on, and none before | spec |
| Bare diagram follows the problem; two-fold trick has two beats | Heading of the beat after "Where tickets come from" is the diagram's; the two-fold chapter's two beats are the next two captions | spec |
| Chapter order as in the table | Collect caption headings in a walk and assert the chapter order, implementation before project context, both before "One way to do it" | spec |
| No kicker starts with a number | In the existing every-beat walk, assert each caption's kicker does not match `/^\d/` | spec |
| Beat count unchanged, every beat captioned, existing specs pass | Existing every-beat test (hero order updated to implementation, then project context); total read from the counter equals the count on main | spec |
| Content under the rail not covered at 1600x900 or phone | At each of the two viewports, on a scene beat, rail bounding-box bottom is at or above the top of the current layer's topmost content | spec (desktop and mobile projects) |
| `ui.md` states the order | Order is read in review; not machine-checked | docs |

## Decisions
- Is the "hidden" rail on the bare chapters a mounted-but-invisible element with `data-lit=""` (so the fly-through fade is smooth), rather than unmounted?
- Are the commands shown as `/winnow`, `/update-context`, `/create-tasks` (with the slash), where the ticket lists `update-context` and `create-tasks` without it?
- Is "all three" on a chapter *Distil, Remember and Raise* lit, with *Information* unlit?
- Is a stage scale of 0.86 (rather than "a little") OK, chosen so scenes' y = 60 clears a rail ending at y = 110?

## Out of scope
Carrying the ticket from the rail's Raise node into the engineering talk; changing the engineering talk; what the project-context slide shows (#301).
