# Keep attendee tickets on their fork

## Why
Every attendee files tickets and opens pull requests at once. One ticket
on the original workshop repo is everyone's noise, and it is easy to do: clone
the original instead of the fork, or clone the fork and never pin `gh`, which
then prefers the `upstream` remote. A rehearsal of `/ship` did exactly that —
the run started in a checkout of the original and claimed a ticket there.

## What changes
- `scripts/fork-guard.mjs` — decides whether a tool call creates an issue or
  pull request, and whether its target is the original repo; blocks it unless
  the signed-in account maintains that repo. `--hook` mode is a PreToolUse
  hook (exit 2 blocks); plain mode exits 1 for a checkout aimed at the original.
- `.claude/settings.json` runs it as a hook before every `Bash` and `mcp__*`
  call, so it holds for every attendee's Claude, skills and workflows included.
  It exits early on anything that is not a create.
- Ship's setup runs it first, before reading or claiming the ticket.
- `ONBOARD_CLAUDE.md` — the setup an attendee's Claude reads and carries out:
  fork, Issues on, clone, pin `gh`, the Actions click (the person's), set up
  the harness, install, test, restart Claude in the clone. README links it.
- `CLAUDE.md` and `docs/context/harness.md` describe the guard.

## Not blocked
Maintainers (maintain/admin) — the hosts run the GitHub Actions demo on the
original. Runs under `$GITHUB_ACTIONS`. Reads, label edits and comments: only
creating issues and pull requests is guarded, which is what floods a repo.

## Tests
`tests/unit/fork-guard.test.js` — which calls count as creates, how the target
is named, and the verdict for an attendee, a maintainer and a fork.
`tests/unit/ship.test.js` — setup runs the guard before it claims.
