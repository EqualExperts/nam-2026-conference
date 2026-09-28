# 66 — return 400/404, not 500/409, for bad rating requests

## What this changes

Rating a session (`PUT /api/users/:id/ratings/:sessionId`) currently mishandles
two kinds of bad request:

- A malformed `comment` — an object, an array, a boolean, or a string over
  1000 characters — crashes the write and the attendee sees a generic server
  error instead of "that wasn't a valid comment." (An object/array/boolean
  comment fails inside the SQLite insert itself, which better-sqlite3 refuses
  to bind, so it surfaces as a 500.)
- Rating as an attendee id that does not exist returns a 409 "not checked in"
  — a confusing lie, since the real problem is that there is no such attendee.
  Every other write route under `/users/:id` (check-ins, reservations) already
  answers this with 404 `{ error: 'Attendee not found' }`; ratings is the one
  that was missed.

After this change, both cases return a clean 4xx with a message, and valid
requests (a string comment, an empty string, or no comment at all) are
unaffected.

## Where

- `server/routes/users.js` — the `PUT /:id/ratings/:sessionId` handler.
  Alongside the existing `stars` check (already inline, before anything is
  looked up), add:
  - a `comment` check: 400 unless `comment` is `undefined`, `null`, or a
    string of at most 1000 characters. This runs before the attendee lookup,
    matching where the `stars` check already sits.
  - an attendee-exists check using the `userExists` prepared statement
    already declared at the top of this file and already used the same way
    by `/:id/checkins/:sessionId` (line 111) — 404
    `{ error: 'Attendee not found' }` before calling `rateSession`, so a
    missing attendee never reaches the "were you checked in" logic that
    currently misreports it as a 409.
- `docs/context/attendance.md` — the line "The ratings route returns 400
  unless `stars` is an integer 1–5, before looking anything up. Neither the
  attendance GET nor the ratings PUT checks that the user exists." becomes
  false for the ratings PUT; update it to describe the new `comment` check
  and the attendee-exists check.
- `tests/api/ratings.test.js` — new cases for both fixes (see below).

`server/lib/attendance.js` (`rateSession`) is not touched: both checks are
request-shape validation of the kind `stars` already does inline in the
route, not attendance rules, so they belong beside it.

## How it will be proved

Layer: `tests/api/ratings.test.js` (needs the database and the real routes —
matches how the existing check-in/rating rules are tested). Confirmed against
`main` before writing this spec, using a seeded, checked-in Day 1 morning
session so each request would otherwise reach the insert:

| Request | Today (`main`) | After |
| --- | --- | --- |
| `comment: {}` | 500 (better-sqlite3 throws binding an object) | 400 with an error message |
| `comment: []` | 500 (same — array is also unbindable) | 400 |
| `comment: true` | 500 (same — boolean is also unbindable) | 400 |
| `comment: 'x'.repeat(1001)` | 200 (stored in full) | 400 |
| `PUT /users/999999/ratings/<id>`, valid `stars` | 409 `{ rejected: 'not-checked-in' }` | 404 `{ error: 'Attendee not found' }` |

Each row was reproduced against `main` (a throwaway `startApi()` instance) to
confirm the "today" column before writing this table.

Regression guard, not new proof — already 200 on `main` and already exercised
by the existing suite, re-run unmodified: a string comment, an empty string
(cleared to `null`), and an omitted comment all still return 200.

## Decisions

- A `comment` that is a number (e.g. `5`) is also rejected with 400. The
  ticket only names object/array/boolean, but a number is exactly as much
  "not a comment" as those, and the rule ("must be a string, or absent") is
  simpler to state and implement than one with a number-shaped carve-out.
- The two new checks are added inline in the route, the same way the
  existing `stars` check is, rather than moved into `attendance.js`. They are
  request validation, not conference rules — nothing about them depends on
  the clock, the session, or the attendee.
- Order: `stars` (400) → `comment` (400) → attendee exists (404) → session
  exists (404, unchanged, inside `rateSession`). This mirrors
  `/:id/checkins/:sessionId`, which also checks the attendee before touching
  anything session-shaped.

## Out of scope

- The check-in route's own validation (it takes no body fields besides the
  clock) and the attendance GET route (already noted in the doc as not
  checking user existence; not part of this ticket).
- Any change to `rateSession`'s rejection rules (`not-checked-in`,
  `too-early`) — those stay 409, they are still a real conflict with
  conference state, not a malformed request.
