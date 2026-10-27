# Let attendees choose their interests

## What this changes
The attendee menu gains a `Your interests` entry. It opens a modal listing every topic tag as a toggle button (`aria-pressed`), with the attendee's saved interests already selected. Save writes the selection to `users.interests`; Cancel, Escape or a click outside close it and save nothing. Nothing else reads interests yet.

## Where
- `server/routes/users.js` — new `PUT /:id/interests` taking `{ interests: string[] }`: 404 for an unknown attendee, 400 unless it is an array of strings that are all `kind = 'topic'` tag names (checked against a prepared `SELECT name FROM tags WHERE kind = 'topic'`), else de-duplicates, stores `join(',')` and returns `toUser(row)` (its `interests` mapped by the existing `toUser` in `server/lib/query.js`; no column or mapper change).
- `src/lib/api.js` — `saveInterests(userId, interests)`, a `PUT` through `api()`.
- `src/components/InterestsDialog.jsx` (new) — copies `ConflictDialog.jsx` per `docs/context/ui.md` § Dialogs: `createPortal` to `document.body`, `role="dialog"` named `Your interests`, backdrop `Close` button, panel `max-h-[85dvh]` with a scrolling topic list and Cancel/Save outside the scroll. Topics come from `useConference().tags` filtered to `kind === 'topic'`; on open it calls `api.getUser(currentUserId)` (`getUser` is already in api.js) so the selection is the stored one, not the stale bootstrap copy. A failed save keeps the dialog open and toasts.
- `src/components/UserSwitcher.jsx` — a `Your interests` button in the menu that closes the menu and opens the dialog (the dialog is rendered outside the menu's `ref`, so its clicks do not count as outside the menu).
- Tests: `tests/api/seats.test.js` is not touched; new `tests/api/interests.test.js` using `startApi()` from `tests/api/harness.js`. New `tests/interests.spec.js` using a new lane `interests.dialog` added to `LANES` in `tests/helpers.js` (restores what it saves).
- Docs: `docs/context/ui.md` (switcher, dialog), `docs/context/agenda.md` (the write route).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Menu has `Your interests` entry that opens a modal | `tests/interests.spec.js`: click entry, dialog named `Your interests` visible | browser |
| Every topic tag is a toggle with `aria-pressed`, current interests preselected | spec: seeded attendee's buttons from `GET /api/users/:id` are `aria-pressed=true`, count of buttons equals topic tags in bootstrap | browser |
| Save writes, `GET /api/users/:id` returns it, survives reload | API test: PUT then GET `interests` equals selection; spec: save, reload, still pressed | API + browser |
| Deselect removes only that topic; none selected leaves empty | API test: PUT subset then PUT `[]`, `interests` equals `[]` | API |
| Cancel, Escape, outside click save nothing | spec: three closes, then API `interests` unchanged | browser |
| 400 for non-topic tag; test covers valid save and rejection | API test: PUT with a track name and with a non-array returns 400, interests unchanged | API |
| Usable at mobile width, Save visible, no horizontal scroll | spec on the mobile project: Save in viewport, `scrollWidth <= clientWidth` | browser |

## Decisions
- Is an unknown or non-topic name rejected as a whole (400, nothing written) rather than the unknown names being dropped? Yes, the ticket says 400.
- Should the modal read the attendee's interests fresh from `GET /api/users/:id` when it opens, rather than from the bootstrap payload? Yes, since bootstrap is not refreshed after a save and reopening would show stale picks.
- Should an empty selection be a valid save? Yes, it stores an empty string.

## Out of scope
Using interests to recommend, and showing them on My Agenda or Home.
