/**
 * The gate, as a command rather than a report.
 *
 *   node scripts/gate.mjs        # npm test, then the Playwright suite; prints one JSON line
 *   GATE_SCOPE=branch node scripts/gate.mjs   # …only the browser specs the change reaches (ship --fast)
 *
 * The decks' spec (`tests/presentation.spec.js`) runs only when the branch
 * touches a deck: the presentations ride along in the fork so attendees can
 * open them, but they are not the app, and on a loaded laptop their slow
 * specs timed out and sent an unrelated ticket round the fix loop twice.
 *
 * The ship loop used to ask an agent whether the suite was green and branch on
 * its answer. That is an agent marking its own homework. This runs the suites,
 * reads Playwright's JSON reporter rather than its prose, and prints the
 * verdict as JSON — the line the workflow parses, and the file
 * (`test-results/gate.json`) the ship job re-reads.
 *
 * Two things it does that a person running `npm run verify` would not:
 *
 *  - **A failing browser test is retried once.** One that passes on retry is
 *    reported as `flaky`, not failed. A flake in a spec the branch never
 *    touched used to cost a whole fix round, and the fixer would "fix"
 *    unrelated code to make it go away. One that fails twice, in a spec the
 *    branch never touched, is run again on its own: on a laptop running
 *    several agents a slow spec times out under load and passes alone, and
 *    that is flaky too. One that fails alone as well is a real failure —
 *    the branch can break a spec it did not edit.
 *  - **It reads the branch's diff of `tests/`.** A removed `test(` or
 *    `expect(`, or an added `.skip` / `.only` / `.fixme`, is listed under
 *    `tampered`. That is not always wrong — a ticket can change behaviour —
 *    so it does not fail the gate. It goes to the auditor whose job is to ask.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
/** What `tampered` reads: the tests, and everything that decides which run. */
export const WATCHED = ['tests/', 'playwright.config.js', 'package.json', 'scripts/gate.mjs'];
const OUT = join(ROOT, 'test-results');
/** The presentations: in the repo so a fork can show them, not part of the app. */
const DECK_SPEC = 'tests/presentation.spec.js';
const DECK = [DECK_SPEC, 'src/components/presentation/', 'src/pages/PresentationPage.jsx',
  'src/pages/ProductPresentationPage.jsx', 'src/lib/presentation.js'];

/** Playwright's JSON report → counts and the tests that failed. */
export function summarise(report) {
  const failed = [];
  // Named, not just counted: a flake in the test the branch just added is a
  // finding, and a count cannot say which one it was.
  const flakyTests = [];
  // file › title → the status on each project, to find a test no project ran.
  const byTest = new Map();
  const walk = (suite, file) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        const k = `${spec.file || file} › ${spec.title}`;
        byTest.set(k, [...(byTest.get(k) || []), t.status]);
        if (t.status === 'flaky') { flakyTests.push(`[${t.projectName}] ${spec.file || file}:${spec.line} › ${spec.title}`); continue; }
        if (t.status !== 'unexpected') continue;
        const last = (t.results || []).at(-1) || {};
        const error = (last.error?.message || '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 6).join('\n');
        failed.push({ test: `[${t.projectName}] ${spec.file || file}:${spec.line} › ${spec.title}`, error, at: `${spec.file || file}:${spec.line}` });
      }
    }
    for (const s of suite.suites || []) walk(s, s.file || file);
  };
  for (const s of report.suites || []) walk(s, s.file);
  // A spec that does not compile, or an app that never boots, fails no test —
  // it fails the run. Those are the most fixable reds there are, so name them.
  for (const e of report.errors || []) {
    const msg = (e.message || '').replace(/\u001b\[[0-9;]*m/g, '');
    failed.push({ test: e.location ? `${e.location.file}:${e.location.line}` : 'playwright', error: msg.split('\n').slice(0, 6).join('\n') });
  }
  const st = report.stats || {};
  const neverRan = [...byTest].filter(([, statuses]) => statuses.every(x => x === 'skipped')).map(([k]) => k);
  return { passed: st.expected || 0, failed, flaky: st.flaky || 0, flakyTests, skipped: st.skipped || 0, neverRan };
}

