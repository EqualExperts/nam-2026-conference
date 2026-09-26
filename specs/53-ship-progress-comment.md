# 53 — Show ship's progress on the issue while it works

## What this changes

Label a ticket `ready-for-ai` today and nothing happens on the issue for
anything up to two hours, until a pull request appears or the run hands back.
After this change the issue carries **one status comment, edited in place**,
from seconds after the run starts until it ends:

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

For the first two or three minutes the header reads `🚢 Ship · sizing… · 1m
elapsed · Run`, because the tier is the setup agent's answer and it has not
given one yet (see *Decisions*). The elapsed time and the running phase
refresh on every edit. When the run
ends the same comment's last state says **Shipped**, with the pull request
link; or **Handed back**, with the stage and reason; or **The run died**, with
the run link — never "running" forever.

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

None of this costs a model call. It is a script reading the stream `claude -p`
already prints, and it cannot fail or slow the run: it runs beside the CLI,
never in its pipe, and everything it does is wrapped so that a GitHub error, a
malformed line or a crash leaves the run untouched.

## Where

- **`scripts/ship-progress.mjs`** (new) — the whole feature. Pure functions
  plus a thin follower:
  - `readStream(lines)` → `{ started, tier, branch, spec, phases, rounds,
    outcome, ended }`. It reads three event shapes the CLI prints (recorded
    from a real run, see *Decisions*):
    - `system/task_started` with `task_type: 'local_workflow'` — the run began;
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
  - `render(state, { issue, runUrl, now })` → the comment markdown, including
    the marker `<!-- ship-progress run=<id> -->`. It prints only the gate
    fields `readPreview` found: a round whose unit tests failed shows
    `gate red (unit 260 passed, 2 failed)` with no browser count, because the
    failure output pushed it past the cap.
  - `prLine(state, { kind, now })` → the one-line PR status.
  - `follow()` — polls the transcript file for new bytes, re-renders, and
    posts once / patches thereafter through an injected `gh` function.
  - `finish({ killed })` — the one-shot pass. It reads the transcript file
    *once*, renders the final state, and patches the comment whose id is
    cached in `$RUNNER_TEMP` (falling back to a marker search, and to posting
    fresh if the follower never got that far). With no `task_notification` and
    no workflow result file, the state is **died**, and `killed` supplies the
    reason — "the step timed out or was cancelled". Idempotent: if the body it
    renders equals what is already there, it writes nothing.
  - The command line is `node scripts/ship-progress.mjs follow|finish`.
- **`scripts/agent-run.sh`** — starts the follower in the background before
  `claude -p`, and reaps it after. It runs only when `SHIP_PROGRESS_ISSUE` or
  `SHIP_PROGRESS_PR` is set, so a laptop run is unchanged. It does **not** own
  the final render: a step kill never reaches the line after `claude`.
- **`.github/workflows/agent-ship.yml`** — the *Run /ship* step's `env:` gains
  `SHIP_PROGRESS_ISSUE`, `SHIP_PROGRESS_RUN` and `GH_REPO`, and a *🏁 Finish
  the progress comment* step follows it directly, `if: ${{ always() }}`,
  `continue-on-error: true`, running `node scripts/ship-progress.mjs finish ||
  true`. **That step carries its own `env:` block** — `GH_TOKEN`
  (`secrets.AGENT_GITHUB_TOKEN || secrets.GITHUB_TOKEN`, as the *Run* and
  cleanup steps use), `GH_REPO`, `SHIP_PROGRESS_ISSUE`, `SHIP_PROGRESS_RUN` —
  because Actions `env:` is per-step and nothing in this job is declared at job
  level; that is exactly why *🧹 Check what the run left behind* re-declares
  the same four variables next door. A finish step relying on inheritance would
  run with no token and no issue number, and its `|| true` would hide it, so
  the workflow test below asserts the keys are there. The step is deliberately
  before the cleanup step, whose gate re-run takes minutes and whose branches
  `exit 0` early.
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
  steps run on `!cancelled()`, so they are not this. `scripts/ship-progress.mjs`
  joins the harness paths both jobs check out from the base branch beside
  `scripts/agent-run.sh`.
- **`.claude/workflows/ship.js`** — one change: in the `SETUP` schema, `size`
  moves above `doneWhen` in `properties`. The setup agent's `resultPreview` is
  capped at 400 characters and `doneWhen` is verbatim ticket text, so with the
  present order the tier falls off the end of the preview. Nothing about
  sizing itself changes.
