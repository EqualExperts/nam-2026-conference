#!/usr/bin/env node
/**
 * Is everything a ticket depends on done — and if not, what can it stack on?
 *
 *   node scripts/depends.mjs <issue> [--batch 2,3,4] [--wait <seconds>]
 *     # one JSON line: { depends: [n…], unmet: [{ n, title, branch, pr }…], stackOn: { n, branch, pr } | null }
 *
 * create-tasks writes a dependency as a `**Depends on:** #1 …` line. A
 * dependency is done when its issue is closed as completed — what merging its
 * pull request (Closes #n) does. One that is not done yet but is being built
 * — it has an `issue-<n>-` branch, or an open pull request — is something to
 * stack on: ship builds this ticket on that branch, and when it merges, the
 * on-merge workflow points this ticket's pull request at main and updates it.
 *
 * Shipped side by side (`/ship 2 3`), a dependency's branch appears only once
 * its setup has pushed the spec, a minute or two in, so `--wait` polls for it;
 * `--batch` names the tickets running alongside, the ones worth waiting for.
 * Always one line, always exit 0: a lookup that fails is reported, not thrown.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A ticket body → the issue numbers on its "Depends on" line(s). */
export function dependsOn(body) {
  const out = [];
  for (const line of String(body || '').split('\n')) {
    if (!/^\s*(?:[-*]\s*)?\**\s*depends on\s*:?\**\s*:?/i.test(line)) continue;
    for (const m of line.matchAll(/(?<![\w/])#(\d+)\b/g)) out.push(Number(m[1]));
  }
  return [...new Set(out)];
}

/** Whether an issue's state counts as done. */
export const isDone = ({ state, stateReason }) => state === 'CLOSED' && stateReason !== 'NOT_PLANNED';

/**
 * The branch an unmet dependency is being built on: its open pull request's
 * head (one that says Closes/Refs #n, or is on `issue-<n>-…`), else an
 * `issue-<n>-` branch on origin. `prs`: [{ number, headRefName, body }];
 * `branches`: names on origin.
 */
export function inFlight(n, prs, branches) {
  const own = new RegExp(`^issue-${n}-`);
  const says = new RegExp(`\\b(?:closes|fixes|resolves|refs)\\s+#${n}\\b`, 'i');
  const pr = prs.find((p) => own.test(p.headRefName) || says.test(p.body || ''));
  if (pr) return { branch: pr.headRefName, pr: pr.number };
  const branch = branches.filter((b) => own.test(b)).sort().at(-1);
  return branch ? { branch, pr: null } : null;
}

/** What to build on: the one unmet dependency, if it is in flight. Two or more cannot be stacked on. */
export function stackFor(unmet) {
  if (unmet.length !== 1 || !unmet[0].branch) return null;
  const [{ n, branch, pr }] = unmet;
  return { n, branch, pr };
}

function main() {
  const argv = process.argv.slice(2);
  const n = argv[0];
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : null; };
  const batch = (opt('batch') || '').split(',').map(Number).filter(Boolean);
  const wait = Number(opt('wait') || 0);
  const run = (cmd, a) => execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const gh = (...a) => JSON.parse(run('gh', a));
  try {
    const depends = dependsOn(gh('issue', 'view', n, '--json', 'body').body);
    const pending = [];
    for (const d of depends) {
      const i = gh('issue', 'view', String(d), '--json', 'number,title,state,stateReason,labels');
      if (!isDone(i)) pending.push({ n: i.number, title: i.title, busy: i.labels.some((l) => l.name === 'ai-working') });
    }
    const look = () => {
      const prs = pending.length ? gh('pr', 'list', '--state', 'open', '--json', 'number,headRefName,body', '--limit', '100') : [];
      let branches = [];
      try { branches = run('git', ['ls-remote', '--heads', 'origin']).split('\n').map((l) => l.split('refs/heads/')[1]).filter(Boolean); } catch { /* offline */ }
      return pending.map((p) => ({ n: p.n, title: p.title, ...(inFlight(p.n, prs, branches) || { branch: null, pr: null }) }));
    };
    let unmet = look();
    // Waiting only makes sense for a dependency that is on its way: started
    // alongside this one, or already claimed by a run.
    const coming = (u) => !u.branch && (batch.includes(u.n) || pending.find((p) => p.n === u.n)?.busy);
    const until = Date.now() + wait * 1000;
    while (unmet.some(coming) && Date.now() < until) {
      execFileSync('sleep', ['10']);
      unmet = look();
    }
    console.log(JSON.stringify({ depends, unmet, stackOn: stackFor(unmet) }));
  } catch (e) {
    console.log(JSON.stringify({ error: String(e.stderr || e.message).split('\n')[0].slice(0, 200) }));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
