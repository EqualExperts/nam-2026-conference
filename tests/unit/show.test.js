import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { pick, worktrees } from '../../scripts/show.mjs';

/**
 * `npm run show` has to land on the branch being worked on, never on
 * whatever the main checkout is on — that is the bug it exists for.
 */
describe('which checkout npm run show serves', () => {
  const trees = worktrees(`worktree /r
HEAD aaa
branch refs/heads/deck/flow-and-lab

worktree /r/.claude/worktrees/wt-219
HEAD bbb
branch refs/heads/issue-219-choose-interests

worktree /r/.claude/worktrees/wt-review
HEAD ccc
detached
`);
  const branches = ['deck/flow-and-lab', 'issue-219-choose-interests', 'issue-42-multi-track', 'harness/workshop-fast'];

  test('reads every worktree and its branch; a detached one has none', () => {
    assert.deepEqual(trees.map(w => w.branch), ['deck/flow-and-lab', 'issue-219-choose-interests', null]);
  });

  test("a ticket number is that ticket's worktree, not the main checkout", () => {
    assert.equal(pick('219', { trees, branches }).tree.path, '/r/.claude/worktrees/wt-219');
    assert.equal(pick('#219', { trees, branches }).tree.path, '/r/.claude/worktrees/wt-219');
  });

  test('a ticket with a branch but no worktree yet gets one made', () => {
    assert.deepEqual(pick('42', { trees, branches }), { branch: 'issue-42-multi-track' });
  });

  test("failing both, the number is a pull request — its branch, in whichever worktree has it", () => {
    assert.equal(pick('226', { trees, branches, prBranch: () => 'issue-219-choose-interests' }).tree.path, '/r/.claude/worktrees/wt-219');
    assert.deepEqual(pick('220', { trees, branches, prBranch: () => 'harness/workshop-fast' }), { branch: 'harness/workshop-fast' });
  });

  test('a branch by name; anything unknown is an error, never a guess', () => {
    assert.equal(pick('deck/flow-and-lab', { trees, branches }).tree.path, '/r');
    assert.match(pick('999', { trees, branches }).error, /nothing found for 999/);
    assert.match(pick('nope', { trees, branches }).error, /no branch named nope/);
  });
});