- **`docs/context/harness.md`** — a *Progress on the issue* section under *How
  it works*, covering the follower, the `always()` finish step that settles the
  comment when the run's step is killed, and what each final state means; the
  two new files in its `files:`/`tests:` front matter (the
  ownership check in `tests/unit/context.test.js` fails until they are there),
  and a gotcha recording that `log()` output is **not** live.
- **`tests/unit/ship-progress.test.js`** (new) — the checks below.

## How it will be proved

Every check is a unit test over recorded stream events, with the GitHub call
injected as a stub — no browser, no network, no model. `npm test` runs them;
`node scripts/gate.mjs` is the gate.

| Criterion | Check | Layer |
| --- | --- | --- |
| A comment within about a minute, with the elapsed time and the run link | `render()` on a stream holding only `task_started` plus the first `task_progress` (all nine phases, the setup agent `start`ed) returns markdown containing `sizing…`, `0m`/`1m` from an injected `now`, and the run URL — and `follow()` against that stream calls its stub **once**, with `create` | unit |
| …naming the tier, once there is one to name | appending the setup agent's `done` event, with `{"size":"small",…}` in its `resultPreview`, makes the next `render()` say `small` — and `follow()` `patch`es it in, because a tier change is one of the things that skips the throttle | unit |
| Edited in place, never a new comment | `follow()` driven over a stream appended in three chunks calls `create` once and `patch` twice, with the same comment id, and every body carries the same `<!-- ship-progress run=… -->` marker | unit |
| Each phase done / running / not started, and the running phase's finished agents | `readStream()` on the mid-run fixture gives `Setup…Verify: done`, `Code Audit: running`, `Context/Learn/PR: not started`; `render()` prints `running — 2 of 3 agents finished` for Code Audit and `—` for the untouched phases | unit |
| The spec is linked when pushed | the fixture's `write-spec` agent is `done` with `resultPreview` `{"path":"specs/53-…md",…}`; `render()` links `blob/<branch>/specs/53-…md`, taking the branch from the setup agent's preview, and prints the bare path when the branch is unknown | unit |
| Each finished build round shows its gate and audit result | both fixtures' `verify#n` previews are built the way the CLI builds them, from a realistically sized gate result: `JSON.stringify({ json: JSON.stringify(result) }).slice(0, 400)`, so the test inherits the truncation instead of hand-sizing round it. Green (~300 characters, intact): `render()` prints `Round 1 — gate green (unit 262 passed · browser 161 passed) · 2 audits · clean`. Red, from a result carrying twelve lines of unit `output` and a named browser failure with a six-line error — a preview cut mid-string, on which `JSON.parse` throws: `render()` prints `Round 2 — gate red (unit 260 passed, 2 failed) · 1 audit · fix ran`, and the body nowhere says `not known` | unit |
| The final state is shipped / handed back / died | four `render()` cases: `result.outcome='shipped'` → `Shipped` and the PR url; `'needs-human'` → `Handed back at Code Audit — <reason>`; a stream whose last line is a `task_notification` with `status:'failed'`, and a stream that just stops with no notification at all → `The run died` with the run link. None contains the word `running` | unit |
| A killed step still settles the comment | `finish()` over the mid-run fixture — the transcript of a run cut off inside Code Audit, no notification, no result file — with an injected `gh` stub and the comment id read from a temp cache: it calls `patch` once on that id, and the body says `The run died — the step timed out or was cancelled` with the run link, the tier and the phases it did reach, and nowhere says `running`. Two more cases: the same call with no cached id and a stub whose list returns the marker `create`s nothing and `patch`es the found id; with neither, it `create`s. And `finish()` over a *complete* shipped transcript, given the body it already rendered, writes nothing | unit |
| …and the workflow actually calls it, with an environment | a test reads `.github/workflows/agent-ship.yml`, `agent-code-review.yml` and `agent-qa.yml`, splits each into steps on the six-space `- name:` / `- uses:` boundary (no YAML dependency for three files), and takes the step whose `run:` mentions `ship-progress.mjs finish`. Each must be guarded by `if: ${{ always() }}`, be `continue-on-error: true`, **and carry its own `env:` block naming `GH_TOKEN`, `GH_REPO`, `SHIP_PROGRESS_RUN` and `SHIP_PROGRESS_ISSUE` (ship) or `SHIP_PROGRESS_PR` and `SHIP_PROGRESS_KIND` (review, QA)** — a step inheriting nothing is the silent failure this catches, and an edit to `!cancelled()` or `success()`, or a dropped key, has to break a test | unit |
| No model calls; a failure never fails or slows the run | `follow()` with a stub that throws on every call still returns normally and still consumes the whole stream (asserting the throw was swallowed); a grep-style assertion that the script imports nothing from the Agent SDK and spawns no `claude`; and, in `agent-run.sh`, the follower is backgrounded and reaped with `|| true` — asserted by a test that reads the script and checks the CLI's stdout still goes to the transcript file, not into a pipe | unit |
| Empty or malformed stream | `readStream([])`, `readStream(['', 'not json', '{"type":"assistant"}'])` and a `task_progress` whose `workflow_progress` is missing/`null` all return a usable state, and `render()` of each produces a comment that says the run has not reported yet — no throw. A `verify` preview that is prose, and one truncated before `"ok"`, both render `gate not known yet` rather than a guess | unit |
| Reviewing… / Running QA… on the PR, replaced by the verdict | `prLine()` mid-run returns `Reviewing… · 3m`, and after a `task_notification` whose output file holds `result.verdictLine` returns that verdict line; the QA variant reads `Running QA…` | unit |
| `docs/context/harness.md` describes it | `tests/unit/context.test.js` already fails while a tracked file under `scripts/` or `tests/` is owned by no doc — adding the two files to `harness.md` is what makes it pass | unit |

