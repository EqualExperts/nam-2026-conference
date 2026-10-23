# Record how agents reach the task tracker, not just where it is

## What this changes
CLAUDE.md's "Where work is tracked" section answers *how* as well as *where*: the tracker is GitHub Issues on `origin` (`EqualExperts/nam-2026-conference`, not the `upstream` remote), reached with the authenticated `gh` CLI, or equally a GitHub MCP server or the REST API with a token. Access is confirmed with a read-only probe (list or read an existing issue) and never by creating a test ticket. Label and workflow conventions are linked to `docs/harness/github.md` and `docs/context/harness.md`, not restated. No code or behaviour changes.

## Where
- `CLAUDE.md` — the "Where work is tracked" section (currently one sentence): keep the existing "never the upstream's" rule, add the route, repository, alternatives, probe rule and the link to the label docs. Doc home confirmed by the context map: `node scripts/context.mjs for CLAUDE.md` names no doc, so CLAUDE.md is the owner.
- `tests/unit/tracker-context.test.js` (new) — reads CLAUDE.md as text, as `tests/unit/deploy-workflow.test.js` does; no lane or helpers needed (pure file read, no DB).
- `docs/context/harness.md` — add the new test to the front-matter `tests:` list, so `npm test`'s `context check` still finds every test file owned.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Context states tracker, repository, route and read-only-probe rule | the section names `GitHub Issues`, `EqualExperts/nam-2026-conference`, `gh`, `upstream`, and says a probe is read-only and never creates a ticket; none of it is in CLAUDE.md on main | unit |
| An agent can answer "which tracker, how do I talk to it" from context alone | the section also names the MCP server and REST-with-token alternatives and states no preference | unit |
| Labels appear in exactly one place, linked not duplicated | the section links `docs/harness/github.md` and `docs/context/harness.md`, and none of `ai-working`, `needs-human`, `ready-for-human`, `ship:full` appears inside it | unit |

## Decisions
- Link to `docs/harness/github.md` and `docs/context/harness.md` for labels, rather than adding a new label table — OK?
- Name the literal repository `EqualExperts/nam-2026-conference` in CLAUDE.md, although a fork's differs — OK, or say "whatever `origin` points at" instead?

## Out of scope
Upgrading the winnow bundle (#82).
