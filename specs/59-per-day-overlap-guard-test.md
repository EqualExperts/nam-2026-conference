# 59 — Prove the overlap guard is per day: same slot on another day is not a clash

## What this changes

Nothing an attendee sees — this adds coverage for a rule that already exists
in `server/lib/seats.js` but has no test pinning it down: the overlap guard
that blocks two confirmed seats in intersecting slots is scoped to one day.
Every conference day repeats the same eight slot times (08:00, 09:00,
10:15…16:00), so a confirmed seat at 10:15 on day 1 must not stop an attendee
booking 10:15 on day 2 — only another session on day 1 that actually
intersects that slot should. Today, nothing proves the `AND s.day = ?` line
in the `overlapping` query is load-bearing: deleting it leaves every existing
test green.

## Where

- `tests/api/overlap.test.js` — one new test, in a new `describe('The overlap
  guard is per day', …)` block alongside the existing "Two seats in one slot"
  and "A session that is already over" blocks. No production code changes;
  `server/lib/seats.js`'s `overlapping` statement (doc: `docs/context/seats.md`
  § How it works) is exactly what is being proved, not touched.
- The test reuses the file's existing `collidingPair()` helper (finds two
  sessions on the same day whose intervals intersect) and adds one small local
  helper to find a session in the exact same slot (`startsAt`/`endsAt`) as one
  of that pair, on a *different* day, with seats to spare.

## How it will be proved

**API**, `tests/api/overlap.test.js`, because this is a database-backed rule
in `seats.js` — exactly the layer `docs/context/testing.md` names for seats,
waitlists and the overlap guard.

One test, one attendee (cleared with `clearAgenda` first, per the file's own
convention — API tests share no state, so no lane is needed):

1. `collidingPair()` gives `{ held, wanted }`: two sessions on the *same* day
   that intersect in time.
2. A new `sameSlotOtherDay(held)` finds a third session with `held`'s exact
   `startsAt`/`endsAt` but a different `day` and spare seats — guaranteed to
   exist, since every day repeats the same slot grid (verified: all four
   seeded days share all eight slot times).
3. `PUT .../reservations/:held.id` → **200**, `status: 'confirmed'`.
4. `PUT .../reservations/:otherDay.id` (same slot, different day) → **200**,
   `status: 'confirmed'` — the Done-when's "books the session in the same
   slot on another day, and both succeed".
5. `PUT .../reservations/:wanted.id` (overlaps `held`, same day) → **409**,
   `body.rejected === 'overlap'`, `body.conflictsWith.id === held.id` — the
   Done-when's "still gets a 409 for an overlapping session on the same day".

Step 4 is what makes the day condition load-bearing: `otherDay` shares
`held`'s exact start/end time strings, so if `AND s.day = ?` were removed from
the `overlapping` query, the plain interval check (`starts_at < ? AND ? <
ends_at`) would still match `held` against `otherDay` and step 4 would return
409 instead of 200, failing the test for the reason the ticket describes
rather than by accident.

**Verification that the test fails without the day condition** (done once
while writing this, not part of the shipped diff): comment out
`AND s.day = ?` (and its bound parameter) in `server/lib/seats.js`'s
`overlapping` statement, run `node --test tests/api/overlap.test.js`, confirm
the new test fails on step 4 with a 409 where 200 was expected, then revert.
The PR description will record this run.

## Out of scope

Any change to how overlaps are detected (per the ticket) — the `overlapping`
query, `reserveSeat`, and `releaseSeat`'s promotion check are untouched.
