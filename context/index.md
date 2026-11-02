# Context

Everything an agent — or a person — needs to know about this project that the
code cannot tell them. Product and engineering keep their knowledge side by
side here, so a conversation can become a ticket, the ticket can become code,
and the code can be checked against what the conversation decided.

Every folder has an `index.md` like this one. Read the index, pick the one or
two documents it points to, and read those — not the whole folder. That is how
it stays usable as it grows.

| Folder | Holds | Owned by | Read when |
| --- | --- | --- | --- |
| [`product-context/`](product-context/index.md) | Who the app is for, what it does and why — the product decisions | product | shaping a ticket, judging whether a request fits the product |
| [`engineering-context/`](engineering-context/index.md) | How the app is built: one doc per area, the data model, and the harness that builds it | engineering | changing code, writing tests, working on the harness |
| [`winnow-transcripts/`](winnow-transcripts/index.md) | A record of each conversation Winnow processed — what was raised, decided, turned into tickets, or left out | whoever ran Winnow | wondering why something was (or was not) built |

## What goes where

This is the doc map Winnow and `update-context` follow.

- **A product fact or decision** — who uses the app, a goal, a rule about what
  the app must or must not do, a feature deliberately left out →
  `product-context/` (`prd.md`, or `user-personas.md` for who uses it).
- **How something works in the code** — a file, a function, a payload, a test
  id, a gotcha → the `engineering-context/` doc for that area
  (`node scripts/context.mjs for <file>` names it).
- **How the harness works** — ship, code review, QA, labels, secrets →
  `engineering-context/harness/`.
- **A rule every change must follow, and why** → `CLAUDE.md` at the repo root,
  which links here for the detail. Do not repeat one in the other.
- **What a conversation decided, including what it decided not to do** →
  one record in `winnow-transcripts/`.
- **Work to do** → a GitHub Issue, never a file here.
