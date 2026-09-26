import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plan, verdict, unitAllPassed, browserAllPassed } from '../../scripts/red-check.mjs';

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
    renamed: [],
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

test('a renamed app file is reverted to its old name, not checked out under the new one', () => {
  const p = plan('R080\tsrc/lib/old.js\tsrc/lib/new.js\nM\ttests/unit/a.test.js');
  assert.deepEqual(p.renamed, [{ from: 'src/lib/old.js', to: 'src/lib/new.js' }]);
  assert.deepEqual(p.code, []);
  assert.equal(p.applies, true);
  assert.deepEqual(verdict(p, [{ failed: true }]).reverted, ['src/lib/new.js → src/lib/old.js']);
});

test('a copied app file is removed, like an added one', () => {
  assert.deepEqual(plan('C100\tsrc/a.js\tsrc/b.js\nM\ttests/unit/a.test.js').added, ['src/b.js']);
});

test('a base it cannot diff against still prints one JSON line, saying why', async () => {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync('node', ['scripts/red-check.mjs'], { env: { ...process.env, GATE_BASE: 'origin/no-such-ref-for-red-check' }, encoding: 'utf8' });
  const last = JSON.parse(r.stdout.trim().split('\n').at(-1));
  assert.equal(last.checked, false);
  assert.equal(last.reason, 'could not run');
  assert.match(last.error, /no-such-ref-for-red-check|unknown revision|bad revision/i);
});

test('on the base code a skipped test has not passed — the data guards skip exactly when the change is missing', () => {
  assert.equal(unitAllPassed(0, '# tests 3\n# pass 3\n# skipped 0\n# todo 0'), true);
  assert.equal(unitAllPassed(0, '# tests 3\n# pass 2\n# skipped 1\n# todo 0'), false);
  assert.equal(unitAllPassed(0, '# tests 1\n# pass 0\n# cancelled 1'), false);
  assert.equal(unitAllPassed(1, '# pass 2\n# fail 1'), false);
  assert.equal(browserAllPassed(0, { stats: { expected: 4, skipped: 0, unexpected: 0, flaky: 0 } }), true);
  assert.equal(browserAllPassed(0, { stats: { expected: 3, skipped: 1, unexpected: 0 } }), false);
  assert.equal(browserAllPassed(0, null), false);
});
