#!/usr/bin/env node
/**
 * Bring a fork's main up to date with the repository it was forked from.
 *
 *   node scripts/sync-fork.mjs     # one line saying what it did; always exits 0
 *
 * A workshop fork is made once and then lives for days, while the workshop
 * repo keeps changing — its harness above all. A ship run works from the
 * fork's own `origin/main`, so a fork two commits behind ran without the
 * latest hand-off rules and nobody could tell. Ship's setup and the
 * onboarding (when it reuses a fork) run this first.
 *
 * It uses GitHub's own "Sync fork" (`POST /repos/{fork}/merge-upstream`): a
 * fast-forward, or a merge commit when the attendee has merged their own pull
 * requests into the fork's main. It never force-pushes or resets — on a
 * conflict it says so, changes nothing, and the run carries on with the fork
 * as it is. Not a fork (the workshop repo itself), or in CI: it does nothing.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** A git remote URL → `owner/name`, or null. */
export function repoOf(url) {
  const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(String(url || '').trim());
  return m ? `${m[1]}/${m[2]}` : null;
}

/** What GitHub said → the one line to print. */
export function describe({ fork, parent, branch = 'main', result = null, error = null }) {
  if (!parent) return `sync-fork: ${fork || 'this checkout'} is not a fork — nothing to sync`;
  if (error) {
    const conflict = /409|conflict/i.test(error);
    return `sync-fork: ${fork} NOT synced with ${parent} — ${conflict
      ? `its ${branch} has changes that conflict with ${parent}'s`
      : error.split('\n')[0].slice(0, 160)}; carrying on with the fork as it is. Sync it on GitHub (the fork's page → Sync fork) to get the latest.`;
  }
  const how = result && result.merge_type;
  if (how === 'none') return `sync-fork: ${fork} ${branch} already up to date with ${parent}`;
  return `sync-fork: ${fork} ${branch} brought up to date with ${parent}${how ? ` (${how})` : ''}`;
}

function main() {
  if (process.env.GITHUB_ACTIONS) { console.log('sync-fork: in CI — not synced (the job checks out what it was given)'); return; }
  const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let fork = null;
  try { fork = repoOf(run('git', ['remote', 'get-url', 'origin'])); } catch { /* no origin */ }
  if (!fork) { console.log('sync-fork: no GitHub origin — nothing to sync'); return; }
  let parent = null, branch = 'main';
  try {
    const info = JSON.parse(run('gh', ['api', `repos/${fork}`, '--jq', '{parent: .parent.full_name, branch: .parent.default_branch}']));
    parent = info.parent || null;
    branch = info.branch || 'main';
  } catch (e) {
    console.log(`sync-fork: could not read ${fork} on GitHub — not synced (${String(e.stderr || e.message).split('\n')[0].slice(0, 120)})`);
    return;
  }
  if (!parent) { console.log(describe({ fork, parent })); return; }
  let result = null, error = null;
  try { result = JSON.parse(run('gh', ['api', '-X', 'POST', `repos/${fork}/merge-upstream`, '-f', `branch=${branch}`])); }
  catch (e) { error = String(e.stderr || e.message); }
  console.log(describe({ fork, parent, branch, result, error }));
  // So origin/main here is what GitHub now has.
  if (!error) { try { run('git', ['fetch', '-q', 'origin', branch]); } catch { /* the next fetch will */ } }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.log(`sync-fork: not synced — ${String(e.message).split('\n')[0]}`); }
}
