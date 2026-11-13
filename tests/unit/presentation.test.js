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

describe('The product talk’s context slide lists Orbit’s real files', async () => {
  const { existsSync, readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { ORBIT_CONTEXT, CONTEXT_CHIPS } = await import('../../src/components/presentation/product/orbitContext.js');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const real = ORBIT_CONTEXT.filter((e) => e.path !== '…');

  test('every listed path exists in the repository', () => {
    for (const e of [...real, ...CONTEXT_CHIPS.map((path) => ({ path }))]) {
      assert.ok(existsSync(join(root, e.path)), `${e.path} is not in the repository`);
    }
  });

  test('context/index.md and the three folders are listed, each with a file', () => {
    const paths = ORBIT_CONTEXT.map((e) => e.path);
    assert.ok(paths.includes('context/index.md'));
    for (const folder of ['product-context', 'engineering-context', 'winnow-transcripts']) {
      assert.ok(paths.includes(`context/${folder}/`), `${folder}/ missing`);
      assert.ok(paths.some((p) => p.startsWith(`context/${folder}/`) && !p.endsWith('/')), `${folder}/ has no file`);
    }
  });

  test('names are in full: folders end in a slash, files carry an extension', () => {
    for (const e of real) assert.match(e.path, /(\/|\.\w+)$/, e.path);
  });

  test('one line per entry, and the mobile example opens a doc that answers it', () => {
    for (const e of ORBIT_CONTEXT) assert.ok(e.what);
    const pick = ORBIT_CONTEXT.filter((e) => e.pick);
    assert.deepEqual(pick.map((e) => e.path), ['context/engineering-context/testing.md']);
    const text = readFileSync(join(root, pick[0].path), 'utf8').toLowerCase();
    assert.ok(text.includes('mobile') && text.includes('viewport'));
  });
});
