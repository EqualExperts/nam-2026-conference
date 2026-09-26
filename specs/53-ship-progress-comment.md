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

The elapsed time and the running phase refresh on every edit. When the run
ends the same comment's last state says **Shipped**, with the pull request
link; or **Handed back**, with the stage and reason; or **The run died**, with
the run link — never "running" forever.

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
  - `render(state, { issue, runUrl, now })` → the comment markdown, including
    the marker `<!-- ship-progress run=<id> -->`.
  - `prLine(state, { kind, now })` → the one-line PR status.
  - `follow()` — polls the transcript file for new bytes, re-renders, and
    posts once / patches thereafter through an injected `gh` function.
- **`scripts/agent-run.sh`** — starts the follower in the background before
  `claude -p`, and reaps it after. It runs only when `SHIP_PROGRESS_ISSUE` or
  `SHIP_PROGRESS_PR` is set, so a laptop run is unchanged.
- **`.github/workflows/agent-ship.yml`** — sets `SHIP_PROGRESS_ISSUE` and
  `SHIP_PROGRESS_RUN` on the *Run /ship* step.
- **`.github/workflows/agent-code-review.yml`**, **`agent-qa.yml`** — set
  `SHIP_PROGRESS_PR` and `SHIP_PROGRESS_KIND`, and add
  `scripts/ship-progress.mjs` to the list of harness paths they check out from
  the base branch beside `scripts/agent-run.sh`.
- **`.claude/workflows/ship.js`** — one change: in the `SETUP` schema, `size`
  moves above `doneWhen` in `properties`. The setup agent's `resultPreview` is
  capped at 400 characters and `doneWhen` is verbatim ticket text, so with the
  present order the tier falls off the end of the preview. Nothing about
  sizing itself changes.
- **`docs/context/harness.md`** — a *Progress on the issue* section under *How
  it works*, the two new files in its `files:`/`tests:` front matter (the
  ownership check in `tests/unit/context.test.js` fails until they are there),
  and a gotcha recording that `log()` output is **not** live.
- **`tests/unit/ship-progress.test.js`** (new) — the checks below.

## How it will be proved

Every check is a unit test over recorded stream events, with the GitHub call
injected as a stub — no browser, no network, no model. `npm test` runs them;
`node scripts/gate.mjs` is the gate.

| Criterion | Check | Layer |
| --- | --- | --- |
| A comment within about a minute, naming tier, elapsed time and the run link | `render()` on a stream holding only `task_started` plus the first `task_progress` (all nine phases, one agent started) returns markdown containing `small`, `0m`/`1m` from an injected `now`, and the run URL — and `follow()` against that stream calls its stub **once**, with `create` | unit |
| Edited in place, never a new comment | `follow()` driven over a stream appended in three chunks calls `create` once and `patch` twice, with the same comment id, and every body carries the same `<!-- ship-progress run=… -->` marker | unit |
| Each phase done / running / not started, and the running phase's finished agents | `readStream()` on the mid-run fixture gives `Setup…Verify: done`, `Code Audit: running`, `Context/Learn/PR: not started`; `render()` prints `running — 2 of 3 agents finished` for Code Audit and `—` for the untouched phases | unit |
| The spec is linked when pushed | the fixture's `write-spec` agent is `done` with `resultPreview` `{"path":"specs/53-…md",…}`; `render()` links `blob/<branch>/specs/53-…md`, taking the branch from the setup agent's preview, and prints the bare path when the branch is unknown | unit |
| Each finished build round shows its gate and audit result | the fixture's `verify#1` preview carries the gate JSON line; `render()` prints `Round 1 — gate green (unit 262 passed · browser 161 passed) · 2 audits · clean`, and a second fixture with `verify#2` red and `fix#2` present prints `gate red · … · fix ran` | unit |
| The final state is shipped / handed back / died | four `render()` cases: `result.outcome='shipped'` → `Shipped` and the PR url; `'needs-human'` → `Handed back at Code Audit — <reason>`; a stream whose last line is a `task_notification` with `status:'failed'`, and a stream that just stops with no notification at all → `The run died` with the run link. None contains the word `running` | unit |
| No model calls; a failure never fails or slows the run | `follow()` with a stub that throws on every call still returns normally and still consumes the whole stream (asserting the throw was swallowed); a grep-style assertion that the script imports nothing from the Agent SDK and spawns no `claude`; and, in `agent-run.sh`, the follower is backgrounded and reaped with `|| true` — asserted by a test that reads the script and checks the CLI's stdout still goes to the transcript file, not into a pipe | unit |
| Empty or malformed stream | `readStream([])`, `readStream(['', 'not json', '{"type":"assistant"}'])` and a `task_progress` whose `workflow_progress` is missing/`null` all return a usable state, and `render()` of each produces a comment that says the run has not reported yet — no throw | unit |
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
  the tier and branch from `setup`. Anything that does not parse is rendered as
  "not known yet" rather than guessed — a status comment that invents a gate
  result is worse than one that omits it.
- **The tier is what forces the one change to `ship.js`.** Reordering `SETUP`'s
  properties so `size` precedes the verbatim `doneWhen` list is the smallest
  thing that puts the tier inside the preview. Until the setup agent returns,
  the comment says `sizing…` rather than picking a default.
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
  cached in `$RUNNER_TEMP` after the first post, so an update never searches.
  A second run on the same ticket gets its own comment, because it is a
  different run and its predecessor's final state is still worth reading.
- **The PR status stays one line.** The job's *Publish the verdict* step still
  posts the full review and QA comments; the follower only replaces its own
  line with the verdict line, so a reviewer opening a PR mid-review sees that
  something is happening instead of silence.

## Out of scope

- The job summary (`agent-summary.mjs`) — it already reports the whole run
  after the fact, and nothing about it changes.
- The check runs the review and QA jobs create, and the runner's own gate
  re-run comment on a red pull request.
- Progress for `agent-respond.yml`, which is interactive and short.
- Any change to what ship does, how it is sized, or when it hands back.
