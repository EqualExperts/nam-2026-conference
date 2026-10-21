# Put the workshop's hosts in the app: Jonas, Andy and Abraham

## What this changes
The demo is driven by six invented attendees. Three of them become the Equal
Experts people running the workshop, and the attendee switcher offers only
those three, so the room sees people it is about to meet.

- Amara Diallo (speaker 1, attendee 2) becomes **Andy Vays**, Technical
  Principal; Priya Venkatesan (speaker 2, attendee 6) becomes **Abraham Marín
  Pérez**, AI Software Engineer. Each keeps the slots, plan and seats of the
  person they replace; their photo, profile and talks are their own.
- Jonas Claesson (attendee 1) gets his photo, Equal Experts as company and AI
  Software Engineer as title.
- The switcher lists only Equal Experts attendees.

## Where
- `server/seed.js`
  - `SPEAKING_ATTENDEES` and `USERS`: the new profiles.
  - `assignSpeaker` takes an optional `talk` per pick (title, subtitle,
    abstract, takeaways, tags) and overwrites the generated session. It runs
    after generation and draws nothing from the PRNG, so the rest of the seed is
    unchanged.
- `public/avatars/speaker-001.jpg`, `speaker-002.jpg`, `attendee-001.jpg`, and
  entries 1 and 2 of `server/avatar-presentation.json`.
- `scripts/fetch-avatars.mjs`: `REAL` lists speakers 1 and 2, which are skipped
  even with `--force`.
- `src/components/UserSwitcher.jsx`: `HOST_COMPANY` filters the list.
- `.claude/rules/ui.md` § Imagery: real people who agreed to appear are the
  one exception to synthetic portraits.
- Tests: the `amara` and `priya` attendee keys become `andy` and `abraham`;
  the switcher test that picked Kenji picks Andy.
- Docs: `docs/context/seed.md`, `testing.md`, `ui.md`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| the three appear with their photos and profiles | reseed; `/api/users` and `/api/speakers/1`, `/2` return the new names, titles, companies and `/avatars/…` files | manual |
| Andy's and Abraham's sessions are theirs | their three and two sessions carry the written titles, abstracts and tags | manual |
| the switcher lists exactly the three | new spec: as Jonas the options are Jonas, Andy, Abraham; as Kenji, Kenji is also listed and selected | browser |
| the other attendees still serve the tests | `npm run verify` green | browser |

## Decisions
- Should Kenji, Sofia and Marcus be deleted? No. Every Playwright test gets its
  own attendee and day per project, and three attendees cannot hold all the
  lanes. They are hidden from the switcher instead; the tests sign in through
  localStorage and never pick from it.
- An attendee selected some other way (a test, a browser left on Kenji) stays in
  the list while selected, so it can be switched away from.
- Talks are written from public material: Andy's LinkedIn posts and a CRM
  Success Show episode; Abraham's blog posts at cosotateam.com and his Winnow
  project. Andy's socials are left empty except LinkedIn, since no other
  handles of his were found and the app does not invent them.

## Out of scope
Replacing Kenji, Sofia or Marcus. A login or any real authentication.
