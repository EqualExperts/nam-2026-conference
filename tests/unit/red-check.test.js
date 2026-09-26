import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, verdict } from '../../scripts/red-check.mjs';

/**
 * The shape of #41 is the case that matters: app code changed, a test was
 * added, and the test passed on the base branch's code — it proved nothing.
 */

const diff = [
  'M\tsrc/components/SeatPanel.jsx',
  'A\tsrc/lib/newHelper.js',
  'M\ttests/unit/format.test.js',
  'A\ttests/plural.spec.js',
  'D\ttests/unit/old.test.js',
  'M\tdocs/context/ui.md',
].join('\n');

test('reverts changed app code, removes added app code, runs added and changed tests only', () => {
  assert.deepEqual(plan(diff), {
    applies: true,
    code: ['src/components/SeatPanel.jsx'],
    added: ['src/lib/newHelper.js'],
    unit: ['tests/unit/format.test.js'],
    browser: ['tests/plural.spec.js'],
  });
});

test('a renamed test runs under its new name', () => {
  assert.deepEqual(plan('R090\ttests/a.spec.js\ttests/b.spec.js\nM\tserver/lib/seats.js').browser, ['tests/b.spec.js']);
});

test('nothing to check without both app code and tests', () => {
  assert.deepEqual(verdict(plan('M\tdocs/x.md\nM\ttests/unit/a.test.js'), []), { checked: false, reason: 'no app code changed' });
  assert.deepEqual(verdict(plan('M\tsrc/App.jsx'), []), { checked: false, reason: 'no tests changed' });
});

test('tests that all pass on the base code are a finding — #41', () => {
  const v = verdict(plan(diff), [{ kind: 'unit', failed: false }, { kind: 'browser', failed: false }]);
  assert.equal(v.failedOnBase, false);
  assert.match(v.finding, /would pass without the change/);
});

test('one test failing on the base code is enough', () => {
  const v = verdict(plan(diff), [{ kind: 'unit', failed: false }, { kind: 'browser', failed: true }]);
  assert.equal(v.failedOnBase, true);
  assert.equal(v.finding, undefined);
});
