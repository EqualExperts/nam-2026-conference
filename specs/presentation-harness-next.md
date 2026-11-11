# End the engineering talk on where the harness goes next

## What this changes
The room is senior developers and tech leads, not the mixed audience the ending
was written for. They have just watched ship take a ticket to a reviewed pull
request; "now take a ticket and ship it" (*Many at once*, *Your role*, *Now you*)
tells them nothing new and walks them through clicks they do not need.

Those three chapters are replaced by five that end on a question instead of a
tutorial:

1. **7 · Who tests the harness?** Evals: the same past tickets run through
   ship v1 and ship v2, five runs each, into a scorecard of correctness,
   reliability across runs, cost and hand-backs to a person. Punchline: *Stop
   guessing whether your agents are getting better. Measure it.*
2. **8 · What happens when AI ships a bug?** Closed-loop learning: Ship →
   Discover → Investigate → Learn → Prove → Ship, with the eval suite from 7 in
   the middle, since a regression case feeds it and Prove runs it. Marked
   honestly as today or next (below). Punchline: *Every escaped defect is a
   chance to improve the system, not just fix the code.*
3. **9 · Think you can improve the harness?** Three invitations: *make it
   smarter*, *make it leaner*, *prove it's better*, each naming where in
   `.claude/workflows/ship.js` to start. Then: *The harness isn't finished.
   What would you change?*
4. **10 · Ship in waves** — the unlock: agents work while you are away from
   the laptop, if the thinking is done up front and the work is sliced so they
   never wait on each other: one wide change everything depends
   on, against a small shared ticket first and the rest side by side, with
   `Depends on` stacking what truly needs it.
5. **11 · Before lunch** — just the one ticket: start ship on the fork's issue, in Claude Code (or
   the Code tab of Claude Desktop), pick a run (Fast for the workshop, or
   Sized, Small, Full), and see it running before you leave. After lunch there is a pull request waiting to merge. Setup, if not
   done, is the README's onboarding prompt; nothing new. The closing credits
   and repo link move here from *Your role*.

## Where
- `src/components/presentation/next.jsx` — the five new chapters (`NEXT`).
- `src/components/presentation/after.jsx` — `scale`, `role` and `lab` and their
  helpers removed; it keeps needs-human, review and merge.
- `src/components/presentation/chapters.js` — `AFTER` then `NEXT`.
- `context/engineering-context/ui.md` — how the talk ends.

## Decisions
- **Today vs next is drawn, not implied.** What exists: ship's Learn station
  turns what its audits caught into context, and a review or QA failure on a
  ship PR is labelled `harness-escape` and `learn-escape.yml` proposes a lesson
  PR. What does not: production incidents feeding back, tracing a defect to the
  run that shipped it, regression cases, and an eval suite that proves a
  harness change before a person approves it. Nodes and the scorecard carry a
  *today* / *next* marking so the slide never claims the second list.
- **Illustrative, not data.** The eval grid and scorecard are a drawn example
  (bars, no dollar figures or percentages) and say so on the slide. The v2 in
  it wins on reliability and loses on cost, because a trade-off you can now
  see is the point, and a clean sweep would read as a sales slide.
- **The challenges point at real code.** Gates and lenses (`codeLenses`),
  sizes and models (`TIERS`) are in `ship.js`; closed issues with merged PRs
  are the historical tickets an eval would replay.
- **Example tickets are numbered after #140** (#150–#158 in the waves, the
  past #64–#71 in the evals). A fresh fork's #1 is the issue the room ships
  at lunch, so the slides never draw a different #1.
- The lab's GitHub and Claude Desktop mock-ups go; `apps.jsx` stays, as the
  intro still draws them.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| The deck still opens, navigates, deep-links and ends on its last beat | existing `tests/presentation.spec.js` | Playwright spec |
| Each new beat renders with no console error at projector size | `npm run shot` on each new `?beat=` | screenshot |
| Beat maths unaffected | `tests/unit/presentation.test.js` | unit |

No issue for this change; the spec is named by slug.
