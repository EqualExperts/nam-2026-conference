/**
 * Facts for code review and QA, from git — never an agent's word.
 *
 *   node scripts/qa-facts.mjs origin/main [--ticket=small|full] [--depth=fast|balanced|thorough]
 *   # prints: --app-lines=N --ui-only=yes|no --lines=N --docs-only=yes|no --code-lines=N --size=tiny|small|large
 *
 * `--size` is how hard both passes work: a one-line fix should not get the
 * review a thousand-line change does. It weighs the ticket (ship sized it,
 * and says so with the ship:full label), the code the diff actually changes,
 * and whether that code is where a missed defect is expensive.
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

/** Lines added + removed across every file — what a review has to read. */
export function totalLines(numstat) {
  let n = 0;
  for (const line of numstat.split('\n').filter(Boolean)) {
    const [add, del] = line.split('\t');
    n += add === '-' ? BINARY_LINES : Number(add) + Number(del);
  }
  return n;
}

/**
 * Lines a reviewer has to reason about: everything but the spec and the
 * context docs, which every ship pull request carries (~80 lines of spec on
 * a one-line fix) and which say what the code does rather than do it.
 */
export function codeLines(numstat) {
  let n = 0;
  for (const line of numstat.split('\n').filter(Boolean)) {
    const [add, del, file] = line.split('\t');
    if (/^(specs|docs\/context)\//.test(file || '') || file === 'README.md') continue;
    n += add === '-' ? BINARY_LINES : Number(add) + Number(del);
  }
  return n;
}

/** Where a missed defect costs an attendee's seat or every later ticket. */
export function risky(names) {
  return names.split('\n').filter(Boolean).some(f =>
    /^(server\/lib\/|\.claude\/|\.github\/|scripts\/|docs\/harness\/)/.test(f)
    || ['CLAUDE.md', 'server/db.js', 'server/seed.js'].includes(f));
}

const SIZES = ['tiny', 'small', 'large'];

/**
 * tiny | small | large. The diff sets the floor, the ticket can raise it
 * (ship sized it full: never tiny, and large once it is more than a small
 * change), risk does too (never tiny, and large past 150 lines rather than
 * 300 — a 70-line refactor of server/lib is not a large change), and the
 * team's dial moves it a step.
 */
export function sizeFor({ codeLines: n, docsOnly: prose, risky: danger, ticket, depth }) {
  if (depth === 'thorough') return 'large';
  if (prose && !danger) return 'tiny';
  let i = n <= 30 ? 0 : n <= 300 ? 1 : 2;
  if (ticket === 'full' || danger) i = Math.max(i, n > 150 ? 2 : 1);
  if (depth === 'fast') i -= 1;
  return SIZES[Math.max(0, Math.min(2, i))];
}

/** Docs-only: every changed file is prose — docs/, specs/ or a markdown file — and none is a harness playbook. */
export function docsOnly(names) {
  const files = names.split('\n').filter(Boolean);
  return files.length > 0
    && files.every(f => /^(docs|specs)\//.test(f) || f.endsWith('.md'))
    && !files.some(f => f.startsWith('docs/harness/') || f === 'CLAUDE.md');
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
  const base = process.argv.slice(2).find(a => !a.startsWith('--')) || 'origin/main';
  const opt = (k) => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1] || '';
  const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8' }); } catch { return ''; } };
  const range = `${base}...HEAD`;
  // No diff (an unknown base) gives no facts that allow a skip.
  const numstat = git('diff', '--numstat', range);
  const names = git('diff', '--name-only', range);
  const size = names ? sizeFor({ codeLines: codeLines(numstat), docsOnly: docsOnly(names), risky: risky(names),
    ticket: opt('ticket'), depth: opt('depth') }) : 'large';
  console.log(`--app-lines=${appLines(numstat)} --ui-only=${uiOnly(names) ? 'yes' : 'no'} ` +
    `--lines=${totalLines(numstat)} --docs-only=${docsOnly(names) ? 'yes' : 'no'} ` +
    `--code-lines=${codeLines(numstat)} --size=${size}`);
}
