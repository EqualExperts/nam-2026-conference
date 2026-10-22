# Scale the app back so workshop teams build the agenda experience

## What this changes
The app is the starting point for a workshop in which teams turn a client
conversation into tickets and let the harness build them. It had grown to
answer most of what a team would build itself: a personal Home ("Your day",
suggestions, a live strip, a speaker strip, sessions from speakers you follow),
a full My Agenda (next up, stats, clashes, a speaker panel, a to-rate callout,
calendar export) and following speakers. A team that opens it finds the work
already done.

This takes those *pages* back to a blank canvas and keeps every *rule* and
endpoint underneath them, so a team's tickets range from small (UI on an
endpoint that already exists) to large (a new rule in the API):

- **My Agenda** (`/my-agenda`, still in the nav) is an empty page saying it is
  coming soon. `/my-plan` still redirects to it.
- **Home** is static: the hero bar, a set of links into the app (Schedule,
  Speakers, Venues, Food, Expo), the latest posted announcement and the sponsor
  marquee. Nothing on it is about the signed-in attendee.
- **Following speakers** has no UI: no Follow button, no followed tier or
  `show=following` view on `/speakers`, no "Following" badge on cards. The
  follower count on a profile stays — it is seeded data.
- **The speaker view** moves to the speaker's own profile, kept plain: signed in
  as a speaker, `/speakers/<your id>` says "This is you" over the session list
  it already shows, and the attendee menu links to it. A team can build a
  better one.

Unchanged: Schedule (filters, grid/list, the "My agenda" count in the rail,
whose link now opens the placeholder), Session (seat panel, clash dialog,
check-in and rating, reviews, travel notice), Venues, Food, Expo, the static
pages and both presentations.

## Kept on purpose
- Every server route and rule: seats, waitlist, clashes, check-in, ratings,
  follows, `/users/:id/today`, `/users/:id/schedule`, `/live`, the `.ics`
  exports — and their API tests.
- The matching functions in `src/lib/api.js` (`getToday`, `getSchedule`,
  `getFollowedSessions`, `followSpeaker`, …), so a UI ticket does not have to
  start with plumbing.
- The reservation store (`toggleSeat`, `reservationFor`, `onAgenda`) — adding a
  session still takes a seat everywhere.

## Removed
`MyAgendaPage`'s contents, `TodayPanel`, `NextUpCard`, the `LiveNow` strip
(`LiveBadge` stays — cards and the venue board use it), the follow state in the
store, and the specs that tested those screens (`plan.spec.js`, most of
`home.spec.js`, the follow tests in `speakers.spec.js` and `live.spec.js`, the
live-strip tests). They are in git history if a team wants to see how it was
once done.

## Done when
- `/` shows no personal or live section, and links to every main page.
- `/my-agenda` renders a "coming soon" placeholder, in the nav, on desktop and mobile.
- No Follow control appears anywhere; `/speakers` is featured headliners then A–Z.
- Signed in as Andy, his own profile is marked as him and the attendee menu
  links there; on anyone else's profile, and for a non-speaker, neither appears.
- `npm test` and `npm run verify` pass.
- `CLAUDE.md`, `.claude/rules/ui.md` and the context docs describe the app as it
  now is, and name the endpoints that have no UI yet.
