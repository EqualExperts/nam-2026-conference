# ORBIT '26 — conference companion app

A sample app for a workshop on using AI across the software delivery lifecycle.
Attendees fork this repo, turn requirements into GitHub Issues, and let an
engineering harness implement them. **Read this file before writing code here.**

## Run it

```bash
npm install
npm run dev      # seed, then API :3001 + web :5173
npm test         # unit + API, under a second — after every edit
npm run verify   # reseed + Playwright, desktop and mobile — before "done"
```

Every other command and flag: `docs/context/testing.md`.

## Stack

Node 22 · Express · better-sqlite3 · React 18 · Vite 6 · React Router 6 ·
Tailwind CSS v4 · Playwright. No state library, no ORM, no component library —
if you are reaching for one, you are probably solving the wrong problem.

## Start from the context docs

This file says what was decided and why; `docs/context/` says where it lives
and how it works — files, functions, payloads, test ids, the repo layout.
`node scripts/context.mjs index` lists one doc per area and when to read it.
They are read *instead of* the code, so a pull request that changes what a doc
describes updates it (`node scripts/context.mjs for <file…>` says which).

## Conventions

**The API boundary is camelCase.** Every snake_case → camelCase translation
happens in the `server/lib/query.js` mappers; a new column goes in its mapper —
React must never see `snake_case`.

**Components never call `fetch`.** A new endpoint is a route in the matching
`server/routes/*.js`, rows mapped with a `toX()` helper, and one function in
`src/lib/api.js`, which is the only caller of `fetch`.

**Routes stay thin; rules live in `server/lib/`** beside `seats.js`,
`attendance.js` and `agenda.js`, where they can be tested without HTTP. A
handler reads the request, calls one function, and sends the result.

**Prepare statements once, at module scope.** `db.prepare(...)` compiles SQL, so
preparing in a handler recompiles on every request. The exception is a filter
whose SQL genuinely varies with the query string (`/sessions`, `/speakers`,
`/vendors`) — and those still pass every value as a bound `?`.

**Page data comes from `useFetch`; global data from `useConference()`** — do
not refetch venues, days, the clock, the current user or their reservations per
page. (how: `docs/context/architecture.md`)

**Filters live in the URL** (`useSearchParams`), so a filtered view is shareable
and survives reload. `'all'` means "no filter".

**Tailwind colours are tokens, not raw hexes** (`bg-surface`, `text-muted`,
`border-hairline`). The elevation ladder is `ground` (page) → `surface` (module
panel) → `raised` (card in a panel) → `overlay` (controls, hover). Keep that
order; it is what stops dense screens turning to mush.

**Accent colours cannot be built at runtime.** Tailwind needs literal class
names, so `src/lib/accents.js` maps `'violet'` → a fixed set of class strings.
Never write `` `bg-${color}-500` ``.

**Every interactive element needs an accessible name** — icon-only buttons,
and labels hidden at some breakpoint, take `aria-label`. **Add `data-testid` to
anything a test needs to find**, never to decorative elements.

## There is exactly one action

Adding a session to your agenda **takes a seat**. There is no separate bookmark,
and there should not be one.

We originally copied AWS re:Invent and Google I/O, which split favouriting from
reserving. Both had to publish FAQ entries explaining the difference, and it
confused people here too. Most of the industry — Sched, EventMobi, and KubeCon
on top of Sched — uses a single action with capacity rules attached, so that is
what this app does.

- `reservations` is the only table. Adding moves `sessions.seats_taken` for
  *everybody*; a full room waitlists you instead; removing a confirmed seat
  promotes whoever has waited longest (skipping anyone who has since taken a seat
  in that slot). All transactional — `server/lib/seats.js`.
- The page is **My Agenda** (`/my-agenda`), which is what Whova, Cvent, EventMobi
  and AWS all call it. `/my-plan` redirects.
- The store (`useConference()`: `toggleSeat`, `reservationFor`, `onAgenda`) is
  the source of truth for your own reservation state — never fall back to the
  payload a page was fetched with, or "removed" stays unreachable until a refresh.

## The attendee chain

Four rules borrowed from real conferences; each writes state and gates the next:

1. **Add a session** → takes a seat, or a waitlist place. **You cannot hold two
   seats in overlapping slots** — the API returns 409 with the clashing session,
   and the UI offers a swap. Every real system blocks this rather than warning.
   Nor can you take a seat in a session that has already ended (also a 409).
2. **Check in** → opens 15 minutes before the session starts, closes when it
   ends. You cannot check in to something that has not happened.
