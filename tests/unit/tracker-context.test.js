import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * CLAUDE.md's "Where work is tracked" section, read as text: an agent must be
 * able to answer "which tracker, and how do I talk to it" from context alone,
 * and label conventions must be linked, not restated.
 */

const root = new URL('../../', import.meta.url);
const claude = readFileSync(new URL('CLAUDE.md', root), 'utf8');
const section = () => {
  const m = claude.match(/^## Where work is tracked\n([\s\S]*?)(?=^## )/m);
  assert.ok(m, 'CLAUDE.md has a "Where work is tracked" section');
  return m[1];
};

describe('tracker access in the AI context', () => {
  test('names the tracker, the repository, the route and the read-only probe rule', () => {
    const s = section();
    assert.match(s, /GitHub Issues/);
    assert.match(s, /EqualExperts\/nam-2026-conference/);
    assert.match(s, /`gh`/);
    assert.match(s, /upstream/);
    assert.match(s, /read-only/i);
    assert.match(s, /never[^.]*creat[^.]*(ticket|issue)/i);
  });

  test('names the MCP server and REST-with-token alternatives', () => {
    const s = section();
    assert.match(s, /MCP/);
    assert.match(s, /REST/);
    assert.match(s, /token/i);
  });

  test('links the label docs instead of restating labels', () => {
    const s = section();
    assert.ok(s.includes('docs/harness/github.md'));
    assert.ok(s.includes('docs/context/harness.md'));
    for (const label of ['ai-working', 'needs-human', 'ready-for-human', 'ship:full']) {
      assert.ok(!s.includes(label), `${label} is not restated`);
    }
  });
});
