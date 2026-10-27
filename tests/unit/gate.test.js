import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, tampered, isDirty, strays, addedTests, neverRanAdded, branchSpecs, deckTouched, withoutDeck, untouchedFailures, settleAlone, importsOf, routesOf, pathsIn, affectedSpecs, ciSpecs, printable } from '../../scripts/gate.mjs';

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
  test('stops only a listener this checkout started, never a sibling worktree\'s', () => {
    const root = '/w/orbit-wt-67';
    const listeners = [
      { pid: 1, cwd: '/w/orbit-wt-67' },
      { pid: 2, cwd: '/w/orbit-wt-67/server' },
      { pid: 3, cwd: '/w/orbit-wt-670' },
      { pid: 4, cwd: '/w/orbit-wt-65' },
      { pid: 5, cwd: undefined },
      // An agent worktree now lives inside the checkout. One that never
      // claimed a lane and left `npm run dev` on these ports is the stale
      // server strays() exists to stop, so it stays inside the net.
      { pid: 6, cwd: '/w/orbit-wt-67/.claude/worktrees/wt-99' },
    ];
    assert.deepEqual(strays(listeners, root), [1, 2, 6]);
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

describe('branchSpecs — what GATE_SCOPE=branch runs', () => {
  test('the browser specs the branch changed, and nothing else under tests/', () => {
    const names = ['tests/schedule.spec.js', 'tests/helpers.js', 'tests/unit/ship.test.js', 'tests/api/endpoints.test.js',
      'tests/qa-probe.spec.js', 'tests/seats.spec.js', ''].join('\n');
    assert.deepEqual(branchSpecs(names), ['tests/schedule.spec.js', 'tests/seats.spec.js']);
  });

  test('a branch that changed no browser spec gets an empty list — the gate then runs the whole suite', () => {
    assert.deepEqual(branchSpecs('tests/unit/ship.test.js\n'), []);
    assert.deepEqual(branchSpecs(''), []);
  });
});

describe('the decks', () => {
  test('a branch that touches a deck or its spec runs the deck spec', () => {
    assert.equal(deckTouched('src/components/presentation/ship.jsx\nsrc/App.jsx'), true);
    assert.equal(deckTouched('tests/presentation.spec.js'), true);
  });

  test('an app branch leaves the deck spec out of the suite', () => {
    assert.equal(deckTouched('server/routes/users.js\nsrc/components/Layout.jsx\ntests/unit/presentation.test.js'), false);
    assert.deepEqual(withoutDeck(['tests/agenda.spec.js', 'tests/presentation.spec.js']), ['tests/agenda.spec.js']);
  });
});

describe('a failure that may only be load', () => {
  const failed = [
    { test: '[desktop] presentation.spec.js:40 › steps through every beat', error: 'Test timeout of 30000ms exceeded.', at: 'presentation.spec.js:40' },
    { test: '[mobile] interests.spec.js:12 › saves the selection', error: 'Expected: true', at: 'interests.spec.js:12' },
    { test: 'tests/x.spec.js:3', error: 'SyntaxError' },
  ];

  test('only a failure in a spec the branch did not change is rerun alone', () => {
    assert.deepEqual(untouchedFailures(failed, 'tests/interests.spec.js\nsrc/App.jsx').map(f => f.at), ['presentation.spec.js:40']);
  });

  test('passing alone makes it flaky, not failed; failing alone keeps it failed', () => {
    const browser = { passed: 200, failed: failed.slice(0, 1), flaky: 1, flakyTests: ['[mobile] a.spec.js:1 › a'], skipped: 0 };
    const rerun = (status) => ({ suites: [{ file: 'presentation.spec.js', specs: [{ title: 'steps through every beat', file: 'presentation.spec.js', line: 40, tests: [{ projectName: 'desktop', status }] }] }] });

    const settled = settleAlone(browser, rerun('expected'));
    assert.deepEqual(settled.failed, []);
    assert.equal(settled.flaky, 2);
    assert.match(settled.flakyTests[1], /presentation\.spec\.js:40 .* passed run alone/);

    assert.equal(settleAlone(browser, rerun('unexpected')).failed.length, 1);
  });
});

describe('the specs a change reaches (fast)', () => {
  const app = `import { HomePage } from './pages/HomePage.jsx';
import { SchedulePage } from './pages/SchedulePage.jsx';
import { SessionPage } from './pages/SessionPage.jsx';
import { Layout } from './components/Layout.jsx';
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="schedule" element={<SchedulePage />} />
        <Route path="sessions/:id" element={<SessionPage />} />
        <Route path="*" element={<NotFoundPage />} />`;
  const repo = {
    graph: new Map([
      ['src/App.jsx', ['src/pages/HomePage.jsx', 'src/pages/SchedulePage.jsx', 'src/pages/SessionPage.jsx', 'src/components/Layout.jsx']],
      ['src/pages/SchedulePage.jsx', ['src/components/FilterBar.jsx', 'src/components/SessionCard.jsx']],
      ['src/pages/HomePage.jsx', ['src/components/SessionCard.jsx']],
      ['src/pages/SessionPage.jsx', []],
      ['src/components/Layout.jsx', ['src/components/UserSwitcher.jsx']],
    ]),
    routes: routesOf(app),
    specs: new Map([
      ['tests/schedule.spec.js', `await visit(page, '/schedule?day=1');`],
      ['tests/session.spec.js', 'await visit(page, `/sessions/${id}`); // links back to /schedule'],
      ['tests/home.spec.js', `await visit(page); expect(link).toHaveAttribute('href', '/schedule');`],
      ['tests/smoke.spec.js', `for (const r of ROUTES) await visit(page, r.path);`],
      ['tests/presentation.spec.js', `await page.goto('/schedule');`],
    ]),
  };

  test('routes come from App.jsx, with the param dropped and the catch-all left out', () => {
    assert.deepEqual([...repo.routes], [['src/pages/HomePage.jsx', '/'], ['src/pages/SchedulePage.jsx', '/schedule'], ['src/pages/SessionPage.jsx', '/sessions/']]);
  });

  test('a spec visits what it navigates to, not what it only mentions', () => {
    assert.deepEqual(pathsIn(repo.specs.get('tests/session.spec.js')), ['/sessions/']);
    assert.deepEqual(pathsIn(repo.specs.get('tests/home.spec.js')), ['/']);
    assert.deepEqual(pathsIn(repo.specs.get('tests/smoke.spec.js')), ['*']);
  });

  test('a component reaches the pages that import it, and their specs — never the decks', () => {
    assert.deepEqual(affectedSpecs(['src/components/FilterBar.jsx'], repo), ['tests/schedule.spec.js', 'tests/smoke.spec.js']);
    assert.deepEqual(affectedSpecs(['src/components/SessionCard.jsx'], repo), ['tests/home.spec.js', 'tests/schedule.spec.js', 'tests/smoke.spec.js']);
  });

  test("the branch's own spec always runs; a change no page renders runs nothing else", () => {
    assert.deepEqual(affectedSpecs(['tests/session.spec.js', 'docs/context/ui.md', 'server/routes/users.js'], repo), ['tests/session.spec.js']);
  });

  test('the shell, the rules or the config could break any page: the whole suite', () => {
    for (const f of ['src/components/UserSwitcher.jsx', 'src/App.jsx', 'server/lib/seats.js', 'tests/helpers.js', 'vite.config.js', 'Makefile']) {
      assert.equal(affectedSpecs([f], repo), null, f);
    }
  });

  test('imports resolve relative to the file', () => {
    assert.deepEqual(importsOf('src/pages/SchedulePage.jsx', `import { a } from '../components/FilterBar.jsx';\nimport x from 'react';\nconst L = lazy(() => import('./Other.jsx'));`),
      ['src/components/FilterBar.jsx', 'src/pages/Other.jsx']);
  });
});

describe('what CI runs for a pull request', () => {
  const repo = {
    graph: new Map([['src/App.jsx', ['src/pages/SchedulePage.jsx']], ['src/pages/SchedulePage.jsx', []]]),
    routes: new Map([['src/pages/SchedulePage.jsx', '/schedule']]),
    specs: new Map([['tests/schedule.spec.js', `visit(page, '/schedule')`], ['tests/smoke.spec.js', `visit(page, '/')`], ['tests/presentation.spec.js', `page.goto('/x')`]]),
  };

  test('any pull request: the whole suite but the decks, unless it touches one', () => {
    assert.deepEqual(ciSpecs(['server/lib/seats.js'], repo, false), ['tests/schedule.spec.js', 'tests/smoke.spec.js']);
    assert.deepEqual(ciSpecs(['src/components/presentation/ship.jsx'], repo, false), []);
  });

  test('a ship:fast one: the same specs the local gate chose', () => {
    assert.deepEqual(ciSpecs(['src/pages/SchedulePage.jsx'], repo, true), ['tests/schedule.spec.js']);
    assert.deepEqual(ciSpecs(['docs/context/ui.md'], repo, true), ['tests/smoke.spec.js']);
  });
});

describe('the line the verify agent copies back', () => {
  const failure = (i) => ({ test: `[desktop] a.spec.js:${i} › t${i}`, error: `line 1\nline 2\nline 3\nline 4\n${'x'.repeat(500)}`, at: `a.spec.js:${i}` });
  const result = (n) => ({ ok: false, sha: 'abc', unit: { passed: 1, failed: 0 }, browser: { passed: 0, failed: Array.from({ length: n }, (_, i) => failure(i)), flaky: 0, skipped: 0 }, tampered: [] });

  test('keeps three lines of each error, at most 300 characters', () => {
    const [f] = printable(result(1)).browser.failed;
    assert.equal(f.error, 'line 1\nline 2\nline 3');
    assert.equal(f.test, '[desktop] a.spec.js:0 › t0');
  });

  test('names at most ten failures and says how many more gate.json has', () => {
    const b = printable(result(13)).browser;
    assert.equal(b.failed.length, 10);
    assert.match(b.more, /^3 more failed/);
    assert.equal(printable(result(2)).browser.more, undefined);
  });

  test('changes nothing but the failures — the rest is what readGate checks', () => {
    const r = result(1);
    const p = printable(r);
    assert.deepEqual({ ...p, browser: { ...p.browser, failed: [] } }, { ...r, browser: { ...r.browser, failed: [] } });
  });
});
