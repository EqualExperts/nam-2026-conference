# #70 — Show check-in and rating status across every day on My Agenda

## What this changes

On My Agenda, every confirmed session that is over carries its attendance
status beside it: **"Rated ★N"**, **"Checked in"** with a **"Rate it"** link to
`/sessions/:id`, or **"Missed"** (held a seat, never checked in). A session you
checked in to that is still running shows "Checked in" alone. A callout at the
top of the page lists every checked-in, unrated, ended session on *any* day,
each linking to its session page, and hides itself when there is nothing to
rate — so on Day 2 you can see that three Day 1 talks are still waiting on you.
Today only the home page surfaces this, and only for the current day.

## Where

- `server/lib/agenda.js`
  - `myRatings` (top of file) → `SELECT session_id, stars FROM ratings WHERE user_id = ?`
    (`todayFor` keeps reading only `session_id`, so it is unaffected).
  - `scheduleFor(userId)` → build `checkedIn` (Set from `myCheckIns`) and
    `stars` (Map from `myRatings`), and decorate each session with
    `checkedIn: checkedIn.has(s.id)` and `myStars: stars.get(s.id) ?? null`
    beside `reservation`. Already camelCase; nothing to add in `query.js`.
- `src/pages/MyAgendaPage.jsx`
  - The `days` `useMemo` spreads each session through untouched, so the new
    fields survive it.
  - New `ToRateCallout({ days })` (`data-testid="to-rate"`): sessions from
    `days` where `reservationFor(s.id) === 'confirmed'`, `hasEnded(s, clock)`
    (`src/lib/clock.js`), `s.checkedIn`, and `s.myStars == null`; each a
    `<Link to={`/sessions/${s.id}`}>` with day and title. Returns `null` when
    empty. Rendered after `NextUpCard`, inside `{data && …}`.
  - `DayPlan` passes the status to `SessionCard`.
- `src/components/SessionCard.jsx` — row variant only: optional
  `attendance` prop (`{ ended, checkedIn, myStars }`), rendered in the meta
  line as `data-testid="attendance-status"`: rated → `Rated ★N`; checked in and
  unrated and ended → `Checked in` plus a `Rate it` `<Link>` to `/sessions/:id`
  (`relative z-10` so it sits above the card's full-cover link, with an
  `aria-label` naming the session); checked in, not ended → `Checked in`;
  ended, confirmed, not checked in → `Missed`. Waitlisted and upcoming rows
  render nothing. No other caller passes the prop, so grid cards are unchanged.
- `docs/context/agenda.md` — `GET /api/users/:id/schedule` part (new fields),
  `My Agenda` part (`to-rate`, `attendance-status`).
- Tests
  - `tests/api/agenda.test.js` — new `describe`, using `attendedSession(api)`
    from `tests/api/harness.js`.
  - `tests/api/contracts.test.js` already walks `/users/1/schedule` for
    snake_case; no edit needed.
  - `tests/plan.spec.js` — new `describe('What is left to rate')`, helpers
    `visit`, `momentOn`, `laneFor`, `API`, `ATTENDEES` from `tests/helpers.js`.
  - `tests/helpers.js` `LANES` — add
    `'agenda.to-rate': { desktop: { user: kenji, day: 0, slot: '17:15', agenda: false }, mobile: { user: sofia, day: 0, slot: '17:15', agenda: false } }`.
    Seeded: Kenji holds session 31 and Sofia session 32 at 17:15 on Day 1,
    confirmed, not checked in. Each pairs with one agenda-true lane on that
    attendee+day (`seats.waitlist` desktop, `session.add` desktop), which
    `tests/unit/lanes.test.js` allows. Kenji and Sofia, not Jonas: Jonas day 0
    mobile is a `clean` lane that may clear his Day 1.

## How it will be proved

| Criterion | Check | Layer |
| --- | --- | --- |
| API fields | `attendedSession(api)` → `{ userId, session, stars }`; in `GET /users/:userId/schedule` that session has `checkedIn === true`, `myStars === stars`; a session on the last date in `days` has `checkedIn === false`, `myStars === null`. False on main (fields absent). | `tests/api/agenda.test.js` |
| To-rate callout | Lane `agenda.to-rate`: read the attendee's confirmed session at `slot` on `day` from `/users/:id/schedule`; `PUT /users/:id/checkins/:sid` with `{ day, time: startsAt }`; `visit('/my-agenda', { as: user, at: await momentOn(1, '10:30') })`; `getByTestId('to-rate')` contains `a[href="/sessions/<sid>"]`, and that session's row `attendance-status` has a `Rate it` link. | `tests/plan.spec.js` |
| Rated shows "Rated ★N", not in callout | Same test: a seeded rated Day 1 session of that attendee (from `/users/:id` `ratings`) — its row in `plan-day-<day0>` shows `Rated ★<stars>`, and `to-rate` has no link to it. | `tests/plan.spec.js` |
| Nothing to rate → no callout | Marcus (`ATTENDEES.marcus`, read-only; every seeded check-in rated, and `attendance.rating-toast` only checks him into a session he does not hold), clock `momentOn(1, '10:30')`: a row shows `Rated ★` (false on main) **and** `getByTestId('to-rate')` has count 0. | `tests/plan.spec.js` |

`npm test` after each edit; `npm run verify` before done.

## Decisions

- The callout draws from the agenda payload, so it only lists sessions the
  attendee still holds a confirmed seat for. A check-in to a session never
  booked (the API allows it) is not listed; the session page still offers the
  rating.
- "Ended" is decided client-side with `hasEnded(session, clock)`, the same
  rule `SessionCard` already uses, so the page and the pinned clock agree; the
  API stays clock-free.
- "Checked in" is shown on its own only while a checked-in session is still
  running; once it ends it becomes "Checked in · Rate it" or "Rated ★N".

## Out of scope

- The home page's `unrated` list (`todayFor`) stays current-day only.
- Rating inline from My Agenda — "Rate it" links to the session page.
