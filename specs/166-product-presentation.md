# Add the product harness talk at /product-presentation, handing over to the engineering talk

## What this changes
The workshop opens with Abraham's talk on the product harness and continues
with Jonas's on the engineering harness. Until now only the second existed. This
adds the first as `/product-presentation`, in the same visual language. Its
meeting produces ticket #140, the ticket the engineering talk opens on, and its
last beat hands straight over. The README becomes a fork-to-merged-ticket guide
that links to both talks.

## Where
- `src/components/presentation/Deck.jsx`: the engine `/engineering-presentation`
  ran on (formerly `src/pages/PresentationPage.jsx`), now shared. It takes
  `chapters`, `title` and an optional `next` (`{ to, label, delay }`). Past the
  last beat a forward press, a stage click or the scene's own button navigates
  there. With a `delay`, the scene is told it is `leaving` for its exit
  animation first. Reduced motion skips the animation, and going back during it
  cancels.
- `src/components/presentation/product/`: the product deck (`chapters.js`,
  `kit.jsx`, `intro`, `listen`, `winnow` and `raise` scenes).
- `src/components/presentation/issue.js`: `ISSUE_140`, the ticket text both
  decks render.
- `src/pages/ProductPresentationPage.jsx` and `PresentationPage.jsx`: one
  `<Deck>` each. The route in `src/App.jsx` sits outside `<Layout>`.
- `src/components/presentation/intro.jsx`: the engineering title gets Jonas's
  byline and the stacked two-harness line, mirroring the product title.
  `after.jsx` closes on "Have the conversation."
- `src/index.css`: new `pz-*` utilities, all covered by the reduced-motion block.
- `README.md` (rewritten around fork, set up, raise, ship, merge) and
  `docs/harness/quickstart.md` (links both talks); the two unit tests that read
  the README follow its new sections.
- Docs: `docs/context/ui.md`, `architecture.md`, `testing.md`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| opens on "The product harness", every beat renders, captions survive reduced motion | specs: title h1 and no chrome; walk every beat with no page errors and a caption where the beat has one; the flags visible with reduced motion | browser |
| the last beat hands over by button, key or stage click | specs: each lands on `/engineering-presentation`; reduced motion goes at once; going back during the exit stays put | browser |
| both titles name their presenter; #140 reads the same | `ISSUE_140` is the only source of the ticket text; screenshots of both title slides | manual |
| README walks a fork from setup to merge and links both talks | the README unit tests (transcript link in step 3; every slash command it names is a deployed skill) | unit |

## Decisions
- Should the product talk show labelling the issue `ready-for-ai`, or `/ship`?
  No. Both start the engineering harness, and the engineering talk's "Two ways
  in" chapter covers them, so the product talk ends at the created issue.
- One `Deck` rather than a copy of the page: the two talks have to feel like one
  show, and a copy would drift on the first change to either.
- The meeting is staged with the three hosts, and its numbers (timestamps, chunk
  counts, issue numbers in the duplicate search) are illustrative. Every
  behaviour shown was checked against the skills in `.claude/skills/`, and a
  fresh-context audit cross-checked it again.
- `Field` (the product title's orbits) is its own component rather than a
  parameterised `Orbits`, so the engineering title stays untouched beyond its
  byline.

## Out of scope
Recording either talk, speaker notes, and a combined single-URL deck.
