# Show a tooltip on the seat button that says what it will do

## What this changes

Hovering (or keyboard-focusing) the icon-only seat button on any session card —
`/schedule` list, `/my-agenda`, the home page's suggestions — pops a small
in-app tooltip after ~250 ms naming the action: **Add to my agenda**, **Join the
waitlist**, **Remove from my agenda**, **Leave the waitlist** or **Session
ended**. It follows the button's state, so after clicking "Add" the next hover
reads "Remove from my agenda" with no reload. It closes on blur, mouse-leave and
Escape, never intercepts a tap, and stays inside the viewport. The native
`title` attribute goes away so the browser's own tooltip does not double up.

## Where

- `src/components/ui.jsx` — `SeatButton` (from the `export function SeatButton`
  line, ~114–155). Keep the existing `label` computation and `aria-label`; drop
  the `title={label}` attribute. Add local state (`open`) plus a ~250 ms
  `setTimeout` opened by `onMouseEnter`/`onFocus` and cleared by
  `onMouseLeave`/`onBlur`/`onKeyDown` Escape (clear the timer on unmount).
  Render the tooltip as a sibling of the `<button>` inside a new
  `<span className="relative inline-flex">` wrapper, positioned `fixed` from the
  button's `getBoundingClientRect()` and clamped to `window.innerWidth` with an
  8 px margin: the cards in `SessionCard.jsx` (both the `row` variant at line 86
  and the full card at line 141) are `overflow-hidden`, so an absolutely
  positioned tooltip would be clipped. Classes: `glass`, `border-hairline`,
  `rounded-lg`, `text-[11px]`, `animate-rise`, `pointer-events-none`, `z-50`,
  plus `data-testid="seat-tip"`, `role="tooltip"` and an `id` from `useId()`. While
  the tooltip is open the button carries `aria-describedby` pointing at that id
  (and no `aria-describedby` when closed, so nothing dangles); the tooltip is
  not `aria-hidden`.
  Replace `disabled` with `aria-disabled` for the ended state (a native
  `disabled` button fires no `mouseenter` in Chromium, so "Session ended" could
  never appear); the `if (!closed) onClick()` guard already makes the click a
  no-op, and `disabled:opacity-40` on this element is unused — its dimmed look
  comes from the `closed` branch of the class list.
- Call sites need no change: `src/components/SessionCard.jsx` lines 127 and 184,
  `src/components/TodayPanel.jsx` line 222. No caller passes `title`.
- `tests/helpers.js` — add to `LANES`:
  `'tooltip.seat': { desktop: { user: kenji, day: 1 }, mobile: { user: marcus, day: 0, slot: '14:45' } }`.
  Desktop shares kenji/day 1 only with `schedule.seats`, which is `readOnly`;
  mobile pins a slot distinct from the other marcus/day-0 panes (13:30, 16:00)
  and from the `agenda: false` attendance panes. If no bookable session starts
  at 14:45 that day, move the pane to another free slot rather than letting the
  test skip (`neverRanAdded`).
- `tests/seats.spec.js` — two new tests, each `test.skip`ped on the other
  project so they never race the one lane: a desktop one (hover/focus/Escape,
  label after click, viewport clamp) and a mobile one (tap). Both use
  `laneFor('tooltip.seat', testInfo)`, `bookableFor(request, lane.user, lane.day)`,
  `visit(page, '/schedule?day=…', { as: lane.user, at: momentOn(lane.day, '09:00') })`
  and release the seat they take via the API, as the tests above them do.
- `docs/context/ui.md` — the `SeatButton` row of the `src/components/ui.jsx`
  exports table (it currently documents the `title` prop and the `ended`
  disabled behaviour) and the *Motion utilities* list of `animate-rise` users.

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Hover names the action, and the name follows the state | desktop test: hover a bookable card's seat button → `seat-tip` reads "Add to my agenda"; click, await the toast, hover again → "Remove from my agenda" | browser (desktop) |
| A full session reads "Join the waitlist", a finished one "Session ended" | same test: hover the seat button of a card whose session `isFull`, then (clock pinned after it ended) one on Day 1's attended morning — no click, so nothing is booked | browser (desktop) |
| Keyboard focus opens it; blur and Escape close it | same test: `button.focus()` → `seat-tip` visible; `Escape` → hidden; focus again then `blur()` → hidden | browser (desktop) |
| It is announced once, and animates with the app's motion | same test: button keeps `aria-label="Add to my agenda"`, while the tip is open the button's `aria-describedby` equals the tip's `id`, the tip is not `aria-hidden`, and it has the `animate-rise` class; after close the attribute is gone | browser (desktop) |
| It stays inside the viewport | same test: hover the seat button of the last card in the list, assert the tip's bounding box has `x >= 0` and `x + width <= viewport.width` | browser (desktop) |
| A tap still toggles the seat first time, and the tip never blocks it | mobile test: one `tap()` on the seat button → "Seat reserved" toast and `aria-pressed="true"`; the tip, if present, carries `pointer-events-none` | browser (mobile) |

## Decisions

- The tooltip is linked with `aria-describedby` (set only while it is open), as
  the ticket requires, and is not `aria-hidden`. The button keeps its
  `aria-label` as its name. Because the description repeats the name, the
  tooltip text exists in the DOM only while open and the native `title` is
  removed, so the text is exposed once as name and once as a description at
  most, never via a third `title` channel; screen readers commonly drop a
  description identical to the name. Accepted as meeting "announce once" —
  OK?
- An ended seat button becomes `aria-disabled` instead of `disabled`, so it can
  still answer a hover with "Session ended" — OK?
- Reduced motion is left to the global `prefers-reduced-motion` block in
  `src/index.css`, which already neutralises `animate-rise`, rather than a JS
  `matchMedia` check — OK?
- The tooltip is built into `SeatButton` rather than added as a shared
  `<Tooltip>` primitive, since it is the only user today — OK?

## Out of scope

- Tooltips on the follow and calendar-export buttons.
- Any change to what the seat button does.
