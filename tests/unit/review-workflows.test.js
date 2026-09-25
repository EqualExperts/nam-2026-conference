import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The code-review and QA workflows, with every agent stubbed by label — the
 * same approach as ship.test.js. What is tested is what the scripts decide:
 * which findings survive, what the verdict line says, and how confident it
 * is allowed to be. What an agent writes is judgement; this is the rules.
 */

const load = (name) => {
  const src = readFileSync(new URL(`../../.claude/workflows/${name}.js`, import.meta.url), 'utf8')
    .replace(/^export const meta/m, 'const meta');
  const AsyncFunction = (async () => {}).constructor;
  return new AsyncFunction('args', 'agent', 'parallel', 'phase', 'log', src);
};

function runner(name, defaults) {
  const script = load(name);
  return async (answers = {}, args = 42) => {
    const calls = [], prompts = {};
    const agent = async (prompt, opts) => {
      calls.push(opts.label); prompts[opts.label] = prompt;
      const bare = opts.label.replace('-retry', '');
      const hit = Object.keys(answers).find(k => bare === k || bare.startsWith(k + ':'));
      const a = hit ? answers[hit] : defaults(bare);
      return typeof a === 'function' ? a(opts.label, prompt) : a;
    };
    const parallel = async (ts) => Promise.all(ts.map(t => t().catch(() => null)));
    const result = await script(args, agent, parallel, () => {}, () => {});
    return { result, calls, prompts, verdictLine: (/write exactly this one line to \/tmp\/\w+-verdict:\n(.*)\n/.exec(prompts.publish || '') || [])[1] };
  };
}

describe('code-review', () => {
  const CTX = { issue: 27, title: 'Waitlist', doneWhen: ['a waitlisted session is not shown as now'], base: 'main', files: ['src/components/NextUpCard.jsx'], amendments: [] };
  const clean = (confidence = 'high') => ({ confidence, covered: 'read it', findings: [] });
  const blocker = (claim, category = 'logic', line = 10) => ({ severity: 'blocker', category, file: 'src/a.jsx', line, claim, evidence: 'e' });
  const run = runner('code-review', (label) => {
    if (label === 'context') return CTX;
    if (label.startsWith('review')) return clean();
    if (label.startsWith('skeptic')) return { refuted: false, why: 'real' };
    if (label === 'publish') return { ok: true, url: 'u' };
  });

  test('four clean lenses pass at the weakest lens’s confidence', async () => {
    const { result, verdictLine, calls } = await run({ 'review:tests': clean('medium') });
    assert.equal(result.verdict, 'pass');
    assert.equal(result.confidence, 'medium');
    assert.match(verdictLine, /^PASS medium /);
    assert.equal(calls.filter(c => c.startsWith('review')).length, 4);
  });

  test('a confirmed blocker fails, with the finding in the comment and the verdict line', async () => {
    const { result, verdictLine, prompts } = await run({ 'review:logic': { ...clean(), findings: [blocker('the done count includes waitlist places')] } });
    assert.equal(result.verdict, 'fail');
    assert.equal(verdictLine, 'FAIL the done count includes waitlist places');
    assert.match(prompts.publish, /\[!CAUTION\]/);
  });

  test('a refuted blocker does not fail the review', async () => {
    const { result } = await run({
      'review:logic': { ...clean(), findings: [blocker('imagined')] },
      skeptic: { refuted: true, why: 'the line says otherwise' },
    });
    assert.equal(result.verdict, 'pass');
  });

  test('a dead skeptic refutes nothing', async () => {
    const { result } = await run({ 'review:logic': { ...clean(), findings: [blocker('real')] }, skeptic: null });
    assert.equal(result.verdict, 'fail');
  });

  test('a lens that dies twice makes a pass low confidence, never high', async () => {
    const { result, calls } = await run({ 'review:rules': null });
    assert.ok(calls.includes('review:rules-retry'));
    assert.equal(result.confidence, 'low');
  });

  test('at most three findings, criteria first', async () => {
    const many = [blocker('a', 'test-proves-nothing', 10), blocker('b', 'logic', 20), blocker('c', 'claude-md', 30)];
    const { result } = await run({
      'review:logic': { ...clean(), findings: many },
      'review:criteria': { ...clean(), findings: [blocker('d', 'criterion-unmet', 40)] },
    });
    assert.deepEqual(result.findings.map(f => f.claim), ['d', 'b', 'c']);
  });

  test('the same finding from two lenses is judged once', async () => {
    const f = blocker('same');
    const { calls } = await run({ 'review:logic': { ...clean(), findings: [f] }, 'review:tests': { ...clean(), findings: [f] } });
    assert.equal(calls.filter(c => c.startsWith('skeptic')).length, 1);
  });

  test('human amendments reach the skeptic, not the lenses', async () => {
    const { prompts } = await run({
      context: { ...CTX, amendments: ['@jonas: drop the badge, the nav covers it'] },
      'review:logic': { ...clean(), findings: [blocker('badge missing')] },
    });
    assert.match(prompts['skeptic:logic'], /drop the badge/);
    assert.doesNotMatch(prompts['review:logic'], /drop the badge/);
  });

  test('no pull request readable → no verdict file, which publishes as unproven', async () => {
    const { result, prompts } = await run({ context: null });
    assert.equal(result.verdict, 'none');
    assert.match(prompts.publish, /Write nothing to \/tmp\/review-verdict/);
  });
});

