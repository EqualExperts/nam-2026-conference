# Correct the healthcheck path in the Railway deploy spec

## What this changes
`specs/79-railway-deploy.md` stops naming `/api/conference`, which the API does not serve (it is a JSON 404). The spec records the healthcheck as `/api/health`, the path Railway uses and passes with, and its proof row describes a route that exists. No app code changes.

## Where
- `specs/79-railway-deploy.md` line 12 — healthcheck `/api/conference` becomes `/api/health`.
- `specs/79-railway-deploy.md` line 20 — the row "`/api/conference` is JSON; unknown `/api/...` is a JSON 404" becomes "`/api/health` is JSON; unknown `/api/...` is a JSON 404". Its check column stays: `GET /api/nope` is 404 `application/json`, not the shell.
- `tests/api/static.test.js` — no change: its tests request `/does-not-exist`, `/`, `/speakers/12` and `/avatars/*`, never `/api/conference` (read, not run). `/api/health` is served at `server/index.js` line 33.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| `specs/79-railway-deploy.md` contains no reference to `/api/conference` | `grep -rn "api/conference" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=worktrees --exclude-dir=specs` finds nothing, and `grep -c "api/conference" specs/79-railway-deploy.md` is 0 (the new spec is excluded; it names the old path) | repo grep, run by the builder |
| The recorded healthcheck is `/api/health` | `grep -n "healthcheck" specs/79-railway-deploy.md` shows `/api/health` | repo grep |
| Any mirroring test asserts an existing route, and `npm test` passes | `tests/api/static.test.js` asserts no `/api/conference`; `npm test` passes | existing suite |

## Out of scope
Documenting the Railway dashboard settings in the deploy docs, or moving them into repo config.
