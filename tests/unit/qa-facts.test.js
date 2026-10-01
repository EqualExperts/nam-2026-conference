import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { appLines, uiOnly, totalLines, docsOnly, codeLines, risky, sizeFor, BINARY_LINES } from '../../scripts/qa-facts.mjs';

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

describe('size: how hard code review and QA work', () => {
  const size = (o) => sizeFor({ codeLines: 10, docsOnly: false, risky: false, ticket: '', depth: 'balanced', ...o });

  test('code lines leave out the spec and context docs every ship pull request carries', () => {
    assert.equal(codeLines('80\t0\tspecs/61-x.md\n6\t2\tdocs/context/agenda.md\n3\t1\tserver/routes/users.js'), 4);
    assert.equal(codeLines('1\t1\tsrc/pages/SchedulePage.jsx\n30\t0\ttests/schedule.spec.js'), 2, 'a covering test does not make a change bigger — #94');
  });

  test('a one-line fix is tiny; a thousand-line change is large', () => {
    assert.equal(size({ codeLines: 2 }), 'tiny');
    assert.equal(size({ codeLines: 120 }), 'small');
    assert.equal(size({ codeLines: 1000 }), 'large');
  });

  test('a ticket ship sized full is never tiny, and large once it is more than small', () => {
    assert.equal(size({ codeLines: 2, ticket: 'full' }), 'small');
    assert.equal(size({ codeLines: 200, ticket: 'full' }), 'large');
  });

  test('risk means never tiny, and large sooner: the seat rules and the harness', () => {
    assert.ok(risky('server/lib/seats.js'));
    assert.ok(risky('.claude/workflows/ship.js'));
    assert.ok(!risky('src/pages/HomePage.jsx\nserver/routes/users.js'));
    assert.equal(size({ codeLines: 2, risky: true }), 'small');
    assert.equal(size({ codeLines: 73, risky: true }), 'small');
    assert.equal(size({ codeLines: 200, risky: true }), 'large');
  });

  test('the dial moves it a step, and thorough is always large', () => {
    assert.equal(size({ codeLines: 120, depth: 'fast' }), 'tiny');
    assert.equal(size({ codeLines: 2, depth: 'thorough' }), 'large');
    assert.equal(size({ docsOnly: true, codeLines: 0 }), 'tiny');
  });
});
