# Let attendees choose their interests

## What this changes
The attendee menu gains a `Your interests` entry. It opens a modal listing every topic tag as a toggle button (`aria-pressed`), with the attendee's current interests already pressed. Save writes the selection through a new route and updates the store, so a reopened modal and a reload both show it. Cancel, Escape and an outside click close it and save nothing. Nothing else in the app reads interests yet.

## Where
- `server/routes/users.js` — new `PUT /:id/interests`, body `{ interests: string[] }`. 404 for an unknown attendee; 400 unless every entry is the `name` of a `kind = 'topic'` row in `tags` (prepared `topicNames` statement, checked against a Set); entries de-duplicated; stored as `interests.join(',')` (the format `toUser` already splits); responds with `toUser(row)`. Test in `tests/api/endpoints.test.js` (`startApi` gives a throwaway database): a valid save then `GET /users/:id` returns the list, deselecting one topic removes only it, an empty list leaves `[]`, an unknown topic and a non-array body are 400 and leave the stored value alone.
- `src/lib/api.js` — `saveInterests(userId, interests)`, the only caller of `fetch`.
- `src/lib/store.jsx` — `saveInterests(interests)`: calls the API, then replaces that user's row in `data.users` (bootstrap payload) so `currentUser.interests` is live; toasts on success and on failure, as `toggleFollow`/`reserveSeat` do.
- `src/components/InterestsDialog.jsx` (new) — modal modelled on `ConflictDialog.jsx` (focus in and back, body scroll lock, Escape, backdrop click closes). Topic tags come from `useConference().tags` filtered to `kind === 'topic'`. Local draft state starts from `currentUser.interests`. Chips wrap, the list scrolls inside a `max-h` body, and the footer with Cancel and Save stays outside the scroll area so Save is always visible.
- `src/components/UserSwitcher.jsx` — a `Your interests` button in the menu (beside `Your speaker profile`) that closes the menu and opens the dialog; the dialog is rendered by `UserSwitcher`, outside the `open` block.
- `tests/switcher.spec.js` — new tests; attendee per project (desktop `kenji`, mobile `marcus`), each restoring the original interests through `PUT` in a `finally`. They touch no seats or days, so no `LANES` entry is needed.
- `docs/context/ui.md` (switcher entry) and `docs/context/agenda.md` — mention the dialog and the route.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Menu has `Your interests` that opens a modal | open the switcher, click the entry, expect the dialog | spec (`switcher.spec.js`) |
| Every topic tag is a toggle with `aria-pressed`; current interests pre-selected | dialog has one button per `tags` topic from `/bootstrap`; the seeded attendee's seeded names are `aria-pressed="true"` | spec |
| Save writes; `GET /api/users/:id` returns it; survives reload | click a topic, Save, `GET` returns it; reload, reopen, still pressed | spec + API (`endpoints.test.js`) |
| Deselect removes only that topic; none selected leaves empty | API: save `[a,b]` then `[a]` gives `[a]`; save `[]` gives `[]` | API |
| Cancel, Escape, outside click save nothing | toggle, close each way, reopen and `GET` unchanged; app still usable | spec |
| 400 for an unknown tag; test covers valid save and rejection | API: `['Nope']` and a non-topic tag such as `Python` return 400, stored value unchanged | API |
| Usable at mobile width | mobile project: last topic scrollable into view, Save visible, `scrollWidth <= innerWidth` | spec (mobile project) |

## Decisions
- Is a topic tag that is not a topic (a `tech`, `audience` or `vibe` tag such as `Python`) a 400, rather than accepted? The ticket says "known topic tag".
- Is the interest list stored in the order sent, de-duplicated, rather than re-sorted into tag order?
- After Save, close the modal and show a toast, rather than staying open?
- Does a failed save keep the modal open with the selection so the attendee can retry?

## Out of scope
Using interests to recommend sessions, and showing them on My Agenda or Home.
