# Follow a speaker from wherever they are shown, not only their profile

## What this changes

A Follow / Following toggle sits on the Featured speakers carousel (beside
"View profile"), on every grid `SpeakerCard` on `/speakers`, and on each speaker
in a session page's Speakers section. It calls the store's `toggleFollow`, so the
profile button, the card's "Following" badge, `?show=following` and the home
page's "From speakers you follow" all change at once, with no reload. The button
is a sibling of the card's link, never nested in it: pressing it follows and
stays on the page, and the rest of the card still opens the profile. Its name is
"Follow <name>" / "Following <name>" with `aria-pressed`.

## Where

- `src/components/FollowButton.jsx` (new) — `FollowButton({ speaker, size })`:
  a `Button` from `ui.jsx` reading `isFollowing` / `toggleFollow` from
  `useConference()`, `aria-pressed`, `aria-label` = `Follow|Following ${name}`,
  `data-testid="follow-toggle"`, the same bell/check icon as `SpeakerPage`.
- `src/components/SpeakerCard.jsx` — grid variant: the outer `Link` becomes a
  `relative` `div`; the name `Link` gets a stretched `after:absolute after:inset-0`
  so the whole card still opens the profile; `FollowButton` sits in the card body
  as `relative z-10`, in normal flow (not absolute) so it cannot overlap the
  badges or text. The compact variant is unchanged.
- `src/components/SpeakerSpotlight.jsx` — `FollowButton` beside the "View profile"
  `Button`. It is inside the `<section>` whose `onMouseEnter` / `onFocusCapture`
  already pause autoplay, so no new pause logic.
- `src/pages/SpeakersPage.jsx` — `headline` drops `!followingIds.has(s.id)`
  (see Decisions), so following a headliner does not pull them out of the
  carousel under the cursor.
- `src/pages/SessionPage.jsx` — the Speakers section's per-speaker `Link` gets the
  same stretched-link treatment and a `FollowButton` under the bio.
- `docs/context/speakers.md` — `SpeakerCard`, `SpeakerSpotlight` and Tiering
  parts, and the first Invariant.
- Tests: `tests/speakers.spec.js`, a new `describe('Following from where the
  speaker is shown')`. One attendee per project as the existing follow tests do
  (`ATTENDEES.marcus` desktop, `ATTENDEES.kenji` mobile, via `visit(page, path,
  { as })`), a speaker per test that is not 3 or 9 (the other follow tests' ids)
  and not already followed, and `request.delete(`${API}/users/${user}/follows/${id}`)`
  afterwards. Do not use sofia/abraham — `home.spec.js` rewrites their whole
  follow set.

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| Carousel Follow follows without navigating and reads Following | jump to the chosen headliner by filmstrip tab; click `follow-toggle` in `speaker-spotlight`; URL still `/speakers`, `aria-pressed="true"`, text "Following", spotlight heading still that name | spec |
| Grid card toggle follows/unfollows without opening profile | follow via API, visit `/speakers`; click the card's `follow-toggle` in `followed-speakers`; URL still `/speakers`, the card leaves the section | spec |
| Session page Speakers section has the toggle | visit `/sessions/:id` of a session with a speaker; `getByRole('button', { name: 'Follow <name>' })` visible and clicking it sets `aria-pressed="true"`, URL unchanged | spec |
| Reflected everywhere without reload | after following on the session page, navigate by in-app links only (no `goto`/`reload`): the profile's `follow-speaker` is pressed; `/speakers` shows the card with its Following badge; the Following chip lists them; the home page's `followed-sessions` lists a session of theirs | spec |
| Rest of the card still opens the profile | click a grid card's name / avatar, and a session-page speaker's name → URL `/speakers/<id>` | spec |
| Keyboard-reachable, named, `aria-pressed` | focus the session-page toggle with Tab from the speaker link, press Enter → `aria-pressed` flips; accessible name matches `Follow <name>` | spec |
| Carousel stops rotating while Follow is focused/hovered | `page.clock.install()` before `visit`; focus (desktop: hover) the carousel `follow-toggle`, `page.clock.runFor(ROTATE_MS * 2)`, heading unchanged | spec |
| No overlap at mobile width | in the mobile project, the `follow-toggle` bounding box intersects neither the card's name heading nor its badges, on a grid card and a session-page speaker | spec |

## Decisions

- On main a followed headliner leaves the carousel (it moves to the Following
  section), so "then reads Following" could never be seen. This build keeps every
  headliner in the carousel whether followed or not, and a followed headliner
  also shows in the Following section — the "only in `followed-speakers`"
  invariant is relaxed for the carousel. OK?
- Grid `SpeakerCard`s on `/speakers` only render in the Following section today,
  so that toggle only ever unfollows, and the card then leaves the section. No
  grid cards are added for unfollowed speakers. OK?
- One shared `FollowButton` for the three places; the profile keeps its own
  button (`follow-speaker`) untouched. OK?

## Out of scope

The compact name index, avatar stacks on session cards, and the follow toast's
wording (it stays `toggleFollow`'s).
