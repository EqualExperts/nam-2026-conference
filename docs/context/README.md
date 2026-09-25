# Context docs

A map of the app, one file per area, so an agent can find what it needs
without reading the source to work out how things fit together.

```bash
node scripts/context.mjs index                 # every doc, one entry each — start here
node scripts/context.mjs for <file…>           # which docs cover these files
node scripts/context.mjs check                 # every path a doc names exists (runs in npm test)
```

**`CLAUDE.md` says what was decided and why. These say where it lives and how
it works.** A rule belongs in `CLAUDE.md`; the function that enforces it, the
data it reads and the thing that breaks if you get it wrong belong here. Do
not repeat one in the other — link.

## Format

```markdown
---
area: seats                        # the slug `related` refers to
summary: One line — what this area is, in an attendee's terms where it has them.
read_when: touching reservations, the waitlist, the overlap guard, ConflictDialog
files:                             # what this doc owns; a trailing / owns a directory
  - server/lib/seats.js
  - src/components/SeatPanel.jsx
tests:
  - tests/api/seats.test.js
related: [attendance, agenda]
---

# Seats

## How it works        the flow, end to end, with file:function references
## Invariants          what must stay true, and what enforces it
## Gotchas             what an agent got wrong here before, or would
## Where to change…    the common tickets, and the file each one starts in
```

Sections are a guide, not a form — leave one out when it would be empty. Keep a
doc under about 120 lines; one that needs more is two areas.

## Keeping them true

The ship workflow's **Context** phase runs `for` over the files a branch
changed and updates exactly those docs, in the same pull request as the code.
Its **Learn** phase adds to *Gotchas* when an audit caught something a builder
should have known. A doc that disagrees with the code is worse than none —
it is read *instead of* the code.
