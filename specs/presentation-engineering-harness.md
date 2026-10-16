# A presentation of the engineering harness at /presentation

## What this changes
A full-screen, keyboard-driven presentation at `/presentation` that walks
through the engineering harness end to end — about thirty minutes of talk. It is
part of the app on purpose: anyone who opens the deployed site can see it, so it
is not an asset that lives on one presenter's laptop.

It starts where the product harness stops — a GitHub issue with a **Done when**
list — and follows the ticket through:

1. the issue arriving;
2. the two ways to start it (`ready-for-ai` on a GitHub Actions runner, or `/ship`
   in Claude Code);
3. the whole flow at a glance, then a zoom into ship;
4. each ship step — setup and sizing, spec, spec audit, implement (failing test
   first), the gate and red-check, the code audit with its skeptic, the fix loop,
   learn, the pull request;
5. the right model for the job — Opus at setup decides, Sonnet and Haiku for
   small, mechanical work, Opus throughout for full tickets, escalation on evidence;
6. the hand-back: `needs-human`, a draft PR, a person answers and relabels;
7. code review and QA on runners, each posting a **confidence** — high on both and
   a person can merge on sight, low reads *unproven* and gets a manual review;
8. the merge, the deploy and what it cost;
9. running many at once — `/ship 64 65 … 73`, or ten labels and ten runners;
10. why you can trust what comes back.

It is not a slide deck. One scene holds a single map of the flow; each press of
→ / Space / click moves a *beat* — the camera pans and zooms, pieces animate in,
and a caption explains the step. ← goes back, Home/End jump, `?beat=n` deep-links
a beat so a presenter can resume.

## Where
- `src/pages/PresentationPage.jsx` — the page: beat state, keys, progress bar, the
  captions. Rendered **outside** `<Layout>` in `src/App.jsx`, so it is full screen
  with no header or footer.
- `src/components/presentation/` — the scenes (the issue, the two starts, the flow
  map, ship's steps, sizing, review/QA, scale).
- `src/lib/presentation.js` — pure beat navigation (clamp, parse `?beat=`, key →
  delta), unit-tested.
- `src/index.css` — a few keyframes the scenes share, all switched off by the
  existing reduced-motion block.
- `tests/unit/presentation.test.js`, `tests/presentation.spec.js`.
- `docs/context/ui.md` and `architecture.md` — the route and where it lives.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Beat maths: clamps at both ends, `?beat=` parsed and bounded, keys map to moves | `nextBeat`, `parseBeat`, `keyDelta` | unit |
| `/presentation` renders full screen with no app chrome and no console errors | heading visible, no `banner`/`contentinfo`, no page errors | Playwright spec |
| → advances, ← goes back, the counter and URL follow | press keys, read `presentation-counter` and `?beat=` | Playwright spec |
| `?beat=n` opens on that beat | visit with `?beat=5`, counter reads 6 | Playwright spec |
| Reduced motion still shows every caption | emulate `reducedMotion: 'reduce'`, caption visible | Playwright spec |

## Decisions
- Desktop-first: it is shown on a projector. On a phone it still renders and
  navigates (tap to advance) without horizontal scroll, but is not laid out for it.
- Content stays true to what the harness does today — the numbers (round limits,
  typical costs, PR #96 at $0.91 and #97 at $7.99) are the README's, and model
  names are the family (Opus, Sonnet, Haiku) rather than a version that will date.
- No animation library: CSS transitions driven by the beat index, as the house
  rules ask.
- No issue for this change; the spec is named by slug rather than number.
