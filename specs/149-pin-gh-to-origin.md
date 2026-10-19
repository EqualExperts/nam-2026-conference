# Keep the harness on the fork: pin gh to origin on a laptop

## What this changes
Someone who forks the repo, clones the fork with `gh repo clone` and runs `/ship`,
`/code-review` or `/qa` from their terminal gets issues read and PRs opened on
**their fork**. Today those land on the upstream. Run without a terminal, `gh`
prefers a remote named `upstream` over `origin`, and `gh repo clone` of a fork
adds exactly that remote. CI is already pinned with `GH_REPO` on every step;
only a laptop run drifts.

## Where
- `.claude/workflows/ship.js`: a `PIN` constant, prepended to the setup prompt.
  The setup prompt's "`gh` works on the repository origin points at" becomes an
  instruction to pin, then confirm `gh repo set-default --view` names origin's
  repository, and to return proceed=false if it does not. The "never change gh
  configuration" clause gets one exception: the pin itself.
- `.claude/workflows/code-review.js`: the same `PIN` on the `context` agent, the
  first one to run `gh`.
- `.claude/workflows/qa.js`: the same `PIN` on the `scope` agent, the first one
  to run `gh`.
- `docs/harness/ship-playbook.md` §1: the pin command before `gh issue view`.
- `docs/context/harness.md` Gotchas: the CI-pinning entry also covers the laptop
  and says why `upstream` wins.
- `CLAUDE.md` *Where work is tracked*: the tracker is the repository `origin`
  points at, with no hard-coded owner (closes #128), plus the `upstream` trap and
  the pin command.
- `docs/harness/quickstart.md` step 3: clone, then pin.
- Tests: `tests/unit/ship.test.js` and `tests/unit/review-workflows.test.js`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| ship pins before any `gh` | the `setup` prompt contains `gh repo set-default "$(git remote get-url origin)"` and tells setup to stop if `--view` disagrees with origin (no such text on main) | unit, `ship.test.js` |
| code-review and QA pin before any `gh` | the `context` (code-review) and `scope` (QA) prompts contain the same command (absent on main) | unit, `review-workflows.test.js` |
| CLAUDE.md names no fixed owner | CLAUDE.md does not contain `EqualExperts/nam-2026-conference`, and does contain `gh repo set-default` (both fail on main) | unit, `ship.test.js` |
| quickstart pins | `docs/harness/quickstart.md` contains `gh repo set-default` (absent on main) | unit, `ship.test.js` |

## Decisions
- Should the pin be `gh repo set-default`, written to `.git/config`, rather than
  `GH_REPO=` on every command? Yes. Agent shell state does not persist between
  commands, so `GH_REPO` would have to prefix every `gh` call in every prompt and
  playbook, and one missed call drifts. `set-default` is stored once, is shared by
  every worktree, and also fixes the person's own `gh` commands. Its value is
  `origin`, which is what CLAUDE.md already says the tracker is.
- Should it be skipped in CI? Yes. `GH_REPO` already overrides it there, and the
  runner's checkout is thrown away.

## Out of scope
The winnow `create-tasks` skill: it is a vendored bundle (`winnow-pin.test.js`),
and it already finds the tracker from CLAUDE.md, which this change corrects.
