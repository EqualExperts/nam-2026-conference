# 53 — Show ship's progress on the issue while it works

## What this changes

Label a ticket `ready-for-ai` today and nothing happens on the issue for
anything up to two hours, until a pull request appears or the run hands back.
After this change the issue carries **one status comment, edited in place**,
from seconds after the run starts until it ends.

The comment exists before anything else does. The job's very first step —
before `actions/checkout@v7`, before `npm ci`, before Chromium or Claude Code
install — posts it itself, in plain `gh`, needing no checkout:

```
🚢 Ship · starting… · 0m elapsed · Run
```

with the run link and a `<!-- ship-progress run=<id> -->` marker. That is what
makes "within about a minute" true no matter how long setup takes: the post
does not wait on it. The same step reads the run's *own* start time
(`run_started_at`, fetched once from the Actions API) and hands it, and the
new comment's id, to every step after — so the elapsed figure stays honest for
the rest of the run. A run that spends four minutes on `npm ci` and Playwright
before `claude -p` even starts shows "4m elapsed" the moment the fuller render
replaces this placeholder, never "0m".

Once `claude -p` is streaming — typically three or four minutes in — the
follower takes over the *same* comment (found by the id the first step
already wrote down; it never searches) and starts replacing the placeholder
with the phase table:

```
🚢 Ship · small · 6m elapsed · Run

| Phase | |
| --- | --- |
| Setup | done |
| Spec | done — specs/53-ship-progress-comment.md |
| Spec Audit | done |
| Implement | done |
| Verify | done |
| Code Audit | running — 2 of 3 agents finished |
| Context | — |
| Learn | — |
| PR | — |

Round 1 — gate green (unit 262 passed · browser 161 passed) · 2 audits · clean
```

For the first minute or two of that fuller render the header still reads
`🚢 Ship · sizing… · 7m elapsed · Run`, because the tier is the setup agent's
own judgement and it has not returned yet (see *Decisions*) — but the comment,
and its elapsed time, have existed and been correct since seconds after the
run began; only the tier is late, and it appears the moment it is known. The
elapsed time and the running phase refresh on every edit. When the run ends
the same comment's last state says **Shipped**, with the pull request link;
or **Handed back**, with the stage and reason; or **The run died**, with the
run link — never "running" forever.

That last state is written **twice over**, because the commonest way a ship run
dies is the *Run /ship* step hitting its 100-minute timeout or being cancelled,
and that kills the whole process tree — the follower with it. So the last word
belongs to a separate `if: always()` step that runs after the CLI is gone,
reads the transcript left on disk and patches the comment to its settled state.
In a healthy run it finds the follower's last body already right and writes
nothing; in a killed one it is the only thing that runs.

While code review and QA run on a pull request, the same script puts one line
on the PR — `Reviewing…` / `Running QA…` with elapsed time — and replaces that
line with the verdict when it lands. The full review and QA comments are still
the job's.

None of this costs a model call. It is `gh` and a script reading the stream
`claude -p` already prints, and it cannot fail or slow the run: every `gh`
call is wrapped so a rate limit, a network blip or a malformed line leaves the
run untouched, and the follower runs beside the CLI, never in its pipe.

## Where

