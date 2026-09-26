# 52 — Make code review and QA converge

Reviews spiral because every re-review starts from nothing and anything true
blocks. This makes a second look a *second look*: it checks the blockers it
raised last time and the commits pushed since, and it only turns the check red
for a problem someone will actually hit. Everything else is written down as a
follow-up issue rather than argued about in another round.

## What this changes

For the person merging — the audience for both passes, since neither is a
required check:

- **Every verdict comment ends with a marker** naming the pass that wrote it,
  the commit it reviewed, the blockers it raised and the follow-ups it filed.
  It is an HTML comment, so it is invisible in the rendered thread and readable
  by the next run. Both passes comment on the same thread, so each marker is
  named for its own pass and each run reads back only its own.
- **A re-review says what it re-checked.** On a pull request that was put back
  to draft and marked ready again, code review re-opens each previous blocker
  and says resolved or not, and hunts for new problems only in what has been
  pushed since. QA re-runs every previous bug's probe before spending any of
  its five-probe budget on new ground. Neither is forbidden from raising
  something outside that range — but only if it is bad enough to have blocked
  a first review.
- **A blocker has to name how it happens and what it costs.** A finding whose
  author cannot say a realistic path through normal use and the harm at the end
  of it is published as a follow-up, not a blocker. The skeptic gains a second
  way out: not "this is not real" but "this is real and needs a contrived
  input", which downgrades it the same way.
- **A review with only follow-ups is a pass.** Green check, the follow-ups
  listed in the comment, and one GitHub issue per follow-up — labelled
  `follow-up`, linking the pull request — so nothing is lost by not being red.
  A re-review does not re-file a follow-up its predecessor already filed.

## Where

**`.claude/workflows/code-review.js`**

- `CONTEXT` gains `head` (`gh pr view --json headRefOid`) and an optional
  `previous` — `{ pass, commit, inHistory, blockers[], followUps[] }` — read
  back from the newest comment carrying *this pass's* marker,
  `<!-- orbit-verdict:code-review {…} -->`. `inHistory` is
  `git merge-base --is-ancestor <commit> <head>`. The script drops a `previous`
  whose `pass` is not `code-review` and reviews as if it were the first, so
  QA's marker on the same thread can never be read as one of ours.
- `FINDINGS` items gain required `how` (the path through normal use) and
  `harm`; `severity` becomes `blocker | follow-up`. The script, not the model,
  demotes a `blocker` with an empty `how` or `harm`.
- A `SCOPE` paragraph, composed by the script and appended to every lens
  prompt: nothing on a first review; `git diff <commit> <head>` when the
  previous commit is an ancestor; `git fetch origin <commit>` then
  `git diff <commit> <head> -- <the PR's files>` when it is not (a rebase),
  falling back to reviewing those files in full if the old commit cannot be
  fetched at all. Both ends are named commits — never `HEAD`, which in Actions
  is the merge commit, not the head (see *Decisions*). Each carries the
  "unless it would have blocked a first review" escape.
- A new **Recheck** phase before Verify: one agent per previous blocker,
  `recheck:<category>`, returning `{ resolved, why }`. Unresolved ones go
  straight into the confirmed list — they already survived a skeptic once, so
  they do not face another — and rank above this round's findings.
- `REFUTATION` gains `contrived`. `refuted` drops the finding; `contrived`
  without `refuted` makes it a follow-up; a dead skeptic still refutes nothing.
- `publish()` composes the marker (`pass: 'code-review'`, `commit: ctx.head`,
  the blockers, the follow-up keys), a **Follow-ups** section listing each one,
  and `followUps: [{ key, title, body }]` on the returned object (at most 3,
  minus any key in `previous.followUps`). The marker is composed **only for a
  `pass` or `fail` verdict**: `publish()` is also the did-not-finish path
  (`if (!ctx) return publish({ verdict: 'none', … })`, code-review.js:103),
  where there is no `ctx` to read a head from — and a pass that did not finish
  reviewed no commit, so recording one would let the next run treat every
  previous blocker as closed. An unfinished pass leaves no marker and the run
  after it reviews as if it were the first.

**`.claude/workflows/qa.js`** — the same four ideas, in QA's shapes:

