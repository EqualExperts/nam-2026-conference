# Make the product talk's context slide show Orbit's real folders and files

## What this changes
The project-context scene in the product talk lists Orbit's actual layout: `CLAUDE.md`, `context/index.md`, then the three folders under `context/` (`product-context/`, `engineering-context/`, `winnow-transcripts/`), each with a few real files (`prd.md`; `seats.md`, `testing.md`, `ui.md`, `harness/`; `demo-transcript.txt`) and a closing "one doc per area" entry. One line each, no inner structure. The "How are the mobile specs run?" example keeps opening `testing.md`.

## Where
- `src/components/presentation/product/orbitContext.js` (new) — plain data: `ORBIT_CONTEXT` (entries `{ path, what, key?, pick? }`, indented by folder) and `CONTEXT_CHIPS`; no JSX so a unit test can import it.
- `src/components/presentation/product/workflow.jsx` — replace `DOCS` and `CHIPS` (lines ~12-22) with imports from the data file; adjust `ContextScene` rows (folder rows as headings, files under them, "…" row without a path check) so the longer list fits the 700x540 box; `key` stays on `context/index.md`, `pick` on `testing.md`. The example's `read context/index → …testing.md` line becomes `context/index.md`.
- Test in `tests/unit/presentation.test.js` (unit layer, no lane): import `ORBIT_CONTEXT`, assert every path exists via `fs.existsSync` from the repo root, that the three folders and `context/index.md` are listed, that every file path has an extension, and that the `pick` entry is `testing.md` and its text mentions Playwright/mobile projects (checked against the doc content).
- `tests/presentation.spec.js` — existing specs unchanged; run on desktop and mobile with the beat count unchanged (no beats added).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Scene shows `context/index.md` and the three folders each with a real file | unit test asserts those entries present in `ORBIT_CONTEXT` (false today: `context/index` has no extension, no product-context or winnow-transcripts) | unit |
| Every listed path exists, test fails if renamed | unit test `existsSync` over every path; mutate a path to see it fail | unit |
| No shortened or invented names, extensions present | unit test: file paths match `/\.\w+$/`, folders end in `/` | unit |
| Example still names a real doc covering the answer | unit test: `pick` path exists and its content mentions `mobile` and `viewport` | unit |
| Same level of detail | scene rows carry one `what` line each; asserted by entry shape (`path`, `what` only) | unit |
| Existing presentation specs pass, beat count unchanged | `npm run verify` presentation spec, desktop and mobile | e2e |

## Decisions
- Is `winnow-transcripts/` shown with `demo-transcript.txt` as its real file, rather than `index.md`?
- Are paths shown in full from the repo root (e.g. `context/engineering-context/seats.md`) rather than as indented short names under their folder?

## Out of scope
Inner structure of the docs, chapter order or the rail (#299), the opening talk's introduction of the context.
