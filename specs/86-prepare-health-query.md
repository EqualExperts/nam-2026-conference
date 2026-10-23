# 86 — Prepare the health check's query once, not on every request

## What this changes

No attendee-visible behaviour changes. `GET /api/health` still returns
`{ ok: true, sessions: <count> }`. The fix is internal: the session-count
query is compiled once at module load instead of being recompiled on every
call to `/api/health`, matching the "prepare statements once, at module
scope" convention in `CLAUDE.md`.

## Where

- `server/index.js` — the handler at line 27-29:
  ```js
  app.get('/api/health', (req, res) => {
    res.json({ ok: true, sessions: db.prepare('SELECT COUNT(*) n FROM sessions').get().n });
  });
  ```
  Add a module-level prepared statement near the top of the file (alongside
  the other imports/setup, before the route table — there's no existing
  "statements" block in this file since it's the only inline query it has),
  e.g. `const countSessions = db.prepare('SELECT COUNT(*) n FROM sessions');`,
  and have the handler call `countSessions.get().n`.
- `tests/api/endpoints.test.js` — add a `GET /health` case to the walk of
  endpoints (this file already boots the app via `startApi()` from
  `tests/api/harness.js` and exposes `api.json(path)`). Assert the shape:
  `{ ok: true, sessions: <number> }` with `sessions` equal to
  `(await api.json('/sessions')).length` (the file already fetches
  `/sessions` into a local `sessions` array during `before()`, so the count
  can be compared against `sessions.length`). No new lane or attendee is
  needed — `/health` reads no per-user state.

## How it will be proved

- `npm test` — the new case in `tests/api/endpoints.test.js` calls
  `GET /health` and asserts `{ ok: true, sessions: sessions.length }`. This
  assertion does not exist on `main` today (there is no `/health` coverage in
  `tests/api/` at all — only `tests/smoke.spec.js` touches it, at the browser
  layer), so it is a new, currently-failing-if-broken check, not a
  restatement of something already proven.
- Reading `server/index.js` after the change confirms no `db.prepare(` call
  remains inside the `/api/health` handler — the prepare happens once, at
  module scope, next to the app's other module-level setup.

## Out of scope

- `docs/context/architecture.md`'s Gotchas note that `/api/health` is
  declared in `index.js`, not a router, so the endpoint-coverage regex
  ignores it — that's a test-tooling gap unrelated to this fix and is left
  alone.
