# Reshape docs/ into context/: product, engineering and Winnow transcripts

## What this changes
`docs/` becomes `context/`, the one place the repo's AI context lives, split by
who owns it: product (who, what, why), engineering (how it is built and worked
on) and Winnow's record of each conversation it processed. Every folder gets an
`index.md` saying what is in it and when to read it, so the folders can grow
without an agent reading all of them. No app, API or seed behaviour changes.

```
context/
  index.md                    the doc map: what each folder holds, what goes where
  winnow-transcripts/
    index.md                  what a record is; Winnow writes here
    demo-transcript.txt       was docs/demo/winnow-transcript.txt
  product-context/
    index.md
    prd.md                    was docs/APP.md, word for word; only its links re-pointed
    user-personas.md          new: the attendee types, from the seeded accounts and tiers
  engineering-context/
    index.md                  was docs/context/README.md
    <area>.md                 was docs/context/<area>.md
    data-model.md             was docs/DATA_MODEL.md, now with front matter
    harness/
      index.md                was docs/harness/README.md
      <playbooks>.md          was docs/harness/*.md
      harness-flow.png        was docs/images/harness-flow.png
```

## Where
- `git mv` for every file above, so history follows. Moved docs keep their
  text; only paths and relative links change (the engineering index gets an
  opening that describes its folder, the harness index a list of its files).
- `scripts/context.mjs` — `DIR = 'context/engineering-context'`; the index doc is
  `index.md`, not `README.md`.
- `context/engineering-context/data-model.md` — gains front matter (`area:
  data-model`, owns `server/db.js`) because `load()` requires it of every `.md`
  in the directory; it now shows up in `context.mjs index`.
- Path-prefix logic that treats `docs/` as prose and `docs/harness/` as harness:
  `scripts/qa-facts.mjs`, `scripts/gate.mjs`, `.claude/workflows/code-review.js`,
  `.claude/workflows/qa.js`, `.claude/workflows/ship.js` — `context/` is prose,
  `context/engineering-context/harness/` is harness.
- Every live path mention: `CLAUDE.md`, `AGENTS.md`, `README.md`,
  `ONBOARD_CLAUDE.md`, `.claude/rules/ui.md`, `.github/workflows/*.yml`, the
  presentation decks under `src/components/presentation/`, the moved docs
  themselves, and the unit tests that name paths.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| `docs/` is gone | `context.test.js`: no `docs/` directory | unit |
| no live file names `docs/context`, `docs/harness`, `docs/demo` or `DATA_MODEL` | `git grep` outside `specs/` returns nothing | review |
| every relative Markdown link resolves | a link scan over every tracked `.md` outside `specs/` | review |
| the context tooling reads the new folder | `context.mjs check` inside `npm test`; `index` lists `data-model` | unit |
| harness playbooks stay harness; everything else under `context/` is prose (APP.md, DATA_MODEL.md and the demo transcript used to count as code lines; now they do not) | `qa-facts`, `gate`, `review-workflows` unit tests, paths updated | unit |
| every folder under `context/` has an `index.md` | `context.test.js` walks `context/` | unit |
| harness playbooks still count as code, product and Winnow records as prose | `qa-facts.test.js` `codeLines` cases | unit |
| the decks still fit with the longer paths | screenshots of every slide that shows one; the ticket slide's callouts split folder from file name | visual |
| nothing the attendee sees changed | `npm run verify` | spec |

## Decisions
- The harness playbooks go under `engineering-context/harness/`: they are how
  engineering works, and the root stays at three folders.
- The demo transcript moves to `winnow-transcripts/`: it is a conversation
  Winnow is meant to process, the folder's first resident until Winnow writes
  its own records.
- `winnow-transcripts/` is top level, not under product: Winnow may be run on a
  technical conversation too.
- Old `specs/` keep the paths they were written with — they record history.
- `prd.md` is `APP.md` moved, not rewritten: this change reshapes the context,
  it does not edit what it says.
- CI's code review and QA run `main`'s harness on a pull request, so on this
  one they read the old paths and flag them; judge it by `npm test` on the
  branch.

## Out of scope
- Winnow writing its record into `winnow-transcripts/` and offering to commit
  it — Abraham owns that.
- The Winnow skills' own text (`.claude/skills/winnow*`, `setup-winnow`,
  `listen-to-meeting`) — they find the context generically; suggested edits go
  to their owners.
