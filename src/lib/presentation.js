/**
 * Beat navigation for /engineering-presentation. A beat is one press of the clicker: the
 * page holds a flat list of them, and these keep the index honest.
 */

/** Any index, kept inside 0…total-1. */
export function clampBeat(index, total) {
  if (!Number.isFinite(index) || total < 1) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), total - 1);
}

/**
 * `?beat=` is 1-based, so it matches the counter a presenter reads aloud.
 * Anything that is not a whole number in range opens the first beat.
 */
export function parseBeat(value, total) {
  if (value == null || !/^\d+$/.test(String(value).trim())) return 0;
  const n = Number(value);
  return n >= 1 && n <= total ? n - 1 : 0;
}

const FORWARD = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']);
const BACK = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);

/**
 * What a key does: +1 / -1, 'first' or 'last', or null when it is not ours.
 * PageUp/PageDown are what presentation clickers send.
 */
export function keyAction(key) {
  if (FORWARD.has(key)) return 1;
  if (BACK.has(key)) return -1;
  if (key === 'Home') return 'first';
  if (key === 'End') return 'last';
  return null;
}

/** The beat a key moves to from `index`. */
export function beatAfter(index, action, total) {
  if (action === 'first') return 0;
  if (action === 'last') return clampBeat(total - 1, total);
  return clampBeat(index + (action ?? 0), total);
}

/**
 * Chapters own their beats; the page works in one flat index. This says which
 * chapter a flat index falls in and how far into it.
 */
export function locateBeat(index, counts) {
  let start = 0;
  for (let chapter = 0; chapter < counts.length; chapter++) {
    if (index < start + counts[chapter]) return { chapter, step: index - start, start };
    start += counts[chapter];
  }
  const last = counts.length - 1;
  return { chapter: last, step: counts[last] - 1, start: start - counts[last] };
}
