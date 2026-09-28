/**
 * The gate, as a command rather than a report.
 *
 *   node scripts/gate.mjs        # npm test, then the Playwright suite; prints one JSON line
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
 *    unrelated code to make it go away.
 *  - **It reads the branch's diff of `tests/`.** A removed `test(` or
 *    `expect(`, or an added `.skip` / `.only` / `.fixme`, is listed under
 *    `tampered`. That is not always wrong — a ticket can change behaviour —
 *    so it does not fail the gate. It goes to the auditor whose job is to ask.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
/** What `tampered` reads: the tests, and everything that decides which run. */
export const WATCHED = ['tests/', 'playwright.config.js', 'package.json', 'scripts/gate.mjs'];
const OUT = join(ROOT, 'test-results');

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
        failed.push({ test: `[${t.projectName}] ${spec.file || file}:${spec.line} › ${spec.title}`, error });
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

  spawnSync('npm', ['run', 'db:seed', '--silent'], { cwd: ROOT, stdio: 'ignore' });
  // A report left by an earlier run must never be read as this one's.
  rmSync(json, { force: true });
  const pw = spawnSync('npx', ['playwright', 'test', '--retries=1', '--forbid-only', '--reporter=json'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: json, PLAYWRIGHT_JSON_OUTPUT_FILE: json },
  });
  let browser;
  try { browser = summarise(JSON.parse(readFileSync(json, 'utf8'))); }
  catch { browser = { passed: 0, failed: [{ test: 'playwright', error: (pw.stderr || 'no report written').slice(-600) }], flaky: 0, skipped: 0 }; }

  let diff = '';
  // GATE_BASE: what the branch is judged against — main, unless it stacks on
  // another pull request.
  const base = process.env.GATE_BASE || 'origin/main';
  try { diff = git('diff', `${base}...HEAD`, '--', ...WATCHED); } catch { /* no base to compare with */ }

  let testDiff = '';
  try { testDiff = git('diff', `${base}...HEAD`, '--', 'tests/'); } catch { /* no base */ }
  browser.failed.push(...neverRanAdded(browser.neverRan || [], addedTests(testDiff)));

  const unitFailed = unit.status !== 0;
  const result = {
    ok: !unitFailed && pw.status === 0 && browser.failed.length === 0 && !dirty,
    sha,
    dirty,
    unit: unitFailed
      // A timeout exits non-zero with `# fail 0` and `# cancelled 1`; it
      // still failed, and the loop needs something to aim a fix at.
      ? { passed: Number(unitCounts[1] || 0), failed: Math.max(1, Number(unitCounts[2] || 0)), output: (unit.stdout || '').split('\n').filter(l => /not ok|Error|assert|cancelled/.test(l)).slice(0, 12).join('\n') }
      : { passed: Number(unitCounts[1] || 0), failed: 0 },
    browser,
    tampered: tampered(diff),
  };
  writeFileSync(join(OUT, 'gate.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
