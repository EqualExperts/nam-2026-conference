# Keep sessions in view on mobile: stop the stacked filters filling the screen

## What this changes

At phone width the schedule's filter rail is already collapsed behind the
**Filters** button, but opening it (which an attendee must do to change day)
stacks every control full width: the agenda summary card, four day buttons one
above another, eleven track pills, and four selects one per row. That is about
700px of rail, so the first session card is pushed below a Pixel 7 screen. After
this change the opened rail is compact below `lg`: the day buttons sit in one
row, the venue/level/format/topic selects in two columns, the agenda summary card
is left out, and the spacing is tighter. The first session card stays on screen
with the rail open. Desktop (`lg` and up) looks the same as it does today.

## Where

- `src/pages/SchedulePage.jsx`, the `rail` JSX. Every change is a Tailwind class
  that applies below `lg`, with an `lg:` class putting back today's desktop look:
  - the outer `space-y-5` becomes `space-y-3 lg:space-y-5`;
  - the "My agenda" card (`starred-count`) gets `hidden lg:block`. Keep the
    element and its test id;
  - the day `div.grid gap-1.5` becomes `grid-cols-4 lg:grid-cols-1`. Each
    `tab-<date>` button stacks its label and `shortDay` in two short lines below
    `lg` (`flex-col` then `lg:flex-row`). It keeps its `aria-pressed` and test id;
  - the selects' `div.grid gap-2` becomes `grid-cols-2 lg:grid-cols-1`;
  - the `aside` wrapper `card p-4` becomes `p-3 lg:p-4`.
  If the first card is still off screen at Pixel 7, there is one more lever: pass
  `description` to `SectionHeader` only when `wide`, since the variable is
  already in scope. No new component, no change to `FilterBar.jsx`.
- Test: `tests/schedule.spec.js`, a new `test('on a phone the open filter rail
  leaves the first session in view', …)` inside `describe('Schedule')`. It
  skips unless `testInfo.project.name === 'mobile'` and uses `visit`
  (pinned with `at: await momentOn(0, MID_SESSION_TIME)`), `waitForResults` and
  `conferenceDays` from `tests/helpers.js`. It is read-only, so it needs no data
  lane: it books nothing.
- `docs/context/schedule.md`, the "Grid vs list" paragraph about the filter
  rail: say that below `lg` the opened rail is compact and has no agenda card.

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| At a phone-width viewport on /schedule, the first session card is visible without scrolling past the full filter block | New mobile test: `visit('/schedule?view=list')`, click `Filters`, expect `getByRole('complementary', { name: 'Schedule filters' })` visible, then `expect(page.locator('article').first()).toBeInViewport()`. This fails on main, where the open rail is about 700px tall and pushes the first card below the 839px Pixel 7 viewport. | Browser (mobile project) |
| Every filter (day, track, venue, level, format, topic, search) is still reachable on mobile | The same test, with the rail open: `search-input` visible; `tab-<d>` visible for each of `conferenceDays()`; the `Agents` track pill visible; `getByRole('combobox', { name })` visible for Venue, Level, Format and Topic; choosing a Topic option puts `tag=` in the URL. This is a guard that also holds on main. The row 1 assertion in the same test is what fails on main. | Browser (mobile project) |
| Existing mobile specs still pass | `npm run verify`, `mobile` project. In particular, `schedule.spec.js` "switching day…", "search narrows…" and "the agenda line names the selected day…" still pass. That last one reads `starred-count`'s text, which `toContainText` reads while the element is hidden, as it already does on mobile today with the rail closed. | Browser (desktop + mobile) |

## Decisions

- Keep the existing Filters toggle and compact the open rail, rather than adding a sticky bar or an always-visible day strip. The ticket leaves the approach open.
- Leave the "My agenda" summary card out of the rail below `lg`. It is not a filter, and the count is in the mobile nav menu and on My Agenda.
- Change nothing at `lg` and wider. The ticket is about phones only.

## Out of scope

- The multi-track filter (#1 on the fork). This ticket keeps the single-select track pills as they are; expect a rebase if both are in flight.
- Closing the rail automatically after a filter is picked.
