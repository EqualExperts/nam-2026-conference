/**
 * The gate, as a command rather than a report.
 *
 *   node scripts/gate.mjs        # npm test, then the Playwright suite; prints one JSON line
 *
 * The ship loop used to ask an agent whether the suite was green and branch on
 * its answer. That is an agent marking its own homework. This runs the suites,
 * reads Playwright's JSON reporter rather than its prose, and prints the
 * verdict as JSON — the line the workflow parses, and the file
 * (`test-results/gate.json`) the build job re-reads.
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
  const walk = (suite, file) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
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
  return { passed: st.expected || 0, failed, flaky: st.flaky || 0, skipped: st.skipped || 0 };
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

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();

function main() {
  mkdirSync(OUT, { recursive: true });
  const json = join(OUT, 'gate-playwright.json');
  const sha = git('rev-parse', 'HEAD');
  // Untracked files count when they are tests: a spec nobody committed can
  // turn the gate green on code the pull request will not contain.
  const dirty = git('status', '--porcelain', '--untracked-files=all')
    .split('\n').some(l => l && (!l.startsWith('??') || l.slice(3).startsWith('tests/')));

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
  try { diff = git('diff', 'origin/main...HEAD', '--', ...WATCHED); } catch { /* no origin/main: nothing to compare */ }

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
