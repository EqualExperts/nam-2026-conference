import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCS, CHIPS } from '../../src/components/presentation/product/context-docs.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const real = (d) => d.f !== '…';
const files = DOCS.filter(real);

test('every path the context slide lists exists in the repository', () => {
  for (const p of [...files.map((d) => d.f), ...CHIPS]) {
    assert.ok(fs.existsSync(path.join(root, p)), `${p} is listed on the slide but is not in the repo`);
  }
});

test('the slide shows context/index.md and the three folders, each with a file', () => {
  assert.ok(files.some((d) => d.f === 'context/index.md'));
  for (const dir of ['product-context', 'engineering-context', 'winnow-transcripts']) {
    const prefix = `context/${dir}/`;
    assert.ok(files.some((d) => d.f === prefix), `${prefix} missing`);
    assert.ok(files.some((d) => d.f.startsWith(prefix) && !d.f.endsWith('/')), `${prefix} has no file listed`);
  }
});

test('file names carry their extension and nothing deeper than folders and files is listed', () => {
  for (const d of files.filter((x) => !x.f.endsWith('/'))) assert.match(d.f, /\.\w+$/, `${d.f} has no extension`);
  for (const d of files) assert.doesNotMatch(d.f, /^(\.claude|scripts)\//);
});

test('the mobile-specs example opens a real doc that covers mobile', () => {
  const picked = DOCS.filter((d) => d.pick);
  assert.equal(picked.length, 1);
  assert.equal(picked[0].f, 'context/engineering-context/testing.md');
  assert.match(fs.readFileSync(path.join(root, picked[0].f), 'utf8'), /mobile/i);
});