describe('qa', () => {
  const probe = (id) => ({ id, what: `visit /my-agenda as kenji (${id})`, expect: 'no live badge', why: 'empty-or-extreme' });
  const PLAN = { issue: 27, base: 'main', surface: true, probes: ['a', 'b', 'c', 'd'].map(probe) };
  const allPass = { results: PLAN.probes.map(p => ({ id: p.id, desktop: 'pass', mobile: 'pass' })) };
  const withFail = (id) => ({ results: allPass.results.map(r => (r.id === id ? { ...r, mobile: 'fail', happened: 'LIVE badge shown' } : r)) });
  const run = runner('qa', (label) => {
    if (label === 'plan') return PLAN;
    if (label === 'probe') return allPass;
    if (label.startsWith('repro')) return { onBranch: 'fails-again', onBase: 'passes', happened: 'LIVE badge shown' };
    if (label === 'publish') return { ok: true };
  });

  test('every probe passing on both viewports is a high-confidence pass', async () => {
    const { result, verdictLine, calls } = await run();
    assert.equal(result.verdict, 'pass');
    assert.equal(result.confidence, 'high');
    assert.match(verdictLine, /^PASS high 4\/4 probes ran as planned/);
    assert.ok(!calls.some(c => c.startsWith('repro')));
  });

  test('a failure that reproduces on the branch and not the base fails the check', async () => {
    const { result, verdictLine, prompts } = await run({ probe: withFail('b') });
    assert.equal(result.verdict, 'fail');
    assert.equal(verdictLine, 'FAIL b: LIVE badge shown');
    assert.match(prompts['repro:b'], /--project=mobile/);
    assert.match(prompts.publish, /a bug in this change/);
  });

  test('a failure that also happens on the base is pre-existing, and passes', async () => {
    const { result, prompts } = await run({ probe: withFail('b'), repro: { onBranch: 'fails-again', onBase: 'fails', happened: 'x' } });
    assert.equal(result.verdict, 'pass');
    assert.match(prompts.publish, /pre-existing/);
  });

  test('a failure that does not reproduce is a question, never a blocker', async () => {
    const flaky = await run({ probe: withFail('b'), repro: { onBranch: 'passes-now', onBase: 'passes', happened: 'x' } });
    assert.equal(flaky.result.verdict, 'pass');
    const dead = await run({ probe: withFail('b'), repro: null });
    assert.equal(dead.result.verdict, 'pass');
    assert.match(dead.prompts.publish, /did not reproduce/);
  });

  test('a feature that does not exist on the base is still a bug in this change', async () => {
    const { result } = await run({ probe: withFail('b'), repro: { onBranch: 'fails-again', onBase: 'not-applicable', happened: 'x' } });
    assert.equal(result.verdict, 'fail');
  });

  test('probes that only ran on one viewport lower the confidence', async () => {
    const half = { results: allPass.results.map((r, i) => (i < 2 ? { ...r, mobile: 'not-run' } : r)) };
    const { result } = await run({ probe: half });
    assert.equal(result.confidence, 'medium');
  });

  test('nothing reachable from a browser is a low-confidence pass with no probes run', async () => {
    const { result, calls } = await run({ plan: { ...PLAN, surface: false, reason: 'server-only', probes: [] } });
    assert.equal(result.confidence, 'low');
    assert.ok(!calls.includes('probe'));
  });

  test('probes that never ran publish no verdict, and still clean up', async () => {
    const { result, prompts } = await run({ probe: null });
    assert.equal(result.verdict, 'none');
    assert.match(prompts.publish, /First delete tests\/qa-probe\.spec\.js/);
    assert.match(prompts.publish, /Write nothing to \/tmp\/qa-verdict/);
  });

  test('reproductions run one at a time — they share the ports', async () => {
    const two = { results: allPass.results.map(r => (['a', 'c'].includes(r.id) ? { ...r, desktop: 'fail' } : r)) };
    let active = 0, peak = 0;
    const { calls } = await run({
      probe: two,
      repro: async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 5)); active--; return { onBranch: 'fails-again', onBase: 'fails', happened: 'x' }; },
    });
    assert.equal(calls.filter(c => c.startsWith('repro')).length, 2);
    assert.equal(peak, 1);
  });

  test('a probe planned for one viewport is not counted as missing on the other', async () => {
    const plan = { ...PLAN, probes: PLAN.probes.map((p, i) => (i === 0 ? { ...p, viewport: 'mobile' } : p)) };
    const ran = { results: allPass.results.map((r, i) => (i === 0 ? { ...r, desktop: 'not-run' } : r)) };
    const { result } = await run({ plan, probe: ran });
    assert.equal(result.confidence, 'high');
  });
});
