import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The deck tokens (`.deck` in src/index.css) are the NAM 2026 colours, and every
 * text pair they make clears WCAG AA. Pure arithmetic on the stylesheet.
 */
const css = readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
const block = css.match(/(?:^|\n)\.deck\s*\{([^}]*)\}/)?.[1] ?? '';
const token = (name) => block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase();

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('The deck tokens', () => {
  test('are the NAM 2026 colours, on a charcoal ground', () => {
    assert.ok(block, 'index.css has no .deck block');
    assert.equal(token('color-surface'), '#071322');
    assert.equal(token('color-edge'), '#38bdf8');
    assert.equal(token('color-ink'), '#ffffff');
    assert.equal(token('color-muted'), '#94a3b8');
    assert.equal(token('color-frame'), '#2095d3');
    assert.equal(token('color-tab'), '#1795d4');
    assert.equal(token('color-ground'), '#212121');
    assert.equal(token('color-orange'), '#f59e0b');
    assert.equal(token('color-teal'), '#3a9a9a');
    assert.equal(token('color-cyan'), '#00c8e8');
  });

  test('text clears 4.5:1 on the card fill and on the ground', () => {
    for (const text of ['color-ink', 'color-muted', 'color-faint', 'color-edge', 'color-orange', 'color-teal', 'color-cyan']) {
      for (const ground of ['color-surface', 'color-ground']) {
        const r = ratio(token(text), token(ground));
        assert.ok(r >= 4.5, `${text} on ${ground} is ${r.toFixed(2)}:1`);
      }
    }
  });

  test('the slide number on the tab clears 3:1 (large text)', () => {
    assert.ok(ratio(token('color-ink'), token('color-tab')) >= 3);
  });
});
