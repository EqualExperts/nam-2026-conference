import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK, TEXT_ON_GROUND } from '../../src/components/presentation/tokens.js';

// WCAG relative luminance and contrast ratio
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('The decks share one set of NAM 2026 tokens', () => {
  test('the colours are the ticket\'s table', () => {
    assert.equal(DECK.frame, '#2095d3');
    assert.equal(DECK.tab, '#1795d4');
    assert.equal(DECK.card, '#071322');
    assert.equal(DECK.outline, '#38bdf8');
    assert.equal(DECK.muted, '#94a3b8');
    assert.equal(DECK.ink, '#ffffff');
    assert.equal(DECK.ground, '#212121');
    assert.equal(DECK.orange, '#f59e0b');
    assert.equal(DECK.teal, '#3a9a9a');
    assert.equal(DECK.cyan, '#00c8e8');
  });

  test('Lexend is the only text font', () => {
    assert.equal(DECK.font, 'Lexend');
  });

  test('every text colour meets AA on the ground and on a card', () => {
    for (const name of TEXT_ON_GROUND) {
      for (const bg of [DECK.ground, DECK.card]) {
        const r = contrast(DECK[name], bg);
        assert.ok(r >= 4.5, `${name} on ${bg} is ${r.toFixed(2)}:1`);
      }
    }
  });
});