/** A unified diff → `file › title` of every browser test it adds. */
export function addedTests(diff) {
  const out = [];
  let file = null;
  for (const line of diff.split('\n')) {
    const header = /^diff --git a\/\S+ b\/(\S+)/.exec(line);
    if (header) { file = header[1].replace(/^tests\//, ''); continue; }
    const t = file && file.endsWith('.spec.js') && /^\+\s*test\(\s*(['"`])(.+?)\1/.exec(line);
    if (t) out.push(`${file} › ${t[2].replace(/\\'/g, "'")}`);
  }
  return out;
}

/**
 * The tests this branch added that skipped on every project: they never ran,
 * so they prove nothing — yet the gate passed them, and on #76 code review and
 * QA both counted them as coverage. Each is a failure to aim a fix at.
 */
export function neverRanAdded(neverRan, added) {
  const mine = new Set(added);
  return neverRan.filter(k => mine.has(k)).map(test => ({
    test,
    error: 'skipped on every project — a test the branch added that never ran proves nothing; make its precondition hold (a lane, a slot, a pinned clock) rather than skipping',
  }));
}

/** A unified diff of tests/ → the lines that weaken the suite. */
export function tampered(diff) {
  const out = [];
  let file = null;
  for (const line of diff.split('\n')) {
    const header = /^diff --git a\/\S+ b\/(\S+)/.exec(line);
    if (header) { file = header[1]; continue; }
    if (/^(\+\+\+|---) /.test(line)) continue;
    // A doubled prefix is a diff inside a fixture string, not a test.
    if (/^[+-][+-]/.test(line)) continue;
    // The gate's own inputs: loosening them is as good as skipping a test.
    // Named once per file — the auditor reads the diff; this says where to look.
    if (file && !file.startsWith('tests/') && /^[+-]/.test(line)) {
      const note = `${file}: changed — it decides what the gate runs`;
      if (!out.includes(note)) out.push(note);
      continue;
    }
    const removed = line.startsWith('-') && /\b(test|it)\s*\(|\bexpect\s*\(/.test(line);
    const skipped = line.startsWith('+') && /\.(skip|only|fixme)\s*\(/.test(line);
    if (removed || skipped) out.push(`${file}: ${line.slice(0, 160)}`);
  }
  return out;
}

/**
 * The browser specs this branch added or changed
 * (`git diff --name-only --diff-filter=d`), for ship's fast tier — a round
 * runs those instead of the whole suite, and the pull request's CI runs the
 * rest. The probe file is QA's scratch, never the branch's proof.
 */
export function branchSpecs(nameOnly) {
  return nameOnly.split('\n').map(s => s.trim())
    .filter(f => /^tests\/[^/]+\.spec\.js$/.test(f) && f !== 'tests/qa-probe.spec.js');
}

/*
 * Which browser specs a change can reach, for the fast tier. A command, not an
 * agent's opinion: from each changed file up the import graph to the pages it
 * ends on, then the routes those pages serve, then the specs that visit them.
 * Wherever that cannot be told — the shell every page sits in, the store,
 * config, the rules — the answer is `null`: the whole suite.
 */

/** A src file's relative imports, resolved to repo paths. */
export function importsOf(file, source) {
  const dir = file.split('/').slice(0, -1);
  const out = [];
  for (const m of source.matchAll(/(?:from\s+|import\s*\(\s*|^import\s+)['"](\.{1,2}\/[^'"]+)['"]/gm)) {
    const parts = [...dir];
    for (const seg of m[1].split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    out.push(parts.join('/'));
  }
  return out;
}

/** App.jsx → page file → the path it serves: '/', '/schedule', '/sessions/'. */
export function routesOf(appSource) {
  const files = new Map();
  for (const m of appSource.matchAll(/import\s+\{\s*(\w+)\s*\}\s+from\s+'\.\/(pages\/\w+\.jsx)'/g)) files.set(m[1], `src/${m[2]}`);
  const routes = new Map();
  for (const m of appSource.matchAll(/<Route\s+(index|path="([^"]+)")\s+element=\{<(\w+)/g)) {
    const file = files.get(m[3]);
    if (!file || m[2] === '*') continue;
    routes.set(file, m[1] === 'index' ? '/' : `/${m[2].replace(/:\w+.*$/, '')}`);
  }
  return routes;
}

/**
 * A spec's source → the app paths it opens: `visit(page, '/x')` (bare, '/'),
 * or `goto('/x')`. A path it only mentions — a link it checks — is not a visit.
 */
export function pathsIn(specSource) {
  const opened = [...specSource.matchAll(/\b(?:visit\(\s*page\s*(?:,\s*['`]([^'`?#$]*)|\))|goto\(\s*['`]([^'`?#$]*))/g)]
    .map(m => m[1] ?? m[2] ?? '/').map(p => p === '' ? '/' : p);
  // A path it computes — a loop over every page — could be any of them.
  const computed = /\b(?:visit\(\s*page\s*,\s*[a-zA-Z_]|goto\(\s*[a-zA-Z_])/.test(specSource);
  return [...new Set(opened)].filter(p => p.startsWith('/') && !p.startsWith('/api')).concat(computed ? ['*'] : []);
}

const visits = (paths, route) => paths.some(p => p === '*' || route === '/' ? p === '*' || p === '/'
  : route.endsWith('/') ? p.startsWith(route) : p === route || p === `${route}/`);

/** Files whose change the API tests cover, or that no page renders. */
const NO_PAGE = [/^docs\//, /^specs\//, /^tests\/(unit|api)\//, /^\.claude\//, /^\.github\//, /\.md$/, /^server\/routes\//];
/** Files every page depends on, or that decide what runs. */
const EVERY_PAGE = [/^src\/(App|main)\.jsx$/, /^src\/index\.css$/, /^server\/(lib\/|db\.js|seed\.js)/,
  /^tests\/helpers\.js$/, /^playwright\.config\.js$/, /^package(-lock)?\.json$/, /^vite\.config\.js$/, /^index\.html$/, /^scripts\/gate\.mjs$/];

/**
 * `changed`: repo paths. `graph`: src file → its imports. `routes`: page file →
 * path. `specs`: spec file → its source. → the specs to run, or null for all.
 */
export function affectedSpecs(changed, { graph, routes, specs }) {
  const importers = new Map();
  for (const [file, deps] of graph) for (const d of deps) importers.set(d, [...(importers.get(d) || []), file]);
  const pages = new Set();
  const out = new Set();
  for (const file of changed) {
    if (/^tests\/[^/]+\.spec\.js$/.test(file)) { if (file !== 'tests/qa-probe.spec.js') out.add(file); continue; }
    if (EVERY_PAGE.some(r => r.test(file))) return null;
    if (NO_PAGE.some(r => r.test(file))) continue;
    if (!file.startsWith('src/')) return null;
    // Up the graph, stopping at a page: what imports a page does not render it.
    const seen = new Set([file]);
    const todo = [file];
    while (todo.length) {
      const f = todo.pop();
      if (routes.has(f)) { pages.add(f); continue; }
      const up = importers.get(f) || [];
      // Rendered by the app shell itself, not through one page: every page.
      if (up.some(u => /^src\/(App|main)\.jsx$/.test(u))) return null;
      for (const u of up) if (!seen.has(u)) { seen.add(u); todo.push(u); }
    }
  }
  for (const page of pages) {
    for (const [spec, source] of specs) if (visits(pathsIn(source), routes.get(page))) out.add(spec);
  }
  // The decks' spec opens app pages too; it still only runs for a deck change.
  return (deckTouched(changed.join('\n')) ? [...out] : withoutDeck([...out])).sort();
}

/** The repo, read for affectedSpecs. */
function readRepo() {
  const graph = new Map();
  const walk = (dir) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(rel);
      else if (/\.(jsx?|mjs)$/.test(e.name)) graph.set(rel, importsOf(rel, readFileSync(join(ROOT, rel), 'utf8')));
    }
  };
  walk('src');
  const routes = routesOf(readFileSync(join(ROOT, 'src/App.jsx'), 'utf8'));
  const specs = new Map(readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.spec.js') && f !== 'qa-probe.spec.js')
    .map(f => [`tests/${f}`, readFileSync(join(ROOT, 'tests', f), 'utf8')]));
  return { graph, routes, specs };
}

/**
 * Does `git status --porcelain` show work the pull request will not contain?
 * Any tracked change counts; an untracked file only under tests/. `pinned`
 * names files the caller swapped in on purpose — the ship job runs main's
 * gate and config against the branch — which are not the branch's work.
 */
export function isDirty(porcelain, pinned = []) {
  return porcelain.split('\n')
    .filter(l => l && !pinned.includes(l.slice(3)))
    .some(l => !l.startsWith('??') || l.slice(3).startsWith('tests/'));
}

/**
 * `git diff --name-only` of the branch → whether to run the decks' spec, and
 * the spec files to run when it should not (`all`: every `tests/*.spec.js`).
 */
export function deckTouched(nameOnly) {
  return nameOnly.split('\n').some(f => DECK.some(d => f.trim().startsWith(d)));
}
export function withoutDeck(all) {
  return all.filter(f => f !== DECK_SPEC);
}

/**
 * The failures worth a second run on their own: in a spec the branch did not
 * change. A failure in one it did change is the branch's to fix, load or not.
 */
export function untouchedFailures(failed, nameOnly) {
  const changed = new Set(nameOnly.split('\n').map(f => f.trim()));
  return failed.filter(f => f.at && !changed.has(`tests/${f.at.replace(/:\d+$/, '')}`));
}

/**
 * Fold the lone rerun's report back in: a failure that passed alone moves to
 * flaky, named as such, and stops failing the gate.
 */
export function settleAlone(browser, rerun) {
  const fine = new Set();
  const walk = (suite, file) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        if (t.status === 'expected' || t.status === 'flaky') fine.add(`[${t.projectName}] ${spec.file || file}:${spec.line} › ${spec.title}`);
      }
    }
    for (const s of suite.suites || []) walk(s, s.file || file);
  };
  for (const s of rerun.suites || []) walk(s, s.file);
  const passedAlone = browser.failed.filter(f => fine.has(f.test));
  return {
    ...browser,
    failed: browser.failed.filter(f => !fine.has(f.test)),
    flaky: browser.flaky + passedAlone.length,
    flakyTests: [...(browser.flakyTests || []), ...passedAlone.map(f => `${f.test} (failed under load, passed run alone)`)],
  };
}

/**
 * The line ship's verify agent copies back, verbatim. On a laptop run with
 * five timeouts and their stacks it came back mangled, the loop read
 * "unreadable gate output", and two fix rounds aimed at nothing. Short enough
 * to copy: errors to three lines, at most ten failures; gate.json keeps it all.
 */
export function printable(result) {
  const failed = result.browser.failed;
  return {
    ...result,
    browser: {
      ...result.browser,
      failed: failed.slice(0, 10).map(f => ({ ...f, error: f.error.split('\n').slice(0, 3).join('\n').slice(0, 300) })),
      ...(failed.length > 10 ? { more: `${failed.length - 10} more failed — test-results/gate.json lists them` } : {}),
    },
  };
}

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

/**
 * The processes to stop before the suite boots its own app: listeners on this
 * run's ports whose working directory is inside this checkout — a dev server an
 * agent started and never stopped. On #67 the spec writer ran `npm run dev &`
 * to look at a 404, and an hour later the gate could not start its app on the
 * same port. A listener from anywhere else is never touched.
 * `listeners`: [{ pid, cwd }].
 */
export function strays(listeners, root) {
  const inside = (dir) => dir === root || dir.startsWith(root.endsWith('/') ? root : `${root}/`);
  return listeners.filter((l) => l.cwd && inside(l.cwd)).map((l) => l.pid);
}

function listenersOn(ports) {
  const out = [];
  for (const port of ports) {
    const pids = spawnSync('lsof', ['-t', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout || '';
    for (const pid of pids.split('\n').filter(Boolean)) {
      const cwd = (spawnSync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], { encoding: 'utf8' }).stdout || '')
        .split('\n').find((l) => l.startsWith('n'))?.slice(1);
      out.push({ pid: Number(pid), cwd });
    }
  }
  return out;
}

function main() {
  for (const pid of strays(listenersOn([process.env.PORT ?? 3001, process.env.WEB_PORT ?? 5173]), ROOT)) {
    try { process.kill(pid); console.error(`gate: stopped a server this checkout left running (pid ${pid})`); } catch { /* gone */ }
  }

  mkdirSync(OUT, { recursive: true });
  const json = join(OUT, 'gate-playwright.json');
  const sha = git('rev-parse', 'HEAD');
  // Untracked files count when they are tests: a spec nobody committed can
  // turn the gate green on code the pull request will not contain.
  const pinned = (process.env.GATE_PINNED || '').split(',').filter(Boolean);
  const dirty = isDirty(git('status', '--porcelain', '--untracked-files=all'), pinned);

  const unit = spawnSync('npm', ['test', '--silent'], { cwd: ROOT, encoding: 'utf8' });
  const unitCounts = /# pass (\d+)[\s\S]*?# fail (\d+)/.exec(unit.stdout || '') || [];

  // GATE_BASE: what the branch is judged against — main, unless it stacks on
  // another pull request.
  const base = process.env.GATE_BASE || 'origin/main';
  let specs = [];
  let changed = '';
  try { changed = git('diff', '--name-only', '--diff-filter=d', `${base}...HEAD`); } catch { /* no base */ }
  // Fast: the specs the change reaches, or the whole suite when that cannot
  // be told. A change no page renders — docs, a route the API tests cover —
  // runs no browser spec at all.
  let scope = 'full';
  if (process.env.GATE_SCOPE === 'branch') {
    const reached = affectedSpecs(changed.split('\n').filter(Boolean), readRepo());
    if (reached) { scope = 'branch'; specs = reached; }
  }
  // The whole suite, less the decks' spec unless the branch is a deck change.
  const excluded = scope === 'full' && !deckTouched(changed) ? [DECK_SPEC] : [];
  if (excluded.length) {
    specs = withoutDeck(readdirSync(join(ROOT, 'tests')).filter(f => f.endsWith('.spec.js')).map(f => `tests/${f}`));
  }

  spawnSync('npm', ['run', 'db:seed', '--silent'], { cwd: ROOT, stdio: 'ignore' });
  // A report left by an earlier run must never be read as this one's.
  rmSync(json, { force: true });
  const none = scope === 'branch' && !specs.length;
  const pw = none ? { status: 0 } : spawnSync('npx', ['playwright', 'test', ...specs, '--retries=1', '--forbid-only', '--reporter=json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: json, PLAYWRIGHT_JSON_OUTPUT_FILE: json },
  });
  let browser;
  if (none) browser = { passed: 0, failed: [], flaky: 0, flakyTests: [], skipped: 0, neverRan: [] };
  else try { browser = summarise(JSON.parse(readFileSync(json, 'utf8'))); }
  catch { browser = { passed: 0, failed: [{ test: 'playwright', error: (pw.stderr || 'no report written').slice(-600) }], flaky: 0, skipped: 0 }; }

  // Failed twice in a spec the branch never touched: once more, alone, on one
  // worker and a fresh seed — whatever else the machine is doing.
  const alone = untouchedFailures(browser.failed, changed);
  if (alone.length) {
    const rerunJson = join(OUT, 'gate-alone.json');
    rmSync(rerunJson, { force: true });
    spawnSync('npm', ['run', 'db:seed', '--silent'], { cwd: ROOT, stdio: 'ignore' });
    spawnSync('npx', ['playwright', 'test', ...new Set(alone.map(f => `tests/${f.at}`)), '--workers=1', '--retries=0', '--reporter=json'], {
      cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: rerunJson, PLAYWRIGHT_JSON_OUTPUT_FILE: rerunJson },
    });
    try { browser = settleAlone(browser, JSON.parse(readFileSync(rerunJson, 'utf8'))); } catch { /* no report: they stay failed */ }
  }

  let diff = '';
  try { diff = git('diff', `${base}...HEAD`, '--', ...WATCHED); } catch { /* no base to compare with */ }

  let testDiff = '';
  try { testDiff = git('diff', `${base}...HEAD`, '--', 'tests/'); } catch { /* no base */ }
  browser.failed.push(...neverRanAdded(browser.neverRan || [], addedTests(testDiff)));

  const unitFailed = unit.status !== 0;
  const result = {
    // A run whose only failures then passed alone still exited non-zero.
    ok: !unitFailed && (pw.status === 0 || alone.length > 0) && browser.failed.length === 0 && !dirty,
    sha,
    dirty,
    unit: unitFailed
      // A timeout exits non-zero with `# fail 0` and `# cancelled 1`; it
      // still failed, and the loop needs something to aim a fix at.
      ? { passed: Number(unitCounts[1] || 0), failed: Math.max(1, Number(unitCounts[2] || 0)), output: (unit.stdout || '').split('\n').filter(l => /not ok|Error|assert|cancelled/.test(l)).slice(0, 12).join('\n') }
      : { passed: Number(unitCounts[1] || 0), failed: 0 },
    browser,
    // What the browser count covers: `full`, or the specs the change reaches.
    scope,
    ...(scope === 'branch' ? { specs } : {}),
    ...(excluded.length ? { excluded } : {}),
    tampered: tampered(diff),
  };
  writeFileSync(join(OUT, 'gate.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(printable(result)));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
