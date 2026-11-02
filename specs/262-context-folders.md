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
    prd.md                    from docs/APP.md and CLAUDE.md's product decisions
    user-personas.md          from the seeded attendees and ticket tiers
  engineering-context/
    index.md                  was docs/context/README.md
    <area>.md                 was docs/context/<area>.md
    data-model.md             was docs/DATA_MODEL.md, now with front matter
    harness/                  was docs/harness/
      images/harness-flow.png was docs/images/
```

## Where
- `git mv` for every file above, so history follows.
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
| `docs/` is gone | `test ! -e docs` | gate |
| no live file names `docs/context`, `docs/harness`, `docs/demo` or `DATA_MODEL` | `git grep` outside `specs/` returns nothing | gate |
| the context tooling reads the new folder | `context.mjs check` inside `npm test`; `index` lists `data-model` | unit |
| prose vs harness classification unchanged in meaning | `qa-facts`, `gate`, `review-workflows` unit tests, paths updated | unit |
| every folder under `context/` has an `index.md` | `find context -type d` vs `find context -name index.md` | gate |
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

## Out of scope
- Winnow writing its record into `winnow-transcripts/` and offering to commit
  it — Abraham owns that.
- The Winnow skills' own text (`.claude/skills/winnow*`, `setup-winnow`,
  `listen-to-meeting`) — they find the context generically; suggested edits go
  to their owners.
