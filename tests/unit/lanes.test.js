import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { LANES, ATTENDEES } from '../helpers.js';

// Both projects and every test within them run at once, so two lane panes on
// the same attendee and day race each other. #64 added one that reused
// another lane's pair and failed ~1 run in 6 — only under concurrency, after
// the gate had passed it. This makes the table's rule a check, not a comment.
// `agenda: false` marks a pane that books nothing — it writes check-ins or
// ratings only — so it cannot race a pane on the agenda and seat counters, but
// can race another such pane on the same attendee's attendance.
test('no two lane panes share an attendee and day, unless one is read-only, they write different things, or both pin different slots', () => {
  const panes = Object.entries(LANES).flatMap(([name, lane]) =>
    Object.entries(lane).map(([project, p]) => ({ at: `${name} (${project})`, ...p })));
  const clashes = [];
  for (let i = 0; i < panes.length; i++) {
    for (let j = i + 1; j < panes.length; j++) {
      const [a, b] = [panes[i], panes[j]];
      if (a.user !== b.user || a.day !== b.day) continue;
      if (a.readOnly || b.readOnly) continue;
      if ((a.agenda === false) !== (b.agenda === false)) continue;
      if (a.slot && b.slot && a.slot !== b.slot) continue;
      clashes.push(`${a.at} and ${b.at}: attendee ${a.user}, day ${a.day}`);
    }
  }
  assert.deepEqual(clashes, [], 'pick a pair no other pane holds, or pin distinct slots');
});

// A comment told agents never to queue Jonas — plan.spec.js reads him as the
// attendee on no waitlist, on every day — and a lane added for #101 queued
// him anyway; code review caught it, the gate did not. A test that queues is
// one whose body says "waitlist"; none of them may hold Jonas.
test('no lane that joins a waitlist uses Jonas, the attendee read as on no waitlist', () => {
  const dir = new URL('..', import.meta.url);
  const queuing = new Set();
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.spec.js'))) {
    for (const body of readFileSync(new URL(f, dir), 'utf8').split(/\n\s*test\(/)) {
      if (!/waitlist/i.test(body)) continue;
      for (const [, name] of body.matchAll(/laneFor\('([^']+)'/g)) queuing.add(name);
    }
  }
  const onJonas = [...queuing].flatMap((name) => Object.entries(LANES[name] || {})
    .filter(([, p]) => p.user === ATTENDEES.jonas).map(([project]) => `${name} (${project})`));
  assert.deepEqual(onJonas, [], 'a lane that queues for a full room needs an attendee other than Jonas');
});
