import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creates, verdict, WORKSHOP_REPO } from '../../scripts/fork-guard.mjs';

const bash = (command) => creates({ toolName: 'Bash', command });

test('only calls that create an issue or pull request are checked', () => {
  assert.equal(bash('gh issue list'), undefined);
  assert.equal(bash('gh issue view 42'), undefined);
  assert.equal(bash('gh issue edit 42 --add-label ai-working'), undefined);
  assert.equal(bash('gh api repos/a/b/issues --jq .[].title'), undefined);
  assert.equal(bash('npm test'), undefined);
  assert.equal(creates({ toolName: 'Read', command: '' }), undefined);
});

test('a create names its repository when it says one, and null when gh will choose', () => {
  assert.equal(bash('gh issue create --title x --body y'), null);
  assert.equal(bash('gh pr create --base main --fill'), null);
  assert.equal(bash(`gh issue create -R ${WORKSHOP_REPO} --title x`), WORKSHOP_REPO);
  assert.equal(bash('gh pr create --repo me/nam-2026-conference --fill'), 'me/nam-2026-conference');
  assert.equal(bash(`gh api repos/${WORKSHOP_REPO}/issues -f title=x`), WORKSHOP_REPO);
  assert.equal(bash(`gh api -X POST repos/${WORKSHOP_REPO}/pulls --input body.json`), WORKSHOP_REPO);
});

test('a GitHub MCP create is checked by its owner and repo', () => {
  const named = creates({ toolName: 'mcp__github__create_issue', toolInput: { owner: 'EqualExperts', repo: 'nam-2026-conference' } });
  assert.equal(named, 'EqualExperts/nam-2026-conference');
  assert.equal(creates({ toolName: 'mcp__github__list_issues', toolInput: {} }), undefined);
});

test('the workshop repo is blocked for an attendee, and a fork or a maintainer is not', () => {
  assert.equal(verdict(WORKSHOP_REPO, false).ok, false);
  assert.equal(verdict(WORKSHOP_REPO.toLowerCase(), false).ok, false);
  assert.match(verdict(WORKSHOP_REPO, false).message, /your own fork/);
  assert.equal(verdict(WORKSHOP_REPO, true).ok, true);
  assert.equal(verdict('someone/nam-2026-conference', false).ok, true);
  assert.equal(verdict(null, false).ok, true);
});
