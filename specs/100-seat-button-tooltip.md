# Seat button tooltip

## What this changes

The icon-only seat button on every session card says what it will do before you
click it. Hover it (or tab to it) and a small app-styled tooltip appears naming
the action — **Add to my agenda**, **Join the waitlist** when the room is full,
**Remove from my agenda**, **Leave the waitlist**, or **Session ended** — instead
of the browser's slow, unstyled native `title`, which never appeared on keyboard
focus at all. It follows the click: once the seat is held the tooltip reads
"Remove from my agenda" with no reload. It hides on blur, on mouse leave and on
Escape, never swallows a tap on a phone, and stays inside the viewport in the
schedule grid's rightmost column.

## Where

- `src/lib/format.js` — new pure `seatActionLabel({ status, ended, full })`
  returning the five strings; precedence is held seat → ended → full → add
  (a held seat can still be given back after the session ends). Unit test in
  `tests/unit/format.test.js`, which already imports from this module.
- `src/components/ui.jsx` — `SeatButton` (line 119): label comes from
  `seatActionLabel`, new `full` prop, and the native `title` attribute (line 137)
  goes; `aria-label` stays. Beside it, a small `useSeatTooltip(label)` hook
  (~15 lines, `createPortal` from `react-dom`): 300 ms hover delay, instant on
  keyboard focus (`:focus-visible`), hidden on `pointerdown`, `mouseleave`,
  `blur` and Escape. It returns `{ triggerProps, tooltip }` so the grid's own
  buttons can use it too. The tooltip is `data-testid="seat-tooltip"`,
  `role="tooltip"`, `aria-hidden="true"`, `pointer-events-none`,
  `glass border-hairline` + `animate-rise`, positioned `fixed` from the
  button's rect — `top` above the button (flipped below when `rect.top < 80`)
  and `right: Math.max(8, innerWidth - rect.right)`, with
  `max-w-[min(14rem,calc(100vw-1rem))]`, so it can never cross either edge.
  A portal is required: cards and `schedule-grid` are `overflow-hidden`.
- `src/components/SessionCard.jsx` — the two `<SeatButton>`s (lines 127, 184)
  pass `full={isFull}` (already computed, line 78).
- `src/components/TodayPanel.jsx` — `<SeatButton>` (line 222) passes
  `full={(seatsFor(s.id)?.seatsLeft ?? s.seatsLeft) === 0}`; add `seatsFor` to
  the `useConference()` destructure (line 51).
- `src/components/ScheduleGrid.jsx` — the two inline seat buttons (lines
  104–114 banner row, 163–176 cell) keep their styling and their own
  `aria-label`s, and spread `triggerProps` + render `tooltip` from the hook,
  with the label from `seatActionLabel` (`full` from the cell's `left === 0`).
- Browser tests in `tests/schedule.spec.js`, new `describe('Seat button
  tooltip')`: the read-only cases take the existing read-only lane
  `schedule.seats` via `laneFor`/`bookableFor` (`tests/helpers.js`) and pin the
  clock with `momentOn`; the grid-overflow case runs on both projects.
- `tests/plan.spec.js` — the existing "adding from a card" test (lines 42–59,
  lane `agenda.add`) gains the after-click and one-tap assertions; it already
  books and releases, so no new lane is claimed.
- Docs: `docs/context/ui.md` (`SeatButton` props row, the tooltip under
  ui.jsx exports) and `docs/context/schedule.md` (grid cell buttons, new testid).

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Hover names the action within ~300 ms | hovering a card's seat button shows `seat-tooltip` reading "Add to my agenda" inside 1 s | spec `tests/schedule.spec.js` (lane `schedule.seats`) |
| The five wordings, full → "Join the waitlist", ended → "Session ended" | `seatActionLabel` returns each string and holds seat > ended > full; browser hover on an `isFull` card and, with the clock pinned past it, an ended card | unit `tests/unit/format.test.js` + spec `tests/schedule.spec.js` |
| Focus shows it; blur, mouse leave and Escape hide it | `focus()` → visible; `blur()`, moving the mouse to (0,0) and `Escape` each → hidden | spec `tests/schedule.spec.js` |
| Text reflects the new state after a click | in plan.spec's add-from-a-card test, re-hovering after the click reads "Remove from my agenda", same page load | spec `tests/plan.spec.js` (lane `agenda.add`) |
| Design tokens + `animate-rise`, nothing under reduced motion | tooltip carries `glass` and `animate-rise`; a `test.use({ reducedMotion: 'reduce' })` block asserts its computed `animation-duration` is `0.01ms` | spec `tests/schedule.spec.js` |
| `aria-label` kept, announced once | button keeps its `aria-label` and gains no `aria-describedby`; the `seat-tooltip` element is `role="tooltip"` and `aria-hidden="true"` | spec `tests/schedule.spec.js` |
| One tap toggles on touch | mobile project: `seat.tap()` flips `aria-pressed` to `true` with no second tap | spec `tests/plan.spec.js` |
| No horizontal overflow, mobile and rightmost grid column | with the grid scrolled to its right end, the open tooltip's box is within the viewport and `documentElement.scrollWidth <= clientWidth` | spec `tests/schedule.spec.js`, both projects |

## Decisions

- **The tooltip is `aria-hidden`, and the button keeps its `aria-label`** rather
  than being wired with `aria-describedby`: the two texts are the same action,
  so describedby makes a screen reader say it twice, which the ticket rules out.
  "Linked by an equivalent" here means the tooltip is the visual twin of the
  name the button already exposes.
- **The grid's own seat buttons get the tooltip too.** The ticket says
  `SeatButton`, but `ScheduleGrid` hand-rolls its two buttons, and the last
  criterion is about the grid's rightmost column — so the hook is shared rather
  than the grid left out.
- **The tooltip renders in a portal, positioned `fixed`** against the button's
  rect: session cards and the grid both set `overflow-hidden`, and the grid cell
  transforms on hover, so an absolutely positioned tooltip would be clipped.
- **No new data lane.** The read-only cases reuse `schedule.seats` (`readOnly`,
  so sharing it is allowed) and the one case that writes rides plan.spec's
  existing `agenda.add` lane — day index 2's slots are all spoken for.

## Out of scope

- Tooltips on the follow and calendar-export buttons (the ticket defers them).
- `SeatPanel`/`SessionPage`, whose seat controls are already labelled in words.
- What the seat button does: no change to seats, waitlists or the ended guard.
