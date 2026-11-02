---
area: clock
summary: The simulated conference "now" — the viewer's time of day projected onto Day 1, pinnable for demos and tests — the /api/live endpoint and the LIVE badge.
read_when: touching simulated time, ?at= or orbit:clockAt, anything that asks "what is happening now", /api/live, or LiveBadge
files:
  - src/lib/clock.js
  - src/components/LiveBadge.jsx
tests:
  - tests/unit/clock.test.js
  - tests/live.spec.js
related: [architecture, seats, attendance, agenda, testing]
---

# Clock

What the clock is for, and the pinning rules tests must follow, are in
CLAUDE.md § The conference clock.

## How it works

**`src/lib/clock.js`.**

- `readOverride()` — `?at=` from `window.location.search`, else
  `localStorage['orbit:clockAt']`. Splits on `T`; if either half is empty it
  returns `null` (the override is ignored). Otherwise `{ day, time:
  time.slice(0, 5) }`. There is **no other validation**: the day is not checked
  against `days`, and the time is not checked for shape.
- `currentMoment(anchorDay)` — so opening the app at 10:40 stands you in the
  10:15 slot on Day 1, watching it run. The override if any; otherwise `anchorDay` plus
  the browser's local `HH:MM`, or `FALLBACK_TIME` `'10:40'` when the real time
  is outside `DAY_START` 08:00 – `DAY_END` 22:30 (inclusive).
- `useConferenceClock(days)` — anchor is `days[0]?.date`, or `DEFAULT_DAY`
  `'2026-10-12'` until bootstrap arrives. The effect depends on the anchor
  *string* (not the array), recomputes the moment, and — only when no override
  is set — ticks every 30 000 ms. Returns `{ day, time }`.
- Pure helpers, safe to import in Node: `toMinutes('HH:MM')`,
  `progressOf(session, now)` (0–1, clamped, on camelCase `startsAt`/`endsAt`),
  `relativeToNow(hhmm, now)` ('starting now' / 'in 12 min' / '8 min ago' /
  '2h 5m'), `isOpenAt(opens, closes, now)` (wraps past midnight),
  `hasEnded(session, clock)` (earlier day, or same day at/after `endsAt`; false
  without a clock — the client mirror of the API's `rejected: 'ended'` rule).
  `server/lib/query.js` has its own `toMinutes` for the server.

**Getting the clock.** `src/lib/store.jsx` calls `useConferenceClock(data?.days)`
and exposes it as `useConference().clock`. Pages and components read it from
there (`HomePage`, `SchedulePage`, `SessionPage`, `VenuesPage`, `FoodPage`,
`SessionCard`, `ScheduleGrid`, `VenueBoard`, `AttendancePanel`, …). The store
passes `clock` as the body of seat PUTs; attendance passes it as query/body. `format.js:relativeDate(iso,
clock)` measures "ago" against it.

**`GET /api/live?day=&time=`** (`server/routes/meta.js`, 400 without both):
`{ day, time, dayStartsAt, dayEndsAt, nextSlot, happeningNow, upNext }`.
`happeningNow` = sessions that day with `starts_at <= time < ends_at`, keynotes
then capacity first; `nextSlot` = the earliest `starts_at > time`; `upNext` =
everything starting at `nextSlot`, keynotes then rating first. `dayStartsAt` /
`dayEndsAt` are the day's `MIN(starts_at)` / `MAX(ends_at)`, `null` for a day
with no sessions.

Client: `api.getLive({ day, time })` — **no UI calls it yet**; it is there for
workshop teams to build a "happening now" view on. `tests/live.spec.js` covers
the endpoint (`the live endpoint lists only what is running`).

**`LiveBadge`** (`src/components/LiveBadge.jsx`, the file's only export) — the
pulsing red dot + "LIVE" chip, `{ className, label = 'Live' }`. Used by
`SessionCard` and `VenueBoard` for whatever is in progress at `clock`.

## Invariants

- Components never call `new Date()` for "now" — they read `clock`. The only
  real-time reads are in `currentMoment`.
- A pinned clock never ticks, so a pinned screenshot or test is stable.
- `clock.time` is always `HH:MM`; `clock.day` is always `YYYY-MM-DD`. Server
  rules compare both as strings.

## Gotchas

- Before bootstrap resolves, `clock.day` is `DEFAULT_DAY`, a hard-coded date
  that is not a conference day. Anything fetched on it refetches once `days`
  loads (because the dep changes) — do not cache it.
- The override is read only when the effect runs (mount, anchor change) and on
  each tick. With `?at=` in the URL no tick is scheduled, so navigating away
  from `?at=` keeps the pinned time until reload; `?at=` is not written to
  localStorage.
- A malformed `?at=2026-10-12T` or `?at=2026-10-12` is silently ignored; a
  well-formed timestamp for a day outside the conference is accepted and shows
  an empty day.
- `npm run shot -- / --at=YYYY-MM-DDTHH:MM` pins screenshots the same way.
- Tests pin via `visit(page, path, { at })`, which writes `orbit:clockAt` in
  an init script — build `at` with `momentOn(dayIndex, time)` from
  `tests/helpers.js`.
- A "happening now" view built on `/live` should branch on `dayStartsAt` /
  `dayEndsAt`, not on array lengths — `happeningNow` is empty in every gap
  between slots, which is not the same as the day being over.

## Where to change…

- Tick rate, clamp window or fallback moment: constants at the top of `clock.js`.
- A new override source or validation: `clock.js:readOverride`.
- What counts as "running" or "next": the `runningAt` / `nextSlotAfter` /
  `startingAt` statements in `server/routes/meta.js`.
- The LIVE chip's look: `LiveBadge.jsx`.
