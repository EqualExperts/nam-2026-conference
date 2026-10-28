import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dependsOn, isDone } from '../../scripts/depends.mjs';

/**
 * Ship reads a ticket's "Depends on" line before it claims it. One run of a
 * dependent ticket started building on a main without its dependency,
 * because only an agent's reading stood between it and the line.
 */
test('reads the issues on the Depends on line, as create-tasks writes it', () => {
  assert.deepEqual(dependsOn('Some text about #9.\n\n**Depends on:** #1 (attendees choose their topic interests), which supplies the interests.\n'), [1]);
  assert.deepEqual(dependsOn('Depends on: #3 and #4'), [3, 4]);
  assert.deepEqual(dependsOn('- **Depends on:** #12'), [12]);
});

test('an issue number anywhere else is not a dependency', () => {
  assert.deepEqual(dependsOn('See #7 for the design.\nCloses #8'), []);
  assert.deepEqual(dependsOn(''), []);
});

test('done means closed as completed, not closed as not planned', () => {
  assert.equal(isDone({ state: 'CLOSED', stateReason: 'COMPLETED' }), true);
  assert.equal(isDone({ state: 'OPEN', stateReason: null }), false);
  assert.equal(isDone({ state: 'CLOSED', stateReason: 'NOT_PLANNED' }), false);
});
