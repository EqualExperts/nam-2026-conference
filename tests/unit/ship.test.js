import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The ship workflow's control flow, with every agent stubbed.
 *
 * The prompts are judgement; the loop is not. When does it stop, when does it
 * hand a ticket to a person, does a refuted finding cost a fix round — those
 * are rules, and a rule in a script nobody can run without spending an hour of
 * agent time is a rule nobody has checked. Here each agent is a function of
 * its label, so a whole run takes milliseconds.
 */

const source = readFileSync(new URL('../../.claude/workflows/ship.js', import.meta.url), 'utf8')
  .replace(/^export const meta/m, 'const meta');
const AsyncFunction = (async () => {}).constructor;
const script = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', source);

const SETUP = {
  proceed: true, reason: 'ok', title: 'Total hours', slug: 'hours', branch: 'issue-7-hours',
  workdir: '/w', runner: true, doneWhen: ['the agenda shows total hours'],
};
const gateResult = (over = {}) => ({
  ok: true, sha: 'abc1234def', dirty: false, unit: { passed: 178, failed: 0 },
  browser: { passed: 155, failed: [], flaky: 0, skipped: 1 }, tampered: [], ...over,
});
const GREEN = { json: JSON.stringify(gateResult()) };
const RED = (failed) => ({ json: JSON.stringify(gateResult({ ok: false, browser: { passed: 150, failed, flaky: 0, skipped: 1 } })) });
const blocker = (claim) => ({
  severity: 'blocker', category: 'logic', file: 'server/lib/agenda.js', line: 10, claim, evidence: 'e', fix: 'f',
});

/**
 * Run the workflow. `answers` maps a label prefix to a value, or to a function
 * of the round number (the `#n` suffix). Returns the result and every label
 * that ran, in order.
 */
async function run(answers = {}) {
  const calls = [];
  const prompts = {};
  const agent = async (prompt, opts) => {
    calls.push(opts.label);
    prompts[opts.label] = prompt;
    const [name, n] = opts.label.replace('-retry', '').split('#');
    const hit = Object.keys(answers).find(k => name === k || name.startsWith(k + ':'));
    if (hit) { const a = answers[hit]; return typeof a === 'function' ? a(Number(n), prompt) : a; }
    if (name === 'setup') return SETUP;
    if (name.startsWith('verify')) return GREEN;
    if (name.includes('audit')) return { covered: 'all', findings: [] };
    if (name.startsWith('skeptic')) return { refuted: false, why: 'real' };
    if (name === 'learn') return { lessons: [] };
    if (name === 'write-spec' || name.startsWith('revise-spec')) return { path: 'specs/7-hours.md', summary: 's' };
    if (name === 'open-pr') return { ok: true, summary: 'opened', url: 'https://github.com/o/r/pull/9' };
    return { ok: true, summary: 'done' };
  };
  const parallel = async (thunks) => Promise.all(thunks.map(t => t().catch(() => null)));
  const result = await script(7, agent, parallel, () => {}, () => {});
  return { result, calls, prompts };
}

