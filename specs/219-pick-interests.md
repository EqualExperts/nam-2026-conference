# Let attendees choose their interests

## What this changes
The attendee menu (the switcher dropdown) gains a `Your interests` entry. It opens a modal listing every topic tag as a toggle chip (`aria-pressed`), the attendee's current interests already pressed. Save writes the selection to `users.interests`; Cancel, Escape and an outside click close it and save nothing. Nothing else in the app reads interests yet.

## Where
- `server/routes/users.js` — new `PUT /:id/interests` (body `{ interests: string[] }`): 404 for an unknown attendee, 400 if `interests` is not an array or any entry is not the name of a `tags` row with `kind = 'topic'`; otherwise dedupes, writes the comma-joined list (empty array -> `''`) and responds with `toUser(row)`. Prepare the `UPDATE` and a `SELECT name FROM tags WHERE kind='topic'` next to the other statements at the top.
- `src/lib/api.js` — `saveInterests(userId, interests)` -> `PUT /users/:id/interests` (the only `fetch` caller).
- `src/lib/store.jsx` — `saveInterests(interests)` on `useConference()`: calls the api, then replaces the user in `data.users` with the response so `currentUser.interests` is true without a refetch.
- `src/components/InterestsDialog.jsx` (new) — modelled on `ConflictDialog.jsx` (focus in, body scroll lock, Escape, backdrop button, `place-items-end sm:place-items-center`). Chips come from `useConference().tags` filtered to `kind === 'topic'`; the chip area scrolls (`max-h`, `overflow-y-auto`) while the header and the Save/Cancel footer stay pinned, so Save is visible at 390px. A failed save keeps the dialog open and toasts.
- `src/components/UserSwitcher.jsx` — a `Your interests` button (`data-testid="open-interests"`) beside the speaker-profile link; it closes the menu and opens the dialog. The dialog renders outside the menu's `ref` so the menu's outside-pointer handler does not fire on it.
- Tests: `tests/api/users-interests.test.js` (new, `startApi()` from `tests/api/harness.js`, no lane needed) and `tests/interests.spec.js` (new, Playwright; `visit`, `ATTENDEES`, a new `interests.modal` entry in `LANES` in `tests/helpers.js` giving each project its own attendee, `agenda: false` — check `tests/unit/lanes.test.js` for the collision rule). The spec restores the attendee's seeded interests in `afterEach` via the API.
- Docs: `docs/context/ui.md` (switcher + dialog), `docs/context/seats.md` (the `/api/users` route list, if it enumerates routes), `tests/api/endpoints.test.js` route list (it must name the new route).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Menu has `Your interests`, opens a modal | open the menu, click the entry, expect the dialog visible | Playwright spec |
| Every topic tag is an `aria-pressed` toggle, current interests pressed | count chips equals `tags` of kind topic; Kenji's seeded interests (read from `GET /users/3`) are pressed, others not | Playwright spec |
| Save writes; `GET /users/:id` returns it; survives reload | toggle, Save, API read matches, reload and reopen shows it pressed | Playwright spec + API test |
| Deselecting removes only that topic; none selected leaves `[]` | PUT a list minus one -> GET returns the rest; PUT `[]` -> `interests` is `[]` | API test |
| Cancel, Escape, outside click save nothing | toggle, close each way, API read unchanged, reopen shows seeded state | Playwright spec |
| 400 for an unknown topic; valid save covered | PUT `{interests:['Not A Topic']}` -> 400 and stored value unchanged; PUT a valid list -> 200 | API test |
| Usable at mobile width | on the mobile project: last chip scrolls into reach, Save is in the viewport, `scrollWidth <= clientWidth` | Playwright spec (mobile project) |

All rows are false on main today: the route, the entry and the modal do not exist.

## Decisions
- Saving replaces the whole field with the selection, so a stored value that is not a topic tag is dropped on save (the seed only writes topics, so none exist today) — OK?
- A failed save keeps the dialog open with an error toast, so the choice is not lost — OK?
- The route answers with the full user (`toUser`) and the store swaps it into `users`, rather than the page refetching — OK?
- Unknown attendee is 404 and a non-array body is 400, in line with the neighbouring routes — OK?

## Out of scope
Using interests to recommend sessions; showing them on My Agenda or Home; any schema or seed change.
