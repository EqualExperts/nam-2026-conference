import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** PUT /users/:id/interests — an attendee's chosen topics, validated against the topic tags. */

let api;
let close;
let topics;

before(async () => {
  ({ api, close } = await startApi());
  topics = (await api.json('/bootstrap')).tags.filter((t) => t.kind === 'topic').map((t) => t.name);
});
after(() => close());

describe('PUT /users/:id/interests', () => {
  test('saves a selection that GET /users/:id then returns', async () => {
    const picked = [topics[0], topics[2]];
    const put = await api.put('/users/3/interests', { interests: picked });
    assert.equal(put.status, 200);
    assert.deepEqual(put.body.interests, picked);
    assert.deepEqual((await api.json('/users/3')).interests, picked);
  });

  test('deselecting one topic removes only that one, and none selected leaves it empty', async () => {
    const [a, b, c] = topics;
    await api.put('/users/4/interests', { interests: [a, b, c] });
    await api.put('/users/4/interests', { interests: [a, c] });
    assert.deepEqual((await api.json('/users/4')).interests, [a, c]);

    const cleared = await api.put('/users/4/interests', { interests: [] });
    assert.equal(cleared.status, 200);
    assert.deepEqual((await api.json('/users/4')).interests, []);
  });

  test('de-duplicates repeated topics', async () => {
    await api.put('/users/5/interests', { interests: [topics[1], topics[1]] });
    assert.deepEqual((await api.json('/users/5')).interests, [topics[1]]);
  });

  test('400 for a tag that is not a topic, or a bad shape, and nothing is written', async () => {
    await api.put('/users/6/interests', { interests: [topics[0]] });
    const track = (await api.json('/bootstrap')).tracks[0].name;
    for (const bad of [{ interests: [topics[0], 'Not A Tag'] }, { interests: [track] }, { interests: 'Governance' }, { interests: [42] }, {}]) {
      const res = await api.put('/users/6/interests', bad);
      assert.equal(res.status, 400, JSON.stringify(bad));
    }
    assert.deepEqual((await api.json('/users/6')).interests, [topics[0]]);
  });

  test('404 for an unknown attendee', async () => {
    assert.equal((await api.put('/users/99999/interests', { interests: [] })).status, 404);
  });
});
