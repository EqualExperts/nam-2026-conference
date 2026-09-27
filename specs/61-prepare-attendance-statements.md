# 61 — Prepare attendance's statements once, not on every check-in and rating

## What this changes

Nothing an attendee sees changes. `checkIn` and `rateSession` in
`server/lib/attendance.js` each call `db.prepare(...)` on every invocation —
recompiling the same SQL on every check-in and every rating, against the
repo's "prepare once, at module scope" convention (`CLAUDE.md` § Conventions,
and the exact gotcha already recorded in `docs/context/attendance.md`). This
moves both statements to module scope, prepared once at import time, next to
the sibling statements (`getSession`, `getCheckIn`, `getRating`, `recompute`,
`recomputeSpeakers`) that already work that way.

Check-in and rating behaviour is unchanged: same SQL, same bound
parameters, same transaction boundaries, same 409/`rejected` outcomes, same
roll-ups onto `sessions.avg_rating` and `speakers.avg_rating`.

## Where

- `server/lib/attendance.js`:
  - `checkIn`'s inline `db.prepare('INSERT OR IGNORE INTO check_ins ...')`
    becomes a module-scope `insertCheckIn`, declared alongside `getSession`/
    `getCheckIn`/`getRating`.
  - `rateSession`'s inline `db.prepare('INSERT INTO ratings ... ON CONFLICT
    ... DO UPDATE ...')` becomes a module-scope `upsertRating`, declared next
    to `recompute`/`recomputeSpeakers` (its nearest siblings, also prepared
    once).
  - Both functions call `.run(...)` on the prepared statement instead of
    preparing inline; no other line in either function changes.
- `docs/context/attendance.md` — drop the "Gotchas" bullet that calls this out
  as still-inline, since it stops being true.
- `tests/unit/attendance.test.js` — add a regression test (see below).

## How it will be proved

| Criterion | Check | Layer |
| --- | --- | --- |
| `checkIn` and `rateSession` prepare no statement inside the function | New unit test: seed one fixture user and session directly into the sandbox DB, shadow `db.prepare` with a counting wrapper for the duration of one call to each of `checkIn` and `rateSession`, and assert the count stays `0` | `tests/unit/attendance.test.js` |
| Check-in and rating behave exactly as before | Existing `tests/api/attendance.test.js` and `tests/api/ratings.test.js` pass unchanged — same requests, same assertions | `tests/api/` (`startApi()`) |
| No other regression | `npm test` (313 cases today) stays green | unit + API |

The new unit test is written to fail against the current code first — shadowing
`db.prepare` around a call to `checkIn` (or `rateSession`) counts one call
today, because the inline `db.prepare(...)` runs inside the transaction on
every invocation. Moving both statements to module scope makes the count `0`,
which is what "prepare no statement inside the function" means operationally:
nothing under test calls `db.prepare` while `checkIn`/`rateSession` run.

## Out of scope

No other file in `server/lib/` is touched — `seats.js` and the rest already
follow the module-scope convention. The window rules, rejection reasons and
response shapes in `attendance.js` are unchanged; this is a preparation-site
move only.

## Audit

- Spec round 1: 0 raised, 0 confirmed.
- Build round 1: unit 313 passed, browser 169 passed; 0 raised, 0 confirmed.
