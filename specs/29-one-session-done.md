# 29 — Say "1 session done", not "1 sessions done", on the Right now card

## What this changes

At the end of an attendee's day, with nothing left booked, the Right now card
on My Agenda (`next-up`) reads "That is your day — 1 session done. Nothing else
booked today." instead of "1 sessions done". Two or more still read
"N sessions done". Nothing else on the card changes.

## Where

- `src/components/NextUpCard.jsx` — the end-of-day sentence builds its count
  with the existing `plural(done, 'session')` from `src/lib/format.js` instead
  of the hard-coded `${done} sessions`. Import `plural` alongside `time`.
- `tests/helpers.js` — a new data lane `agenda.oneDone`: desktop Kenji on
  day index 2, mobile Marcus on day index 2, both `clean: true`, with
  `slot: '17:15'`. The seed books neither attendee anything that day, and no
  other lane or read-only fixture uses either pair. Day index 2 belongs to the
  seat-counting `slot` lanes, which own 09:00, 10:15, 11:30, 13:30, 14:45 and
  16:00; 17:15 is the one regular slot of the seven none of them owns, so this
  lane books only there and its `slot` records that. The `LANES` comment's
  "no other lane books anything on day 3" becomes "no other lane books in
  those slots on day 3; `agenda.oneDone` books only at 17:15".
- `tests/plan.spec.js` — one new test in the `My Agenda` describe.

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| One done, nothing else today → "1 session done" | `plan.spec.js` › "the end-of-day card counts one session in the singular": from `bookableFor` on the lane's day take the first session with `startsAt === lane.slot` (17:15) and seats left, book it, `visit('/my-agenda', { at: momentOn(2, '22:00') })`, expect `next-up` to contain "1 session done" and not "1 sessions" | Playwright, desktop + mobile |
| Two or more → "N sessions done" | `plan.spec.js` › "the end-of-day card still counts several sessions in the plural": read-only, no booking. Jonas on day index 0 (the home-page fixture, which nothing writes to) at `momentOn(0, '22:00')`; N is read from `/users/:id/schedule` for that day (the seed gives him four), the test asserts N ≥ 2 and that every one has ended by 22:00, then expects `next-up` to contain "N sessions done" | Playwright, desktop + mobile |
| "· N done today" note | No change needed; see Decisions. Existing suite stays green | `npm run verify` |
| A test covers the one-session case | The test above; `plural(1, 'session')` itself is already pinned in `tests/unit/format.test.js` | Playwright + unit |

The one-session test clears the lane's day with `clearAgendaFor` before and
after, which the `clean` lane allows; the day is empty for the attendee, so
the clear only ever releases a 17:15 seat this test took. The booking is made
through the API with no clock, on a future day, so neither the ended guard nor
the overlap guard fires. Run
first against the unchanged component to see it fail on "1 sessions done".

## Decisions

- **The "· N done today" note is left alone.** It carries no noun, so
  "· 1 done today" already reads correctly; the ticket allows leaving it.
- **The one-session case books only at 17:15.** Day index 2 is the only day
  Kenji and Marcus are both free on and not held by `conflict.ui` (Kenji and
  Amara on index 3) or the empty-day fixture (Marcus on index 3), but the
  seat-counting lanes own six of its seven slots. Booking in the seventh
  cannot move any counter they read, because they count only sessions that
  start in their own slot.
- **The plural case reads a seeded day instead of booking a second session.**
  With one free slot on the lane's day there is nowhere to book a second
  non-overlapping session without entering a slot lane's slot. A seeded
  attendee whose day has already ended shows the plural wording with no
  writes at all, so it needs no lane and cannot race anything.
- **Browser layer, not unit.** The sentence lives inside a JSX component that
  `node --test` cannot import, and the ticket asks for the existing helper
  rather than a new one, so there is no pure function to unit-test beyond
  `plural`, which is already covered.

## Out of scope

Any other wording on the card; the home page's Today panel.
