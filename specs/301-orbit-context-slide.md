# Make the product talk's context slide show Orbit's real folders and files

## What this changes
The "project context" scene of the product talk lists Orbit's own layout instead of a lookalike: `CLAUDE.md`, `context/index.md`, then `product-context/`, `engineering-context/` and `winnow-transcripts/` each with a few real files and a one-line purpose, closing with "one doc per area". Same level of detail as today (folders and files only). The "How are the mobile specs run?" example is unchanged and opens `testing.md`, which covers it. Beat count is unchanged.

## Where
- `src/components/presentation/product/context-docs.js` (new, plain data) — `DOCS` (entries `{ f, what, key?, pick? }`, a trailing `…` entry for the rest) and `CHIPS`, moved out of the scene so node can import them; every `f` is a repo path under `context/` or a root file, folders end in `/`.
- `src/components/presentation/product/workflow.jsx` — drop the inline `DOCS`/`CHIPS` (lines ~12-22), import them; `ContextScene` renders folder entries as headings with their files indented beneath (the list grows from 7 to about 12 rows, so tighten spacing to keep the panel inside its 540px box). Chips become `CLAUDE.md`, `context/index.md`, `context/engineering-context/testing.md`, `context/engineering-context/ui.md`.
- `tests/unit/context-slide.test.js` (new) — reads `DOCS`/`CHIPS`, asserts each path exists with `fs.existsSync` from the repo root, that the three folders are present with at least one file each, that no listed file lacks an extension, and that the picked doc is `testing.md` and its text mentions mobile. Runs under `npm test`.
- Spec `tests/presentation.spec.js` — existing product-presentation specs re-run on desktop and mobile; no change expected (lanes/helpers as they already use).
- `context/engineering-context/ui.md` — one line noting the data file, if it describes the presentation files.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Scene shows `context/index.md` and the three folders each with a real file | `DOCS` contains `context/index.md` and each folder with at least one file under it (false today: `context/index`, no product-context or winnow-transcripts) | unit |
| Every listed path exists | test walks `DOCS` and `CHIPS` with `existsSync`; fails on a missing or renamed path | unit (`npm test`) |
| No shortened or invented names; extensions present | each file entry matches `\.\w+$` and exists; `context/index` fails today | unit |
| Mobile-specs example names a real doc that covers it | the picked entry is `testing.md`, exists, and its text contains `mobile` | unit |
| Level of detail unchanged | entries are only folders and files, no `.claude/`, `scripts/`, front matter or section lists | unit |
| Product-presentation specs pass, beat count unchanged | existing `tests/presentation.spec.js` | e2e (`npm run verify`) |

## Decisions
- Show `harness/` as a folder entry under `engineering-context/` alongside the doc files, as the ticket's example suggests — OK?
- Use `winnow-transcripts/demo-transcript.txt` as that folder's file, since it has no `.md` beyond `index.md`; or `index.md`? Plan: list `index.md` and `demo-transcript.txt` — OK?
- Keep the main-and-chips list identical to the panel's picks rather than adding more chips — OK?

## Out of scope
Doc internals, chapter order and the rail (#299), the opening talk's introduction of the context.
