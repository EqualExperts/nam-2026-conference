# 52 — Make code review and QA converge

Reviews spiral because every re-review starts from nothing and anything true
blocks. This makes a second look a *second look*: it checks the blockers it
raised last time and the commits pushed since, and it only turns the check red
for a problem someone will actually hit. Everything else is written down as a
follow-up issue rather than argued about in another round.

## What this changes

For the person merging — the audience for both passes, since neither is a
required check:

- **Every verdict comment ends with a marker** naming the commit it reviewed,
  the blockers it raised and the follow-ups it filed. It is an HTML comment, so
  it is invisible in the rendered thread and readable by the next run.
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
  `previous` — `{ commit, inHistory, blockers[], followUps[] }` — read back
  from the newest comment carrying the marker. `inHistory` is
  `git merge-base --is-ancestor <commit> HEAD`.
- `FINDINGS` items gain required `how` (the path through normal use) and
  `harm`; `severity` becomes `blocker | follow-up`. The script, not the model,
  demotes a `blocker` with an empty `how` or `harm`.
- A `SCOPE` paragraph, composed by the script and appended to every lens
  prompt: nothing on a first review; `git diff <commit>..HEAD` when the
  previous commit is an ancestor; `git fetch origin <commit>` then
  `git diff <commit> HEAD -- <the PR's files>` when it is not (a rebase). Each
  carries the "unless it would have blocked a first review" escape.
- A new **Recheck** phase before Verify: one agent per previous blocker,
  `recheck:<category>`, returning `{ resolved, why }`. Unresolved ones go
  straight into the confirmed list — they already survived a skeptic once, so
  they do not face another — and rank above this round's findings.
- `REFUTATION` gains `contrived`. `refuted` drops the finding; `contrived`
  without `refuted` makes it a follow-up; a dead skeptic still refutes nothing.
- `publish()` composes the marker, a **Follow-ups** section listing each one,
  and `followUps: [{ key, title, body }]` on the returned object (at most 3,
  minus any key in `previous.followUps`).

**`.claude/workflows/qa.js`** — the same four ideas, in QA's shapes:

- `PLAN` gains `head` and `previous` (`{ commit, inHistory, bugs[], followUps[] }`,
  each bug carrying the probe that found it). The plan prompt carries the same
  `SCOPE`.
- The script prepends every previous bug's probe to `plan.probes` and truncates
  to `MAX_PROBES`, so a planner that forgets one cannot drop it. A recheck
  probe that fails and reproduces is a bug without a skeptic; one that passes
  is reported as resolved.
- The skeptic's `contrived` turns a reproduced failure into a follow-up rather
  than a question — `LABEL` gains the wording.
- `publish()` emits the marker, the follow-up list and `followUps` for the job.

**`.github/workflows/agent-code-review.yml`, `agent-qa.yml`** — a *📌 File
follow-ups* step after *Publish the verdict*, reading `.followUps` from
`workflow-result.json` and calling `gh issue create --label follow-up`, falling
back to an unlabelled issue rather than losing one. Code review's job needs
`issues: write` for it (it has `read` today).

**`.github/workflows/setup.yml`** — `label follow-up …`, and the step title and
summary line stop claiming there are four labels.

**`docs/context/harness.md`** — the code-review and QA bullets under *After the
PR* gain the marker, the delta rule and the follow-up path; a new invariant for
the blocker bar; a gotcha for the rebase case and for `issues: write`.

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
| Verdict comments record the head commit, readably | `the comment ends with a marker naming the commit it reviewed` — asserts the marker line in `result.comment` for both scripts, and that it parses as JSON carrying `commit` and the raised blockers |
| A re-review looks only at the delta | `a re-review scopes the lenses to what changed since the last reviewed commit` — every `review:*` prompt contains `git diff <sha>..HEAD`; the QA twin asserts the plan prompt does |
| …and checks each previous blocker | `a re-review re-checks every previous blocker` — one `recheck:*` agent per previous blocker; QA: every previous bug's id is in the probe list even when the planner returned none of them |
| Rebase: limit to the PR's files since that commit | `a previous commit no longer in history scopes the review to the files the PR touches` — `inHistory: false` puts `git fetch origin <sha>` and `-- <files>` in the prompts |
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
