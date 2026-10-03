import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  readPreview, readStream, render, prLine, follow, finish, makeGh,
} from '../../scripts/ship-progress.mjs';

/**
 * Recorded shapes from a real `claude -p --output-format stream-json
 * --verbose` run of a saved workflow (see the spec's *Decisions*):
 * `system/task_started`, the cumulative `system/task_progress` (every phase
 * up front, every agent tried so far), and `system/task_notification` at the
 * end, whose `output_file` holds the workflow's return value.
 *
 * None of this drives a model or a browser — every check here is a pure
 * function over recorded/synthesised lines, or a stubbed `gh`.
 */
const PHASES = ['Setup', 'Spec', 'Spec Audit', 'Implement', 'Verify', 'Code Audit', 'Context', 'Learn', 'PR'];
const phaseEvents = PHASES.map((title, index) => ({ type: 'workflow_phase', index, title }));
const agentEvent = (label, phaseTitle, state, resultPreview) => ({ type: 'workflow_agent', label, phaseTitle, state, resultPreview });
const progress = (agents) => JSON.stringify({ type: 'system', subtype: 'task_progress', workflow_progress: [...phaseEvents, ...agents] });
const started = (timestamp) => JSON.stringify({ type: 'system', subtype: 'task_started', task_type: 'local_workflow', timestamp });
const notification = (status, output_file) => JSON.stringify({ type: 'system', subtype: 'task_notification', status, output_file });

const setupPreview = (branch = 'issue-53-ship-progress-comment', size = 'small') =>
  JSON.stringify({ proceed: true, reason: 'ok', title: 'Show ship’s progress', slug: 'ship-progress-comment', branch, workdir: '/w', runner: true, doneWhen: ['a'], size });
const specPreview = (path = 'specs/53-ship-progress-comment.md') => JSON.stringify({ path, summary: 's' });
const gateResult = (over = {}) => ({
  ok: true, sha: 'abc1234def', dirty: false, unit: { passed: 262, failed: 0 },
  browser: { passed: 161, failed: [], flaky: 0, skipped: 0 }, tampered: [], ...over,
});
// The verify agent's resultPreview, built exactly the way the CLI builds it —
// so a red round's is truncated for the same reason a real one would be.
const gatePreview = (result) => JSON.stringify({ json: JSON.stringify(result) }).slice(0, 400);
const GREEN = gatePreview(gateResult());
const RED = gatePreview({
  ok: false, sha: 'def5678abc', dirty: false,
  unit: { passed: 260, failed: 2, output: Array.from({ length: 12 }, (_, i) => `fail line ${i} details here padding padding`).join('\n') },
  browser: { passed: 0, failed: [{ test: '[chromium] tests/e2e/x.spec.js:10 › thing', error: Array.from({ length: 6 }, (_, i) => `err line ${i} padding padding`).join('\n') }], flaky: 0, skipped: 0 },
  tampered: [],
});

// A run cut off inside Code Audit: Setup..Implement done, round 1 gated
// green with two clean audits, and a second round's audit already under way
// — so Code Audit itself is "running", not "done". No task_notification: as
// far as the transcript says, nobody knows yet whether this run ever ends.
const MID_RUN = [
  started('2026-01-01T10:00:00.000Z'),
  progress([
    agentEvent('setup', 'Setup', 'done', setupPreview()),
    agentEvent('write-spec', 'Spec', 'done', specPreview()),
    agentEvent('spec-audit:combined#1', 'Spec Audit', 'done'),
    agentEvent('implement', 'Implement', 'done'),
    agentEvent('verify#1', 'Verify', 'done', GREEN),
    agentEvent('audit:combined#1', 'Code Audit', 'done'),
    agentEvent('audit:browser#1', 'Code Audit', 'done'),
    agentEvent('audit:combined#2', 'Code Audit', 'start'),
  ]),
];

const NOW = Date.parse('2026-01-01T10:12:00.000Z'); // 12 minutes after MID_RUN's task_started
const OPTS = { issue: 53, runUrl: 'https://github.com/x/y/actions/runs/999', runId: '999', repo: 'x/y', now: NOW, started: Date.parse('2026-01-01T10:04:00.000Z') };

