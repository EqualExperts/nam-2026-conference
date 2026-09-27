---
area: agenda
summary: The attendee's own conference — the home page's "Your day" (/today), the My Agenda page (/schedule payload), the speaker panels, and the .ics exports.
read_when: touching the home page, TodayPanel, suggestions, My Agenda, NextUpCard, clashes or totals, the speaking strip/panel, or calendar export
files:
  - server/lib/agenda.js
  - server/lib/ical.js
  - src/pages/HomePage.jsx
  - src/pages/MyAgendaPage.jsx
  - src/components/TodayPanel.jsx
  - src/components/NextUpCard.jsx
tests:
  - tests/home.spec.js
  - tests/plan.spec.js
  - tests/api/agenda.test.js
  - tests/api/calendar.test.js
  - tests/unit/ical.test.js
related: [seats, attendance, clock, venues, schedule, speakers]
---

# Agenda

What the home page and My Agenda are made of is decided in `server/lib/agenda.js`;
routes in `server/routes/users.js` only validate and call it. Rationale for what
belongs on `/` is in CLAUDE.md § The home page is about *this* attendee.

## How it works

**`GET /api/users/:id/today?day=&time=`** → `users.js` checks the user exists (404)
and `day` is present (400), then `agenda.js:todayFor(userId, { day, time })`.
`time` defaults to `'00:00'`. Client: `api.getToday(userId, clock)`, called by
`TodayPanel` with deps `[currentUser.id, clock.day, clock.time]` (refetches on every clock tick).

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
`SUGGESTION_COUNT` (3). `users.interests` is never read here.

**`GET /api/users/:id/schedule`** → `{ user: toUser(row), days: scheduleFor(id) }`.
`agenda.js:scheduleFor` returns one entry per day that has any reservation:
`{ date, sessions (each with reservation), conflicts, totalMinutes, waitlistedMinutes,
venuesVisited }`. The two minute totals split by status — `totalMinutes` counts
**confirmed seats only**, `waitlistedMinutes` the queued time — because hours
mean hours you hold a chair for.
`clashesIn` is an O(n²) pairwise overlap test over that day's sessions (both
statuses) → `{ type: 'overlap', sessionIds: [a, b] }`. `venuesVisited` is venue
`shortName`s.

**My Agenda** (`MyAgendaPage`) fetches `api.getSchedule` once, then in a `useMemo`
re-filters every day through `reservationFor(s.id)` from the store and
**recomputes** `conflicts`, both minute totals and `venuesVisited` client-side, dropping
empty days — so a removal disappears immediately and Undo restores it. Stat tiles:
seats booked, hours (`stat-hours-booked` = sum of per-day `hoursOn`, i.e. rounded
per day), waitlisted, clashes, cross-town days. Any waitlisted time adds a
`Stat note` under the hours label — `stat-hours-waitlisted`, `+Nh waitlisted`,
rounded and summed the same way — and a matching note beside that day's hours
line; with none, neither renders. `DayPlan` (`plan-day-<date>`)
renders `ConflictBanner` (`conflict-banner`, max 3 listed) and `SessionCard variant="row"`.
Export button `export-calendar` → `api.agendaCalendarUrl`.

**`NextUpCard`** (`next-up`, My Agenda only) derives current/next/done in the
browser from the already-filtered `days` for `clock.day`; it warns when current and
next are at different venues ≤ 30 min apart. **`TodayPanel`** (home) uses the
server payload and the richer `assessTravel` check from `src/lib/travel.js`
(`travel-warning`), comparing `next` with `current ?? last finished`.

**Home page** (`HomePage`) stacks `HeroBar` → `LiveNow` → `TodayPanel` →
`SpeakingStrip` → `LatestAnnouncement` → `FromSpeakersYouFollow` → `SponsorMarquee`.
Sections self-hide by returning `null`; the wrapping `<Reveal>` div would still
leave a gap, so the container has `[&>:empty]:hidden`. Inside `TodayPanel`:
nothing booked today → `today-empty` (interest chips linking `/schedule?q=`);
`waitlist-strip` and `rate-strip` render only when non-empty; `suggestions` only
when `openSlot && suggestions.length`.

**Speaker panels.** `GET /api/users/:id` adds `speaker` and `speakingSessions`
(`users.js:speakingSessions`, via `presenting` + plain `toSession`, so no
`speakers`/`tags` on them). Home `SpeakingStrip` (`speaking-strip`, first 3,
fill bar from `fillRate`) and My Agenda `SpeakingPanel` (`speaking-panel`, all,
plus `speaker.avgRating`) both fetch `api.getUser` and render only when the user
is linked and has sessions. Fill colour: ≥95% rose, ≥80% amber, else emerald.

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
- Everything on `/` keys off `clock.day`/`clock.time` (`useConference().clock`), never `days[0]` or `new Date()`.
- The hours tile equals the sum of the per-day "Nh of content" headings, and both
  count confirmed seats only (`plan.spec.js`, `api/agenda.test.js`).
- Agenda feed = confirmed only; `calendar.test.js` asserts waitlist places are absent.

## Gotchas

- `openSlot` matches exact start times, not overlap, and `slotsOnDay` includes
  keynote/social slots. If the first free slot is a keynote slot, `openInSlot`
  returns nothing and the suggestions block silently hides.
- `NextUpCard` works from `reservationFor(...)` truthy, so a **waitlisted**
  session can show as "Right now"/next there, unlike `TodayPanel`.
- The server's `conflicts`/`totalMinutes`/`waitlistedMinutes` are overwritten on My Agenda; change the
  client `useMemo` too if you change `scheduleFor`'s shape.
- `ical.js` prepares its statements per call (not module scope); `DTSTAMP` uses
  real `new Date()`. `URL:` comes from `baseUrlFor(req)` — `ORBIT_PUBLIC_URL`
  if set, else `X-Forwarded-Proto`/`X-Forwarded-Host` or the direct
  connection's own protocol/host.
- `speakingSessions` lack `speakers`/`tags` — do not hand them to a component that reads those.

## Where to change…

- A new field on the home payload → `agenda.js:todayFor`, then render in `TodayPanel`; prove it in `tests/api/` with `startApi()`.
- Suggestion ranking → `agenda.js:suggestionsFor` / `myTopics` / `openInSlot`.
- Clash or total rules → `agenda.js:scheduleFor`/`clashesIn` **and** the `useMemo` in `MyAgendaPage`.
- A new home section → a component returning `null` when empty, wrapped in `<Reveal>` in `HomePage` (see `FromSpeakersYouFollow`).
- Calendar fields → `ical.js:event`; escaping/folding tests in `tests/unit/ical.test.js`.
