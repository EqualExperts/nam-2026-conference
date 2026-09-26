/**
 * Would the branch's tests fail without the branch's code?
 *
 *   node scripts/red-check.mjs          # prints one JSON line; GATE_BASE picks the base (origin/main)
 *
 * A test that passes with or without the change proves nothing, and it is
 * the easiest thing for an agent to write: on #41 the new tests exercised
 * the `plural` helper, which the change did not touch, so reverting the whole
 * fix left the suite green. The small-tier auditor was asked about exactly
 * this and said it had checked. This makes the check a command.
 *
 * In a scratch worktree of HEAD it puts back the base branch's version of
 * every app file the branch changed (and removes the ones it added), keeps
 * the branch's tests, and runs only the test files the branch added or
 * changed. At least one should fail. The result goes to an auditor, not
 * straight to a verdict: a refactor's tests are meant to pass either way.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

/** App code: what a test is supposed to prove the behaviour of. */
const isCode = (f) => /^(src|server)\//.test(f);
const isUnitTest = (f) => /^tests\/(unit|api)\/.+\.test\.js$/.test(f);
const isBrowserTest = (f) => /^tests\/[^/]+\.spec\.js$/.test(f);

/**
 * From `git diff --name-status base...HEAD`, what to revert and what to run.
 * Deleted tests are not run; added code is removed rather than reverted.
 */
export function plan(nameStatus) {
  const code = [], added = [], renamed = [], unit = [], browser = [];
  for (const line of nameStatus.split('\n').filter(Boolean)) {
    const [status, ...paths] = line.split('\t');
    const file = paths.at(-1);
    if (status.startsWith('D')) continue;
    // A renamed app file is reverted by removing the new path and restoring
    // the old one — the base has no file at the new name to check out, and
    // asking for it made the whole check exit with a git error.
    if (status.startsWith('R') && isCode(paths[0]) && isCode(file)) { renamed.push({ from: paths[0], to: file }); continue; }
    if (isCode(file)) (status.startsWith('A') || status.startsWith('C') || status.startsWith('R') ? added : code).push(file);
    else if (isUnitTest(file)) unit.push(file);
    else if (isBrowserTest(file)) browser.push(file);
  }
  const applies = (code.length + added.length + renamed.length) > 0 && (unit.length + browser.length) > 0;
  return { applies, code, added, renamed, unit, browser };
}

/** Did any of the branch's tests fail on the base branch's code? */
export function verdict(p, runs) {
  if (!p.applies) {
    return { checked: false, reason: p.unit.length + p.browser.length === 0 ? 'no tests changed' : 'no app code changed' };
  }
  const failedOnBase = runs.some(r => r.failed);
  return {
    checked: true,
    failedOnBase,
    tests: [...p.unit, ...p.browser],
    reverted: [...p.code, ...p.added.map(f => `${f} (removed)`), ...p.renamed.map(r => `${r.to} → ${r.from}`)],
    ...(failedOnBase ? {} : { finding: 'none of the tests this branch added or changed fail when its app code is reverted — they would pass without the change' }),
  };
}

function main() {
  const base = process.env.GATE_BASE || 'origin/main';
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' });
  const p = plan(git('diff', '--name-status', `${base}...HEAD`));
  if (!p.applies) { console.log(JSON.stringify(verdict(p, []))); return; }

  const dir = mkdtempSync(join(tmpdir(), 'red-check-'));
  const runs = [];
  try {
    git('worktree', 'add', '-q', '--detach', dir, 'HEAD');
    symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
    const mergeBase = git('merge-base', base, 'HEAD').trim();
    if (p.code.length) execFileSync('git', ['checkout', '-q', mergeBase, '--', ...p.code], { cwd: dir });
    for (const f of p.added) rmSync(join(dir, f), { force: true });
    for (const r of p.renamed) {
      rmSync(join(dir, r.to), { force: true });
      execFileSync('git', ['checkout', '-q', mergeBase, '--', r.from], { cwd: dir });
    }

    if (p.unit.length) {
      const r = spawnSync('node', ['--test', ...p.unit], { cwd: dir, encoding: 'utf8' });
      runs.push({ kind: 'unit', failed: r.status !== 0 });
    }
    if (p.browser.length) {
      // Its own ports and database: the gate or an app may be running.
      const env = { ...process.env, PORT: '4470', WEB_PORT: '4471', ORBIT_LANE: 'red-check', ORBIT_DB: join(dir, 'red-check.db') };
      spawnSync('npm', ['run', 'db:seed', '--silent'], { cwd: dir, env, stdio: 'ignore' });
      const r = spawnSync('npx', ['playwright', 'test', ...p.browser.map(f => f.replace(/^tests\//, '')), '--project=desktop', '--retries=0', '--reporter=dot'],
        { cwd: dir, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      runs.push({ kind: 'browser', failed: r.status !== 0 });
    }
  } finally {
    try { git('worktree', 'remove', '--force', dir); } catch { rmSync(dir, { recursive: true, force: true }); }
  }
  console.log(JSON.stringify(verdict(p, runs)));
}

// Always exactly one JSON line: ship relays the last line it printed, and a
// stack trace in its place (an unfetched base, a git error) read as nothing
// and skipped the check silently. Now it says why it could not check.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); }
  catch (e) {
    console.log(JSON.stringify({ checked: false, reason: 'could not run', error: String(e.message || e).split('\n')[0].slice(0, 300) }));
  }
}
