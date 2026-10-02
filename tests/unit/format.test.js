import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { time, timeRange, dayLabel, shortDay, relativeDate, plural, agendaSummary, seatActionLabel } from '../../src/lib/format.js';

describe('Clock times read as people say them', () => {
  test('midnight and noon are twelve, not zero', () => {
    assert.equal(time('00:00'), '12:00 AM');
    assert.equal(time('12:00'), '12:00 PM');
  });

  test('the hour flips to PM at noon and back at midnight', () => {
    assert.equal(time('11:59'), '11:59 AM');
    assert.equal(time('12:01'), '12:01 PM');
    assert.equal(time('23:59'), '11:59 PM');
    assert.equal(time('00:15'), '12:15 AM');
  });

  test('minutes keep their leading zero', () => {
    assert.equal(time('09:05'), '9:05 AM');
  });

  test('a range joins both ends with an en dash', () => {
    assert.equal(timeRange('09:00', '10:30'), '9:00 AM – 10:30 AM');
    assert.equal(timeRange('11:30', '12:15'), '11:30 AM – 12:15 PM');
  });
});

describe('Conference dates are read as dates, never as the machine sees them', () => {
  test('a day gets its weekday and date', () => {
    assert.equal(dayLabel('2026-10-12'), 'Monday, Oct 12');
    assert.equal(shortDay('2026-10-12'), 'Mon');
  });

  test('the same date reads the same whatever timezone the machine is in', () => {
    const tz = process.env.TZ;
    try {
      for (const zone of ['Pacific/Kiritimati', 'Pacific/Niue', 'UTC', 'America/Denver']) {
        process.env.TZ = zone;
        assert.equal(dayLabel('2026-10-12'), 'Monday, Oct 12', zone);
        assert.equal(shortDay('2026-10-15'), 'Thu', zone);
      }
    } finally {
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });
});

describe('"How long ago" is measured against the conference clock', () => {
  const clock = { day: '2026-10-13', time: '14:30' };

  test('something in the last hour is counted in minutes', () => {
    assert.equal(relativeDate('2026-10-13T14:18:00Z', clock), '12m ago');
    assert.equal(relativeDate('2026-10-13T13:31:00Z', clock), '59m ago');
  });

  test('an hour or more is counted in hours', () => {
    assert.equal(relativeDate('2026-10-13T13:30:00Z', clock), '1h ago');
    assert.equal(relativeDate('2026-10-13T11:30:00Z', clock), '3h ago');
  });

  test('anything older than a day falls back to the date itself', () => {
    assert.equal(relativeDate('2026-10-11T09:00:00Z', clock), 'Oct 11');
  });

  test('it reads the clock it was given, not the wall clock', () => {
    const iso = '2026-10-13T12:30:00Z';
    assert.equal(relativeDate(iso, { day: '2026-10-13', time: '12:42' }), '12m ago');
    assert.equal(relativeDate(iso, { day: '2026-10-13', time: '16:30' }), '4h ago');
    assert.equal(relativeDate(iso, { day: '2026-10-15', time: '09:00' }), 'Oct 13');
  });

  test('a timestamp the clock has not reached yet clamps to a minute rather than going negative', () => {
    assert.equal(relativeDate('2026-10-13T14:30:00Z', clock), '1m ago');
    assert.equal(relativeDate('2026-10-13T15:30:00Z', clock), '1m ago');
  });
});

describe('Counts are pluralised', () => {
  test('one of a thing keeps the singular', () => {
    assert.equal(plural(1, 'session'), '1 session');
  });

  test('none and many both take the plural', () => {
    assert.equal(plural(0, 'session'), '0 sessions');
    assert.equal(plural(12, 'session'), '12 sessions');
  });

  test('an irregular plural can be given outright', () => {
    assert.equal(plural(1, 'person', 'people'), '1 person');
    assert.equal(plural(3, 'person', 'people'), '3 people');
  });

  test('a seat count reads singular at one, plural otherwise', () => {
    assert.equal(plural(1, 'seat'), '1 seat');
    assert.equal(plural(3, 'seat'), '3 seats');
  });

  test('a followed-speaker count reads singular at one, plural otherwise', () => {
    assert.equal(plural(1, 'speaker'), '1 speaker');
    assert.equal(plural(4, 'speaker'), '4 speakers');
  });

  test('a count over a thousand keeps its thousands separator', () => {
    assert.equal(plural(1098, 'seat'), '1,098 seats');
  });
});

describe('The schedule rail\'s agenda line pluralises on the total and names the day it is given', () => {
  test('exactly one reservation reads singular', () => {
    assert.equal(agendaSummary(1, 2, 'today'), 'session · 2 today');
  });

  test('any other total reads plural', () => {
    assert.equal(agendaSummary(3, 2, 'today'), 'sessions · 2 today');
    assert.equal(agendaSummary(0, 0, 'today'), 'sessions · 0 today');
  });

  test('a day other than the clock\'s is named instead of assumed to be today', () => {
    assert.equal(agendaSummary(3, 2, 'on Day 1'), 'sessions · 2 on Day 1');
  });
});

describe('The seat button says what pressing it will do', () => {
  test('an empty seat offers the seat, a full room offers the queue', () => {
    assert.equal(seatActionLabel({ status: null }), 'Add to my agenda');
    assert.equal(seatActionLabel({ status: null, full: true }), 'Join the waitlist');
  });

  test('what you hold, you can give back', () => {
    assert.equal(seatActionLabel({ status: 'confirmed' }), 'Remove from my agenda');
    assert.equal(seatActionLabel({ status: 'waitlisted' }), 'Leave the waitlist');
  });

  test('a session that is over offers nothing', () => {
    assert.equal(seatActionLabel({ status: null, ended: true }), 'Session ended');
  });

  test('a seat you hold can still be given back after the session ends, and when the room is full', () => {
    assert.equal(seatActionLabel({ status: 'confirmed', ended: true, full: true }), 'Remove from my agenda');
    assert.equal(seatActionLabel({ status: 'waitlisted', ended: true, full: true }), 'Leave the waitlist');
  });

  test('an ended session is over whether or not it sold out', () => {
    assert.equal(seatActionLabel({ status: null, ended: true, full: true }), 'Session ended');
  });
});
