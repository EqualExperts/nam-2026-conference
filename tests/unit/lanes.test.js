import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANES } from '../helpers.js';

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
