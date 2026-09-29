# Agent worktrees live inside the repo, not beside it

Issue [#84](https://github.com/EqualExperts/nam-2026-conference/issues/84).

## What this changes

Nothing an attendee sees — this is harness plumbing. What changes is where a
ticket's workspace lands on a laptop. Today `/ship 84` creates a sibling
directory `../orbit-wt-84`, so a run scatters directories through whatever
folder happens to hold the checkout, and a worktree nobody can see is one
nobody removes. After this, every agent worktree is created under
`.claude/worktrees/` inside the checkout — `wt-<n>` for a ticket, `main-<n>`
for the browser auditor's base probe, `qa-base` for QA's base comparison — one
git-ignored directory that `git worktree list` and `ls .claude/worktrees` both
account for.

The naming rule is mechanical: `orbit-X` becomes `.claude/worktrees/X` with the
`orbit-` prefix dropped.

## Where

- **`docs/harness/ship-playbook.md` §3 ("Get a workspace")**, line 62. The `wt=`
  expression keeps its `git rev-parse --path-format=absolute --git-common-dir`
  spine — that is what makes the path the same whichever worktree the agent
  starts in — and loses the `/..`:
  `wt="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.claude/worktrees/wt-<n>"`.
  Line 68's sentence, "Always that path — `orbit-wt-<n>` beside the main
  checkout", becomes the in-repo path; the reasoning after it (a relative `../`
  lands in three different places; reuse an existing one) is still true and stays.
- **`docs/harness/ship-playbook.md` §10 ("Clean up")**, line 312. `git worktree
  remove ../orbit-wt-<n>` becomes the same absolute expression as §3, inlined,
  so §10 removes exactly what §3 made from wherever the agent is standing:
  `git worktree remove "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.claude/worktrees/wt-<n>"`.
- **`.claude/workflows/ship.js`** — two prompt strings, no control flow.
  Line 421 (the `setup` prompt): `(orbit-wt-${issue} beside the main checkout)`
  → `(.claude/worktrees/wt-${issue} inside the checkout)`. Line 610 (the
  `browser` entry of `CODE_LENSES`, the base probe): `git worktree add
  ../orbit-main-${issue} origin/${BASE}` → `git worktree add
  .claude/worktrees/main-${issue} origin/${BASE}`.
