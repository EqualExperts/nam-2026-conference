# Restyle the three presentations to match the NAM Conference 2026 deck

## What this changes
`/opening-presentation`, `/product-presentation` and `/engineering-presentation` leave the violet starfield look and take the NAM 2026 deck's: a flat charcoal ground (the textured `charcoal-background.png`), a thick blue bar down the left edge with short ticks along the top and bottom, a blue tab at top right holding the Equal Experts mark above the slide number, Lexend as the only text font, and the ticket's palette. Every caption becomes eyebrow, then title, then body; scene content sits in rounded `#071322` cards with a thin outline. The opening title slide gets the Brooklyn bridge on the right and the white Equal Experts logo bottom-left; every deck's closing slide shows the bridge. Slide content, beats, order and behaviour do not change. Nothing else in the app changes.

## Where
- `src/components/presentation/tokens.js` (new) — the deck tokens once: colours, accents (orange `#f59e0b`, teal `#3a9a9a`, cyan `#00c8e8`, to be sampled from the reference screenshots), font; also written as `--color-deck-*` and `--font-deck` in the `@theme` block of `src/index.css`. Unit test in `tests/unit/presentation-style.test.js`: every text/ground pair meets 4.5:1 (3:1 for large).
- `src/components/presentation/Backdrop.jsx` — replace stars, aurora and the hard-coded vignette with the charcoal ground and floor from the tokens (`tone` stays in the chapter shape; it picks the accent).
- `src/components/presentation/Deck.jsx` — add `Frame` (left bar, ticks, top-right tab with `public/brand` blue mark and the counter, `data-testid="deck-frame"` / `deck-tab`); restyle `Caption` (Lexend, eyebrow caps blue, title white bold, grey body; `lesson` badge and numeral in the accent) and the chrome and progress bar. Keep every existing `data-testid`, `keyAction` and hand-off behaviour.
- `src/components/presentation/kit.jsx`, `product/kit.jsx` — card primitives (outlined with circled numeral, accent-bar, two-panel table, key-objective pill); `MODELS`, `LABELS`, `TONES` recoloured onto the palette; `font-mono` dropped.
- Scenes restyled onto those cards, no content change: `intro.jsx`, `ship.jsx`, `after.jsx`, `apps.jsx`, `opening/opening.jsx`, `product/intro.jsx`, `product/raise.jsx`, `product/winnow.jsx`, `product/workflow.jsx`. Title and closing slides: `opening/opening.jsx` (bridge, white logo), and the last chapter of `chapters.js`, `product/chapters.js`, `opening/chapters.js` (bridge, row of three numbered cards).
- `public/brand/` — `nam-bridge-logo.png`, `charcoal-background.png`, `opening-hero-background.png` (issue comments), `Equal_Experts_Logo_Monochrome_White.svg` and `Equal_Experts_Brand_Mark_RGB_Blue_Circle.svg` (body of #282). Logo at least 100px wide, clear space, unaltered.
- `index.html` — add Lexend to the existing Google Fonts link only; the app's `body` stays Inter.
- `context/engineering-context/ui.md` — deck tokens, fonts, logos, layouts, in the presentation section.
- Tests in `tests/presentation.spec.js`, a new `Deck style` describe reusing its `counter`/`readCounter` helpers and the existing walk over every beat; no data lane and no clock pin needed (the decks read no attendee state).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Colours, charcoal ground, Lexend only | Unit: tokens equal the ticket's hex table. Spec: on every beat of each deck, the stage ground is the charcoal, every visible text element's computed `font-family` starts with Lexend, and no `canvas` (starfield) exists | unit + spec |
| Frame and tab on every slide, eyebrow/title/card layout, no old style | Spec: walking every beat of each deck, `deck-frame` and `deck-tab` are visible, the tab shows the counter, and no element uses the old violet/starfield classes | spec |
| Title slide bridge and white logo; bridge on every closing slide | Spec: opening beat 1 shows the bridge image and the white logo (width >= 100px, natural size ratio kept); the last beat of each deck shows the bridge | spec |
| WCAG AA on the dark ground | Unit: token pairs. Spec: on each beat, computed text colour against the ground meets 4.5:1 (3:1 at 24px+ or bold 19px+) | unit + spec |
| Nothing outside the three decks changes | Spec: `/` and a session page still compute Inter on `body` and show no deck frame; existing smoke and home specs stay green | spec |
| `npm test`, `npm run verify` pass; `npm run shot` captures | Run by the gate; the opening, a content and a closing slide of each deck are attached to the PR | gate |

## Decisions
- Should the decks' monospace text (terminals, code chips, ticket numbers) also be set in Lexend, since the ticket makes it the only text font?
- Should the starfield, aurora and warp be removed entirely (charcoal ground only), keeping the fly-through slide transition and all other motion?
- Should the status chips (model names, GitHub labels, pass/fail colours in `kit.jsx`) be recoloured onto the blue, orange, teal and cyan palette, rather than keeping their violet, emerald and rose meanings?
- Should the chapter tones (violet, emerald, sky, fuchsia, amber, cyan) map onto the four palette colours (blue, orange, teal, cyan) by position?
- Should the old top bar (ORBIT '26 link, chapter name, counter) give way to the frame tab for the counter, keeping a small back link and the chapter name, and the same test ids?
- Should each closing slide keep its existing content and add the bridge plus a row of three numbered cards built from that content, rather than new text?
- Is the `#2095d3` frame and `#1795d4` tab difference kept as written (two blues)?

## Out of scope
Restyling the rest of the app, changing slide content, beats, order or behaviour, and a light theme.