describe('readPreview', () => {
  test('lifts what a truncated preview still carries, never JSON.parse', () => {
    assert.deepEqual(readPreview(GREEN), { ok: true, unit: { passed: 262, failed: 0 }, browserPassed: 161 });
    assert.deepEqual(readPreview(RED), { ok: false, unit: { passed: 260, failed: 2 } });
  });

  test('prose, or a preview truncated before "ok", reports nothing rather than guessing', () => {
    assert.deepEqual(readPreview('Ran the gate; looks fine to me.'), {});
    assert.deepEqual(readPreview('{"jso'), {});
  });
});

describe('readStream', () => {
  test('a phase is done when it has agents and none is running; untouched phases are not started', () => {
    const s = readStream(MID_RUN);
    const byTitle = Object.fromEntries(s.phases.map((p) => [p.title, p]));
    for (const t of ['Setup', 'Spec', 'Spec Audit', 'Implement', 'Verify']) assert.equal(byTitle[t].status, 'done');
    assert.equal(byTitle['Code Audit'].status, 'running');
    assert.equal(byTitle['Code Audit'].done, 2);
    assert.equal(byTitle['Code Audit'].total, 3);
    for (const t of ['Context', 'Learn', 'PR']) assert.equal(byTitle[t].status, 'not-started');
  });

  test('the tier and branch come from the setup agent, the spec path from write-spec', () => {
    const s = readStream(MID_RUN);
    assert.equal(s.tier, 'small');
    assert.equal(s.branch, 'issue-53-ship-progress-comment');
    assert.equal(s.spec, 'specs/53-ship-progress-comment.md');
  });

  test('empty or malformed lines never throw, and report nothing to show', () => {
    for (const lines of [[], ['', 'not json', '{"type":"assistant"}']]) {
      const s = readStream(lines);
      assert.deepEqual(s.phases, []);
      assert.equal(s.ended, false);
    }
  });

  test('a task_progress with no agents yet, or a malformed workflow_progress, has no agent finished anywhere', () => {
    for (const lines of [[progress([])], [JSON.stringify({ type: 'system', subtype: 'task_progress', workflow_progress: null })]]) {
      const s = readStream(lines);
      assert.ok(s.phases.every((p) => p.status === 'not-started'));
      assert.equal(s.ended, false);
    }
  });

  test('a task_notification ends the stream and its output file holds the outcome', () => {
    const s = readStream([...MID_RUN, notification('completed', '/out.json')], (f) => {
      assert.equal(f, '/out.json');
      return { result: { outcome: 'shipped', pr: 'https://github.com/x/y/pull/9' } };
    });
    assert.equal(s.ended, true);
    assert.equal(s.outcome.outcome, 'shipped');
  });

  test('a notification whose status is not "completed" ends the stream with no outcome', () => {
    const s = readStream([...MID_RUN, notification('failed', '/out.json')]);
    assert.equal(s.ended, true);
    assert.equal(s.outcome, null);
  });

  // An agent's long shell command is backgrounded, and its notification lands
  // in the same stream — on #100 and #101 that read as the end of the run.
  test('a backgrounded shell command finishing does not end the workflow', () => {
    const wf = JSON.stringify({ type: 'system', subtype: 'task_started', task_type: 'local_workflow', task_id: 'wf1', timestamp: '2026-10-02T19:22:40Z' });
    const bash = JSON.stringify({ type: 'system', subtype: 'task_notification', task_id: 'sh1', status: 'completed', output_file: '/sh.out' });
    const s = readStream([wf, ...MID_RUN, bash], () => assert.fail('a shell task has no outcome to read'));
    assert.equal(s.ended, false);
    const done = JSON.stringify({ type: 'system', subtype: 'task_notification', task_id: 'wf1', status: 'completed', output_file: '/out.json' });
    const t = readStream([wf, ...MID_RUN, bash, done], () => ({ result: { outcome: 'shipped', pr: 'u' } }));
    assert.equal(t.ended, true);
    assert.equal(t.outcome.outcome, 'shipped');
  });
});

