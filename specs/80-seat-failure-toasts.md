# Surface failures when booking or removing a seat

## What this changes
When reserving or releasing a seat fails (server error, dropped connection), the attendee now sees an error toast and the button works again on the next click. Today `reserveSeat` rethrows any non-409 error into an unhandled rejection and `releaseSeat` has no handling at all, so the button just appears dead. A 409 still opens the conflict dialog; the `ended` rejection still toasts as before.

## Where
- `src/lib/store.jsx` — `reserveSeat`: rethrow of non-409 errors becomes a toast (`icon: 'alert'`) and a return, before `state` is read; `releaseSeat`: wrap `api.releaseSeat` in try/catch with the same toast. Follow the `catch` in `src/components/AttendancePanel.jsx` (~line 83). `applySeatState` only runs after success, so counts and agenda stay untouched on failure.
- `tests/seats.spec.js` — new test using a new lane `seats.failure-toast` added to `LANES` in `tests/helpers.js` (pick an attendee, day and distinct slot no other pane holds; `tests/unit/lanes.test.js` checks it), with `openSessionFor`, `visit`, `failOnPageErrors`, and `page.route('**/api/users/<user>/reservations/<id>', …, { times: 1 })` fulfilling 500 as `tests/attendance.spec.js` does for check-in. Release the seat the test books.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Failed reservation shows an error toast | Route PUT to 500 once, click `reserve-seat`; toaster contains the error text, no page error (main: unhandled rejection, no toast) | spec |
| Failed release shows an error toast | Book via API, route DELETE to 500 once, click `release-seat`; toaster contains the error text, no page error | spec |
| 409 still opens the conflict dialog | Existing `conflict.ui` spec in `tests/seats.spec.js`/conflict tests keeps passing; unchanged | spec |
| Neither failure shows a change that did not happen | After each failed click, `seat-count` is unchanged and the button is still `reserve-seat` / `release-seat`; the second click succeeds | spec |

## Decisions
- Criterion 3 and the "no change shown" criterion already hold on main (state is applied only after the API call resolves; the 409 branch is untouched). Is it OK that this build proves them as regression checks next to the new toasts rather than as new behaviour?
- Show the server's `err.message` in the toast, prefixed by what failed ("Could not book that seat: …", "Could not remove that seat: …"), as the swap path does — OK?
- On failure `reserveSeat`/`releaseSeat` resolve to `undefined` instead of throwing; no caller reads the return value — OK?

## Out of scope
The swap path (`confirmSwap`) already toasts its failures. No change to the API or to the 409 and `ended` handling.
