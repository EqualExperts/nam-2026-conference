---
area: testing
summary: The three test layers and their plumbing — Playwright config and helpers, the throwaway-database API harness, per-worktree port lanes, screenshots and the CI workflow.
read_when: writing or fixing a test, adding a data lane, a flaky or cross-talking spec, running two worktrees at once, npm run shot, the verify workflow or its summary
files:
  - playwright.config.js
  - tests/helpers.js
  - tests/api/harness.js
  - tests/unit/sandbox-db.js
  - scripts/lane.mjs
  - scripts/shot.mjs
  - scripts/ci-summary.mjs
  - scripts/ci-summary-node.mjs
  - .github/workflows/verify.yml
tests:
  - tests/unit/lane.test.js
  - tests/smoke.spec.js
related: [seed, architecture, clock, seats, harness]
---

# Testing

Why the cheapest layer wins: CLAUDE.md § Verifying a change. Which layer a test goes in:

- **Unit** — a pure function: the check-in window, the clock projection, travel, iCal
  escaping, a mapper. Import the module and assert.
- **API** — a rule that needs the database and the routes: seats, waitlists, promotion,
  check-in, rating, response shapes, `.ics` output. Nothing is shared, so book and break
  anything — no cleanup, no lane.
- **Browser** — what the attendee sees: navigation, the conflict dialog, responsive
  behaviour. Open pages with `visit(page, path, { as: ATTENDEES.kenji })`, not `page.goto`.

Commands: `npm test` (unit + API, under a second), `npm run verify` (reseed, then
Playwright headless; `npm run verify -- --ui` or `npm run verify:ui` for the interactive
runner), `npm run shot -- /schedule --mobile --user=2`, `npm run db:reset` (delete the
database file and reseed). Two different things are called a **lane** here: a *port lane*
(`scripts/lane.mjs`, one per worktree) and a *data lane* (`LANES` in `tests/helpers.js`,
one per Playwright test per project).

## How it works

**Unit** (`tests/unit/*.test.js`, `node --test`). A test importing anything under
`server/` must `import './sandbox-db.js'` first: it sets `ORBIT_DB` to an empty temp file
(deleted on exit) before `server/db.js` evaluates. The file has **no tables** — a module
that prepares statements at import time (the routers, `seats.js`, …) needs `migrate()`
from `server/db.js` called right after, as `tests/unit/attendance.test.js` does.
`query.js` prepares lazily, so `query.test.js` needs no schema.

**API** (`tests/api/*.test.js`). `harness.js:startApi()` makes a temp dir, runs
`server/seed.js` into it with `ORBIT_DB` set, sets `process.env.ORBIT_DB`, dynamically
imports `server/index.js` (which does not listen when imported), and listens on port 0.
It returns `{ api, close }`. `api` is `client(base)`: `get(path)`, `put(path, body)`,
`del(path)` each resolve to `{ status, type, text, body }` (a string body is sent
verbatim, for malformed-JSON tests); `json(path)` returns the body or throws on non-200.
Paths are relative to `/api`. Also exported: `days(api)`, `overlaps(a, b)`,
`shiftTime('10:15', 30)`, `clearAgenda(api, userId)` (every reservation, all days),
`keysDeep(value)` → `Set` of every key. One `startApi()` per file, in `before`, and
`close()` in `after`; files run in separate processes, so nothing is shared.

**Browser** (`tests/*.spec.js`). `playwright.config.js`: `testMatch: '**/*.spec.js'`,
`fullyParallel` (tests within one file run in parallel too), projects `desktop` (1440×900) and `mobile` (Pixel 7), `baseURL` from
`WEB_PORT`, `outputDir` from `PW_OUTPUT_DIR`, traces kept on failure. On CI: 1 retry,
`forbidOnly`, reporters `github`, `list`, `html`, and `json` → `test-results/results.json`.
`webServer` runs `npm run dev` and waits on the web URL (90 s);
`reuseExistingServer` is `!CI && !ORBIT_LANE`, so under a lane an occupied port fails
instead of silently testing another worktree's app.

`tests/helpers.js` exports:

- `API` — `http://localhost:${PORT ?? 3001}/api`, for `request.get(...)` calls.
- `ATTENDEES` — `{ jonas: 1, amara: 2, kenji: 3, sofia: 4, marcus: 5, priya: 6 }` (see seed).
- `conferenceDays()` → the four ISO dates from `/bootstrap`, cached per worker.
- `momentOn(dayIndex, 'HH:MM')` → `'YYYY-MM-DDTHH:MM'`; `MID_SESSION_TIME = '10:30'`,
  `BETWEEN_SLOTS_TIME = '11:10'`.
- `visit(page, path = '/', { as = ATTENDEES.jonas, at = null })` — an init script sets
  `orbit:currentUserId` and sets or **removes** `orbit:clockAt`, then `goto` and waits for
  the `banner` role.
- `failOnPageErrors(page, errors = [])` → array filled with console errors and page errors.
- `waitForResults(page, testId = 'result-count')` — waits until that testid stops saying Loading.
- `clearAgendaFor(request, userId, day)` — releases every seat and waitlist place that
  attendee holds on `day` (via `/users/:id/schedule`). Only on a `clean` lane.
- `laneFor(name, testInfo)` → `{ user, day: 'YYYY-MM-DD', slot?, clean? }` for the running project.
- `bookableFor(request, userId, day)` → sessions on `day` (no keynotes, no socials) that do
  not overlap anything the attendee holds, seat or waitlist, sorted by start then id.
  Typical use: `.find((s) => s.seatsLeft > 3)` or `.find((s) => s.isFull)`.

