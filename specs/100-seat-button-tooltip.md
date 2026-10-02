# Seat button tooltip

## What this changes

The icon-only seat button on every session card says what it will do before you
click it. Hover it (or tab to it) and a small app-styled tooltip appears naming
the action — **Add to my agenda**, **Join the waitlist** when the room is full,
**Remove from my agenda**, **Leave the waitlist**, or **Session ended** —
instead of the browser's slow, unstyled native `title`, which never appeared on
keyboard focus at all. It follows the click: once the seat is held the tooltip
reads "Remove from my agenda" with no reload. It hides on blur, on mouse leave
and on Escape, never swallows a tap on a phone, and stays inside the viewport in
the schedule grid's rightmost column.

## Where

- `src/lib/format.js` — new pure `seatActionLabel({ status, ended, full })`
  returning the five strings; precedence is held seat → ended → full → add (a
  held seat can still be given back after the session ends, which is why the
  held branch comes first). Unit test in `tests/unit/format.test.js`, which
  already imports named helpers from this module.
- `src/components/ui.jsx` — `SeatButton` (line 119): the label (lines 125–128)
  comes from `seatActionLabel`, with a new `full` prop; the native
  `title={label}` attribute (line 137) and the now-unused `title` *prop* (no
  caller passes one) both go; `aria-label` stays. The ended state swaps
  `disabled={closed}` (line 134) for `aria-disabled={closed || undefined}`; the
  existing `if (!closed) onClick()` guard on line 133 already makes the click a
  no-op, and the button must stay enabled in the DOM or it emits no hover and
  takes no focus (see *Decisions*). Beside it, a small `useSeatTooltip(label)`
  hook (~15 lines, `createPortal` from `react-dom`): 300 ms hover delay, instant
  on keyboard focus (`:focus-visible`), hidden on `pointerdown`, `mouseleave`,
  `blur` and Escape. It returns `{ triggerProps, tooltip }` so the grid's own
  buttons can use it too. The tooltip is `data-testid="seat-tooltip"`,
  `role="tooltip"`, `aria-hidden="true"`, `pointer-events-none`, `glass
  border-hairline` + `animate-rise` (both already in `src/index.css`; the
  `prefers-reduced-motion` block at line 166 neutralises `animate-rise`
  globally, so nothing new is needed there), positioned `fixed` from the
  button's rect — `top` above the button (flipped below when `rect.top < 80`)
  and `right: Math.max(8, innerWidth - rect.right)`, with
  `max-w-[min(14rem,calc(100vw-1rem))]`, so it can never cross either edge.
  A portal is required: cards and `schedule-grid` are `overflow-hidden`.
- `src/components/SessionCard.jsx` — the two `<SeatButton>`s (lines 127, 184)
  pass `full={isFull}` (already computed, line 80).
- `src/components/TodayPanel.jsx` — `<SeatButton>` (line 222) passes
  `full={(seatsFor(s.id)?.seatsLeft ?? s.seatsLeft) === 0}`; add `seatsFor` to
  the `useConference()` destructure (line 51), which does not have it today.
- `src/components/ScheduleGrid.jsx` — the two inline seat buttons (banner row
  lines 104–114, cell lines 163–176) keep their styling and their own
  `aria-label`s, and spread `triggerProps` + render `tooltip` from the hook,
  with the label from `seatActionLabel` — `full` from `seatsFor` (already
  destructured, line 16) falling back to the payload, `left === 0` in the cell.
  Both make the same `disabled` → `aria-disabled` swap (lines 108 and 168),
  keeping the `if (!closed)` click guard. The cell button is `opacity-0` until
  the card is hovered, so its ended branch (line 174) gains
  `focus-visible:opacity-100` — the bookable branch already has
  `focus:opacity-100`, and now that an ended button can be tabbed to, focus has
  to show it.
- Browser tests in `tests/schedule.spec.js`, new `describe('Seat button
  tooltip')`: the read-only cases take the existing read-only lane
  `schedule.seats` via `laneFor`/`bookableFor` and pin the clock with
  `momentOn` (all from `tests/helpers.js`); the grid-overflow case runs on both
  projects.
- `tests/plan.spec.js` — the existing "adding a session from the schedule" test
  (lines 41–60, lane `agenda.add`) gains the after-click and one-tap
  assertions; it already books and releases, so no new lane is claimed.
