import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = 'context/winnow-transcripts/index.md';
const index = () => readFileSync(INDEX, 'utf8');
const FIELDS = [
  'Title',
  'Date',
  'Participants',
  'Source',
  'Tickets raised',
  'Context updated',
  'Set aside',
  'Q&A',
];

test('the index names the record file pattern and each of the eight fields', () => {
  const text = index();
  assert.ok(text.includes('YYYY-MM-DD-<title>.md'));
  for (const field of FIELDS) assert.ok(text.includes(`**${field}**`), `field ${field} missing`);
});

test('the index says a field Winnow cannot determine reads "Unknown"', () => {
  assert.match(index(), /reads? "Unknown"/);
});

test('no planned wording, and the demo transcript is still listed', () => {
  assert.doesNotMatch(index(), /planned|soon|once winnow writes/i);
  assert.ok(index().includes('demo-transcript.txt'));
  const rows = readFileSync('context/index.md', 'utf8')
    .split('\n')
    .filter((l) => l.includes('winnow-transcripts'));
  assert.ok(rows.length >= 1);
  for (const row of rows) assert.doesNotMatch(row, /planned|soon|once winnow writes/i);
});
