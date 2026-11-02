# ORBIT '26 — product

A conference companion app for a fictional applied-AI conference in Las Vegas:
four days, ~140 sessions, 110 speakers, two venues 6.2 miles apart. Attendees
use it to find the talks they want, hold a seat in them, get there, and say
afterwards what they thought.

It also exists to give the [engineering harness](../engineering-context/harness/index.md)
real work — seats and waitlists, clashing sessions, check-in windows, ratings
and a clock that runs — so the agents have real rules to respect.

https://github.com/user-attachments/assets/7f3ea661-2e85-4895-b7b2-63f3d77a1674

## Who it is for

Attendees, at three ticket tiers, two of whom are also speaking —
[`user-personas.md`](user-personas.md). There is no login: you pick an
attendee from the switcher.

## What it does

- **Schedule** — a grid of rooms by time on desktop, a list on a phone, with
  filters that live in the URL.
- **Seats** — adding a session to your agenda takes a seat, or a waitlist
  place when the room is full.
- **Check in and rate** — check-in opens 15 minutes before a session and
  closes when it ends; you can rate only what you attended, once it is over.
- **Speakers, venues, sponsors** — a tiered speaker index you can follow, the
  two venues on a real map, travel times between them.
- **Calendar export** — any session as `.ics` from its page; your whole agenda
  from the API, with no button yet.

## Product decisions

- **One action.** Adding a session takes a seat; there is no separate
  bookmark. Splitting favouriting from reserving confused people at the
  conferences that tried it, so this app does what Sched, EventMobi and
  KubeCon do.
- **A clash is a choice, not an error.** Two seats in overlapping slots are
  blocked, and the app offers a side-by-side swap rather than a warning.
- **Hours are hours you hold a chair for.** Waitlisted time is counted apart;
  a waitlist place may never come good.
- **Check in, then rate.** You can only rate what you attended, once it is
  over — so every rating is earned.
- **The conference is always today.** Day 1 is the day the data is seeded and
  the clock ticks while you watch, so the app always looks mid-conference.
- **Nothing may claim to be true when it is not.** No ratings for talks that
  have not happened, no hard-coded dates, no links to sites that do not exist.

The reasons, and the rules that enforce them, are in
[`CLAUDE.md`](../../CLAUDE.md).

## Deliberately unbuilt

The personal side of the app is left for workshop teams to build:

- **My Agenda** (`/my-agenda`) is a *coming soon* page. The seats, the
  per-attendee schedule and today's view are all in the API, waiting for a page.
- **Home** is static — nothing on it is about the signed-in attendee.
- **Following** works on the speaker pages, but nothing outside them shows
  what you follow.

## Read next

- [`../engineering-context/`](../engineering-context/index.md) — how it is built,
  one doc per area, and how to run it.
- [`../engineering-context/data-model.md`](../engineering-context/data-model.md) — the schema.