`LANES` is **not exported**; it is the table inside `helpers.js` that `laneFor` reads.
Entry shape: `'area.case': { desktop: { user, day, slot?, clean? }, mobile: {…} }`, with
`day` a 0-based index. Its comment lists read-only fixtures and the rule that lanes with a
`slot` own their slot on day index 2 outright — they assert an exact seat count, so any other
lane booking *a session in one of those slots* that day, even for a different attendee, can
shift it mid-assertion. The slot is what is owned, not the attendee.
It also names the read-only fixtures, including that **Jonas holds no waitlist place on any
day** — `plan.spec.js` reads him as the attendee who sees no waitlisted hours, so no test
may queue him for a full room.

**Port lanes** (`scripts/lane.mjs`). In a worktree, run `eval "$(node scripts/lane.mjs
claim 42)"` (42 = the issue) before anything else. `claim()` sweeps stale claims (worktree gone), returns
this worktree's existing claim if any, else writes `<git-common-dir>/orbit-lanes/<port>.json`
with flag `wx` for the first free pair from 4300 (API even, web = +1, up to 4398), then
probes both ports and gives the lock back if either is taken. `asEnv(lane)` prints
`ORBIT_LANE`, `PORT`, `WEB_PORT`, `NO_OPEN=1`. CLI: `claim [label]`, `release [port]`, `list`.
Everything takes injectable `root`, `worktree`, `free`, `exists` — that is how `lane.test.js` runs.

**Screenshots** (`scripts/shot.mjs`). Args: routes (default nine main routes), `--mobile`
(390×844), `--full`, `--user=N`, `--at=YYYY-MM-DDTHH:MM`. Starts `npm run dev` itself if
`WEB_PORT` is not answering, writes `.screenshots/<route>[.mobile].png`, and exits 1 if the
page logged a console error.

**CI** (`.github/workflows/verify.yml`, on push to `main`, every pull request, manual):
job `test` runs `npm run test:ci` (spec + JUnit to `test-results/node-tests.xml`) then
`ci-summary-node.mjs`; job `playwright` is a matrix over `desktop`/`mobile`, runs
`npm run build` (build check only — the suite still runs `npm run dev`), installs Chromium,
runs `npm run verify -- --project=<p>`, then `ci-summary.mjs <p>` and uploads
`playwright-report/` + `test-results/` as `playwright-report-<p>`. Both summary scripts
print a markdown table to `$GITHUB_STEP_SUMMARY` and exit 0 even with no report.

## Invariants

- No spec reads or writes state another concurrently running test can touch — one data
  lane per test per project, released or cleared afterwards.
- `lane 0` must still set `ORBIT_LANE` truthy (`'0'` as a string) — `lane.test.js` pins it.
- A lane never exports `ORBIT_DB`; each worktree seeds its own `data/orbit.db`.

## Gotchas

- `npm run verify` reseeds first, so a run killed halfway cannot poison the next; within
  a run nothing is reset. A test that books a seat and does not release it hits the
  overlap guard on its next run.
- There is no way to undo a check-in — pick a session the lane's attendee has not attended.
- `test.describe.configure({ mode: 'serial' })` plus a conditional `test.skip()` abandons
  the rest of the group; do not combine them.
- `tests/smoke.spec.js` already asserts every route renders with no console errors and no
  horizontal overflow on both projects, so responsive regressions fail on their own.
- The seed gives every attendee a plan, waitlist places included, so a test that asserts an
  absolute count assumes a zero that is not there. Read the baseline in the test — the
  payload the page fetched, or the number before the click — and assert the change. An API
  test may instead `clearAgenda(api, id)` first.
- A data lane owns an attendee on **one day**, so it protects per-day numbers only. Anything
  totalled across the conference — the hours tile, a whole-plan count — still moves when
  another lane writes for the same attendee on a different day; assert those from one
  payload, or pick an attendee no other lane uses at all.
- Before claiming a lane, check the whole `LANES` table *and* the read-only fixtures in its
  comment: the promotion test picks its session (and therefore its day) at runtime, so the
  day it occupies is not visible in the table.
- Tests that mutate one shared fixture run on one project only:
  `test.skip(testInfo.project.name !== 'desktop', …)` — see the promotion test in `tests/seats.spec.js`.
- A `Stat` tile counts up from zero only once the number is properly on screen, so a tile
  below the fold reads `0` however long you wait. Centre it first
  (`el.scrollIntoView({ block: 'center' })`); Playwright's `scrollIntoViewIfNeeded` counts a
  clipped tile as visible and is not enough — see `openPlan` in `tests/plan.spec.js`.
- Only `momentOn`/full `THH:MM` values pin the clock; a bare date in `at` is ignored.
- `clearAgendaFor` on a non-`clean` lane deletes seeded bookings, which the next run
  (without a reseed) no longer has — tests that expect seeded plans then fail far away.

## Where to change…

- **Add a data lane**: add an entry to `LANES` in `tests/helpers.js` with a `desktop` and a
  `mobile` pair whose `user`+`day` no other lane or fixture holds (see *Gotchas*), and — on
  day index 2 — that is pinned to a slot no `slot` lane owns (`09:00, 10:15, 11:30, 13:30,
  14:45, 16:00` belong to the seat-count lanes and `17:15` to `agenda.next-up-done`, so day index 2 has no free slot left) rather than picked dynamically with
  `bookableFor`, which can land on a seat-count lane's session. Check the whole table, not
  just lanes for the same attendee. Mark `clean: true` only if the seed books nothing for
  that attendee that day (seed doc lists who has which days). Read it with
  `const { user, day } = await laneFor('area.case', testInfo)`.
- New route: add it to `ROUTES` in `tests/smoke.spec.js` with its heading regex.
- New endpoint: `tests/api/endpoints.test.js` (see architecture).
