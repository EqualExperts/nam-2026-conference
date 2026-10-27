import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** PUT /api/users/:id/interests replaces an attendee's interests with known topic tags. */

const ME = 2;

let api;
let close;
let topics;

before(async () => {
  ({ api, close } = await startApi());
  topics = (await api.json('/bootstrap')).tags.filter((t) => t.kind === 'topic').map((t) => t.name);
});
after(() => close());

const interestsOf = async (id) => (await api.json(`/users/${id}`)).interests;

describe('PUT /users/:id/interests', () => {
  test('a valid save is returned by GET and replaces the old list', async () => {
    const pick = topics.slice(0, 3);
    const res = await api.put(`/users/${ME}/interests`, { interests: pick });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.interests, pick);
    assert.deepEqual(await interestsOf(ME), pick);
  });

  test('deselecting one topic removes only that topic', async () => {
    const pick = topics.slice(0, 3);
    await api.put(`/users/${ME}/interests`, { interests: pick });
    await api.put(`/users/${ME}/interests`, { interests: pick.slice(1) });
    assert.deepEqual(await interestsOf(ME), pick.slice(1));
  });

  test('saving none leaves interests empty', async () => {
    await api.put(`/users/${ME}/interests`, { interests: topics.slice(0, 2) });
    const res = await api.put(`/users/${ME}/interests`, { interests: [] });
    assert.equal(res.status, 200);
    assert.deepEqual(await interestsOf(ME), []);
  });

  test('a topic that is not a known topic tag is a 400 and writes nothing', async () => {
    const pick = topics.slice(0, 2);
    await api.put(`/users/${ME}/interests`, { interests: pick });
    const res = await api.put(`/users/${ME}/interests`, { interests: [topics[3], 'Not A Topic'] });
    assert.equal(res.status, 400);
    assert.deepEqual(await interestsOf(ME), pick);
  });

  test('a tag of another kind, or a non-array body, is a 400', async () => {
    const tech = (await api.json('/bootstrap')).tags.find((t) => t.kind !== 'topic');
    assert.equal((await api.put(`/users/${ME}/interests`, { interests: [tech.name] })).status, 400);
    assert.equal((await api.put(`/users/${ME}/interests`, { interests: 'AI' })).status, 400);
  });

  test('an unknown attendee is a 404', async () => {
    assert.equal((await api.put('/users/9999/interests', { interests: [] })).status, 404);
  });
});
