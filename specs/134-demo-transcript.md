# Add a demo transcript so attendees can try winnow without their own input

## What this changes
An attendee with no idea or meeting of their own can run `/winnow docs/demo/winnow-transcript.txt` straight away. The README's winnow section links to the file and says what it is. The file is the voice-note transcript from the ticket, verbatim, under a short header: what it is, that it came from a voice note transcribed locally with Whisper `small`, and how to use it. App, API, seed and tests are untouched.

## Where
- `docs/demo/winnow-transcript.txt` — new, plain text. Header (a few lines, ending in a clear divider), then the issue's transcript block copied byte for byte from the ticket's `<details>` code fence (opening chatter included). `docs/demo/` is outside `docs/context/` (the context index reads only that folder), `src/`, `server/` and `tests/`.
- `README.md` — the "Then label the issues" paragraph after the winnow table (~line 151-154, "First time?"): add a sentence linking `docs/demo/winnow-transcript.txt` as a ready-made input. Also add a short line under item 2 "Process a transcript" (~line 231) with `/winnow docs/demo/winnow-transcript.txt`.
- `tests/unit/demo-transcript.test.js` — new, plain `node:test`, no lane or helpers (reads files only); asserts the points in the table.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Transcript committed at a stable path, verbatim, with the short header | test reads `docs/demo/winnow-transcript.txt`: exists, header names a voice note, Whisper and `/winnow docs/demo/winnow-transcript.txt`, body keeps the opening line "Play it again because like is rubbish" and the closing line "Behavior depending on the order of your actions" | unit |
| README links to it from the winnow section | test reads `README.md` and asserts the winnow section (from "product-side skills" to "Set up your fork") contains the path `docs/demo/winnow-transcript.txt` | unit |
| `/winnow` on it works in a fresh checkout without any other file | test asserts the header refers to no path other than the transcript itself and the file is tracked (`git ls-files`) | unit |
| `npm test` is unaffected | `npm test` passes with the new test included; no file under `src/`, `server/`, `tests/helpers.js` changes | unit |

The audio file stays out: the test also asserts `git ls-files` lists no `.m4a`.

## Decisions
- Put it at `docs/demo/winnow-transcript.txt`, a new folder next to `docs/context/` and `docs/harness/` — OK?
- Use `.txt` rather than `.md`, so the verbatim text is not rendered or reflowed as Markdown — OK?

## Out of scope
`audio_message.m4a`; implementing any of the four tasks in the transcript; fixing the `seats.md` waitlist/overlap discrepancy.
