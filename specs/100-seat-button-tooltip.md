# Show a tooltip on the seat button that says what it will do

## What this changes

Hovering or keyboard-focusing any seat button (the `SeatButton` on session
cards, list rows, My Agenda and the home page's Your day, plus the grid's banner
and cell buttons) shows a small token-styled tooltip after ~300 ms that names
what a click will do: *Add to my agenda*, *Join the waitlist* (full room),
*Remove from my agenda*, *Leave the waitlist* or *Session ended*. It closes on
blur, mouse leave and Escape, re-reads the store after a click, never shows on
touch, only one is ever open at a time, and it stays inside the viewport. The
native `title` goes.

## Where

- `src/lib/format.js` — new pure `seatAction(status, { ended, full })` returning
  the five strings; unit test in `tests/unit/format.test.js`.
- `src/components/ui.jsx` — new `Tooltip` (wraps its trigger in a `span` that
  listens for `pointerenter`/`pointerleave` — so a `disabled` ended button still
  shows it — plus `focus`/`blur`/`keydown` Escape on the button). Renders via
  `createPortal` to `document.body`, `position: fixed`, placed from the trigger's
  `getBoundingClientRect()` and clamped to the viewport with an 8 px margin
  (flip below when no room above), `role="tooltip"`, `data-testid="seat-tooltip"`,
  `animate-rise`, tokens only (`bg-overlay`, `border-hairline`, `text-ink`). A
  module-level "currently open" closer makes opening one close any other.
  Opens on `pointerenter` only when `pointerType !== 'touch'`, and on focus only
  when the button `:focus-visible`. `SeatButton` takes a new `full` prop, uses
  `seatAction`, drops `title` (and the unused `title` prop), and sets
  `aria-describedby` to the tooltip id while it is open.
- `src/components/SessionCard.jsx` — pass `full={isFull}` to both `SeatButton`s.
- `src/components/TodayPanel.jsx` — pass `full` as `(seatsFor(s.id)?.seatsLeft ?? s.seatsLeft) === 0` (add `seatsFor`
  to the `useConference()` destructure).
- `src/components/ScheduleGrid.jsx` — wrap the banner and cell `<button>`s in
  `Tooltip` with `seatAction(seat, { ended: closed, full })`; their `aria-label`s
  (the cell's names the session) stay.
- `src/index.css` — nothing new: the existing reduced-motion block neutralises
  `animate-rise`.
- Browser tests: a new `describe('Seat tooltip')` in `tests/schedule.spec.js`,
  read-only, on a new lane `'schedule.tooltip'` in `tests/helpers.js` copied from
  `schedule.seats` (`readOnly: true` both panes), using `visit`, `momentOn`,
  `waitForResults`; the state-flip assertion extends the existing
  `adding a session from the schedule puts it on the agenda` test in
  `tests/plan.spec.js` (lane `agenda.add`, which already books and releases).

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Names the action: Add / Join the waitlist / Remove / Leave / Session ended | `format.test.js`: `seatAction` returns each string for null, full, confirmed, waitlisted, ended-and-not-held | unit |
| Hover shows it within ~300 ms | desktop: hover a list card's seat → `seat-tooltip` visible with *Add to my agenda* within 600 ms; a full card's reads *Join the waitlist* | spec |
| Shows on focus; hides on blur, mouse leave, Escape | desktop: Tab to a seat → visible; Escape → gone; refocus, Tab away → gone; hover then move off → gone | spec |
| Text follows the new state after a click | `plan.spec.js` agenda.add (desktop): hover → *Add to my agenda*, click → *Remove from my agenda* without reload | spec |
| Tokens + `animate-rise`, no motion under reduced motion | tooltip has class `animate-rise`; with `page.emulateMedia({ reducedMotion: 'reduce' })` its computed `animationDuration` is `1e-05s` | spec |
| Keeps `aria-label`, linked once | while open: `toHaveAccessibleName('Add to my agenda')`, `aria-describedby` = the tooltip's id, no `title` attribute | spec |
| Tap toggles straight away on touch | mobile: one `tap()` flips `aria-pressed` and `seat-tooltip` count stays 0 (agenda.add, mobile pane) | spec |
| Stays inside the viewport (mobile, grid's rightmost column) | desktop grid: hover the last column's cell button → tooltip box right ≤ viewport width; mobile list: focus a seat → box within 0…width; `scrollWidth ≤ clientWidth` | spec |
| Only one open at a time (#105's QA blocker) | desktop list: Tab to one seat, hover another → `seat-tooltip` count is 1 | spec |

## Decisions

- Grid banner and cell buttons are not `SeatButton`, but the ticket names the grid, so they get the same tooltip — OK?
- The native `title` is removed so the tooltip is the only description source; `aria-label` stays the name — OK?
- On touch the tooltip never opens (tap = toggle), and focus opens it only when `:focus-visible` — OK?
- Ended buttons stay `disabled`, so their *Session ended* tooltip is mouse-only (a disabled button cannot take focus) — OK?
- Opening one tooltip closes any other, via one module-level closer rather than a store field — OK?

## Out of scope

Tooltips on follow and calendar-export buttons; what the seat button does.
