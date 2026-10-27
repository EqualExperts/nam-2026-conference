import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/**
 * What the seed promises the app, checked on the seeded database itself.
 *
 * An attendee chooses interests from the topic tags, so a seeded interest
 * that is not one can never be shown — and a save from the picker drops it.
 * Kenji's `Edge`, a tech tag, did exactly that on #219.
 */

let api;
let close;

before(async () => { ({ api, close } = await startApi()); });
after(() => close());

describe('Seeded attendees', () => {
  test('every interest is a topic tag', async () => {
    const { users, tags } = await api.json('/bootstrap');
    const topics = new Set(tags.filter((t) => t.kind === 'topic').map((t) => t.name));
    assert.ok(topics.size > 0 && users.some((u) => u.interests.length), 'the seed has topics and interests to check');
    const strays = users.flatMap((u) => u.interests.filter((i) => !topics.has(i)).map((i) => `${u.name}: ${i}`));
    assert.deepEqual(strays, []);
  });
});
