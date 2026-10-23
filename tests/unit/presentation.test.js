import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clampBeat, parseBeat, keyAction, beatAfter, locateBeat } from '../../src/lib/presentation.js';

describe('The presentation never walks off either end', () => {
  test('an index is kept inside the beats', () => {
    assert.equal(clampBeat(-3, 10), 0);
    assert.equal(clampBeat(4, 10), 4);
    assert.equal(clampBeat(10, 10), 9);
    assert.equal(clampBeat(NaN, 10), 0);
  });

  test('forward on the last beat and back on the first stay put', () => {
    assert.equal(beatAfter(9, 1, 10), 9);
    assert.equal(beatAfter(0, -1, 10), 0);
    assert.equal(beatAfter(3, 1, 10), 4);
  });

  test('Home and End jump to the ends', () => {
    assert.equal(beatAfter(5, 'first', 10), 0);
    assert.equal(beatAfter(5, 'last', 10), 9);
  });
});

describe('?beat= is the 1-based number the counter shows', () => {
  test('a beat in range opens on it', () => {
    assert.equal(parseBeat('1', 10), 0);
    assert.equal(parseBeat('6', 10), 5);
    assert.equal(parseBeat('10', 10), 9);
  });

  test('anything else opens the first beat', () => {
    for (const bad of [null, undefined, '', '0', '11', '-2', '2.5', 'abc', '3x']) {
      assert.equal(parseBeat(bad, 10), 0, `?beat=${bad}`);
    }
  });
});

describe('Keys and clickers', () => {
  test('arrows, space, enter and the page keys a clicker sends all move', () => {
    for (const k of ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']) assert.equal(keyAction(k), 1, k);
    for (const k of ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']) assert.equal(keyAction(k), -1, k);
    assert.equal(keyAction('Home'), 'first');
    assert.equal(keyAction('End'), 'last');
  });

  test('other keys are left alone', () => {
    assert.equal(keyAction('a'), null);
    assert.equal(keyAction('Tab'), null);
  });
});

describe('A flat beat index finds its chapter', () => {
  const counts = [2, 3, 1];

  test('each index lands in the right chapter and step', () => {
    assert.deepEqual(locateBeat(0, counts), { chapter: 0, step: 0, start: 0 });
    assert.deepEqual(locateBeat(1, counts), { chapter: 0, step: 1, start: 0 });
    assert.deepEqual(locateBeat(2, counts), { chapter: 1, step: 0, start: 2 });
    assert.deepEqual(locateBeat(4, counts), { chapter: 1, step: 2, start: 2 });
    assert.deepEqual(locateBeat(5, counts), { chapter: 2, step: 0, start: 5 });
  });

  test('past the end is the last step of the last chapter', () => {
    assert.deepEqual(locateBeat(99, counts), { chapter: 2, step: 0, start: 5 });
  });
});
