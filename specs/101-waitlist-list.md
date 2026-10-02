# I want to see which session I am waitlisted for

## What this changes
On `/my-agenda` the **On a waitlist** tile becomes a button when the count is above zero (plain text at zero). Pressing it opens a panel under the tiles listing each waitlisted session: title, day and start time, soonest first, each linking to `/sessions/:id`. Pressing again closes it. The count and list come from the store's live reservations, so leaving a waitlist on the session page and coming back updates both with no reload. The panel is a single column of wrapping rows, so it does not scroll sideways on mobile.

## Where
- `src/pages/MyAgendaPage.jsx` — in the `{data && …}` block, replace the `<Stat … label="On a waitlist">` with a toggle (`useState`, `data-testid="stat-waitlist"`, a `<button>` only when `totalWaitlisted > 0`). Beside the existing `totalWaitlisted` memo-derived values, build `waitlisted = days.flatMap(d => d.sessions.filter(s => reservationFor(s.id) === 'waitlisted'))` sorted by `date`/`startsAt`; render `waitlist-list` with `waitlist-item-<id>` links (`Link to={`/sessions/${s.id}`}`, text via `dayLabel` and `time` from `src/lib/format.js`). Close the panel when the count reaches 0. `Stat` in `src/components/ui.jsx` takes a `value` node, so it is wrapped rather than changed (or add an optional `onClick` if cleaner).
- `tests/plan.spec.js` — new tests; the first reads Amara (seeded with a waitlist place, read-only) at `/my-agenda`; the second uses a new lane `agenda.waitlist` in `tests/helpers.js` `LANES` (attendee other than Jonas, day not shared with another writing lane; `tests/unit/lanes.test.js` enforces this), `bookableFor(...).find(s => s.isFull)` to pick a full session and the join/leave steps of `seats.spec.js` "a full session offers the waitlist" (`reserve-seat`, `release-seat`), pinned with `momentOn(0, '07:00')`.
- `docs/context/agenda.md` — add the tile and `waitlist-list` to the My Agenda paragraph.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Tile clickable when count > 0, plain at zero | Amara: `stat-waitlist` is a button; Jonas (no waitlist): no button role on the tile | Playwright, `plan.spec.js` |
| Click shows sessions with title, day, start time, soonest first | Amara: `waitlist-list` hidden before click, after click one `waitlist-item-<id>` per waitlisted id from the `/schedule` payload, in `date`+`startsAt` order, each containing title and time | Playwright, `plan.spec.js` |
| Each links to its session page | the item's `href` is `/sessions/<id>`; clicking lands on that page's `reservation-waitlisted` | Playwright, `plan.spec.js` |
| Leaving then returning updates count and list without reload | lane attendee joins a full session, sees it in the list, releases on the session page, navigates back in-app, item gone and count down by one | Playwright, `plan.spec.js` |
| Mobile: no horizontal scroll | on the mobile project, with the list open, `document.documentElement.scrollWidth <= clientWidth` | Playwright, `plan.spec.js` |

## Decisions
- Show the list inline under the tiles (a toggle), rather than navigating or opening a modal — OK?
- With no waitlist, the tile stays visible as plain text showing 0, rather than disappearing — OK?
