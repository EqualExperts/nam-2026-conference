# Let attendees choose their interests

## What this changes
The attendee menu gains a `Your interests` entry. It opens a modal (a bottom sheet on a phone) listing every topic tag as a toggle chip (`aria-pressed`), with the attendee's current interests already pressed. Save writes the selection and closes; Cancel, Escape and an outside click close without saving. Nothing is shown anywhere else yet: My Agenda and Home are out of scope.

## Where
- `server/routes/users.js` — new `PUT /:id/interests` beside the follows routes. Body `{ interests: string[] }` of topic tag names. 404 for an unknown attendee; 400 if the body is not an array of strings or any name is not a `tags` row with `kind = 'topic'`. Dedupes, writes `users.interests` as the comma-joined list, returns `{ interests }` (read back through `toUser`). An empty array writes `''`. Tag names hold no commas (read off the seed's `TAGS.topic`).
- `src/lib/api.js` — `saveInterests(userId, interests)`, a `PUT` like `followSpeaker`; the only caller of `fetch`.
- `src/lib/store.jsx` — `saveInterests(interests)` calls the api, then patches the matching user in `data.users`, so `currentUser.interests` is current when the dialog reopens without a reload (the bootstrap payload is otherwise stale, as with seats).
- `src/components/InterestsDialog.jsx` (new) — follows `docs/context/ui.md` § Dialogs: `createPortal` to `document.body`, `role="dialog"` named `Your interests`, backdrop `Close` button, panel `max-h-[85dvh]` with the chip list scrolling and the Save/Cancel row outside the scroll, Escape and focus handled in one effect. Topics come from `useConference().tags` filtered to `kind === 'topic'`. A failed save keeps the dialog open and toasts the error.
- `src/components/UserSwitcher.jsx` — a `Your interests` button in the menu (near `own-speaker-profile`) that closes the menu and opens the dialog; the dialog is rendered outside the menu's `div` so closing the menu does not unmount it.
- Tests: `tests/api/interests.test.js` with `startApi()` and a throwaway database (no lane needed); `tests/interests.spec.js` with `laneFor('interests.dialog', testInfo)` and `visit(page, '/', { as: lane.user })`, one test for seeded selection, the three closes, and a save that survives `page.reload()`, per `docs/context/testing.md` § Testing a dialog.
- Docs: `docs/context/ui.md` (the switcher entry and dialog) and `docs/context/agenda.md` (the interests route).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Menu has `Your interests` that opens a modal | `getByRole('button', { name: 'Your interests' })` opens `getByRole('dialog', { name: 'Your interests' })` | browser (`tests/interests.spec.js`) |
| Every topic tag is an `aria-pressed` toggle, current interests pressed | chip count equals the topic tags from `/api/bootstrap`; the seeded attendee's interests are `aria-pressed="true"`, the rest `false` | browser |
| Save writes, `GET /api/users/:id` returns it, survives reload | PUT then GET equals the selection; after `page.reload()` the chips are still pressed | API (`tests/api/interests.test.js`) and browser |
| Deselect removes only that topic; none leaves empty | save the seeded set minus one, assert exactly that one is gone; save `[]`, assert `interests` is `[]` | API |
| Cancel, Escape, outside click save nothing | toggle a chip, close each way, reopen: unchanged; `GET` unchanged | browser |
| 400 for a non-topic tag; valid save covered | PUT `['Not A Topic']` and a tech-tag name give 400 and leave `interests` as it was; a valid PUT gives 200 | API |
| Usable at mobile width | on the mobile project, the last chip can be scrolled into view and Save is in the viewport, with no horizontal scroll (`scrollWidth <= clientWidth`) | browser (mobile project) |

## Decisions
- Store interests by tag name (what the seed holds today and what `toUser` returns), not by slug — OK?
- Saving a stored interest that is not a topic tag drops it, since the dialog cannot show it (the seed holds every attendee to topic tags) — OK?
- A failed save keeps the dialog open with an error toast so the attendee can retry — OK?

## Out of scope
Using interests to recommend sessions, and showing them on My Agenda or Home.
