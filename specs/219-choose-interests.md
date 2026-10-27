# Let attendees choose their interests

## What this changes
The attendee menu gains a `Your interests` entry. It opens a modal listing every
topic tag as a toggle button (`aria-pressed`), the attendee's current interests
already pressed. Save writes the selection; Cancel, Escape and a click outside
close it and write nothing. On a phone the modal is a bottom sheet with the Save
button always on screen. Nothing reads interests yet (My Agenda and Home are out of scope).

## Where
- `server/routes/users.js` — new `PUT /:id/interests`, body `{ interests: string[] }`. 404 for an unknown user; 400 unless `interests` is an array of known topic names (`tags` where `kind = 'topic'`, matched by `name`, the form `users.interests` already holds). Duplicates are collapsed; the row is written as `join(',')`; responds with `toUser(row)`. No mapper change: `toUser` already splits the column.
- `src/lib/api.js` — `saveInterests(userId, interests)` (`PUT /users/:id/interests`).
- `src/lib/store.jsx` — `saveInterests(list)` in `useConference()`: calls the api, then replaces the signed-in user inside `data.users` with the response, so `currentUser.interests` is the store's truth with no refetch (the dialog reopens correctly and the choice survives a reload because `/bootstrap` reads the column).
- `src/components/InterestsDialog.jsx` (new) — copies `ConflictDialog.jsx` per `docs/context/ui.md` § Dialogs: `createPortal` to `document.body`, `role="dialog"` named `Your interests`, backdrop `Close` button, panel `max-h-[85dvh]` with a scrolling chip body and Save/Cancel outside the scroll, Escape and focus in one effect. Topics come from `useConference().tags` filtered to `kind === 'topic'`; initial selection is `currentUser.interests`. A failed save keeps the dialog open and shows the error inline so it can be retried.
- `src/components/UserSwitcher.jsx` — a `Your interests` button in the menu (own section, like `Your speaker profile`); its open state lives outside the `{open && …}` menu so closing the menu does not unmount the dialog.
- Tests: `tests/api/interests.test.js` (new, `startApi()` from `tests/api/harness.js`, own throwaway database); add `'PUT users/:id/interests'` to `covered` in `tests/api/endpoints.test.js`. Browser: one test in `tests/switcher.spec.js` using a new lane `switcher.interests` in `tests/helpers.js` `LANES` (`agenda: false`, so it books nothing; keep `tests/unit/lanes.test.js` green) that restores the interests it changes.
- Docs: `docs/context/agenda.md` (the endpoint), `docs/context/ui.md` (switcher entry and dialog).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Menu has `Your interests` that opens a modal | `getByRole('button', { name: 'Your interests' })` opens `getByRole('dialog', { name: 'Your interests' })` | browser |
| Modal lists every topic as a toggle with `aria-pressed`, current interests pressed | seeded attendee's seeded topics have `aria-pressed="true"`, a non-interest `false`; chip count equals the bootstrap topic count | browser |
| Saving writes it; `GET /api/users/:id` returns it; survives reload | `PUT` then `GET /users/:id` `interests` equals the selection (API); toggle, Save, reload, chip still pressed (same browser test) | API + browser |
| Deselecting removes only that topic; none selected leaves `interests` empty | PUT of the seeded set minus one yields exactly the rest; PUT `[]` yields `[]` | API |
| Cancel, Escape, outside click save nothing; app unaffected | toggle a chip then close each of the three ways, reopen: unchanged; `GET /users/:id` unchanged | browser |
| 400 for an unknown topic; test covers a valid save and the rejection | PUT `['Not A Topic']` and a non-topic tag (a `tech` tag name) give 400 and leave the row untouched; valid save returns 200 | API |
| Usable at mobile width: all topics reachable, Save visible, no horizontal scroll | on the `mobile` project: Save is in the viewport, last chip scrolls into view, `scrollWidth <= clientWidth` | browser |

## Decisions
- A saved selection replaces the whole column, so any value in it that is not a topic tag would be dropped on save. The seed holds only topics, so none exists today; the dialog does not preserve non-topics. OK?
- Save is always enabled, including with nothing changed or nothing selected (the ticket allows an empty save). OK?
- A failed save keeps the dialog open with an inline error rather than a toast, so the choice is not lost. OK?
- Topic names are sent and stored (the form the column holds), not slugs. OK?
- The dialog closes on a successful save with no success toast. OK?

## Out of scope
Using interests to recommend sessions, showing them on My Agenda or Home, and any schema or seed change.