describe('ship', () => {
  test('a clean ticket runs every phase once and ships', async () => {
    const { result, calls } = await run();
    assert.equal(result.outcome, 'shipped');
    assert.equal(result.pr, 'https://github.com/o/r/pull/9');
    assert.deepEqual(result.rounds, [{
      round: 1, gate: 'unit 178 passed · browser 155 passed', raised: 0, confirmed: 0, covered: 'all · all · all',
    }]);
    assert.ok(!calls.some(c => c.startsWith('fix') || c.startsWith('revise-spec') || c === 'hand-back'));
    // Nothing was caught, so there is nothing to learn and no agent is spent on it.
    assert.ok(!calls.includes('learn'));
  });

  test('an unbuildable ticket stops at setup and opens nothing', async () => {
    const { result, calls } = await run({ setup: { proceed: false, reason: 'no Done when' } });
    assert.deepEqual(result, { outcome: 'declined', issue: 7, reason: 'no Done when' });
    assert.deepEqual(calls, ['setup']);
  });

  test('a confirmed code finding is fixed, re-verified and re-audited before the PR', async () => {
    const { result, calls } = await run({
      'audit:rules': (n) => ({ covered: 'all', findings: n === 1 ? [blocker('off by one on the total')] : [] }),
    });
    assert.equal(result.outcome, 'shipped');
    assert.deepEqual(result.rounds.map(r => r.confirmed), [1, 0]);
    const order = ['verify#1', 'fix#1', 'verify#2', 'audit:rules#2', 'context', 'learn', 'open-pr'].map(l => calls.indexOf(l));
    assert.deepEqual([...order].sort((a, b) => a - b), order, 'learn lands before the PR opens, so it is reviewed');
  });

  test('a finding the skeptic refutes never costs a fix round', async () => {
    const { result, calls } = await run({
      'audit:criteria': { covered: 'all', findings: [blocker('imagined')] },
      skeptic: { refuted: true, why: 'the line does not say that' },
    });
    assert.equal(result.outcome, 'shipped');
    assert.ok(!calls.some(c => c.startsWith('fix')));
  });

  test('minor findings never loop', async () => {
    const { result } = await run({
      'audit:rules': { covered: 'all', findings: [{ ...blocker('naming'), severity: 'minor' }] },
    });
    assert.equal(result.outcome, 'shipped');
    assert.equal(result.rounds.length, 1);
  });

  test('a red gate goes straight to a fix, without auditing red code', async () => {
    const { result, calls } = await run({
      verify: (n) => (n === 1 ? RED([{ test: '[desktop] home.spec.js:4 › x', error: 'x' }]) : GREEN),
    });
    assert.equal(result.outcome, 'shipped');
    assert.ok(!calls.some(c => c.endsWith('#1') && c.startsWith('audit')));
    assert.ok(calls.includes('fix#1'));
  });

  test('the same finding surviving repeated fixes hands back early, as a draft', async () => {
    const { result, calls } = await run({
      'audit:rules': { covered: 'all', findings: [blocker('total ignores waitlist places')] },
    });
    assert.equal(result.outcome, 'needs-human');
    assert.equal(result.stage, 'Code Audit');
    assert.match(result.reason, /same finding/);
    assert.equal(calls.filter(c => c.startsWith('verify')).length, 3);   // not all four rounds
    assert.ok(!calls.includes('open-pr'));
    assert.ok(calls.indexOf('learn') < calls.indexOf('hand-back'), 'learns before it pushes the draft');
  });

  test('different findings every round run out of rounds, then hand back', async () => {
    const { result, calls } = await run({
      'audit:rules': (n) => ({ covered: 'all', findings: [{ ...blocker(`a new problem number ${n}`), line: n * 100 }] }),
    });
    assert.equal(result.outcome, 'needs-human');
    assert.match(result.reason, /after 4 rounds/);
    assert.equal(calls.filter(c => c.startsWith('fix')).length, 3);
  });

  test('a spec that will not converge stops before any code is written', async () => {
    const { result, calls } = await run({
      'spec-audit:fit': { covered: 'all', findings: [blocker('names a file that does not exist')] },
    });
    assert.equal(result.outcome, 'needs-human');
    assert.equal(result.stage, 'Spec Audit');
    assert.ok(!calls.includes('implement'));
    assert.equal(calls.filter(c => c.startsWith('revise-spec')).length, 2);
  });

  test('an auditor that dies is retried, and one that dies twice hands back rather than passing', async () => {
    const once = await run({ 'audit:rules': (n, p) => null });
    assert.equal(once.result.outcome, 'needs-human');
    assert.match(once.result.reason, /rules auditor could not finish/);
    assert.ok(once.calls.includes('audit:rules-retry#1'));
    assert.ok(!once.calls.includes('open-pr'));
  });

  test('a skeptic that dies refutes nothing — the finding still costs a fix', async () => {
    const { calls } = await run({
      'audit:rules': (n) => ({ covered: 'all', findings: n === 1 ? [blocker('off by one')] : [] }),
      skeptic: null,
    });
    assert.ok(calls.includes('fix#1'));
  });

  test('the skeptic judges in the branch, against the ticket and the spec', async () => {
    const { prompts } = await run({
      'audit:rules': (n) => ({ covered: 'all', findings: n === 1 ? [blocker('off by one')] : [] }),
    });
    const p = prompts['skeptic:logic'];
    assert.match(p, /Work in \/w on branch issue-7-hours/);
    assert.match(p, /the agenda shows total hours/);
    assert.match(p, /specs\/7-hours\.md/);
  });

  test('the same bug reworded every round is still recognised as stuck', async () => {
    const { result } = await run({
      'audit:rules': (n) => ({ covered: 'all', findings: [blocker(`wording number ${n} of one bug`)] }),
    });
    assert.match(result.reason, /same finding/);
  });

  test('one finding raised by two lenses in one round is judged and counted once', async () => {
    const same = { covered: 'all', findings: [blocker('total ignores waitlist places')] };
    const { calls, result } = await run({
      'audit:rules': (n) => (n === 1 ? same : { covered: 'all', findings: [] }),
      'audit:criteria': (n) => (n === 1 ? same : { covered: 'all', findings: [] }),
    });
    assert.equal(calls.filter(c => c.startsWith('skeptic')).length, 1);
    assert.equal(result.outcome, 'shipped');
  });

  test('one test failing on both viewports is two findings in one fix round, not an early stuck', async () => {
    const pair = [{ test: '[desktop] home.spec.js:4 › x', error: 'x' }, { test: '[mobile] home.spec.js:4 › x', error: 'x' }];
    const { result, calls, prompts } = await run({ verify: (n) => (n <= 2 ? RED(pair) : GREEN) });
    assert.equal(result.outcome, 'shipped');
    assert.equal(calls.filter(c => c.startsWith('fix')).length, 2);
    assert.match(prompts['fix#1'], /\[desktop\][\s\S]*\[mobile\]/);
  });

  test('two unmet criteria citing the same file with no line are both fixed', async () => {
    const unmet = (claim) => ({ ...blocker(claim), category: 'criterion-unmet', file: 'specs/7-hours.md', line: undefined });
    const { prompts } = await run({
      'audit:criteria': (n) => ({ covered: 'all', findings: n === 1 ? [unmet('no test for the waitlist case'), unmet('done count includes waitlist')] : [] }),
    });
    assert.match(prompts['fix#1'], /no test for the waitlist case/);
    assert.match(prompts['fix#1'], /done count includes waitlist/);
  });

  test('a gate run on uncommitted changes is not green', async () => {
    const { calls } = await run({ verify: (n) => (n === 1 ? { json: JSON.stringify(gateResult({ dirty: true })) } : GREEN) });
    assert.ok(calls.includes('fix#1'));
    assert.ok(!calls.includes('audit:rules#1'));
  });

  test('gate JSON missing a field hands back instead of crashing', async () => {
    const { result } = await run({ verify: { json: JSON.stringify({ ok: true, unit: {}, browser: {} }) } });
    assert.equal(result.outcome, 'needs-human');
  });

  test('a context agent that dies hands back rather than shipping', async () => {
    const { result, calls } = await run({ context: null });
    assert.equal(result.outcome, 'needs-human');
    assert.ok(!calls.includes('open-pr'));
  });

  test('a PR agent that fails learns once, not twice', async () => {
    const { calls } = await run({
      'audit:rules': (n) => ({ covered: 'all', findings: n === 1 ? [blocker('x')] : [] }),
      'open-pr': { ok: false, summary: 'no permission' },
    });
    assert.equal(calls.filter(c => c === 'learn').length, 1);
  });

  test('a red gate that names no failing test hands back instead of burning rounds', async () => {
    const { result, calls } = await run({ verify: RED([]) });
    assert.equal(result.outcome, 'needs-human');
    assert.equal(result.stage, 'Verify');
    assert.ok(!calls.some(c => c.startsWith('fix')));
  });

  test('gate output that is not the script\'s JSON is red, never green', async () => {
    const { result } = await run({ verify: { json: 'All tests passed! 🎉' } });
    assert.equal(result.outcome, 'needs-human');
  });

  test('weakened tests reach the criteria auditor', async () => {
    const tampered = ['tests/seats.spec.js: -    await expect(panel).toContainText(\'Waitlisted\');'];
    const { prompts } = await run({ verify: { json: JSON.stringify(gateResult({ tampered })) } });
    assert.match(prompts['audit:criteria#1'], /toContainText\('Waitlisted'\)/);
    assert.doesNotMatch(prompts['audit:rules#1'], /Waitlisted/);
  });

  test('setup without Done-when criteria hands the claimed ticket back', async () => {
    const { result, calls } = await run({ setup: { ...SETUP, doneWhen: [] } });
    assert.equal(result.outcome, 'needs-human');
    assert.equal(result.stage, 'Setup');
    assert.ok(calls.includes('hand-back'));
  });

  test('a setup agent that dies still releases the ticket', async () => {
    const { result, calls } = await run({ setup: null });
    assert.equal(result.outcome, 'needs-human');
    assert.ok(calls.includes('hand-back'));
  });

  test('the browser auditor runs after the readers, not beside them', async () => {
    const { calls } = await run();
    assert.ok(calls.indexOf('audit:browser#1') > calls.indexOf('audit:rules#1'));
    assert.ok(calls.indexOf('audit:browser#1') > calls.indexOf('audit:criteria#1'));
  });
});