- Docs: `docs/context/ui.md` (`SeatButton`'s props row — `title` out, `full`
  in — and the tooltip under the `ui.jsx` exports), `docs/context/schedule.md`
  (the grid cell/banner buttons, the ended wording at lines 84–85, the new
  testid) and `docs/context/seats.md` (lines 99–106, which say the ended
  controls are *disabled* — the card and grid buttons become `aria-disabled`
  instead; `SeatPanel`'s and `SessionPage`'s stay natively disabled).

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Hover names the action within ~300 ms | hovering a bookable card's seat button shows `seat-tooltip` reading "Add to my agenda" inside 1 s — no such element exists today | spec `tests/schedule.spec.js` (lane `schedule.seats`) |
| The five wordings, full → "Join the waitlist", ended → "Session ended" | `seatActionLabel` returns each string and holds held > ended > full (the function does not exist today); browser hover on an `isFull` card and, with the clock pinned to Day 1 10:00, on an ended card — whose button is now `aria-disabled`, so the hover lands | unit `tests/unit/format.test.js` + spec `tests/schedule.spec.js` |
| It also appears on keyboard focus, including on an ended button | `focus()` on a bookable button shows the tooltip; `focus()` on an ended card button shows "Session ended" (impossible today — the button is `disabled`), and in the grid focusing the cell's ended button also makes the button itself visible | spec `tests/schedule.spec.js` |
| It disappears on blur, mouse leave and Escape | from visible: `blur()`, moving the mouse to the page corner, and `Escape` each hide `seat-tooltip` | spec `tests/schedule.spec.js` |
| Text reflects the new state after a click | in plan.spec's add-from-a-card test, re-hovering after the click reads "Remove from my agenda" on the same page load | spec `tests/plan.spec.js` (lane `agenda.add`) |
| Design tokens + `animate-rise`, nothing under reduced motion | the tooltip element carries `glass` and `animate-rise`; a `test.use({ reducedMotion: 'reduce' })` block asserts its computed `animation-duration` is `0.01ms` | spec `tests/schedule.spec.js` |
| `aria-label` kept, announced once | the button keeps its `aria-label` and gains no `aria-describedby`; the new `seat-tooltip` element is `role="tooltip"` and `aria-hidden="true"` | spec `tests/schedule.spec.js` |
| One tap toggles on touch | mobile project: `seat.tap()` flips `aria-pressed` to `true` with no second tap, and the new tooltip's computed `pointer-events` is `none`, so it can never intercept the tap | spec `tests/plan.spec.js` (lane `agenda.add`) |
| No horizontal overflow, mobile and rightmost grid column | with the grid scrolled to its right end and the last column's button hovered, the open tooltip's box is inside the viewport and `documentElement.scrollWidth <= clientWidth` | spec `tests/schedule.spec.js`, both projects |

## Decisions

- **The ended seat button becomes `aria-disabled`, not `disabled`.** A natively
  disabled control dispatches no mouse events and cannot take focus, so a
  tooltip triggered from it would never show "Session ended" and the focus
  criterion would be unreachable for that state — the ticket lists both, so the
  button has to stay enabled in the DOM. Behaviour does not change:
  `if (!closed) onClick()` already swallows the click, the `cursor-not-allowed`
  styling stays, and Playwright's `toBeDisabled()` counts `aria-disabled`, so
  the existing ended assertions (`tests/schedule.spec.js` lines 160–216) keep
  their meaning and stay green. The alternatives were worse — a wrapping
  `<span>` only receives hover over a disabled child in some engines and cannot
  be focused without inventing a nameless tab stop, and dropping the ended
  tooltip would drop a wording the ticket names.
- **Ended buttons therefore join the tab order.** On Day 1's morning that is a
  run of extra stops that do nothing, which is the cost of the line above; each
  is named ("Session ended" / "<title> has ended") and now carries the tooltip,
  so a keyboard user is told why instead of finding a silent dead control.
  `tabindex="-1"` would keep today's tab order but put focus back out of reach,
  which is the thing being fixed.
- **The tooltip is `aria-hidden` and the button keeps its `aria-label`** rather
  than being wired with `aria-describedby`: the two texts are the same action,
  so describedby makes a screen reader say it twice, which the ticket rules
  out. "Linked by an equivalent" here means the tooltip is the visual twin of
  the name the button already exposes.
- **The grid's own seat buttons get the tooltip too.** The ticket says
  `SeatButton`, but `ScheduleGrid` hand-rolls its two buttons and the last
  criterion is about the grid's rightmost column — so the hook is shared rather
  than the grid left out.
- **The tooltip renders in a portal, positioned `fixed`** against the button's
  rect: cards and the grid both set `overflow-hidden`, and the grid cell
  transforms on hover, so an absolutely positioned tooltip would be clipped.
- **No new data lane.** The read-only cases reuse `schedule.seats` (`readOnly`,
  so sharing it is allowed) and the one case that writes rides plan.spec's
  existing `agenda.add` lane.

## Out of scope

- Tooltips on the follow and calendar-export buttons (the ticket defers them).
- What the seat button does: no change to seats, waitlists, or the rule that an
  ended session offers no seat — only to how the button expresses it
  (`aria-disabled` in place of `disabled`, same no-op click).
- `SeatPanel`/`SessionPage`, whose seat controls are already labelled in words
  and whose ended state stays natively `disabled`.
