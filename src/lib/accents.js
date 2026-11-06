/**
 * The database stores accent colours as bare names ("violet", "cyan", …) and
 * data is not ours to change here, so those ten names stay as keys. Each one
 * maps onto the small Equal Experts set: blue, teal, Tech Blue and The Cloud.
 * Ten names over four colours means colour can never be the only signal —
 * every chip, track and venue also carries its label or an icon.
 *
 * `blue`, `teal` and `ember` are the semantic accents UI code asks for by
 * name. Equal Ember is reserved for warnings and live states, so no stored
 * name maps to it.
 *
 * Tailwind cannot build class names at runtime, so every accent maps to a
 * fixed set of full class strings here.
 */
const BLUE = { chip: 'bg-brand/15 text-brand-ink border-brand/40', dot: 'bg-brand-ink', ring: 'ring-brand/40', grad: 'from-brand to-techblue', text: 'text-brand-ink', glow: 'shadow-brand/20' };
const TEAL = { chip: 'bg-teal/15 text-teal-ink border-teal/40', dot: 'bg-teal-ink', ring: 'ring-teal/40', grad: 'from-teal to-techblue', text: 'text-teal-ink', glow: 'shadow-teal/20' };
const EMBER = { chip: 'bg-ember/15 text-ember-ink border-ember/40', dot: 'bg-ember-ink', ring: 'ring-ember/40', grad: 'from-ember to-techblue', text: 'text-ember-ink', glow: 'shadow-ember/20' };
const TECH = { chip: 'bg-techblue text-white border-brand/40', dot: 'bg-white', ring: 'ring-brand/40', grad: 'from-techblue to-brand', text: 'text-white', glow: 'shadow-techblue/30' };
const CLOUD = { chip: 'bg-cloud/10 text-cloud border-cloud/30', dot: 'bg-cloud', ring: 'ring-cloud/30', grad: 'from-cloud/70 to-techblue', text: 'text-cloud', glow: 'shadow-cloud/10' };

export const ACCENTS = {
  // the ten names the database stores
  violet: BLUE, cyan: TEAL, emerald: TEAL, amber: CLOUD, orange: CLOUD,
  rose: TECH, fuchsia: TECH, sky: BLUE, lime: CLOUD, teal: TEAL,
  // semantic names for UI code
  blue: BLUE, ember: EMBER,
};

export const accent = (name) => ACCENTS[name] ?? ACCENTS.blue;

/**
 * Real hex values for the same accents, used by generated SVG artwork where
 * Tailwind classes are not available (gradients, fills, canvas-style drawing).
 */
const HEX_BLUE = ['#6cc3ef', '#1795d4'];
const HEX_TEAL = ['#5fd0d2', '#269c9e'];
const HEX_EMBER = ['#ffa645', '#f07c00'];
const HEX_TECH = ['#1795d4', '#22567c'];
const HEX_CLOUD = ['#f5f5f5', '#22567c'];

export const ACCENT_HEX = {
  violet: HEX_BLUE, cyan: HEX_TEAL, emerald: HEX_TEAL, amber: HEX_CLOUD, orange: HEX_CLOUD,
  rose: HEX_TECH, fuchsia: HEX_TECH, sky: HEX_BLUE, lime: HEX_CLOUD, teal: HEX_TEAL,
  blue: HEX_BLUE, ember: HEX_EMBER,
};

export const accentHex = (name) => ACCENT_HEX[name] ?? ACCENT_HEX.blue;

/** Stable accent for an arbitrary label (cuisine, tier, category …). */
const PICKABLE = ['violet', 'cyan', 'emerald', 'amber', 'orange', 'rose', 'fuchsia', 'sky', 'lime', 'teal'];
export function accentFor(label = '') {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return PICKABLE[h % PICKABLE.length];
}
