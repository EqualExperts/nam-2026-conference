# Workshop quickstart — on your laptop

Set up once, then one walkthrough for each harness. The talk itself is at
[orbit26.up.railway.app/engineering-presentation](https://orbit26.up.railway.app/engineering-presentation);
[the main README](../../README.md) has the fork setup, and
[How the harness works](README.md) has every step in detail.

## Once: get set up

1. **Install the tools:** [Claude Code](https://docs.claude.com/en/docs/claude-code/overview)
   (signed in), Node 22 (`nvm use` reads `.nvmrc`), and the
   [GitHub CLI](https://cli.github.com) signed in with `gh auth login`.
2. **Fork the repo and turn on Issues.** Your tickets go to your fork. Follow
   steps 1 and 3 of [Set up your fork](../../README.md#set-up-your-fork):
   running *Set up the harness* creates the labels the agents use. You only
   need the API key (step 2) to run the agents on GitHub Actions; from your
   terminal, Claude Code uses your own sign-in.
3. **Clone your fork and install:**
   ```bash
   gh repo set-default "$(git remote get-url origin)"   # keep gh on your fork, not the original
   npm install
   npx playwright install chromium   # the browser the tests run in
   npm run dev                       # optional: the app on http://localhost:5173
   ```
4. **Start Claude Code** in the repo folder (`claude`) and run
   `/setup-winnow`. It checks the context docs and that it can reach your
   issues. It also asks whether you want audio. Say **no** unless you plan to
   capture a live meeting or a recording: audio needs `uv` and a model download
   of about 500 MB.

## The product harness: from a conversation to tickets

You stay in the conversation. The skills ask questions, and nothing is written
until you agree. There are three levels; each one adds a step in front of the
one before.

1. **Write a ticket directly:** `/create-tasks Add a page that lists every
   sponsor`. It checks for similar issues, asks about anything unclear, and
   opens a GitHub issue that states the goal and has a **Done when** list.
2. **Process a transcript:** `/winnow`, then paste the transcript or give a
   file path. It sorts what was said into decisions, work and noise, and asks
   about gaps and contradictions. Nothing to hand it? Try
   `/winnow docs/demo/winnow-transcript.txt`. When you say go, it records the
   decisions in the docs (`update-context`) and raises the issues
   (`create-tasks`). Use the full transcript, not an AI summary: a summary
   drops who said what, and which decision replaced which.
3. **Listen live** (needs the audio setup): `/listen-to-meeting`. It transcribes
   on your machine and flags contradictions and gaps during the meeting. Say
   "meeting's over" to stop it; it then offers to run `winnow` on the
   transcript.

**You should end up with:** new issues on your fork, and possibly edits to
`docs/` for you to review and commit.

## The engineering harness: from a ticket to a pull request

The engineering harness runs on its own. You give it a ticket, then come back
to a pull request.

1. **Pick an issue** that has a **Done when** list. One the product harness
   just created works.
2. **Ship it:** `/ship 42`. It plans, writes a failing test, writes the code,
   runs every test on desktop and mobile, and audits until the work is clean. A
   small ticket takes about 10–20 minutes. You can watch the progress on the
   issue.
3. **Review the pull request** like any other. It has the plan, the test
   evidence, every audit round and the cost. Merge it, or comment `@claude …` to
   ask for a change.

`/ship 42 43 44` runs several tickets in parallel, each in its own worktree on
its own ports. If a ticket will not come together, you get a **draft** pull
request labelled `needs-human` that lists what is still open.

## In GitHub — no terminal needed

| | |
| --- | --- |
| **1. Write the issue** | Why, what, and a **Done when:** list a test could check — *New issue → Ticket for the agents* gives you the shape |
| **2. Label it `ready-for-ai`** | An agent picks it up and posts its progress on the issue |
| **3. Review the pull request** | Comment `@claude …` and it makes the change and replies |
| **4. Merge** | Or don't — nothing merges itself |

Label ten issues and ten agents get to work.
