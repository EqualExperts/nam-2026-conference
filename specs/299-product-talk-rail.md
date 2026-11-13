# Frame the product talk with a workflow rail that lights one step per chapter

## What this changes
`/product-presentation` gets a persistent rail across the top of the stage: *Information → Distil → Remember · Raise*. It is drawn by `Deck` over the scenes, so the camera fly-through leaves it in place and only the lit node changes. Chapters now run problem → flow → implementation: the bare diagram ("One way in") becomes its own chapter right after "Where tickets come from"; the two-fold trick (two beats) and "Context and tasks" follow; "A sample implementation" comes next; "The project context" moves after it and before "One way to do it". From "A sample implementation" onward each node shows its skill command. While a rail is up the stage shrinks a little, bottom-anchored, so scenes (drawn from the top) never sit under it. Numbered kickers go. The engineering and opening talks are unchanged (no chapter of theirs has a `rail`).

## Where
- `src/components/presentation/Deck.jsx` — takes a `Rail` prop. Resolves `chapter.rail` (a value, or a function of `step`) to a list of lit node ids, or none. Renders `<Rail lit={…} />` inside the stage, outside the per-chapter `Layer`s, and scales the scene container (not the rail) to about 0.84 anchored bottom while a rail is up. Under reduced motion no animation, same state. Test in `tests/presentation.spec.js`.
- `src/lib/presentation.js` — new pure `litAt(rail, step)` (value or function → array of ids, `[]` when absent); unit test in `tests/unit/presentation.test.js`.
- `src/components/presentation/product/kit.jsx` — `WorkflowRail({ lit, commands })`: four nodes (`information`, `distil`, `remember`, `raise`; Remember and Raise as peers) with `data-testid="presentation-rail"` on the rail, `data-lit="<ids joined by space>"`, ghosted nodes when unlit, commands from `STEPS` under the node names when `commands`. Reuses `STEPS`; `StepRail` stays for `WaysScene`.
- `src/pages/ProductPresentationPage.jsx` — passes `Rail={WorkflowRail}` to `Deck`.
- `src/components/presentation/product/chapters.js` — new order: intro (title, where), diagram, loop, tracking, implementation, context, skills, raise, remember, winnow, flow, handoff. Each chapter gets `rail` per the ticket's table (`commands` true from `implementation` on, e.g. `rail: { lit: [...], commands: true }`).
- `src/components/presentation/product/workflow.jsx` — split the "One way in" beat from `loop` into a new `diagram` chapter (scene = the existing step-2 drawing of `LoopScene`, extracted); `loop` keeps two beats; reorder `WORKFLOW` exports so `context` follows `implementation`; strip number prefixes from kickers. `tracking` rail is a function: step 0 → `raise`, step 1 → `remember raise`.
- `src/components/presentation/product/intro.jsx`, `raise.jsx`, `winnow.jsx` — strip numeric kicker prefixes (`'1 · '`, `'6 · '`, `'7 · '`, `'8 · '`, `'9 · '`, `'10 · '`); `where` gets `rail: ['information']`.
- `context/engineering-context/ui.md` — the product chapter order sentence (around the `chapters.js` description) rewritten to the new order, and the rail described (also fixes #273).
- Fit check: in the spec, at 1600×900 and on the mobile project, assert the rail's bounding box bottom is above the top of every scene element in the current chapter's layer (no overlap), on a beat of a tall-at-top scene (`skills`, `ways` excluded as railless).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Rail with `presentation-rail` and `data-lit` on table chapters, empty on title, diagram, whole flow, hand-off | spec walks every beat, asserts `data-lit` against the table (a list in the test) | Playwright spec (desktop + mobile) |
| Only Information on "Where"; only Remember on context; only Raise on create-tasks; only Distil on winnow | same walk, exact `data-lit` per chapter name | spec |
| "Context and tasks" lights Raise then Remember+Raise | beats 1 and 2 of that chapter | spec |
| Commands appear from "A sample implementation" onward, not before | assert node command text absent before that chapter's first beat, present from it | spec |
| Chapter after "Where" is the bare diagram; two-fold trick has two beats | chapter order read from the progress-bar buttons' `aria-label`s; beat counts via counter | spec |
| Chapter order as in the table | `aria-label` list of the Chapters nav equals the expected names | spec |
| No kicker starts with a number | every `[data-eyebrow]` in the walk does not match `^\d` | spec |
| Beat count unchanged, every middle beat captioned, existing specs pass | existing walk updated for hero order; total asserted equal to today's count (22 beats today, counted from chapters.js; a constant in the test) | spec |
| Content under the rail not covered at 1600×900 or phone | rail bottom vs. scene content tops, both projects | spec |
| `ui.md` states the order | the doc names the chapters in order; `node scripts/context.mjs for` covers it, read in review (no automated check) | review |
| `litAt` resolves value / function / absent | unit | unit |

## Decisions
- Do the Title, diagram, whole-flow and hand-off chapters show no rail at all (empty `data-lit`, rail hidden), rather than all four ghosted — OK?
- Is the "Information" node unlit (ghosted) rather than absent from every chapter after "Where tickets come from" — OK?
- Should the rail carry skill commands only from "A sample implementation" on, so the "Context and tasks" lights show names alone — as the ticket's table says?
- Is a shrunk, bottom-anchored stage (about 0.84) acceptable on every railed chapter, instead of moving each scene down?

## Out of scope
Changing the engineering talk or carrying the ticket from Raise into it; what the project-context slide shows (#301).
