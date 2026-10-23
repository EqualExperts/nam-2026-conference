# Trim the README to setup and the two talks

## What this changes
The README is the first thing a workshop attendee opens after forking. It now
says what the repo is, links the two talks (product, then engineering), and
gives the fork and laptop setup — then hands over to
`docs/harness/quickstart.md`, which already walks through winnow, ship and
review in more detail. The README's own copy of that walkthrough (steps 3–5)
goes, so the two cannot drift apart.

It also says, in one line, that My Agenda is blank on purpose: building it is
the workshop.

## Kept
- The `#set-up-your-fork` anchor — the quickstart links to it.
- `/setup-winnow` in the laptop step (the README skill check reads it).

## Tests
`tests/unit/demo-transcript.test.js` checked that the README linked the demo
transcript from its winnow step. That step now lives only in the quickstart,
so the test checks the quickstart's product-harness section instead.
