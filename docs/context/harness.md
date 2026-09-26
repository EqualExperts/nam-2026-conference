---
area: harness
summary: The agents that turn a labelled issue into a pull request, review it and QA it — the ship loop and the GitHub workflows around it.
read_when: changing how tickets are built, audited, reviewed or QA'd; a workflow that did not run; the context docs themselves
files:
  - .claude/workflows/ship.js
  - .claude/workflows/code-review.js
  - .claude/workflows/qa.js
  - docs/harness/ship-playbook.md
  - docs/harness/github.md
  - docs/harness/code-review-playbook.md
  - docs/harness/qa-playbook.md
  - .github/workflows/agent-ship.yml
  - .github/workflows/agent-code-review.yml
  - .github/workflows/agent-qa.yml
  - .github/workflows/agent-respond.yml
  - .github/workflows/learn-escape.yml
  - .github/workflows/setup.yml
  - scripts/pr-media.mjs
  - scripts/context.mjs
  - scripts/gate.mjs
  - scripts/red-check.mjs
  - scripts/qa-facts.mjs
  - scripts/agent-run.sh
  - scripts/agent-summary.mjs
  - docs/context/README.md
  - specs/README.md
tests:
  - tests/unit/ship.test.js
  - tests/unit/review-workflows.test.js
  - tests/unit/context.test.js
  - tests/unit/gate.test.js
  - tests/unit/red-check.test.js
  - tests/unit/qa-facts.test.js
  - tests/unit/agent-summary.test.js
related: [testing]
---

# Harness

CLAUDE.md § *What happens to a ticket* has the stages and why they are split
the way they are. This is the machinery.

## How it works

**Trigger.** `agent-ship.yml` fires on `issues: labeled` filtered to
`ready-for-ai`, and on an `@claude` comment on a plain issue from someone with
write access — that comment rides along as `/ship <n> <comment>`, and reaches
the spec writer and every auditor as notes that amend the ticket. `@claude` on
a pull request is `agent-respond.yml`'s: a change to that diff, not a ship run. Its one step runs `claude-code-action` with the prompt
`/ship <n>` — a saved workflow is a slash command, which is what lets it run
headless — and `--allowedTools` including `Workflow`; phase agents inherit the
rest. On a laptop it is the same `/ship <n>`. There is no `/build`: the
step-by-step detail lives in `docs/harness/ship-playbook.md`, a plain doc the
phase prompts point at by section, so it cannot be run on its own.

`code-review.js` and `qa.js` take a PR number, or `{ pr, workdir }` on a
laptop — a worktree of the PR branch to run in. **Sized to the ticket.** Setup sizes every ticket `small` or `full`
(`TIERS` at the top of `ship.js`); the `ship:full` label, `--full` or
`--small` override it. Small: one combined spec auditor and one round, one
combined code auditor plus the browser pass only if the implementer reports
`ui`, two build rounds, Sonnet throughout. Full: two spec auditors and three
rounds, three code auditors, four build rounds, the session's model (Opus in
CI). Both keep the skeptic and the machine gate, and both run Verify, hand-back
and lane release on Haiku — they only run a command and copy its output.

**`ship.js`** takes `args` as an issue number (`/ship 42`) or
`{ issue, base }` — `base` (default `main`) is the branch the work starts
from, is judged against (`GATE_BASE` for the gate) and targets, for a ticket
stacked on a pull request that has not landed. It is plain JS run by the
Workflow tool. Every `agent()` call is a
fresh context; the script holds all state between them. In order:

| Phase | Agent label(s) | Returns | Loops |
| --- | --- | --- | --- |
| Setup | `setup` | `SETUP` — proceed, branch, workdir, runner, doneWhen, size | — |
| Spec | `write-spec` | spec path | — |
| Spec Audit | small: `spec-audit:combined#1`; full: `spec-audit:{criteria,fit}#n`; `skeptic:*`, `revise-spec#n` | `FINDINGS` | small 1, full ≤ 3 |
| Implement | `implement` | `DONE` (+ `ui`) | — |
| Verify | `verify#n` | `GATE` — the JSON line `scripts/gate.mjs` printed | each build round |
| Code Audit | small: `audit:combined#n`, then `audit:browser#n` if `ui`; full: `audit:{criteria,rules}#n`, then `audit:browser#n`; `skeptic:*`; `fix#n` | `FINDINGS` | small ≤ 2, full ≤ 4 |
| Context | `context` | `DONE` | — |
| Learn | `learn` | `LESSON` | only if anything was confirmed |
| PR | `open-pr` | `DONE` with url | — |

A lens that dies is re-run once (`<lens>-retry#n`); twice, and the ticket is
handed back. **The gate is a command, not an opinion**: the verify agent runs
`node scripts/gate.mjs` and returns its JSON, and `readGate()` decides from
that — anything unparseable is red. `gate.mjs` retries a failing browser test
once (a pass on retry is `flaky`, not a failure) and lists removed assertions
or added skips in `tests/` as `tampered`, which only the lens that traces the criteria sees (`criteria`, or `combined` on a small ticket).

