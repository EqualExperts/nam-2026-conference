# How the engineering harness works

A GitHub Issue goes in; a pull request that has already been specified,
tested, audited and fixed comes out — and then two independent passes judge it
before a person merges. This page is the whole machine in one place: what runs,
how hard each part works and why, and what it costs. The playbooks beside this
file say how each step is *done*; `docs/context/harness.md` is the map an agent
reads to change the machinery.

```
issue ──ship──▶ pull request ──▶ code review ─┐
  ▲                                   QA ─────┼──▶ you merge
  └── needs-human (draft PR + what is open) ◀─┘ (advisory, never blocking)
```

## The three workflows

| Workflow | Starts from | Does |
| --- | --- | --- |
| `ship` (`.claude/workflows/ship.js`) | `ready-for-ai` label, `@claude` on the issue, or `/ship 42` locally | Ticket → spec → spec audit → implement → gate ⇄ code audit → learn → PR |
| `code-review` (`code-review.js`) | the PR opening, or being marked ready | Reads the ticket first, then the diff; blockers must survive a skeptic |
| `qa` (`qa.js`) | the same | Plans probes, drives the app on both viewports, reproduces each failure on the branch **and** its base |

Each is a script, not a prompt: the control flow — loops, round limits, who
judges what — is code, and every step is a fresh agent that never sees the
reasoning of the one before it. That independence is what makes an audit an
audit.

## Ship

### The loop

1. **Setup** — reads the ticket, decides whether it is shippable, claims it
   (`ai-working`), makes the workspace, and **sizes it** (below).
2. **Spec** — `specs/<n>-<slug>.md`, pushed as the branch's first commit. Its
   *Where* is the builder's map: the files, the lines, the test file and the
   helpers, so the implementer searches for nothing.
3. **Spec audit** (full tickets) — a fresh agent judges the *plan* against the
   ticket and the context docs: does every Done-when map to a check that fails
   today? A finding that questions the ticket itself goes to a person; anything
   technical is decided in the spec and carried into the build. On a small
   ticket setup writes the spec and the code auditor checks its reading of the
   ticket — two agents fewer, each of which costs its whole context to start.
4. **Implement** — the check first, committed red; then the change; `npm test`
   after every edit; any browser test it wrote, run alone. It keeps the
   `docs/context/` docs that own what it changed true in the same push.
5. **Verify ⇄ code audit**, round after round:
   - **The gate** (`scripts/gate.mjs`): every unit test and the whole
     Playwright suite on desktop and mobile. Red → a fix round (a red gate does
     not spend the audit budget).
   - **Red-check** (`scripts/red-check.mjs`): reverts the app code and reruns
     the new tests. Tests that pass without the change prove nothing.
   - **Independent auditors** — the ticket's criteria, `CLAUDE.md`'s rules, a
     browser — and **a skeptic per blocker** that tries to refute it before it
     costs a fix. A minor never costs a round.
   - Clean round → out. The same finding surviving two fixes, or the round
     limit, → a **draft** PR and `needs-human`, with everything still open
     written down.
6. **Learn** — what the audits caught that the implementer missed, written
   back into the context docs, so the next ticket does not repeat it.
7. **PR** — ready for review, with the spec, the proof, and a table of every
   audit round.

### Small and full

Setup sizes every ticket. **Most are small.** A ticket is **full** if the issue
has the `ship:full` label, or it changes a rule in `server/lib`, the schema or
the seed, an API shape, several areas at once, or has more than four Done-when
criteria. Override with `/ship 42 --full` or `--small` (or `@claude --full` on
the issue).

| | Small | Full |
| --- | --- | --- |
| Model | Sonnet; Haiku for rote steps (gate, PR) | the session model (Opus in CI) |
| Spec | written by setup; its reading of the ticket checked by the code auditor | its own writer; criteria + fit auditors, up to 3 rounds |
| Code audit | 1 combined auditor | criteria + rules + browser lenses |
| Browser audit | only if something visible changed; 2 probes | always; 5 probes |
| Audited rounds | up to 2 | up to 4 |