3. **Rate it** → only if you checked in, only once it is over. One rating per
   person, editable. Ratings roll up onto `sessions.avg_rating` immediately.
4. **Export** → `/api/users/:id/agenda.ics` and `/api/sessions/:id.ics`.

A clash is a **choice, not an error**: the 409 carries both sessions and the UI
opens `<ConflictDialog>` side by side with Keep / Swap. Do not demote that to a
toast — a toast disappears while the decision is still open.

The rules run in transactions in `seats.js` and `attendance.js`, taking the
clock from the *client*, because conference time is simulated. (how:
`docs/context/seats.md`, `attendance.md`)

### Writing tests against this

That state is real, and Playwright tests all run concurrently. Give each
**test, per project,** its own attendee and day (a data lane), release what you
book, and never reuse an attended session — a check-in cannot be undone. (how:
`docs/context/testing.md`)

## The conference clock

**Day 1 is the day you seed** (`ORBIT_START_DATE` overrides it), and its
morning, to 12:15, has already been attended — the only seeded check-ins and
ratings. Tests ask the API for the dates (`conferenceDays()`), never hard-code them.

"Now" is simulated: the viewer's real time of day projected onto Day 1, ticking
every 30 seconds, clamped to a lively mid-morning outside 08:00–22:30. Read it
from `useConference().clock` (`{ day, time }`) — never `new Date()` in a
component. Pin it with `?at=YYYY-MM-DDTHH:MM`; a value without the time part is
ignored. **Any test that touches live state must pin the clock**, otherwise it
passes or fails depending on the hour it runs. (how: `docs/context/clock.md`)

## Imagery

**No photograph of a real person appears anywhere in this repo, and none should
be added.** Portraits in `public/avatars/` are synthetic StyleGAN faces from
thispersondoesnotexist.com — no real person, no likeness rights. If you ever
regenerate one:

1. **Fetch sequentially** — concurrent requests come back identical.
2. **Update `server/avatar-presentation.json`** — the seed picks name and
   pronouns *from the photo*, or the name fights the picture. And eyeball it:
   the dataset contains children.

Everything else — avatar fallbacks, cover art, sponsor marks — is generated
deterministically from a string. (how: `docs/context/seed.md`, `ui.md`)

`VenueRouteMap` is the *only* map, and it is honest because the two venues'
lat/lng are real. There was once a per-venue "floor plan" built from invented
`map_x`/`map_y` values; it looked like geography, meant nothing, and has been
removed. Do not bring it back — `VenueBoard` shows what is actually happening
in each room instead.

## The home page is about *this* attendee, at *this* moment

Everything on `/` is personal or time-sensitive. It is not a brochure — an
attendee bought a ticket, so the dates and track list tell them nothing new.

- **Suggestions rank on behaviour, not declaration.** `interests` is what
  someone ticked at registration; the topic tags on what they have actually
  booked are what they want, so suggestions rank on those.
- **Everything is driven by `clock.day`.** The old page rendered `days[0]`, so
  on day 3 it presented day 1 as if it were happening.
- Sections **self-hide when empty** — follow `FromSpeakersYouFollow`.

If you add a section here, it has to answer "why is this on the home page and
not on the page that owns it?" Keynotes, the track list, the venue split and
featured speakers all failed that test and were removed. (how:
`docs/context/agenda.md`)

## Nothing may claim to be true when it is not

The seed generates a *live* conference, so anything that implies elapsed time
has to be earned:

- **Ratings and reviews only exist for sessions that have already finished.**
  Seeding a 4.5 onto a talk three days away was the clearest possible tell that
  the data was fake, and it poisoned the "highest rated" ranking. The seed only
  rates Day 1 morning sessions, and only from attendees it checked in, by the
  same rules as the API; `speakers.avg_rating` is derived from those session
  ratings, never invented.
- **Never hard-code a date, month or weekday.** Day 1 moves with the seed, so
  the footer, announcements and body copy all derive from `conference.dates`
  and `days[n]`. A footer reading "Oct 12–15" under a September hero is the
  fastest way to lose an attendee's trust.
- **No invented external links.** Speaker socials show the handle but do not
  link, and sponsor websites are not shown, because the domains do not exist.

## Chrome and correctness

Easy to forget, and immediately read as unfinished:

- **Every page calls `useDocumentTitle`** — the tab, history and bookmarks read it.
- **`<RouteChange>`** resets scroll and focuses `#main` on navigation, because
  React Router does neither.
- **`useToast()`** for any action that would otherwise be silent; removing a
  seat toasts with Undo.
