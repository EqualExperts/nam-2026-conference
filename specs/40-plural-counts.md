# 40 — Say "1 seat", "1 session" and "1 speaker", not "1 seats", "1 sessions", "1 speakers"

## What this changes

Three places already say the right thing when a count is not one, and read
wrong the moment it is:

- The seat panel on a session's page (`SeatPanel`) says "1 seats left" instead
  of "1 seat left".
- The **Right now** card on My Agenda (`NextUpCard`) says "That is your day —
  1 sessions done." instead of "1 session done."
- The home page's "From speakers you follow" section says "1 speakers
  followed" instead of "1 speaker followed".

`src/lib/format.js` already exports `plural(n, one, many?)` for exactly this —
`SessionCard`'s own seat count and `TodayPanel`'s "session(s) done" copy
already use it correctly. These three call sites just interpolate the count
and a hard-coded plural noun instead of calling it.

Two more spots have the identical bug and are fixed for the same reason
(consistency with the sibling component that already gets it right, not a new
rule): the venue board (`VenueBoard`) and the session detail page's header
chip (`SessionPage`) both hard-code "seats left" the same way `SessionCard`
used to. Nothing about *when* seats, sessions or speakers are counted changes
— only the noun's number.

## Where

- `src/components/SeatPanel.jsx` — `` `${seatsLeft.toLocaleString()} seats
  left` `` → `` `${plural(seatsLeft, 'seat')} left` ``, matching
  `SessionCard`'s existing `card-seats` copy. Needs `plural` added to its
  `format.js` import.
- `src/components/NextUpCard.jsx` — `` `That is your day — ${done} sessions
  done. Nothing else booked today.` `` → uses `plural(done, 'session')`. Needs
  `plural` added to its `format.js` import. (The `· {done} done today` chip
  next to the "Right now" heading has no noun in it and is untouched.)
- `src/pages/HomePage.jsx` — `` `${followingIds.size} speakers followed` `` →
  `` `${plural(followingIds.size, 'speaker')} followed` ``. `plural` is
  already imported here.
- `src/components/VenueBoard.jsx` — same `seats left` fix as `SeatPanel`,
  same reason. Needs `plural` added to its import.
- `src/pages/SessionPage.jsx` — same fix for the `header-seats` chip. `plural`
  is already imported here.

None of these touch `seats.js`, `agenda.js` or any route — the counts
themselves are already correct; only their wording changes.

## How it will be proved

**Unit**, `tests/unit/format.test.js` — the rule is a pure function
(`plural`), so it is proved there rather than in a browser, per
`docs/context/testing.md`. The existing "Counts are pluralised" block already
covers `plural(1, 'session')` and the irregular-plural form; this adds the two
words these components actually pass it — `plural(1, 'seat')` → `'1 seat'`,
`plural(3, 'seat')` → `'3 seats'`, `plural(1, 'speaker')` → `'1 speaker'`,
`plural(4, 'speaker')` → `'4 speakers'` — so both the seat-panel/venue-board/
session-page wording and the home-page wording are covered by name, alongside
the `session` case that was already there for the Right-now card. Since every
site above does nothing but call `plural(n, word)` and interpolate the
result, this closes the loop between the ticket's wording and the code.

**Existing browser coverage stays green as a check, not a new one**:
`tests/schedule.spec.js` ("a card shows the seats left...") and
`tests/seats.spec.js` (`seats-left`, `seat-count`) already assert against
real seat counts through `npm run verify`; they assert the shape (`/^\d+
seats left$/` on a *roomy* session, `'Full'` on a sold-out one) rather than a
specific number, so they are unaffected by the wording change and continue to
prove the surrounding markup didn't break.

## Decisions

- **Fixed two sites beyond the three the ticket names** (`VenueBoard`,
  `SessionPage`'s header chip). Both have the exact same hard-coded "seats
  left" the ticket is about, and `SessionCard` sitting right next to them
  already does it correctly — leaving them out would mean the same bug still
  shipping on the venue board and the session page after this ticket closes.
- **No new browser test.** The three (five) sites are template-string
  rendering with no branching this ticket changes; `plural` is what decides
  singular vs. plural, and it is already unit-tested infrastructure. Adding a
  Playwright assertion that pins seat counts, check-in counts or follow
  counts to exactly one would make an already-shared, concurrently-mutated
  lane (seats, follows) flakier for no extra proof.

## Out of scope

Any other hard-coded plural in the app that isn't named above or discovered
to share the exact same bug; the wording of "person"/"people" (waitlist),
which is already handled by `plural`'s irregular form and untouched here.
