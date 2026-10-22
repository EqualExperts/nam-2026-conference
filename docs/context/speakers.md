---
area: speakers
summary: The speakers index (a headliner carousel, then an A–Z long tail) and each speaker's profile with their sessions — plus the follow endpoints, which have no UI yet.
read_when: touching /speakers or /speakers/:id, SpeakerCard, SpeakerSpotlight, speaker filters or sort, the "This is you" marker, or following a speaker
files:
  - src/pages/SpeakersPage.jsx
  - src/pages/SpeakerPage.jsx
  - src/components/SpeakerCard.jsx
  - src/components/SpeakerSpotlight.jsx
  - server/routes/speakers.js
tests:
  - tests/speakers.spec.js
  - tests/api/endpoints.test.js
  - tests/api/contracts.test.js
related: [seed, ui, agenda, architecture]
---

# Speakers

## How it works

**API — `server/routes/speakers.js`.**

- `GET /api/speakers` builds its SQL per request (one of the allowed exceptions
  to module-scope `prepare`). Query params, all optional:
  `q` (LIKE over `name`, `company`, `job_title`, `expertise`), `featured=true`,
  `firstTime=true`, `country`, `day` (speaks that day), `trackSlug` (speaks in
  that track). The two last are `EXISTS` subqueries over `session_speakers` →
  `sessions` (→ `tracks`). Rows are `LEFT JOIN`ed to sessions to add
  `sessionCount` and `keynoteCount`, ordered `featured DESC`, then the hosts
  (speakers an attendee's `speaker_id` points at) by id — the seed's billing
  order, Andy before Abraham — then `name`. Mapped by
  `toSpeaker(row, extra)` in `server/lib/query.js`.
- `GET /api/speakers/:id` → `toSpeaker` plus `sessions` (full `toSession` rows,
  ordered by day, start), `followerCount` (from `speaker_follows`) and
  `keynoteCount`. 404 `{ error: 'Speaker not found' }`.
- The list response has **no `sessions` array**; the detail response has **no
  `sessionCount`**. `SpeakerCard` reads `sessionCount ?? sessions?.length`.
- `speakers.avg_rating` is not set here — it is recomputed from session ratings
  in `server/lib/attendance.js` (and at seed time). See CLAUDE.md § Nothing may
  claim to be true.

**Follows** live in `server/routes/users.js`, not here:
`PUT` / `DELETE /api/users/:id/follows/:speakerId` (table `speaker_follows`,
`INSERT OR IGNORE`). `GET /api/users/:id` returns `followedSpeakers`, and
`GET /api/sessions?followedBy=<userId>` lists the sessions of speakers that user
follows. Client: `api.followSpeaker`, `api.unfollowSpeaker`,
`api.getFollowedSessions`. **No UI uses any of it yet** — there is no Follow
button, no follow state in the store and no following view; the endpoints are
there for workshop teams to build on. The profile's follower count is seeded
data (`followerCount`) and is shown.

**`SpeakersPage` — URL params** (`useSearchParams`, `'all'`/empty deletes the
key): `q`, `track` (sent as `trackSlug`), `day`, `show`
(`all | keynotes | first-time`), `sort`
(`featured` default | `sessions` | `rating` | `name`).

- Server-side: `q`, `trackSlug`, `day`; `show=keynotes` → `featured=true`,
  `show=first-time` → `firstTime=true`. The "Keynotes" chip therefore filters
  on the **`featured` flag**, not on `keynoteCount`.
- Client-side (in the `all` memo): every `sort` except `featured` re-sorts
  (the server order *is* "featured").
- `narrowed` = any of `q`, `track`, `day`, `show` set. Sort does not count.
- The empty state heading is `No speakers match “<q>”` when a search is active, plain `No speakers match` otherwise.

**Tiering** (two sections, each self-hides when empty):

| Section (testid) | Who | Renders as |
| --- | --- | --- |
| `headline-speakers` | `featured`; **only when not narrowed** | `SpeakerSpotlight` |
| `all-speakers` | not featured, or everyone once narrowed | `AlphabeticalList` if not narrowed and `sort=featured`; otherwise one flat `compact` grid |

`AlphabeticalList` (local to the page) groups by first letter, renders a sticky
jump bar of 26 buttons (`aria-label` "Jump to X" / disabled "No speakers under
X") and `#letter-X` anchors. The count in `all-speakers` is
`data-testid="speaker-count"` and counts only that section.

**`SpeakerCard`** — `variant="grid"` (default: avatar, title, company, two
expertise chips, session count, city, a Keynote / Featured badge) or
`variant="compact"` (one line: small avatar, name, session count if > 1). Both are a `Link` to `/speakers/:id`.

**`SpeakerSpotlight`** (`data-testid="speaker-spotlight"`) — takes
`speakers`, holds `index` / `paused`. Autoplays every `ROTATE_MS` (7000) via
`setInterval`; never if `prefers-reduced-motion`, or fewer than 2 speakers.
Pauses on hover/focus and permanently on any manual control (arrows, filmstrip,
←/→ keys when the section has focus). Filmstrip is `role="tablist"` of
`role="tab"` buttons with `aria-label` = name and `aria-selected`. Next button
is `data-testid="spotlight-next"`. Uses `animate-ken-burns`, `animate-slide-in`,
`animate-fade-zoom`, `animate-fill`, and `GeneratedCover variant="mesh"`;
falls back to `Avatar` when `imageUrl` is null. The heading is the speaker name.

**`SpeakerPage`** (`data-testid="speaker-detail"`) — `useFetch(api.getSpeaker,
[id])`. An unknown id (`error.status === 404`) renders `NotFoundState`
("Speaker not found", back to `/speakers`) instead of `ErrorState` — a 404
can never succeed on retry; any other failure still shows `ErrorState` with
"Try again". Header uses `GeneratedCover variant="strata"`; name is
`data-testid="speaker-name"`. When the signed-in attendee *is* this speaker
(`currentUser.speakerId === speaker.id` — `toUser` maps `speakerId` and
`isSpeaker`), a `This is you` chip (`speaker-is-you`) leads the badge row; it is
a plain marker over the same page, not a speaker dashboard. The way there is
`UserSwitcher`'s `Your speaker profile` link (`own-speaker-profile`), shown only
while `currentUser.isSpeaker` (`tests/switcher.spec.js`). Socials (`SOCIALS` +
`handleOf`) render as plain spans with `BrandIcon`, never links. Sessions are
grouped by `day` with `dayLabel` and rendered as `SessionCard` in a
`grid-flow-row-dense` grid.

## Invariants

- Without narrowing, a featured speaker appears only in the spotlight, never
  also in the list.
- When narrowed, featured speakers must fall into `all-speakers` — otherwise
  `show=keynotes` renders nothing (tested).
- Every speaker has a portrait at `/avatars/speaker-NNN.jpg` and pronouns
  starting `he/` or `she/`, and every speaker has at least one session (tested
  against the seed).
- Filter chips and filtering options come from `useConference()` (`tracks`,
  `days`); do not refetch them.

## Gotchas

- `SearchInput`, `Select` and `ChipGroup` are in `src/components/FilterBar.jsx`,
  shared with the schedule — changing them affects both pages.
- Follows are shared DB state: a test that follows must use a different
  attendee per project and unfollow afterwards.
- `sort=rating` sorts by `speakers.avg_rating`, which is 0 for anyone not rated
  on Day 1 morning — most of the list.
- `GET /api/speakers?country=` exists but the page has no control for it.

## Where to change…

- A new filter: add the param to `speakersRouter.get('/')` (as a bound `?`),
  then a `ChipGroup`/`Select` and the `useFetch` args + deps in `SpeakersPage`.
- A new sort: the `all` memo in `SpeakersPage` and the `Select` options.
- A new field on a card: add the column to `toSpeaker` first, then `SpeakerCard`.
- Carousel timing or behaviour: `SpeakerSpotlight` (`ROTATE_MS`, the effects).
- Following from the UI: nothing exists yet — call `api.followSpeaker` /
  `api.unfollowSpeaker` and keep the state in the store (`src/lib/store.jsx`),
  like reservations, so every view agrees.
