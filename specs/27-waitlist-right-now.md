# 27 — Don't send attendees to a session they are only waitlisted for

## What this changes

The **Right now** card at the top of My Agenda answers "where do I walk next?".
It currently treats a waitlist place exactly like a seat, so an attendee sitting
fourth in the queue for a full room is told they are in it — and walks across
the venue to be turned away at the door. The home page's Today panel already
draws the line correctly: `/today` builds `current`, `next` and `finished` from
confirmed seats only.

After this change the card considers only sessions the attendee holds a
**confirmed** seat in when deciding what is on now, what is next, and how many
are done today:

- a waitlisted session in the current slot no longer renders as live — the card
  shows *Nothing on right now*, or the attendee's confirmed session if they have
  one in that slot;
- a waitlisted session is never offered as *next*; the next confirmed session is,
  even if a queue place falls between the two;
- the *N done today* count counts confirmed sessions only;
- an attendee whose whole day is queue places falls into the card's existing
  empty branch and reads *Nothing booked today* — the same branch, unchanged;
- the cross-site travel warning follows, because it compares whatever the card
  chose as current and next.

A waitlisted session still appears everywhere else on My Agenda exactly as it
does today: in the day's list, in the clash banner, in the *On a waitlist* tile
and in the page description.

## Where

- `src/components/NextUpCard.jsx` — the one derivation at the top of the
  component. It already reads the store via `useConference()`; it takes
  `reservationFor` from there and keeps only `'confirmed'` sessions before
  picking current, next and done. Reading the store rather than the payload's
  `reservation` field is what makes the card settle correctly when a seat is
  taken or released without a reload.
- `tests/plan.spec.js` — the proof.
- `docs/context/agenda.md` — this is the gotcha that doc currently records, so
  it changes with the code.

Nothing else moves: no API change, no change to `agenda.js`, and no change to
how waitlists or promotion work.

## How it will be proved

Playwright, `tests/plan.spec.js`. This is a rendering rule inside a component
with no pure function under it, and the thing being asserted is what an attendee
reads on screen, so the browser is the cheap proof rather than the expensive one.

Two tests, both pinned with `visit(..., { at })` because the card is entirely
driven by the clock, and both against **Kenji on day 1**, whose seeded plan
already has the shape the ticket describes — a confirmed keynote at 08:00, a
queue place at 10:15, a seat at 11:30, a queue place at 13:30 and a seat at
17:15:

1. pinned inside the 10:15 slot — the card says *Nothing on right now*, does not
   name the waitlisted session, offers the 11:30 seat as next, and counts one
   session done (the keynote, not the queue place behind it). It also asserts the
   waitlisted session is still listed in the day below, so the fix cannot be
   read as "hide waitlisted sessions".
2. pinned in the gap after the 11:30 session ends — the next session named is
   the 17:15 seat, not the 13:30 queue place that falls between them.

Both read the plan from `GET /api/users/:id/schedule` and assert the fixture's
shape before asserting the UI, so a seed change fails them loudly instead of
letting them pass on a day that no longer proves anything. They book nothing and
release nothing, so they need no lane and no cleanup: the only writes any other
test makes to Kenji on day 1 are a queue place taken and given back by the
`seats.waitlist` lane, which is invisible to a card that now ignores queue
places.

## Decisions

- **The store, not the payload.** `reservationFor(id)` is the source of truth for
  the viewer's own reservation state (CLAUDE.md § There is exactly one action).
  The fetched `session.reservation` would be stale the moment someone releases a
  seat from the page, and the card sits directly above the rows that do that.
- **The empty day is the existing branch.** An attendee whose whole day is
  waitlisted now produces no current and no next, which is the *Nothing booked
  today* branch the card already had. No new state, no new copy.
- **The filter, not the render.** Filtering once, before current/next/done are
  derived, keeps the three answers consistent with each other — a card that
  hid the live row but still counted the queue place in *done* would be a
  different bug.

## Out of scope

- The **Hours booked** tile, which has the same shape of problem — it sums every
  reservation, queued or not. It is a separate ticket, and this change
  deliberately leaves the tile and the per-day hours heading alone so the two
  keep agreeing with each other.
- The home page's Today panel, which is already correct.
- Any change to the API, to `server/lib/agenda.js`, or to how waitlists and
  promotion work.
