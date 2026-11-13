# Restyle the three presentations to match the NAM Conference 2026 deck

## What this changes
`/opening-presentation`, `/product-presentation` and `/engineering-presentation` look like the NAM 2026 slide deck: charcoal ground, Lexend, a blue left bar with ticks and a top-right Equal Experts tab carrying the slide number, and every scene built from eyebrow, title and rounded `#071322` cards. The opening title slide is a large outlined card with the Brooklyn bridge and the white Equal Experts logo; every deck's last slide shows the bridge. The rest of the app does not change. Slide content, beats, order and behaviour do not change.

## Where
- `src/components/presentation/tokens.js` (new) — the one place for the colours, fonts and Backdrop vignette; exports the values and `contrast(fg, bg)`. `Deck` writes them as CSS variables on its root `div`, so they exist only inside a deck.
- `src/components/presentation/Deck.jsx` — root ground, new `<Frame>` (left bar, ticks, tab with the mark and `{beat+1}`; `data-testid="deck-frame"` / `deck-tab`), the `Caption` (eyebrow, title, body in Lexend; lesson numerals in the card accent), and the top and bottom bars (back link, counter, chapter rail) onto tokens. The counter keeps `presentation-counter`; `ORBIT '26` link text stays.
- `src/components/presentation/Backdrop.jsx` — drop the hard-coded violet/fuchsia `AURORA`; paint the charcoal image (`public/brand/charcoal-background.png`) with a vignette from the tokens. The chapter fly-through and warp keep running.
- `src/components/presentation/kit.jsx`, `product/kit.jsx` — add `Card` (outlined, circled numeral, coloured heading), `AccentCard` (left bar plus big numeral), `TwoPanel` (uppercase header, divider, time/break/lab colours), `Pill`, `Eyebrow`; move existing primitives (`Terminal`, `Verdict`, `Token`, `Versus`, `StepRail`…) onto the tokens.
- Scenes, markup rewritten onto those primitives and token colours (no CSS that remaps old class names): `intro.jsx`, `ship.jsx`, `after.jsx`, `apps.jsx`, `next.jsx`, `opening/opening.jsx`, `product/intro.jsx`, `product/raise.jsx`, `product/winnow.jsx`, `product/workflow.jsx`. Text colours are tokens, never `opacity`/`/80` tints that fall under 4.5:1.
- Closing slides: the last beat of each deck gets a row of three numbered cards over the charcoal ground, plus the bridge; the opening deck's first beat gets the outlined title card, the bridge on the right and the white logo bottom-left (at least 100 px wide, clear space, unaltered).
- `public/brand/` (new) — `nam-bridge-logo.png`, `charcoal-background.png`, `opening-hero-background.png` (downloaded from the images in the comments on #293), `Equal_Experts_Logo_Monochrome_White.svg` and `Equal_Experts_Brand_Mark_RGB_Blue_Circle.svg` (from the body of #282).
- `index.html` — add Lexend to the existing Google Fonts link; `src/index.css` `@theme` fonts stay Inter, Space Grotesk and JetBrains Mono, so the app is untouched. Any rule added to `index.css` is scoped under the deck root.
- `context/engineering-context/ui.md` — deck tokens, fonts, logos, frame and card layouts.
- Tests: `tests/unit/presentation-theme.test.js` (new, node:test, no browser) and `tests/presentation.spec.js` (existing; no data lane or pinned clock, the decks read no attendee state; `failOnPageErrors` from `tests/helpers.js`).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Decks use the table's colours, charcoal ground, Lexend only | `tokens.js` holds the exact hexes from the ticket; spec walks every beat of each deck and asserts the root computed `background-color` is the charcoal token and the stage's computed `font-family` starts with Lexend | unit + spec |
| Every slide has the frame and tab, in the new layout, none in the old style | per-deck beat walk asserts `deck-frame` and `deck-tab` (tab text equals the counter's number) on every beat; the unit test reads every file under `src/components/presentation` (not `specs/`) and fails on violet, fuchsia, purple or indigo classes or hexes (`#c4b5fd`, `#8b5cf6`, `#a78bfa`, `rgba(139,92,246`…) | spec + unit |
| Opening title shows bridge and white logo; each closing slide shows the bridge | spec: opening beat 1 has `deck-bridge` and `deck-logo-white`; `End` on each deck shows `deck-bridge` and three `deck-closing-card`s | spec |
| Text on the dark ground meets AA | unit: `contrast()` over every text token against every fill it is used on (`#071322`, charcoal, `#2095d3` tab) is at least 4.5, or 3 for large; and the source scan fails on opacity-tinted text classes (`text-white/..`, `opacity-` on text) in scene files | unit |
| Nothing outside the three decks changes | guard, not a red check (it holds today): unit asserts the `@theme` font tokens are unchanged and that `index.css` has no deck rule outside the deck root; existing `smoke.spec.js` and `home.spec.js` stay green | unit + existing spec |
| `npm test`, `npm run verify` pass; `npm run shot` captures attached | the gate; shots of an opening, a content and a closing slide per deck are taken by the PR step and attached | gate |

## Decisions
- Lexend is added to the app's existing Google Fonts link in `index.html` (loaded everywhere, used only inside the decks), rather than being loaded by the deck at runtime — OK?
- The three accents use the ticket's "about" values (orange `#f59e0b`, teal `#3a9a9a`, cyan `#00c8e8`) as the exact tokens, since they pass AA on `#071322` and the build cannot sample the screenshots — OK?
- The starfield and aurora are retired in favour of the charcoal image with a token vignette; the chapter fly-through and warp transition stay, as they are behaviour — OK?
- Scene markup is rewritten onto the card primitives and tokens instead of remapping the old Tailwind colour classes with deck-scoped CSS — OK?
- The back link, chapter rail and arrow buttons are restyled onto tokens too, since they are part of each slide's look — OK?

## Out of scope
Restyling the rest of the app (#282 was cancelled), changing slide content, beats, ordering or behaviour, and a light theme.
