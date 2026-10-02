# See which sessions I am waitlisted for on My Agenda
## What this changes
On `/my-agenda` the **On a waitlist** tile becomes a button when the count is above zero (plain text at zero). Pressing it opens a panel under the tiles listing each waitlisted session — title, day and start time, soonest first — each linking to `/sessions/:id`. Pressing the tile again closes the panel. The panel is built from the same live-filtered `days` as the count, so leaving a waitlist updates both without a reload; at zero the panel disappears. Rows are a vertical stack with a truncated title, so nothing scrolls sideways on mobile.
## Where
- `src/components/ui.jsx` — `Stat`: optional `onClick`, `expanded` and `testId`-style props; when `onClick` is given the card renders as a `<button aria-expanded>`, otherwise unchanged.
- `src/pages/MyAgendaPage.jsx` — in `MyAgendaPage`, derive `waitlisted` from `days` (flatMap sessions where `reservationFor(s.id) === 'waitlisted'`, sorted by `day` then `startsAt`); `useState` for open; pass `onClick` to the waitlist `Stat` (`testId="stat-waitlisted"`) only when `totalWaitlisted > 0`; new `WaitlistPanel` (`data-testid="waitlist-list"`, rows `waitlist-row`) modelled on `ToRateCallout` (day label via `dayLabel`, `s.startsAt`, `Link` to `/sessions/${s.id}`). Render it only while open and `waitlisted.length > 0`.
- Test in `tests/plan.spec.js` using `openPlan` and `ATTENDEES.amara` (seeded with a seat and a waitlist place) for the read-only checks; for "leave a waitlist" add an `agenda.waitlist` entry to `LANES` in `tests/helpers.js` (clean attendee+day not used by another lane, checked by `tests/unit/lanes.test.js`), join a full session's waitlist via the API, then leave it from the session page and return to My Agenda; release what it booked.
- Docs: update the My Agenda part of `docs/context/agenda.md`.
## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Tile clickable above zero, plain at zero | Amara: `stat-waitlisted` is a button; Jonas (no waitlist): it is not a button | Playwright spec (`plan.spec.js`) |
| Click shows sessions soonest first with title, day, start time | click it; `waitlist-row` texts equal the waitlisted sessions from the `/schedule` payload sorted by day then start, each containing title and time | Playwright spec |
| Each links to its session page | row link `href` is `/sessions/<id>` for each | Playwright spec |
| Leaving updates count and list without reload | lane attendee waitlisted, leave on session page, navigate by link to My Agenda: count and row gone | Playwright spec (lane `agenda.waitlist`) |
| Mobile fits, no horizontal scroll | same open-panel test on the mobile project asserts `scrollWidth <= clientWidth` on the document | Playwright spec (mobile project) |
## Decisions
- Pressing the tile toggles an inline panel on the page, rather than scrolling to the first amber session — OK?
- The panel stays closed on load and closes itself when the last waitlist place is left — OK?
## Out of scope
Showing my place in line on My Agenda (the session page shows it).
