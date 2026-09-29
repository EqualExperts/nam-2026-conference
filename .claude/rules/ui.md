---
paths:
  - "src/**"
  - "public/**"
  - "index.html"
  - "vite.config.js"
  - "server/seed.js"
  - "server/avatar-presentation.json"
  - "scripts/fetch-avatars.mjs"
---

# UI rules

Loaded when you read a file under `src/` (and the imagery sources). The
decisions every change must respect are in `CLAUDE.md`; these are the ones only
UI work needs.

## Conventions

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
