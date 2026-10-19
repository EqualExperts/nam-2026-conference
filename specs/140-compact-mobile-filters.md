# Keep sessions in view on mobile: stop the stacked filters filling the screen

## What this changes
On a phone (the `mobile` project: 393×659, an iPhone 15's viewport), opening
**Filters** on /schedule no longer pushes the first session card below the fold.
Below `lg` the open rail is compact: the day buttons sit in one row, the track
pills in one horizontally scrolling row, the four selects in two columns, and the
"My agenda" card and the page description are hidden. Every filter — search, day,
track, venue, level, format, topic — is still on the open rail. At `lg` and wider
nothing changes.

## Where
- `src/pages/SchedulePage.jsx` — the `rail` JSX (lines ~109–202): `space-y-3 lg:space-y-5`;
  the My agenda card gets `hidden lg:block` (keep `starred-count` in the DOM);
  the Day `grid gap-1.5` becomes `grid grid-cols-4 gap-1.5 lg:grid-cols-1`, each
  `tab-<date>` button one line below `lg` (label on top, `shortDay` hidden or small,
  `sessionCount` hidden below `lg`), keeping `data-testid` and `aria-pressed`;
  the Track `flex flex-wrap` becomes `flex flex-nowrap overflow-x-auto hide-scrollbar
  lg:flex-wrap` with pills `shrink-0`; the selects' `grid gap-2` becomes
  `grid grid-cols-2 gap-2 lg:grid-cols-1`. The `aside`'s card goes `p-3 lg:p-4`.
  The `SectionHeader` `description` is wrapped in `<span className="hidden sm:inline">`.
- `tests/schedule.spec.js` — one new test, mobile only
  (`test.skip(testInfo.project.name !== 'mobile', …)`): `visit(page,
  '/schedule?view=list', { at: await momentOn(0, MID_SESSION_TIME) })`,
  `waitForResults`, click the `Filters` button, assert
  `page.locator('article').first()` is `toBeInViewport()`, then that every filter is
  reachable: `search-input` fill, each `tab-<date>` from `conferenceDays()` visible,
  the last track pill (`getByRole('button', { name: 'Product' })`) clicked → URL has
  `track=`, and `getByLabel('Venue'|'Level'|'Format'|'Topic')` each visible.
  Read-only: no booking, so no data lane; `shotForPR(page, 'open filter rail')`.
- `docs/context/schedule.md` — the "Grid vs list" paragraph on the rail: say it is
  compact below `lg` and the My agenda card is desktop-only.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| At phone width on /schedule, the first session card is visible without scrolling past the full filter block | new test `on a phone the open filter rail leaves the first session in view`: with Filters open at 393×659, first `article` `toBeInViewport()` — false on main, where the open rail stacks search, agenda card, four day rows, ~4 rows of pills and four selects (~700px) | browser, `mobile` |
| Every filter (day, track, venue, level, format, topic, search) still reachable on mobile | same test, after the in-view assertion: search fill, each day tab visible, last track pill clicked sets `track=`, four selects visible by label (the test as a whole is red on main via the row above) | browser, `mobile` |
| Existing mobile specs still pass | `npm run verify` (both projects; `tests/smoke.spec.js` also catches horizontal page overflow from the scrolling pill row) | browser, both |

## Decisions
- The first criterion already holds on main with the rail **closed** (it is hidden below `lg` behind the Filters button, and the first card sits around 360px down). This build proves it with the rail **open**, at the 393×659 mobile project. OK?
- Compact the existing open rail (one-row days, a scrolling track row, two-column selects) rather than a drawer, sticky bar or always-visible day strip. OK?
- Hide the "My agenda" card below `lg` — it is not a filter, and the count is on My Agenda and in the nav. OK?
- Hide the schedule's page description below `sm` to give the sessions the room. OK?

## Out of scope
- Phones narrower than 393px (#142's QA probe at 375px); the layout should hold there but is not asserted.
- Any change at `lg` and wider.
