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

/** The machine-readable verdict marker a pass leaves for the next run. */
const marker = (comment, pass) => {
  const m = new RegExp(`<!-- orbit-verdict:${pass} (\\{[\\s\\S]*?\\}) -->`).exec(comment || '');
  return m ? JSON.parse(m[1]) : null;
};
const keyOf = (f) => `${f.category}|${f.file}|${Math.floor((f.line || 0) / 10)}`;

describe('code-review', () => {
  const HEAD = 'headsha1';
  const CTX = { issue: 27, title: 'Waitlist', doneWhen: ['a waitlisted session is not shown as now'], base: 'main', files: ['src/components/NextUpCard.jsx'], amendments: [], head: HEAD };
  const clean = (confidence = 'high') => ({ confidence, covered: 'read it', findings: [] });
  const blocker = (claim, category = 'logic', line = 10) => ({
    severity: 'blocker', category, file: 'src/a.jsx', line, claim, evidence: 'e',
    how: 'add a waitlisted session, then open /my-agenda', harm: 'the hours tile promises time the room cannot give',
  });
  const was = (blockers = [], extra = {}) => ({ pass: 'code-review', commit: 'oldsha', inHistory: true, blockers, followUps: [], ...extra });
  const run = runner('code-review', (label) => {
    if (label === 'context') return CTX;
    if (label.startsWith('review')) return clean();
    if (label.startsWith('recheck')) return { resolved: true, why: 'fixed' };
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

  test('one line reported by two lenses under different categories is one finding, the more severe kept', async () => {
    const { calls, result } = await run({
      context: { ...CTX, files: ['src/a.jsx', 'CLAUDE.md'] },
      'review:rules': { ...clean(), findings: [blocker('breaks the one-action rule', 'claude-md', 12)] },
      'review:logic': { ...clean(), findings: [blocker('drops the waitlist place', 'logic', 12)] },
    });
    assert.equal(calls.filter(c => c.startsWith('skeptic')).length, 1);
    assert.deepEqual(result.findings.map(f => f.category), ['logic']);
  });

  test('two readings of one line reach one skeptic together, and a confirmed one publishes both', async () => {
    const { prompts, result } = await run({
      context: { ...CTX, files: ['src/a.jsx', 'CLAUDE.md'] },
      'review:rules': { ...clean(), findings: [blocker('breaks the one-action rule', 'claude-md', 12)] },
      'review:logic': { ...clean(), findings: [blocker('drops the waitlist place', 'logic', 12)] },
    });
    const skeptic = Object.entries(prompts).find(([k]) => k.startsWith('skeptic'))[1];
    assert.match(skeptic, /drops the waitlist place/);
    assert.match(skeptic, /breaks the one-action rule/);
    assert.match(skeptic, /refute only if EVERY reading is wrong/);
    assert.match(prompts.publish, /The same line, read as claude-md: breaks the one-action rule/);
    assert.equal(result.verdict, 'fail');
  });

  test('a note on the same line never shields a blocker from its skeptic', async () => {
    const note = { severity: 'note', category: 'logic', file: 'src/a.jsx', line: 12, claim: 'the toast has no aria-label', evidence: 'e' };
    const { prompts, result } = await run({
      context: { ...CTX, files: ['src/a.jsx'] },
      'review:logic': { ...clean(), findings: [note] },
      'review:rules': { ...clean(), findings: [blocker('breaks the one-action rule', 'claude-md', 12)] },
      skeptic: { refuted: true, why: 'the rule is not broken' },
    });
    const skeptic = Object.entries(prompts).find(([k]) => k.startsWith('skeptic'))[1];
    assert.doesNotMatch(skeptic, /aria-label/);
    assert.doesNotMatch(skeptic, /EVERY reading/);
    assert.equal(result.verdict, 'pass');
  });

  test('on one line, a blocker beats a note from another lens', async () => {
    const note = { severity: 'note', category: 'logic', file: 'src/a.jsx', line: 12, claim: 'minor', evidence: 'e' };
    const { result } = await run({
      context: { ...CTX, files: ['src/a.jsx'] },
      'review:logic': { ...clean(), findings: [note] },
      'review:rules': { ...clean(), findings: [blocker('breaks the one-action rule', 'claude-md', 12)] },
    });
    assert.equal(result.verdict, 'fail');
    assert.deepEqual(result.findings.map(f => f.claim), ['breaks the one-action rule']);
  });

  test('two different problems a few lines apart are both judged — merging them hid one', async () => {
    const { calls, result } = await run({
      context: { ...CTX, files: ['src/a.jsx', 'CLAUDE.md'] },
      'review:rules': { ...clean(), findings: [blocker('breaks the one-action rule', 'claude-md', 12)] },
      'review:logic': { ...clean(), findings: [blocker('drops the waitlist place', 'logic', 15)] },
      skeptic: (label, prompt) => ({ refuted: /drops the waitlist place/.test(prompt), why: 'x' }),
    });
    assert.equal(calls.filter(c => c.startsWith('skeptic')).length, 2);
    assert.equal(result.verdict, 'fail');
    assert.deepEqual(result.findings.map(f => f.claim), ['breaks the one-action rule']);
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

  const lensesFor = async (files) => {
    const { calls } = await run({ context: { ...CTX, files } });
    return calls.filter(c => c.startsWith('review:')).map(c => c.slice(7)).sort();
  };

  test('lenses follow what the diff touches — app code gets the app lenses', async () => {
    assert.deepEqual(await lensesFor(['src/components/NextUpCard.jsx']), ['criteria', 'logic', 'rules', 'tests']);
  });

  test('a GitHub Actions change gets the Actions lens, not the app ones', async () => {
    assert.deepEqual(await lensesFor(['.github/workflows/agent-ship.yml']), ['actions', 'criteria']);
  });

  test('an AI-context change gets the docs-truth lens', async () => {
    assert.deepEqual(await lensesFor(['CLAUDE.md', 'docs/context/seats.md']), ['criteria', 'docs']);
  });

  test('a workflow-script change gets orchestration, logic and tests', async () => {
    assert.deepEqual(await lensesFor(['.claude/workflows/ship.js', 'tests/unit/ship.test.js']), ['criteria', 'logic', 'orchestration', 'tests']);
  });

  test('a mixed change gets the union', async () => {
    assert.deepEqual(await lensesFor(['server/lib/seats.js', '.github/workflows/verify.yml', 'docs/context/seats.md']),
      ['actions', 'criteria', 'docs', 'logic', 'rules', 'tests']);
  });

  test('the Actions lens is pointed at what this repo learned the hard way', async () => {
    const { prompts } = await run({ context: { ...CTX, files: ['.github/workflows/agent-ship.yml'] } });
    assert.match(prompts['review:actions'], /script injection/);
    assert.match(prompts['review:actions'], /docs\/harness\/github\.md/);
  });

  test('an Actions blocker outranks a docs one', async () => {
    const f = (category, line, claim) => ({ severity: 'blocker', category, file: 'x', line, claim, evidence: 'e' });
    const { result } = await run({
      context: { ...CTX, files: ['.github/workflows/a.yml', 'CLAUDE.md'] },
      'review:docs': { ...clean(), findings: [f('docs-truth', 10, 'doc wrong')] },
      'review:actions': { ...clean(), findings: [f('actions', 50, 'trigger cannot fire')] },
    });
    assert.deepEqual(result.findings.map(x => x.claim), ['trigger cannot fire', 'doc wrong']);
  });

  test('with --no-publish nothing is posted by a model — the verdict and comment are returned for the job', async () => {
    const { result, calls } = await run({}, '42 --no-publish');
    assert.ok(!calls.includes('publish'));
    assert.match(result.verdictLine, /^PASS high /);
    assert.match(result.comment, /\[!TIP\]/);
  });

  test('no pull request readable → no verdict file, which publishes as unproven', async () => {
    const { result, prompts } = await run({ context: null });
    assert.equal(result.verdict, 'none');
    assert.match(prompts.publish, /Write nothing to \/tmp\/review-verdict/);
  });

  describe('converging on a re-review', () => {
    test('the comment ends with a marker naming the commit it reviewed', async () => {
      const { result } = await run({ 'review:logic': { ...clean(), findings: [blocker('the done count includes waitlist places')] } });
      const m = marker(result.comment, 'code-review');
      assert.ok(m, 'no orbit-verdict:code-review marker in the comment');
      assert.equal(m.pass, 'code-review');
      assert.equal(m.commit, HEAD);
      assert.deepEqual(m.blockers.map(b => b.claim), ['the done count includes waitlist places']);
      assert.match(result.comment.trim(), /-->$/, 'the marker is not the last thing in the comment');
    });

    test('a verdict marker left by the other pass is ignored', async () => {
      const previous = { ...was([blocker('QA found this, not us')]), pass: 'qa' };
      const { result, calls, prompts } = await run({ context: { ...CTX, previous } });
      assert.ok(!calls.some(c => c.startsWith('recheck')), 'rechecked the other pass’s blocker');
      assert.doesNotMatch(prompts['review:logic'], /git diff oldsha/);
      assert.equal(result.verdict, 'pass');
      assert.doesNotMatch(result.comment, /QA found this/);
      assert.match(prompts.context, /orbit-verdict:code-review/);
      assert.doesNotMatch(prompts.context, /orbit-verdict:qa/);
    });

    test('a re-review scopes the lenses to what changed since the last reviewed commit', async () => {
      const { prompts, calls } = await run({ context: { ...CTX, previous: was() } });
      const lenses = calls.filter(c => c.startsWith('review:'));
      assert.ok(lenses.length >= 4);
      for (const label of lenses) {
        assert.match(prompts[label], /git diff oldsha headsha1/, `${label} was not scoped to the delta`);
        assert.doesNotMatch(prompts[label], /\bHEAD\b/, `${label} names HEAD, which in Actions is the merge commit`);
      }
    });

    test('a re-review re-checks every previous blocker', async () => {
      const previous = was([blocker('one', 'logic', 10), blocker('two', 'claude-md', 20)]);
      const { calls } = await run({ context: { ...CTX, previous } });
      assert.deepEqual(calls.filter(c => c.startsWith('recheck')).sort(), ['recheck:claude-md', 'recheck:logic']);
    });

    test('a previous commit no longer in history scopes the review to the files the PR touches', async () => {
      const { prompts } = await run({ context: { ...CTX, previous: was([], { inHistory: false }) } });
      assert.match(prompts['review:logic'], /git fetch origin oldsha/);
      assert.match(prompts['review:logic'], /git diff oldsha headsha1/);
      assert.match(prompts['review:logic'], /-- src\/components\/NextUpCard\.jsx/);
    });

    test('a dead context publishes did-not-finish with no marker', async () => {
      const { result } = await run({ context: null });
      assert.equal(result.verdict, 'none');
      assert.ok(result.comment, 'nothing was published');
      assert.doesNotMatch(result.comment, /orbit-verdict:/, 'a pass that did not finish claimed a commit');
    });

    test('an unresolved previous blocker still fails the review', async () => {
      const previous = was([blocker('the hours tile counts waitlist places')]);
      const { result, verdictLine, calls } = await run({ context: { ...CTX, previous }, recheck: { resolved: false, why: 'the line is unchanged' } });
      assert.equal(result.verdict, 'fail');
      assert.equal(verdictLine, 'FAIL the hours tile counts waitlist places');
      assert.ok(!calls.some(c => c.startsWith('skeptic')), 'a previous blocker faced a second skeptic');
    });

    test('a re-review whose only previous blocker is resolved publishes a pass', async () => {
      const previous = was([blocker('the hours tile counts waitlist places')]);
      let asked = null;
      const { result, calls } = await run({
        context: { ...CTX, previous },
        recheck: (label) => { asked = label; return { resolved: true, why: 'the tile now sums confirmed seats only' }; },
      });
      assert.deepEqual(calls.filter(c => c.startsWith('recheck')), ['recheck:logic']);
      assert.equal(asked, 'recheck:logic');
      assert.equal(result.verdict, 'pass');
      assert.doesNotMatch(result.comment, /the hours tile counts waitlist places/, 'a resolved blocker stayed in the comment');
      assert.deepEqual(marker(result.comment, 'code-review').blockers, []);
    });

    test('a blocker outside the delta is still published', async () => {
      const { result, prompts } = await run({
        context: { ...CTX, previous: was() },
        'review:logic': { ...clean(), findings: [blocker('seats_taken can go negative')] },
      });
      assert.equal(result.verdict, 'fail');
      assert.match(prompts['review:logic'], /would have blocked a first review/);
    });
  });

  describe('the blocker bar, and follow-ups', () => {
    test('a blocker with no path through normal use publishes as a follow-up', async () => {
      const vague = { ...blocker('the helper could throw'), how: '', harm: '  ' };
      const { result, calls } = await run({ 'review:logic': { ...clean(), findings: [vague] } });
      assert.equal(result.verdict, 'pass');
      assert.ok(!calls.some(c => c.startsWith('skeptic')), 'a demoted finding still went to a skeptic');
      assert.equal(result.followUps.length, 1);
      assert.match(result.comment, /the helper could throw/);
    });

    test('a contrived-input finding becomes a follow-up, not a refutation', async () => {
      const { result } = await run({
        'review:logic': { ...clean(), findings: [blocker('a NaN day index renders an empty grid')] },
        skeptic: { refuted: false, contrived: true, why: 'only with a hand-edited ?day= in the URL' },
      });
      assert.equal(result.verdict, 'pass');
      assert.equal(result.followUps.length, 1);
      assert.match(result.comment, /hand-edited \?day= in the URL/);
    });

    test('a follow-up-only review publishes as a pass and files its issues', async () => {
      const fu = { ...blocker('the empty state has no aria-label'), severity: 'follow-up' };
      const { result, verdictLine } = await run({ 'review:logic': { ...clean(), findings: [fu] } });
      assert.equal(result.verdict, 'pass');
      assert.match(verdictLine, /^PASS /);
      assert.match(result.comment, /the empty state has no aria-label/);
      assert.equal(result.followUps.length, 1);
      assert.ok(result.followUps[0].title, 'a follow-up with no title');
      assert.match(result.followUps[0].body, /#42/, 'the follow-up issue does not link the pull request');
      assert.deepEqual(marker(result.comment, 'code-review').followUps, [keyOf(fu)]);
    });

    test('a follow-up the last review already filed is not filed again', async () => {
      const fu = { ...blocker('the empty state has no aria-label'), severity: 'follow-up' };
      const previous = was([], { followUps: [keyOf(fu)] });
      const { result } = await run({ context: { ...CTX, previous }, 'review:logic': { ...clean(), findings: [fu] } });
      assert.equal(result.verdict, 'pass');
      assert.deepEqual(result.followUps, []);
      assert.match(result.comment, /the empty state has no aria-label/, 'a known follow-up vanished from the comment');
    });

    test('a failing review still returns its follow-ups', async () => {
      const { result } = await run({
        'review:logic': { ...clean(), findings: [blocker('seats_taken can go negative', 'logic', 10)] },
        'review:tests': { ...clean(), findings: [blocker('a NaN index blanks the grid', 'test-proves-nothing', 50)] },
        skeptic: (label) => (label === 'skeptic:test-proves-nothing'
          ? { refuted: false, contrived: true, why: 'only from a hand-edited URL' }
          : { refuted: false, why: 'real' }),
      });
      assert.equal(result.verdict, 'fail');
      assert.equal(result.followUps.length, 1);
      assert.match(result.followUps[0].body, /a NaN index blanks the grid/);
    });
  });
});

describe('qa', () => {
  const probe = (id) => ({ id, what: `visit /my-agenda as kenji (${id})`, expect: 'no live badge', why: 'empty-or-extreme' });
  const HEAD = 'headsha1';
  const SCOPE = { head: HEAD, files: ['src/components/NextUpCard.jsx', 'tests/home.spec.js'] };
  const bug = (id) => ({ id, happened: 'LIVE badge shown', probe: probe(id) });
  const was = (bugs = [], extra = {}) => ({ pass: 'qa', commit: 'oldsha', inHistory: true, bugs, followUps: [], ...extra });
  const ranAll = (ids) => ({ results: ids.map(id => ({ id, desktop: 'pass', mobile: 'pass' })) });
  const PLAN = { issue: 27, base: 'main', surface: true, probes: ['a', 'b', 'c', 'd'].map(probe),
    criteria: [{ criterion: 'works', by: 'probe', ref: 'a' }] };
  const allPass = { results: PLAN.probes.map(p => ({ id: p.id, desktop: 'pass', mobile: 'pass' })) };
  const withFail = (id) => ({ results: allPass.results.map(r => (r.id === id ? { ...r, mobile: 'fail', happened: 'LIVE badge shown' } : r)) });
  const run = runner('qa', (label) => {
    if (label === 'scope') return SCOPE;
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
    // The base worktree is made, and cleaned up, inside the checkout — and the
    // agent is already standing in one, so the path is computed from the root.
    assert.match(prompts['repro:b'], /--git-common-dir[^\n]*\/\.claude\/worktrees\/qa-base/);
    assert.match(prompts.publish, /--git-common-dir[^\n]*\/\.claude\/worktrees\/qa-base/);
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

  test('confidence is criteria coverage: a criterion nothing exercises caps it at medium', async () => {
    const plan = { ...PLAN, criteria: [{ criterion: 'works', by: 'probe', ref: 'a' }, { criterion: 'edge', by: 'none' }] };
    assert.equal((await run({ plan })).result.confidence, 'medium');
  });

  test('a criterion about the code itself is left to code review, not counted against QA — #87', async () => {
    const plan = { ...PLAN, criteria: [{ criterion: 'no db.prepare in the handler', by: 'code' }, { criterion: 'works', by: 'probe', ref: 'a' }] };
    const { result, verdictLine } = await run({ plan });
    assert.equal(result.confidence, 'high');
    assert.match(verdictLine, /criteria exercised 1\/1 \(\+1 about the code itself, for code review\)/);
  });

  test('a criterion counts as pinned by a test only if the diff changes that test file', async () => {
    const inDiff = SCOPE.files.find(f => f.startsWith('tests/'));
    const ok = { ...PLAN, criteria: [{ criterion: 'works', by: 'test', ref: inDiff }] };
    const claimed = { ...PLAN, criteria: [{ criterion: 'works', by: 'test', ref: 'tests/api/not-in-this-diff.test.js' }] };
    assert.equal((await run({ plan: ok })).result.confidence, 'high');
    assert.equal((await run({ plan: claimed })).result.confidence, 'medium');
  });

  const cmd = (id) => ({ id, kind: 'command', run: `node scripts/gate.mjs --x ${id}`, what: `run ${id}`, expect: 'exit 0', why: 'failure-path' });
  const CMD_PLAN = { issue: 0, base: 'main', surface: true, probes: ['c1', 'c2', 'c3', 'c4'].map(cmd),
    criteria: [{ criterion: 'works', by: 'probe', ref: 'c1' }] };
  const cmdPass = { results: CMD_PLAN.probes.map(p => ({ id: p.id, command: 'pass' })) };

  test('a change with no browser surface is probed by running it, not passed unexamined', async () => {
    const { result, calls } = await run({ plan: CMD_PLAN, 'probe-commands': cmdPass });
    assert.ok(calls.includes('probe-commands'));
    assert.ok(!calls.includes('probe'), 'no browser run when no browser probe was planned');
    assert.equal(result.verdict, 'pass');
    assert.equal(result.confidence, 'high');
  });

  test('a failing command probe is reproduced as a command, on the branch and the base', async () => {
    const fail = { results: cmdPass.results.map(r => (r.id === 'c2' ? { ...r, command: 'fail', happened: 'exit 1' } : r)) };
    const { result, prompts } = await run({
      plan: CMD_PLAN, 'probe-commands': fail,
      repro: { onBranch: 'fails-again', onBase: 'not-applicable', happened: 'exit 1' },
    });
    assert.equal(result.verdict, 'fail');
    assert.match(prompts['repro:c2'], /command probe failed/);
    assert.match(prompts['repro:c2'], /node scripts\/gate\.mjs --x c2/);
    assert.match(prompts['repro:c2'], /--git-common-dir[^\n]*\/\.claude\/worktrees\/qa-base/);
  });

  test('browser and command probes in one plan both run', async () => {
    const mixed = { ...PLAN, probes: [...PLAN.probes, cmd('c1')] };
    const { calls, result } = await run({ plan: mixed, 'probe-commands': { results: [{ id: 'c1', command: 'pass' }] } });
    assert.ok(calls.includes('probe') && calls.includes('probe-commands'));
    assert.equal(result.confidence, 'high');
  });

  test('with --no-publish QA returns its comment, verdict and issue note for the job', async () => {
    const { result, calls } = await run({}, '42 --no-publish');
    assert.ok(!calls.includes('publish'));
    assert.match(result.verdictLine, /^PASS high/);
    assert.equal(result.issue, 27);
    assert.match(result.issueNote, /### QA/);
  });

  describe('a QA blocker has to survive a skeptic', () => {
    test('a reproduced failure the skeptic refutes is a question, and the check passes', async () => {
      const { result, prompts } = await run({
        probe: withFail('b'),
        skeptic: { refuted: true, why: 'the probe ran the PR\'s new tests against the base copy of the code' },
      });
      assert.equal(result.verdict, 'pass');
      assert.match(prompts.publish, /refuted as a bug/);
      assert.match(prompts.publish, /Why it is not a blocker: the probe ran/);
    });

    test('one the skeptic cannot refute still fails the check', async () => {
      const { result } = await run({ probe: withFail('b'), skeptic: { refuted: false, why: 'real' } });
      assert.equal(result.verdict, 'fail');
    });

    test('a refutation with no reason still says something where the reason goes', async () => {
      const { result, prompts } = await run({ probe: withFail('b'), skeptic: { refuted: true, why: '  ' } });
      assert.equal(result.verdict, 'pass');
      assert.match(prompts.publish, /Why it is not a blocker: the skeptic refuted it without giving a reason/);
    });

    test('a skeptic that dies refutes nothing', async () => {
      const { result } = await run({ probe: withFail('b'), skeptic: null });
      assert.equal(result.verdict, 'fail');
    });

    test('pre-existing and flaky findings are not sent to a skeptic', async () => {
      const { calls } = await run({ probe: withFail('b'), repro: { onBranch: 'fails-again', onBase: 'fails', happened: 'x' } });
      assert.ok(!calls.some(c => c.startsWith('skeptic')));
    });
  });

  describe('triage — are the tests enough, or does it need exploring?', () => {
    const pinned = { criterion: 'heading names the search', by: 'test', ref: 'tests/home.spec.js' };
    const enough = { decision: 'enough', why: 'relabels the heading; home.spec.js asserts it', criteria: [pinned] };

    test('tests that pin every criterion are enough: no planner, no probes — #94, #104', async () => {
      const { result, calls, prompts } = await run({ triage: enough }, '42 --no-publish --size=small');
      assert.equal(result.verdict, 'pass');
      assert.equal(result.confidence, 'high');
      assert.ok(!calls.includes('plan') && !calls.includes('probe'));
      assert.match(result.comment, /QA · skipped — existing tests are enough/);
      assert.match(result.verdictLine, /^PASS high no exploration needed — relabels the heading/);
      assert.match(prompts.triage, /are the tests this pull request adds\s+or changes enough/);
    });

    test('"enough" without the tests to show for it probes the unpinned criteria', async () => {
      const claimed = { ...enough, criteria: [pinned, { criterion: 'empty search says so', by: 'test', ref: 'tests/not-in-this-diff.spec.js' }] };
      const { calls, prompts } = await run({ triage: claimed }, '42 --size=small');
      assert.ok(calls.includes('plan') && calls.includes('probe'));
      assert.match(prompts.plan, /one probe for each of these 1[\s\S]*- empty search says so/);
      assert.doesNotMatch(prompts.plan, /- heading names the search/);
    });

    test('a large change is never skipped, whatever the triage says', async () => {
      const { calls } = await run({ triage: enough }, '42 --size=large');
      assert.ok(calls.includes('plan') && calls.includes('probe'));
    });

    test('focused: one probe per gap the triage named, and nothing else', async () => {
      const focused = { decision: 'focused', why: 'the list is tested on desktop only', criteria: [pinned], gaps: ['the list on a phone', 'undo after leaving a waitlist'] };
      const { prompts } = await run({ triage: focused }, '42 --size=small');
      assert.match(prompts.plan, /one probe for each of these 2[\s\S]*- the list on a phone\n- undo after leaving a waitlist/);
    });

    test('explore: the full budget, as before', async () => {
      const { prompts } = await run({ triage: { decision: 'explore', why: 'a new flow across two pages', criteria: [] } }, '42 --size=small');
      assert.match(prompts.plan, /Pick at most 3 probes/);
    });

    test('a triage that dies explores in full rather than passing', async () => {
      const { calls, result } = await run({ triage: null }, '42 --size=small');
      assert.ok(calls.includes('plan') && calls.includes('probe'));
      assert.equal(result.verdict, 'pass');
    });

    test('thorough never triages', async () => {
      const { calls } = await run({ triage: enough }, '42 --size=small --depth=thorough');
      assert.ok(!calls.includes('triage') && calls.includes('plan'));
    });

    test('a re-review with bugs to recheck never triages — a skip would close them unexamined', async () => {
      const { calls } = await run({ triage: enough, scope: { ...SCOPE, previous: was([bug('b')]) } }, '42 --size=small');
      assert.ok(!calls.includes('triage'));
    });
  });

  describe('converging on a re-review', () => {
    test('the comment ends with a marker naming the commit it reviewed', async () => {
      const { result } = await run({ probe: withFail('b') });
      const m = marker(result.comment, 'qa');
      assert.ok(m, 'no orbit-verdict:qa marker in the comment');
      assert.equal(m.pass, 'qa');
      assert.equal(m.commit, HEAD);
      assert.deepEqual(m.bugs.map(b => b.id), ['b']);
      assert.ok(m.bugs[0].probe && m.bugs[0].probe.id === 'b', 'the marker does not carry the probe that found the bug');
      assert.match(result.comment.trim(), /-->$/);
    });

    test('a verdict marker left by the other pass is ignored', async () => {
      const previous = { ...was([bug('z')]), pass: 'code-review' };
      const { result, prompts, calls } = await run({ scope: { ...SCOPE, previous } });
      assert.doesNotMatch(prompts.plan, /git diff oldsha/);
      assert.ok(!result.probes.some(p => p.id === 'z'), 'ran the other pass’s probe');
      assert.equal(result.verdict, 'pass');
      assert.match(prompts.scope, /orbit-verdict:qa/);
      assert.doesNotMatch(prompts.scope, /orbit-verdict:code-review/);
      assert.ok(!calls.some(c => c.startsWith('recheck')));
    });

    test('a re-review scopes the lenses to what changed since the last reviewed commit', async () => {
      const { prompts } = await run({ scope: { ...SCOPE, previous: was() } });
      assert.match(prompts.plan, /git diff oldsha headsha1/);
      assert.doesNotMatch(prompts.plan, /\bHEAD\b/, 'the plan prompt names HEAD, which in Actions is the merge commit');
      assert.match(prompts.plan, /would have blocked a first review/);
    });

    test('a previous commit no longer in history scopes the review to the files the PR touches', async () => {
      const { prompts } = await run({ scope: { ...SCOPE, previous: was([], { inHistory: false }) } });
      assert.match(prompts.plan, /git fetch origin oldsha/);
      assert.match(prompts.plan, /git diff oldsha headsha1/);
      assert.match(prompts.plan, /-- src\/components\/NextUpCard\.jsx/);
    });

    test('a dead context publishes did-not-finish with no marker', async () => {
      const { result, calls } = await run({ scope: null });
      assert.equal(result.verdict, 'none');
      assert.ok(!calls.includes('plan'), 'planned blind');
      assert.ok(!calls.includes('probe'));
      assert.doesNotMatch(result.comment, /orbit-verdict:/);
    });

    test('a re-review re-runs each previous bug’s probe exactly once, inside the budget', async () => {
      const previous = was([bug('r1'), bug('r2')]);
      const fresh = { ...PLAN, probes: ['n1', 'n2', 'n3', 'n4'].map(probe) };
      const { result, prompts } = await run({
        scope: { ...SCOPE, previous }, plan: fresh,
        probe: ranAll(['r1', 'r2', 'n1', 'n2', 'n3']),
      });
      assert.deepEqual(result.probes.map(p => p.id), ['r1', 'r2', 'n1', 'n2', 'n3']);
      assert.match(prompts.plan, /r1/);
      assert.match(prompts.plan, /r2/);
      assert.match(prompts.plan, /at most 3 new/i, 'the planner was not told the reduced budget');
      assert.match(result.verdictLine, /5\/5 probes ran as planned/);

      // …and a planner that plans one of them anyway still only runs it once.
      const dup = { ...PLAN, probes: ['r1', 'n1', 'n2', 'n3'].map(probe) };
      const again = await run({ scope: { ...SCOPE, previous }, plan: dup, probe: ranAll(['r1', 'r2', 'n1', 'n2', 'n3']) });
      assert.deepEqual(again.result.probes.map(p => p.id), ['r1', 'r2', 'n1', 'n2', 'n3']);
    });

    test('a re-review with an empty plan still re-runs the previous bugs’ probes', async () => {
      const previous = was([bug('r1'), bug('r2')]);
      for (const surface of [false, true]) {
        const { result, calls } = await run({
          scope: { ...SCOPE, previous },
          plan: { ...PLAN, surface, reason: 'nothing new', probes: [] },
          probe: ranAll(['r1', 'r2']),
        });
        assert.ok(calls.includes('probe'), `surface: ${surface} took the "nothing to exercise" early return`);
        assert.deepEqual(result.probes.map(p => p.id), ['r1', 'r2']);
        assert.equal(result.verdict, 'pass');
        assert.deepEqual(marker(result.comment, 'qa').bugs, []);
      }
      const { result } = await run({
        scope: { ...SCOPE, previous },
        plan: { ...PLAN, surface: false, reason: 'nothing new', probes: [] },
        probe: { results: [{ id: 'r1', desktop: 'pass', mobile: 'pass' }, { id: 'r2', desktop: 'fail', mobile: 'pass', happened: 'still shown' }] },
      });
      assert.equal(result.verdict, 'fail');
    });

    test('a re-review whose only previous blocker is resolved publishes a pass', async () => {
      const previous = was([bug('r1')]);
      const { result, calls } = await run({
        scope: { ...SCOPE, previous },
        plan: { ...PLAN, probes: ['n1', 'n2', 'n3', 'n4'].map(probe) },
        probe: ranAll(['r1', 'n1', 'n2', 'n3', 'n4']),
      });
      assert.ok(result.probes.some(p => p.id === 'r1'), 'the previous bug’s probe was not re-run');
      assert.equal(result.verdict, 'pass');
      assert.ok(!calls.some(c => c.startsWith('repro')), 'a passing recheck was reproduced anyway');
      assert.deepEqual(marker(result.comment, 'qa').bugs, []);
    });

    test('a previous bug whose probe fails again is a bug, and faces no second skeptic', async () => {
      const previous = was([bug('r1')]);
      const { result, verdictLine, calls } = await run({
        scope: { ...SCOPE, previous },
        plan: { ...PLAN, probes: [probe('n1')] },
        probe: { results: [{ id: 'r1', desktop: 'fail', mobile: 'pass', happened: 'LIVE badge shown' }, { id: 'n1', desktop: 'pass', mobile: 'pass' }] },
      });
      assert.equal(result.verdict, 'fail');
      assert.match(verdictLine, /^FAIL r1/);
      assert.ok(calls.includes('repro:r1'));
      assert.ok(!calls.some(c => c.startsWith('skeptic')), 'a previous bug faced a second skeptic');
    });
  });

  describe('the blocker bar, and follow-ups', () => {
    test('a contrived-input finding becomes a follow-up, not a refutation', async () => {
      const { result } = await run({
        probe: withFail('b'),
        skeptic: { refuted: false, contrived: true, why: 'only with a hand-edited localStorage value' },
      });
      assert.equal(result.verdict, 'pass');
      assert.equal(result.followUps.length, 1);
      assert.match(result.comment, /hand-edited localStorage/);
      assert.match(result.followUps[0].body, /#42/, 'the follow-up issue does not link the pull request');
      assert.deepEqual(marker(result.comment, 'qa').followUps, ['b']);
    });

    test('a real glitch nobody loses anything to is a follow-up, not a blocker — #105', async () => {
      const { result } = await run({
        probe: withFail('b'),
        skeptic: { refuted: false, harmless: true, why: 'a second tooltip stays up; every button still works' },
      });
      assert.equal(result.verdict, 'pass');
      assert.equal(result.followUps.length, 1);
      assert.match(result.comment, /a second tooltip stays up/);
    });

    test('a follow-up the last review already filed is not filed again', async () => {
      const previous = was([], { followUps: ['b'] });
      const { result } = await run({
        scope: { ...SCOPE, previous },
        probe: withFail('b'),
        skeptic: { refuted: false, contrived: true, why: 'only with a hand-edited localStorage value' },
      });
      assert.equal(result.verdict, 'pass');
      assert.deepEqual(result.followUps, []);
      assert.match(result.comment, /hand-edited localStorage/);
    });

    test('a failing review still returns its follow-ups', async () => {
      const two = { results: allPass.results.map(r => (['a', 'b'].includes(r.id) ? { ...r, desktop: 'fail', happened: 'boom' } : r)) };
      const { result } = await run({
        probe: two,
        skeptic: (label) => (label === 'skeptic:a'
          ? { refuted: false, contrived: true, why: 'only from a malformed ?at=' }
          : { refuted: false, why: 'real' }),
      });
      assert.equal(result.verdict, 'fail');
      assert.equal(result.followUps.length, 1);
      assert.match(result.followUps[0].body, /a\b/);
    });
  });
});

describe('the review jobs', () => {
  const yml = (f) => readFileSync(new URL(`../../.github/workflows/${f}`, import.meta.url), 'utf8');
  // A comment mentioning `gh` or agent-run.sh is not a call: strip them first.
  const stepsOf = (src) => src.split('\n      - ').slice(1)
    .map(s => s.split('\n').filter(l => !/^\s*#/.test(l)).join('\n'));
  const nameOf = (step) => (/^(?:name: )?(.*)/.exec(step) || [, '?'])[1];
  const JOBS = ['agent-code-review.yml', 'agent-qa.yml'];

  test('the follow-up step is not gated on the verdict', () => {
    for (const f of JOBS) {
      const step = stepsOf(yml(f)).find(s => /^name: .*File follow-ups/.test(s));
      assert.ok(step, `${f} has no "File follow-ups" step`);
      const cond = /\n        if: (.*)/.exec(step);
      assert.ok(cond, `${f}: the follow-up step has no if:`);
      assert.equal(cond[1].trim(), '${{ !cancelled() }}');
      assert.doesNotMatch(cond[1], /verdict|conclusion|success\(|failure\(/, `${f}: the follow-up step is gated on the verdict`);
    }
    assert.match(yml('agent-code-review.yml'), /\n      issues: write\b/, 'code review cannot file an issue without issues: write');
  });

  test('every step that can reach gh pins the repository', () => {
    for (const f of JOBS) {
      for (const step of stepsOf(yml(f))) {
        const reaches = /\bgh (pr|issue|api|label) /.test(step) || /agent-run\.sh/.test(step);
        if (!reaches) continue;
        assert.match(step, /GH_REPO: \$\{\{ github\.repository \}\}/, `${f} → ${nameOf(step)} can reach gh unpinned`);
      }
    }
  });

  test('setup.yml creates the follow-up label the reviews file against', () => {
    const src = readFileSync(new URL('../../.github/workflows/setup.yml', import.meta.url), 'utf8');
    assert.match(src, /^\s+label follow-up\s+[0-9A-Fa-f]{6}\s/m);
  });

});

describe('review depth follows risk', () => {
  const CTXF = (files) => ({ issue: 27, title: 'x', doneWhen: ['y'], base: 'main', head: 'abc1234', files, amendments: [] });
  const clean = { confidence: 'high', covered: 'read it', findings: [] };
  const cr = (answers, args) => runner('code-review', (label) => {
    if (label === 'context') return answers.context;
    if (label.startsWith('review')) return clean;
    if (label.startsWith('skeptic')) return { refuted: false, why: 'real' };
    if (label === 'publish') return { ok: true, url: 'u' };
  })(answers, args);
  const lensesAndModel = async (files, args) => {
    const { calls, result } = await cr({ context: CTXF(files) }, args);
    return { lenses: calls.filter(c => c.startsWith('review:')), result };
  };

  test('a small app change on balanced gets one combined reviewer', async () => {
    const { lenses } = await lensesAndModel(['src/components/A.jsx'], '42 --depth=balanced --lines=40');
    assert.deepEqual(lenses, ['review:combined']);
  });

  test('a large app change on balanced gets the full lenses', async () => {
    const { lenses } = await lensesAndModel(['src/components/A.jsx'], '42 --depth=balanced --lines=400');
    assert.ok(lenses.length >= 3);
  });

  test('a pull request ship built gets the light review — its loop already audited it', async () => {
    const { lenses } = await lensesAndModel(['src/components/A.jsx'], '42 --lines=400 --shipped=yes');
    assert.deepEqual(lenses, ['review:combined']);
  });

  test('the harness and the server rules always get the full review, even on fast', async () => {
    assert.ok((await lensesAndModel(['.github/workflows/agent-qa.yml'], '42 --depth=fast --lines=5')).lenses.includes('review:actions'));
    assert.ok((await lensesAndModel(['server/lib/seats.js'], '42 --depth=fast --lines=5')).lenses.length > 1);
  });

  test('thorough reviews everything in full, docs included', async () => {
    const { lenses } = await lensesAndModel(['docs/context/ui.md'], '42 --depth=thorough --docs-only=yes');
    assert.ok(lenses.includes('review:docs'));
  });

  test('the size the job computed decides: tiny and small get one reviewer, large the lenses', async () => {
    assert.deepEqual((await lensesAndModel(['server/lib/seats.js'], '42 --size=tiny')).lenses, ['review:combined']);
    assert.ok((await lensesAndModel(['src/components/A.jsx'], '42 --size=large')).lenses.length >= 3);
  });

  test('with no facts from the job it reviews in full, as before', async () => {
    const { lenses } = await lensesAndModel(['src/components/A.jsx'], '42');
    assert.ok(lenses.length >= 3);
  });

  const qa = runner('qa', (label) => {
    if (label === 'scope') return { head: 'abc1234', files: ['docs/context/ui.md'] };
    if (label === 'plan') return { issue: 27, base: 'main', surface: true, probes: [] };
    if (label === 'publish') return { ok: true };
  });

  test('QA skips a docs-only change, and says so', async () => {
    const { result, calls } = await qa({}, '42 --no-publish --docs-only=yes');
    assert.equal(result.verdict, 'pass');
    assert.match(result.comment, /docs-only change/);
    assert.ok(!calls.includes('plan'));
  });

  test('QA on thorough explores a docs-only change anyway', async () => {
    const { calls } = await qa({}, '42 --no-publish --docs-only=yes --depth=thorough');
    assert.ok(calls.includes('plan'));
  });
});
