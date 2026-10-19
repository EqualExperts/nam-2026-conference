# Replace the demo transcript with a short one about search filtering

## What this changes
`docs/demo/winnow-transcript.txt` becomes a short header plus the ticket's
transcript (0:02 to 0:40, verbatim, "philtre" slips included): one request, let
the schedule's track filter take several tracks. None of the old transcript
remains. No app, API, seed or other test behaviour changes; the feature itself
is not implemented.

## Where
- `docs/demo/winnow-transcript.txt` — replace the whole file. Header keeps the title line, the `/winnow docs/demo/winnow-transcript.txt` usage line and the `----` divider; drops "voice note" and "Whisper (small)" and the "opening recording chatter" claim, saying instead that it is a short, rough transcript of one small change.
- `tests/unit/demo-transcript.test.js` — first test asserts header mentions `transcript` instead of voice note/whisper; second test asserts the body includes `So let's take a look at the website.` and ends with `see the talks on those tracks that I have selected.`, and that `Play it again because like is rubbish` is absent. Run with `npm test`; no lane or helpers (pure file read).
- `README.md` lines 34-35 and `docs/harness/quickstart.md` lines 40-44 — read: they only give the command and link, describe no contents, so they stay as they are.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| file holds a short header and exactly the transcript, none of the old | updated tests: body ends with the 0:40 line, includes the 0:02 line, lacks the old opening and a line after 0:40 (`0:47`) | unit |
| `npm test` passes with the test updated | `npm test` | unit |
| README and quickstart accurate | existing README-link test; both describe nothing contradicted by the new content (read) | unit |
| diff touches no file under `src/` or `server/` | `git diff --name-only origin/main` has no `src/` or `server/` path | gate |

## Decisions
- README and quickstart say nothing about the transcript's contents, so leave them unedited — OK?

## Out of scope
Implementing multi-track filtering (#139), mobile filters, any other search change.
