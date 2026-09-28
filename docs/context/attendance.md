---
area: attendance
summary: Checking in to a session at the door and rating it afterwards, and how those ratings roll up onto sessions and speakers.
read_when: touching check-in, the check-in window, ratings or reviews, avg_rating, or AttendancePanel
files:
  - server/lib/attendance.js
  - src/components/AttendancePanel.jsx
tests:
  - tests/api/attendance.test.js
  - tests/api/ratings.test.js
  - tests/unit/attendance.test.js
  - tests/attendance.spec.js
related: [seats, clock, seed, speakers]
---

# Attendance

The rules are in CLAUDE.md § The attendee chain. The routes live in
`server/routes/users.js` (owned by the seats doc).

## How it works

**`server/lib/attendance.js`.** Tables: `check_ins (user_id, session_id,
checked_in_at)`, `ratings (user_id, session_id, stars, comment, created_at)`
unique on `(user_id, session_id)`, and the roll-up columns
`sessions.avg_rating`, `sessions.rating_count`, `speakers.avg_rating`.

- `CHECK_IN_OPENS_MINS = 15`.
- `attendanceWindow(session, now)` — pure, takes a row with `day`, `starts_at`,
  `ends_at` (snake_case). Returns `{ phase, canCheckIn, opensAt? }`:
  - no `now.day` or `now.time` → `'unknown'`;
  - a different day → `'past'` or `'future'` by string compare, never
    checkable and **no** `opensAt`;
  - same day: before `start − 15` → `'future'` with `opensAt: starts_at`; from
    then until start → `'opening'`; from start until `ends_at` → `'running'`;
    at or after `ends_at` → `'past'`. Only `opening`/`running` can check in.
- `attendanceState(sessionId, userId, now)` — the payload every attendance
  route returns: `{ sessionId, phase, checkInOpensAt, canCheckIn, checkedIn,
  checkedInAt, canRate, myRating: {stars, comment}|null }`. `canCheckIn` is
  false once checked in; `canRate` is `checkedIn && phase === 'past'`.
- `checkIn(userId, sessionId, now)` — `db.transaction`. Outside the window →
  `{ ...state, rejected: <phase> }` (`'future'`, `'past'` or `'unknown'`).
  Otherwise `INSERT OR IGNORE` into `check_ins`. **No seat is required.**
- `rateSession(userId, sessionId, { stars, comment }, now)` —
  `db.transaction`. Rejects `'not-checked-in'`, then `'too-early'` (phase not
  `past`). Upserts the rating (empty comment → `NULL`, `created_at` reset on
  every edit), then runs `recompute` (session `avg_rating` = `ROUND(AVG, 2)`,
  `rating_count`) and `recomputeSpeakers` (every speaker on that session gets
  the average of all ratings across all their sessions).

**Routes** (`server/routes/users.js`), all passing `now` from the client:

| Route | Calls | Clock from |
| --- | --- | --- |
| `GET /users/:id/attendance/:sessionId?day=&time=` | `attendanceState` | query |
| `PUT /users/:id/checkins/:sessionId` body `{day,time}` | `checkIn` | body |
| `PUT /users/:id/ratings/:sessionId` body `{stars,comment,day,time}` | `rateSession` | body |

`rejected` → 409 with the state body. The ratings route validates the request
before looking anything up: 400 unless `stars` is an integer 1–5, then 400
unless `comment` is `undefined`, `null`, or a string of at most 1000
characters, then 404 `{ error: 'Attendee not found' }` via `userExists` (the
same prepared statement `/:id/checkins/:sessionId` uses) if the attendee does
not exist. The attendance GET still does not check that the user exists.

**Client.** `src/lib/api.js` has `getAttendance`, `checkIn`, `rateSession`;
the panel spreads `...clock` into the rating body. `AttendancePanel({ session
})` (rendered on `SessionPage` under `SeatPanel`) fetches with `useFetch` keyed
on `clock.day` and `clock.time`, so it refetches on every clock tick, and calls
`reload()` after each write. It renders:

- nothing until the first response, and nothing for a `future` session you
  hold no confirmed seat for;
- a "check-in opens 15 minutes before" note for a `future` session you hold;
- `check-in` button when `canCheckIn`; `checked-in` line once in and not yet
  rateable; `rating-form` (stars, optional comment, `submit-rating`) when
  `canRate`; `missed` when past, not checked in, and you held a seat.

The star/comment form is seeded from `data.myRating` in an effect keyed on the
saved values, so a tick refetch does not wipe what is being typed.

Testids: `attendance-panel`, `check-in`, `checked-in`, `rating-form`,
`submit-rating`, `missed`.

## Invariants

- Nothing here calls `new Date()` for a rule; `now` always comes from the
  caller. `new Date()` is only the `checked_in_at`/`created_at` stamp.
- `avg_rating` on sessions and speakers is only ever derived from `ratings`;
  `server/seed.js` recomputes both with the same SQL after seeding Day 1
  morning ratings. Change the formula in both places.
- A check-in cannot be undone — there is no route or function for it.

## Gotchas

- The UI's "checked in at" time is `checkedInAt.slice(11, 16)` — the real UTC
  wall-clock stamp, not conference time.
- `attendanceWindow` compares days as `YYYY-MM-DD` strings; keep that format.
- Browser tests share the live DB and cannot reset a check-in: pick a session
  the lane's attendee has never attended (see CLAUDE.md § Writing tests).

## Where to change…

- The window length or phases: `attendance.js:attendanceWindow`, then the
  unit tests and the copy in `AttendancePanel.jsx`.
- Who may rate: `attendance.js:rateSession` and `attendanceState.canRate`.
- A new roll-up (e.g. per track): next to `recompute` in `attendance.js`, and
  the matching block at the end of `server/seed.js`.
