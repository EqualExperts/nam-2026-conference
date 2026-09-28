import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fromStream, line, ledgerBody, parseLedger, priced, runComment, total, tokens } from '../../scripts/ai-cost.mjs';

// The shape `claude -p --output-format stream-json` ends with, from a real run.
const RESULT = {
  type: 'result',
  modelUsage: {
    'claude-haiku-4-5-20251001': { inputTokens: 10, outputTokens: 50, cacheReadInputTokens: 13689, cacheCreationInputTokens: 11147, costUSD: 0.0239229 },
    'claude-sonnet-5': { inputTokens: 100, outputTokens: 2000, cacheReadInputTokens: 1_000_000, cacheCreationInputTokens: 100_000 },
  },
};
const stream = [JSON.stringify({ type: 'system' }), 'not json', JSON.stringify(RESULT)].join('\n');

describe('ai-cost', () => {
  test('a CI stream is priced as billed, and a model without a cost is priced by the rates', () => {
    const u = fromStream(stream);
    assert.equal(u.models['claude-haiku-4-5-20251001'].cost, 0.0239229);
    assert.ok(Math.abs(u.models['claude-sonnet-5'].cost - priced('claude-sonnet-5', { in: 100, out: 2000, read: 1_000_000, write: 100_000 })) < 1e-9);
    assert.equal(u.estimated, false);
  });

  test('the rates reproduce what the CLI billed for the sample run', () => {
    const cost = priced('claude-haiku-4-5', { in: 10, out: 50, read: 13689, write: 11147 });
    assert.ok(Math.abs(cost - 0.0239229) < 0.0001, `${cost}`);
  });

  test('a line says tokens, where they went and the cost, and marks an estimate', () => {
    const u = fromStream(stream);
    assert.equal(tokens(total(u)), 10 + 50 + 13689 + 11147 + 100 + 2000 + 1_000_000 + 100_000);
    assert.match(line(u), /^1\.1M tokens \(1\.0M cached reads · 111k cache writes · 2k output\) · \$\d/);
    assert.match(line({ ...u, estimated: true }), / · ~\$/);
  });

  test('the ledger round-trips through the comment and totals every run', () => {
    const rows = [
      { kind: 'ship', run: 'https://x/1', tokens: 5_000_000, cost: 4.03, models: { sonnet: 3.85, haiku: 0.18 }, estimated: true },
      { kind: 'code review', run: 'https://x/2', pr: 71, tokens: 1_200_000, cost: 0.9, models: { opus: 0.9 }, estimated: false },
    ];
    const body = ledgerBody(rows);
    assert.deepEqual(parseLedger(body), rows);
    assert.match(body, /AI spend on this ticket: 6\.2M tokens · ~\$4\.93/);
    assert.match(body, /\[code review\]\(https:\/\/x\/2\) · #71/);
    assert.match(body, /\| \*\*Total\*\* \| \*\*6\.2M\*\* \| \*\*~\$0\.90\*\* \| \*\*~\$3\.85\*\* \| \*\*~\$0\.18\*\* \|/);
    assert.doesNotMatch(body, /@claude/, 'a comment naming @claude starts a ship run');
    assert.deepEqual(parseLedger('no ledger here'), []);
  });

  test('claude-code-action\'s execution file — one JSON array — reads the same', () => {
    assert.equal(fromStream(JSON.stringify([{ type: 'system' }, RESULT])).models['claude-haiku-4-5-20251001'].cost, 0.0239229);
  });

  test('a run comment leads with the cost and splits it by model in a table', () => {
    const c = runComment('ship', fromStream(stream), 'https://x/9');
    assert.match(c, /^### 🧾 ship: \$\d+\.\d\d · 1\.1M tokens/);
    assert.match(c, /\| Opus \| Sonnet \| Haiku \| Total \|/);
    assert.match(c, /\| — \| \$\d+\.\d\d \| \$0\.02 \| \*\*\$/);
    assert.match(c, /<sub>.*\[run\]\(https:\/\/x\/9\)<\/sub>/);
    assert.doesNotMatch(c, /@claude/);
  });

  test('a stream with no result records nothing rather than a zero row', () => {
    assert.equal(tokens(total(fromStream('{"type":"system"}'))), 0);
  });
});