describe('render', () => {
  test('within about a minute of the follower taking over, a render already has the tier placeholder, 0m and the run link', () => {
    const body = render(readStream([]), { ...OPTS, started: NOW - 5000 });
    assert.match(body, /sizing…/);
    assert.match(body, /0m elapsed/);
    assert.match(body, /\[Run\]\(https:\/\/github\.com\/x\/y\/actions\/runs\/999\)/);
  });

  test('elapsed time comes from the caller’s started, never from the stream’s own task_started', () => {
    const stream = readStream([started('2026-01-01T10:11:00.000Z')]); // claims the run began a minute before NOW
    const body = render(stream, { ...OPTS, started: NOW - 5 * 60000 }); // the caller says five minutes
    assert.match(body, /5m elapsed/);
    assert.doesNotMatch(body, /\b1m elapsed/);
  });

  test('names the tier once the setup agent has reported it, and prints "sizing…" until then', () => {
    const before = render(readStream([progress([agentEvent('setup', 'Setup', 'start')])]), OPTS);
    assert.match(before, /sizing…/);
    const after = render(readStream(MID_RUN), OPTS);
    assert.match(after, /🚢 Ship · small ·/);
  });

  test('a running phase shows how many of its agents have finished', () => {
    const body = render(readStream(MID_RUN), OPTS);
    assert.match(body, /\| Code Audit \| running — 2 of 3 agents finished \|/);
    assert.match(body, /\| Context \| — \|/);
    assert.match(body, /\| Learn \| — \|/);
    assert.match(body, /\| PR \| — \|/);
  });

  test('the spec is linked once pushed, on the branch the setup agent reported', () => {
    const body = render(readStream(MID_RUN), OPTS);
    assert.match(body, /\| Spec \| done — \[specs\/53-ship-progress-comment\.md\]\(.*blob\/issue-53-ship-progress-comment\/specs\/53-ship-progress-comment\.md\) \|/);
  });

  test('with no branch known yet, the spec prints as a bare path', () => {
    const lines = [progress([
      agentEvent('setup', 'Setup', 'start'),
      agentEvent('write-spec', 'Spec', 'done', specPreview()),
    ])];
    const body = render(readStream(lines), OPTS);
    assert.match(body, /\| Spec \| done — specs\/53-ship-progress-comment\.md \|/);
  });

  test('each finished build round shows its gate and audit result', () => {
    const lines = [progress([
      agentEvent('verify#1', 'Verify', 'done', GREEN),
      agentEvent('audit:combined#1', 'Code Audit', 'done'),
      agentEvent('audit:browser#1', 'Code Audit', 'done'),
      agentEvent('verify#2', 'Verify', 'done', RED),
      agentEvent('audit:combined#2', 'Code Audit', 'done'),
      agentEvent('fix#2', 'Code Audit', 'done'),
    ])];
    const body = render(readStream(lines), OPTS);
    assert.match(body, /Round 1 — gate green \(unit 262 passed · browser 161 passed\) · 2 audits · clean/);
    assert.match(body, /Round 2 — gate red \(unit 260 passed, 2 failed\) · 1 audit · fix ran/);
    assert.doesNotMatch(body, /not known/);
  });

  test('a round whose gate preview cannot be read yet says so, not a guess', () => {
    const lines = [progress([agentEvent('verify#1', 'Verify', 'done', 'Ran the gate; all green as far as I can tell.')])];
    const body = render(readStream(lines), OPTS);
    assert.match(body, /Round 1 — gate not known yet/);
  });

  test('an empty stream renders a comment saying the run has not reported yet — no throw', () => {
    for (const lines of [[], ['', 'not json', '{"type":"assistant"}']]) {
      const body = render(readStream(lines), OPTS);
      assert.match(body, /has not reported/);
    }
  });

  test('the final state says Shipped, with the pull request link', () => {
    const state = { phases: [], rounds: [], ended: true, outcome: { outcome: 'shipped', pr: 'https://github.com/x/y/pull/9' } };
    const body = render(state, OPTS);
    assert.match(body, /\*\*Shipped\*\*/);
    assert.match(body, /https:\/\/github\.com\/x\/y\/pull\/9/);
    assert.doesNotMatch(body, /running/i);
  });

  test('the final state says Handed back, with the stage and the reason', () => {
    const state = { phases: [], rounds: [], ended: true, outcome: { outcome: 'needs-human', stage: 'Code Audit', reason: 'the fixer died' } };
    const body = render(state, OPTS);
    assert.match(body, /Handed back at Code Audit — the fixer died/);
    assert.doesNotMatch(body, /running/i);
  });

  test('a notification that reports failure, or a stream that just stops, both say the run died', () => {
    const failed = { phases: [], rounds: [], ended: true, outcome: null };
    const stopped = { phases: [], rounds: [], ended: true, outcome: null, diedReason: 'the step timed out or was cancelled' };
    for (const state of [failed, stopped]) {
      const body = render(state, OPTS);
      assert.match(body, /The run died/);
      assert.match(body, /\[Run\]\(https:\/\/github\.com\/x\/y\/actions\/runs\/999\)/);
      assert.doesNotMatch(body, /running/i);
    }
    assert.match(render(stopped, OPTS), /the step timed out or was cancelled/);
  });
});

