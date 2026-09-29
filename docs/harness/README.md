<div align="center">

# How the harness works

**Every step, every check, and why it is there**

</div>

![How agents work in this repo: a GitHub Issue goes to Ship, where an agent loop specs, builds, tests, audits and fixes until clean; then a pull request, independent code review and QA, and a person merges. A ticket that will not converge goes to needs-human with a draft PR.](../images/harness-flow.png)

The [main README](../../README.md) shows what the harness does. This page is
how: what runs, how hard each part works, what it costs, and what to do when it
goes wrong. The playbooks next to this file say how each step is *done*;
[`docs/context/harness.md`](../context/harness.md) is the map for changing the
machinery itself.

## 🧩 The pieces

| | Workflow | Starts when | What it does |
| --- | --- | --- | --- |
| 🚢 | **ship** — [`ship.js`](../../.claude/workflows/ship.js) | `ready-for-ai` on an issue, `@claude` on an issue, or `/ship 42` | Ticket → plan → build → test ⇄ audit → pull request |
| 🔍 | **code review** — [`code-review.js`](../../.claude/workflows/code-review.js) | a pull request opens, or is marked ready | Reads the ticket first, then the diff; every blocker must survive a skeptic |
| 🧪 | **QA** — [`qa.js`](../../.claude/workflows/qa.js) | the same | Drives the app on desktop and mobile, and reproduces each failure on the branch **and** on `main` |
| 💬 | **respond** — [`agent-respond.yml`](../../.github/workflows/agent-respond.yml) | `@claude …` on a pull request | Makes the change you asked for, runs the gate, replies |

Each workflow is a **script, not a prompt**: the loops, the round limits and
who judges what are code. Every step is a fresh agent that never sees the
reasoning of the one before it — that independence is what makes an audit an
audit.

## 🚢 Inside ship

| Step | What happens |
| --- | --- |
| **1. Setup** | Reads the ticket, checks it can be built, claims it (`ai-working`), makes an isolated workspace, and **sizes it** |
| **2. Plan** | A spec in `specs/<n>-<slug>.md`, the branch's first commit. Its *Where* names the files, lines, test file and helpers, so the builder searches for nothing |
| **3. Plan audit** | *Full tickets:* fresh agents judge the plan against the ticket. *Small tickets:* setup writes the plan and the code auditor checks its reading of the ticket later — two agents fewer |
| **4. Build** | The test first, committed while it still fails; then the change; every state it adds gets its own assertion, including the moment before a time-dependent one applies. The docs that describe what changed are updated in the same push |
| **5. Gate** | `scripts/gate.mjs`: every unit and browser test, desktop and mobile. Fails if any test fails — or if a test the branch added skipped everywhere and so never ran |
| **6. Red-check** | `scripts/red-check.mjs` puts the old code back and reruns the new tests. Tests that still pass prove nothing |
| **7. Audit** | Independent auditors — the ticket's criteria, `CLAUDE.md`'s rules, and a browser. **Every blocker faces a skeptic** that tries to refute it before it costs a fix |
| **8. Fix, and loop** | Back to the gate until a round comes back clean. A red gate does not use up an audit round |
| **9. Learn** | If the audits caught something, the lesson goes into the docs so the next ticket does not repeat it |
| **10. Pull request** | Ready for review: the spec, the proof, a table of every audit round, and the run's cost |

> **When it will not converge** — the same finding surviving two fixes, or the
> round limit — ship stops and opens a **draft** pull request labelled
> `needs-human`, with everything still open written down. It never burns
> rounds on a problem it cannot solve.

## ⚖️ Small tickets and full tickets

Setup sizes every ticket before any work starts. **Most are small.** A ticket is
**full** if it carries the `ship:full` label, or it changes a rule in
`server/lib`, the schema or the seed, an API shape, several areas at once, or
has more than four Done-when criteria. Override with `/ship 42 --full` or
`--small`.

| | 🟢 **Small** | 🔵 **Full** |
| --- | --- | --- |
| **Models** | Sonnet; Haiku for rote steps | Opus; Haiku for rote steps |
| **Plan** | written by setup | its own writer, then criteria + fit auditors, up to 3 rounds |
| **Audit** | one combined auditor | criteria, rules and browser auditors |
| **Browser audit** | only when something visible changed *and* no browser test covers it — 2 probes | always — 5 probes |
| **Audited rounds** | up to 2 | up to 4 |
| **Typical ship cost** | **~$1.70–2.70** | **~$5.50–6.25** |

