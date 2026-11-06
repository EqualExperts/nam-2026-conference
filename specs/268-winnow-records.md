# Have Winnow record each conversation in context/winnow-transcripts/

## What this changes
Winnow 0.11.0 writes a run log only when the project's context asks for one
(its Step 7), at the location the context names. Today nothing asks, so nothing
is written. `context/winnow-transcripts/index.md` becomes that ask: it states
that every Winnow run leaves one record, `YYYY-MM-DD-<title>.md`, in this
folder, with eight fields — title, date, participants, source, tickets raised,
context updated, what was set aside and why, and the Q&A — and that a field
Winnow cannot determine reads "Unknown". The "Planned" wording goes; the index
still lists `demo-transcript.txt`. `context/index.md` and `CLAUDE.md` stop
calling the records future.

## Where
- `context/winnow-transcripts/index.md` — rewrite the "Planned" block as the shipped record shape, file name and "Unknown" rule; keep the "In this folder" entry for `demo-transcript.txt`.
- `context/index.md` — the folder table row ("soon a record of each one") and the "What goes where" bullet ("once Winnow writes them (planned…)") drop the future tense.
- `CLAUDE.md` — the "Start from the context docs" sentence says the folder holds the conversations Winnow works from; add that it holds the record of each.
- `tests/unit/winnow-record.test.js` (new, plain `node:test` reading files like `tests/unit/demo-transcript.test.js`; no lane or DB needed) — pins the index.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Running Winnow on the demo transcript produces `YYYY-MM-DD-<title>.md` with all eight fields | `index.md` names the `YYYY-MM-DD-<title>.md` pattern and lists each of the eight field names (asserted by name); `context/index.md`'s map points records at the folder | unit |
| Fields the source does not give read "Unknown" | `index.md` states the rule: a field Winnow cannot determine reads "Unknown", not omitted or guessed | unit |
| `index.md` describes the shipped shape, no "planned" wording | `index.md` and the `winnow-transcripts` rows of `context/index.md` match no `/planned|soon|once winnow writes/i`; `demo-transcript.txt` is still listed | unit |
| `context.mjs check` and `npm test` pass | `node scripts/context.mjs check` (inside `npm test` via `tests/unit/context.test.js`) and the suite itself | unit |

All four rows are false on main: the index says "Planned" and names four
groups, not eight fields; `context/index.md` says "planned".

## Decisions
- The first two criteria describe what a Winnow run produces, which no check here can run (it needs a live agent session and the 0.11.0 skill). This build proves the instruction Winnow follows — the index it reads — not a real run; the first real run is the proof. OK?
- Winnow's Step 7 says the log never holds the raw transcript and that an index is the project's call, so the record describes the source (a path for the demo file, "inline" for a paste) and the index stays hand-written. OK?
- Q&A, and "Unknown" for undeterminable fields, go beyond what 0.11.0's Step 7 lists, so the index asks for them as the project's own addition rather than the skill text changing (out of scope). OK?

## Out of scope
Offering to commit or open a PR for the record; any change to Winnow's skill text.
