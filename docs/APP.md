# ORBIT '26 — the app the harness builds

A conference companion app for a fictional applied-AI conference in Las Vegas:
four days, ~140 sessions, 110 speakers, two venues six miles apart. It exists
to give the [engineering harness](../README.md) real work — seats and
waitlists, clashing sessions, check-in windows, ratings, and a clock that runs
— so the agents have real bugs to find and real rules to respect.

https://github.com/user-attachments/assets/7f3ea661-2e85-4895-b7b2-63f3d77a1674

## Run it

```bash
npm install && npm run dev     # seeds the database, then API + web on :5173
```

No login — pick an attendee from the switcher; two of them are also speaking.

**The conference is always today.** Seeding makes Day 1 the day you run it, so
you arrive mid-conference and the clock ticks while you watch. Pin it with
`?at=YYYY-MM-DDTHH:MM` to demo a particular moment.

## What is in it

- **My Agenda** — adding a session takes a seat, or a waitlist place when the
  room is full. Two seats in overlapping slots is a choice, not an error: the
  app offers a swap.
- **Check in and rate** — check-in opens 15 minutes before a session and closes
  when it ends; you can rate only what you attended, once it is over.
- **Schedule** — a grid of rooms by time on desktop, a list on a phone, with
  filters that live in the URL.
- **Speakers, venues, sponsors** — a tiered speaker index, the two venues on a
  real map, travel times between them.
- **Calendar export** — any session, or your whole agenda, as `.ics`.

## The stack

Node 22 · Express · better-sqlite3 · React 18 · Vite 6 · Tailwind v4 ·
Playwright. No ORM, no state library, no component kit.

| | |
| --- | --- |
| `npm run dev` | Seed, then API + web together |
| `npm test` | Unit and API tests — no browser, under a second |
| `npm run verify` | Playwright, desktop and mobile |
| `node scripts/gate.mjs` | Every test, as the agents run it |
| `npm run shot -- /schedule` | Screenshot a route |
| `npm run db:reset` | Rebuild the database — Day 1 becomes today |

## Read next

- **[CLAUDE.md](../CLAUDE.md)** — the architecture, the conventions and the
  decisions behind them. People and agents work to the same rules.
- **[docs/context/](./context/README.md)** — one doc per area of the app; what
  agents read instead of the source.
- **[docs/DATA_MODEL.md](./DATA_MODEL.md)** — the schema.
