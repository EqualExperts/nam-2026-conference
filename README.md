# ORBIT '26 — an AI engineering harness

![How agents work in this repo: a GitHub Issue goes to Ship, where an agent loop specs, builds, tests, audits and fixes until clean; then a pull request, independent code review and QA, and a person merges. A ticket that will not converge goes to needs-human with a draft PR.](docs/images/harness-flow.png)

**You decide what to build and whether it ships. Agents do the work in
between — and every step leaves something you can read.**

Write a GitHub Issue. An agent writes a spec, a failing test, and the change;
runs every test on desktop and mobile; has the work audited by agents that
never saw its reasoning; and fixes what they find — round after round, until a
round comes back clean. Only then does it open a pull request. Two more agents
review it and QA it in a real browser. You merge.

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

## Two ways to work

### Entirely in GitHub — no terminal

1. **Write the issue:** a *why*, a *what*, and a **Done when:** list of outcomes
   a test could check.
2. **Label it `ready-for-ai`.** An agent picks it up; the issue shows its
   progress as it works.
3. **Review the pull request** like any other. Leave a comment starting with
   `@claude` and it makes the change and replies.
4. **Merge.**

Label ten issues and ten agents work at once.

### From Claude Code, in your terminal

```text
/ship 42                    one ticket
/ship 64 65 66 67 68        five tickets, in parallel
/ship 70 --full             force the full loop
/code-review 71             review a pull request
/qa 71                      QA it in a real browser
```

Each ticket gets its own git worktree (`orbit-wt-<n>` beside your checkout)
and its own ports, so five tickets can build, boot the app and run the whole
suite at the same time without touching each other — or your checkout.

## The right model for the ticket

A one-line fix should not cost what a new feature does. Every ticket is sized
before any work starts:

| | **Small** — most tickets | **Full** — a rule, an API, several areas, or `ship:full` |
| --- | --- | --- |
| Models | Sonnet, Haiku for the rote steps | Opus |
| Spec | written and checked inside the build | its own writer, 2 auditors |
| Audit | 1 combined auditor, up to 2 rounds | criteria + rules + browser lenses, up to 4 rounds |
| Typical cost | **~$2.70** | **~$6** |

Code review and QA size themselves the same way — from the ticket, the lines
of code that changed and how risky they are — so a copy fix gets one reviewer
and two browser probes, and a change to the seat rules gets every lens.

## What every ticket costs

Each issue carries a running **🧾 AI spend** comment, updated after every
ship, review and QA run, and ship posts its own run's cost on the pull request:

| Run | Tokens | Opus | Sonnet | Haiku | Cost |
| --- | --- | --- | --- | --- | --- |
| ship | 5.4M | — | $3.56 | $0.15 | $3.71 |
| code review | 1.4M | $0.99 | $0.77 | — | $1.76 |
| QA | 2.0M | $0.94 | $2.03 | — | $2.97 |
| **Total** | **8.7M** | **$1.93** | **$6.36** | **$0.15** | **$8.44** |

<sub>A real small ticket (#66), priced from its run. It predates this week's cost
work: a small ticket's ship run is now about $2.70, and code review and QA no
longer spend Opus on bookkeeping.</sub>

## Why you can trust what comes back

- **Artifacts you can read.** A spec before the code (`specs/`), a test that
  failed before the change, a table of every audit round in the pull request,
  and a verdict with a confidence on every review.
- **A deterministic gate.** Every unit and browser test, on desktop and mobile
  (`scripts/gate.mjs`), plus a check that the new tests fail without the change.
  Agents cannot talk their way past it.
- **Independent eyes.** Every blocker must survive a skeptic agent that tries to
  refute it; code review and QA never saw the reasoning that produced the
  change. QA is only *high confidence* when every Done-when was exercised.
- **The human stays in control.** Nothing merges itself. A ticket that will not
  converge comes back as `needs-human` with a draft pull request and a list of
  what is still open.

**How it all works, step by step: [docs/harness/README.md](docs/harness/README.md).**

## From meeting to ticket

The issues can come from a conversation. The skills in `.claude/skills/` turn a
meeting into tickets: `listen-to-meeting` flags gaps live, `transcribe-audio`
runs Whisper locally, `process-requirements` distils a transcript into a
proposal, `create-tasks` raises the issues, and `update-context` folds what was
agreed back into the docs.

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

## The app

The harness needs something real to build, so this repo is also **ORBIT '26**:
a conference companion app — seats and waitlists, clashing sessions, check-in
windows, ratings, and a clock that runs. **[About the app →](docs/APP.md)**

```bash
npm install && npm run dev     # seeds, then API + web on :5173
```

https://github.com/user-attachments/assets/7f3ea661-2e85-4895-b7b2-63f3d77a1674

## Read next

- **[docs/harness/README.md](docs/harness/README.md)** — the harness end to end.
- **[CLAUDE.md](CLAUDE.md)** — the conventions and decisions people and agents
  both work to.
- **[docs/context/](docs/context/README.md)** — one doc per area of the app;
  what agents read instead of the source.
- **[specs/](specs/)** — one file per ticket, written before the code: how the
  codebase got this way.
- **[docs/APP.md](docs/APP.md)** — the app itself.