**The red check.** After a green gate, `red-check#n` (Haiku) runs
`scripts/red-check.mjs`: in a scratch worktree it reverts the app files the
branch changed to the base, keeps the branch's tests, and runs only the tests
it added or changed. None failing becomes a `test-proves-nothing` blocker for
the skeptic — on #41 the tests only exercised an untouched helper and an
auditor had said it checked. Code review's tests lens runs it too.

A build round is: gate; if red, its failures become the findings and go
straight to `fix` (red code is not audited, and red with no named failure
hands back); if green, the criteria and rules lenses run in parallel, then
the browser lens alone (it needs the ports), each blocker goes to a
`skeptic`, and only unrefuted blockers reach `fix`. Minor findings never loop.

**Spec audit hands back only on scope** — on either tier, a small ticket
after its one round. When the spec rounds run out, a
finding in category `scope` — the ticket itself contradictory, unclear or
unbuildable as written — goes to a person. Anything technical is revised once
more, decided by the reviser under *Decisions*, and `carried` into the build:
the implementer must resolve it and the criteria lens is told to check it did.
(#52 went to a person over a missing `--repo` flag; #53, rightly, over a
criterion the ticket got wrong.)

**CI cannot edit the harness.** Claude Code in a runner refuses edits under
`.claude/` as sensitive files — rightly: an agent there should not rewrite its
own harness. The spec writer reports `editsHarness`; on a runner such a plan
is handed back straight after the spec, to be built by a person or a local
session from it (#52 found the wall an hour in). Harness changes are made
locally and pushed to main while one person develops the harness.

**Stopping.** `handBack(stage, why, open)` runs `learn`, then an agent that
pushes the branch, opens a **draft** PR (`Refs #n`, not `Closes`) listing what
is open, comments on the issue and labels it `needs-human`. A dead setup
agent, or one missing `doneWhen`/`branch`/`workdir`, hands back too.

**The runner checks behind it.** After the agent step, `agent-ship.yml`
reads the issue's label. Still `ai-working` → the run died: hand back, naming
the branch. Otherwise, if the branch has an open non-draft PR, it re-runs
`gate.mjs` itself on the PR head,
writes the JSON to the job summary, and on red puts the PR back to draft. It runs in a fresh worktree of the branch with its own ports (4460/4461) and database, never in the workspace `ship` used — the first version did, found the ports taken by what ship left running, and sent a green PR back to draft nine seconds later. The gate JSON goes to the log, and a red names its failing tests in the PR comment.

**Context docs.** `MAP` is the sentence every reading agent gets. The Context
phase runs `context.mjs for $(git diff --name-only origin/main...HEAD)` and
updates the docs that come back; Learn writes to their *Gotchas* — both
before the PR opens, so reviewers see them.

**After the PR.** `agent-code-review.yml` and `agent-qa.yml` fire on
`pull_request` `opened | reopened | ready_for_review`, skip drafts, run the
`code-review` and `qa` **workflows**, and turn the verdict file into a check
run. Both are built like ship's audit, and neither lets a model shape its own
verdict — the script composes the comment and the verdict line from what
survived:

- **`code-review.js`** — *Context* (the PR, its Done-when, and human comments
  that amend the ticket) → lenses in parallel, chosen by `kindsOf(files)`:
  app code gets `criteria, rules, logic, tests`; `.github/workflows/` adds
  `actions`; CLAUDE.md, `docs/`, skills and specs add `docs` (docs-truth);
  `.claude/workflows/` and the harness scripts add `orchestration, logic,
  tests`. Each is retried once if it dies → a `skeptic` per blocker, who alone
  sees the amendments → *Publish*. Confidence is the weakest lens's; a lens
  that never finished makes it `low`. At most three findings, criteria first.
- **`qa.js`** — *Plan* first triages: a cosmetic change the tests pin
  passes at medium confidence with no probes, headed *skipped — existing
  tests are enough* — but only when the planner says `enough` **and** the job's
  own git facts agree: `--app-lines` (src/ + server/) ≤ `TRIVIAL_LINES` (30)
  and `--ui-only=yes` (every file under src/, tests/, docs/ or specs/). A
  harness, workflow, script or server change never skips; nor does a local run,
  which passes no facts.
  Otherwise ≤ 5 probes, each `browser` or `command`: a script,
  a workflow under stubs or an `if:` against a payload is probed by running
  it; `surface: false` only when nothing can be exercised → a low-confidence
  pass) → *Probe* (commands first, then one browser spec, both viewports) → *Reproduce*, one failing probe at a time: again on the branch,
  then on the base in a separate worktree → *Publish*. Only a failure that
  reproduces on the branch and not on the base, and survives a `skeptic:<probe>`
  asked to refute it as a bug in this change, is a bug (a refuted one is a question); one that did not
  reproduce is a question. Confidence is the share of the plan that ran on
  both viewports. `agent-respond.yml` handles `@claude` and
pushes with `AGENT_GITHUB_TOKEN` when there is one — only then do its commits
trigger CI; on the `GITHUB_TOKEN` fallback they do not.