Both keep what makes the result trustworthy: the gate, the red-check, an
independent audit and a skeptic on every blocker. What small drops is
redundancy. Ship puts `ship:full` on the PR of a full ticket, so code review
and QA scale with it.

## Code review and QA size themselves too

A one-line fix should not get the review a thousand-line change does.
`scripts/qa-facts.mjs` computes a size from facts, never from an agent's word:

- **code lines** — the diff without the spec and context docs every ship PR
  carries;
- **the ticket** — full if the PR is labelled `ship:full`;
- **risk** — `server/lib`, the schema and seed, the harness itself: never tiny,
  and large past 150 lines instead of 300;
- **the team's dial** — the `REVIEW_DEPTH` repository variable: `fast` moves a
  step down, `thorough` is always large.

| Size | Code review | QA |
| --- | --- | --- |
| tiny (≤30 lines) | one combined reviewer, Sonnet, low effort | ≤2 probes on Sonnet; may skip if the tests already pin it |
| small (≤300) | one combined reviewer, Sonnet | ≤3 probes on Sonnet |
| large | a lens per kind of file, on Opus | 5 probes on Opus |

### Confidence means coverage

Every verdict carries a confidence, and it is not a feeling:

- **Code review** — how much of the change the reviewers could actually judge.
- **QA** — every Done-when criterion mapped to what exercised it: a probe that
  ran, or a test file **this diff changes** (checked against the diff, so the
  planner cannot claim coverage it does not have). All covered and every probe
  ran → high.

A low-confidence pass reads as *unproven*, not green. Neither pass can block a
merge: machines gate (the tests, the gate re-run, the red-check); agents
advise.

**Reviews converge.** A re-review re-checks the previous blockers and reads
only what changed since. A blocker has to name a realistic path to harm — how
an attendee reaches it and what they lose; anything less is filed as a
`follow-up` issue while the check stays green.

## What it costs

Every ticket carries one **🧾 AI spend** comment, updated after every ship,
code review, QA and respond run: tokens and dollars per run, split by Opus,
Sonnet and Haiku, and the running total. Ship also comments its own run's line
on the PR it opened.

- **In CI** the numbers are what the CLI billed (list prices).
- **Locally** the runs use your Claude subscription, so there is no bill; the
  rows are priced from the transcripts at list rates and marked `~`.

Most of a run's cost is not output — it is every turn re-reading the agent's
context (~45k tokens before it does anything) and every agent writing that
context to the cache. So the harness is tuned for **fewer agents and fewer
turns**: steps read only the playbook sections they need, in one command; the
spec hands the implementer its map; rote steps (the gate, the PR) run on
Haiku; agents batch their reads; nothing re-runs a suite the gate just ran.

## Running it

**On GitHub** — label an issue `ready-for-ai` (or comment `@claude` on it).
Actions runs ship; code review and QA run when the PR opens. `@claude` on a
pull request asks for a change to that diff. Setup, keys and tokens:
[`github.md`](./github.md).

**On a laptop** — `/ship 42`, then `/code-review <pr>` and `/qa <pr>`. Each
ticket gets its own worktree, `orbit-wt-<n>` beside the main checkout, and its
own **lane** — a port pair from `scripts/lane.mjs` — so several tickets can
build, boot the app and run the suite at once without testing each other's
code. The gate stops any server its own worktree left running before it boots
its own.

## When it goes wrong

- **`needs-human`** — ship could not converge; the draft PR and the issue
  comment say what is still open. Answer it, relabel `ready-for-ai`.
- **An escape** — a blocker found after ship opened its PR is labelled
  `harness-escape`, and an agent proposes the lesson for the docs. That count
  is how the harness is tuned: with data, not argument.
- **Nothing ran** — a hand-back that quotes an `API Error` is the key's spend
  limit, not the code; every agent job keeps its transcript as an artifact for
  two weeks.
