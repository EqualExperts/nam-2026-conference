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
  - scripts/ship-progress.mjs
  - scripts/ai-cost.mjs
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
  - tests/unit/ship-progress.test.js
  - tests/unit/ai-cost.test.js
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
laptop — a worktree of the PR branch to run in. **Sized to the ticket.** Setup (on the session's model) reports
`sizing` facts — required — and `profileFor` composes the loop from them over
the two presets in `TIERS`: a business rule, stored data, the harness or the
`ship:full` label → full (two spec auditors, ≤ 3 rounds, three code auditors,
four build rounds, the session's model); otherwise small (setup writes the
spec, one combined code auditor plus the browser pass only if the implementer
reports `ui` without a browser test, two build rounds, Sonnet), plus: the API
or breadth (≥ 3 areas, ~7 app files) → `criteria` + `rules` auditors and three
rounds; ≥ 2 open questions → one `spec-audit:combined`; `uiInteraction` →
the browser pass always, four probes. `--full` / `--small` pick a preset.
After a green gate, `verify#n` also relays `qa-facts.mjs`: a small run whose
diff is `--risky=yes` or over 300 app lines is **escalated** (criteria + rules
on the session model); a gate red twice running moves the fixer to the session
model. In the plan loop only `criterion-unmet`, `claude-md`, `logic` and
`scope` cost a `revise-spec` round; other confirmed spec findings are carried
to the builder as notes. Both keep the skeptic and the machine gate, and both run Verify, hand-back
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

**Review depth.** `code-review.js`'s `tierFor()` picks **light** (one
`combined` lens, Sonnet for lenses, rechecks and skeptics) or **full** (the
lenses by kind, the session model) from the team's dial — `--depth`, from the
`REVIEW_DEPTH` repo variable, default `balanced` — and facts the job computes
with `scripts/qa-facts.mjs`: `--lines`, `--docs-only`, `--shipped` (branch
`issue-<n>-*`). `thorough` → full; docs-only → light; the harness (`actions`,
`orchestration`) or `server/lib/` → full at every depth; `fast` → light;
`balanced` → light if ship built it or it is ≤ 150 lines, else full. QA skips a
docs-only change (unless `thorough` or bugs need rechecking) and `thorough`
turns its triage off. No facts — a local run — means full, as before.

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
  *Context* also returns the PR's `head` and, on a re-review, `previous` —
  read back from the newest `<!-- orbit-verdict:code-review {…} -->` marker
  the last finished pass ended its comment with (`commit`, `blockers`,
  `followUps`). Then every lens prompt carries a `SCOPE` paragraph: new
  problems only in `git diff <commit> <head>` (on a rebase, `git fetch origin
  <commit>` and the same diff limited to the PR's files), unless severe enough
  to have blocked a first review; and a *Recheck* phase runs one
  `recheck:<category>` per previous blocker — an unresolved one is confirmed
  without a skeptic and ranks first, a resolved one leaves the verdict. All
  previous blockers resolved and a clean delta is a **pass**.
- **`qa.js`** — *Plan* first triages (`triage`, Sonnet, low effort): from
  the ticket, the diff and the tests it adds, is that **enough**, are there
  specific **gaps** to probe (*focused*), or does the change need open
  exploration (*explore*)? `enough` passes at high confidence with no probes,
  headed *skipped — existing tests are enough* — but only when every Done-when
  criterion maps to a test file the diff changes (`criteriaCovered`, checked
  against the diff) and the change is not `large`; otherwise the unpinned
  criteria become the gaps. *Focused* plans one probe per gap and nothing else.
  No triage on a re-review with bugs to recheck or at `thorough`.
  Otherwise ≤ 5 probes, each `browser` or `command`: a script,
  a workflow under stubs or an `if:` against a payload is probed by running
  it; `surface: false` only when nothing can be exercised → a low-confidence
  pass) → *Probe* (commands first, then one browser spec, both viewports) → *Reproduce*, one failing probe at a time: again on the branch,
  then on the base in a separate worktree → *Publish*. Only a failure that
  reproduces on the branch and not on the base, and survives a `skeptic:<probe>`
  asked to refute it as a bug in this change, is a bug (a refuted one is a question); one that did not
  reproduce is a question. Confidence is the share of the plan that ran on
  both viewports. A `scope` agent opens *Plan*, ahead of the planner: the
  PR's `head`, its `files`, and `previous` from the newest `<!--
  orbit-verdict:qa {…} -->` marker, each previous bug carrying the probe that
  found it. The plan prompt gets the same `SCOPE` paragraph as code review's
  lenses and is told the previous bugs' probe ids are already spent; the
  script puts those probes first in `plan.probes` (each id once, capped at
  `MAX_PROBES`) before the empty-plan early return, and one that fails and
  reproduces again is a bug without a second skeptic. A dead `scope` is
  `verdict: 'none'`. `agent-respond.yml` handles `@claude` and
pushes with `AGENT_GITHUB_TOKEN` when there is one — only then do its commits
trigger CI; on the `GITHUB_TOKEN` fallback they do not.

**Progress on the issue.** A run is up to two hours long; nothing appeared on
the issue while it worked until this. `agent-ship.yml`'s job's *very first*
step — before checkout, `npm ci`, Chromium or Claude Code — is plain `gh`:
it reads the run's own start (`gh api …/actions/runs/$GITHUB_RUN_ID --jq
.run_started_at` — the job's `actions: read` already covers it, never the
CLI's own idea of when it began, which is three or four minutes late on a
cold cache) and posts `🚢 Ship · starting… · 0m elapsed · Run`, with the run
link and an HTML marker, needing nothing checkout would provide. That is what
makes "within about a minute" true regardless of setup time. It hands the new
comment's id and the run's start down through `$GITHUB_ENV` — written once,
so it outlives whatever happens to the step after it — and every later step
falls back to searching for the marker, then creating, only if that post
itself failed.

Once `claude -p` is streaming, `scripts/agent-run.sh` backgrounds
`node scripts/ship-progress.mjs follow` beside it (gated on
`SHIP_PROGRESS_ISSUE`/`SHIP_PROGRESS_PR`, so a laptop run is unchanged) and
reaps it after — never in the CLI's pipe, so a follower that died mid-write
cannot take the run down with it (`EPIPE`). It tails the transcript
`claude -p --output-format stream-json` writes, and turns two things it
reports into markdown: `system/task_progress`'s cumulative
`workflow_progress` (every phase from `meta.phases`, and every agent tried, so
the follower is stateless and only ever needs the *last* such event) into the
phase table, done / running / not started; and each agent's `resultPreview` —
capped at 400 characters, so read by regex, never `JSON.parse`, because the
one that matters (the verify agent's gate line) arrives cut mid-string on a
red round — into the tier, the branch, the spec link and each round's gate
and audit result. It patches one comment in place, found by the id from
`$GITHUB_ENV`, never by searching, unless that id is missing.

Because a step's `timeout-minutes` or a cancellation kills its whole process
tree — the commonest way a run ends — the follower dies with it, mid-render.
A separate `🏁 Finish the progress comment` step, `if: always()` and
`continue-on-error: true`, runs after and settles the comment from whatever
transcript is left on disk: **shipped**, with the pull request link;
**handed back**, with the stage and reason; or **the run died**, naming the
step timing out or being cancelled — never left reading "running". In a
healthy run the follower already wrote the right thing, so this reads one
file and patches nothing. The same pair of steps, without a pre-checkout
post (neither ticket needing this has a "within about a minute" criterion),
keeps one line — `Reviewing…` / `Running QA…`, replaced by the verdict —
on the pull request while `agent-code-review.yml` and `agent-qa.yml` run;
`scripts/ship-progress.mjs` is one of the harness paths both check out from
the base branch, beside `agent-run.sh`. None of this is a model call: it is
`gh` and a script reading text `claude -p` already prints, and every `gh`
call is wrapped so a rate limit or a malformed reply leaves the run
untouched.

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
- **A blocker names how and harm.** A code review finding must say the path
  through normal use that reaches it (`how`) and what it costs (`harm`); the
  script demotes one with either left blank to a follow-up, and a skeptic
  (in either pass) may answer `contrived` — real, but only from an input
  nobody gives — which does the same. Follow-ups never colour the check:
  they are listed in the comment, returned as `followUps` (at most three,
  minus any key the last marker already filed) on a pass **or** a fail, and
  the job's *📌 File follow-ups* step opens one `follow-up` issue each.
- **Only a finished pass leaves a marker.** A `verdict: 'none'` comment has
  none, so the run after it reviews as if it were the first rather than
  treating every previous blocker as closed.

## Gotchas

- **Every path in a prompt is absolute** — an agent's cwd is a worktree, not
  the repo root, so a relative path lands in a different place for each one.
  Agent worktrees are full checkouts *inside* the repo, at `.claude/worktrees/`
  — `wt-<n>` for a ticket, `main-<n>` for ship's browser probe, `qa-base` for
  QA's base comparison — kept out of `git status` by `.gitignore`, and every
  prompt that makes one builds the path from the repo root
  (`dirname "$(git rev-parse --path-format=absolute --git-common-dir)"`), so a
  base worktree lands beside the ticket's instead of inside it, where removing
  the ticket's would delete a registered worktree. Anything walking the tree
  enumerates with `git ls-files`: a recursive readdir descends into a worktree
  holding another branch's copy of the same file and reads it as this branch's.

- **A script-composed prompt carries only what an earlier agent already
  returned, and an early `return publish(…)` runs before the later `const`s
  exist.** A prompt that needs a sha or the PR's files gets a Context agent
  ahead of it: `code-review.js` always had `context`, and `qa.js` gained
  `scope` ahead of the planner for exactly this — the plan prompt carries the
  delta boundary, and could not while `plan` was the first agent. And
  `publish()` reads `plan` unconditionally (`issue: plan && plan.issue`), so a
  bail-out above its assignment is a ReferenceError rather than the `verdict:
  'none'` it was meant to be — which is why `plan` is a `let` initialised to
  `null` above the `scope` stop. Keep publish's inputs to what exists on every
  path.
- **Two passes, one thread, two markers.** Code review and QA comment on the
  same pull request, QA usually last, so each marker is named for its pass
  (`orbit-verdict:code-review`, `orbit-verdict:qa`), each reader prompt names
  only its own, and the script still drops a `previous` whose `pass` is not
  its own — QA's marker read as code review's would silently close every
  previous blocker.
- **In a `pull_request` job, `HEAD` is the merge commit**, not the PR head:
  `actions/checkout` with no `ref:` checks out `refs/pull/<n>/merge`. So the
  delta is always `git diff <marker commit> <head sha>` between two named
  commits; a diff against `HEAD` would add everything merged into the base
  since the last review. A rebase leaves the marker's commit outside the
  branch's history (`inHistory: false`), so the scope fetches it and limits
  the diff to the PR's files, reviewing them in full if it cannot be fetched.
- **Filing follow-ups needs `issues: write`** on the code review job; QA's
  already had it. The *📌 File follow-ups* step is gated on `!cancelled()`
  only, so a fail files its follow-ups exactly as a pass does.
- **A step's timeout or cancellation kills its whole process tree**, and that is
  the commonest way a run ends: *Run /ship* is bounded by `timeout-minutes: 100`,
  so nothing after `claude` in `agent-run.sh` runs and anything backgrounded
  beside it dies mid-write. Work that has to settle state at the end of a run
  belongs in its own `if: ${{ always() }}` step. That step inherits nothing —
  Actions `env:` is per step and no agent job declares one at job level — so it
  re-declares `GH_TOKEN`, `GH_REPO` and the run's variables itself, the way
  *🧹 Check what the run left behind* does.
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
  `--no-publish` and return `{ comment, verdictLine, followUps }` (QA adds
  `issue`, `issueNote`); `agent-summary.mjs --result` reads that from the workflow's
  task output file, and the *Publish the verdict* step posts it with `gh`. An
  agent asked to post once returned `posted: false` in CI and the check read
  "did not finish". The job summary also lists every agent and its state.
- **Every `gh` call in a workflow pins `GH_REPO: ${{ github.repository }}`.**
  On a fork `gh` resolves the base repo to the upstream, so an unpinned
  `gh issue create` aims the ticket at the parent — where `GITHUB_TOKEN` is
  refused, and the comment or follow-up is lost rather than misfiled.
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
- **A workflow's `log()` output is not live** — it only ever shows up in the
  task's output file, after the run ends. A throwaway workflow run under
  `claude -p --output-format stream-json --verbose` settled this: the obvious
  design for the progress comment was to have `ship.js` log milestones for
  `ship-progress.mjs` to read, and that recording is what ruled it out. What
  *is* live is each agent's `resultPreview` on `system/task_progress` — that
  is what the follower reads instead.
- Every tracked file under `server/`, `src/`, `scripts/` and `tests/` must be
  owned by a doc; a new script fails `npm test` until it is listed here or in
  its area's doc.
- There is no CI gate inside `ship`: the runner's own `gate.mjs` re-run is the
  machine check, and waiting on `verify.yml` would mostly wait on the
  *Approve and run* click a bot's pull request needs.
- **Docs move with the code, inside ship.** There is no Context agent: the
  implementer and each fixer update the `docs/context/` docs that own what they
  changed (and the spec, when a finding shows it wrong), and the combined code
  auditor flags a doc left describing the code wrongly (`docs-stale`). A
  separate agent re-learnt the whole change to move a line or two — ~400k
  context tokens a ticket.
- **A post-open fix does not re-true the spec.** Ship keeps
  `specs/<n>-*.md` true up to the PR opening; `agent-respond.yml`'s
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

## AI spend

`scripts/ai-cost.mjs` turns a run's usage into tokens and dollars. Every agent
job ends with a *🧾 Record the AI spend* step that adds the run's row to one
comment on the issue — marker `orbit-ai-spend`, rows as JSON inside it — so the
ticket carries its running total; ship also comments its own line on the PR it
opened. CI rows are what the CLI billed (`modelUsage[*].costUSD` in the final
`result`); a local run is a subscription, so `record --transcripts <workflow
dir>` prices the per-agent transcripts with `RATES` and marks the row `~`. The
step is `continue-on-error` and the script catches everything: reporting cost
never fails the job that did the work.

**Rote agents.** Ship's verify and PR steps run as `.claude/agents/ship-rote.md`
(`agentType: 'ship-rote'`): Haiku, a two-line system prompt and
`omitClaudeMd: true`, so they start ~26% lighter (13.6k against 18.4k tokens,
measured). Only steps that run given commands and relay output belong there —
anything that judges needs CLAUDE.md's rules.
