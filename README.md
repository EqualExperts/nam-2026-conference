<div align="center">

# The AI Engineering Harness

**From GitHub issue to reviewed pull request — built live on ORBIT '26**

</div>

![How agents work in this repo: a GitHub Issue goes to Ship, where an agent loop specs, builds, tests, audits and fixes until clean; then a pull request, independent code review and QA, and a person merges. A ticket that will not converge goes to needs-human with a draft PR.](docs/images/harness-flow.png)

## In one minute

- ✍️ **You write a ticket** — a GitHub issue saying what should be true when it is done.
- 🤖 **An agent ships it** — writes a plan, a failing test and the code, then runs
  every test on desktop and mobile.
- 🔍 **Other agents check the work** — they never saw how it was written, and
  every problem they raise has to survive a skeptic before it costs a fix.
- 🔁 **It loops until clean** — only then does a pull request open.
- ✅ **You decide** — review it like any PR, ask for changes in a comment, merge.

Run as many tickets at once as you like. Every ticket shows what it cost.

> **Forked this repo?** It needs an API key and one setup click first —
> [five minutes, once ↓](#set-up-your-fork)

## 👀 See it for real

Everything the harness does leaves a trail on GitHub. Two real tickets, label to
merged pull request on GitHub Actions, nobody touching a terminal:

| | 🟢 A small ticket | 🔵 A bigger ticket |
| --- | --- | --- |
| **Pull request** | [PR #96 — name the search when nothing matches](https://github.com/EqualExperts/nam-2026-conference/pull/96) | [PR #97 — fix Undo after removing an ended seat](https://github.com/EqualExperts/nam-2026-conference/pull/97) |
| 🚢 **Ship** | 12 min — Sonnet, one audit round | 22 min — Opus, plan audit and three audit lenses |
| 🔍 **Code review** | High confidence, about a minute | High confidence, about a minute |
| 🧪 **QA** | Skipped in 16 seconds — two lines, covered by the PR's own tests | High confidence — 3 browser probes, every criterion exercised |
| 🧾 **AI spend** | **$0.91** | **$7.99** |

Each pull request has it all — what the agents wrote, checked and found, the
screenshots, the verdicts, the cost — and links back to its issue. Every issue
also keeps a running **🧾 AI spend** comment, updated after each agent run and
split by Opus, Sonnet and Haiku, so a ticket always says what it cost.

## Two ways to work

### 🌐 In GitHub — no terminal needed

| | |
| --- | --- |
| **1. Write the issue** | Why, what, and a **Done when:** list a test could check — *New issue → Ticket for the agents* gives you the shape |
| **2. Label it `ready-for-ai`** | An agent picks it up and posts its progress on the issue |
| **3. Review the pull request** | Comment `@claude …` and it makes the change and replies |
| **4. Merge** | Or don't — nothing merges itself |

Label ten issues and ten agents get to work.

<details>
<summary><b>What a good ticket looks like</b></summary>

> **Pluralise the schedule's agenda count**
>
> The *My agenda* count in the schedule's filter rail reads "1 sessions", and
> calls the selected day "today" even when it is not.
>
> **Done when**
> - With exactly one reservation the rail reads "1 session", not "1 sessions".
> - With another day selected, the rail names that day instead of "today".
> - The `starred-count` test id still contains only the bare number.

Short, specific, and every line is something a test can check. That shipped as
[#74](https://github.com/EqualExperts/nam-2026-conference/pull/74).
</details>

### 💻 In Claude Code — from your terminal

| Command | What happens |
| --- | --- |
| `/ship 42` | Ship one ticket |
| `/ship 64 65 66 67 68` | Ship five tickets **in parallel** |
| `/ship 70 --full` | Force the thorough loop |
| `/code-review 71` | Review a pull request |
| `/qa 71` | Test it in a real browser |

Every ticket works in its own isolated copy of the repo, on its own ports — so
five can build, run the app and test at the same time without getting in each
other's way, or yours.

## 💸 The right model for the job

A one-line fix should not cost what a new feature does, so every ticket is
sized before any work starts:

| | 🟢 **Small** — most tickets | 🔵 **Full** — rules, APIs, bigger changes |
| --- | --- | --- |
| Models | Sonnet · Haiku for routine steps | Opus |
| Checks | one independent auditor | several, each with its own focus, plus a browser |
| Fix rounds | up to 2 | up to 4 |
| Typical ship cost | **~$0.70** | **~$6.50** |

Code review and QA size themselves the same way: a copy fix gets one reviewer
and a couple of browser checks; a change to the booking rules gets everything.
Add the `ship:full` label to any issue to ask for the thorough loop.

## 🛡️ Why you can trust what comes back

| | |
| --- | --- |
| 📄 **Artifacts you can read** | A plan before the code, a test that failed before the fix, every audit round in the PR, and a confidence on every review |
| 🚦 **A gate agents can't argue with** | Every test, desktop and mobile, plus proof the new tests fail without the change |
| 👀 **Independent eyes** | Reviewers never see the reasoning behind the change; every blocker has to survive a skeptic |
| 🙋 **You stay in control** | Nothing merges itself. A ticket that won't come together returns as `needs-human`, with a draft PR and what's still open |

**Step by step, under the hood → [docs/harness/README.md](docs/harness/README.md)**

## 🎙️ From meeting to ticket

The harness builds tickets — but a ticket can start as a conversation. The
product-side skills, from Abraham's [winnow](https://github.com/quiram/winnow),
turn a meeting or a voice note into issues that are ready to ship:

| Step | Skill | What you get |
| --- | --- | --- |
| 🎧 **Listen** | `listen-to-meeting` | A live transcript, and a flag the moment two people contradict each other or something is left unsaid — while it can still be settled in the room |
| ✍️ **Transcribe** | `transcribe-audio` | A voice note or recording turned into text on your machine (Whisper) — no hosted service, no account |
| 🧠 **Distil** | `process-requirements` | The decisions and the work pulled out of the noise, with gaps and conflicts raised for you to agree |
| 🎫 **Raise** | `create-tasks` | GitHub issues — goal first, one goal each, no duplicates, each with a **Done when** list |
| 📚 **Remember** | `update-context` | What was agreed written back into the docs the agents read, so the next ticket knows it |

Then label the issues `ready-for-ai`, or `/ship` them, and the harness takes it
from there. First time on a Mac? Run `setup-audio` once — it sets up the
microphone, system audio and the Whisper model in one guided pass.

<a id="set-up-your-fork"></a>

## ⚙️ Set up your fork

Once per fork, in this order — step 3 tells you if you missed anything.

1. **Turn on Issues** — Settings → General → Features → *Issues*. GitHub turns
   them off on a fork, and every ticket lives there.
2. **Add the API key** — Settings → Secrets and variables → Actions → New
   repository secret `ANTHROPIC_API_KEY`. It must be a **workspace** key; an
   organisation-level key is refused, and the error does not say why.
3. **Run Actions → *Set up the harness*** — creates the labels (a fork does not
   copy them), makes one tiny test call to check the key really works, and lists
   anything still missing.
4. **Let Actions open pull requests** — Settings → Actions → General → Workflow
   permissions → *Allow GitHub Actions to create and approve pull requests*.

Each agent pull request then opens with **"workflows awaiting approval"** — one
click and its checks run. That is GitHub's rule for anything a bot opens; treat
it as a human checkpoint before agent work runs.

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

Then open an issue with a **Done when:** list, label it `ready-for-ai`, and
watch the Actions tab.

## 🎪 The app it builds

The harness needs something real to work on, so this repo is also **ORBIT '26**,
a companion app for a fictional AI conference — seats and waitlists, clashing
sessions, check-in windows, ratings, and a clock that runs. Real enough for
real bugs. **[More about the app →](docs/APP.md)**

```bash
npm install && npm run dev     # the app, seeded, on http://localhost:5173
```

https://github.com/user-attachments/assets/7f3ea661-2e85-4895-b7b2-63f3d77a1674

## 📚 Read next

- **[How the harness works](docs/harness/README.md)** — every step, and why.
- **[CLAUDE.md](CLAUDE.md)** — the rules people and agents both work to.
- **[docs/context/](docs/context/README.md)** — the map agents read instead of the source.
- **[specs/](specs/)** — one plan per ticket, written before the code.

## 🙌 Credits

The ship loop at the heart of this is **Andy Vays**'s design. Built by **Jonas
Claesson** and **Abraham Marín Pérez** at Equal Experts.