- A **`scope`** agent opens the Plan phase, ahead of the planner and the twin
  of code review's `context` (`effort: 'low'`): it returns `head`, the pull
  request's `files`, and an optional `previous`
  (`{ pass, commit, inHistory, bugs[], followUps[] }`, each bug carrying the
  probe that found it) read back from the newest `<!-- orbit-verdict:qa {…} -->`
  marker — and, as in code review, the script drops a `previous` tagged for the
  other pass. The script composes `SCOPE` from what it returns and appends it
  to the *plan* prompt: the planner is what chooses new ground, so it is the
  prompt that has to carry the boundary, and it cannot be the thing that tells
  the script where the boundary is. `files` is what the rebase form
  interpolates. Nothing else in QA needs its own scope paragraph — a probe is
  already pinned to the plan that asked for it. A `scope` that does not finish
  stops the pass (`verdict: 'none'`, as a dead `context` does in code review):
  planning blind would silently close every previous bug. That return happens
  before the planner runs, and `publish()` reads `plan` (`issue: plan &&
  plan.issue`, qa.js:252), so `plan` becomes a `let` initialised to `null`
  above the Plan phase and assigned from the planner — otherwise the stop is a
  ReferenceError instead of a comment.
- The script prepends every `scope.previous` bug's probe to `plan.probes` and
  truncates to `MAX_PROBES`, so a planner that forgets one cannot drop it. A
  recheck probe that fails and reproduces is a bug without a skeptic; one that
  passes is reported as resolved.
- The skeptic's `contrived` turns a reproduced failure into a follow-up rather
  than a question — `LABEL` gains the wording.
- `publish()` emits the marker (`pass: 'qa'`, `commit: scope.head`, the bugs
  with their probes, the follow-up keys), the follow-up list and `followUps`
  for the job — again only for `pass` or `fail`, so the three did-not-finish
  returns (dead `scope`, dead planner, probes that never ran) record no commit.

**`.github/workflows/agent-code-review.yml`, `agent-qa.yml`** — a *📌 File
follow-ups* step after *Publish the verdict*, reading `.followUps` from
`workflow-result.json` and calling `gh issue create --label follow-up`, falling
back to an unlabelled issue rather than losing one. Code review's job needs
`issues: write` for it (it has `read` today).

**`.github/workflows/setup.yml`** — `label follow-up …`, and the step title and
summary line stop claiming there are four labels.

**`docs/context/harness.md`** — the code-review and QA bullets under *After the
PR* gain the marker, the delta rule and the follow-up path; a new invariant for
the blocker bar; a gotcha for the rebase case, for `issues: write`, for the
shared comment thread — two passes, two markers, each reading only its own —
and for `HEAD` being the merge commit in a `pull_request` job.

**`docs/harness/code-review-playbook.md`**, **`qa-playbook.md`** — §2 gains the
"name the path and the harm" bar and what a follow-up is; a new section on
re-reviewing the delta and re-checking previous blockers; §5's comment shape
shows the follow-up section.

**`tests/unit/review-workflows.test.js`** — the checks below.

## How it will be proved

Every one of these is a unit test in `tests/unit/review-workflows.test.js`,
which runs both scripts with `agent` stubbed by label. Nothing here needs a
browser or a database: what changes is what the *script* decides from what
agents return, which is exactly what that harness exercises.

| Done when | Check (unit, `review-workflows.test.js`) |
| --- | --- |
| Verdict comments record the head commit, readably | `the comment ends with a marker naming the commit it reviewed` — asserts the marker line in `result.comment` for both scripts, and that it parses as JSON carrying its own `pass`, the `commit` and the raised blockers |
| …and the two passes do not read each other's | `a verdict marker left by the other pass is ignored` — a `previous` carrying `pass: 'qa'` given to code review (and `pass: 'code-review'` given to QA) runs no `recheck:*` agent, puts no `git diff <sha>` in any prompt, and leaves the previous blockers out of the verdict; the reader prompt is asserted to name only its own marker |
| A re-review looks only at the delta | `a re-review scopes the lenses to what changed since the last reviewed commit` — every `review:*` prompt contains `git diff <sha> <head-sha>`, with the head the context agent returned and **no `HEAD`** anywhere in the scope paragraph; the QA twin asserts the plan prompt does, from what the `scope` agent returned |
| …and checks each previous blocker | `a re-review re-checks every previous blocker` — one `recheck:*` agent per previous blocker; QA: every previous bug's id is in the probe list even when the planner returned none of them |
| Rebase: limit to the PR's files since that commit | `a previous commit no longer in history scopes the review to the files the PR touches` — `inHistory: false` puts `git fetch origin <sha>`, `git diff <sha> <head-sha>` and `-- <files>` in the prompts, from `ctx.files` for code review and `scope.files` for QA |
| A pass that dies still publishes, and claims no commit | `a dead context publishes did-not-finish with no marker` — code review's `context` returning nothing gives `verdict: 'none'`, a comment, and no `orbit-verdict:` marker; the QA twin does the same for a dead `scope`, having run no planner or probe |
| A still-unresolved previous blocker stays a blocker | `an unresolved previous blocker still fails the review` — verdict `fail`, the claim in the verdict line, and no `skeptic:` call for it |
| Severe new problem outside the delta may still block | `a blocker outside the delta is still published` — the lens returns one and the verdict is `fail`; the prompt's escape clause is asserted as text |
| A blocker names how and what harm, or it is a follow-up | `a blocker with no path through normal use publishes as a follow-up` — `how`/`harm` blank → verdict `pass`, the finding in `result.followUps` |
| The skeptic downgrades a contrived blocker | `a contrived-input finding becomes a follow-up, not a refutation` — skeptic `{ refuted: false, contrived: true }` → verdict `pass`, one follow-up, and the reason in the comment; the QA twin asserts the same for a reproduced failure |
| Follow-up-only review passes, lists them, files one issue each | `a follow-up-only review publishes as a pass and files its issues` — verdict `pass`, `PASS` verdict line, the claims in `result.comment`, and one `{ title, body }` per follow-up in `result.followUps`, each linking the PR |
| …and none is lost or duplicated | `a follow-up the last review already filed is not filed again` — a key in `previous.followUps` is listed but not re-filed |
| `setup.yml` creates the `follow-up` label | `setup.yml creates the follow-up label the reviews file against` — a new test reading `.github/workflows/setup.yml` for a `label follow-up` line, beside the existing file-reading harness in this file (the label itself is made by Actions, which no test can run) |
| The playbooks and `harness.md` describe the rules | The docs-truth lens on this PR, plus `npm test`'s doc-ownership check; the prose changes are reviewed, not asserted |

