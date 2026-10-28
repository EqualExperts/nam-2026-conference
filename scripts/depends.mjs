#!/usr/bin/env node
/**
 * Is everything a ticket depends on done?
 *
 *   node scripts/depends.mjs <issue>    # one JSON line: { depends: [n…], unmet: [{ n, title, state }…] }
 *
 * create-tasks writes a dependency as a `**Depends on:** #1 …` line. Ship used
 * to leave it to the setup agent to notice: one run of a dependent ticket
 * caught it and stopped, an earlier one started building anyway on a main
 * that did not have its dependency. This reads the line and asks GitHub, so
 * setup can stop before it claims the ticket. A dependency is done when its
 * issue is closed as completed — what merging its pull request (Closes #n)
 * does. Always one line, always exit 0: a lookup that fails is reported, not thrown.
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

function main() {
  const n = process.argv[2];
  const gh = (...a) => JSON.parse(execFileSync('gh', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  try {
    const depends = dependsOn(gh('issue', 'view', n, '--json', 'body').body);
    const unmet = [];
    for (const d of depends) {
      const i = gh('issue', 'view', String(d), '--json', 'number,title,state,stateReason');
      if (!isDone(i)) unmet.push({ n: i.number, title: i.title, state: i.state });
    }
    console.log(JSON.stringify({ depends, unmet }));
  } catch (e) {
    console.log(JSON.stringify({ error: String(e.stderr || e.message).split('\n')[0].slice(0, 200) }));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
