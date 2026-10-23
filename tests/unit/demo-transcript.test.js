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
  assert.match(header, /transcript/i);
  assert.doesNotMatch(header, /voice note|whisper/i);
  assert.ok(header.includes(`/winnow ${PATH}`));
});

test('the transcript body is the short search-filtering one, ending at 0:40', () => {
  const text = readFileSync(PATH, 'utf8');
  assert.ok(text.includes('0:02: So let\'s take a look at the website.'));
  assert.ok(text.includes('philtre'));
  assert.ok(text.trimEnd().endsWith('see the talks on those tracks that I have selected.'));
  assert.ok(!text.includes('0:47'));
  assert.ok(!text.includes('Play it again because like is rubbish'));
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

test('the quickstart links to the transcript from the product harness walkthrough', () => {
  const guide = readFileSync('docs/harness/quickstart.md', 'utf8');
  const start = guide.indexOf('## The product harness');
  const end = guide.indexOf('## The engineering harness');
  assert.ok(start > -1 && end > start);
  assert.ok(guide.slice(start, end).includes(PATH));
});
