import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/**
 * Choosing interests: PUT /users/:id/interests replaces the whole selection
 * with known topic tags (by name, the form users.interests holds).
 */

const ME = 3;

let api;
let close;
let topics;
let nonTopic;

before(async () => {
  ({ api, close } = await startApi());
  const tags = (await api.json('/bootstrap')).tags;
  topics = tags.filter((t) => t.kind === 'topic').map((t) => t.name);
  nonTopic = tags.find((t) => t.kind !== 'topic');
});
after(() => close());

const interestsOf = async (id = ME) => (await api.json(`/users/${id}`)).interests;

describe('PUT /users/:id/interests', () => {
  test('saves a selection, and GET /users/:id returns it', async () => {
    const pick = topics.slice(0, 3);
    const res = await api.put(`/users/${ME}/interests`, { interests: pick });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.interests, pick);
    assert.deepEqual(await interestsOf(), pick);
  });

  test('deselecting one topic removes only that topic', async () => {
    const pick = topics.slice(0, 4);
    await api.put(`/users/${ME}/interests`, { interests: pick });
    const rest = pick.filter((t) => t !== pick[1]);
    const res = await api.put(`/users/${ME}/interests`, { interests: rest });
    assert.equal(res.status, 200);
    assert.deepEqual(await interestsOf(), rest);
  });

  test('saving with none selected leaves interests empty', async () => {
    await api.put(`/users/${ME}/interests`, { interests: topics.slice(0, 2) });
    const res = await api.put(`/users/${ME}/interests`, { interests: [] });
    assert.equal(res.status, 200);
    assert.deepEqual(await interestsOf(), []);
  });

  test('duplicates are collapsed', async () => {
    const res = await api.put(`/users/${ME}/interests`, { interests: [topics[0], topics[0], topics[1]] });
    assert.equal(res.status, 200);
    assert.deepEqual(await interestsOf(), [topics[0], topics[1]]);
  });

  test('400 for an unknown topic, and the row is untouched', async () => {
    const keep = topics.slice(0, 2);
    await api.put(`/users/${ME}/interests`, { interests: keep });
    const res = await api.put(`/users/${ME}/interests`, { interests: [topics[2], 'Not A Topic'] });
    assert.equal(res.status, 400);
    assert.deepEqual(await interestsOf(), keep);
  });

  test('400 for a tag that is not a topic', async () => {
    assert.ok(nonTopic, 'the seed has a non-topic tag');
    const before = await interestsOf();
    const res = await api.put(`/users/${ME}/interests`, { interests: [nonTopic.name] });
    assert.equal(res.status, 400);
    assert.deepEqual(await interestsOf(), before);
  });

  test('400 when interests is not an array', async () => {
    assert.equal((await api.put(`/users/${ME}/interests`, { interests: topics[0] })).status, 400);
    assert.equal((await api.put(`/users/${ME}/interests`, {})).status, 400);
  });

  test('404 for an unknown attendee', async () => {
    assert.equal((await api.put('/users/99999/interests', { interests: [] })).status, 404);
  });
});
