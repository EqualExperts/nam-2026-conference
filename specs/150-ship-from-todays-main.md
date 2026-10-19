# Ship from today's main: fetch before branching and merge the base before every gate

## What this changes
Two `/ship` runs going at once used to both start from the same `main`, and
neither saw the other land. Merge the first PR, and the second opened already
behind and conflicting. Now a run starts from a freshly fetched base, merges
today's base before every gate, so the gate tests the branch *with* whatever
landed meanwhile, and merges once more before it pushes the PR. A conflict is
resolved by the fixer like any other finding. If one turns up at the very end,
the ticket goes back to a person as a draft that names the files, rather than
opening a PR that is already conflicting.

## Where
- `.claude/workflows/ship.js`
  - setup prompt: `git fetch origin` before it branches from `origin/${BASE}`.
  - `GATE` schema: `sync` (`current` | `merged` | `conflict`) and `conflicts`.
  - the `verify#n` prompt: fetch and `git merge --no-edit origin/${BASE}` before
    the gate; on a conflict, `git merge --abort` and run nothing else.
  - the Verify loop: a `conflict` sync becomes one blocker per file, category
    `conflict`, and goes to the fixer without auditing. It is a red round, so it
    spends no audit budget, and the same conflict twice running is stuck.
  - the `open-pr` prompt: after the post-gate check, fetch and merge
    `origin/${BASE}`. A clean merge is pushed and the Checks line says the base
    was merged after the gate. A conflict aborts and returns ok=false, naming
    the files. The post-gate check uses `--first-parent`, so the base's own
    commits brought in by that merge are not read as code changed after the gate.
- `docs/harness/ship-playbook.md` §3: `git fetch origin` before branching, and a
  line on why the branch merges the base rather than rebasing onto it.
- `docs/context/harness.md` Gotchas: the run keeps up with its base, and why it
  merges.
- Tests: `tests/unit/ship.test.js`, with the stub `verify` returning `sync`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| setup fetches before branching | the `setup` prompt contains `git fetch origin` before `origin/main`; playbook §3's commands fetch before `git checkout -b` / `git worktree add` | unit, `ship.test.js` |
| each Verify round merges the base before the gate | the `verify#1` prompt contains `git merge --no-edit origin/main` before `gate.mjs` | unit, `ship.test.js` |
| a conflict reaches the fixer and the gate re-runs | `verify#1` returns `sync: 'conflict', conflicts: ['src/a.jsx']`: no auditor runs in round 1, `fix#1` gets a finding naming `src/a.jsx` and `origin/main`, and `verify#2` runs | unit, `ship.test.js` |
| the PR step merges the base, and a conflict there hands back | the `open-pr` prompt contains `git merge --no-edit origin/main` and `--first-parent`; an `open-pr` that returns ok=false with a conflict summary ends in `needs-human`, with that summary as the reason | unit, `ship.test.js` |

## Decisions
- Merge, or rebase? Merge. By the first gate the branch already carries a pushed
  spec commit, and a rebase would need a force-push to a branch a person may be
  watching. Code review's re-review already handles both. A squash merge of the
  PR leaves no merge commits on `main`.
- Should a clean merge at the PR step re-run the whole loop? No. It happens only
  when the base moved during the learn step, a few minutes, and the PR's own CI
  runs the full suite on the merged tree. The PR body says the base was merged
  after the gate, so nobody reads the gate's counts as covering it.

## Out of scope
Keeping an open PR current after it is opened: `main` can still move before a
person merges. An `@claude merge main` comment on the PR does that through the
existing respond workflow.