- **`.github/workflows/agent-ship.yml`** — a new step, **📣 Post the starting
  comment**, is the job's first step, ahead of `actions/checkout@v7`. It runs
  only `gh`, which the runner image already has, so it depends on nothing the
  checkout or `npm ci` provide. Its own `env:` — `GH_TOKEN`
  (`secrets.AGENT_GITHUB_TOKEN || secrets.GITHUB_TOKEN`), `GH_REPO`, `N` (the
  issue number) — matches the pattern the cleanup step already uses. It:
  1. reads the run's own start with
     `gh api repos/$GH_REPO/actions/runs/$GITHUB_RUN_ID --jq .run_started_at`
     — the job's existing `actions: read` permission already covers this, so
     nothing in `permissions:` changes;
  2. creates the comment with
     `gh api repos/$GH_REPO/issues/$N/comments -f body=… --jq .id`, which
     hands back the new id directly as JSON, rather than parsing it out of the
     URL `gh issue comment` prints;
  3. appends `SHIP_PROGRESS_STARTED=<that timestamp>` and
     `SHIP_PROGRESS_COMMENT_ID=<that id>` to `$GITHUB_ENV`.

  Unlike the per-step `env:` blocks the rest of this job repeats — a
  documented gotcha, because Actions `env:` is per-step — `$GITHUB_ENV` is
  exactly the mechanism for a value one step computes and every later step
  needs, so nothing downstream re-declares these two; they are just there.
  Every command in the step is wrapped (`|| true` around the `gh` calls, and
  the `$GITHUB_ENV` appends guarded on the value being non-empty) so that a
  `gh` failure here cannot fail the step or hold up checkout — it leaves the
  two variables unset instead, which the fallbacks below cover.

  The *Run /ship* step's `env:` is unchanged (`SHIP_PROGRESS_ISSUE`,
  `SHIP_PROGRESS_RUN`, `GH_REPO`) — `SHIP_PROGRESS_STARTED` and
  `SHIP_PROGRESS_COMMENT_ID` reach it, and the finish step after it, through
  `$GITHUB_ENV` automatically.

  The **🏁 Finish the progress comment** step (`if: ${{ always() }}`,
  `continue-on-error: true`, its own `env:` naming `GH_TOKEN`, `GH_REPO`,
  `SHIP_PROGRESS_ISSUE`, `SHIP_PROGRESS_RUN`, immediately after *Run /ship* and
  before the cleanup step) no longer depends on the follower having lived long
  enough to cache anything: `$GITHUB_ENV` entries are written once, by the
  pre-checkout step, and last for the rest of the job regardless of what
  happens to *Run /ship* — so even a run killed a minute into Code Audit,
  before the follower has rendered anything, still has both
  `SHIP_PROGRESS_STARTED` and `SHIP_PROGRESS_COMMENT_ID` when `finish` runs.