describe('prLine', () => {
  test('mid-run it names what is running, with elapsed time', () => {
    assert.equal(prLine(readStream([]), { kind: 'review', now: NOW, started: NOW - 3 * 60000 }), 'Reviewing… · 3m');
    assert.equal(prLine(readStream([]), { kind: 'qa', now: NOW, started: NOW - 3 * 60000 }), 'Running QA… · 3m');
  });

  test('once the workflow reports, it prints the verdict line instead', () => {
    const s = readStream([notification('completed', '/out.json')], () => ({ result: { verdictLine: 'PASS high 4/4 probes ran as planned' } }));
    assert.equal(prLine(s, { kind: 'qa', now: NOW, started: NOW - 600000 }), 'PASS high 4/4 probes ran as planned');
  });
});

describe('follow()', () => {
  const chunkedEnv = (extra = {}) => ({ SHIP_PROGRESS_ISSUE: '53', SHIP_PROGRESS_RUN: 'https://github.com/x/y/actions/runs/999', GH_REPO: 'x/y', ...extra });
  const chunks = (calls) => {
    let i = 0;
    return async () => calls[i++] ?? null;
  };

  test('edited in place: three chunks, three patches on the same id, never a create', async () => {
    const calls = [];
    const gh = {
      create: async () => { calls.push('create'); return 'nope'; },
      patch: async (id, body) => calls.push(`patch:${id}`),
      findByMarker: async () => { calls.push('find'); return null; },
    };
    await follow({
      env: chunkedEnv({ SHIP_PROGRESS_COMMENT_ID: '555' }),
      gh,
      readChunk: chunks([
        [progress([agentEvent('setup', 'Setup', 'start')])],
        [progress([agentEvent('setup', 'Setup', 'done', setupPreview())])],
        [notification('completed', '/out.json')],
      ]),
      readOutputFile: () => ({ result: { outcome: 'shipped', pr: 'https://github.com/x/y/pull/9' } }),
      sleep: async () => {},
      now: () => NOW,
    });
    assert.deepEqual(calls, ['patch:555', 'patch:555', 'patch:555']);
  });

  test('with no comment id, it searches by marker, creates once, then patches what it got back', async () => {
    const calls = [];
    const gh = {
      create: async () => { calls.push('create'); return 'new1'; },
      patch: async (id) => calls.push(`patch:${id}`),
      findByMarker: async () => { calls.push('find'); return null; },
    };
    await follow({
      env: chunkedEnv(),
      gh,
      readChunk: chunks([
        [progress([agentEvent('setup', 'Setup', 'start')])],
        [progress([agentEvent('setup', 'Setup', 'done', setupPreview())])],
        [notification('completed', '/out.json')],
      ]),
      readOutputFile: () => ({ result: { outcome: 'shipped', pr: 'https://github.com/x/y/pull/9' } }),
      sleep: async () => {},
      now: () => NOW,
    });
    assert.deepEqual(calls, ['find', 'create', 'patch:new1', 'patch:new1']);
  });

  test('SHIP_PROGRESS_STARTED in the environment reaches render(), not the stream’s own task_started', async () => {
    let seen = null;
    const gh = { patch: async () => {}, create: async () => 'x', findByMarker: async () => null };
    await follow({
      env: chunkedEnv({ SHIP_PROGRESS_COMMENT_ID: '1', SHIP_PROGRESS_STARTED: '2026-01-01T10:07:00.000Z' }), // five minutes before NOW
      gh: { ...gh, patch: async (id, body) => { seen = body; } },
      readChunk: chunks([[started('2026-01-01T10:11:00.000Z')], [notification('completed', '/out.json')]]), // the stream claims one minute
      readOutputFile: () => ({ result: { outcome: 'shipped', pr: 'https://x/9' } }),
      sleep: async () => {},
      now: () => NOW,
    });
    assert.match(seen, /5m elapsed/);
  });

  test('a gh stub that throws on every call never throws the run, and the whole stream is still consumed', async () => {
    let readChunkCalls = 0;
    const chunkList = [[progress([agentEvent('setup', 'Setup', 'start')])], [notification('completed', '/out.json')]];
    const boom = async () => { throw new Error('rate limited'); };
    await assert.doesNotReject(follow({
      env: chunkedEnv({ SHIP_PROGRESS_COMMENT_ID: '1' }),
      gh: { create: boom, patch: boom, findByMarker: boom },
      readChunk: async () => { readChunkCalls++; return chunkList.shift() ?? null; },
      readOutputFile: () => { throw new Error('gone'); },
      sleep: async () => {},
      now: () => NOW,
    }));
    assert.equal(readChunkCalls, 2);
  });

  test('with neither SHIP_PROGRESS_ISSUE nor SHIP_PROGRESS_PR set, it does nothing — a laptop run', async () => {
    let called = false;
    await follow({ env: {}, readChunk: async () => { called = true; return null; } });
    assert.equal(called, false);
  });
});