Both keep what makes the result trustworthy: the gate, the red-check, an
independent audit and a skeptic on every blocker. Small drops redundancy, not
rigour. Ship labels a full ticket's pull request `ship:full`, so code review and
QA scale up with it.

## 🔍 How code review and QA size themselves

A one-line fix should not get the review a thousand-line change does.
[`scripts/qa-facts.mjs`](../../scripts/qa-facts.mjs) decides from facts, never
from an agent's word:

- 📏 **Code lines** — the diff, minus the spec and context docs every ship PR carries
- 🎫 **The ticket** — large if the PR is labelled `ship:full`
- ⚠️ **Risk** — `server/lib`, the schema, the seed, the harness: never tiny, and large past 150 lines
- 🎚️ **The team's dial** — the `REVIEW_DEPTH` variable: `fast` goes a step down, `thorough` is always large

| Size | Code review | QA |
| --- | --- | --- |
| **tiny** (≤30 lines, or docs only) | one reviewer, Sonnet, quick | ≤2 probes, Sonnet — skips when the PR's own tests already pin every criterion |
| **small** (≤300 lines) | one reviewer, Sonnet | ≤3 probes, Sonnet |
| **large** | a reviewer per kind of file, Opus | 5 probes, Opus |

### Confidence means coverage

Every verdict carries a confidence — never a feeling:

- **Code review:** how much of the change the reviewers could actually judge.
- **QA:** every Done-when criterion must be exercised — by a probe that ran, or
  by a test file **this diff changes** (checked against the diff, so it cannot
  claim coverage it does not have). A criterion about how the code is written,
  rather than what it does, is left to code review and named in the verdict.

A low-confidence pass shows as *unproven*, not green. Neither pass can block a
merge: **machines gate, agents advise.**

**Reviews converge.** A re-review checks the previous blockers and only what
changed since. A blocker must name a realistic path to harm — who reaches it
and what they lose; anything less becomes a `follow-up` issue and the check
stays green.

## 🧾 What it costs

Every issue keeps one **AI spend** comment, updated after every ship, review,
QA and respond run — tokens and dollars per run, split by Opus, Sonnet and
Haiku, with the total. Ship also posts its own run's cost on the pull request.

- **In GitHub Actions** — what the API billed, at list prices.
- **Locally** — your Claude subscription pays; the rows are priced from the
  run's transcripts at list rates and marked `~`. `/ship 64 65 66` is split per
  ticket.

**Where the money goes:** hardly any of it is output. It is every turn
re-reading the agent's context — about 45k tokens before it does anything — and
every agent writing that context to the cache. So the harness is tuned for
**fewer agents and fewer turns**:

| Saving | How |
| --- | --- |
| Cheaper cache | 5-minute cache writes (1.25× input) instead of 1-hour (2×) |
| Fewer agents | small tickets plan in setup; red-check runs inside the gate step; docs are kept true by the builder, not a separate agent |
| Lighter agents | the gate and the PR run on `ship-rote` — Haiku, no `CLAUDE.md`, ~26% less context |
| Fewer turns | reads batched into one command; playbook sections and context docs read by the piece; nothing re-runs a suite the gate just ran |

## ▶️ Running it

**On GitHub** — label an issue `ready-for-ai`, or comment `@claude` on it. Code
review and QA run when the pull request opens; `@claude` on the pull request
asks for a change. Keys, tokens and triggers: [`github.md`](./github.md).

**In Claude Code** — `/ship 42`, or `/ship 64 65 66` for several tickets in
parallel; then `/code-review <pr>` and `/qa <pr>`. Every ticket gets its own git
worktree and its own **lane** — a pair of ports from
[`scripts/lane.mjs`](../../scripts/lane.mjs) — so several tickets can build,
boot the app and run the whole suite at once without touching each other. The
gate stops any dev server its own worktree left running before it starts.

## 🚑 When it goes wrong

| You see | It means | Do this |
| --- | --- | --- |
| `needs-human` on the issue | Ship could not converge | Read its comment and the draft PR, answer, relabel `ready-for-ai` |
| `harness-escape` on a PR | Review or QA found a blocker ship's own loop missed | An agent proposes the lesson for the docs — that count is how the harness gets tuned |
| A hand-back quoting `API Error` | The API key's spend limit, not the code | Raise the limit; *Actions → Set up the harness* checks the key really works |
| Anything else odd | — | Every agent job keeps its full transcript as an artifact for two weeks |
