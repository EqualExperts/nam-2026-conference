# 27 — Don't send attendees to a session they are only waitlisted for

## What this changes

The **Right now** card on My Agenda (`next-up`) stops treating a waitlist place
as a seat. Deciding what is on now, what is next and how many are done today,
it only looks at sessions the attendee holds a **confirmed** seat in:

- A waitlisted session in the current slot is not shown as live; the card says
  "Nothing on right now." — or shows the confirmed session, if there is one.
- A waitlisted session is never the next one; the next confirmed session is.
- "N done today" (and "That is your day — N sessions done") counts confirmed
  sessions only.
- An attendee whose whole day is waitlisted gets "Nothing booked today."

Waitlisted sessions still appear everywhere else on My Agenda exactly as now
(day lists, the waitlisted tile, clashes). This brings the card in line with
the home page's `TodayPanel`, whose `/today` payload already counts confirmed
seats only.

## Where

- `src/lib/clock.js` — new pure `rightNow(sessions, nowHHMM, statusOf)` →
  `{ current, next, done }`. Keeps only sessions where
  `statusOf(s.id) === 'confirmed'`, sorts by start, then applies today's
  rules unchanged (`current`: `start <= now < end`; `next`: first
  `start > now`; `done`: count with `now >= end`). It lives beside
  `toMinutes`/`progressOf` so it can be unit-tested without a browser.
- `src/components/NextUpCard.jsx` — take `reservationFor` from
  `useConference()` and replace the inline `current`/`next`/`done` lines with
  `rightNow(today.sessions, clock.time, reservationFor)`. The store is the
  source of truth for reservation state (CLAUDE.md), not the `reservation`
  field the page was fetched with. Rendering is otherwise untouched: the
  "Nothing booked today." branch already fires when there is no current, no
  next and nothing done.

No API, server or `MyAgendaPage` change.

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Waitlisted session in the current slot is not live; confirmed one is, if any | `tests/unit/clock.test.js` › `rightNow` › "a waitlisted session in the current slot is not current" and "a confirmed session wins the slot over a waitlisted one" | unit (`npm test`) |
| Waitlisted session never next; next confirmed is | `tests/unit/clock.test.js` › `rightNow` › "a waitlisted session is skipped for next" (waitlisted 10:15, confirmed 11:30 → next is the 11:30) and "nothing confirmed ahead → next is null" | unit |
| "done today" counts confirmed only | `tests/unit/clock.test.js` › `rightNow` › "done counts confirmed sessions only" (one confirmed + one waitlisted finished → `done === 1`) | unit |
| Whole day waitlisted → "Nothing booked today" | `tests/unit/clock.test.js` › `rightNow` › "an all-waitlisted day has no current, no next, nothing done" — the condition `NextUpCard` renders as "Nothing booked today." | unit |
| A test covers waitlisted-now and waitlisted-next in the app | `tests/plan.spec.js` › "the Right now card ignores a waitlisted session in the current slot" and "… as the next session" | browser (`npm run verify`, desktop + mobile) |

The browser checks are **read-only** against seeded state, so they need no new
data lane (every free attendee/day pair is already taken or a fixture). The
seed queues Amara on Day 1 sessions in slots where she holds no seat. The test
reads `/users/2/schedule`, picks her first Day 1 waitlisted session, then
`visit('/my-agenda', { as: amara, at: momentOn(0, …) })`:

- **now** — clock pinned mid-way through that session: `next-up` contains
  "Nothing on right now." and does not contain its title.
- **next** — clock pinned 15 minutes before it starts (after anything earlier
  she holds has ended): `next-up` does not contain its title.

Both fail on `main` today. Which confirmed session is shown as next is proved
at the unit layer, not here: Amara's Day 1 `session.add` lane may briefly hold
an extra confirmed seat in another slot, so an exact-title assertion would race
it. That lane only books slots overlapping nothing she holds (`bookableFor`),
so it never touches the waitlisted slot these checks read.

## Decisions

- The rule is a pure function in `clock.js` rather than inline in the
  component, because the ticket's criteria are all about what counts, and that
  is provable in under a second without Playwright.
- The clash between current and next (the cross-site warning) keeps using
  the new `current`/`next`, so it too now ignores waitlist places — it is
  about where the attendee will actually walk.

## Out of scope

- The "Hours booked" tile (same shape of problem, its own ticket).
- The home page's `TodayPanel` — already correct.
- The API, `agenda.js` and how waitlists work.
