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
const script = new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', 'workflow', source);

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
async function run(answers = {}, args = 7) {
  const calls = [];
  const prompts = {};
  const models = {};
  const agent = async (prompt, opts) => {
    calls.push(opts.label);
    prompts[opts.label] = prompt;
    models[opts.label] = opts.model;
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
  const result = await script(args, agent, parallel, () => {}, () => {});
  return { result, calls, prompts, models };
}

describe('several tickets at once', () => {
  const parallel = async (ts) => Promise.all(ts.map(t => t().catch(() => null)));
  const agent = async () => { throw new Error('the batch itself runs no agent'); };

  test('`/ship 64 65 66` runs one whole ship per ticket, in parallel, with the notes and size passed on', async () => {
    const calls = [];
    const workflow = async (name, a) => { calls.push([name, a]); return { outcome: 'shipped', issue: a.issue }; };
    const result = await script('64, #65 and 66 keep it small --small', agent, parallel, () => {}, () => {}, workflow);
    assert.equal(result.outcome, 'batch');
    assert.deepEqual(calls.map(([n, a]) => [n, a.issue]), [['ship', 64], ['ship', 65], ['ship', 66]]);
    assert.equal(calls[0][1].notes, 'keep it small');
    assert.equal(calls[0][1].size, 'small');
    assert.deepEqual(result.runs.map(r => r.outcome), ['shipped', 'shipped', 'shipped']);
  });

  test('one ticket that dies does not stop the others', async () => {
    const workflow = async (name, a) => (a.issue === 65 ? null : { outcome: 'shipped', issue: a.issue });
    const result = await script('64 65', agent, parallel, () => {}, () => {}, workflow);
    assert.deepEqual(result.runs.map(r => r.outcome), ['shipped', 'error']);
  });

  test('a single number with notes that contain numbers is still one ticket', async () => {
    const { prompts } = await run({}, '7 the total should read 12 hours');
    assert.match(prompts['write-spec'] || prompts.setup, /the total should read 12 hours/);
  });
});

describe('ship-rote', () => {
  test('the rote steps ask for the lean agent type, and fall back to a plain agent where it is not loaded', async () => {
    const seen = [];
    const agent = async (prompt, opts) => {
      seen.push([opts.label, opts.agentType]);
      if (opts.agentType === 'ship-rote') throw new Error("agent({agentType}): agent type 'ship-rote' not found. Available agents: claude");
      if (opts.label === 'setup') return SETUP;
      if (opts.label.startsWith('verify')) return GREEN;
      if (opts.label.includes('audit')) return { covered: 'all', findings: [] };
      if (opts.label === 'write-spec') return { path: 'specs/7-hours.md', summary: 's' };
      if (opts.label === 'open-pr') return { ok: true, summary: 'ok', url: 'u' };
      return { ok: true, summary: 'done' };
    };
    const parallel = async (ts) => Promise.all(ts.map(t => t().catch(() => null)));
    const result = await script(7, agent, parallel, () => {}, () => {});
    assert.equal(result.outcome, 'shipped');
    assert.deepEqual(seen.filter(([l]) => l === 'verify#1' || l === 'open-pr'),
      [['verify#1', 'ship-rote'], ['verify#1', undefined], ['open-pr', 'ship-rote'], ['open-pr', undefined]]);
  });
});

describe('ship', () => {
  test('a clean ticket runs every phase once and ships', async () => {
    const { result, calls } = await run();
    assert.equal(result.outcome, 'shipped');
    assert.equal(result.pr, 'https://github.com/o/r/pull/9');
    assert.deepEqual(result.rounds, [{
      round: 1, gate: 'unit 178 passed · browser 155 passed', raised: 0, confirmed: 0,
      covered: 'ran nothing: all · ran nothing: all · ran nothing: all',
    }]);
    assert.ok(!calls.some(c => c.startsWith('fix') || c.startsWith('revise-spec') || c === 'hand-back'));
    // Nothing was caught, so there is nothing to learn and no agent is spent on it.
    assert.ok(!calls.includes('learn'));
  });

  test('an unshippable ticket stops at setup and opens nothing', async () => {
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
    const order = ['verify#1', 'fix#1', 'verify#2', 'audit:rules#2', 'learn', 'open-pr'].map(l => calls.indexOf(l));
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

  test('a spec whose ticket is in question after every round stops before any code is written', async () => {
    const { result, calls } = await run({
      'spec-audit:fit': { covered: 'all', findings: [{ ...blocker('the ticket asks for two contradictory outcomes'), category: 'scope' }] },
    });
    assert.equal(result.outcome, 'needs-human');
    assert.equal(result.stage, 'Spec Audit');
    assert.ok(!calls.includes('implement'));
    assert.equal(calls.filter(c => c.startsWith('revise-spec')).length, 2);
  });

  test('a technical spec problem still open after every round is decided and carried into the build — not handed back', async () => {
    const { result, calls, prompts } = await run({
      'spec-audit:fit': { covered: 'all', findings: [blocker('the gh call does not pin --repo')] },
    });
    assert.equal(result.outcome, 'shipped');
    assert.equal(calls.filter(c => c.startsWith('revise-spec')).length, 3);
    assert.match(prompts['revise-spec#3'], /yours to decide/);
    assert.match(prompts.implement, /the gh call does not pin --repo/);
    assert.match(prompts['audit:criteria#1'], /left these for the build to resolve/);
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

  test('the docs move with the code: the implementer and fixer keep them true, the auditor checks, no context agent', async () => {
    const { calls, prompts } = await run({
      'audit:rules': (n) => ({ covered: 'all', findings: n === 1 ? [blocker('x')] : [] }),
    });
    assert.ok(!calls.includes('context'));
    assert.match(prompts.implement, /node scripts\/context\.mjs for <changed files>/);
    assert.match(prompts['fix#1'], /docs\/context\/ doc/);
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

  test('a stacked ticket branches from, is judged against and targets its base', async () => {
    const calls = [], prompts = {};
    const agent = async (prompt, opts) => {
      calls.push(opts.label); prompts[opts.label] = prompt;
      if (opts.label === 'setup') return SETUP;
      if (opts.label.startsWith('verify')) return GREEN;
      if (opts.label.includes('audit')) return { covered: 'all', findings: [] };
      if (opts.label === 'write-spec') return { path: 'specs/7-hours.md', summary: 's' };
      if (opts.label === 'open-pr') return { ok: true, summary: 'ok', url: 'u' };
      return { ok: true, summary: 'done' };
    };
    const parallel = async (ts) => Promise.all(ts.map(t => t().catch(() => null)));
    const result = await script({ issue: 7, base: 'harness/ship-loop' }, agent, parallel, () => {}, () => {});
    assert.equal(result.outcome, 'shipped');
    assert.match(prompts.setup, /origin\/harness\/ship-loop/);
    assert.match(prompts['verify#1'], /GATE_BASE=origin\/harness\/ship-loop/);
    assert.match(prompts['audit:criteria#1'], /git diff origin\/harness\/ship-loop\.\.\.HEAD/);
    assert.match(prompts['open-pr'], /gh pr create --base harness\/ship-loop/);
    assert.doesNotMatch(Object.values(prompts).join('\n'), /origin\/main/);
  });

  test('a base with no harness is declined before anything is built', async () => {
    const { result, calls } = await run({ setup: { ...SETUP, proceed: false, harnessOnBase: false, reason: 'x' } });
    assert.equal(result.outcome, 'declined');
    assert.match(result.reason, /has no harness/);
    assert.deepEqual(calls, ['setup']);
  });

  test('a minor note the skeptic refutes never reaches the PR body', async () => {
    const note = { ...blocker('the card flashes Nothing booked while loading'), severity: 'minor' };
    const { prompts } = await run({
      'audit:rules': { covered: 'all', findings: [note] },
      skeptic: { refuted: true, why: 'the card is not rendered in that window' },
    });
    assert.doesNotMatch(prompts['open-pr'], /flashes Nothing booked/);
  });

  test('a minor note that survives the skeptic is offered to the reviewer', async () => {
    const note = { ...blocker('the done count wording is singular-unaware'), severity: 'minor' };
    const { prompts } = await run({ 'audit:rules': { covered: 'all', findings: [note] } });
    assert.match(prompts['open-pr'], /singular-unaware/);
  });

  test('the failing check is committed red before the fix, so history proves it', async () => {
    const { prompts } = await run();
    assert.match(prompts.implement, /commit it on its own, red/);
  });

  test('what an auditor covered is cut to a table cell', async () => {
    const long = 'I read the ticket, the spec and the full diff and checked every criterion against the code and the tests in detail';
    const { result } = await run({ 'audit:rules': { covered: long, findings: [] } });
    const cell = result.rounds[0].covered.split(' · ')[1];
    assert.match(cell, /^ran nothing: /, 'what was run survives the cut — it is a field, not prose');
    assert.ok(cell.replace('ran nothing: ', '').length <= 90, cell);
    assert.match(cell, /…$/);
  });

  test('a spec round that confirmed something is in the PR table, not just the build rounds', async () => {
    const { prompts } = await run({
      'spec-audit:fit': (n) => ({ covered: 'all', findings: n === 1 ? [blocker('the lane books into the slot lanes')] : [] }),
    });
    assert.match(prompts['open-pr'], /\| spec 1 \| — \| 1 raised · 1 confirmed \|/);
  });

  test('a flaky test is named to the criteria auditor', async () => {
    const g = gateResult({ browser: { passed: 155, failed: [], flaky: 1, flakyTests: ['[mobile] plan.spec.js:40 › one done'], skipped: 1 } });
    const { prompts } = await run({ verify: { json: JSON.stringify(g) } });
    assert.match(prompts['audit:criteria#1'], /plan\.spec\.js:40 › one done/);
  });

  test('on a laptop the PR agent releases the lane on its way out, and tells other agents not to', async () => {
    const { calls, prompts } = await run({ setup: { ...SETUP, runner: false } });
    assert.equal(calls.at(-1), 'open-pr');
    assert.match(prompts['open-pr'], /node scripts\/lane\.mjs release 7/);
    assert.doesNotMatch(prompts['open-pr'], /Never release the lane/, 'the PR agent is told both to release and not to');
    assert.match(prompts.implement, /Never release the lane/);
    assert.match(prompts.implement, /batch/);
  });

  test('the PR agent is handed the body, re-verifies nothing, and a change nobody sees opens on the rote model', async () => {
    const { prompts, models } = await run({ implement: { ok: true, summary: 'done', ui: false } });
    assert.match(prompts['open-pr'], /do not run tests/);
    assert.match(prompts['open-pr'], /### Audit loop/);
    assert.doesNotMatch(prompts['open-pr'], /following §8/);
    assert.match(prompts.implement, /shotForPR/);
    assert.equal(models['open-pr'], 'haiku');
  });

  test('a comment that asked for the run reaches the spec writer and the auditors as notes', async () => {
    const { result, prompts } = await run({}, '7 @claude I closed the first PR — do it again, and keep it to the card');
    assert.equal(result.outcome, 'shipped');
    assert.match(prompts['write-spec'], /The person who asked for this run wrote: "I closed the first PR — do it again, and keep it to the card"/);
    assert.match(prompts['audit:criteria#1'], /keep it to the card/);
    assert.doesNotMatch(prompts['write-spec'], /@claude/);
    assert.match(prompts.setup, /closed pull request from an earlier attempt is not a reason to stop/);
  });

  test('a bare issue number carries no notes', async () => {
    const { prompts } = await run({}, '7');
    assert.doesNotMatch(prompts['write-spec'], /asked for this run/);
  });

  test('text that names no issue is refused before any agent runs', async () => {
    const { result, calls } = await run({}, 'please build the waitlist thing');
    assert.equal(result.outcome, 'error');
    assert.deepEqual(calls, []);
  });

  describe('sized to the ticket', () => {
    const SMALL = { ...SETUP, size: 'small' };

    test('a small ticket gets no spec audit, one code auditor plus the browser, and Sonnet throughout', async () => {
      const { result, calls, models } = await run({ setup: SMALL, implement: { ok: true, summary: 's', ui: true } });
      assert.equal(result.outcome, 'shipped');
      assert.equal(result.size, 'small');
      assert.deepEqual(calls.filter(c => c.startsWith('spec-audit')), []);
      assert.deepEqual(calls.filter(c => c.startsWith('audit')), ['audit:combined#1', 'audit:browser#1']);
      for (const l of ['write-spec', 'implement', 'audit:combined#1']) assert.equal(models[l], 'sonnet', l);
      // Opening the PR is rote now — its body is given and its picture comes from the proving test.
      assert.equal(models['open-pr'], 'haiku');
    });

    test('a red gate does not spend a small ticket\'s audit budget', async () => {
      const { result, calls } = await run({
        setup: SMALL,
        verify: (n) => (n === 1 ? RED([{ test: '[mobile] plan.spec.js:40 › x', error: 'e' }]) : GREEN),
        'audit:combined': (n) => ({ covered: 'all', findings: n === 2 ? [blocker('the lane collides')] : [] }),
      });
      assert.equal(result.outcome, 'shipped');
      assert.deepEqual(calls.filter(c => c.startsWith('audit:combined')), ['audit:combined#2', 'audit:combined#3']);
    });

    test('a small ticket whose visible change already has a browser test leaves the browser to the gate and QA', async () => {
      const { calls } = await run({ setup: SMALL, implement: { ok: true, summary: 's', ui: true, browserTest: true } });
      assert.deepEqual(calls.filter(c => c.startsWith('audit')), ['audit:combined#1']);
    });

    test('a full ticket keeps its browser audit, told not to re-run the suite or release the lane', async () => {
      const { calls, prompts } = await run({ setup: { ...SETUP, runner: false }, implement: { ok: true, summary: 's', ui: true, browserTest: true } });
      assert.ok(calls.includes('audit:browser#1'));
      assert.match(prompts['audit:browser#1'], /do not run `npm test`/);
      assert.match(prompts['audit:browser#1'], /never release the lane/);
    });

    test('a small ticket with nothing visible changed skips the browser pass', async () => {
      const { calls } = await run({ setup: SMALL, implement: { ok: true, summary: 's', ui: false } });
      assert.ok(!calls.some(c => c.startsWith('audit:browser')));
    });

    test('a small ticket whose ticket is in question goes to a person from the code audit, not a fix round', async () => {
      const { result, calls } = await run({
        setup: SMALL,
        'audit:combined': { covered: 'all', ran: 'nothing', findings: [{ ...blocker('the ticket asks for two contradictory labels'), category: 'scope' }] },
      });
      assert.equal(result.outcome, 'needs-human');
      assert.equal(result.stage, 'Code Audit');
      assert.ok(!calls.some(c => c.startsWith('fix')));
    });

    test('a small ticket\'s spec is written by setup and checked by the code audit — two agents fewer', async () => {
      const { result, calls, prompts } = await run({ setup: { ...SMALL, spec: { path: 'specs/7-hours.md', summary: 's' } } });
      assert.equal(result.outcome, 'shipped');
      assert.ok(!calls.includes('write-spec'));
      assert.ok(!calls.some(c => c.startsWith('spec-audit')));
      assert.match(prompts.setup, /If you proceed and size it small, write the spec too/);
      assert.match(prompts['audit:combined#1'], /nobody else has checked that it reads the ticket/);
    });

    test('a small ticket hands back after two build rounds, not four', async () => {
      const { result } = await run({
        setup: SMALL,
        'audit:combined': (n) => ({ covered: 'all', ran: 'nothing', findings: [{ ...blocker(`problem ${n}`), line: n * 100 }] }),
      });
      assert.equal(result.outcome, 'needs-human');
      assert.match(result.reason, /after 2 rounds/);
    });

    test('--full overrides a small sizing', async () => {
      const { result, calls, models } = await run({ setup: SMALL }, '7 --full');
      assert.equal(result.size, 'full');
      assert.ok(calls.includes('spec-audit:criteria#1') && calls.includes('spec-audit:fit#1'));
      assert.equal(models.implement, undefined, 'full inherits the session model');
    });

    test('--small overrides a full sizing, and the flag is not taken as notes', async () => {
      const { result, prompts } = await run({}, '7 --small');
      assert.equal(result.size, 'small');
      assert.doesNotMatch(prompts['write-spec'], /asked for this run/);
    });

    test('on a small ticket, weakened and flaky tests reach the combined auditor', async () => {
      const g = gateResult({
        tampered: ['tests/seats.spec.js: -    await expect(seat).toHaveText("Taken")'],
        browser: { passed: 155, failed: [], flaky: 1, flakyTests: ['[mobile] tests/a.spec.js:3 › t'], skipped: 1 },
      });
      const { prompts } = await run({ setup: SMALL, verify: { json: JSON.stringify(g) } });
      assert.match(prompts['audit:combined#1'], /toHaveText\("Taken"\)/);
      assert.match(prompts['audit:combined#1'], /tests\/a\.spec\.js:3/);
    });

    test('running a command and copying its output uses the cheapest model in every tier', async () => {
      for (const setup of [SMALL, SETUP]) {
        const { models } = await run({ setup });
        assert.equal(models['verify#1'], 'haiku');
      }
    });
  });

  describe('the red check', () => {
    // The verify agent runs red-check after a green gate and relays both lines.
    const red = (v) => ({ ...GREEN, red: JSON.stringify(v) });

    test('tests that pass without the change become a finding and cost a fix round', async () => {
      const { calls, prompts } = await run({
        verify: (n) => red(n === 1
          ? { checked: true, failedOnBase: false, tests: ['tests/unit/format.test.js'], reverted: ['src/components/SeatPanel.jsx'] }
          : { checked: true, failedOnBase: true, tests: [], reverted: [] }),
      });
      assert.ok(calls.includes('fix#1'));
      assert.match(prompts['fix#1'], /pass with its app code reverted/);
      assert.match(prompts['skeptic:test-proves-nothing'], /SeatPanel\.jsx/);
    });

    test('a skeptic can clear it — a refactor is meant to pass either way', async () => {
      const { calls } = await run({
        verify: red({ checked: true, failedOnBase: false, tests: ['tests/unit/a.test.js'], reverted: ['src/a.js'] }),
        skeptic: { refuted: true, why: 'pure refactor; the ticket asked for no behaviour change' },
      });
      assert.ok(!calls.some(c => c.startsWith('fix')));
    });

    test('nothing to check, or unreadable or partial output, raises nothing and does not crash', async () => {
      for (const v of [red({ checked: false, reason: 'no tests changed' }), { ...GREEN, red: 'oops' }, GREEN,
        red({ checked: true, failedOnBase: false }), red({ checked: true, failedOnBase: false, tests: 'x', reverted: [] })]) {
        const { calls } = await run({ verify: v });
        assert.ok(!calls.some(c => c.startsWith('fix')));
      }
    });

    test('the verify agent runs it after a green gate, on the cheapest model, with no agent of its own', async () => {
      const { calls, models, prompts } = await run();
      assert.equal(models['verify#1'], 'haiku');
      assert.match(prompts['verify#1'], /only if that line contains "ok":true, then run `GATE_BASE=origin\/main node scripts\/red-check\.mjs`/i);
      assert.ok(!calls.some(c => c.startsWith('red-check')));
    });
  });

  test('one line flagged by two auditors under different categories costs one skeptic', async () => {
    const f = (category) => ({ ...blocker('the total ignores waitlist places'), category });
    const { calls } = await run({
      'audit:criteria': (n) => ({ covered: 'all', findings: n === 1 ? [f('criterion-unmet')] : [] }),
      'audit:rules': (n) => ({ covered: 'all', findings: n === 1 ? [f('logic')] : [] }),
    });
    assert.equal(calls.filter(c => c.startsWith('skeptic')).length, 1);
  });

  test('two different findings a few lines apart in one file are both judged', async () => {
    const { calls } = await run({
      'audit:criteria': (n) => ({ covered: 'all', findings: n === 1 ? [{ ...blocker('the total ignores waitlist places'), line: 12 }] : [] }),
      'audit:rules': (n) => ({ covered: 'all', findings: n === 1 ? [{ ...blocker('the note renders for zero hours'), line: 15 }] : [] }),
    });
    assert.equal(calls.filter(c => c.startsWith('skeptic')).length, 2);
  });

  test('several findings sharing a stuck key count once per round, not once each', async () => {
    const near = (line, claim) => ({ ...blocker(claim), line });
    const { calls } = await run({
      'audit:rules': (n) => ({ covered: 'all', findings: n === 1 ? [near(11, 'a'), near(13, 'b'), near(15, 'c')] : [] }),
    });
    assert.ok(calls.includes('fix#1'), 'a fix is attempted before anything is called stuck');
  });

  test('two findings with no line whose claims only share a beginning are both judged', async () => {
    const long = 'the hours tile counts waitlisted sessions when the attendee has ';
    const unmet = (claim, category) => ({ ...blocker(claim), category, file: 'specs/7-hours.md', line: undefined });
    const { calls } = await run({
      'audit:criteria': (n) => ({ covered: 'all', findings: n === 1 ? [unmet(long + 'more than three', 'criterion-unmet'), unmet(long + 'fewer than three', 'logic')] : [] }),
    });
    assert.equal(calls.filter(c => c.startsWith('skeptic')).length, 2);
  });

  test('a second reading of the same line goes to the skeptic with the first, never dropped', async () => {
    const f = (category, claim) => ({ ...blocker(claim), category });
    const { prompts, calls } = await run({
      'audit:criteria': (n) => ({ covered: 'all', findings: n === 1 ? [f('criterion-unmet', 'criterion 2 has no test')] : [] }),
      'audit:rules': (n) => ({ covered: 'all', findings: n === 1 ? [f('logic', 'the total counts waitlisted sessions')] : [] }),
    });
    const skeptic = prompts['skeptic:criterion-unmet'];
    assert.match(skeptic, /criterion 2 has no test/);
    assert.match(skeptic, /also, \[logic\]: the total counts waitlisted sessions/);
    assert.match(skeptic, /refute only if EVERY reading is wrong/);
    assert.match(prompts['fix#1'], /the total counts waitlisted sessions/);
    assert.equal(calls.filter(c => c.startsWith('skeptic')).length, 1);
  });

  test('minor readings of one line reach the PR body together — grouping twice keeps them', async () => {
    const minor = (category, claim) => ({ ...blocker(claim), category, line: 42, severity: 'minor' });
    const { prompts } = await run({
      'audit:criteria': { covered: 'all', findings: [minor('criterion-unmet', 'the note has no test')] },
      'audit:rules': { covered: 'all', findings: [minor('logic', 'the note rounds down')] },
    });
    assert.match(prompts['open-pr'], /the note has no test/);
    assert.match(prompts['open-pr'], /the note rounds down/);
  });

  test('a spec that needs .claude/ is handed back from a runner before anything is built', async () => {
    const { result, calls } = await run({ 'write-spec': { path: 'specs/7-hours.md', summary: 's', editsHarness: true } });
    assert.equal(result.outcome, 'needs-human');
    assert.equal(result.stage, 'Spec');
    assert.match(result.reason, /build it locally/);
    assert.ok(!calls.some(c => c.startsWith('spec-audit') || c === 'implement'));
  });

  test('on a laptop a .claude/ plan is built as normal', async () => {
    const { result } = await run({ setup: { ...SETUP, runner: false }, 'write-spec': { path: 'specs/7-hours.md', summary: 's', editsHarness: true } });
    assert.equal(result.outcome, 'shipped');
  });

  test('a spec hand-back on scope also lists the technical findings still open', async () => {
    const { prompts } = await run({
      'spec-audit:fit': { covered: 'all', findings: [
        { ...blocker('the ticket asks for two contradictory outcomes'), category: 'scope' },
        { ...blocker('the gh call does not pin --repo'), line: 90 },
      ] },
    });
    assert.match(prompts['hand-back'], /contradictory outcomes/);
    assert.match(prompts['hand-back'], /Also still open[\s\S]*does not pin --repo/);
  });
});
