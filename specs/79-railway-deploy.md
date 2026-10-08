# Deploy the app to a live environment

## What this changes
Run as one process (`npm start`), the server now serves the built `dist/` next to `/api`: the home page renders, `/speakers/12` survives a full page load, `/avatars/*` portraits load, a missing file or unknown `/api/...` path 404s (JSON for `/api`) rather than returning the HTML shell. `npm run dev` is unchanged: no `dist/` there, so nothing mounts. The `.ics` host needs no code (`ORBIT_PUBLIC_URL`, #60); it is a Railway variable.

## Where
- `server/index.js` — after the `/api` 404 handler (line ~31), `if (existsSync(DIST_DIR))` mount `express.static(DIST_DIR)`, then a `GET` fallback that sends `index.html` only for paths without a file extension (otherwise 404). `DIST_DIR = process.env.ORBIT_DIST_DIR ?? <repo>/dist` so a test can point it at a fixture. Log the listening port from `PORT`.
- `package.json` — `"start": "npm run db:seed && node server/index.js"`.
- `.nvmrc` — `22` (matches `node-version: 22` in the workflows).
- `tests/api/harness.js` — `startApi({ distDir } = {})` sets or deletes `ORBIT_DIST_DIR` before the dynamic import; returns `origin` too. Test in `tests/api/static.test.js` (a draft exists untracked in the earlier worktree) using `startApi` with a fixture `dist/` in a temp dir.
- `docs/context/architecture.md` — one note on production serving; `docs/context/testing.md` — `startApi` option.
- Railway (not in the repo, done by a person): start command `npm start`, healthcheck `/api/conference`, `ORBIT_PUBLIC_URL`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Opening the deployed URL renders the home page | `GET /` returns the fixture `index.html` | API (`static.test.js`) |
| Deep link `/speakers/12` renders | `GET /speakers/12` returns the shell, 200 | API |
| `/avatars/` portraits load | `GET /avatars/fixture.jpg` returns the file bytes | API |
| `/api/conference` is JSON; unknown `/api/...` is a JSON 404 | `GET /api/nope` is 404 `application/json`, not the shell; a missing `/avatars/x.png` is 404 | API |
| `npm run dev`, `npm test`, `npm run verify` unchanged | existing suites pass; no `dist/` means no static mount | existing suites |
| Reserving a seat, `.ics` host, SUCCESS deployment and runtime log | checked on the live URL after the Railway settings change | manual, outside CI |

## Decisions
- Add an `ORBIT_DIST_DIR` override (like `ORBIT_DB`) so tests never touch the real `dist/` — OK?
- Treat extension-bearing paths that miss as 404 instead of the shell, so a missing portrait is not a 200 HTML — OK?

## Out of scope
State surviving a restart, scheduled reseed, changing Railway settings from code.
