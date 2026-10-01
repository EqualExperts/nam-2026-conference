# Undo after removing an ended seat fails silently

## What this changes

Removing a seat (or a waitlist place) in a session that has **already ended**
still works, but the toast no longer offers **Undo**: it reads "Removed from
your agenda" with no action button. Today it offers one, and clicking it asks
the API to re-reserve a finished session, which the API refuses (409 `ended`) —
the seat stays gone and all the attendee gets is "That session has already
finished", an error for a button we should never have shown. Removing a seat in
a session that has not ended is untouched: Undo is offered and puts the seat
back, as it does now.

Remove itself stays available on ended sessions — an attendee must be able to
take a finished talk off their agenda, and `SeatPanel`, `SeatButton` and the
grid already keep the release control alive for a seat they hold.

## Where

- `src/lib/store.jsx` — `releaseSeat` (line 119) takes a second argument,
  `session`, and attaches the toast's `action: { label: 'Undo', … }` only when
  `session && !hasEnded(session, clock)`; no session passed means no Undo, so a
  future caller cannot re-open the bug by forgetting it. Add `hasEnded` to the
  `./clock.js` import (line 3) and `clock` to the `useCallback` deps (line 128).
  `toggleSeat` (line 131) forwards the session to `releaseSeat`.
- `src/components/SeatPanel.jsx` — `act()` (line 40) calls `fn(session.id, session)`.
- `src/components/SessionCard.jsx` — lines 127 and 184: `toggleSeat(session.id, session)`.
- `src/components/ScheduleGrid.jsx` — lines 109 and 169: `toggleSeat(s.id, s)`.
- `src/components/TodayPanel.jsx` — line 222: `toggleSeat(s.id, s)`.
- `src/pages/SessionPage.jsx` — line 131: `toggleSeat(session.id, session)`.
  (Each of these already computes `hasEnded`/`isDone`/`closed` from that same
  object, so `day` and `endsAt` are there.)
- Test in `tests/seats.spec.js` — extend the existing test at line 49
  ("reserving moves the seat count, and releasing gives it back") and rename it
  to cover Undo; it already owns lane `seats.count` via `laneFor`, picks its
  session with `bookableFor` through `openSessionFor`, and pins the clock with
  `momentOn(0, '07:00')` (all from `tests/helpers.js`). **No new lane**: every
  attendee×day pane in `LANES` is taken and day index 2's slots are owned
  outright, so a new booking lane would have to displace one.
- Docs: `docs/context/seats.md` — the Client bullet for `releaseSeat` (line 77)
  and the Gotcha about Undo being a fresh `reserveSeat` (line 126);
  `docs/context/agenda.md` line 72 ("Undo restores it") gains the ended caveat.

The extended test, in order: reserve → release → click **Undo** in the toaster →
`reservation-confirmed` is back; then re-open the same page with the clock past
the session's end (`page.goto('/sessions/<id>?at=<lane.day>T23:30')`, the `?at=`
override beating the stored one) → click `release-seat` → the toast says
"Removed from your agenda" with **no** Undo button and `session-ended-seat`
shows; the existing closing assertion that the seat count is back to `start`
still proves nothing leaked.

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| An ended session's removal offers no Undo | `tests/seats.spec.js`: with the clock pinned to `${lane.day}T23:30`, after `release-seat` the `toaster` contains "Removed from your agenda" **and** `toaster.getByRole('button', { name: 'Undo' })` has count 0. False on main: `store.jsx:125` attaches the Undo action unconditionally | browser (desktop + mobile) |
| A session that has not ended still offers a working Undo | same test, first phase at `momentOn(0, '07:00')`: the Undo button is visible after `release-seat`, clicking it restores `reservation-confirmed` and the moved seat count. **Green on main by design** — it is the control that stops the fix dropping Undo everywhere, or hiding Remove | browser (desktop + mobile) |
| A test covers both | the two phases above are one test, so both run on both projects; `scripts/red-check.mjs` reverts `src/` and the file goes red on phase one | browser |

No unit row: the decision lives in a React hook and the repo has no
component-test harness; `hasEnded` itself is already covered by
`tests/unit/clock.test.js`.

## Decisions

- **Keep Remove on ended sessions and drop its Undo**, rather than hiding
  Remove — a finished talk must still be removable, and hiding Remove would
  touch five controls instead of one.
- **Same toast copy**, "Removed from your agenda", just without the button —
  nothing was lost that needs explaining.
- **The session is passed into `toggleSeat`/`releaseSeat`** rather than teaching
  `DELETE /reservations/:id` about the clock: every caller already holds the
  session and already computes `hasEnded` from it, and the client is where the
  rest of the ended gating lives.
- **The proof extends the existing seats test** instead of adding a lane, because
  `LANES` has no free attendee×day pane.

## Out of scope

The 409 `ended` path itself and its "That session has already finished" toast:
`reserveSeat` keeps it for the race where a session ends between page load and
click.
