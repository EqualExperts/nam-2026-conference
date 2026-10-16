import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PATH = 'docs/demo/winnow-transcript.txt';
const tracked = () => execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n');

test('the demo transcript exists with a header naming its source and how to use it', () => {
  assert.ok(existsSync(PATH), `${PATH} is missing`);
  const text = readFileSync(PATH, 'utf8');
  const header = text.split(/^-{3,}$/m)[0];
  assert.match(header, /voice note/i);
  assert.match(header, /whisper/i);
  assert.ok(header.includes(`/winnow ${PATH}`));
});

test('the transcript body is kept verbatim, opening chatter included', () => {
  const text = readFileSync(PATH, 'utf8');
  assert.ok(text.includes('Play it again because like is rubbish'));
  assert.ok(text.trimEnd().endsWith('Behavior depending on the order of your actions'));
});

test('the header points at no file other than the transcript itself', () => {
  const header = readFileSync(PATH, 'utf8').split(/^-{3,}$/m)[0];
  const paths = header.match(/[\w./-]+\.(?:md|txt|mjs|js|json|m4a)\b/g) ?? [];
  assert.deepEqual([...new Set(paths)], [PATH]);
});

test('the transcript is tracked and the audio is not', () => {
  const files = tracked();
  assert.ok(files.includes(PATH));
  assert.deepEqual(files.filter((f) => f.endsWith('.m4a')), []);
});

test('the README links to the transcript from the winnow section', () => {
  const readme = readFileSync('README.md', 'utf8');
  const start = readme.indexOf('product-side skills');
  const end = readme.indexOf('Set up your fork');
  assert.ok(start > -1 && end > start);
  assert.ok(readme.slice(start, end).includes(PATH));
});
