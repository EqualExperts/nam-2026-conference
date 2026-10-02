# Show a tooltip on the seat button that says what it will do

## What this changes
Hovering or keyboard-focusing the icon-only seat button on any session card (schedule list and grid, My Agenda, home "Your day") shows a styled tooltip within ~300 ms naming the action: Add to my agenda, Join the waitlist (session full), Remove from my agenda, Leave the waitlist, or Session ended. It hides on blur, mouse leave and Escape, and follows the store state after a click. The native `title` goes (it duplicated the tooltip); the button keeps `aria-label` and gains `aria-describedby` to the tooltip. A tap still toggles at once.

## Where
- `src/components/ui.jsx` — `SeatButton`: add a `full` prop; label becomes Join the waitlist when `full && !on`. Wrap the button in a `relative inline-grid` span (a disabled button fires no mouse events, so the wrapper owns `onMouseEnter/Leave`; focus and blur bubble from the button via `onFocus/onBlur`, `onKeyDown` Escape). Local `open` state; tooltip is `<span role="tooltip" id={useId()} data-testid="seat-tooltip" className="animate-rise ...">` using token classes (`glass`, `border-hairline`, `text-ink`), shown only while `open`, with the text equal to the label. Positioning keeps it in the viewport: anchored above and right-aligned (`bottom-full right-0`), as the button sits at the right edge of cards, with `whitespace-nowrap`. Drop `title={label}`. Reduced motion is already handled by the global block in `src/index.css`, so no CSS change. No hover delay is added, so it shows well inside 300 ms. Touch: tooltip opens on mouseenter/focus only and never intercepts `onClick`; `pointer-events-none` on the tooltip.
- `src/components/SessionCard.jsx` — both `SeatButton` uses (lines ~127 and ~184): pass `full={isFull}` (`isFull` is defined at line 80).
- `src/components/TodayPanel.jsx` — line ~222: pass `full={s.isFull}`.
- `docs/context/ui.md` — SeatButton row: add `full` and the tooltip, drop mention of title behaviour.
- Tests: `tests/schedule.spec.js` (new tests) using `laneFor` with a new lane `seat.tooltip` added to `LANES` in `tests/helpers.js` (own attendee and day, release what is booked), `visit(page, '/schedule?...', { at })` with the clock pinned, and the existing read-only lane `schedule.seats` (a day with sold-out sessions) for the full case.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Hover shows a tooltip naming the action (Add to my agenda; Join the waitlist on a full session; Session ended on a past one) | hover the card's seat button, `expect(getByTestId('seat-tooltip')).toHaveText(...)` for each state (none exists on main) | spec |
| Also on keyboard focus; hides on blur, mouse leave, Escape | `focus()` shows it; `blur()`, `mouse.move` away and `keyboard.press('Escape')` each make it hidden | spec |
| After clicking the text reflects the new state | click, still hovered, tooltip reads Remove from my agenda; click again, Add to my agenda | spec |
| Accessible name kept, tooltip linked | button `aria-label` unchanged; `aria-describedby` equals the tooltip's `id` while shown; no `title` attribute | spec |
| Tap toggles straight away | in the mobile project, `tap()` once changes `aria-pressed` to true | spec |
| Stays inside the viewport (mobile, rightmost grid column) | tooltip `boundingBox()` within `page.viewportSize()` width in list and grid views | spec |
| Design tokens, animate-rise, no animation under reduced motion | tooltip has class `animate-rise`; with `page.emulateMedia({ reducedMotion: 'reduce' })` computed animation-duration is ~0 | spec |

## Decisions
- Show no hover delay, rather than a deliberate delay such as 300 ms, so it appears as fast as the criterion allows. OK?
- Drop the native `title` so a screen reader and the browser do not announce the label twice. OK?
- Anchor the tooltip above the button, right-aligned, rather than measuring the viewport in JS. OK?

## Out of scope
Tooltips on other icon buttons (follow, calendar export); changing what the seat button does.
