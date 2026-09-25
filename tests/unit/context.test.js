import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { frontMatter, load, docsFor, problems, unowned, tracked } from '../../scripts/context.mjs';

/**
 * The context docs are what an agent reads instead of the source, so a doc
 * that points at a file which has moved is worse than no doc: it sends the
 * next agent somewhere that is not there. The last test here is the one that
 * keeps them honest — it runs against the real docs on every `npm test`.
 */

describe('front matter', () => {
  test('reads scalars, block lists and flow lists', () => {
    const meta = frontMatter(`---
area: seats
summary: "Reserve, release, waitlist"
files:
  - server/lib/seats.js
  - src/components/SeatPanel.jsx   # the panel
related: [attendance, agenda]
---
# Seats`);
    assert.deepEqual(meta, {
      area: 'seats',
      summary: 'Reserve, release, waitlist',
      files: ['server/lib/seats.js', 'src/components/SeatPanel.jsx'],
      related: ['attendance', 'agenda'],
    });
  });

  test('a file without front matter reads as null, not as empty', () => {
    assert.equal(frontMatter('# Just a heading'), null);
  });

  test('a line it cannot read is an error, not silently dropped', () => {
    assert.throws(() => frontMatter('---\nNot A Key\n---'), /cannot read/);
  });
});

describe('which docs a change touches', () => {
  const docs = [
    { area: 'seats', files: ['server/lib/seats.js'], tests: ['tests/api/seats.test.js'] },
    { area: 'ui', files: ['src/components/'], tests: [] },
  ];

  test('an exact file, a test, and a file inside an owned directory', () => {
    assert.deepEqual(docsFor(docs, ['server/lib/seats.js']).map(d => d.area), ['seats']);
    assert.deepEqual(docsFor(docs, ['tests/api/seats.test.js']).map(d => d.area), ['seats']);
    assert.deepEqual(docsFor(docs, ['src/components/Icon.jsx']).map(d => d.area), ['ui']);
  });

  test('a prefix that is not a directory entry does not match', () => {
    assert.deepEqual(docsFor(docs, ['server/lib/seats.jsx']), []);
  });
});

test('every real context doc names only paths and areas that exist', () => {
  const docs = load();
  assert.ok(docs.length > 0, 'docs/context has no docs');
  assert.deepEqual(problems(docs), []);
});

test('every tracked source file is owned by a doc, so a change to it reaches one', () => {
  assert.deepEqual(unowned(load(), tracked()), []);
});

test('an unowned file is reported; one outside the owned trees is not', () => {
  const docs = [{ files: ['src/'], tests: [] }];
  assert.deepEqual(unowned(docs, ['src/a.js', 'server/b.js', 'README.md']), ['server/b.js']);
});