**Escapes.** A code review or QA **FAIL** on a pull request ship built
(branch `issue-<n>-…`) is something ship's own loop let through. The job's
*🧯 Flag a harness escape* step labels the PR `harness-escape` — `gh pr list
--label harness-escape --state all` is the count — and a follow-up job calls
`learn-escape.yml`: an agent on Sonnet decides whether the mistake recurs on
other tickets and, if so, opens a pull request teaching the harness where it
would have been caught — preferring an audit rule in `ship.js` over a
`docs/context` gotcha, and naming any mechanical check it would take. A person
merges the lesson or not. Its own PR is on a `learn/…` branch, so its reviews
cannot start another round.

## Invariants

- Only a **confirmed blocker** or a red gate costs a fix round. A refuted or
  minor finding never does.
- **Fail closed.** A dead auditor is retried then handed back; a dead skeptic
  refutes nothing; a dead fixer or reviser hands back. Nothing an agent failed
  to do can read as a pass.
- The skeptic gets the ticket, the worktree and the spec, and judges against
  the spec *as first committed* — a fixer cannot make a missed criterion
  "deliberate" by editing the spec.
- **Deduplication** (`where()` and `group()`, in `ship.js` and
  `code-review.js`): findings on the same exact line — or with an identical
  claim when there is no line — are **grouped, never dropped**, and only
  with findings of the same severity: blockers with blockers, notes with notes
  (ship separates minors before grouping; code review keys on severity), so a
  note never shields a blocker. The first — in code review, the highest-ranked
  category — leads; the others ride along in `also`, the skeptic sees every
  reading and may refute the location only if every one is wrong, and the
  fixer and the review comment see them all. Findings on different lines are
  never grouped.
- `STUCK_AFTER` (2): stuck detection keys on category, file and line bucket
  (`line / 10`), never on wording. The same key confirmed three rounds running
  hands back.
- No `Date.now()`, `Math.random()` or filesystem in `ship.js` — the Workflow
  runtime forbids them. Anything that touches the machine goes through an
  agent; anything that decides goes through the script.
- The audit lenses never receive the implementer's reasoning.

## Gotchas

- **CI runs the CLI, not `claude-code-action`.** The action drives the
  Agent SDK and stops at the first `result`; a saved workflow's first result
  is its launcher's "running in the background", so every workflow died
  unstarted while the step went green. `scripts/agent-run.sh` runs `claude -p`
  (which waits), keeps the transcript, writes it to the job summary, and fails
  the step when a launched workflow never reported back. It sets
  `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`: by default `claude -p` kills a
  background workflow after 600s, which killed `/ship` mid-run. Only
  `agent-respond.yml` still uses the action — interactive mode needs it.
- **In CI, review and QA do not publish — the job does.** They run with
  `--no-publish` and return `{ comment, verdictLine }` (QA adds `issue`,
  `issueNote`); `agent-summary.mjs --result` reads that from the workflow's
  task output file, and the *Publish the verdict* step posts it with `gh`. An
  agent asked to post once returned `posted: false` in CI and the check read
  "did not finish". The job summary also lists every agent and its state.
- **A PR is reviewed by the base branch's harness** (`.claude/`, CLAUDE.md,
  playbooks), so a change to the review workflow only takes effect on the
  pull requests after it merges.
- **A session caches saved workflows when it starts.** `/ship` in a session
  that has since edited `ship.js` runs the version it loaded, silently. The
  first live run of the loop did exactly that and ran a week-old script. After
  editing a workflow, start a new session, or run it by file:
  `Workflow({ scriptPath: '.claude/workflows/ship.js', args })`. Actions is
  unaffected — every job is a fresh session.
- `tests/unit/ship.test.js` runs the script with `agent` stubbed **by label**
  (`-retry` is stripped before matching). Renaming a label breaks those tests —
  change both together.
- Every tracked file under `server/`, `src/`, `scripts/` and `tests/` must be
  owned by a doc; a new script fails `npm test` until it is listed here or in
  its area's doc.
- There is no CI gate inside `ship`: the runner's own `gate.mjs` re-run is the
  machine check, and waiting on `verify.yml` would mostly wait on the
  *Approve and run* click a bot's pull request needs.
- **A post-open fix does not re-true the spec.** The Context phase makes
  `specs/<n>-*.md` match the diff once, before the PR opens; `agent-respond.yml`'s
  prompt is "make the change asked for, and nothing else" and never mentions
  `specs/`. On #41, the fix pushed for a missing-browser-test blocker added four
  Playwright tests and a data lane; the spec still called that combination a
  rejected *Decision* ("No new browser test") for two more review rounds, because
  nothing in the fix flow — or the human comment that triggered it — asked
  anyone to check the spec back against what shipped.

## Where to change…

- Round caps or escalation → the knobs at the top of `ship.js`, then
  `ship.test.js`.
- What an auditor looks for → `CODE_LENSES` / `SPEC_LENSES` in `ship.js`; the
  detail they defer to lives in the code-review and qa playbooks.
- The PR body → §8 of the playbook; `ship.js` only adds the audit table.
- The context format → `docs/context/README.md` and `scripts/context.mjs`.
