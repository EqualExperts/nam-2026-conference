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
  and a sibling gives waitlisted hours. The tile passes the note; `DayPlan`
  renders the per-day one only when that day has waitlisted time.
- `src/components/ui.jsx` — `Stat` takes an optional `note` node rendered
  under the label. Nothing else passes one.
- `docs/context/agenda.md` — the `/schedule` payload fields, the stat-tile
  line and the "hours tile equals the sum of the day headings" invariant.
- `tests/helpers.js` — a new `agenda.hours` lane (desktop Kenji / mobile
  Marcus, day index 1: no other writing lane touches either attendee there,
  and a waitlist place consumes no seat, so the read-only seat-count lanes on
  that day are unaffected).

## How it will be proved

| Criterion | Check | Layer |
| --- | --- | --- |
| API counts confirmed seats only | new `tests/api/agenda.test.js`: clear an attendee's plan, take a seat in an open session and a waitlist place in a full one on the same day, then assert that day's `totalMinutes` is the confirmed session's duration alone, `waitlistedMinutes` is the waitlisted one's, and both sessions are still listed | `tests/api/` (`startApi()`) |
| Tile counts confirmed seats only; day lines agree with it | the existing `tests/plan.spec.js` hours test, rewritten: wait for the plan (`plan-day-<date>`) to render, take the `/api/users/:id/schedule` payload the page itself fetched (`page.waitForResponse`), and assert the tile equals the sum of the per-day rounded **confirmed** hours from that payload and that each day's "Nh of content" line matches its own day | `tests/*.spec.js` |
| Waitlisted time shown separately, and only when there is some | new `tests/plan.spec.js` test on the `agenda.hours` lane: read the tile, PUT a reservation on a full session on the lane day (clock pinned with `momentOn`, so the ended guard cannot fire), reload, assert the tile is unchanged and `stat-hours-waitlisted` reads `+1h waitlisted`; release it and assert the note is gone. The lane attendee already holds seeded seats, so this is the both-kinds case the ticket asks for | `tests/*.spec.js` |

Each browser check is written first and confirmed red for the right reason
(today the tile counts waitlist places and there is no note), and
`npm test` runs after every edit; `node scripts/gate.mjs` is the gate.

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

## Out of scope

The Right now card, the home page's Today panel and the calendar export
(already confirmed-only), the *On a waitlist*, *Seats booked*, *Time clashes*
and *Cross-town days* tiles, and anything about how waitlists work.