`npm test` covers all of it. `npm run verify` still runs, because the branch
touches `.github/` and `.claude/`, but no Playwright spec changes.

## Decisions

- **The marker is JSON inside an HTML comment**, not a rendered line. A human
  reading the thread should not have to scroll past a commit hash, and the next
  run needs one place to look rather than a prose sentence to parse.
- **The marker is named for its pass, and the script enforces it.** Code review
  and QA both comment on the same pull request on the same event, and QA — the
  slower job — usually comments last, so "the newest comment carrying the
  marker" would hand code review QA's verdict and quietly drop every previous
  blocker. So the tag carries the pass (`orbit-verdict:code-review` /
  `orbit-verdict:qa`), the JSON repeats it in `pass`, and the script discards a
  `previous` that is not its own rather than trusting the agent's grep. Two
  markers on one thread also beat two threads: a person reading the pull
  request sees both verdicts where the discussion is.
- **QA reads its scope before it plans.** The planner is what decides where the
  next five probes go, so it is the prompt that must carry the delta boundary —
  and a prompt cannot be built from what the agent reading it is about to
  return. A `scope` agent ahead of it, the twin of code review's `context`,
  breaks that circle and is the only thing that knows the pull request's file
  list for the rebase case. It costs one cheap low-effort call and a second
  `gh pr view`; QA's budget is browser probes, not this.
- **The delta is diffed between two named commits, never against `HEAD`.**
  Both jobs run on `pull_request` and check out with no `ref:`, so
  `actions/checkout` gives them `refs/pull/<n>/merge` — HEAD is the merge of
  the branch into its base, not the commit the marker recorded. `git diff
  <commit>..HEAD` there would hand the lens everything merged into `main`
  since the last review as well, and a re-review raising "new problems" in
  code the pull request never touched is exactly the spiral this ticket
  closes. So the script interpolates the head SHA it recorded at both ends,
  which is also correct in a laptop worktree, where the two coincide. The head
  is reachable in either checkout — it is a parent of the merge commit — so no
  extra fetch is needed for the ancestor case.
- **Previous blockers skip the skeptic.** They survived one when they were
  raised; re-running it invites a finding to flip between rounds, which is the
  spiral this ticket is about. A previous blocker leaves the list by being
  fixed, not by being re-argued.
- **The script, not the model, demotes.** A model asked to self-police the
  blocker bar will keep calling its finding realistic. An empty `how` or `harm`
  is a machine-checkable fact, so the script checks it — the same reason the
  comment and the verdict line are composed rather than written.
- **QA's recheck probes are prepended by the script**, so a planner that
  forgets a previous bug cannot quietly close it.
- **The job files the follow-up issues, not an agent** — the same rule that
  keeps a model out of the verdict, and CI already runs with `--no-publish`.
- **Three follow-ups per pass, at most**, matching `MAX_FINDINGS`. A pass that
  wants to file ten has gone back to listing.

## Out of scope

- Ship's own in-loop audit — it has round caps and `STUCK_AFTER` already.
- Making any check required, or changing when the passes are triggered
  (`opened | reopened | ready_for_review`: draft-then-ready is still how you
  ask for a re-review).
- Closing a follow-up issue when the thing is fixed. A person does that.
