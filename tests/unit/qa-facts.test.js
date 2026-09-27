import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appLines, uiOnly, totalLines, docsOnly, BINARY_LINES } from '../../scripts/qa-facts.mjs';

/** The facts QA's triage is not allowed to take from the planner. */

test('app lines count src/ and server/ only, added plus removed', () => {
  assert.equal(appLines('3\t1\tsrc/a.jsx\n2\t2\tserver/lib/x.js\n40\t0\ttests/a.spec.js\n9\t9\tdocs/x.md'), 8);
});

test('a binary file counts as over the cap, so an image can never hide in a skip', () => {
  assert.equal(appLines('5\t0\tsrc/a.js\n-\t-\tsrc/logo.png'), 5 + BINARY_LINES);
});

test('UI-only: src plus tests, docs/context or specs', () => {
  assert.equal(uiOnly('src/a.jsx\ntests/a.spec.js\ndocs/context/ui.md\nspecs/1-x.md'), true);
});

test('not UI-only: a harness playbook, a workflow, a script, the server, or no src at all', () => {
  assert.equal(uiOnly('src/a.jsx\ndocs/harness/qa-playbook.md'), false);
  assert.equal(uiOnly('src/a.jsx\n.github/workflows/agent-qa.yml'), false);
  assert.equal(uiOnly('src/a.jsx\nscripts/gate.mjs'), false);
  assert.equal(uiOnly('src/a.jsx\nserver/lib/seats.js'), false);
  assert.equal(uiOnly('tests/a.spec.js\ndocs/context/ui.md'), false);
  assert.equal(uiOnly(''), false);
});

test('total lines count every file, a binary as over any cap', () => {
  assert.equal(totalLines('3\t1\tsrc/a.jsx\n40\t0\ttests/a.spec.js\n-\t-\tpublic/x.png'), 44 + BINARY_LINES);
});

test('docs-only: prose about the app, never the harness playbooks or CLAUDE.md', () => {
  assert.equal(docsOnly('docs/context/ui.md\nspecs/1-x.md\nREADME.md'), true);
  assert.equal(docsOnly('docs/context/ui.md\nsrc/a.jsx'), false);
  assert.equal(docsOnly('docs/harness/qa-playbook.md'), false);
  assert.equal(docsOnly('CLAUDE.md'), false);
  assert.equal(docsOnly(''), false);
});
