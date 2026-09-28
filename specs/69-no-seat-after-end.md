# 69 — Stop offering a seat in sessions that have already ended

## What this changes

The API already refuses a seat in a finished session (`rejected: 'ended'`), but
every control still offers one and the attendee only learns after clicking.
After this change, once a session is over — an earlier day, or the same day at
or after `endsAt` — no control offers to add it: the session page, its
`SeatPanel`, the card buttons and the grid buttons show a disabled "Session
ended" state instead. A Day 1 card viewed on Day 3 is dimmed as done, not only
on Day 1. A seat you already hold still shows its status, and releasing it is
unchanged.

## Where

- `src/lib/clock.js` — add `export function hasEnded(session, clock)`: `false`
  without `clock?.day`; `session.day < clock.day ||
  (session.day === clock.day && toMinutes(session.endsAt) <= toMinutes(clock.time))`.
  The same rule as `reserveSeat` in `server/lib/seats.js:85-86` (not changed).
- `src/components/ui.jsx` `SeatButton` (line 119) — new prop `ended`. When
  `ended && !status`: `disabled`, `aria-label`/`title` "Session ended", the
  click handler still `preventDefault`s (it sits inside a `Link`) but does not
  call `onClick`, muted styling, no hover accent. With a `status` it behaves as
  today, so a held seat can still be released.
- `src/components/SessionCard.jsx` — line 29: `isDone = hasEnded(session, clock)`
  (drop the `onToday &&`; `isLive` keeps it). Add `data-testid="session-card"`
  and `data-done={isDone ? 'true' : 'false'}` to the root of both variants (the
  row `<div>` at ~line 41 and the `<article>` at ~line 95). Pass
  `ended={isDone}` to both `SeatButton`s (lines 82, 137).
- `src/components/TodayPanel.jsx` line 222 — suggestions' `SeatButton` gets
  `ended={hasEnded(s, clock)}` (suggestions should never be past, but the rule is
  shared).
- `src/pages/SessionPage.jsx` ~line 123 (`save-session`) — compute
  `const ended = hasEnded(session, clock)`; when `ended && !reservation`, render
  the button `disabled` with text "Session ended". Add under the buttons (or in
  the header chips) a line `data-testid="session-ended"` reading "This session
  has ended."
- `src/components/SeatPanel.jsx` — read `clock` from `useConference()`; in the
  no-`status` branch (line ~98), when `hasEnded(session, clock)` render a
  disabled `Button` "Session ended" with `data-testid="session-ended-seat"`
  instead of `reserve-seat`. Hide the `requiresRsvp` note when ended.
- `src/components/ScheduleGrid.jsx` — banner button (~line 102) and cell button
  (~line 159): when `hasEnded(s, clock) && !seat`, `disabled`, `aria-label`
  "Session ended" / `` `${s.title} has ended` ``, and no `toggleSeat` (keep
  `preventDefault`). The grid has one day, so `hasEnded` per session is enough.
- Tests
  - `tests/unit/clock.test.js` — import `hasEnded`; new `describe` block.
  - `tests/session.spec.js` — new test. Read-only (the ended controls make no
    call), so no lane: user `ATTENDEES.marcus`, clock
    `await momentOn(1, '10:00')`, target = first session from
    `GET ${API}/sessions?day=${days[0]}` whose id is not in
    `GET ${API}/users/5`'s `reservations[].sessionId`.
  - `tests/schedule.spec.js` — new test, same user, clock and read-only
    reasoning: `/schedule?view=list&day=${days[0]}` and
    `/schedule?view=list&day=${days[2]}`.
- `docs/context/seats.md` (Client: SeatPanel/`SeatButton` ended state, the new
  testids) and `docs/context/schedule.md` (`SessionCard` done state /
  `data-done`, grid buttons) and `docs/context/clock.md` (`hasEnded`).

## How it will be proved

| Criterion | Layer | Check (false on main) |
| --- | --- | --- |
| `hasEnded` rule | unit, `tests/unit/clock.test.js` | For `{day:'2026-10-13', endsAt:'15:30'}`: clock `2026-10-14 09:00` → true; `2026-10-13 15:30` → true; `2026-10-13 15:29` → false; clock `2026-10-12 23:00` → false; no clock → false. (`hasEnded` does not exist on main.) |
| Session page | browser, `tests/session.spec.js` "an ended session offers no seat" | At Day 2 10:00 on the Day 1 target: `page.getByTestId('reserve-seat')` has count 0, `save-session` is disabled, `session-ended` is visible and contains "ended". On main `reserve-seat` is visible and enabled. |
| Card seat button | browser, `tests/schedule.spec.js` "a past day's cards cannot be booked and read as done" | On Day 1 list at Day 2 10:00: the first `session-card` whose button is named `/ended/i` exists, is disabled; record `page.on('request')` to `/reservations/`, `click({ force: true })`, then assert zero such requests and `toaster` has no text. On main the button is named "Add to my agenda" and enabled. |
| Done state | same test | Every `session-card` on Day 1 has `data-done="true"`; on the Day 3 list the first `session-card` has `data-done="false"`. On main the Day 1 cards are not dimmed (`isDone` needs `onToday`) and carry no `data-done`. |

`npm test` for the unit row; `npm run verify` (desktop + mobile) for the rest;
`npm run shot -- /sessions/1 --at=<Day 2>T10:00` to look at the ended state.

## Decisions

- The server rule is left alone; the client mirrors it in one function rather
  than asking the API, because the clock is client-side.
- Header button `save-session` is disabled too, not just `reserve-seat`, since
  the ticket names "the session header button".
- A held seat on an ended session keeps its status and can still be released —
  the ticket says releasing is unchanged.

## Out of scope

- Check-in and rating (`AttendancePanel`) already gate on time.
- Making the grid dim past cells on other days — the grid only ever shows one
  day, and its existing same-day logic is unchanged.