describe('finish()', () => {
  const env = (extra = {}) => ({
    SHIP_PROGRESS_ISSUE: '53', SHIP_PROGRESS_RUN: 'https://github.com/x/y/actions/runs/999', GH_REPO: 'x/y',
    SHIP_PROGRESS_STARTED: '2026-01-01T10:02:00.000Z', ...extra,
  });
  const readAll = (lines) => async () => lines;

  test('a killed step: patches the comment once, says the run died, with the tier, the phases it reached, and elapsed from the injected started — never "running"', async () => {
    let patched = null;
    const gh = { patch: async (id, body) => { patched = { id, body }; }, create: async () => 'nope', findByMarker: async () => null, read: async () => 'stale' };
    await finish({ env: env({ SHIP_PROGRESS_COMMENT_ID: '555' }), gh, readAll: readAll(MID_RUN), now: () => NOW });
    assert.equal(patched.id, '555');
    assert.match(patched.body, /The run died\*\* — the step timed out or was cancelled/);
    assert.match(patched.body, /\[Run\]\(https:\/\/github\.com\/x\/y\/actions\/runs\/999\)/);
    assert.match(patched.body, /🚢 Ship · small ·/);
    assert.match(patched.body, /10m elapsed/); // NOW is 10:12, started 10:02
    assert.match(patched.body, /\| Setup \| done \|/);
    assert.doesNotMatch(patched.body, /running/i);
  });

  test('with no comment id, it patches whatever the marker search finds, and creates nothing', async () => {
    const calls = [];
    const gh = { patch: async (id) => calls.push(`patch:${id}`), create: async () => calls.push('create'), findByMarker: async () => 'found1' };
    await finish({ env: env(), gh, readAll: readAll(MID_RUN), now: () => NOW });
    assert.deepEqual(calls, ['patch:found1']);
  });

  test('with no comment id and nothing found by marker, it creates', async () => {
    const calls = [];
    const gh = { patch: async (id) => calls.push(`patch:${id}`), create: async () => { calls.push('create'); return 'x'; }, findByMarker: async () => null };
    await finish({ env: env(), gh, readAll: readAll(MID_RUN), now: () => NOW });
    assert.deepEqual(calls, ['create']);
  });

  test('a complete, already-correct comment is left untouched', async () => {
    const commentId = '555';
    const shippedLines = [...MID_RUN, notification('completed', '/out.json')];
    const readOutputFile = () => ({ result: { outcome: 'shipped', pr: 'https://github.com/x/y/pull/9' } });
    const already = render({ ...readStream(shippedLines, readOutputFile), ended: true, diedReason: null },
      { issue: 53, runUrl: 'https://github.com/x/y/actions/runs/999', runId: '999', repo: 'x/y', now: NOW, started: Date.parse(env().SHIP_PROGRESS_STARTED) });
    let patchCalled = false, createCalled = false;
    const gh = { read: async () => already, patch: async () => { patchCalled = true; }, create: async () => { createCalled = true; }, findByMarker: async () => commentId };
    await finish({ env: env({ SHIP_PROGRESS_COMMENT_ID: commentId }), gh, readAll: readAll(shippedLines), readOutputFile, now: () => NOW });
    assert.equal(patchCalled, false);
    assert.equal(createCalled, false);
  });

  test('review/QA: a killed step says the review did not finish, not "The run died"', async () => {
    let patched = null;
    const gh = { patch: async (id, body) => { patched = body; }, create: async () => 'x', findByMarker: async () => 'r1' };
    await finish({ env: { SHIP_PROGRESS_PR: '9', SHIP_PROGRESS_KIND: 'review', SHIP_PROGRESS_RUN: 'https://github.com/x/y/actions/runs/1', GH_REPO: 'x/y' }, gh, readAll: readAll([]), now: () => NOW });
    assert.match(patched, /Review did not finish/);
  });

  test('review/QA: once the verdict is in, the progress line is removed, not turned into a copy of it (#94)', async () => {
    let removed = null, patched = false;
    const gh = { remove: async (id) => { removed = id; }, patch: async () => { patched = true; }, create: async () => 'x', findByMarker: async () => 'q1' };
    const lines = [notification('completed', '/out.json')];
    const readOutputFile = () => ({ result: { verdictLine: 'PASS high 3/3 probes ran as planned' } });
    await finish({ env: { SHIP_PROGRESS_PR: '9', SHIP_PROGRESS_KIND: 'qa', SHIP_PROGRESS_RUN: 'https://github.com/x/y/actions/runs/1', GH_REPO: 'x/y' }, gh, readAll: readAll(lines), readOutputFile, now: () => NOW });
    assert.equal(removed, 'q1');
    assert.equal(patched, false);
  });

  test('makeGh removes a comment with a DELETE', async () => {
    const calls = [];
    const gh = makeGh({ GH_REPO: 'o/r', SHIP_PROGRESS_PR: '7' }, (args) => { calls.push(args); return ''; });
    await gh.remove('55');
    assert.deepEqual(calls[0], ['api', 'repos/o/r/issues/comments/55', '-X', 'DELETE']);
  });

  test('with neither SHIP_PROGRESS_ISSUE nor SHIP_PROGRESS_PR set, it does nothing', async () => {
    let called = false;
    await finish({ env: {}, readAll: async () => { called = true; return []; } });
    assert.equal(called, false);
  });
});

