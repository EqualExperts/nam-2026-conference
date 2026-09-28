
https://github.com/user-attachments/assets/7f3ea661-2e85-4895-b7b2-63f3d77a1674

# ORBIT '26

A conference companion app for a fictional applied-AI conference in Las Vegas —
four days, ~140 sessions, 110 speakers, two venues six miles apart.

It is the sample application for a workshop on using AI across the software
delivery lifecycle. **A voice note goes in one end. A merged pull request comes
out the other.** You decide what to build and what to ship; agents do the rest.

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

## The pipeline

```
transcript · voice note ──process-requirements──▶ proposal ──create-tasks──▶ GitHub Issue
GitHub Issue ──ready-for-ai──▶ ship ──▶ pull request ──▶ code review + QA ──▶ you merge
                                 └──▶ needs-human (draft PR, what is still open) ──▶ you answer, relabel
```

How each part works, how hard it looks at which change, and what it costs:
**[docs/harness/README.md](./docs/harness/README.md)**.

## Two harnesses

**Product** decides what to build. **Engineering** builds it. They meet at a
GitHub Issue. The product skills are markdown in `.claude/skills/`; the
engineering side is three workflow scripts in `.claude/workflows/`, each
following a playbook in `docs/harness/` — together, that is the harness.

| | Skill | What it does |
| --- | --- | --- |
| 🎙️ | `listen-to-meeting` | Listens live, flags contradictions and gaps while they can still be settled in the room |
| 🎙️ | `transcribe-audio` | Whisper, locally — no hosted service, no account |
| 📋 | `process-requirements` | Distils a transcript into durable knowledge and actionable work; surfaces conflicts |
| 📋 | `create-tasks` | Raises the tickets — goal first, deduplicated, one goal each |
| 📋 | `update-context` | Folds agreed knowledge back into the project's docs |
| ⚙️ | `ship` *(workflow)* | Ticket → spec ⟲ audit → code → verify ⇄ independent audit ⟲ → learn → PR |
| ⚙️ | `code-review` *(workflow)* | Sized to the change: one reviewer or a lens per kind of file → a skeptic per blocker → verdict with a confidence |
| ⚙️ | `qa` *(workflow)* | Plans probes → drives Chromium on both viewports → reproduces each failure on the branch and its base |

## How a ticket moves

`ready-for-ai` (you label it) → `ai-working` (ship claimed it) → `ready-for-human`
(audit clean, PR open) → you merge. A ticket ship cannot converge on goes to
`needs-human` with a draft PR; answer it and relabel `ready-for-ai`.

**`ship` loops until it is satisfied, then stops.** It writes a spec into
`specs/` as the branch's first commit, and an agent that did not write it
audits the plan before any code exists. It writes a check that fails first,
keeps the context docs true as it goes, and then, round after round: the gate
(`scripts/gate.mjs` — every test, desktop and mobile), a red-check that the new
tests fail without the change, independent auditors, and a skeptic that tries
to refute each blocker before it costs a fix. **No pull request until a round
comes back clean.** A ticket that will not converge goes to you as a **draft**
saying what is still open. Most tickets are *small* — one auditor, Sonnet, two
rounds; `ship:full` gets the whole loop. Every agent starts from
[`docs/context/`](./docs/context/README.md), a map of the app, instead of
reading the source, and every ticket carries a running **🧾 AI spend** comment.

**Then two agents read it**, neither having seen the reasoning that produced it
— the agent who wrote it cannot see its own misreading. Each publishes a
**confidence**, meaning coverage rather than conviction: a low-confidence pass
shows as *unproven*, not green.

Comment `@claude …` on the pull request and it makes the change and replies.
You still merge.

## How we review

Every agent pull request gets an independent **code review** and **QA** pass —
but how hard they look follows the risk, the way a real team's would, and a
red review is information for the person merging, not a gate.

- **Machines gate; agents advise.** The tests, the gate re-run and the red-check
  are deterministic and cheap — those are what a team would make required. The
  AI passes publish a verdict with a confidence and never block a merge.
- **Depth follows risk.** A docs change gets one reader and no QA; a small app
  change, or one `ship` already audited, gets one combined reviewer on Sonnet;
  the harness, the server's rules and large changes get every lens, on Opus.
  QA skips exploring a cosmetic change its tests already pin.
- **The team sets the dial.** *Settings → Secrets and variables → Actions →
  Variables*: `REVIEW_DEPTH` = `fast`, `balanced` (default) or `thorough`.
- **Reviews converge.** A re-review checks the previous blockers and only what
  changed since; a blocker must name a realistic path to harm, and anything
  less becomes a `follow-up` issue while the check stays green.
- **We measure whether it is enough.** A blocker found after `ship` opened its
  pull request is labelled `harness-escape`, and an agent proposes the lesson —
  so the dial is tuned with data, not argued about.

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
- **[docs/context/](./docs/context/README.md)** — one doc per area of the app;
  what agents read instead of the source.
- **[specs/](./specs/)** — one file per ticket, written before the code.
  Together, the record of how this codebase got this way.
- **[docs/DATA_MODEL.md](./docs/DATA_MODEL.md)** — the schema.