The renderer tests are written first and confirmed red against an empty
`scripts/ship-progress.mjs`; the ownership check is confirmed red by adding the
new script without touching the doc.

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
- **So the first-minute comment names the tier as `sizing…`, and the ticket's
  wording is not quite met.** "Within about a minute … naming the tier" cannot
  be honoured literally: the tier is the setup agent's judgement, and that
  agent reads the ticket, checks the base branch, relabels and branches before
  it returns — two or three minutes. The only sources available at second zero
  are a `ship:full` label or a `--full`/`--small` flag, which cover a small
  minority of runs; guessing `small` for the rest would put a wrong tier in
  front of a person for the first minutes of most runs, and a status comment
  that invents a fact is the thing this spec is most careful not to do. What
  is met within the minute is the comment itself, with elapsed time and the run
  link; the tier appears in the same comment the moment it exists.
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
- **Every step that touches GitHub declares its own environment.** Actions
  `env:` is per-step, and none of these three jobs has a job-level block — the
  cleanup step in `agent-ship.yml` repeats `GH_TOKEN`, `GH_REPO`, `N` and `RUN`
  for that reason. A finish step that inherited nothing would fail on its first
  `gh` call, and `continue-on-error` plus `|| true` would swallow it: the
  feature would look installed and never write a word. Hoisting the variables
  to job level would be less repetition but would put `AGENT_GITHUB_TOKEN` in
  front of `npm ci` and the checkout, and would break the review and QA jobs'
  deliberate split between the personal token and `GITHUB_TOKEN`. So the keys
  are repeated on the step, and a test asserts they are there.
- **`finish` derives the outcome from what is on disk, not from the step's
  exit.** `$RUNNER_TEMP` survives between steps in a job, so the transcript and
  the cached comment id are both still there. A `task_notification` or a
  `workflow-result.json` means the run reported; their absence means it did
  not, and that is what "died" is. The step's own conclusion is not consulted —
  the *Run /ship* step exits 0 on a ship that returned an error, which is why
  the cleanup step next door already reads the issue's labels instead.
- **What is still not covered: the runner itself dying.** If the job is lost
  (hardware, a spot runner reclaimed, the 120-minute job bound overrunning a
  cancelled step's grace), no step runs and the comment keeps its last render.
  Nothing in this repo executes at that point, so there is no fix inside it; the
  comment carries the run link and its elapsed time is visibly stale, and the
  job's own conclusion on the Actions page is the fallback. Worth writing down
  rather than claiming the case away.
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
- **The comment is found by a marker carrying the run id**, and the id is
  cached in `$RUNNER_TEMP` after the first post, so an update never searches —
  except `finish`, which searches by marker if the cache is missing, since it
  may be running after a follower that died before it could write the cache.
  A second run on the same ticket gets its own comment, because it is a
  different run and its predecessor's final state is still worth reading.
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
- Any change to what ship does, how it is sized, or when it hands back.
