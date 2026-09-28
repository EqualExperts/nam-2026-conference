# 79 — Deploy the app to a live environment

## What this changes

Today nothing serves the app once you leave `npm run dev` — Vite's dev
server, which serves `index.html` and proxies `/api`, only exists in
development. Opening the deployed URL, or a deep link like `/speakers/12`,
gets a 404 from bare Express; there is no `/api` proxy to fall back to.

After this change, `server/index.js` itself serves the built `dist/`
(Vite copies `public/avatars/` and `public/images/` into it, so portraits
still resolve) alongside `/api`, falling back to `index.html` for any GET
that isn't `/api` and isn't a real static file — so a deep link or a page
refresh renders instead of 404ing. `npm start` seeds then runs the server,
which is what Railway's Node builder calls after `npm ci` / `npm run build`.
Nothing an attendee sees on `localhost:5173` during `npm run dev` changes —
the two-process dev setup and the Vite proxy are untouched, because the new
serving code only turns on when a `dist/` directory actually exists, which
`npm run dev` never builds.

`ORBIT_PUBLIC_URL` for calendar export links is already implemented
(#60, `server/lib/ical.js`) — deploying just means setting it on the host;
no code change needed for that Done-when line.

## Where

- **`server/index.js`** — add `import path from 'node:path'` and
  `fileURLToPath` to the existing `node:url` import. Compute
  `const DIST_DIR = process.env.ORBIT_DIST_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');`
  (an env override, matching `ORBIT_DB`/`ORBIT_START_DATE`/`ORBIT_PUBLIC_URL`,
  so a test can point it at a throwaway fixture instead of a real
  `npm run build` output). After the existing
  `app.use('/api', (req, res) => res.status(404)...)` line (line 31) and
  before the error-handling middleware, add:
  ```js
  if (existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get('*', (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
  }
  ```
  `existsSync` is already imported. Guarding on the directory's existence is
  what keeps `npm run dev` unchanged: it never runs `vite build`, so
  `DIST_DIR` never exists there and this block never mounts. Because it sits
  after the `/api` 404 handler, every unmatched `/api/*` request is already
  answered as JSON before reaching the new code — no path-excluding regex
  needed on the catch-all.
- **`package.json`** — add a `"start"` script:
  `"start": "npm run db:seed && node server/index.js"`, next to the existing
  `"dev"`/`"build"` entries. This is what Railway's Node builder runs after
  `npm ci` and `npm run build`.
- **`.nvmrc`** — new file, one line: `22`. Matches `node-version: 22` in
  every `.github/workflows/*.yml` (`actions/setup-node`).
- **`tests/api/harness.js`** — `startApi()` gains an optional options
  argument: `startApi({ distDir } = {})`. Before the dynamic
  `import('../../server/index.js')`, set
  `if (distDir) process.env.ORBIT_DIST_DIR = distDir; else delete process.env.ORBIT_DIST_DIR;`
  so a test can hand the app a fixture `dist/` without ever touching the
  real project's (gitignored) `dist/` folder — the same reason `ORBIT_DB`
  exists.
- **`tests/api/static.test.js`** — new file, API layer, using `startApi`,
  `client`/fetch against the returned `origin` (a bare origin, not
  `/api`-prefixed — see how `calendar.test.js` uses `origin`). `before`
  builds a fixture `dist/` in a temp dir (`mkdtempSync`): a minimal
  `index.html` with a recognisable string, and `avatars/fixture.jpg` with
  some bytes, then calls `startApi({ distDir })`. `after` closes the api and
  `rmSync`s the temp dir. Assertions, see below.
- **`docs/context/architecture.md`** — the "Running it" paragraph gets a
  clause on production serving: `DIST_DIR`/`ORBIT_DIST_DIR`, the `npm start`
  script, and that it only mounts when `dist/` exists.
- **`docs/context/testing.md`** — the API bullet's description of
  `startApi()` gains the optional `distDir` argument.

No other file changes. `vite.config.js`, the dev scripts, and `server/lib/`
are untouched.

## How it will be proved

API layer, `tests/api/static.test.js`, against the real request path via
`startApi({ distDir })` (checked against the branch point first — with
`ORBIT_DIST_DIR` pointed at the fixture, main today answers all three of
these with a plain 404, because it reads neither the env var nor any
`dist/` directory):

- **The home page renders from the build.** `GET /` on the bare origin
  returns 200, `text/html`, and the fixture `index.html`'s body — not a 404.
- **A deep link renders instead of 404ing.** `GET /speakers/12` (a path with
  no matching static file) also returns 200 with that same `index.html`
  body — proving the SPA fallback, not just the root route.
- **A portrait under `/avatars/` loads.** `GET /avatars/fixture.jpg` returns
  200, `image/jpeg`, and the fixture file's exact bytes — served by
  `express.static`, not swallowed by the HTML fallback.
- **`/api` still answers JSON, not the fallback.** In the same run, `GET
  /api/does-not-exist` still returns the existing `{ error: "No route for…" }`
  404 shape — proving the catch-all never shadows the API even though it now
  sits right after it. (This one already holds on main with no `dist/`
  fixture at all; it is a regression guard for the new code, not a new proof
  row, but it lives in the same test file since it is cheap there.)

Not covered by a new test, and why:

- **Reserving a seat against the deployed API** — the new code only adds a
  static/file-serving branch after the existing `/api` routes; it does not
  touch `server/routes/*` or `server/lib/seats.js`. The existing seat tests
  (`tests/api/seats.test.js`) already prove reservations work, and they keep
  passing unmodified with the new code present (the API responses in
  `static.test.js` above show `/api` is unaffected by the static branch).
- **The `.ics` export using the public host** — already proven by
  `tests/api/calendar.test.js` from #60; nothing here changes `ical.js`.
- **`npm run dev` / `npm test` / `npm run verify` unchanged** — no line in
  `vite.config.js` or the `dev`/`test`/`verify` scripts changes, and the
  `existsSync(DIST_DIR)` guard means `npm run dev` (which never builds)
  never mounts the new branch. Proven by the existing suite passing
  unmodified — checked at the branch point: `npm test` is 446/446 green
  today (unit + API, ~1.4s).

## Decisions

- **`ORBIT_DIST_DIR` env override.** The ticket doesn't ask for one, but the
  project's own pattern for anything a test needs to point elsewhere is an
  `ORBIT_*` env var read by the module that owns the path (`ORBIT_DB` in
  `server/db.js` is the direct precedent, added for exactly this reason —
  so a test never touches the real file). Without it, proving the static/
  fallback behaviour would mean writing to and deleting the project's own
  `dist/` during `npm test`, which can stomp a developer's local build and
  would make `npm test` no longer safely runnable while `npm run dev` (or a
  `vite preview`) is using that same `dist/`.
- **Plain `app.get('*', …)` fallback, no `Accept`-header sniffing.** The
  ticket's own description distinguishes "navigation requests" from "asset
  requests", but every real asset this app ever requests already exists
  under `dist/` (Vite emits it there, `public/` is copied verbatim) and is
  served by `express.static` before the request ever reaches the catch-all.
  A path that isn't `/api` and isn't a real file in `dist/` is, in this
  app, always a client-side route — there is nothing else it could be — so
  sniffing `Accept: text/html` would add a branch that never has anything to
  decide.
- **No `railway.json`/`nixpacks.toml`.** Railway's Node builder auto-detects
  `build`/`start` in `package.json` (both already exist or are added here);
  the ticket doesn't ask for provider-specific config beyond what makes the
  process itself deployable.

## Out of scope

- Setting `ORBIT_PUBLIC_URL` on the Railway service itself — that's a host
  configuration step for whoever deploys it, not a code change.
- State surviving a restart, and any scheduled reseed (explicitly out of
  scope on the ticket).
- A `railway.json`/`nixpacks.toml` or other provider-specific config file.
