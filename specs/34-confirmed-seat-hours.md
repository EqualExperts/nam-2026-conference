# 34 — Count only confirmed seats in My Agenda's hours

## What this changes

On My Agenda, **hours mean hours you hold a chair for**. The *Hours booked*
tile and each day's "Nh of content" line count confirmed seats only; a
waitlist place no longer inflates them.

Waitlisted time does not vanish — it is reported separately, as a
`+2h waitlisted` note under the tile and, on a day that has one, beside that
day's hours line. An attendee with no waitlist places sees nothing extra, and
the tile still equals the sum of the day lines (both numbers round per day,
then sum, as today).

`GET /api/users/:id/schedule` tells the same story: `totalMinutes` becomes
confirmed-only and a sibling `waitlistedMinutes` carries the rest, so the
payload and the page cannot disagree. Every session stays listed on its day,
clashes are unchanged, and the *On a waitlist* tile is untouched.

## Where

- `server/lib/agenda.js` — `scheduleFor`: `totalMinutes` sums only sessions
  whose `reservation === 'confirmed'`; add `waitlistedMinutes` for the rest.
- `src/pages/MyAgendaPage.jsx` — the `useMemo` that recomputes each day
  client-side mirrors that split; `hoursOn(day)` reads the confirmed minutes
  and a sibling gives waitlisted hours. The tile passes the note, carrying
  `data-testid="stat-hours-waitlisted"` and rendered only when there is
  waitlisted time; `DayPlan` renders the per-day one only when that day has
  some.
- `src/components/ui.jsx` — `Stat` takes an optional `note` node rendered
  under the label. Nothing else passes one.
- `docs/context/agenda.md` — the `/schedule` payload fields, the stat-tile
  line and the "hours tile equals the sum of the day headings" invariant.
- `tests/helpers.js` — **no new lane**: every browser check here reads, it does
  not book. The only change is one line in the read-only fixture comment above
  `LANES`, recording that Jonas holds no waitlist place anywhere and no test may
  give him one (see *Decisions*).

## How it will be proved

| Criterion | Check | Layer |
| --- | --- | --- |
| API counts confirmed seats only | new `tests/api/agenda.test.js`: clear an attendee's plan, take a seat in an open session and a waitlist place in a full one on the same day, then assert that day's `totalMinutes` is the confirmed session's duration alone, `waitlistedMinutes` is the waitlisted one's, and both sessions are still listed with their `reservation` status | `tests/api/` (`startApi()`) |
| Tile counts confirmed seats only; day lines agree with it | the existing `tests/plan.spec.js` hours test, rewritten: wait for the plan (`plan-day-<date>`) to render, take the `/api/users/:id/schedule` payload the page itself fetched (`page.waitForResponse`), and assert the tile equals the sum of the per-day rounded **confirmed** hours from that payload and that each day's "Nh of content" line matches its own day | `tests/*.spec.js` |
| Waitlisted time shown separately, for an attendee holding both kinds | new read-only `tests/plan.spec.js` test as **Amara**, from the one payload the page rendered: assert she holds both kinds (guard), that `stat-hours-waitlisted` reads `+${Σ round(waitlistedMinutes/60)}h waitlisted` — 2h on a fresh seed — and that `stat-hours-booked` equals `Σ round(confirmedMinutes/60)` and is strictly less than the old rule's `Σ round((confirmed+waitlisted)/60)` | `tests/*.spec.js` |
| With no waitlist places, nothing extra is shown | new read-only `tests/plan.spec.js` test as **Jonas**: his payload has a plan and no waitlisted session, and `stat-hours-waitlisted` has count 0 | `tests/*.spec.js` |

The first three are written first and confirmed red for the right reason: today
the tile counts waitlist places (Amara's reads 9, not 8) and no note is
rendered. The fourth passes today by absence — it is a guard against rendering
the note unconditionally, so it is confirmed by making the note
unconditional once and watching it go red. `npm test` runs after every edit;
`node scripts/gate.mjs` is the gate.

## Decisions

- **Rounding stays per day, then summed.** A single rounded total would print
  5h over two days reading 2h each. The waitlisted note follows the same rule,
  so it too agrees with the days.
- **The day line keeps a waitlisted note.** A day holding only waitlist places
  would otherwise read "3 sessions · 0h of content", which looks like a bug
  rather than an answer.
- The existing test's attendee (Sofia) is kept, since it stays a read-only
  check; only how it waits and where its expected number comes from change.
- **The expected number comes from the response the page rendered**, not from a
  second call. The tile totals every day, the two projects run side by side, and
  other lanes book seats for Sofia — a separate fetch could disagree with the
  screen for reasons that have nothing to do with this ticket.
- **The two new browser tests book nothing, so they need no lane.** The tile and
  the note are whole-conference totals, so a writing test would have to own an
  attendee on *every* day to assert an absolute number — and no attendee is
  free: on a fresh seed Kenji is written by `seats.waitlist` and the promotion
  fixture, Marcus by `schedule.grid` and the queue-length test, and Sofia,
  Priya and Amara by lanes of their own. Reading instead removes the whole
  problem: the expectation comes from the payload that render used, so a
  concurrent booking moves both sides together. It also settles what the
  earlier draft got wrong — it proposed an `agenda.hours` lane on Kenji/Marcus,
  day index 1, which `schedule.grid`, `schedule.seats` and the promotion
  fixture already hold.
- **Amara is the both-kinds attendee.** The seed gives her one confirmed seat
  and two waitlist places on day 1 plus seats on days 2 and 3, and — unlike
  every other seeded waitlist holder — *nothing in the suite ever puts her on a
  waitlist*: her lanes (`seats.count`, `seats.twice`, `conflict.ui`,
  `agenda.add`, `session.add`) all pick sessions with spare seats, so they can
  only ever add a confirmed seat. Her waitlisted total is therefore fixed at
  90 minutes on every run, while the tile is still read from the payload
  because her confirmed seats do move.
- **Jonas is the no-waitlist attendee**, and that becomes a documented fixture.
  He is the only attendee the seed leaves with no waitlist place at all, and
  every test that books for him (`seats.count`, `seats.twice`, `conflict.api`,
  the promotion fixture) books a seat with room in it. The comment above `LANES`
  gains that line so a future test does not quietly take it away.
- **Rendered numbers can only be a subset of the payload**, since the page
  filters the fetched plan through the store's live reservations. A write
  landing between the store's fetch and the page's could therefore make the
  screen lag the payload by one session. That window is milliseconds wide and
  the existing hours test carries it too; the strict-inequality half of the
  Amara check is immune to it, which is why it is there as well as the equality.

## Out of scope

The Right now card, the home page's Today panel and the calendar export
(already confirmed-only), the *On a waitlist*, *Seats booked*, *Time clashes*
and *Cross-town days* tiles, and anything about how waitlists work.
