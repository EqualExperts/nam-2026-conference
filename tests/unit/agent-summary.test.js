import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, markdown, workflowRuns } from '../../scripts/agent-summary.mjs';

/**
 * The shapes below are what `claude -p --output-format stream-json` printed
 * for a saved workflow: first the launcher's own result, then — only if the
 * runner waited — the workflow's.
 */
const launch = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Workflow', input: { name: 'ship' } }] } });
const result = (text, turns = 2) => JSON.stringify({ type: 'result', is_error: false, num_turns: turns, duration_ms: 3000, total_cost_usd: 0.13, result: text });

test('a workflow launched and never heard from again is a failure, however green it looked', () => {
  const s = summarise([launch, result('Ship is running in the background — I will let you know.')]);
  assert.equal(s.waited, false);
  assert.equal(s.ok, false);
  assert.match(markdown(s, '/ship 34'), /never came back/);
});

test('a workflow whose completion came back is a success, and its summary is the final message', () => {
  const s = summarise([launch, result('launched'), result('Shipped PR #40.', 1)]);
  assert.equal(s.ok, true);
  assert.deepEqual(s.launched, ['ship']);
  assert.equal(s.turns, 3);
  assert.equal(s.final, 'Shipped PR #40.');
});

test('a run that launched nothing is judged on its one result', () => {
  assert.equal(summarise([result('done')]).ok, true);
  assert.equal(summarise([JSON.stringify({ type: 'result', is_error: true, result: 'x' })]).ok, false);
});

test('no transcript at all is a failure', () => {
  assert.equal(summarise([]).ok, false);
});

test('a finished workflow’s return value and agent states come from its task output file', () => {
  const note = JSON.stringify({ type: 'system', subtype: 'task_notification', status: 'completed', summary: 'qa', output_file: '/x' });
  const file = { result: { verdictLine: 'PASS high 4/4', comment: '> [!TIP]' }, workflowProgress: [
    { type: 'workflow_phase', title: 'Plan' },
    { type: 'workflow_agent', label: 'plan', state: 'done', phaseTitle: 'Plan' },
    { type: 'workflow_agent', label: 'publish', state: 'error', phaseTitle: 'Publish' },
  ] };
  const s = summarise([launch, result('launched'), note, result('done', 1)], () => file);
  assert.equal(s.runs[0].result.verdictLine, 'PASS high 4/4');
  assert.match(markdown(s, '/qa 35'), /\| publish \| Publish \| \*\*error\*\* \|/);
});

test('a missing output file is reported, not thrown', () => {
  const note = { type: 'system', subtype: 'task_notification', status: 'completed', output_file: '/gone' };
  assert.deepEqual(workflowRuns([note], () => { throw new Error('ENOENT'); }), [{ status: 'completed', summary: undefined, result: null, agents: [] }]);
});
