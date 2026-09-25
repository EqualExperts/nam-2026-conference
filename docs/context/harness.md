---
area: harness
summary: The agents that turn a labelled issue into a pull request, review it and QA it — the ship loop and the GitHub workflows around it.
read_when: changing how tickets are built, audited, reviewed or QA'd; a workflow that did not run; the context docs themselves
files:
  - .claude/workflows/ship.js
  - docs/harness/ship-playbook.md
  - docs/harness/github.md
  - .claude/skills/code-review/SKILL.md
  - .claude/skills/qa/SKILL.md
  - .github/workflows/agent-build.yml
  - .github/workflows/agent-code-review.yml
  - .github/workflows/agent-qa.yml
  - .github/workflows/agent-respond.yml
  - .github/workflows/setup.yml
  - scripts/pr-media.mjs
  - scripts/context.mjs
  - scripts/gate.mjs
  - docs/context/README.md
  - specs/README.md
tests:
  - tests/unit/ship.test.js
  - tests/unit/context.test.js
  - tests/unit/gate.test.js
related: [testing]
---

# Harness

CLAUDE.md § *What happens to a ticket* has the stages and why they are split
the way they are. This is the machinery.

## How it works

**Trigger.** `agent-build.yml` fires on `issues: labeled` and filters to
`ready-for-ai`. Its one step runs `claude-code-action` with the prompt
`/ship <n>` — a saved workflow is a slash command, which is what lets it run
headless — and `--allowedTools` including `Workflow`; phase agents inherit the
rest. On a laptop it is the same `/ship <n>`. There is no `/build`: the
step-by-step detail lives in `docs/harness/ship-playbook.md`, a plain doc the
phase prompts point at by section, so it cannot be run on its own.

**`ship.js`** is plain JS run by the Workflow tool. Every `agent()` call is a
fresh context; the script holds all state between them. In order:

| Phase | Agent label(s) | Returns | Loops |
| --- | --- | --- | --- |
| Setup | `setup` | `SETUP` — proceed, branch, workdir, runner, doneWhen | — |
| Spec | `write-spec` | spec path | — |
| Spec Audit | `spec-audit:{criteria,fit}#n`, `skeptic:*`, `revise-spec#n` | `FINDINGS` | ≤ `MAX_SPEC_ROUNDS` (3) |
| Implement | `implement` | `DONE` | — |
| Verify | `verify#n` | `GATE` — the JSON line `scripts/gate.mjs` printed | each build round |
| Code Audit | `audit:{criteria,rules}#n` together, then `audit:browser#n`; `skeptic:*`; `fix#n` | `FINDINGS` | ≤ `MAX_BUILD_ROUNDS` (4) |
| Context | `context` | `DONE` | — |
| Learn | `learn` | `LESSON` | only if anything was confirmed |
| PR | `open-pr` | `DONE` with url | — |

A lens that dies is re-run once (`<lens>-retry#n`); twice, and the ticket is
handed back. **The gate is a command, not an opinion**: the verify agent runs
`node scripts/gate.mjs` and returns its JSON, and `readGate()` decides from
that — anything unparseable is red. `gate.mjs` retries a failing browser test
once (a pass on retry is `flaky`, not a failure) and lists removed assertions
or added skips in `tests/` as `tampered`, which only the criteria lens sees.

A build round is: gate; if red, its failures become the findings and go
straight to `fix` (red code is not audited, and red with no named failure
hands back); if green, the criteria and rules lenses run in parallel, then
the browser lens alone (it needs the ports), each blocker goes to a
`skeptic`, and only unrefuted blockers reach `fix`. Minor findings never loop.

**Stopping.** `handBack(stage, why, open)` runs `learn`, then an agent that
pushes the branch, opens a **draft** PR (`Refs #n`, not `Closes`) listing what
is open, comments on the issue and labels it `needs-human`. A dead setup
agent, or one missing `doneWhen`/`branch`/`workdir`, hands back too.

**The runner checks behind it.** After the agent step, `agent-build.yml`
reads the issue's label. Still `ai-working` → the run died: hand back, naming
the branch. `ready-for-human` → it re-runs `gate.mjs` itself on the PR head,
writes the JSON to the job summary, and on red puts the PR back to draft.

**Context docs.** `MAP` is the sentence every reading agent gets. The Context
phase runs `context.mjs for $(git diff --name-only origin/main...HEAD)` and
updates the docs that come back; Learn writes to their *Gotchas* — both
before the PR opens, so reviewers see them.

**After the PR.** `agent-code-review.yml` and `agent-qa.yml` fire on
`pull_request` `opened | reopened | ready_for_review`, skip drafts, and turn
the verdict file into a check run. `agent-respond.yml` handles `@claude` and
pushes with the build's token, so its commits trigger CI.

## Invariants

- Only a **confirmed blocker** or a red gate costs a fix round. A refuted or
  minor finding never does.
- **Fail closed.** A dead auditor is retried then handed back; a dead skeptic
  refutes nothing; a dead fixer or reviser hands back. Nothing an agent failed
  to do can read as a pass.
- The skeptic gets the ticket, the worktree and the spec, and judges against
  the spec *as first committed* — a fixer cannot make a missed criterion
  "deliberate" by editing the spec.
- `STUCK_AFTER` (2): findings are keyed by category, file and line bucket
  (`line / 10`), never by wording, and deduplicated per round. The same key
  confirmed three rounds running hands back.
- No `Date.now()`, `Math.random()` or filesystem in `ship.js` — the Workflow
  runtime forbids them. Anything that touches the machine goes through an
  agent; anything that decides goes through the script.
- The audit lenses never receive the builder's reasoning.

## Gotchas

- `tests/unit/ship.test.js` runs the script with `agent` stubbed **by label**
  (`-retry` is stripped before matching). Renaming a label breaks those tests —
  change both together.
- Every tracked file under `server/`, `src/`, `scripts/` and `tests/` must be
  owned by a doc; a new script fails `npm test` until it is listed here or in
  its area's doc.
- There is no CI gate inside `ship`: the runner's own `gate.mjs` re-run is the
  machine check, and waiting on `verify.yml` would mostly wait on the
  *Approve and run* click a bot's pull request needs.

## Where to change…

- Round caps or escalation → the knobs at the top of `ship.js`, then
  `ship.test.js`.
- What an auditor looks for → `CODE_LENSES` / `SPEC_LENSES` in `ship.js`; the
  detail they defer to lives in the code-review and qa skills.
- The PR body → §8 of the playbook; `ship.js` only adds the audit table.
- The context format → `docs/context/README.md` and `scripts/context.mjs`.