- **Footer links must resolve** — a smoke test walks every one.
- **Motion is CSS, and optional.** `prefers-reduced-motion` switches it all off
  and forces `.reveal` visible, so nothing hides behind an animation that never
  runs; anything new must survive that. (how: `docs/context/ui.md`)

## The schedule has two views

`/schedule` is a **grid** (time down, rooms across) or a **list** (cards by time
slot), chosen by `?view=`; with no param the grid is used on `lg` and up and the
list below, because a horizontally scrolling matrix is miserable on a phone.

The grid only makes sense when whole rooms are visible, so a content filter
(search, track, topic, level, format) falls back to the list and disables the
grid with a reason; a venue filter only drops columns. It relies on the seed
giving each day a **stable set of five rooms, each with a track for the day** —
scatter talks across arbitrary rooms and the grid becomes a mostly-empty
spreadsheet. (how: `docs/context/schedule.md`)

## Visual hierarchy

Not every card is equal, and the UI must say so. Keynotes get the `feature`
treatment in `SessionCard`. It is keynotes only: it once also fired on every
room over 1,200 seats, and when most of the list is featured, nothing is. The
top-rated vendor and the Diamond and Platinum sponsors get similar promotion.
When you add a new card type, ask what makes one instance more important than
another and show it.

The speakers page is tiered because 110 people are too many for one flat grid
— followed, then featured headliners, then an A–Z index — and flattens once the
user searches, filters or re-sorts, because then they have stated what matters.
Mixed grids use `grid-flow-row-dense` so wide cards leave no holes. (how:
`docs/context/speakers.md`)

## Verifying a change

Three layers, fastest first: `npm test`, `npm run verify` (the gate for
"done"), `npm run shot` if visual. **If a rule can be proven without a browser,
prove it without one** — an agent can afford `npm test` after every edit, not
Playwright. Pure functions → unit; rules needing the database → API; what the
attendee sees → spec. (how: `docs/context/testing.md`)

**Claim a lane before you run anything** in a worktree
(`eval "$(node scripts/lane.mjs claim 42)"`). Without one, Playwright reuses any
app on the web port — another worktree's — and your specs pass against the
*other* branch's code. CI runs the same commands.

## Where work is tracked

**Tickets are GitHub Issues** — of the fork you are working in, never the upstream's.

## Data model

Four days from the day you seed, ~140 sessions, 110 speakers, **two venues 6.2
miles apart**, no authentication. Schema: `docs/DATA_MODEL.md`; the seeded
attendees: `docs/context/seed.md`.

## Setting this up on a fork

Actions → **Set up the harness** → Run workflow. A fork inherits the workflows
but not the labels, and `ready-for-ai` is what starts everything. Keys, tokens
and triggers: `docs/harness/github.md`.

## What happens to a ticket

1. **Ship** — `ready-for-ai` (or `@claude` on an issue) runs `/ship`, where
   every phase is a fresh agent. Setup sizes the ticket: most are **small**
   (one auditor per stage, two rounds, Sonnet); `ship:full` gets the whole
   loop on Opus. No pull request until the gate is green and no
   auditor blocker survives a skeptic; one that will not converge goes to a
   person as a **draft**.
2. **Code review**, 3. **QA** — on the opened, non-draft pull request, each with
   a **confidence** meaning coverage, not feeling; a low one reads *unproven*.
4. **A human merges.** Nothing is a required check.

(how: `docs/context/harness.md`, `docs/harness/ship-playbook.md`)

## Every change starts with a spec

`specs/<issue>-<slug>.md`, written before the code and pushed as the first
commit on the branch. A reviewer reads the intent before the diff, and a
misreading of the ticket surfaces while it is still cheap.

They are kept: `specs/` records how the code got this way — what each change
was for, what the ticket left open, and what was deliberately left undone.

## Commits

**Conventional Commits.** `type(scope): subject` — the subject in the
imperative, lower case, no full stop, under about 70 characters.

```
fix(seats): release a waitlist place when the seat ahead is dropped
```

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`. The scope is optional and names the area, not the file.

The subject says what changed; **the body says why.** A diff already shows
what you did, so a body that restates it earns nothing — the reason, the
alternative you rejected, and the thing that will look wrong to whoever reads
this in six months are what is worth writing down. Skip the body when the
subject genuinely covers it.

## House rules

- Good engineering, no over-engineering. Match the surrounding code.
- Prefer editing an existing file over adding a new abstraction layer.
- Keep `seed.js` deterministic — it seeds its own PRNG so everyone's database is
  identical apart from the dates. Never use `Math.random()` there.
- Do not commit `data/orbit.db`, `.screenshots/`, or Playwright artefacts.
- Do not introduce a state management library, an ORM, or a UI kit.
