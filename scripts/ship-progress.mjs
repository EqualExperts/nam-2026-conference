/**
 * Show ship's progress on the issue it is building, and code review/QA's on
 * the pull request, while they run — by reading the stream `claude -p
 * --output-format stream-json --verbose` already prints. No model call: this
 * is a script reading text, composing markdown, and calling `gh`.
 *
 *   node scripts/ship-progress.mjs follow    # tails the transcript while the CLI runs
 *   node scripts/ship-progress.mjs finish    # one-shot, after the CLI is gone
 *
 * `follow` and `finish` both read `SHIP_PROGRESS_*` from the environment —
 * `agent-ship.yml`'s pre-checkout step sets `SHIP_PROGRESS_STARTED` (the
 * run's own start, never the CLI's) and `SHIP_PROGRESS_COMMENT_ID` before
 * either ever runs, so both know where to write and how old the run really
 * is without asking the stream. See docs/context/harness.md.
 *
 * Every function below is pure except the two entry points, which take their
 * IO (the `gh` calls, the transcript read, the clock) as parameters — that is
 * what lets the whole thing be unit-tested against recorded stream events,
 * with no network and no CLI.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Reading the stream ───────────────────────────────────────────────────────

/**
 * A `resultPreview` is capped at 400 characters, and the one that matters —
 * the verify agent's gate line — arrives cut mid-string on a red round, so
 * this never `JSON.parse`s. It unescapes `\"` (the preview is itself a
 * JSON-stringified value) and lifts whatever fields are present by regex.
 * Nothing found renders as nothing known — never a guess.
 */
