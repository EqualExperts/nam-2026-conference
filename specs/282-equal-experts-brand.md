# Restyle the app in the Equal Experts brand: Dark Data theme, Lexend and the logo

## What this changes
Every page is restyled; nothing about data or behaviour changes. The page ground is Dark Data `#212526` with lighter tints for `surface`/`raised`/`overlay`/`hairline`; text is Byte White / The Cloud; Equal Experts Blue is the accent for links, active states and focus; Transform Teal and Equal Ember (live indicators, warnings only) support it; Tech Blue is the fill under white text. The violet-to-cyan gradient, violet glow and selection colour go. Lexend is the only font (Light body, Normal headings, Medium small labels, bold only for CTAs and key figures). The header and footer show the white Equal Experts logo (>= 100px wide, clear space) beside **ORBIT '26**; the tab icon is the blue brand mark.

## Where
- `src/index.css` — `@theme` tokens (`--color-ground` ... `--color-faint`, `--font-sans/display/mono` all Lexend), `body::before` wash, `::selection`, scrollbar thumb hexes, `glass` rgba, `.font-display` weight; add brand colour tokens (`--color-brand`, `--color-teal`, `--color-ember`, `--color-techblue`) so no hex sits outside `@theme`.
- `index.html` — Lexend (300, 400, 500, 700) replaces Inter / Space Grotesk / JetBrains Mono; `<link rel="icon">` points at `/brand/...Blue_Circle.svg`; description meta unchanged.
- `public/brand/` — add `Equal_Experts_Logo_Monochrome_White.svg` and `Equal_Experts_Brand_Mark_RGB_Blue_Circle.svg`, verbatim from the ticket.
- `src/components/Layout.jsx` — `Logo()` (header, l.20) and the footer brand (l.154): replace the gradient emoji tile with the logo `<img>` (min width 100px, padding for clear space) next to the ORBIT '26 text; active-nav underline (l.97) uses the brand accent.
- `src/lib/accents.js` — keep the ten stored names as keys (the database holds them; data is out of scope) but map every one onto a small brand set (blue, teal, ember, tech blue, cloud) with literal class strings; `ACCENT_HEX` gets brand hexes; default fallback is blue, not violet.
- Remaining raw palette classes (`violet-/cyan-/emerald-/amber-/rose-/sky-...`) and hex literals in `ui.jsx`, `SessionCard`, `ScheduleGrid`, `SeatPanel`, `ConflictDialog`, `AttendancePanel`, `UserSwitcher`, `FilterBar`, `LiveBadge`, `VenueBoard`, `SpeakerCard`, `GeneratedAvatar`, `GeneratedCover`, pages (`Home`, `Schedule`, `Session`, `Food`, `Venues`, `Accessibility`, `CodeOfConduct`, `Speakers`) move to tokens. Presentation components (`components/presentation/**`) change colours and fonts only, via the same tokens.
- Where a track, venue or cuisine chip is told apart only by its colour, add the label or an icon (tracks and cuisines have more categories than brand colours).
- `context/engineering-context/ui.md` — Tokens, `accents.js`, `Layout.jsx` (header/footer) sections.
- Tests: `tests/unit/brand.test.js` (new; plain node, no lane) and `tests/smoke.spec.js` additions (read-only pages, so no data lane; pin nothing as no live state is read).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Ground is `#212526`; no violet/cyan gradient, glow or accent remains | brand.test.js reads `index.css` `--color-ground` and asserts no `violet`/`cyan`/`fuchsia`/`#8b5cf6`-family in `src/` or `index.html` (excluding `specs/`) | unit |
| No hard-coded colour outside the brand tokens | brand.test.js scans `src/` for hex/rgb literals; only `index.css` `@theme` and the brand hexes in `accents.js` are allowed | unit |
| All text and meaningful UI colour meet AA | brand.test.js computes WCAG ratios for ink/muted/faint and each accent text colour over ground, surface, raised, overlay (>= 4.5) | unit |
| Lexend is the only text font, desktop and mobile | smoke.spec: computed `font-family` of body, a heading and a label starts with Lexend on both projects; `index.html` names no other family | spec |
| Header and footer show the white logo beside ORBIT '26, >= 100px wide; tab shows the blue mark | smoke.spec: header and footer `img[src*="Monochrome_White"]` visible with box width >= 100, "ORBIT" text beside it; `link[rel=icon]` href is the Blue_Circle svg and returns 200 | spec |
| Tracks, venues, cuisines distinguishable without colour | brand.test.js: every chip-bearing component renders its label (accents.js maps many names to few colours, so label is asserted); smoke.spec: session cards show the track name | unit + spec |
| `npm test`, `npm run verify` pass; `npm run shot` captures attached | the gate, and `npm run shot` of home, schedule, speakers, a session in the PR | gate |

## Decisions
- The database stores ten accent names (`violet`, `cyan`, ...) and data may not change: keep those keys in `accents.js` and map several onto the same brand colour, rather than renaming them or migrating the seed. OK?
- With only blue, teal, ember, tech blue and cloud available, venues and tracks will share colours; tell them apart by label or icon (the venue emoji, track name) as the ticket says. OK?
- Equal Ember is reserved for the LIVE badge and warnings/waitlist states; it is not used for track or venue accents. OK?
- Elevation tints (`surface`, `raised`, `overlay`, `hairline`) are lighter tints of `#212526` chosen here, and `muted`/`faint` text are picked to reach 4.5:1 on all of them; the brand table does not cover these. OK?
- `faint` text that cannot reach 4.5:1 on `overlay` is lightened rather than kept for decorative effect. OK?
- Presentation pages: colours and fonts follow the tokens; any gradients there become flat brand fills. OK?

## Out of scope
Renaming the event, new features, data or behaviour changes, a light theme, slide content.
