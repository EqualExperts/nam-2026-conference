# 68 — toast after check-in and rating, and surface their failures

## What this changes

Checking in and rating a session, from `SessionPage`'s `<AttendancePanel>`, currently
happen silently: a click disables the button, the request runs, and the button
re-enables — nothing tells the attendee it worked, and a rejected request (the
409s `attendance.js` already returns for a closed check-in window, an
already-ended session, rating before checking in, or rating while the session
is still running) is an **unhandled promise rejection**, not a message.

After this change:

- Checking in shows a toast confirming it.
- Submitting a rating shows "Rating saved" the first time and "Rating
  updated" when the attendee edits it.
- A rejected check-in or rating shows a toast naming why (mapped from the
  same `rejected` reason the API already returns), the button goes back to
  its idle label, and nothing is logged as an unhandled rejection.

## Where

**`src/components/AttendancePanel.jsx`** — everything lives here; no route or
`server/lib/attendance.js` change.

- Import `useToast` from `./Toaster.jsx` (add to the block at lines 1–6) and
  call `const toast = useToast();` in `AttendancePanel`, next to `const
  [busy, setBusy] = useState(false);` (line 49) — the exact pattern
  `src/lib/store.jsx` already uses.
- Add a module-level map, next to the other top-level declarations (above
  `Stars`), from the `rejected` reason `attendance.js` puts on a 409 body to a
  short sentence:

  ```js
  const REJECTION_MESSAGES = {
    future: 'Check-in has not opened yet',
    past: 'This session has already finished',
    'not-checked-in': 'You need to check in before you can rate this',
    'too-early': 'You can rate this once the session ends',
  };
  ```

  (`future`/`past` are the check-in route's rejections; `not-checked-in`/
  `too-early` are the rating route's — see `docs/context/attendance.md`.
  `unknown` and anything else fall through to `err.message` below; the UI
  cannot trigger `unknown` since the clock is always present.)