export function readPreview(text) {
  const t = String(text || '').replace(/\\"/g, '"');
  const out = {};
  let m;
  if ((m = /"size"\s*:\s*"(small|full)"/.exec(t))) out.size = m[1];
  if ((m = /"branch"\s*:\s*"([^"]*)"/.exec(t))) out.branch = m[1];
  if ((m = /"path"\s*:\s*"([^"]*)"/.exec(t))) out.path = m[1];
  if ((m = /"ok"\s*:\s*(true|false)/.exec(t))) out.ok = m[1] === 'true';
  if ((m = /"unit"\s*:\s*\{\s*"passed"\s*:\s*(\d+)\s*,\s*"failed"\s*:\s*(\d+)/.exec(t)))
    out.unit = { passed: Number(m[1]), failed: Number(m[2]) };
  if ((m = /"browser"\s*:\s*\{\s*"passed"\s*:\s*(\d+)/.exec(t))) out.browserPassed = Number(m[1]);
  if ((m = /"test"\s*:\s*"([^"]*)"/.exec(t))) out.firstFailTest = m[1];
  return out;
}

const roundOf = (label) => { const m = /#(\d+)/.exec(label || ''); return m ? Number(m[1]) : null; };

const defaultReadOutputFile = (f) => JSON.parse(readFileSync(f, 'utf8'));

/**
 * Reduce a transcript (one JSON-per-line, as `claude -p` prints it) to
 * everything render() needs. `workflow_progress`, on `system/task_progress`,
 * is cumulative — every phase and every agent tried so far — so only the
 * last such event matters; this never needs to replay the whole stream.
 */
// Setup runs on the session model too, so it says nothing; the first agent
// past setup does — every one of them runs on the run's own model.
function tierFrom(agents) {
  const past = agents.find((a) => /^(write-spec|spec-audit|implement)/.test(a.label || '') && a.model);
  if (!past) return null;
  return /sonnet|haiku/i.test(past.model) ? 'small' : 'full';
}

export function readStream(lines, readOutputFile = defaultReadOutputFile) {
  const events = (lines || [])
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((e) => e && typeof e === 'object');

  let streamStarted = null;
  let lastProgress = null;
  let notification = null;
  let workflowTask = null;
  for (const e of events) {
    if (e.type !== 'system') continue;
    if (e.subtype === 'task_started' && e.task_type === 'local_workflow') {
      streamStarted = e.timestamp || streamStarted;
      workflowTask = e.task_id || workflowTask;
    }
    else if (e.subtype === 'task_progress' && Array.isArray(e.workflow_progress)) lastProgress = e.workflow_progress;
    // Only the workflow's own notification ends the run. An agent's shell
    // command that runs long is backgrounded and posts a task_notification
    // into the same stream; taking that for the end called every live run
    // dead a minute in (#100, #101).
    else if (e.subtype === 'task_notification' && (!workflowTask || !e.task_id || e.task_id === workflowTask)) notification = e;
  }

  const progress = lastProgress || [];
  const phaseTitles = progress
    .filter((p) => p && p.type === 'workflow_phase')
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((p) => p.title);
  const agents = progress.filter((p) => p && p.type === 'workflow_agent');

  // A phase is done when it has agents and none of them is running — never by
  // assuming phases only move forward. Ship revisits Verify and Code Audit
  // every round, and hands back into Learn, so ordering proves nothing.
  const phases = phaseTitles.map((title) => {
    const as = agents.filter((a) => a.phaseTitle === title);
    const done = as.filter((a) => a.state === 'done' || a.state === 'error').length;
    const running = as.some((a) => a.state === 'start' || a.state === 'progress');
    const status = as.length === 0 ? 'not-started' : running ? 'running' : 'done';
    return { title, status, done, total: as.length };
  });

  const lastDoneByLabel = (label) => [...agents].reverse().find((a) => a.label === label && a.state === 'done');
  const setupAgent = lastDoneByLabel('setup');
  const setupPreview = setupAgent ? readPreview(setupAgent.resultPreview) : {};
  const specAgent = lastDoneByLabel('write-spec');
  const specPreview = specAgent ? readPreview(specAgent.resultPreview) : {};

  const roundNums = new Set();
  for (const a of agents) { const n = roundOf(a.label); if (n) roundNums.add(n); }
  const rounds = [...roundNums].sort((a, b) => a - b)
    .map((n) => {
      const verify = lastDoneByLabel(`verify#${n}`);
      if (!verify) return null;
      const gate = readPreview(verify.resultPreview);
      const audits = agents.filter((a) => roundOf(a.label) === n && /^(audit|skeptic):/.test(a.label)).length;
      const fixRan = agents.some((a) => roundOf(a.label) === n && /^fix(-retry)?#/.test(a.label));
      return { n, gate, audits, fixRan };
    })
    .filter(Boolean);

  let ended = false;
  let outcome = null;
  if (notification) {
    ended = true;
    if (notification.status === 'completed' && notification.output_file) {
      let out = null;
      try { out = readOutputFile(notification.output_file); } catch { /* gone: nothing to report */ }
      outcome = out?.result ?? null;
    }
  }

  return {
    streamStarted,
    // The script composes the run from setup's facts, so the size is read off
    // what runs: the full loop builds on the session model (Opus), a small one
    // on Sonnet — a small run may still audit its plan. Until the builder or a
    // plan auditor starts, it is "sizing…".
    tier: setupPreview.size || tierFrom(agents),
    branch: setupPreview.branch || null,
    // A small ticket's spec is written by setup, a full one's by write-spec.
    spec: specPreview.path || (specAgent ? null : setupPreview.path) || null,
    phases,
    rounds,
    ended,
    outcome,
  };
}

// ── Rendering ────────────────────────────────────────────────────────────────

function gateLine(g) {
  if (!g || typeof g.ok !== 'boolean') return 'gate not known yet';
  if (g.ok) {
    const bits = [g.unit ? `unit ${g.unit.passed} passed` : null, g.browserPassed != null ? `browser ${g.browserPassed} passed` : null].filter(Boolean);
    return `gate green (${bits.join(' · ')})`;
  }
  const bit = g.unit ? `unit ${g.unit.passed} passed, ${g.unit.failed} failed` : 'failed';
  return `gate red (${bit})`;
}

function specLink(path, branch, repo) {
  if (!path) return '';
  // Agents report the spec's absolute path on the runner; the link wants the
  // repository path (#100 showed /home/runner/work/…/specs/100-….md).
  const at = path.lastIndexOf('specs/');
  if (at > 0) path = path.slice(at);
  if (!branch) return path;
  const base = repo ? `https://github.com/${repo}` : '';
  return `[${path}](${base}/blob/${branch}/${path})`;
}

const minutesBetween = (now, started) => Math.max(0, Math.floor(((now ?? Date.now()) - (started ?? now ?? Date.now())) / 60000));

/**
 * The comment body, in full. A pure function of the state readStream()
 * derived (or that follow()/finish() built on top of it) and the handful of
 * things only the caller knows — the run link, the elapsed clock, the repo.
 * `started` is always a parameter, never read off the stream: the elapsed
 * time has to reflect the run's own age, and only the caller (the
 * pre-checkout step, via `$GITHUB_ENV`) knows that.
 */
export function render(state, { issue, runUrl, runId, repo, now, started } = {}) {
  const elapsed = minutesBetween(now, started);
  const runLink = `[Run](${runUrl || ''})`;
  const lines = [`🚢 Ship · ${state.tier || 'sizing…'} · ${elapsed}m elapsed · ${runLink}`, ''];

  if (!state.phases || state.phases.length === 0) {
    lines.push('Claude Code has not reported progress yet.', '');
  } else {
    lines.push('| Phase | |', '| --- | --- |');
    for (const p of state.phases) {
      let cell;
      // A small ticket's spec is written by setup, so its Spec phase has no
      // agent of its own — the spec existing is what makes the row done.
      if (p.title === 'Spec' && state.spec) cell = `done — ${specLink(state.spec, state.branch, repo)}`;
      else if (p.status === 'not-started') cell = '—';
      else if (p.status === 'done') cell = p.title === 'Spec' && state.spec ? `done — ${specLink(state.spec, state.branch, repo)}` : 'done';
      else cell = `${state.ended ? 'interrupted' : 'running'} — ${p.done} of ${p.total} agents finished`;
      lines.push(`| ${p.title} | ${cell} |`);
    }
    lines.push('');
  }

  for (const r of state.rounds || []) {
    lines.push(`Round ${r.n} — ${gateLine(r.gate)} · ${r.audits} audit${r.audits === 1 ? '' : 's'} · ${r.fixRan ? 'fix ran' : 'clean'}`);
  }
  if (state.rounds && state.rounds.length) lines.push('');

  if (state.ended) {
    const o = state.outcome;
    if (o && o.outcome === 'shipped') lines.push(`**Shipped** — [pull request](${o.pr})`);
    else if (o && o.outcome === 'needs-human') lines.push(`**Handed back at ${o.stage} — ${o.reason}**`);
    else lines.push(`**The run died**${state.diedReason ? ` — ${state.diedReason}` : ''}. ${runLink}`);
    lines.push('');
  }

  lines.push(`<!-- ship-progress run=${runId || ''} -->`);
  return lines.join('\n');
}

/**
 * The one-line PR status while code review or QA run — replaced by the
 * verdict the moment the workflow's task_notification carries one. `started`
 * here is always the stream's own `task_started`: neither job has a "within
 * about a minute" criterion, so there is no pre-checkout post to measure from.
 */
export function prLine(state, { kind = 'review', now, started } = {}) {
  if (state.ended && state.outcome && typeof state.outcome.verdictLine === 'string') return state.outcome.verdictLine;
  const label = kind === 'qa' ? 'Running QA…' : 'Reviewing…';
  return `${label} · ${minutesBetween(now, started)}m`;
}

// ── A signature of what would change on screen, for the ~20s throttle ───────
function signature(state) {
  return JSON.stringify({
    tier: state.tier,
    phases: (state.phases || []).map((p) => `${p.title}:${p.status}:${p.done}/${p.total}`),
    rounds: (state.rounds || []).map((r) => `${r.n}:${r.gate?.ok}:${r.audits}:${r.fixRan}`),
    ended: state.ended,
    outcome: state.outcome && (state.outcome.outcome || state.outcome.verdictLine),
  });
}

// ── Talking to GitHub — every call wrapped, nothing here can fail the run ───

const runIdFrom = (env) => (String(env.SHIP_PROGRESS_RUN || '').match(/runs\/(\d+)/) || [])[1] || env.GITHUB_RUN_ID || '';

function ghApi(args, input) {
  return execFileSync('gh', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

/**
 * The real `gh` calls. Tests inject a stub instead — see the spec.
 * The body goes in with `-F body=@-`: `-f` is a raw string, so `-f body=@-`
 * posted the two characters "@-" as every progress comment.
 */
export function makeGh(env, run = ghApi) {
  const repo = env.GH_REPO;
  const issue = env.SHIP_PROGRESS_ISSUE || env.SHIP_PROGRESS_PR;
  return {
    async create(body) {
      return run(['api', `repos/${repo}/issues/${issue}/comments`, '-F', 'body=@-', '--jq', '.id'], body).trim();
    },
    async patch(id, body) {
      run(['api', `repos/${repo}/issues/comments/${id}`, '-X', 'PATCH', '-F', 'body=@-'], body);
    },
    async remove(id) {
      run(['api', `repos/${repo}/issues/comments/${id}`, '-X', 'DELETE']);
    },
    async read(id) {
      return run(['api', `repos/${repo}/issues/comments/${id}`, '--jq', '.body']);
    },
    async findByMarker(runId) {
      const out = run(['api', `repos/${repo}/issues/${issue}/comments`, '--paginate', '--jq',
        `.[] | select(.body | contains("ship-progress run=${runId}")) | .id`]);
      const ids = out.split('\n').map((s) => s.trim()).filter(Boolean);
      return ids.at(-1) || null;
    },
  };
}

/**
 * ship gets the full phase table; code review and QA get one line, replaced
 * by the verdict when it lands — `SHIP_PROGRESS_KIND` (`review` | `qa`) is
 * what tells the two apart, since both callers share this file.
 */
function bodyFor(env, state, opts) {
  const runLink = `[Run](${opts.runUrl || ''})`;
  const kind = env.SHIP_PROGRESS_KIND;
  if (!kind) return render(state, opts);
  const label = kind === 'qa' ? 'QA' : 'Review';
  const line = state.ended && !(state.outcome && typeof state.outcome.verdictLine === 'string')
    ? `${label} did not finish. ${runLink}`
    : prLine(state, { kind, now: opts.now, started: opts.started });
  return `${line}\n\n<!-- ship-progress run=${opts.runId || ''} -->`;
}

async function publish(gh, commentId, runId, body) {
  try {
    if (commentId) { await gh.patch(commentId, body); return commentId; }
    const found = await gh.findByMarker(runId);
    if (found) { await gh.patch(found, body); return found; }
    return await gh.create(body);
  } catch {
    // A rate limit, a network blip or a malformed reply must never touch the
    // run this comment is reporting on.
    return commentId;
  }
}

/**
 * Tails the transcript for as long as the CLI is streaming, editing one
 * comment (found by id, never by searching, once the pre-checkout step has
 * handed one down) in place. Exits on its own once the stream ends; if the
 * step that ran it is killed first, `finish()` — in its own step, outside
 * the killed process tree — settles the comment instead.
 */
export async function follow({
  env = process.env,
  gh,
  readChunk,
  readOutputFile,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => Date.now(),
  interval = 20000,
} = {}) {
  if (!env.SHIP_PROGRESS_ISSUE && !env.SHIP_PROGRESS_PR) return;
  gh = gh || makeGh(env);
  const runId = runIdFrom(env);
  const started = env.SHIP_PROGRESS_STARTED ? Date.parse(env.SHIP_PROGRESS_STARTED) : null;
  const opts = (t, startedAt) => ({ issue: env.SHIP_PROGRESS_ISSUE, runUrl: env.SHIP_PROGRESS_RUN, runId, repo: env.GH_REPO, now: t, started: startedAt });

  let commentId = env.SHIP_PROGRESS_COMMENT_ID || null;
  // The stream's task_started carries no timestamp, and only ship passes
  // SHIP_PROGRESS_STARTED — so code review and QA counted from "now" on
  // every tick and read "0m" for their whole run. The follower starts with
  // the CLI, so its own start is the run's.
  const followedFrom = now();
  const lines = [];
  let lastSig = null;
  let lastAt = -Infinity;

  for (;;) {
    let chunk = [];
    try { chunk = (await readChunk()) || []; } catch { chunk = []; }
    lines.push(...chunk);

    let state;
    try { state = readStream(lines, readOutputFile); } catch { state = readStream([]); }
    const t = now();
    const startedAt = started ?? (state.streamStarted ? Date.parse(state.streamStarted) : followedFrom);

    let body = null;
    try { body = bodyFor(env, state, opts(t, startedAt)); } catch { body = null; }

    if (body != null) {
      const sig = signature(state);
      if (sig !== lastSig || t - lastAt >= interval) {
        commentId = await publish(gh, commentId, runId, body);
        lastSig = sig;
        lastAt = t;
      }
    }

    if (state.ended) break;
    await sleep(interval);
  }
}

/**
 * The one-shot pass that runs after the CLI is gone — the commonest way a
 * ship run ends is its step hitting `timeout-minutes` or being cancelled,
 * which kills `follow()` mid-render along with everything else in the
 * process tree. This reads whatever transcript is left on disk once, decides
 * shipped / handed back / died from what is on it, and patches the comment —
 * idempotent, so a healthy run (where `follow()` already wrote the right
 * thing) costs one read and nothing else.
 */
export async function finish({
  env = process.env,
  gh,
  readAll,
  readOutputFile,
  now = () => Date.now(),
} = {}) {
  const issue = env.SHIP_PROGRESS_ISSUE || env.SHIP_PROGRESS_PR;
  if (!issue) return;
  gh = gh || makeGh(env);
  const runId = runIdFrom(env);
  const started = env.SHIP_PROGRESS_STARTED ? Date.parse(env.SHIP_PROGRESS_STARTED) : null;

  let lines = [];
  try { lines = (await readAll()) || []; } catch { lines = []; }
  let state;
  try { state = readStream(lines, readOutputFile); } catch { state = readStream([]); }

  const t = now();
  const startedAt = started ?? (state.streamStarted ? Date.parse(state.streamStarted) : t);
  const shipOutcome = state.outcome && ['shipped', 'needs-human'].includes(state.outcome.outcome);
  const verdictKnown = state.outcome && typeof state.outcome.verdictLine === 'string';
  const settled = env.SHIP_PROGRESS_KIND ? verdictKnown : state.ended && shipOutcome;
  const diedReason = settled ? null : 'the step timed out or was cancelled';
  const final = { ...state, ended: true, diedReason };

  // A review or QA that reached its verdict posts that verdict as its own
  // comment straight after this step; the progress line, rewritten into a copy
  // of it, only repeated it (#94). Remove it. One that did not finish keeps its
  // line, which says so — the only place that is said.
  if (env.SHIP_PROGRESS_KIND && settled && gh.remove) {
    try {
      const id = env.SHIP_PROGRESS_COMMENT_ID || (await gh.findByMarker(runId));
      if (id) await gh.remove(id);
    } catch { /* a stray progress line is untidy, not wrong */ }
    return;
  }

  let body;
  try { body = bodyFor(env, final, { issue, runUrl: env.SHIP_PROGRESS_RUN, runId, repo: env.GH_REPO, now: t, started: startedAt }); }
  catch { return; }

  try {
    const commentId = env.SHIP_PROGRESS_COMMENT_ID || null;
    if (commentId && gh.read) {
      const current = await gh.read(commentId).catch(() => null);
      if (current === body) return;
    }
    await publish(gh, commentId, runId, body);
  } catch { /* nothing settles the comment; the run itself is unaffected */ }
}

// ── CLI entry ────────────────────────────────────────────────────────────────
// Never lets a failure here slow or fail the run it is reporting on.
async function main() {
  const mode = process.argv[2];
  const runnerTemp = process.env.RUNNER_TEMP || '/tmp';
  const transcript = process.env.SHIP_PROGRESS_TRANSCRIPT || `${runnerTemp}/claude-run.jsonl`;
  let seen = 0;
  const readChunk = async () => {
    if (!existsSync(transcript)) return [];
    const text = readFileSync(transcript, 'utf8');
    const all = text.split('\n').filter(Boolean);
    const fresh = all.slice(seen);
    seen = all.length;
    return fresh;
  };
  const readAll = async () => {
    if (!existsSync(transcript)) return [];
    return readFileSync(transcript, 'utf8').split('\n').filter(Boolean);
  };
  if (mode === 'follow') await follow({ readChunk });
  else if (mode === 'finish') await finish({ readAll });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {}).finally(() => process.exit(0));
}
