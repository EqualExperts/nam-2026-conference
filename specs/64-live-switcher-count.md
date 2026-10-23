# 64 — Keep the attendee switcher's own agenda count live after booking

## What this changes

Open the attendee switcher (the avatar button in the header), book or release a
seat, then open the switcher again without reloading the page: today the
signed-in attendee's own row still shows whatever count was true when the app
first loaded. Every other attendee's row is unaffected — this is only about
your own row disagreeing with what you just did. After this change, your row
always reflects what is actually on your agenda right now; everyone else's row
is untouched, since the app only ever holds live reservation state for the
signed-in attendee.

## Where

- `src/components/UserSwitcher.jsx` — the list currently renders
  `u.reservedCount ?? 0` for every row, including the active one.
  `reservedCount` comes from `/bootstrap` (`server/routes/meta.js`), fetched
  once by `ConferenceProvider` and never touched again. Add `reservations` to
  the `useConference()` destructure and, for the row where `u.id ===
  currentUser.id`, count the entries whose value is `'confirmed'` instead of
  reading `u.reservedCount`; every other row keeps `u.reservedCount ?? 0`
  exactly as today. No other file changes — `reservations` is already kept
  live by `reserveSeat`/`releaseSeat` in `src/lib/store.jsx`
  (`docs/context/seats.md` § How it works), so nothing upstream needs to
  change for the count to move.

## How it will be proved

**Browser**, `tests/plan.spec.js`, next to the existing "the switcher counts
what is on an agenda, not what was 'saved'" test — this is the same UI, but
that test only checks the label on page load, never a change made mid-session
without a reload, so it does not cover this ticket.

New lane in `tests/helpers.js` (`LANES['switcher.live-count']`, `clean: true`
so the test can release freely), one bookable session per project via
`bookableFor`. The test:

1. Visits `/sessions/:id` for a bookable session as the lane's attendee.
2. Opens the switcher, reads the attendee's own row, and captures the digit
   in "N on agenda" as `before`.
3. Closes the switcher, books the seat from the session page
   (`reserve-seat` → `reservation-confirmed`), then reopens the switcher
   **without reloading** and asserts the own row now reads `before + 1`.
4. Releases the seat from the session page, reopens the switcher again, and
   asserts the row is back to `before`.
5. Along the way, asserts one other attendee's row (any row that is not the
   signed-in one) shows the same digit before and after — proving other rows
   are untouched.

This is false on `main` today: the switcher renders `reservedCount` for every
row unconditionally, so steps 3 and 4 currently see no change at all (the
label stays at `before` throughout, not `before + 1` then `before` again).

**Correction:** the test visits the session page without pinning the clock.
The mobile lane books on day index 0 — the live conference day — so an
unpinned clock projects the real time of day onto it, same as any other page;
late enough in the day, the session `bookableFor` happens to pick has already
"ended" by the projected clock, and `reserveSeat` returns its `rejected: 'ended'`
409 instead of confirming, so `reservation-confirmed` never appears. Every
other booking test in this file pins the clock to `momentOn(0, '07:00')` for
exactly this reason; this test now does the same.

## Out of scope

Anything about how a seat is booked or released — `server/lib/seats.js` and
`src/lib/store.jsx`'s `reserveSeat`/`releaseSeat`/`applySeatState` already do
the right thing and are not touched. This ticket is only about which number
`UserSwitcher` reads for the active row.