- **`.claude/workflows/qa.js`** — three prompt strings, no control flow. Line
  357 (the command-probe `repro` prompt), line 365 (the browser-probe `repro`
  prompt) and line 491 (the `publish` prompt's `r.cleanup` clause): each
  `../orbit-qa-base` → `.claude/worktrees/qa-base`.
- **`docs/harness/README.md`**, line 150, in *Running it*: "its own worktree,
  `orbit-wt-<n>` beside the main checkout" → the git-ignored
  `.claude/worktrees/wt-<n>` inside it.
- **`docs/context/harness.md`**, one bullet in *Gotchas*: agent worktrees are
  now full checkouts *inside* the repo at `.claude/worktrees/`, ignored by
  `.gitignore`, so anything that walks the tree must enumerate with
  `git ls-files` — a recursive readdir descends into a worktree holding another
  branch's copy of the same file and reads it as this branch's.
- **`.gitignore`** — **no change**. Line 28 already reads `.claude/worktrees/`
  (read off the file; `git check-ignore -v .claude/worktrees/wt-84` at the
  branch point prints `.gitignore:28`). That is the precondition this ticket
  builds on, not something it adds.
- **`tests/unit/ship.test.js`** — a new `describe('worktree paths')` at the end
  with two tests. (1) Using the existing `run()` stub (default `args = 7`, so
  the issue number in a prompt is `7`): `prompts.setup` matches
  `/\.claude\/worktrees\/wt-7/` and `prompts['audit:browser#1']` matches
  `/\.claude\/worktrees\/main-7/`; neither matches `/orbit-(wt|main|qa)-/`. The
  browser lens only runs on a `full` ticket with a visible change, so this
  reuses the arguments the existing `audit:browser#1` test at line 474 passes:
  `run({ setup: { ...SETUP, runner: false }, implement: { ok: true, summary: 's', ui: true, browserTest: true } })`. (2) A file scan:
  `execFileSync('git', ['ls-files', '.claude', 'docs'], { cwd })` from the repo
  root, read each path, assert none contains `orbit-wt-`, `orbit-main-` or
  `orbit-qa-`. `git ls-files` rather than a walk, for the reason in the gotcha
  above; the repo root is `new URL('../../', import.meta.url)`.
- **`tests/unit/review-workflows.test.js`** — two assertions in the existing QA
  `describe`, no new fixtures. In the browser-repro test at line 401 (`run({
  probe: withFail('b') })`, which already asserts on `prompts['repro:b']` and
  `prompts.publish`): both match `/\.claude\/worktrees\/qa-base/`. In the
  command-probe test at line 491 (which already asserts on `prompts['repro:c2']`):
  the same match. That covers all three of qa.js's mentions.
- No lane and no data lane: every check here is `node --test`. `tests/helpers.js`
  is not involved.

## How it will be proved

| Done-when | Check | Layer |
| --- | --- | --- |
| Playbook §3 creates `.claude/worktrees/wt-<n>`, §10 removes that path | the file scan in `ship.test.js` — the playbook's only `orbit-wt-` lines are 62, 68 and 312, all three in §3 and §10 — plus reading the two blocks | unit |
| `ship.js` names both paths under `.claude/worktrees/` | `prompts.setup` → `wt-7`, `prompts['audit:browser#1']` → `main-7` | unit |
| `qa.js`'s base worktree is `.claude/worktrees/qa-base` in all three places | `prompts['repro:b']`, `prompts['repro:c2']`, `prompts.publish` each match it | unit |
| `docs/harness/README.md` no longer says "beside the main checkout" | the file scan (line 150 is its only `orbit-wt-`) | unit |
| Nothing under `.claude/` or `docs/` names `../orbit-wt-`, `../orbit-main-`, `../orbit-qa-` | the `git ls-files .claude docs` scan | unit |
| `npm test` passes | `npm test` | command |
| `git status` clean with a worktree present | `git worktree add .claude/worktrees/wt-probe origin/main && git status --porcelain` is empty, then `git worktree remove` | command |

Red at the branch point, verified before writing these rows: `git ls-files
.claude docs | xargs grep -l 'orbit-wt-\|orbit-main-\|orbit-qa-'` returns
`.claude/workflows/qa.js`, `.claude/workflows/ship.js`,
`docs/harness/ship-playbook.md` and `docs/harness/README.md` — so the scan test
and all five prompt assertions fail on main today.

The last two rows are **not** red today: `npm test` is green at the branch
point, and `.gitignore:28` already keeps a nested worktree out of `git status`.
They are regression guards on the criteria as written, not evidence of the
change, and should not be read as proof of it.

## Decisions

- **Prefix dropped, not kept.** `.claude/worktrees/orbit-wt-84` would repeat
  the project name inside a path that is already in the project. The directory
  name carries what distinguishes one worktree from another and nothing else.
- **§10 recomputes the path rather than reusing `$wt`.** Each phase of a ship
  run is a fresh agent with a fresh shell, so no variable survives from §3.
- **Removing the worktree you are standing in is unchanged.** It was already the
  case with `../orbit-wt-<n>`, and this ticket is about where the directory
  lives, not about who runs §10 from where.
- **The name for the base probe is `main-<n>`**, mirroring `orbit-main-<n>`,
  even though it is created from `origin/${BASE}` and the base is not always
  `main`. Renaming it is a separate argument from moving it.

## Out of scope

- `scripts/red-check.mjs`, which already makes its scratch worktree in
  `mkdtemp(tmpdir())` (line 90) — nothing to move.
- Migrating or deleting any `../orbit-wt-*` directory already on a laptop. The
  playbook's "reuse it if it exists" now looks only at the new path; an old one
  is a leftover to remove by hand.
- Any change to `scripts/lane.mjs`. A lane is keyed on the worktree's top-level
  directory, which is still distinct for a nested worktree.
