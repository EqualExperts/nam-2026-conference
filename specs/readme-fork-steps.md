# Fork setup steps that match a fresh fork

## Why
Walking the README on a brand-new fork (jonasingvar/nam-2026-conference)
showed two gaps:

- **A fork's Actions start paused.** GitHub registers none of the workflows
  until someone clicks *I understand my workflows, go ahead and enable them* on
  the Actions tab, so "Run *Set up the harness*" had nothing to run.
- **The API key read as required.** Workshop attendees run `/ship`,
  `/code-review` and `/qa` from Claude Code, signed in as themselves; the
  GitHub Actions route is demoed on the main repo. The key, and letting Actions
  open pull requests, only matter for that route.

## What changes
- README *Set up your fork* is three steps: Issues on, Actions on, run *Set up
  the harness* (still needed — `/ship` labels issues `ready-for-human` /
  `needs-human`). The key and the PR permission move to a collapsed *Optional —
  run the agents on GitHub Actions too*, which says the fork's review and QA
  checks fail without the key and to run `/code-review` / `/qa` locally instead.
- The quickstart points at the new steps and gains the clone command.
- `docs/harness/github.md` mentions the paused Actions and stops counting
  "four" labels (there are seven).
- The setup summary shows a missing key as optional, not "nothing will run".
- `winnow-pin.test.js` accepts a README command that is a saved workflow
  (`.claude/workflows/<name>.js`), not only `/ship`.

## Checked on the fork
Issues on, Actions on, *Set up the harness* green with no key (all seven labels
created); clone, `gh repo set-default`, `npm install`, Playwright install,
`npm run dev` (web 200, `/api/health` ok) and `npm test` (531/531).
