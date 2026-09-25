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
const GREEN = { green: true, unit: '164 passed', browser: '158 passed', failures: [] };
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
  const agent = async (prompt, opts) => {
    calls.push(opts.label);
    const [name, n] = opts.label.split('#');
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
  return { result, calls };
}

describe('ship', () => {
  test('a clean ticket runs every phase once and ships', async () => {
    const { result, calls } = await run();
    assert.equal(result.outcome, 'shipped');
    assert.equal(result.pr, 'https://github.com/o/r/pull/9');
    assert.deepEqual(result.rounds, [{ round: 1, gate: '164 passed · 158 passed', raised: 0, confirmed: 0 }]);
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
    const order = ['verify#1', 'fix#1', 'verify#2', 'audit:rules#2', 'open-pr'].map(l => calls.indexOf(l));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    // It was caught, so the lesson is written down.
    assert.ok(calls.includes('learn'));
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
      verify: (n) => (n === 1 ? { ...GREEN, green: false, failures: [{ test: 'home.spec.js', error: 'x' }] } : GREEN),
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
      'audit:rules': (n) => ({ covered: 'all', findings: [blocker(`a new problem number ${n}`)] }),
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
});
