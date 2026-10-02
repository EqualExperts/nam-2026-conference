# Show a tooltip on the seat button that says what it will do

## What this changes
Hovering or keyboard-focusing an icon-only seat button — on a session card
(schedule list, My Agenda, home "Your day") *and* on the schedule grid's banner
and cell buttons — shows a styled tooltip naming the action it will take: Add to
my agenda, Join the waitlist (the room is full), Remove from my agenda, Leave the
waitlist, or Session ended. It hides on mouse leave, on blur, on Escape and on
scroll, and it follows the store after a click, so a seat just taken reads Remove
from my agenda without a reload. The native `title` goes (it said the same thing
a beat later, in the browser's own chrome); the button keeps its `aria-label`.

Two things the first draft of this spec got wrong, and this one fixes:

- **The grid has its own buttons.** `ScheduleGrid.jsx` renders two bespoke seat
  buttons (banner row, room cell) and imports no `SeatButton`, so touching
  `SeatButton` alone would have left the view the ticket actually names — the
  rightmost grid column — with no tooltip at all. The tooltip therefore lives in
  a small shared `Tooltip` wrapper that all three call sites use.
- **Every container clips.** The card is `overflow-hidden`
  (`SessionCard.jsx:86`, `:143`), the grid is `card overflow-hidden` wrapping an
  `overflow-x-auto` scroller (`ScheduleGrid.jsx:41-42`), and the grid cell gets a
  `hover:-translate-y-0.5` transform exactly while it is hovered. An absolutely
  positioned tooltip inside the button would be clipped out of sight while
  `toBeVisible()` and `boundingBox()` still passed. The tooltip is rendered
  through a portal into `document.body` and positioned `fixed` from the anchor's
  measured rect, so nothing upstream can clip it or re-anchor it.

## Where
- **`src/lib/format.js`** — new pure helper `seatActionLabel({ status, ended, full })`
  → the five phrases. It is the one place the copy lives (`SeatButton` and both
  grid buttons read it) and it makes the five-state matrix provable without a
  browser, which `ui.jsx` cannot be (`node --test` does not parse JSX).
- **`src/components/ui.jsx`** — new `Tooltip({ text, testId, className, children })`:
  - A wrapper `<span ref={anchor} className="relative z-10 inline-grid …">` owns
    the pointer handlers, because a **disabled** button (the ended state) fires no
    mouse events of its own; `onFocus`/`onBlur` bubble up from the button.
  - Opens on `onPointerEnter` **only when `e.pointerType === 'mouse'`**, so a tap
    never opens it; closes on `onPointerLeave` and `onBlur`.
  - While open: a `document` `keydown` listener closes it on Escape (a handler on
    the button would miss a tooltip opened by hover, with focus still on `body` —
    WCAG 1.4.13 wants it dismissible either way), and capture-phase `scroll` plus
    `resize` listeners close it, since a `fixed` tooltip would otherwise drift off
    its button when the grid is scrolled sideways.
  - Renders `createPortal(<span role="tooltip" id aria-hidden="true"
    data-testid={testId} …>, document.body)`. `aria-hidden` keeps the live node
    from being announced in its own right; a node referenced by `aria-describedby`
    still contributes its text, which is how the description gets through once.
  - `useLayoutEffect` measures anchor and tooltip and sets `position: fixed`
    coordinates: centred on the button, clamped to `8px` from each viewport edge,
    `6px` above it, flipped below when there is no room above (sticky grid
    header). It renders `visibility: hidden` until measured, and the measuring
    effect runs before paint, so there is no flash.
  - Classes are tokens only: `glass border-hairline text-ink animate-rise
    pointer-events-none z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5
    text-[11px] shadow-lg shadow-black/50` — the same recipe as `Toaster` and
    `UserSwitcher`. Reduced motion is already handled globally in `index.css`.
  - `children` is a function receiving the tooltip's `id` while open and
    `undefined` while closed, so a call site can set `aria-describedby` exactly
    when there is something to describe (no dangling idref).
- **`src/components/ui.jsx` — `SeatButton`**: new `full` prop; label comes from
  `seatActionLabel`; wrapped in `Tooltip` with `testId="seat-tooltip"` and
  `aria-describedby={tipId}` on the button; `title={label}` dropped. The `title`
  prop (an override used nowhere today) stays as the label override it is.
- **`src/components/SessionCard.jsx`** (~127, ~184) — `full={isFull}` (already
  computed at line 80 from `seatsFor` over the payload).
- **`src/components/TodayPanel.jsx`** (~222) — add `seatsFor` to the
  `useConference()` destructure and pass `full={(seatsFor(s.id)?.seatsLeft ?? s.seatsLeft) === 0}`,
  matching how the rest of the app prefers live counts.
- **`src/components/ScheduleGrid.jsx`** — wrap both buttons in `Tooltip`
  (`testId="seat-tooltip"`), text from `seatActionLabel`. The buttons keep their
  current classes and their current `aria-label`s verbatim, including the
  per-session ones `tests/schedule.spec.js:135` looks up; the cell's `-mr-1 -mt-1`
  moves onto the wrapper span so the layout does not shift. The banner button's
  label is the generic phrase, so it gets `aria-describedby`; the cell button's
  label already contains the action and the session title, so it does not (see
  Decisions).
- **Docs** — `docs/context/ui.md` (new `Tooltip` row, `SeatButton`'s `full`,
  `format.seatActionLabel`, `title` gone), `docs/context/schedule.md` (grid seat
  buttons carry the same tooltip), `docs/context/testing.md` (the new lane, and
  that it shares one attendee across projects by pinning distinct slots).
- **Tests** — `tests/unit/format.test.js` (label matrix);
  `tests/schedule.spec.js` (a `Seat button tooltip` describe); `tests/helpers.js`
  gains one lane:
  `'seat.tooltip': { desktop: { user: kenji, day: 1, slot: '11:30' }, mobile: { user: kenji, day: 1, slot: '14:45' } }`.
  Day index 1 holds no slot-owning lane (the day-1 lanes pick dynamically and
  assert only their own agenda), and every other attendee is spoken for there, so
  the two panes share Kenji and pin different slots — which is what
  `tests/unit/lanes.test.js` allows. The only other pane on Kenji/day 1 is
  `schedule.seats`, which is read-only. Each test releases what it books.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| The five phrases are the right ones for each state, Leave the waitlist included | `seatActionLabel` over the matrix: none/confirmed/waitlisted × full × ended | unit |
| Hover shows a tooltip naming the action, within ~300 ms | desktop: hover a bookable card's seat button, `expect(getByTestId('seat-tooltip')).toHaveText('Add to my agenda')` with the default 7 s expect timeout but no added delay in the code; a sold-out session on the `schedule.seats` lane reads `Join the waitlist`; a past day's disabled button reads `Session ended` | spec |
| Also on keyboard focus; hides on blur, mouse leave, Escape | `focus()` shows it, `blur()` hides it; hover shows it, `mouse.move` away hides it; **hover with focus on `body`** then `keyboard.press('Escape')` hides it | spec |
| After clicking, the text reflects the new state, no reload | still hovered: click → `Remove from my agenda` and `aria-pressed=true`; click again → `Add to my agenda`; no navigation in between | spec |
| Accessible name kept, tooltip linked, announced once | `aria-label` unchanged before and after; `aria-describedby` equals the tooltip's `id` while shown and is absent while hidden; `title` attribute absent; tooltip node is `aria-hidden` | spec |
| A tap toggles straight away | mobile project: one `tap()` flips `aria-pressed` to `true`, and `seat-tooltip` is never attached (`expect(...).toHaveCount(0)` right after) | spec |
| Stays inside the viewport, and nothing clips it | desktop grid, **rightmost room column**, and mobile list card (opened with `focus()`, since touch emulation gives no mouse pointer): tooltip box `x >= 0`, `x + width <= viewportSize().width`, `y >= 0`; and `el.parentElement === document.body` — the portal is what proves no `overflow-hidden`/`overflow-x-auto`/transformed ancestor can clip it, which `toBeVisible()` cannot | spec |
| Design tokens and `animate-rise`, nothing under reduced motion | tooltip carries `animate-rise` and `glass`; with `page.emulateMedia({ reducedMotion: 'reduce' })` its computed `animation-duration` parses below 1 ms | spec |
| Nothing else regressed | `npm test`, then `npm run verify` on a claimed lane — including the existing ended-seat tests that assert those buttons stay `disabled` | gate |

## Decisions
- **Portal + measured `fixed` position, rather than an absolutely positioned span
  in the card.** Three layers of `overflow-hidden` and a hover transform in the
  grid make in-flow positioning invisible in exactly the two places the ticket
  calls out. Clamping to the viewport in JS also answers the overflow criterion
  honestly instead of hoping right-alignment is enough. OK?
- **The ended button stays `disabled`, so its tooltip is hover-only.** A disabled
  button is not focusable, so "appears on focus" cannot hold for Session ended
  without switching to `aria-disabled` — and `tests/schedule.spec.js:176,205,210`
  and `session.spec.js:81` assert `toBeDisabled()`. Changing the button's
  semantics is a bigger change than this ticket, so the ended tooltip is reachable
  by pointer only. OK?
- **No `aria-describedby` on the grid *cell* button.** Its accessible name is
  already "Add <title> to my agenda"; adding a description that repeats the action
  is the double announcement the ticket asks us to avoid. There the tooltip is a
  visual echo (`aria-hidden`) and the name carries the meaning. OK?
- **The tooltip opens for mouse pointers only** (`pointerType === 'mouse'`),
  rather than opening on hover and hoping a tap does not linger. A tap therefore
  toggles and shows nothing at all. OK?
- **No open delay** — the criterion is "within about 300 ms", so showing at once
  is the safest reading, and it matches a native `title` being replaced. OK?
- **Also hides on scroll** (not in the ticket). A `fixed` tooltip would otherwise
  sit where the button used to be once the grid is scrolled sideways. OK?
- **`full` is a new prop rather than derived inside `SeatButton`.** The component
  takes no session; its three callers already hold live seat counts. Note this
  changes the `aria-label` of a full session's button from "Add to my agenda" to
  "Join the waitlist", which is what the API will actually do. OK?

## Out of scope
Tooltips on other icon-only buttons (follow, calendar export). `SessionPage` /
`SeatPanel`'s seat action, which is a labelled button whose visible text already
says what it does. Changing what the seat button does, or what the grid's
buttons are named.
