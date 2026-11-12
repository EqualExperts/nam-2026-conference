/**
 * The NAM Conference 2026 deck look, defined once. The same values are written
 * as `--color-deck-*` and `--font-deck` in the `@theme` block of
 * `src/index.css`, and `.deck` there remaps the stock palette (violet, sky,
 * emerald…) onto these inside the three presentations only.
 */
export const DECK = {
  frame: '#2095d3',   // left bar, ticks
  tab: '#1795d4',     // top-right tab (Equal Experts blue)
  card: '#071322',    // card fill
  outline: '#38bdf8', // card outline, event name, eyebrow labels
  muted: '#94a3b8',   // subtitle and caption text
  ink: '#ffffff',     // titles and body
  ground: '#212121',  // flat charcoal under the textured background
  orange: '#f59e0b',  // breaks, second card
  teal: '#3a9a9a',    // labs, lunch
  cyan: '#00c8e8',    // third card
  font: 'Lexend',
};

/** The colours set as text on the ground or a card; each must meet AA. */
export const TEXT_ON_GROUND = ['ink', 'muted', 'outline', 'orange', 'teal', 'cyan'];

/** Public paths of the brand files. */
export const BRAND = {
  bridge: '/brand/nam-bridge-logo.png',
  logoWhite: '/brand/Equal_Experts_Logo_Monochrome_White.svg',
  mark: '/brand/Equal_Experts_Brand_Mark_RGB_Blue_Circle.svg',
};