- Rewrite `submit` (lines 64–67, currently `async (fn) => { setBusy(true);
  try { await fn(); reload(); } finally { setBusy(false); } }`) to take a
  second argument, the success message, and to catch the rejection instead of
  letting it escape:

  ```js
  const submit = async (fn, successMessage) => {
    setBusy(true);
    try {
      await fn();
      reload();
      toast({ message: successMessage, icon: 'check' });
    } catch (err) {
      toast({ message: REJECTION_MESSAGES[err.payload?.rejected] ?? err.message, icon: 'alert' });
    } finally {
      setBusy(false);
    }
  };
  ```

  `err.payload` is already set by `src/lib/api.js`'s `api()` on every non-ok
  response (it keeps the parsed body precisely so a 409's payload survives),
  so this needs no change there. `finally` already runs on the thrown path
  today, which is why the button already returns to its idle label — the bug
  is only the missing `catch` and the missing toasts.

- Check-in button's `onClick` (line 97): pass `'Checked in'` as the second
  argument — `submit(() => api.checkIn(currentUserId, session.id, clock), 'Checked in')`.
- Submit-rating button's `onClick` (lines 143–147): pass
  `data.myRating ? 'Rating updated' : 'Rating saved'` — read from `data.myRating`
  *before* the call (it already drives the button's own "Submit rating"/
  "Update rating" label, so this is the same value, not a new lookup).

**`docs/context/attendance.md`** — the "Client." paragraph says the panel
"calls `reload()` after each write" and stops there; add one sentence after
it: the panel also toasts a success message ("Checked in", "Rating
saved"/"Rating updated") and, on a rejected write, a message from
`REJECTION_MESSAGES` (falling back to the raw error).

**`tests/helpers.js`** — two new `LANES` rows, next to `'agenda.next-up-done'`
(line 129), one per new test below (check-in and rating each burn a real,
un-undoable check-in, so they need attendees/days nothing else in this file
uses on day index 2):

```js
'attendance.checkin-toast': { desktop: { user: kenji, day: 2 },  mobile: { user: amara, day: 2 } },
'attendance.rating-toast':  { desktop: { user: marcus, day: 2 }, mobile: { user: priya, day: 2 } },
```

**`tests/attendance.spec.js`** — two new tests inside `describe('Check in and
rate', ...)`, after the existing rating tests. Both use `laneFor`, `momentOn`
is not needed since `laneFor` already resolves `day` to a real date — build
`at` as `` `${day}T${time}` `` directly, the way `visit`'s callers elsewhere in
this file do. Both use `failOnPageErrors(page)` (imported already via the
existing `helpers.js` import line) and assert the collected array is empty at
the end — that is the "no unhandled promise rejection is logged" check, since
an unhandled rejection surfaces to Playwright as a `pageerror`.

1. `'checking in toasts a confirmation, and a rejected check-in toasts instead of throwing'`:
   - `const { user, day } = await laneFor('attendance.checkin-toast', testInfo);`
   - Fetch `GET /users/:user` for `checkIns`, `GET /sessions?day=` for the day,
     and pick the first non-keynote, non-`Social` session this attendee has
     not checked into (same filter `tests/attendance.spec.js` already uses in
     `'checking in unlocks rating'`); `test.skip` if none is left.
   - `await visit(page, `/sessions/${target.id}`, { as: user, at: `${day}T${target.startsAt}` })` —
     inside the check-in window (`running`), so `check-in` renders.
   - Intercept the write once and force a rejection first, to prove the
     failure path without waiting for a real window to close:
     ```js
     await page.route(`**/api/users/${user}/checkins/${target.id}`, async (route) => {
       await page.unroute(`**/api/users/${user}/checkins/${target.id}`);
       await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ rejected: 'future' }) });
     });
     ```
   - Click `check-in`; assert `page.getByTestId('toaster')` contains
     "Check-in has not opened yet" and `check-in` still reads "Check in" (not
     stuck on "Checking in…").
   - Click `check-in` again (now unrouted, so the real request runs); assert
     the toaster contains "Checked in" and `checked-in` becomes visible.
   - Assert `errors` (from `failOnPageErrors`) is empty.

2. `'rating toasts Rating saved, then Rating updated, and a rejection toasts too'`:
   - `const { user, day } = await laneFor('attendance.rating-toast', testInfo);`
   - Pick an un-checked-in, non-keynote/`Social` session the same way, then
     check the attendee in for real over the API before visiting, so the page
     loads already past the check-in step:
     `await request.put(`${API}/users/${user}/checkins/${target.id}`, { data: { day, time: target.startsAt } });`
   - `await visit(page, `/sessions/${target.id}`, { as: user, at: `${day}T23:59` })` —
     well past the end, so `rating-form` renders with no saved rating yet.
   - Click a star (e.g. the 4-star radio via the same `getByRole('radio', {
     name: ... })` pattern the existing "editing a rating" test uses) and
     `submit-rating`; assert the toaster contains "Rating saved".
   - Click a different star and `submit-rating` again; assert the toaster
     contains "Rating updated".
   - Force one more rejection the same way as test 1, this time on
     `**/api/users/${user}/ratings/${target.id}` with body
     `{ rejected: 'not-checked-in' }`, click `submit-rating`, and assert the
     toaster contains "You need to check in before you can rate this" and
     `submit-rating` reads "Update rating" again (not stuck on "Saving…").
   - Assert `errors` is empty.

No change to `server/lib/attendance.js`, `server/routes/users.js`, or
`src/lib/api.js` — `err.payload` is already populated there.

## How it will be proved

Layer: Playwright (`tests/attendance.spec.js`) — this is UI feedback with no
pure-function shape, and the repo has no component-level unit test harness
(`tests/unit/` is pure functions only, confirmed by its file list).

Confirmed against `main` before writing this spec, by reading
`AttendancePanel.jsx`: it imports no `useToast` and calls no `toast(...)`
anywhere, and `submit` has no `catch`, so today:

| Assertion | Today (`main`) | After |
| --- | --- | --- |
| Checking in shows a toast in `data-testid="toaster"` | never — no toast call exists | shows "Checked in" |
| First rating submit shows "Rating saved"; an edit shows "Rating updated" | never — no toast call exists | shows the right one each time |
| A rejected check-in/rating shows a toast with a message | never | shows the mapped `REJECTION_MESSAGES` string |
| The click that threw is an unhandled rejection | yes — `submit`'s `catch`-less `try` lets `fn()`'s rejection escape past an un-awaited `onClick` handler | none — caught and toasted |
| The button returns to its idle label after a rejection | already true (`finally` already runs on the thrown path) | unchanged — included in the same test so a future regression here is caught by the same assertion, not claimed as new |

## Decisions

- The check-in/rating success strings ("Checked in", "Rating saved", "Rating
  updated") and the four `REJECTION_MESSAGES` sentences aren't specified by
  the ticket; they're fixed here so the test asserts an exact string rather
  than "the toaster is non-empty," and so the builder isn't the one inventing
  copy.
- Failures are mapped client-side from the `rejected` value already on the
  error payload, rather than adding an `error` string to the 409 bodies in
  `server/lib/attendance.js`/`routes/users.js`. The ticket's own framing ("in
  `AttendancePanel.jsx`, `submit`... no `catch`") points at the component, the
  response shape is already documented and tested elsewhere
  (`tests/api/attendance.test.js`, `tests/api/ratings.test.js`), and changing
  it would touch routes, the attendance doc's payload description, and those
  tests for no behaviour the ticket asks for.
- The rejection tests force the 409 with `page.route`/`fulfill` rather than
  waiting for a real window to close or racing the clock — the ticket's own
  example ("a 409 because the clock moved past the window") is exactly this
  shape, and a timing-dependent trigger would be flaky under `fullyParallel`.

## Out of scope

- Any change to `attendanceWindow`, `checkIn`, `rateSession`, or the routes —
  their rejection reasons and shapes are unchanged.
- A message for the `unknown` check-in rejection (the UI cannot produce it,
  since the clock is always sent) — falls through to `err.message`.
- Toasting other `AttendancePanel` states (e.g. the "missed" message) — not
  a write, so nothing is silent there today.
