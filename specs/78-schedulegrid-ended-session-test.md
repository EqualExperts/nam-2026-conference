# 78 — Cover the ScheduleGrid banner and cell seat buttons for ended sessions

## What this changes

Nothing an attendee sees. #77 (spec 69) taught the schedule grid to disable
its seat buttons for a session that has already ended — the banner row for a
keynote/social, and the per-room cell for an ordinary talk — but only the
**list** view's cards got a test for that. The grid's own buttons (raised by
code review on #77 and judged not a blocker) have no coverage: deleting the
`disabled={closed}` / `if (!closed) toggleSeat(...)` handling in
`ScheduleGrid.jsx` today leaves every existing test green.

## Where

- `tests/schedule.spec.js` — one new test in the existing
  `test.describe('Ended sessions', …)` block (after "a past day's cards cannot
  be booked and read as done", around line 159), named e.g. "the grid disables
  the banner and cell seat buttons for ended sessions". Read-only — it never
  reaches the reservations API — so it needs no lane, mirroring the sibling
  list-view test immediately above it:
  - `const days = await conferenceDays(); const at = await momentOn(1, '10:00');`
  - Record every request whose URL includes `/reservations` via
    `page.on('request', …)`, same pattern as the sibling test.
  - `await visit(page, \`/schedule?view=grid&day=${days[0]}\`, { as: ATTENDEES.marcus, at });`
    — Day 1 at Day 2 10:00 is already over regardless of time of day, and
    Marcus (id 5) holds no reservation on Day 1's keynote (session 1) or on
    several of its ended room sessions (ids 3, 4, 5, 6, 7 among others),
    verified against the seeded `data/orbit.db` while writing this spec.
  - `const grid = page.getByTestId('schedule-grid'); await expect(grid).toBeVisible();`
  - Banner: `grid.getByRole('button', { name: 'Session ended' }).first()` —
    visible, disabled, `click({ force: true })`. This is the keynote row's
    button (`ScheduleGrid.jsx` ~line 106, the banner's `aria-label`).
  - Cell: `grid.getByRole('button', { name: /has ended$/i }).first()` —
    visible, disabled, `click({ force: true })`. This is a room cell's button
    (`ScheduleGrid.jsx` ~line 159, `` `${s.title} has ended` ``).
  - After both clicks: assert the recorded `/reservations` requests array is
    empty and `page.getByTestId('toaster')` has no text — same two assertions
    the sibling list test makes.
- No production code changes. `src/components/ScheduleGrid.jsx` (the `closed`
  computation at lines ~89 and ~143, and the two buttons at ~104 and ~156) is
  exactly what is being proved, not touched.
- `docs/context/schedule.md` needs no change — its Gotchas already document
  "Grid banner seat buttons share one generic `aria-label`; the cell buttons
  name the session," which is what this test now pins down.

## How it will be proved

**Browser**, `tests/schedule.spec.js`, because this is a rendered-DOM rule
(button `disabled` state, click suppressed) — the layer `docs/context/testing.md`
names for anything needing a real browser.

| Criterion | Check |
| --- | --- |
| Banner seat button is disabled for an ended keynote/social and swallows a click | `grid.getByRole('button', { name: 'Session ended' })` is visible and disabled; forcing a click raises no `/reservations` request. |
| Cell seat button is disabled for an ended room session and swallows a click | `grid.getByRole('button', { name: /has ended$/i })` is visible and disabled; forcing a click raises no `/reservations` request. |

**Verified this fails without the production code**, exactly as spec 59 did:
while drafting the test above, `const closed = !seat && hasEnded(s, clock);`
was temporarily replaced with `const closed = false;` at both sites in
`ScheduleGrid.jsx` (banner and cell). With that change, `npx playwright test
tests/schedule.spec.js -g "grid disables" --project=desktop` failed —
`getByRole('button', { name: 'Session ended' })` timed out because no button
carries that label once nothing is ever `closed`. Reverting the change made
the test pass again. Neither the temporary break nor the draft test is part
of this commit; the builder writes the real test from this spec.

`npm test` is unaffected (no unit/API change); `npm run verify` (desktop **and**
mobile) is the gate.

## Out of scope

- Any change to `hasEnded`, the grid's rendering, or the disabled styling —
  per the ticket, this is coverage only.
- The session page's and `SeatPanel`'s ended states — already covered by
  `tests/session.spec.js` from spec 69.
