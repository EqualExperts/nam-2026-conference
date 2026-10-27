import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** Choosing interests: `PUT /api/users/:id/interests`, a throwaway database. */

let api;
let close;
let topics;
let techTag;

before(async () => {
  ({ api, close } = await startApi());
  const { tags } = await api.json('/bootstrap');
  topics = tags.filter((t) => t.kind === 'topic').map((t) => t.name);
  techTag = tags.find((t) => t.kind === 'tech').name;
});
after(() => close());

const interestsOf = async (id) => (await api.json(`/users/${id}`)).interests;

describe('PUT /users/:id/interests', () => {
  test('a valid save is returned and read back by GET', async () => {
    const pick = [topics[0], topics[3]];
    const { status, body } = await api.put('/users/1/interests', { interests: pick });
    assert.equal(status, 200);
    assert.deepEqual(body.interests, pick);
    assert.deepEqual(await interestsOf(1), pick);
  });

  test('deselecting one topic removes only that topic', async () => {
    const before = await interestsOf(2);
    assert.ok(before.length >= 2, 'seeded attendees hold two to four interests');
    const rest = before.slice(1);
    await api.put('/users/2/interests', { interests: rest });
    assert.deepEqual(await interestsOf(2), rest);
  });

  test('saving none leaves interests empty, and duplicates collapse', async () => {
    const { status } = await api.put('/users/3/interests', { interests: [] });
    assert.equal(status, 200);
    assert.deepEqual(await interestsOf(3), []);
    await api.put('/users/3/interests', { interests: [topics[1], topics[1]] });
    assert.deepEqual(await interestsOf(3), [topics[1]]);
  });

  test('a name that is not a topic tag is a 400 and changes nothing', async () => {
    const before = await interestsOf(4);
    for (const bad of [['Not A Topic'], [topics[0], techTag]]) {
      const res = await api.put('/users/4/interests', { interests: bad });
      assert.equal(res.status, 400);
    }
    for (const bad of [{}, { interests: 'Agent Design' }, { interests: [5] }]) {
      assert.equal((await api.put('/users/4/interests', bad)).status, 400);
    }
    assert.deepEqual(await interestsOf(4), before);
  });

  test('an unknown attendee is a 404', async () => {
    assert.equal((await api.put('/users/99999/interests', { interests: [] })).status, 404);
  });
});
