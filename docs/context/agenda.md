---
area: agenda
summary: The attendee's own conference — the My Agenda placeholder page, and the endpoints a team builds an agenda on (/users/:id/schedule and /today, the speaker's own sessions, the .ics exports), none of which has a UI yet.
read_when: touching My Agenda, an attendee's day or schedule, suggestions, clashes or booked-hours totals, a speaker's own sessions, or calendar export
files:
  - server/lib/agenda.js
  - server/lib/ical.js
  - src/pages/MyAgendaPage.jsx
tests:
  - tests/home.spec.js
  - tests/api/agenda.test.js
  - tests/api/calendar.test.js
  - tests/unit/ical.test.js
related: [seats, attendance, clock, venues, schedule, speakers, ui]
---

# Agenda

**My Agenda is a placeholder.** `/my-agenda` (`MyAgendaPage`, still in the nav,
`/my-plan` redirects there) renders a `SectionHeader` and a "Coming soon" panel
(`agenda-coming-soon`) with a `Browse the schedule` button — nothing else. Workshop
teams design the page from scratch. Everything underneath it is built and tested:
adding a session takes a seat (seats doc), and the payloads below are served,
with matching functions in `src/lib/api.js`. What a day is made of is decided in
`server/lib/agenda.js`; routes in `server/routes/users.js` only validate and call it.

## How it works

**`GET /api/users/:id/schedule`** → `{ user: toUser(row), days: scheduleFor(id) }`.
Client: `api.getSchedule(userId)` — no UI calls it yet.
`agenda.js:scheduleFor` returns one entry per day that has any reservation:
`{ date, sessions (each with reservation, checkedIn, myStars), conflicts, totalMinutes,
waitlistedMinutes, venuesVisited }`. `checkedIn` (bool) and `myStars` (number or `null`)
are this attendee's attendance on *every* day, not just today. The two minute totals split by status — `totalMinutes` counts
**confirmed seats only**, `waitlistedMinutes` the queued time — because hours
mean hours you hold a chair for.
`clashesIn` is an O(n²) pairwise overlap test over that day's sessions (both
statuses) → `{ type: 'overlap', sessionIds: [a, b] }`. `venuesVisited` is venue
`shortName`s.

**Building on it.** The store, not the fetched payload, is the source of truth for
the attendee's own reservations (CLAUDE.md § There is exactly one action). A page
that lists the schedule must re-filter each day through `reservationFor(s.id)` and
recompute `conflicts`, both minute totals and `venuesVisited` client-side (dropping
empty days), or a removed session stays on screen until a refresh. Per-session
attendance for a row is `SessionCard variant="row"`'s `attendance` prop
(`{ ended: hasEnded(s, clock), checkedIn, myStars }`, schedule doc); booked hours
under a waitlist caveat fit `Stat`'s `note` (ui doc); a cross-town hop between two
seats is `travel.js:assessTravel` (venues doc); export is `api.agendaCalendarUrl`.

**`GET /api/users/:id/today?day=&time=`** → `users.js` checks the user exists (404)
and `day` is present (400), then `agenda.js:todayFor(userId, { day, time })`.
`time` defaults to `'00:00'`. Client: `api.getToday(userId, clock)` — no UI
calls it yet. Key a fetch on `[currentUser.id, clock.day, clock.time]` and it
refetches on every clock tick.

Payload, field by field (sessions are `hydrateSessions` output — full
`toSession` plus `speakers` and `tags`):

| field | computed as |
| --- | --- |
| `day`, `time` | echoed from the query |
| `current` | first **confirmed** session on `day` with `startsAt <= now < endsAt`, else `null` |
| `next` | first confirmed session with `startsAt > now`, else `null` |
| `finished` | confirmed sessions with `now >= endsAt` |
| `unrated` | `finished` where `checkedIn && !rated` |
| `waitlisted` | the day's sessions whose reservation is `'waitlisted'` |
| `openSlot` | first `starts_at` from `SELECT DISTINCT starts_at FROM sessions WHERE day=?` that is `> now` and not the exact `startsAt` of a confirmed seat; else `null` |
| `suggestions` | `suggestionsFor(userId, day, openSlot)`, or `[]` |

