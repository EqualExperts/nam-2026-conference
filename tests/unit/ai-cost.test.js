import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fromStream, fromTranscripts, line, ledgerBody, parseLedger, priced, runComment, total, tokens } from '../../scripts/ai-cost.mjs';
const require = createRequire(import.meta.url);

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

  test('a 5-minute cache write is priced at 1.25x input, a 1-hour one at 2x', () => {
    const u = { in: 0, out: 0, read: 0, write: 1_000_000 };
    assert.equal(priced('claude-sonnet-5', u), 6);
    assert.equal(priced('claude-sonnet-5', { ...u, write5m: 1_000_000 }), 3.75);
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

  test('5-minute writes survive being summed across messages — #70 read \$7.15 for \$5.58', () => {
    const { mkdtempSync, writeFileSync } = require('node:fs');
    const dir = mkdtempSync(require('node:path').join(require('node:os').tmpdir(), 'ai-cost-'));
    const msg = (id) => JSON.stringify({ type: 'assistant', message: { id, model: 'claude-sonnet-5', usage: {
      input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 1_000_000,
      cache_creation: { ephemeral_5m_input_tokens: 1_000_000 } } } });
    writeFileSync(`${dir}/agent-a.jsonl`, [msg('m1'), msg('m2')].join('\n'));
    writeFileSync(`${dir}/agent-a.meta.json`, JSON.stringify({ model: 'sonnet', workflowPhase: '▸ ship #2' }));
    assert.equal(total(fromTranscripts(dir)).cost, 7.5);
    assert.equal(tokens(total(fromTranscripts(dir, '▸ ship'))), 0, 'a phase matches exactly, not by prefix');
  });

  test('a stream with no result records nothing rather than a zero row', () => {
    assert.equal(tokens(total(fromStream('{"type":"system"}'))), 0);
  });
});
