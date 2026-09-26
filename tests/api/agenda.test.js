import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { clearAgenda, overlaps, startApi } from './harness.js';

/**
 * The agenda payload — `GET /api/users/:id/schedule`.
 *
 * Hours mean hours you hold a chair for, so a day's totals are split: a
 * confirmed seat counts towards `totalMinutes`, a waitlist place towards
 * `waitlistedMinutes`. My Agenda renders both from this shape, so proving the
 * split here is what stops the page and the API telling different stories.
 */

let api;
let close;

before(async () => { ({ api, close } = await startApi()); });
after(() => close());

describe('A day on the schedule', () => {
  test('counts confirmed minutes and waitlisted minutes apart', async () => {
    const user = 5;
    await clearAgenda(api, user);

    const sessions = await api.json('/sessions');
    const seat = sessions.find((s) => !s.isFull && s.seatsLeft > 2 && !s.isKeynote);
    assert.ok(seat, 'the seed should leave a session with seats to spare');
    // Not overlapping the seat: the clash guard runs before the room is found
    // full, so an overlapping sold-out session would be refused, not queued.
    const queue = sessions.find((s) => s.isFull && s.day === seat.day && !overlaps(s, seat));
    assert.ok(queue, 'the seed should sell out a session on that same day');

    const taken = await api.put(`/users/${user}/reservations/${seat.id}`, {});
    assert.equal(taken.body.status, 'confirmed');
    const queued = await api.put(`/users/${user}/reservations/${queue.id}`, {});
    assert.equal(queued.body.status, 'waitlisted');

    const { days } = await api.json(`/users/${user}/schedule`);
    const day = days.find((d) => d.date === seat.day);

    assert.equal(day.totalMinutes, seat.durationMins);
    assert.equal(day.waitlistedMinutes, queue.durationMins);

    // both still listed, each with the status it is held under
    const held = new Map(day.sessions.map((s) => [s.id, s.reservation]));
    assert.equal(held.get(seat.id), 'confirmed');
    assert.equal(held.get(queue.id), 'waitlisted');
  });
});
