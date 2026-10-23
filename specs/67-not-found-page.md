# 67 — a real not-found page for unknown session and speaker ids

## What this changes

`/sessions/999999` and `/speakers/:id` for an id that does not exist both call
their API, get a 404, and today land on `ErrorState`: heading "That did not
load", the JSON error message as the description, and a "Try again" button —
the same page an attendee would see if the API was actually broken. Retrying a
404 can never succeed, and there is no way back to a page that will.

After this change, an unknown id shows a dedicated not-found state: heading
"Session not found" / "Speaker not found", no "Try again" button, and a link
back to `/schedule` or `/speakers`. The browser tab reads "Not found · ORBIT
'26". A genuine failure (500, network error) is untouched — it still shows
`ErrorState` with "Try again", because that one *can* succeed on retry.

## Where

- **`src/components/ui.jsx`** — add `NotFoundState({ title, backTo,
  backLabel })` next to `ErrorState` (around line 207): an `EmptyState` with
  `icon="search"` and a `Button variant="primary" size="sm" to={backTo}`
  action. Same shape as the existing `ErrorState` wrapping `EmptyState`, just
  with a link instead of a retry button.

- **`src/pages/SessionPage.jsx`** — `SessionPage` (~line 44). `api.getSession`
  already throws with `.status` set from the response (`src/lib/api.js`'s
  `api()`), so `useFetch`'s `error` is that thrown `Error` on a 404. Add
  `const notFound = error?.status === 404;`, change the
  `useDocumentTitle(session?.title)` call to
  `useDocumentTitle(notFound ? 'Not found' : session?.title)` (mirrors
  `NotFoundPage.jsx`, which already sets the tab title this way), and insert
  `if (notFound) return <NotFoundState title="Session not found" backTo="/schedule" backLabel="Browse the schedule" />;`
  before the existing `if (error) return <ErrorState .../>`. Replace the
  trailing `if (!session) return <EmptyState title="Session not found" />;`
  with the same `NotFoundState` call, for the case the API ever returns an
  empty body instead of throwing. Import `NotFoundState` from `ui.jsx`.

- **`src/pages/SpeakerPage.jsx`** — `SpeakerPage` (~line 26). Identical
  pattern: `notFound = error?.status === 404`,
  `useDocumentTitle(notFound ? 'Not found' : speaker?.name)`, insert
  `if (notFound) return <NotFoundState title="Speaker not found" backTo="/speakers" backLabel="All speakers" />;`
  before `if (error) return <ErrorState .../>`, and replace the trailing
  `if (!speaker) return <EmptyState title="Speaker not found" />;` the same
  way.

- **Tests** — no lane needed; these are read-only GETs against a fixed,
  out-of-range id (`999999`, well above the seed's ~140 sessions / 110
  speakers), so any attendee works and there is nothing to clean up.
  - `tests/session.spec.js`, in `describe('Session detail')`: a test that
    `visit(page, '/sessions/999999')`, asserts the heading reads "Session not
    found" (`getByRole('heading', { name: 'Session not found' })`), that no
    "Try again" button exists (`getByRole('button', { name: 'Try again' })`
    not visible), that a link back to `/schedule` is present
    (`getByRole('link', { name: 'Browse the schedule' })`), and
    `page.title()` is `"Not found · ORBIT '26"`. A second test uses
    `page.route('**/api/sessions/1**', route => route.fulfill({ status: 500,
    contentType: 'application/json', body: '{"error":"boom"}' }))` before
    `visit(page, '/sessions/1')`, then asserts `ErrorState`'s "Try again"
    button is still there (`getByRole('button', { name: 'Try again' })`).
  - `tests/speakers.spec.js`, in `describe('Speakers')`: the same pair for
    `/speakers/999999` (heading "Speaker not found", link "All speakers") and
    a mocked 500 on `**/api/speakers/1**` for `/speakers/1`.

## How it will be proved

| Check | Layer | False on main today because |
| --- | --- | --- |
| `/sessions/999999` shows heading "Session not found", no "Try again" button, a link to `/schedule`, and `document.title === "Not found · ORBIT '26"` | `tests/session.spec.js` (Playwright) | main renders `ErrorState`'s heading "That did not load" with a "Try again" button instead, and leaves the tab title at whatever it was before navigating (`useDocumentTitle(session?.title)` no-ops on a falsy title) |
| `/speakers/999999` shows heading "Speaker not found", no "Try again" button, a link to `/speakers`, and the same tab title | `tests/speakers.spec.js` (Playwright) | same reason, `SpeakerPage` has the identical bug |
| A mocked 500 on `/sessions/1` still shows a "Try again" button | `tests/session.spec.js` (Playwright) | passes on main too (it's the *unchanged* path), but it is added here so the 404 branch added above cannot swallow it — it must keep failing if `notFound` is ever made too broad (e.g. `error` truthy instead of `error?.status === 404`) |
| A mocked 500 on `/speakers/1` still shows a "Try again" button | `tests/speakers.spec.js` (Playwright) | same, for `SpeakerPage` |

`npm test` has no unit/API layer for this — the routes already return the
right 404 status and body (`server/routes/sessions.js`, `server/routes/speakers.js`,
unchanged); the bug is entirely in how the two pages render an `error` they
already receive, which only a browser test observes.

## Decisions

- Reused `NotFoundState` across both pages rather than writing the not-found
  markup twice inline — `ui.jsx` already holds the one other shared
  not-found-shaped component (`EmptyState`/`ErrorState`), and CLAUDE.md's UI
  doc names it as the place for "a new primitive used by more than one page".
- Left `src/pages/NotFoundPage.jsx` (the `*` route for an unmatched URL, e.g.
  `/nonsense`) untouched — it already shows its own heading with no "Try
  again" button and already sets the tab title to "Not found"; the ticket is
  about the two data-fetching detail pages, not the router's catch-all.
- The trailing `if (!session)` / `if (!speaker)` guards are dead code today
  (a 404 always arrives as a thrown `error`, never a falsy body), but kept as
  a defensive fallback and pointed at the same `NotFoundState` rather than
  removed, since deleting them is unrelated to this ticket.

## Out of scope

- Any change to the API's 404 shape or status code — both already return
  `404 { error: '… not found' }` and are untouched.
- `NotFoundPage.jsx` (the catch-all route).
