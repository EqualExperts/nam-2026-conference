# Let attendees choose their interests

## What this changes
The attendee menu gains a `Your interests` entry. It opens a modal listing every
topic tag as a toggle button (`aria-pressed`), the attendee's current interests
already pressed. Save writes the selection to `users.interests`; Cancel, Escape
or an outside click closes it and saves nothing. Nothing reads interests yet.

## Where
- `server/routes/users.js` — new `PUT /:id/interests` taking `{ interests: string[] }`. 404 for an unknown attendee; 400 unless it is an array of strings that are all `tags.kind = 'topic'` names (one prepared `SELECT name FROM tags WHERE kind='topic'`). Dedupe, store `join(',')`, reply `toUser(row)`. Reading already works: `toUser` in `server/lib/query.js` splits the column, so no mapper change.
- `src/lib/api.js` — `saveInterests(userId, interests)` beside `followSpeaker`.
- `src/lib/store.jsx` — `saveInterests(list)`: call the api, then `setData` to replace that user's `interests` in `data.users`, so `currentUser.interests` is live without a reload; toast on success. Added to the context value and memo deps.
- `src/components/InterestsDialog.jsx` (new) — modelled on `ConflictDialog` (focus in, body scroll lock, Escape, backdrop click). Rendered through `createPortal` to `document.body` (the header is `glass`, which would trap a `fixed` overlay). Topic list from `useConference().tags.filter(kind === 'topic')`, local draft state seeded from `currentUser.interests`, toggle buttons with `aria-pressed`. Panel is `max-h` with a scrolling list and a pinned footer (Cancel, Save) so Save stays in view at 390px wide; chips wrap, no horizontal scroll.
- `src/components/UserSwitcher.jsx` — a `Your interests` button (`data-testid="open-interests"`) between the list and the talk links; it closes the menu and opens the dialog. Dialog state lives outside the `open &&` block so it survives the menu closing.
- Tests: `tests/api/users-interests.test.js` (new; `startApi()` from `tests/api/harness.js`, own throwaway database, `api.put`); `tests/interests.spec.js` (new; `visit`, `laneFor('interests.save', testInfo)` with a new `LANES` entry in `tests/helpers.js`, `agenda: false` so it books nothing; restores the attendee's interests through the API afterwards); add the new route to the list at the bottom of `tests/api/endpoints.test.js`.
- Docs: `docs/context/ui.md` (switcher entry and dialog), `docs/context/agenda.md` (interests are now writable, still unread), `docs/context/architecture.md` route table.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Menu has `Your interests` that opens a modal | spec: open the switcher, click the entry, dialog visible | Playwright |
| Every topic tag is an `aria-pressed` toggle, current interests pressed | spec: count of toggles equals bootstrap topic tags; Jonas's seeded four are `aria-pressed=true`, the rest `false` | Playwright |
| Save writes; `GET /api/users/:id` returns it; survives reload | API: PUT then GET `interests` deep-equals the selection; spec: save, reload, toggles still pressed | API + Playwright |
| Deselect removes only that topic; none selected leaves it empty | API: PUT minus one leaves the others; PUT `[]` then GET gives `[]` | API |
| Cancel, Escape, outside click save nothing | spec: change a toggle, close each of the three ways, reopen, selection unchanged; GET unchanged | Playwright |
| 400 for an unknown topic; valid save covered | API: PUT `['Not A Topic']` is 400 and nothing is written; valid PUT is 200 | API |
| Usable at mobile width | spec (mobile project): last topic is reachable by scrolling the list, Save is within the viewport, `scrollWidth <= clientWidth` | Playwright |

## Decisions
- Is a PUT of the whole list (replace) at `/api/users/:id/interests` OK, rather than a per-topic PUT/DELETE like follows? Whole-list matches "saving writes the selection".
- Should a tag of a kind other than `topic` (tech, audience) in the request also be a 400? Yes: the ticket says "known topic tag".
- Should the modal show a toast on save? Yes, `Interests saved`, like follows.
- Should the entry show for every signed-in attendee, not only the Equal Experts hosts? Yes, it is in the menu whenever the menu renders.

## Out of scope
Recommending sessions from interests; showing interests on My Agenda or Home.
