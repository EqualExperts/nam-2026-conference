import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dependsOn, isDone, inFlight, stackFor } from '../../scripts/depends.mjs';

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

test('a dependency being built is found by its open PR, else its issue branch', () => {
  const prs = [{ number: 8, headRefName: 'issue-2-suggested-talks', body: 'Closes #2' }, { number: 9, headRefName: 'feat/x', body: 'Refs #5\n' }];
  assert.deepEqual(inFlight(2, prs, []), { branch: 'issue-2-suggested-talks', pr: 8 });
  assert.deepEqual(inFlight(5, prs, []), { branch: 'feat/x', pr: 9 });
  // No PR yet: setup has pushed the spec, so the branch is on origin.
  assert.deepEqual(inFlight(3, prs, ['main', 'issue-3-talks-giving']), { branch: 'issue-3-talks-giving', pr: null });
  // issue-1- is not issue-12-.
  assert.equal(inFlight(1, [], ['issue-12-x']), null);
});

test('only one unmet dependency that is being built can be stacked on', () => {
  assert.deepEqual(stackFor([{ n: 2, branch: 'issue-2-a', pr: 8, title: 't' }]), { n: 2, branch: 'issue-2-a', pr: 8 });
  assert.equal(stackFor([{ n: 2, branch: null, pr: null }]), null);
  assert.equal(stackFor([{ n: 2, branch: 'a', pr: 1 }, { n: 3, branch: 'b', pr: 2 }]), null);
  assert.equal(stackFor([]), null);
});
