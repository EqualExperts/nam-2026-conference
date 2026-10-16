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
and a caption explains the step. ← goes back, Home/End jump, F goes full
screen, and `?beat=n` (1-based, the number on the counter) deep-links a beat so
a presenter can resume.

## Where
- `src/pages/PresentationPage.jsx` — the page: beat state, keys, progress bar, the
  captions. Rendered **outside** `<Layout>` in `src/App.jsx`, so it is full screen
  with no header or footer.
- `src/components/presentation/` — the scenes (the issue, the two starts, the flow
  map, ship's steps, sizing, review/QA, scale).
- `src/lib/presentation.js` — pure beat navigation (clamp, parse `?beat=`, key →
  action, flat index → chapter), unit-tested.
- `src/index.css` — the `pz-*` keyframes used inside a beat, all switched off by
  the existing reduced-motion block.
- `package.json` — adds `motion` (Motion for React).
- `tests/unit/presentation.test.js`, `tests/presentation.spec.js`.
- `docs/context/ui.md` and `architecture.md` — the route and where it lives.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Beat maths: clamps at both ends, `?beat=` parsed and bounded, keys map to moves | `beatAfter`, `parseBeat`, `keyAction`, `locateBeat` | unit |
| `/presentation` renders full screen with no app chrome and no console errors | heading visible, no `banner`/`contentinfo`, no page errors | Playwright spec |
| → advances, ← goes back, the counter and URL follow | press keys, read `presentation-counter` and `?beat=` | Playwright spec |
| `?beat=n` opens on that beat; out of range opens the first | visit `?beat=6` → counter `6 /`; `?beat=9999` → `1 /` | Playwright spec |
| End/Home, the buttons and the chapter bar all navigate | press and click, read the counter and `aria-current` | Playwright spec |
| Reduced motion still shows every caption | emulate `reducedMotion: 'reduce'`, caption visible | Playwright spec |

## Decisions
- Desktop-first: it is shown on a projector. On a phone it still renders and
  navigates (tap to advance) without horizontal scroll, but is not laid out for it.
- Content stays true to what the harness does today — the numbers (round limits,
  typical costs, PR #96 at $0.91 and #97 at $7.99) are `docs/harness/README.md`'s, and model
  names are the family (Opus, Sonnet, Haiku) rather than a version that will date.
- Motion (`motion/react`) for the springs, the chapter fly-through and the
  camera zoom. The first draft was CSS only; it was asked to look far more
  impressive, and springs and shared transitions are what CSS cannot do well.
  Motion is not a component kit or a state library, and it stays inside
  `/presentation` — the app's own motion remains CSS. Reveal.js was rejected:
  it is built around slides, and this is meant not to be a slide deck.
- **26 beats, not 43.** The first cut ran long for a thirty-minute slot in which
  some steps are demonstrated live, so it was cut: one beat per chapter where
  the scene can carry it, and ship's ten stations shown in eight stops (spec
  audit and learn folded into neighbouring captions). Every station stays on
  the rail. The removed scenes are in `b5e8107` if one is wanted back.
- **The README points at the talk instead of explaining the harness.** The how
  stays in `docs/harness/README.md`, which now also holds the two real tickets
  (#96, #97) the talk quotes; the laptop walkthrough moved to
  `docs/harness/quickstart.md`.
- No issue for this change; the spec is named by slug rather than number.