- **`scripts/ship-progress.mjs`** (new) — the follower and the finisher. Pure
  functions plus a thin wrapper around each:
  - `readStream(lines)` → `{ tier, branch, spec, phases, rounds, outcome,
    ended }`. It reads three event shapes the CLI prints (recorded from a real
    run, see *Decisions*):
    - `system/task_started` with `task_type: 'local_workflow'` — signals the
      CLI has begun streaming (used only to say "waiting for Claude Code to
      start" versus nothing at all; **not** used for elapsed time, see below);
    - `system/task_progress`, whose `workflow_progress` is the **cumulative**
      array of `{type:'workflow_phase', index, title}` (every phase from
      `meta.phases`, announced up front) and `{type:'workflow_agent', index,
      label, phaseTitle, state, resultPreview}` with `state` one of
      `start | progress | done | error`;
    - `system/task_notification` with `status` and `output_file` — the end; the
      file holds ship's return value (`result.outcome`).
  - `readPreview(text)` → the fields a truncated `resultPreview` still
    carries. Previews are capped at 400 characters and the interesting ones
    arrive cut mid-string, so this unescapes `\"` and lifts what it finds by
    regex — the tier, the branch, the spec path, and from a gate line
    `ok`, `unit.passed/failed`, `browser.passed` and the first failing test —
    rather than `JSON.parse`ing (see *Decisions*).
  - `render(state, { issue, runUrl, now, started })` → the comment markdown,
    including the marker `<!-- ship-progress run=<id> -->`. `started` is
    supplied by the caller, never read off the stream (see *Decisions* — this
    is the fix for the timing criterion the first spec audit round flagged).
    It prints only the gate fields `readPreview` found: a round whose unit
    tests failed shows `gate red (unit 260 passed, 2 failed)` with no browser
    count, because the failure output pushed it past the cap.
  - `prLine(state, { kind, now })` → the one-line PR status; unchanged from
    the design below, `started` there still comes from the stream's own
    `task_started` (see *Decisions* on why this file's two callers differ).
  - `follow()` — reads `SHIP_PROGRESS_STARTED` and `SHIP_PROGRESS_COMMENT_ID`
    from the environment once at start, then polls the transcript file for
    new bytes, re-renders with the fixed `started`, and **patches that id**
    on every render — it does not create, because the pre-checkout step
    already did. Only when `SHIP_PROGRESS_COMMENT_ID` is unset (that step
    failed or never ran) does it fall back to this design's original plan:
    search for the marker, and create fresh if nothing is found. When
    `SHIP_PROGRESS_STARTED` is unset, `started` falls back to the stream's own
    `task_started` — degraded, but the same number the original design would
    have shown throughout, never a crash.
  - `finish({ killed })` — the one-shot pass, with the same environment
    variables and the same fallbacks as `follow()`. It reads the transcript
    file *once*, renders the final state, and patches the comment. With no
    `task_notification` and no workflow result file, the state is **died**,
    and `killed` supplies the reason — "the step timed out or was cancelled".
    Idempotent: if the body it renders equals what is already there, it
    writes nothing.
  - The command line is `node scripts/ship-progress.mjs follow|finish`.
- **`scripts/agent-run.sh`** — starts the follower in the background before
  `claude -p`, and reaps it after. It runs only when `SHIP_PROGRESS_ISSUE` or
  `SHIP_PROGRESS_PR` is set, so a laptop run is unchanged. It does **not** own
  the final render: a step kill never reaches the line after `claude`.
- **`.github/workflows/agent-code-review.yml`**, **`agent-qa.yml`** — the *Run
  /code-review* and *Run /qa* steps get `SHIP_PROGRESS_PR`,
  `SHIP_PROGRESS_KIND` (`review` / `qa`), `SHIP_PROGRESS_RUN` and `GH_REPO`;
  each job gets the same `always()` finish step, again with its own `env:`
  naming `GH_TOKEN`, `GH_REPO`, `SHIP_PROGRESS_PR`, `SHIP_PROGRESS_KIND` and
  `SHIP_PROGRESS_RUN` — the died state is "Review did not finish" *with the run
  link*, and neither workflow defines a run URL today. The token is
  `secrets.GITHUB_TOKEN`, not the personal one, for the reason those jobs
  already give: their comments must not read as the author reviewing their own
  pull request. Both jobs already hold `pull-requests: write`. The publish
  steps run on `!cancelled()`, so they are not this. Neither job gets a
  pre-checkout post — see *Decisions* on why that fix is ship-only.
  `scripts/ship-progress.mjs` joins the harness paths both jobs check out from
  the base branch beside `scripts/agent-run.sh`.
- **`.claude/workflows/ship.js`** — one change: in the `SETUP` schema, `size`
  moves above `doneWhen` in `properties`. The setup agent's `resultPreview` is
  capped at 400 characters and `doneWhen` is verbatim ticket text, so with the
  present order the tier falls off the end of the preview. Nothing about
  sizing itself changes.
- **`docs/context/harness.md`** — a *Progress on the issue* section under *How
  it works*, covering the pre-checkout post, the follower, the `always()`
  finish step that settles the comment when the run's step is killed, why
  elapsed time is measured from the run's own start rather than the CLI's, and
  what each final state means; the two new files in its `files:`/`tests:`
  front matter (the ownership check in `tests/unit/context.test.js` fails
  until they are there), and a gotcha recording that `log()` output is **not**
  live.
- **`tests/unit/ship-progress.test.js`** (new) — the checks below.

## How it will be proved

Every check is a unit test — most over recorded stream events with the GitHub
call injected as a stub, a few parsing the workflow YAML as text — no browser,
no network, no model. `npm test` runs them; `node scripts/gate.mjs` is the
gate.

| Criterion | Check | Layer |
| --- | --- | --- |
| A comment within about a minute, with the elapsed time and the run link | A workflow-parsing test on `agent-ship.yml` asserts the first step in the `ship` job's `steps:` list — ahead of `actions/checkout@v7` — calls `gh api` against `actions/runs/`, calls `gh api` against `issues/…/comments` with a body containing the marker and the run URL, and appends `SHIP_PROGRESS_STARTED` and `SHIP_PROGRESS_COMMENT_ID` to `$GITHUB_ENV`. Separately, `render()` given a `started` a few seconds before `now` and an otherwise-empty state returns markdown containing `sizing…`, `0m`, and the run URL, proving the *follower's* first render is just as fast once it starts — together the two checks cover the handover, since the literal first comment is written in the workflow, not by this function | unit |
| Elapsed time reflects the run's real age, not the CLI's | `render()` given a `started` five minutes before `now`, fed a stream whose own `task_started` timestamp claims the run began one minute ago, prints `5m elapsed` — never `1m`. `follow()`'s wrapper is exercised with `SHIP_PROGRESS_STARTED` set in its injected environment and a stream that starts later, asserting it is the env var, not the stream, that reaches `render()` | unit |
| …naming the tier, once there is one to name | appending the setup agent's `done` event, with `{"size":"small",…}` in its `resultPreview`, makes the next `render()` say `small` — and `follow()` `patch`es it in, because a tier change is one of the things that skips the throttle | unit |
| Edited in place, never a new comment | `follow()` given `SHIP_PROGRESS_COMMENT_ID` in its environment and driven over a stream appended in three chunks calls `patch` three times on that same id and never `create`s; every body carries the same `<!-- ship-progress run=… -->` marker. A second case, with that variable absent, exercises the fallback: `create`s once (nothing found by marker), then `patch`es the id it got back on every render after | unit |
| Each phase done / running / not started, and the running phase's finished agents | `readStream()` on the mid-run fixture gives `Setup…Verify: done`, `Code Audit: running`, `Context/Learn/PR: not started`; `render()` prints `running — 2 of 3 agents finished` for Code Audit and `—` for the untouched phases | unit |
| The spec is linked when pushed | the fixture's `write-spec` agent is `done` with `resultPreview` `{"path":"specs/53-…md",…}`; `render()` links `blob/<branch>/specs/53-…md`, taking the branch from the setup agent's preview, and prints the bare path when the branch is unknown | unit |
| Each finished build round shows its gate and audit result | both fixtures' `verify#n` previews are built the way the CLI builds them, from a realistically sized gate result: `JSON.stringify({ json: JSON.stringify(result) }).slice(0, 400)`, so the test inherits the truncation instead of hand-sizing round it. Green (~300 characters, intact): `render()` prints `Round 1 — gate green (unit 262 passed · browser 161 passed) · 2 audits · clean`. Red, from a result carrying twelve lines of unit `output` and a named browser failure with a six-line error — a preview cut mid-string, on which `JSON.parse` throws: `render()` prints `Round 2 — gate red (unit 260 passed, 2 failed) · 1 audit · fix ran`, and the body nowhere says `not known` | unit |
| The final state is shipped / handed back / died | four `render()` cases: `result.outcome='shipped'` → `Shipped` and the PR url; `'needs-human'` → `Handed back at Code Audit — <reason>`; a stream whose last line is a `task_notification` with `status:'failed'`, and a stream that just stops with no notification at all → `The run died` with the run link. None contains the word `running` | unit |
| A killed step still settles the comment | `finish()` over the mid-run fixture — the transcript of a run cut off inside Code Audit, no notification, no result file — with `SHIP_PROGRESS_COMMENT_ID` and `SHIP_PROGRESS_STARTED` in its injected environment (as the pre-checkout step would have left them) and an injected `gh` stub: it calls `patch` once on that id, and the body says `The run died — the step timed out or was cancelled` with the run link, the tier and the phases it did reach, elapsed counted from the injected `started`, and nowhere says `running`. Two more cases: the same call with `SHIP_PROGRESS_COMMENT_ID` absent and a stub whose list returns the marker `create`s nothing and `patch`es the found id; with neither the variable nor a marker match, it `create`s. And `finish()` over a *complete* shipped transcript, given the body it already rendered, writes nothing | unit |
| …and the workflow actually calls it, with an environment | a test reads `agent-ship.yml`, `agent-code-review.yml` and `agent-qa.yml`, splits each into steps on the six-space `- name:` / `- uses:` boundary (no YAML dependency for three files). For ship, it asserts the pre-checkout step exists, precedes `actions/checkout@v7`, and wraps its `gh` calls so a failure cannot propagate (no unguarded non-zero exit reaches the step's own result). For all three files it takes the step whose `run:` mentions `ship-progress.mjs finish`: each must be guarded by `if: ${{ always() }}`, be `continue-on-error: true`, **and carry its own `env:` block naming `GH_TOKEN`, `GH_REPO`, `SHIP_PROGRESS_RUN` and `SHIP_PROGRESS_ISSUE` (ship) or `SHIP_PROGRESS_PR` and `SHIP_PROGRESS_KIND` (review, QA)** — a step inheriting nothing is the silent failure this catches, and an edit to `!cancelled()` or `success()`, or a dropped key, has to break a test | unit |
| No model calls; a failure never fails or slows the run | `follow()` and `finish()` with a stub that throws on every call still return normally and still consume the whole stream (asserting the throw was swallowed); a grep-style assertion that the script imports nothing from the Agent SDK and spawns no `claude`; the same for the pre-checkout step's shell (checked above); and, in `agent-run.sh`, the follower is backgrounded and reaped with `|| true` — asserted by a test that reads the script and checks the CLI's stdout still goes to the transcript file, not into a pipe | unit |
| Empty or malformed stream | `readStream([])`, `readStream(['', 'not json', '{"type":"assistant"}'])` and a `task_progress` whose `workflow_progress` is missing/`null` all return a usable state, and `render()` of each, given a `started`, produces a comment that says the run has not reported yet — no throw. A `verify` preview that is prose, and one truncated before `"ok"`, both render `gate not known yet` rather than a guess | unit |
| Reviewing… / Running QA… on the PR, replaced by the verdict | `prLine()` mid-run returns `Reviewing… · 3m`, and after a `task_notification` whose output file holds `result.verdictLine` returns that verdict line; the QA variant reads `Running QA…` | unit |
| `docs/context/harness.md` describes it | `tests/unit/context.test.js` already fails while a tracked file under `scripts/` or `tests/` is owned by no doc — adding the two files to `harness.md` is what makes it pass | unit |

The renderer tests are written first and confirmed red against an empty
`scripts/ship-progress.mjs`; the ownership check is confirmed red by adding the
new script without touching the doc; the workflow-parsing tests are confirmed
red against `agent-ship.yml` as it stands on `main` today, which has no
pre-checkout step and no `finish` step at all.

## Decisions

- **The stream really does carry live progress, and it was measured, not
  assumed.** A throwaway three-agent workflow was run under
  `claude -p --output-format stream-json --verbose`, and its transcript is
  where every shape in `readStream()` comes from. Two things that recording
  settled: `workflow_progress` arrives on `system/task_progress` and is
  cumulative (so the follower can be stateless and re-derive everything from
  the last such event), and **`log()` output does not appear live** — it is
  only in the workflow's output file at the end. That rules out the obvious
  design, which was to have `ship.js` log milestones for the updater to read.
- **So the milestones come from agents' `resultPreview`**, capped at 400
  characters: the spec path from `write-spec`, the gate line from `verify#n`,
  the tier and branch from `setup`.
- **A preview is read with a regex, never `JSON.parse`, because the one that
  matters arrives truncated.** `gate.mjs` prints its whole result object, and
  the verify agent hands that back inside `{"json":"<escaped line>"}`
  (`GATE`, `ship.js:144`). Escaped, a *green* line is already about 300
  characters; a red one is far past 400, because a failing unit run adds up to
  twelve lines of `output` (`gate.mjs:137`) and every browser failure carries a
  full test path plus the first six lines of its error (`gate.mjs:45`, and 600
  characters of stderr when no report was written, `gate.mjs:121`). So the
  preview of a red gate is cut
  mid-string and `JSON.parse` throws on it — parsing strictly would print "not
  known" for exactly the rounds a person opens the comment to read.
  `readPreview()` therefore unescapes `\"` and lifts what is present:
  `"ok":true|false`, `"unit":{"passed":N,"failed":N`, `"browser":{"passed":N`
  and the first `"test":"…"`. All of those sit at the front of the object, so
  `ok` and the unit counts always survive the cap and the browser count
  survives a green round; what falls off the end is simply not printed.
  Nothing is guessed: a preview with no readable `ok` renders as "gate not
  known yet", because a status comment that invents a gate result is worse
  than one that omits it. The same leniency covers a truncated `setup` or
  `write-spec` preview.
- **The gate is read from the preview, not from `test-results/gate.json`**,
  even though the follower runs on the same machine as the agent that wrote
  it. That file only ever holds the *last* round, it is rewritten while the
  next round runs — so a read can catch it half-written — and the runner's own
  re-check writes a second copy under `$RUNNER_TEMP/recheck`. The previews are
  per-round and already in the stream.
- **The tier is what forces the one change to `ship.js`.** Reordering `SETUP`'s
  properties so `size` precedes the verbatim `doneWhen` list is the smallest
  thing that puts the tier inside the preview. Until the setup agent returns,
  the comment says `sizing…` rather than picking a default.
- **The elapsed time is measured from the run's own start, never from the
  CLI's `task_started` — this is the fix for the blocker the first spec audit
  round raised.** That round's objection was correct: `scripts/agent-run.sh`
  cannot start the follower until checkout, `npm ci`, the Playwright and
  Claude Code installs have all finished, three to four minutes in on a cold
  cache, so a follower that only knew "now" from the CLI's own `task_started`
  event would under-report the run's real age by exactly that much — the one
  thing a status comment about a long-running process cannot get wrong. The
  fix is two-fold: a step *before all of that setup* posts the first comment,
  so "within about a minute" no longer depends on how long setup takes at
  all; and every render after it — the follower's and `finish`'s — takes
  `started` from `run_started_at`, fetched once by that same step from
  `GET /repos/{owner}/{repo}/actions/runs/{run_id}` (`gh api
  repos/$GH_REPO/actions/runs/$GITHUB_RUN_ID --jq .run_started_at`) and handed
  down through `$GITHUB_ENV`, not from anything the CLI reports. `render()`
  and `prLine()`'s ship-side caller therefore take `started` as a parameter
  rather than reading `state.started`; only `readStream()`'s reading of
  `task_started` remains, and only to say "waiting for Claude Code to start"
  before the CLI has produced anything else. A documented, unverifiable
  alternative — a `github.run_started_at` context expression — was
  considered and rejected: it does not appear in GitHub's published `github`
  context (which has `run_id`, `run_number`, `run_attempt`, but no started
  timestamp), so the only field actually documented to carry it is the
  Actions API's `run_started_at`, fetched with a call the job's existing
  `actions: read` permission already allows.
- **So "within about a minute" is met by a step, not by the follower.** The
  smallest thing that can run before checkout is `gh` alone — it is already on
  the runner image, needs no `npm ci` and no repository on disk — so the new
  first step is plain shell, not `scripts/ship-progress.mjs`; that script does
  not exist on disk until the checkout after it. It composes the initial body
  itself (`🚢 Ship · starting… · 0m elapsed · Run`, the marker, the run link),
  creates the comment, and stashes both the id and `run_started_at` for every
  step after. This also removes the previous design's dependency on the
  follower having survived long enough to cache the id itself: because
  `$GITHUB_ENV` entries are written once and persist for the rest of the job
  no matter what happens to a later step, even a run killed a minute into
  Code Audit — before the follower has patched anything — still has both
  values when `finish` runs.
- **So the first-minute comment still cannot literally name the tier, and
  that is fine.** "Within about a minute … naming the tier" cannot be honoured
  down to the word: the tier is the setup agent's judgement, and that agent
  reads the ticket, checks the base branch, relabels and branches before it
  returns — itself a couple of minutes once the CLI is even running. Guessing
  `small` for the interval would put a wrong tier in front of a person, and a
  status comment that invents a fact is the thing this spec is most careful
  not to do. What the pre-checkout step guarantees within the minute is the
  comment itself, with a correct elapsed time and the run link; the tier
  appears in the same comment the moment the follower has one to show, a
  render or two after it takes over.
- **The pre-checkout fix is ship-only.** Code review and QA have no "within
  about a minute" criterion — their Done-when only asks for a one-line status
  that appears "while" they run, on a pass that is itself five to fifteen
  minutes long, not two hours — so their PR line keeps reading `started` off
  the CLI stream's `task_started`, as `prLine()` already did before this
  round. Giving both of those jobs their own pre-checkout post and API call
  for a criterion neither ticket asks them to meet would be solving a problem
  they do not have.
- **A killed step is the commonest death, so the finaliser cannot live inside
  the step.** *Run /ship* is bounded by `timeout-minutes: 100` inside a
  120-minute job. When that fires — or someone cancels — GitHub kills the
  step's process group: `agent-run.sh` never reaches the line after `claude`,
  and the backgrounded follower dies with it, mid-render. An earlier draft of
  this spec had the follower own the final state, which meant the comment
  stayed "running" forever in exactly the case people most need to read it.
  Hence `finish`, in its own `always()` step, outside the killed tree. It is
  cheap to run in the healthy case (one file read, one no-op) and is the only
  thing that runs in the unhealthy one.
- **Every step that touches GitHub from context or secrets declares its own
  environment; a value one step computes for later ones travels through
  `$GITHUB_ENV` instead.** Actions `env:` is per-step, and none of these three
  jobs has a job-level block — the cleanup step in `agent-ship.yml` repeats
  `GH_TOKEN`, `GH_REPO`, `N` and `RUN` for that reason, and the finish steps
  still do. But `SHIP_PROGRESS_STARTED` and `SHIP_PROGRESS_COMMENT_ID` are not
  `secrets.*` or `github.*` expressions available to every step regardless —
  they are computed once, by the pre-checkout step, so `$GITHUB_ENV` (which
  exists precisely for that) is what carries them forward; nothing downstream
  repeats them. A finish step that inherited nothing of the *secrets* kind
  would fail on its first `gh` call, and `continue-on-error` plus its own
  guards would swallow it: the feature would look installed and never write a
  word. That risk is why a test still asserts `GH_TOKEN`, `GH_REPO` and the
  rest are named on each finish step's own `env:` — see the proof table.
- **`finish` derives the outcome from what is on disk, not from the step's
  exit.** `$RUNNER_TEMP` survives between steps in a job, so the transcript is
  still there. A `task_notification` or a `workflow-result.json` means the run
  reported; their absence means it did not, and that is what "died" is. The
  step's own conclusion is not consulted — the *Run /ship* step exits 0 on a
  ship that returned an error, which is why the cleanup step next door already
  reads the issue's labels instead.
- **What is still not covered: the runner itself dying, or the pre-checkout
  step failing outright.** If the job is lost (hardware, a spot runner
  reclaimed, the 120-minute job bound overrunning a cancelled step's grace),
  no step runs and the comment keeps its last render. If the very first `gh`
  calls themselves fail — a total GitHub outage, most plausibly — no comment
  ever appears, and every later step's `SHIP_PROGRESS_STARTED` /
  `SHIP_PROGRESS_COMMENT_ID` reads are the fallbacks in *ship-progress.mjs*'s
  bullet above, which end in "search, then create" rather than a working
  handover. Nothing in this repo executes at that point, so there is no fix
  inside it for the first case; the run's own Actions page conclusion is the
  fallback. Worth writing down rather than claiming the case away.
- **The follower tails the transcript file; it is never in the CLI's pipe.**
  `claude … | tee out | node ship-progress.mjs` would be shorter, but if the
  follower died the CLI would take an `EPIPE` — the updater would then be able
  to kill the run it exists to report on, which the ticket explicitly forbids.
  Backgrounding a reader of the file the CLI is already writing costs one
  process and cannot touch the run.
- **A phase is done when it has agents and none of them is running.** Ship
  revisits phases — Verify and Code Audit once per round, and `handBack()`
  jumps back to `Learn` — so anything that assumes phases only move forward
  would show a finished phase as running, or the reverse. This rule needs no
  ordering at all.
- **Edits are throttled to one every ~20 seconds**, plus one immediately
  whenever the rendered body changes phase, round or outcome. A run is up to
  two hours long and GitHub's secondary rate limits are real; a status comment
  that gets the run throttled would be self-defeating.
- **The comment is found by its id, known from the moment it exists — the
  marker search is a fallback, not the mechanism.** The pre-checkout step
  hands the id to every later step via `$GITHUB_ENV`, so an edit never
  searches in the ordinary path. Only if that step's own `gh` calls failed
  does anything search by marker, exactly as an earlier version of this
  design always did; and only if that search also finds nothing does anything
  create a comment after the run has already started. A second run on the
  same ticket still gets its own comment either way, because it is a
  different run (a new `run_id`, hence a new marker) and its predecessor's
  final state is still worth reading.
- **The PR status stays one line.** The job's *Publish the verdict* step still
  posts the full review and QA comments; the follower only replaces its own
  line with the verdict line, so a reviewer opening a PR mid-review sees that
  something is happening instead of silence. The same `finish` step settles it
  when the review or QA step is killed — `Review did not finish` with the run
  link — because *Publish the verdict* is guarded by `!cancelled()` and so
  never runs in that case.

## Out of scope

- The job summary (`agent-summary.mjs`) — it already reports the whole run
  after the fact, and nothing about it changes.
- The check runs the review and QA jobs create, and the runner's own gate
  re-run comment on a red pull request.
- Progress for `agent-respond.yml`, which is interactive and short.
- A pre-checkout post, or an `actions: read` API call, for code review or QA —
  neither ticket criterion needs it (see *Decisions*).
- Any change to what ship does, how it is sized, or when it hands back.
