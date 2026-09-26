/**
 * Facts for QA's triage, from git — never the planner's word.
 *
 *   node scripts/qa-facts.mjs origin/main      # prints: --app-lines=N --ui-only=yes|no
 *
 * QA may skip exploring a change only if it is UI-only and small. The planner
 * judges whether it is cosmetic; these two facts it does not get to judge.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A binary file counts as over any sane cap: it can never hide in a skip. */
export const BINARY_LINES = 1000;

/** Lines added + removed under src/ and server/, from `git diff --numstat`. */
export function appLines(numstat) {
  let n = 0;
  for (const line of numstat.split('\n').filter(Boolean)) {
    const [add, del, file] = line.split('\t');
    if (!/^(src|server)\//.test(file || '')) continue;
    n += add === '-' ? BINARY_LINES : Number(add) + Number(del);
  }
  return n;
}

/**
 * UI-only: every changed file under src/, tests/, docs/ or specs/, at least
 * one under src/, and none under docs/harness/ — the playbooks are the
 * harness, not documentation of the app.
 */
export function uiOnly(names) {
  const files = names.split('\n').filter(Boolean);
  return files.length > 0
    && files.every(f => /^(src|tests|docs|specs)\//.test(f))
    && !files.some(f => f.startsWith('docs/harness/'))
    && files.some(f => f.startsWith('src/'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = process.argv[2] || 'origin/main';
  const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8' }); } catch { return ''; } };
  const range = `${base}...HEAD`;
  // No diff (an unknown base) gives no facts that allow a skip.
  console.log(`--app-lines=${appLines(git('diff', '--numstat', range))} --ui-only=${uiOnly(git('diff', '--name-only', range)) ? 'yes' : 'no'}`);
}
