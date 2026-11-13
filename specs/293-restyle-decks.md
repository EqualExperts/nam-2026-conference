# Restyle the three presentations to match the NAM Conference 2026 deck

## What this changes
`/opening-presentation`, `/product-presentation` and `/engineering-presentation` look like the NAM 2026 slide deck: flat charcoal ground (or its texture), Lexend only, a blue left bar with top/bottom ticks and a top-right Equal Experts tab holding the slide number, and content in `#071322` cards with a `#38bdf8` outline under a blue uppercase eyebrow and a white title. The opening title slide is a large outlined card with the Brooklyn bridge on the right and the white Equal Experts logo bottom-left; every deck's closing slide is a row of three numbered cards with the bridge. Nothing else in the app changes, and no slide content, beat or order changes. The first attempt (#300) restyled only the shell and left scenes in the old violet look; this build restyles every scene.

## Where
- `src/index.css` — one `.deck` scope defining the shared deck tokens (the colour table, three accents, Lexend, charcoal ground) by redefining `--color-ground/ink/surface/hairline/muted` and `--font-*` inside `.deck` only, so the old scene classes remap without touching the app theme; Lexend loaded in `index.html`.
- `public/brand/` — `nam-bridge-logo.png`, `charcoal-background.png`, `opening-hero-background.png` (issue comments), the two Equal Experts SVGs (closed #282 body).
- `src/components/presentation/Deck.jsx` — root gets `.deck`; frame (left bar, ticks, tab with logo + slide number), eyebrow/title block in `Heading`, chapter bar and buttons recoloured to tokens.
- `src/components/presentation/Backdrop.jsx` — drop the hard-coded vignette/aurora for the shared tokens and charcoal texture.
- `src/components/presentation/kit.jsx` and `product/kit.jsx` — new `Card`, `AccentCard` (bar plus big numeral), `TwoPanel`, `Pill`, `ClosingRow`; `box` uses the card fill.
- Scenes: `intro.jsx`, `after.jsx`, `ship.jsx`, `apps.jsx`, `next.jsx`, `opening/opening.jsx`, `product/{intro,raise,winnow,workflow}.jsx` — replace hard-coded violet/amber and low-opacity text with tokens and the card shapes; title slide and closing slides per the ticket.
- `context/engineering-context/ui.md` — presentation section: deck tokens, fonts, logos, layouts.
- Tests in `tests/presentation.spec.js` (existing per-beat render walks, deck pages need no data lane) plus a new unit test `tests/unit/deck-contrast.test.js` computing contrast of the token pairs and a spec check of computed styles.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Colours in the table, charcoal ground, Lexend only | on each deck's title, a content and the closing beat, computed `background-color` of the card, the frame bar and the tab equal the table values and every text node's `font-family` starts with Lexend | spec |
| Every slide has the frame and tab, eyebrow/title/card layout, none in the old style | per-beat walk on all three decks asserts the frame bar, tab with slide number, an eyebrow and title on each beat, and no element using a violet class or inline violet colour | spec |
| Title slide shows bridge and white EE logo; every closing slide shows the bridge | opening beat 0 has the bridge image and white logo (both loaded, logo at least 100px wide); last beat of each deck has the bridge and three numbered cards | spec |
| Text meets WCAG AA | unit test on the token pairs (text on card fill and on charcoal); spec walk samples each beat's text colour and opacity over the card fill and fails under 4.5:1 (3:1 large) | unit + spec |
| Nothing outside the decks changes | `/`, `/schedule` computed `font-family` and `--color-ground` stay unchanged; existing app specs still pass | spec |
| `npm test`, `npm run verify` pass; `npm run shot` captures attached | run in gate; captures of an opening, content and closing slide per deck added to the PR | gate |

## Decisions
- Use the three accents at the issue's approximate values (`#f59e0b`, `#3a9a9a`, `#00c8e8`) rather than sampling the screenshots, since the images cannot be measured here — OK?
- Scope the tokens with a `.deck` class so the app theme is untouched, instead of editing `@theme` — OK?
- Drop the star-field and aurora in favour of the flat charcoal or texture — OK?
- Where a scene's low-opacity text cannot reach AA over the card fill, raise it to the muted token rather than keep the dimmer look — OK?

## Out of scope
Restyling the rest of the app, changing slide content, beats or ordering, a light theme.

## Revision after review

The left bar and ticks, the slide number in the tab, the Brooklyn bridge everywhere, and the invented closing cards on the opening and product decks were removed: they overlapped content, repeated the chapter bar's count, looked out of place, or added labels that were never in the talks. The engineering deck's *Before lunch* timeline stays as cards.
