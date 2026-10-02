# Show a tooltip on the seat button that says what it will do

## What this changes
Hovering or keyboard-focusing an icon-only seat button — on a session card
(schedule list, My Agenda, home "Your day") *and* on the schedule grid's banner
and cell buttons — shows a styled tooltip naming the action it will take: Add to
my agenda, Join the waitlist (the room is full), Remove from my agenda, Leave the
waitlist, or Session ended. It hides on mouse leave, on blur, on Escape and on
scroll, and it follows the store after a click, so a seat just taken reads Remove
from my agenda without a reload. The native `title` goes (it said the same thing
a beat later, in the browser's own chrome); the button keeps its `aria-label`,
which is already that same phrase — so the tooltip is a visual echo of the
accessible name (`aria-hidden`, referenced by nothing) and a screen reader hears
the action once, from the name (see Decisions).

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
  - Renders `createPortal(<span aria-hidden="true" data-testid={testId} …>,
    document.body)`. It carries no `id` and no `role="tooltip"`, because nothing
    references it and an `aria-hidden` node has no role in the tree: every call
    site's button is already *named* with the phrase the tooltip shows, so the
    tooltip is purely visual and the name does the announcing.
  - `useLayoutEffect` measures anchor and tooltip and sets `position: fixed`
    coordinates: centred on the button, clamped to `8px` from each viewport edge,
    `6px` above it, flipped below when there is no room above (sticky grid
    header). It renders `visibility: hidden` until measured, and the measuring
    effect runs before paint, so there is no flash.
  - Classes are tokens only: `glass border-hairline text-ink animate-rise
    pointer-events-none z-50 whitespace-nowrap rounded-lg px-2.5 py-1.5
    text-[11px] shadow-lg shadow-black/50` — the same recipe as `Toaster` and
    `UserSwitcher`. Reduced motion is already handled globally in `index.css`.
  - `children` is plain children — the wrapper needs no id plumbing back to the
    call site, since no button references the tooltip.
- **`src/components/ui.jsx` — `SeatButton`**: new `full` prop; label comes from
  `seatActionLabel`; wrapped in `Tooltip` with `testId="seat-tooltip"` and the
  same label as the tooltip text; `title={label}` dropped, `aria-label={label}`
  kept and no `aria-describedby`/`aria-labelledby` added. The `title` prop (an
  override used nowhere today) stays as the label override it is.
- **`src/components/SessionCard.jsx`** (~127, ~184) — `full={isFull}` (already
  computed at line 80 from `seatsFor` over the payload).
- **`src/components/TodayPanel.jsx`** (~222) — add `seatsFor` to the
  `useConference()` destructure and pass `full={(seatsFor(s.id)?.seatsLeft ?? s.seatsLeft) === 0}`,
  matching how the rest of the app prefers live counts.
- **`src/components/ScheduleGrid.jsx`** — wrap both buttons in `Tooltip`
  (`testId="seat-tooltip"`), text from `seatActionLabel`. The buttons keep their
  current classes and their current `aria-label`s verbatim, including the
  per-session ones `tests/schedule.spec.js:135` looks up; the cell's `-mr-1 -mt-1`
  moves onto the wrapper span so the layout does not shift. Neither button gains
  an `aria-describedby`: the banner's label already *is* the phrase the tooltip
  shows and the cell's label is that phrase plus the session title, so in both
  cases a description would repeat the name (see Decisions).
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
| Accessible name kept, announced once and not twice | on all three buttons, while the tooltip is shown: `aria-label` unchanged from today's value and equal to the tooltip's text; `aria-describedby`, `aria-labelledby` and `title` all absent, so the phrase reaches the accessibility tree by exactly one route; the tooltip node is `aria-hidden="true"`. The name-vs-description check is made by the accessibility tree rather than by attribute spelunking: with the tooltip open, `getByRole('button', { name })` resolves for each button's own name (the card's `Add to my agenda`, the cell's `Add <title> to my agenda`), while the same query plus `description: /./` has count 0 — Playwright computes the accessible description per accname, so this row goes red the moment anything (an `aria-describedby`, a stray `title`) gives the button a second voice | spec |
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
- **No `aria-describedby` anywhere — the tooltip is a visual echo of the
  accessible name.** The ticket asks for the tooltip to be "linked to the button
  (`aria-describedby` or equivalent) so screen readers announce it once, not
  twice". Those two halves pull apart here, because every one of these buttons is
  *already named with the tooltip's own words*: `ui.jsx:136` names the card
  button "Add to my agenda" / "Remove from my agenda" / "Leave the waitlist" /
  "Session ended", the grid banner button carries the same generic phrase
  (`ScheduleGrid.jsx:106`) and the grid cell button carries it plus the session
  title. Pointing `aria-describedby` at a node whose text equals the name makes a
  screen reader say the phrase twice — the failure the criterion exists to
  prevent. So the "equivalent" we take is the strongest one available: the
  tooltip's text *is* the accessible name, the live node is `aria-hidden`, and
  nothing references it. Sighted-hover users gain the phrase; screen-reader users
  already had it, once. The alternative — swapping `aria-label` for
  `aria-labelledby={tipId}` while open — buys no new information, makes the name
  blink between two sources on hover, and cannot work for the cell button, whose
  name is deliberately longer than the tooltip. OK?
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
