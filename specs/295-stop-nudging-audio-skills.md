# Stop pointing attendees at /setup-winnow and /listen-to-meeting

## What this changes
Nothing in the workshop-facing material steers an attendee to `/setup-winnow`,
`/listen-to-meeting`, the audio setup, or the demo transcript. The README, the
three onboarding messages, the quickstart, the product talk's "ways" scene and
the UI doc stop naming them. The skills under `.claude/skills/` are untouched.

## Where
- `README.md` line 51 — `claude    # then /setup-winnow, and say no to audio` becomes `claude`.
- `ONBOARD_CLAUDE.md` ~809 ("All pass") — keep "carry on in this session", drop the `/setup-winnow` clause.
- `ONBOARD_CLAUDE.md` ~830 (restart message) — end after "start Claude again in the project folder ...".
- `ONBOARD_CLAUDE.md` ~889 ("You're ready!") — drop the **First:** paragraph and the demo-transcript pointer; reword so `/ship <ticket number>` and the token heads-up read naturally; check the "Rules for the hand-off" below for a reference to **First:**.
- `context/engineering-context/harness/quickstart.md` — remove item 3 (Listen live), "three levels" becomes "two", check the rest of the file for a third-level reference.
- `src/components/presentation/product/intro.jsx` ~195 (`WaysScene`) — remove the `/setup-winnow` span and the now-orphaned `·` separator so the line stays centred.
- `context/engineering-context/ui.md` ~218 — drop the sentence naming `listen-to-meeting`; keep the rule that the talk states only what winnow, create-tasks and update-context do.
- `tests/presentation.spec.js` ~185 — pattern becomes `/listen-to-meeting|setup-winnow|live listening/i`; test title adjusted. Uses the existing `/product-presentation` walk, no lane needed (read-only).
- Tracker check (read only): `.claude/skills/winnow`, `create-tasks`, `winnow-setup-tracker` — report in the PR what was found.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| The grep over `README.md ONBOARD_CLAUDE.md context src` returns nothing, and is pasted in the PR | run the command; the only hit allowed is in `tests/presentation.spec.js` | command (PR body) |
| No page of the product talk mentions `/setup-winnow`, asserted | `presentation.spec.js` beat walk with `setup-winnow` in the forbidden pattern (fails on main: the WaysScene line renders it) | spec |
| README and onboarding messages lead fork to ready, no dead reference | read the edited passages; grep the files for `First:` and `audio` | reading |
| Quickstart reads complete with two levels | read the section; grep for "three", "third", "Listen" | reading |
| `.claude/skills` and `apm.lock.yaml` unchanged | `git diff --stat main -- .claude/skills apm.lock.yaml` is empty | command |
| `npm test` and `npm run verify` pass | the gate | gate |

## Decisions
- Only the product talk is walked by the spec; the engineering talk is covered by the grep over `src`, not by a browser assertion. OK?
- Wording of the reworded "You're ready!" message is mine, keeping the `/ship` line and token heads-up as-is. OK?

## Out of scope
Any change to a skill, `apm.lock.yaml`, `tests/unit/gitignore.test.js`, or `specs/`.
