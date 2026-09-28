import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, tampered, isDirty, strays, addedTests, neverRanAdded } from '../../scripts/gate.mjs';

/**
 * The gate is what the ship loop believes about a branch, so its two readers
 * are tested on the shapes they will actually see: Playwright's JSON report,
 * and a unified diff of tests/.
 */

describe('reading the Playwright report', () => {
  const report = {
    stats: { expected: 150, unexpected: 1, flaky: 2, skipped: 1 },
    suites: [{
      file: 'plan.spec.js',
      specs: [],
      suites: [{
        file: 'plan.spec.js',
        specs: [{
          title: 'the hours tile totals the hours', file: 'plan.spec.js', line: 27,
          tests: [
            { projectName: 'desktop', status: 'unexpected', results: [{ error: { message: '\u001b[31mExpected: 3\u001b[39m\nReceived: 0' } }] },
            { projectName: 'mobile', status: 'flaky', results: [] },
          ],
        }],
      }],
    }],
  };

  test('counts come from stats; only unexpected tests are failures', () => {
    const s = summarise(report);
    assert.equal(s.passed, 150);
    assert.equal(s.flaky, 2);
    assert.deepEqual(s.flakyTests, ['[mobile] plan.spec.js:27 › the hours tile totals the hours']);
    assert.equal(s.skipped, 1);
    assert.deepEqual(s.failed.map(f => f.test), ['[desktop] plan.spec.js:27 › the hours tile totals the hours']);
  });

  test('a run-level error — a spec that will not compile — is a named failure', () => {
    const s = summarise({ stats: {}, suites: [], errors: [{ message: 'SyntaxError: Unexpected token', location: { file: 'tests/x.spec.js', line: 3 } }] });
    assert.deepEqual(s.failed, [{ test: 'tests/x.spec.js:3', error: 'SyntaxError: Unexpected token' }]);
  });

  test('the error has its colour codes stripped', () => {
    assert.equal(summarise(report).failed[0].error, 'Expected: 3\nReceived: 0');
  });
});

describe('spotting a weakened suite', () => {
  const diff = `diff --git a/tests/seats.spec.js b/tests/seats.spec.js
--- a/tests/seats.spec.js
+++ b/tests/seats.spec.js
@@ -10,6 +10,6 @@
-  test('a full room waitlists you', async ({ page }) => {
+  test.skip('a full room waitlists you', async ({ page }) => {
-    await expect(panel).toContainText('Waitlisted');
+    // TODO
+  test('a brand new test', async () => {
   const unchanged = expect(1);`;

  test('removed tests and assertions, and added skips, are listed', () => {
    const t = tampered(diff);
    assert.equal(t.length, 3);
    assert.ok(t.every(l => l.startsWith('tests/seats.spec.js: ')));
    assert.match(t[1], /\+\s+test\.skip/);
  });

  test('adding a test is not tampering', () => {
    assert.deepEqual(tampered(`diff --git a/tests/x.spec.js b/tests/x.spec.js\n+++ b/tests/x.spec.js\n+  test('new', () => { expect(1).toBe(1) });`), []);
  });

  test('a diff inside a fixture string is not the test file being weakened', () => {
    assert.deepEqual(tampered(`diff --git a/tests/unit/g.test.js b/tests/unit/g.test.js\n++  test.skip('fixture')`), []);
  });

  test('any change to what decides the run is listed', () => {
    const t = tampered(`diff --git a/playwright.config.js b/playwright.config.js\n--- a/playwright.config.js\n+++ b/playwright.config.js\n+  testIgnore: ['seats.spec.js'],\n-  retries: 0,`);
    assert.deepEqual(t, ['playwright.config.js: changed — it decides what the gate runs']);
  });

  test('a deleted test file is named from the diff header, not /dev/null', () => {
    const t = tampered(`diff --git a/tests/old.spec.js b/tests/old.spec.js\n--- a/tests/old.spec.js\n+++ /dev/null\n-test('gone', () => {});`);
    assert.deepEqual(t, [`tests/old.spec.js: -test('gone', () => {});`]);
  });
});

describe('a tree with work the pull request will not contain', () => {
  test('a modified tracked file is dirty; an untracked file is only dirty under tests/', () => {
    assert.equal(isDirty(' M server/lib/seats.js'), true);
    assert.equal(isDirty('?? notes.txt'), false);
    assert.equal(isDirty('?? tests/probe.spec.js'), true);
    assert.equal(isDirty(''), false);
  });

  test("files the ship job swapped in from main are not the branch's work", () => {
    const status = ' M playwright.config.js\n M scripts/gate.mjs';
    assert.equal(isDirty(status, ['playwright.config.js', 'scripts/gate.mjs']), false);
    assert.equal(isDirty(status + '\n M src/App.jsx', ['playwright.config.js', 'scripts/gate.mjs']), true);
  });
});

describe('strays', () => {
  test('stops only a listener this checkout started, never another worktree\'s', () => {
    const root = '/w/orbit-wt-67';
    const listeners = [
      { pid: 1, cwd: '/w/orbit-wt-67' },
      { pid: 2, cwd: '/w/orbit-wt-67/server' },
      { pid: 3, cwd: '/w/orbit-wt-670' },
      { pid: 4, cwd: '/w/orbit-wt-65' },
      { pid: 5, cwd: undefined },
    ];
    assert.deepEqual(strays(listeners, root), [1, 2]);
  });
});

describe('a test the branch added that never ran', () => {
  // The shape Playwright's JSON reporter writes: one suite per project.
  const spec = (title, status) => ({ file: 'attendance.spec.js', line: 1, title, tests: [{ projectName: 'x', status }] });
  const report = {
    suites: [
      { file: 'attendance.spec.js', specs: [spec('rating toasts', 'skipped'), spec('old desktop-only test', 'skipped'), spec('checks in', 'expected')] },
      { file: 'attendance.spec.js', specs: [spec('rating toasts', 'skipped'), spec('old desktop-only test', 'expected'), spec('checks in', 'skipped')] },
    ],
    stats: { expected: 3, skipped: 3 },
  };
  const diff = [
    'diff --git a/tests/attendance.spec.js b/tests/attendance.spec.js',
    "+  test('rating toasts', async ({ page }) => {",
    "+  test('checks in', async ({ page }) => {",
    '+    test.skip(!target, "no un-attended session left on this day");',
  ].join('\n');

  test('is a failure only when it skipped on every project and the branch added it — #76', () => {
    const { neverRan } = summarise(report);
    assert.deepEqual(neverRan, ['attendance.spec.js › rating toasts']);
    const failed = neverRanAdded(neverRan, addedTests(diff));
    assert.deepEqual(failed.map(f => f.test), ['attendance.spec.js › rating toasts']);
    assert.match(failed[0].error, /never ran proves nothing/);
  });

  test('an old test that skips everywhere is not the branch\'s to answer for', () => {
    assert.deepEqual(neverRanAdded(['attendance.spec.js › legacy'], addedTests(diff)), []);
  });

  test('added titles are read from the diff, in any quote style', () => {
    const d = 'diff --git a/tests/a.spec.js b/tests/a.spec.js\n+test("double", () => {})\n+  test(`tick`, () => {})\n-  test(\'removed\', () => {})';
    assert.deepEqual(addedTests(d), ['a.spec.js › double', 'a.spec.js › tick']);
  });
});
