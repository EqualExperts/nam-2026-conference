
https://github.com/user-attachments/assets/7f3ea661-2e85-4895-b7b2-63f3d77a1674

# ORBIT '26

A conference companion app for a fictional applied-AI conference in Las Vegas —
four days, ~140 sessions, 110 speakers, two venues six miles apart.

It is the sample application for a workshop on using AI across the software
delivery lifecycle, and it ships with the **engineering harness** that builds
it: a GitHub Issue goes in, a specified, tested and independently audited pull
request comes out, and you decide what merges.

```bash
npm install && npm run dev     # seeds, starts API + web on :5173
```

No login — pick an attendee from the switcher. Two of them are also speaking.

> [!IMPORTANT]
> **Forked or copied this repo? The agents will not run until you do this.**
> A fork copies the workflows but **not the labels**, and has **no API key** —
> so labelling an issue `ready-for-ai` silently does nothing.
>
> 1. **Settings → Secrets and variables → Actions →** add `ANTHROPIC_API_KEY`
>    (a key scoped to a *workspace* — an org-level key is refused).
> 2. **Actions → Set up the harness → Run workflow.** Creates the labels and
>    tells you in its summary anything else that is missing.
>
> Five minutes, once. [Full checklist ↓](#set-up-your-fork)

## Working in this repo

You decide **what** to build and **whether it ships**. Agents do the building
in between, and every step leaves something you can read.

```
idea ──▶ GitHub Issue ──▶ ship ──▶ pull request ──▶ code review + QA ──▶ you merge
                            └──▶ needs-human: a draft PR and what is still open
```

### 1. Write the ticket

An issue with a **why**, a **what**, and a **Done when:** list of outcomes a
test could check — that list is what everything downstream is judged against.
From a meeting, `process-requirements` turns a transcript into a proposal and
`create-tasks` raises the issues; or write one by hand.

### 2. Ship it

- **On GitHub:** label it `ready-for-ai`. Actions runs `ship`; the issue shows
  its progress as it goes.
- **On your laptop:** `/ship 42` in Claude Code. It works in its own worktree
  (`orbit-wt-42` beside your checkout) on its own ports, so you can keep
  working — or ship several tickets at once.

`ship` writes a spec, has it audited, writes a failing check, builds, then
loops — the full test suite, an independent audit, a skeptic on every blocker,
a fix — until a round comes back clean, and only then opens the pull request.
Most tickets get the **small** loop (one auditor, Sonnet); the `ship:full`
label, or `/ship 42 --full`, gets the whole one. A ticket it cannot finish
comes back as `needs-human` with a draft pull request saying why: answer it,
relabel. `@claude <notes>` on the issue ships it again with your notes.

### 3. Read what came back

Every pull request gets an independent **code review** and **QA** pass, sized
to the change — a one-line fix gets one reviewer and two probes, a large change
gets every lens. Each posts a verdict with a **confidence** that means
coverage: QA is only *high* when every Done-when criterion was exercised. A red
verdict is information, not a gate. `@claude <what to change>` on the pull
request makes the change and replies.

### 4. Merge — and see what it cost

You merge. Every issue carries a **🧾 AI spend** comment — each ship, review
and QA run's tokens and dollars, split by Opus, Sonnet and Haiku, with the
total — so the ticket says what it cost without anyone adding it up.

**How the machine works, how hard it looks at what, and why:**
**[docs/harness/README.md](./docs/harness/README.md)**.

## Changing code yourself

People and agents follow the same rules, so read **[CLAUDE.md](./CLAUDE.md)**
first — the architecture, the conventions and the decisions behind them. Then:

- **Start from [`docs/context/`](./docs/context/README.md)**, one doc per area
  of the app. `node scripts/context.mjs for <file>` says which docs own a file;
  a change that makes one wrong updates it in the same commit.
- **A spec before the code** for anything non-trivial:
  `specs/<issue>-<slug>.md`, the branch's first commit.
- **`npm test` after every edit** (under a second); **`node scripts/gate.mjs`**
  before you call it done — every test on desktop and mobile, as the agents
  run it.
- **Conventional Commits**, the body saying *why*.

## Changing the harness

The harness is code in this repo, tested like the app:

- `.claude/workflows/` — `ship.js`, `code-review.js`, `qa.js`: the control
  flow, as scripts.
- `docs/harness/` — the playbooks each step follows, and the
  [overview](./docs/harness/README.md).
- `scripts/` — the deterministic parts: `gate.mjs`, `red-check.mjs`,
  `qa-facts.mjs` (review sizing), `ai-cost.mjs` (spend), `lane.mjs` (ports).
- `tests/unit/` — the workflows run under stubs; `npm test` covers them.
- `docs/context/harness.md` — the map for changing any of it.

An agent in CI may not edit `.claude/`; a ticket that needs to is handed back
to be built locally.

## Set up your fork

Once per fork, in this order. Step 3 tells you if you missed 1, 2 or 4.

1. **Turn on Issues.** Settings → General → Features → tick *Issues*. GitHub
   switches them off on a fork, and issues are where every ticket lives.
2. **Add the API key.** Settings → Secrets and variables → Actions → New
   repository secret, named `ANTHROPIC_API_KEY`. **It must be scoped to a
   workspace** — an org-level key is refused, and the error does not say why.
3. **Create the labels: Actions → *Set up the harness* → Run workflow.**
   Neither a fork nor a template copy brings labels with it, and
   `ready-for-ai` is what starts everything. The run's summary checks the key,
   the token and Issues, and says what is still missing.
   (On a repository made *from the template* it runs by itself on the first
   commit; on a fork it does not.)
4. **Settings → Actions → General → Workflow permissions → tick *Allow GitHub
   Actions to create and approve pull requests*.** Off by default on every new
   repository. Without it the agent does all the work, pushes a green branch,
   and then cannot open the pull request.

That is all. Each agent pull request opens with **"workflows awaiting
approval"** — click it once and its checks run. That is GitHub's behaviour for
anything `github-actions[bot]` opens, and there is no setting that disables
it. Treat the click as the feature it resembles: a human checkpoint before any
agent work executes.

<details>
<summary>Running this repeatedly, and tired of clicking?</summary>

Add `AGENT_GITHUB_TOKEN` — a **fine-grained** token for this repository only,
with Contents, Issues and Pull requests set to read and write. Not a classic
token: the agent reads issue text anyone can edit, and a classic `repo` token
reaches every repository you own.
The pull request is then authored by you rather than the bot, so nothing waits
for approval and CI re-runs on the agent's own pushes. It also covers step 4
on its own.

Worth it if you are demonstrating this. Not worth handing to a room of people:
even a fine-grained token is a real credential, and one click is cheaper than
forty of them.
</details>

Then open an issue with a **Done when:** clause, label it `ready-for-ai`, and
watch the Actions tab.

## Commands

| | |
| --- | --- |
| `npm run dev` | Seed, then API + web together |
| `npm test` | Unit + API — no browser, under a second |
| `npm run verify` | Playwright, desktop and mobile (`node scripts/gate.mjs` is both suites, as the agents run them) |
| `npm run shot -- /schedule` | Screenshot a route |
| `npm run db:reset` | Rebuild the database — Day 1 becomes today |
| `node scripts/lane.mjs claim 42` | A port pair, so several agents can work at once |

Node 22 · Express · better-sqlite3 · React 18 · Vite 6 · Tailwind v4 ·
Playwright. No ORM, no state library, no component kit.

**The conference is always today.** Seeding makes Day 1 the day you run it, so
you arrive mid-conference and the clock ticks while you watch. Pin it with
`?at=YYYY-MM-DDTHH:MM`.

## Read next

- **[docs/harness/README.md](./docs/harness/README.md)** — how the engineering
  harness works: ship's loop, small vs full, how review and QA size
  themselves, what confidence means, and what a ticket costs.
- **[CLAUDE.md](./CLAUDE.md)** — architecture, conventions, and *why*. What the
  review agent checks a change against.
- **[`.claude/skills/`](./.claude/skills/)** — the product side:
  `listen-to-meeting`, `transcribe-audio`, `process-requirements`,
  `create-tasks`, `update-context`.
- **[docs/context/](./docs/context/README.md)** — one doc per area of the app;
  what agents read instead of the source.
- **[specs/](./specs/)** — one file per ticket, written before the code.
  Together, the record of how this codebase got this way.
- **[docs/DATA_MODEL.md](./docs/DATA_MODEL.md)** — the schema.