Confirmed/waitlisted rows are `decorate`d with `reservation`, `checkedIn`, `rated`
(from `reservations`, `check_ins`, `ratings`). "Now" is `toMinutes(time)` from `server/lib/query.js`.

**Suggestion ranking** — `agenda.js:suggestionsFor`: `myTopics` takes the user's
top 8 topic-tag slugs by count across *all* their reservations (any day, either
status). Candidates are `openInSlot`: same day and start, `is_keynote = 0`,
`format != 'Social'`, `seats_taken < capacity`. Each gets `affinity` = number of
its topic tags in that set; sort `affinity` desc then `avgRating` desc; top
`SUGGESTION_COUNT` (3). `users.interests` is never read here (it is writable via `PUT /users/:id/interests`, still unread).

**Speaker data.** `GET /api/users/:id` adds `speaker` and `speakingSessions`
(`users.js:speakingSessions`, via `presenting` + plain `toSession`, so no
`speakers`/`tags` on them; `fillRate` is there). The only speaker-facing UI is the
"This is you" marker on the speaker's own profile (speakers doc).

**.ics** — `ical.js`: `sessionCalendar(id, baseUrl)` (route `sessions.js`
`/:id.ics`) and `agendaCalendar(userId, baseUrl)` (route `users.js`
`/:id/agenda.ics`, **confirmed seats only**), both passed `baseUrlFor(req)`.
Both return `null` for a missing id → route 404. `event()` emits floating
local `DTSTART`/`DTEND`, `UID:orbit-session-<id>@orbitconf.dev`, LOCATION
`room, venue`, DESCRIPTION `track · format\n\nabstract`; every line goes through
`fold` (75 octets, byte-aware) and text through `escape`. `wrap()` adds
`METHOD:PUBLISH` and `X-WR-CALNAME`, CRLF-joined with a trailing CRLF.

## Invariants

- `current`/`next`/`finished`/`openSlot` consider **confirmed** seats only; waitlist
  places never occupy a slot.
- Hours count confirmed seats only; queued time is `waitlistedMinutes`, totalled
  apart (`api/agenda.test.js`). A UI showing hours must keep the two apart.
- Agenda feed = confirmed only; `calendar.test.js` asserts waitlist places are absent.
- Anything "today" keys off `clock.day`/`clock.time` (`useConference().clock`),
  never `days[0]` or `new Date()`.

## Gotchas

- `openSlot` matches exact start times, not overlap, and `slotsOnDay` includes
  keynote/social slots. If the first free slot is a keynote slot, `openInSlot`
  returns nothing and `suggestions` is empty.
- `reservationFor(...)` is truthy for a **waitlisted** session too; filter on
  `=== 'confirmed'` for anything that means holding a chair.
- `scheduleFor`'s `conflicts` include waitlisted sessions (both statuses), unlike
  the totals.
- `ical.js` prepares its statements per call (not module scope); `DTSTAMP` uses
  real `new Date()`. `URL:` comes from `baseUrlFor(req)` — `ORBIT_PUBLIC_URL`
  if set, else the first entry of `X-Forwarded-Proto`/`X-Forwarded-Host` or
  the direct connection's own protocol/host. The Vite proxy (`changeOrigin`)
  rewrites Host, so `vite.config.js` sets those headers itself — prove a link
  through the web port (`attendance.spec.js`), not by calling the API directly.
- `speakingSessions` lack `speakers`/`tags` — do not hand them to a component that reads those.

## Where to change…

- The My Agenda page: `MyAgendaPage.jsx`; replace `tests/home.spec.js`'s
  "My Agenda is a blank canvas" test when the placeholder goes.
- A new field on the day payload → `agenda.js:todayFor`; prove it in `tests/api/` with `startApi()`.
- Suggestion ranking → `agenda.js:suggestionsFor` / `myTopics` / `openInSlot`.
- Clash or total rules → `agenda.js:scheduleFor`/`clashesIn`, and any client
  recomputation a page does.
- Calendar fields → `ical.js:event`; escaping/folding tests in `tests/unit/ical.test.js`.
