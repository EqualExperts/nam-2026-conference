# 65 — Pluralise the schedule rail's agenda count, and stop calling the selected day today

## What this changes

The "My agenda" panel in the `/schedule` filter rail reads, e.g., "3 sessions ·
2 today" below the bare seat count. Two things are wrong with the second line:

- It hardcodes the plural, so an attendee with exactly one reservation on the
  whole conference sees "1 sessions" (`src/pages/SchedulePage.jsx`).
- It hardcodes "today" for the day's count, even when the rail is showing a
  day other than the one the conference clock is on — an attendee who filters
  to a different day is told sessions were booked "today" when they were not.

After this change the line reads "1 session · 2 today" when there is exactly
one reservation and the selected day is the clock's day, and "3 sessions · 2
on Day 1" when `?day=` names a day other than `clock.day`. The bare count
(`data-testid="starred-count"`) is unaffected — it stays a plain number.

## Where

- `src/lib/format.js` — add one small pure helper next to `plural` (same
  section, same style):

  ```js
  export const agendaSummary = (total, bookedOnDay, dayPhrase) =>
    `${total === 1 ? 'session' : 'sessions'} · ${bookedOnDay} ${dayPhrase}`;
  ```

  `dayPhrase` is the caller's job (`'today'` or `` `on ${label}` ``) so this
  function stays a pure string formatter with no knowledge of the clock.

- `src/pages/SchedulePage.jsx`:
  - Add `agendaSummary` to the existing `format.js` import (line 7, already
    imports `dayLabel, plural, shortDay`).
  - Just below the existing `const bookedToday = sessions.filter(...)` line
    (line 104), add:
    ```js
    const dayPhrase = filters.day === clock.day
      ? 'today'
      : `on ${days.find((d) => d.date === filters.day)?.label ?? filters.day}`;
    ```
    `days` and `clock` are already destructured from `useConference()` at the
    top of the component; `days[n].label` is the seeded `"Day N"` string from
    `GET /bootstrap` (`server/routes/meta.js`), which is what the ticket's "on
    Day 1" example names.
  - Replace the rail's second `<span>` (line 124), currently
    `sessions · {bookedToday} today`, with
    `{agendaSummary(reservations.size, bookedToday, dayPhrase)}`. The sibling
    `<span data-testid="starred-count">{reservations.size}</span>` (line 123)
    is untouched.

No other file reads this text; `docs/context/schedule.md` already describes
`starred-count` as "the agenda count" without giving its wording, so it needs
no update.

## How it will be proved

| Criterion | Check | Layer |
| --- | --- | --- |
| `agendaSummary` pluralises on the total, not a hardcoded word | New cases in `tests/unit/format.test.js`, alongside the existing `plural` tests: `agendaSummary(1, 2, 'today') === 'session · 2 today'` and `agendaSummary(3, 2, 'today') === 'sessions · 2 today'` | `tests/unit/format.test.js` |
| `agendaSummary` names the day it is given instead of assuming "today" | `agendaSummary(3, 2, 'on Day 1') === 'sessions · 2 on Day 1'` in the same file | `tests/unit/format.test.js` |
| The rail actually shows the day name, not "today", when `?day=` is not the clock's day | New Playwright case in `tests/schedule.spec.js`: visit `/schedule?day=<day index 1>` with the clock pinned to day index 0 (`momentOn(0, MID_SESSION_TIME)`), read the rail's text next to `starred-count`, and assert it contains `on Day 2` and not `today`. Uses `ATTENDEES.jonas` — day 1 is Jonas's read-only home-page fixture, but this only reads `/schedule` for day 2, so it writes nothing | `tests/schedule.spec.js` (desktop + mobile projects) |
| The rail says "today" when the selected day *is* the clock's day (no regression) | Same test, second assertion: visiting `/schedule` with no `?day=` and the clock pinned to day index 0 shows `today` in that line | `tests/schedule.spec.js` |
| `starred-count` still holds only the bare number | Existing assertion in `tests/schedule.spec.js` (`Number(await count.innerText())`, line 88) keeps passing unchanged | `tests/schedule.spec.js` |
| No regression elsewhere | `npm test` and `npm run verify` stay green | unit + API + browser |

Both unit assertions are false against `main` today: `plural`-style hardcoding
means the "1 sessions"/"today" strings are exactly what the current file
emits, since `agendaSummary` does not exist yet on `main` — this row is
written after confirming the current rail markup (`sessions · {bookedToday}
today`, unconditional) on the branch point. The new Playwright case is false
against `main` today too: with `?day=` set to day index 1 and the clock
pinned to day index 0, the current code still renders `today`, not `on Day 2`.

## Decisions

- The ticket's example "1 session" requires an attendee with exactly one
  reservation on the whole conference; none of the seeded attendees
  (`tests/helpers.js` `ATTENDEES`) has that naturally, and reshaping one's
  full multi-day plan just for this test would touch state other specs
  depend on. `agendaSummary`'s own unit test proves the singular/plural rule
  directly on the exact string the rail renders, so the browser layer is
  reserved for the day-naming wiring, which the seeded data already
  exercises safely.
- `dayPhrase` takes the day's own `label` field (`"Day 1"`, `"Day 2"`, …) already
  computed once in `/bootstrap`, not `dayLabel()` (which renders a full
  calendar date) — matching the ticket's own example text.

## Out of scope

`bookedToday`'s definition (sessions on the currently-filtered day) is
unchanged — only how it is labelled. The "My agenda" panel's seat count
(`reservations.size`) and its `Open →` link are untouched.
