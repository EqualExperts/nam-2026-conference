import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** PUT /api/users/:id/interests — an attendee chooses topics; only topic tags are accepted. */

const ME = 3;

let api;
let close;
let topics;
let notTopic;

before(async () => {
  ({ api, close } = await startApi());
  const { tags } = await api.json('/bootstrap');
  topics = tags.filter((t) => t.kind === 'topic').map((t) => t.name);
  notTopic = tags.find((t) => t.kind !== 'topic').name;
});
after(() => close());

const interestsOf = async () => (await api.json(`/users/${ME}`)).interests;

describe('PUT /users/:id/interests', () => {
  test('a valid save is returned by GET /users/:id', async () => {
    const chosen = [topics[0], topics[2]];
    const res = await api.put(`/users/${ME}/interests`, { interests: chosen });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.interests, chosen);
    assert.deepEqual(await interestsOf(), chosen);
  });

  test('dropping one topic removes only that topic', async () => {
    const three = topics.slice(0, 3);
    await api.put(`/users/${ME}/interests`, { interests: three });
    await api.put(`/users/${ME}/interests`, { interests: [three[0], three[2]] });
    assert.deepEqual(await interestsOf(), [three[0], three[2]]);
  });

  test('saving none leaves interests empty', async () => {
    await api.put(`/users/${ME}/interests`, { interests: [topics[0]] });
    const res = await api.put(`/users/${ME}/interests`, { interests: [] });
    assert.equal(res.status, 200);
    assert.deepEqual(await interestsOf(), []);
  });

  test('a duplicate is stored once', async () => {
    await api.put(`/users/${ME}/interests`, { interests: [topics[1], topics[1]] });
    assert.deepEqual(await interestsOf(), [topics[1]]);
  });

  test('an unknown topic is a 400 and nothing is stored', async () => {
    await api.put(`/users/${ME}/interests`, { interests: [topics[0]] });
    const res = await api.put(`/users/${ME}/interests`, { interests: [topics[1], 'Not A Topic'] });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
    assert.deepEqual(await interestsOf(), [topics[0]]);
  });

  test('a tag that is not a topic is a 400', async () => {
    assert.equal((await api.put(`/users/${ME}/interests`, { interests: [notTopic] })).status, 400);
  });

  test('a body without an interests array is a 400', async () => {
    assert.equal((await api.put(`/users/${ME}/interests`, {})).status, 400);
    assert.equal((await api.put(`/users/${ME}/interests`, { interests: 'AI' })).status, 400);
  });

  test('an unknown attendee is a 404', async () => {
    assert.equal((await api.put('/users/999999/interests', { interests: [] })).status, 404);
  });
});
