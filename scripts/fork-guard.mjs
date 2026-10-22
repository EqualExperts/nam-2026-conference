#!/usr/bin/env node
/**
 * Keep workshop tickets and pull requests on the attendee's own fork.
 *
 *   node scripts/fork-guard.mjs          # exit 1 if this checkout would write to the workshop repo
 *   node scripts/fork-guard.mjs --hook   # PreToolUse hook: exit 2 blocks the tool call
 *
 * Every attendee forks EqualExperts/nam-2026-conference and files tickets on
 * the fork. A clone of the original instead of the fork — or a fork clone whose
 * `gh` was never pinned, so it falls through to the `upstream` remote — would
 * open every attendee's issues and pull requests on the shared repo. The hook
 * in .claude/settings.json runs this before any tool call that creates one;
 * the workshop's maintainers (maintain or admin on the repo) are let through.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const WORKSHOP_REPO = 'EqualExperts/nam-2026-conference';

const CREATE_CMD = /\bgh\s+(?:issue|pr)\s+create\b/;
// `gh api … repos/<o>/<r>/issues` or `/pulls`, written with fields or an explicit POST
const API_CREATE = /\bgh\s+api\b(?=.*\/(?:issues|pulls)\b)(?=.*(?:-X\s*POST|--method[=\s]+POST|\s-[fF]\s|--field|--raw-field|--input))/;
const MCP_CREATE = /github.*(?:create_issue|issue_write|create_pull_request|create_pr\b)/i;

/** The `owner/repo` a creating tool call names outright, if any; `undefined` if it does not create. */
export function creates({ toolName = '', command = '', toolInput = {} }) {
  if (toolName === 'Bash') {
    if (!CREATE_CMD.test(command) && !API_CREATE.test(command)) return undefined;
    const flag = /(?:^|\s)(?:-R|--repo)[=\s]+["']?([\w.-]+\/[\w.-]+)/.exec(command);
    const path = /\brepos\/([\w.-]+\/[\w.-]+)\/(?:issues|pulls)\b/.exec(command);
    return flag?.[1] ?? path?.[1] ?? null;
  }
  if (toolName.startsWith('mcp__') && MCP_CREATE.test(toolName)) {
    return toolInput.owner && toolInput.repo ? `${toolInput.owner}/${toolInput.repo}` : null;
  }
  return undefined;
}

/** Block only a write to the workshop repo by someone who cannot maintain it. */
export function verdict(target, canMaintain) {
  if (!target || target.toLowerCase() !== WORKSHOP_REPO.toLowerCase() || canMaintain) return { ok: true };
  return {
    ok: false,
    message:
      `Blocked: this would create an issue or pull request on ${WORKSHOP_REPO}, the workshop's original repo. ` +
      `Your tickets and pull requests belong on your own fork. Work in a clone of your fork ` +
      `(gh repo fork ${WORKSHOP_REPO} --clone), and pin gh to it there: ` +
      `gh repo set-default "$(git remote get-url origin)". Setup steps: ONBOARD_CLAUDE.md.`,
  };
}

const run = (cmd, args) => {
  try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return ''; }
};
const slug = (url) => /github\.com[:/]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(url)?.[1] ?? null;

/** Where `gh` sends a call with no `-R`: the pinned default, else upstream before origin, as gh does. */
function defaultTarget() {
  const pinned = run('gh', ['repo', 'set-default', '--view']);
  if (/^[\w.-]+\/[\w.-]+$/.test(pinned)) return pinned;
  return slug(run('git', ['remote', 'get-url', 'upstream'])) ?? slug(run('git', ['remote', 'get-url', 'origin']));
}

const maintains = (repo) => run('gh', ['api', `repos/${repo}`, '--jq', '.permissions.maintain or .permissions.admin']) === 'true';

function main() {
  // A runner works on the repository it belongs to; forks get no secrets, so
  // a stranger's run never gets this far (see the workflows' `if`).
  if (process.env.GITHUB_ACTIONS) return 0;
  const hook = process.argv.includes('--hook');
  let target;
  if (hook) {
    let input = {};
    try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return 0; }
    const named = creates({ toolName: input.tool_name, command: input.tool_input?.command, toolInput: input.tool_input });
    if (named === undefined) return 0;
    target = named ?? defaultTarget();
  } else {
    target = defaultTarget();
  }
  const v = verdict(target, target?.toLowerCase() === WORKSHOP_REPO.toLowerCase() && maintains(target));
  if (v.ok) return 0;
  process.stderr.write(`${v.message}\n`);
  return hook ? 2 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main();
