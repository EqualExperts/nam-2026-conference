---
area: harness
summary: The agents that turn a labelled issue into a pull request, review it and QA it — the ship loop and the GitHub workflows around it.
read_when: changing how tickets are built, audited, reviewed or QA'd; a workflow that did not run; the context docs themselves
files:
  - .claude/workflows/ship.js
  - .claude/skills/build/SKILL.md
  - .claude/skills/code-review/SKILL.md
  - .claude/skills/qa/SKILL.md
  - .github/workflows/agent-build.yml
  - .github/workflows/agent-code-review.yml
  - .github/workflows/agent-qa.yml
  - .github/workflows/agent-respond.yml
  - .github/workflows/setup.yml
  - scripts/pr-media.mjs
  - scripts/context.mjs
  - docs/context/README.md
  - specs/README.md
tests:
  - tests/unit/ship.test.js
  - tests/unit/context.test.js
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
rest. On a laptop `/build <n>` loads the build skill, whose first section says
to run `/ship <n>`.

**`ship.js`** is plain JS run by the Workflow tool. Every `agent()` call is a
fresh context; the script holds all state between them. In order:

| Phase | Agent label(s) | Returns | Loops |
| --- | --- | --- | --- |
| Setup | `setup` | `SETUP` — proceed, branch, workdir, runner, doneWhen | — |
| Spec | `write-spec` | spec path | — |
| Spec Audit | `spec-audit:{criteria,fit}#n`, `skeptic:*`, `revise-spec#n` | `FINDINGS` | ≤ `MAX_SPEC_ROUNDS` (3) |
| Implement | `implement` | `DONE` | — |
| Verify | `verify#n` | `GATE` — green, unit, browser, failures | each build round |
| Code Audit | `audit:{criteria,rules,browser}#n`, `skeptic:*`, `fix#n` | `FINDINGS` | ≤ `MAX_BUILD_ROUNDS` (4) |
| Context | `context` | `DONE` | — |
| PR | `open-pr` | `DONE` with url | — |
| Learn | `learn` | `LESSON` | only if anything was confirmed |

A build round is: verify; if red, the failures become the findings and it goes
straight to `fix` (red code is not audited); if green, the three auditors run
in parallel, each blocker goes to a `skeptic` told to refute it, and only
unrefuted blockers reach `fix`. Minor findings never loop — they go into the
PR body's "Worth a closer look".

**Stopping.** `handBack(stage, why, open)` runs `learn`, then an agent that
pushes the branch, opens a **draft** PR (`Refs #n`, not `Closes`) listing what
is open, comments on the issue and labels it `needs-human`. It returns
`{ outcome: 'needs-human', stage, reason, open, lessons }`. Setup declining a
ticket returns `{ outcome: 'declined' }` without any of that.

**Context docs.** `MAP` is the sentence every reading agent gets: start from
`node scripts/context.mjs index`. The Context phase runs
`context.mjs for $(git diff --name-only origin/main...HEAD)` and updates the
docs that come back; Learn writes to their *Gotchas*.

**After the PR.** `agent-code-review.yml` and `agent-qa.yml` fire on
`pull_request` `opened | reopened | ready_for_review`, skip drafts, run
`/code-review` and `/qa`, and turn the verdict file (`/tmp/review-verdict`,
`/tmp/qa-verdict`) into a check run. `agent-respond.yml` handles `@claude`.

## Invariants

- Only a **confirmed blocker** or a red gate costs a fix round. A refuted or
  minor finding never does — otherwise the fixer "fixes" correct code and the
  next audit flags the damage.
- `STUCK_AFTER` (2): a finding whose `key()` — category, file, the claim's
  first 60 normalised characters — is confirmed in three consecutive rounds
  hands back early. Rewording the claim defeats it; the round cap still holds.
- No `Date.now()`, `Math.random()` or filesystem in `ship.js` — the Workflow
  runtime forbids them. Anything time-based goes through an agent.
- The audit lenses never receive the builder's reasoning, only the ticket,
  the spec path and the branch.

## Gotchas

- `tests/unit/ship.test.js` runs the script with `agent` stubbed **by label**.
  Renaming a label, or the `#n` suffix convention, breaks those tests — which
  is the point — so change both together.
- There is no CI gate: `ship` has already run `npm run verify` green on the
  final commit, and `verify.yml` runs again on the PR for the human who
  merges. Waiting on it inside the job would mostly wait on the *Approve and
  run* click a bot's pull request needs.
- Check runs need `GITHUB_TOKEN`; a PAT is rejected — see the comment in
  `agent-qa.yml`.

## Where to change…

- Round caps or escalation → the knobs at the top of `ship.js`, then
  `ship.test.js`.
- What an auditor looks for → `CODE_LENSES` / `SPEC_LENSES` in `ship.js`; the
  detail they defer to lives in the code-review and qa skills.
- The PR body → §8 of the build skill; `ship.js` only adds the audit table.
- The context format → `docs/context/README.md` and `scripts/context.mjs`.
