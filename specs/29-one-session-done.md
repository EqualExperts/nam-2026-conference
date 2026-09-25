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
  day index 2, mobile Marcus on day index 2, both `clean: true`. The seed books
  neither attendee anything that day, and no other lane or read-only fixture
  uses either pair.
- `tests/plan.spec.js` — one new test in the `My Agenda` describe.

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| One done, nothing else today → "1 session done" | `plan.spec.js` › "the end-of-day card counts one session in the singular": book the first `bookableFor` session on the lane's day, `visit('/my-agenda', { at: momentOn(2, '22:00') })`, expect `next-up` to contain "1 session done" and not "1 sessions" | Playwright, desktop + mobile |
| Two or more → "N sessions done" | Same test, continued: book a second `bookableFor` session in a different slot, reload, expect "2 sessions done" | Playwright, desktop + mobile |
| "· N done today" note | No change needed; see Decisions. Existing suite stays green | `npm run verify` |
| A test covers the one-session case | The test above; `plural(1, 'session')` itself is already pinned in `tests/unit/format.test.js` | Playwright + unit |

The test clears the lane's day with `clearAgendaFor` before and after, which
the `clean` lane allows. Both bookings are made through the API with no clock,
on a future day, so neither the ended guard nor the overlap guard fires. Run
first against the unchanged component to see it fail on "1 sessions done".

## Decisions

- **The "· N done today" note is left alone.** It carries no noun, so
  "· 1 done today" already reads correctly; the ticket allows leaving it.
- **One test, not two.** The one- and two-session cases share a lane and run
  in sequence inside one test, because tests in a file run in parallel and two
  tests on one lane would race on the same agenda.
- **Browser layer, not unit.** The sentence lives inside a JSX component that
  `node --test` cannot import, and the ticket asks for the existing helper
  rather than a new one, so there is no pure function to unit-test beyond
  `plural`, which is already covered.

## Out of scope

Any other wording on the card; the home page's Today panel.