describe('never a model call', () => {
  const src = readFileSync(new URL('../../scripts/ship-progress.mjs', import.meta.url), 'utf8');

  test('the script spawns no `claude` and imports nothing from the Agent SDK', () => {
    assert.doesNotMatch(src, /@anthropic-ai\/claude-agent-sdk/);
    assert.doesNotMatch(src, /['"`]claude['"`]/);
    assert.doesNotMatch(src, /spawnSync?\(\s*['"`]claude/);
  });

  test('every gh call it makes is wrapped, so a failure here cannot fail or slow the run', () => {
    assert.match(src, /catch/);
  });
});

describe('agent-run.sh starts and reaps the follower without joining the CLI’s pipe', () => {
  const src = readFileSync(new URL('../../scripts/agent-run.sh', import.meta.url), 'utf8');

  test('the follower is backgrounded, guarded by SHIP_PROGRESS_ISSUE or SHIP_PROGRESS_PR, and reaped with || true', () => {
    assert.match(src, /ship-progress\.mjs["']?\s+follow/);
    assert.match(src, /SHIP_PROGRESS_ISSUE|SHIP_PROGRESS_PR/);
    assert.match(src, /&\s*$/m);
    assert.match(src, /wait.*\|\|\s*true|kill.*\|\|\s*true/);
  });

  test('the CLI’s stdout still goes to the transcript file, never into the follower’s pipe', () => {
    assert.doesNotMatch(src, /claude[^\n]*\|\s*node/);
    assert.match(src, /> "\$out"/);
  });
});

describe('the workflows actually call it, with an environment', () => {
  const steps = (yaml) => yaml.split(/\n(?=      - name:|      - uses:)/);
  const ship = readFileSync(new URL('../../.github/workflows/agent-ship.yml', import.meta.url), 'utf8');
  const review = readFileSync(new URL('../../.github/workflows/agent-code-review.yml', import.meta.url), 'utf8');
  const qa = readFileSync(new URL('../../.github/workflows/agent-qa.yml', import.meta.url), 'utf8');

  test('the pre-checkout step exists, precedes checkout, and wraps its gh calls', () => {
    const s = steps(ship);
    const checkoutIdx = s.findIndex((x) => x.includes('actions/checkout@v7'));
    const postIdx = s.findIndex((x) => x.includes('Post the starting comment'));
    assert.ok(postIdx >= 0 && postIdx < checkoutIdx, 'the starting-comment step must precede checkout');
    const post = s[postIdx];
    assert.match(post, /actions\/runs\//);
    assert.match(post, /issues\/\$N\/comments/);
    assert.match(post, /ship-progress run=/);
    assert.match(post, /SHIP_PROGRESS_STARTED/);
    assert.match(post, /SHIP_PROGRESS_COMMENT_ID/);
    assert.match(post, /GITHUB_ENV/);
    // Nothing in it can fail the step or hold up checkout: every `gh api`
    // call this step makes is a guarded assignment, and the script's own
    // last line cannot itself be a bare test that can come out false.
    const ghCalls = post.match(/^\s*\w+=\$\(gh api.*$/gm) || [];
    assert.ok(ghCalls.length >= 2, 'expected at least two gh api calls');
    for (const line of ghCalls) assert.match(line, /\)\s*\|\|\s*true\s*$/, line);
    const scriptLines = (/run:\s*\|\n([\s\S]*)/.exec(post) || [])[1]?.split('\n').map((l) => l.trim()).filter(Boolean) || [];
    assert.equal(scriptLines.at(-1), 'true', 'the step’s last line must not itself be a fallible test');
  });

  test('the Run /ship step’s own env carries what the follower needs to start at all', () => {
    const s = steps(ship);
    const run = s.find((x) => /^\s*- name: .*Run \/ship\s*$/m.test(x));
    assert.match(run, /SHIP_PROGRESS_ISSUE/);
    assert.match(run, /SHIP_PROGRESS_RUN/);
    assert.match(run, /GH_REPO/);
  });

  for (const [name, yaml, envNames] of [
    ['ship', ship, ['GH_TOKEN', 'GH_REPO', 'SHIP_PROGRESS_RUN', 'SHIP_PROGRESS_ISSUE']],
    ['code review', review, ['GH_TOKEN', 'GH_REPO', 'SHIP_PROGRESS_PR', 'SHIP_PROGRESS_KIND', 'SHIP_PROGRESS_RUN']],
    ['qa', qa, ['GH_TOKEN', 'GH_REPO', 'SHIP_PROGRESS_PR', 'SHIP_PROGRESS_KIND', 'SHIP_PROGRESS_RUN']],
  ]) {
    test(`${name}: the finish step is always(), continue-on-error, and carries its own env`, () => {
      const s = steps(yaml);
      const fin = s.find((x) => x.includes('ship-progress.mjs finish'));
      assert.ok(fin, `${name} has no step calling ship-progress.mjs finish`);
      // always() — only QA's "too small to need it" skip, which starts no run
      // and so has no progress comment to settle, may narrow it.
      assert.match(fin, /if:\s*\$\{\{\s*always\(\)(\s*&&\s*steps\.facts\.outputs\.trivial != 'true')?\s*\}\}/);
      assert.match(fin, /continue-on-error:\s*true/);
      for (const n of envNames) assert.match(fin, new RegExp(n), `${name}'s finish step should name ${n}`);
    });
  }

  test('code review and QA get SHIP_PROGRESS_PR/KIND/RUN and GH_REPO on their Run step, not just the finish step', () => {
    for (const [name, yaml, kind] of [['code review', review, 'review'], ['qa', qa, 'qa']]) {
      const s = steps(yaml);
      const run = s.find((x) => /^\s*- name: .*Run \/(code-review|qa)\s*$/m.test(x));
      assert.match(run, /SHIP_PROGRESS_PR/, name);
      assert.match(run, new RegExp(`SHIP_PROGRESS_KIND:\\s*${kind}`), name);
      assert.match(run, /SHIP_PROGRESS_RUN/, name);
      assert.match(run, /GH_REPO/, name);
    }
  });
});

describe('makeGh', () => {
  // `-f body=@-` is a raw string: every progress comment read "@-".
  test('sends the body from stdin as a field gh reads, not the literal "@-"', async () => {
    const calls = [];
    const gh = makeGh({ GH_REPO: 'o/r', SHIP_PROGRESS_PR: '7' }, (args, input) => { calls.push({ args, input }); return '42\n'; });
    assert.equal(await gh.create('hello'), '42');
    await gh.patch('42', 'again');
    for (const { args, input } of calls) {
      const i = args.indexOf('body=@-');
      assert.equal(args[i - 1], '-F', `${args.join(' ')} must pass the body with -F`);
      assert.ok(input);
    }
    assert.match(calls[0].args[1], /repos\/o\/r\/issues\/7\/comments/);
  });
});

describe('sized from what runs, now that setup reports facts', () => {
  test('the first agent past setup says the size by its model; before it, sizing', () => {
    const setup = { ...agentEvent('setup', 'Setup', 'done', '{"proceed":true,"branch":"issue-7-x"}'), model: 'claude-opus-5' };
    const on = (label, phase, model) => ({ ...agentEvent(label, phase, 'running'), model });
    assert.equal(readStream([progress([setup])]).tier, null);
    assert.equal(readStream([progress([setup, on('spec-audit:criteria#1', 'Spec Audit', 'claude-opus-5')])]).tier, 'full');
    assert.equal(readStream([progress([setup, on('implement', 'Implement', 'claude-sonnet-5-5')])]).tier, 'small');
    // a small run may audit its plan, on Sonnet — still small
    assert.equal(readStream([progress([setup, on('spec-audit:combined#1', 'Spec Audit', 'claude-sonnet-5-5')])]).tier, 'small');
  });

  test("a small ticket's spec comes from setup, linked by its repository path, not the runner's (#100)", () => {
    const setup = agentEvent('setup', 'Setup', 'done', '{"proceed":true,"branch":"issue-7-x","spec":{"path":"/home/runner/work/r/r/specs/7-x.md"}}');
    const s = readStream([progress([setup, agentEvent('implement', 'Implement', 'running')])]);
    assert.equal(s.spec, '/home/runner/work/r/r/specs/7-x.md');
    const body = render({ ...s, ended: false }, { issue: 7, runUrl: 'https://github.com/o/r/actions/runs/1', runId: '1', repo: 'o/r', now: 0, started: 0 });
    assert.match(body, /\[specs\/7-x\.md\]\(https:\/\/github\.com\/o\/r\/blob\/issue-7-x\/specs\/7-x\.md\)/);
    assert.doesNotMatch(body, /home\/runner/);
  });
});
