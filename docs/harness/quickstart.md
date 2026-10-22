# Workshop quickstart — using the harnesses

Not set up yet? Paste the prompt from the [README](../../README.md) into Claude
Code: it follows [ONBOARD_CLAUDE.md](../../ONBOARD_CLAUDE.md). Once you're set
up, run everything below from Claude in your fork's folder. Every step in detail:
[How the harness works](README.md).

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
   issue. For the workshop's demo ticket ([docs/demo/multi-track-ticket.md](../demo/multi-track-ticket.md)),
   use `/ship 42 --fast`: one audit, and only the branch's own browser tests —
   the pull request's CI runs the rest.
3. **Review the pull request** like any other. It has the plan, the test
   evidence, every audit round and the cost. Merge it, or comment `@claude …` to
   ask for a change.

`/ship 42 43 44` runs several tickets in parallel, each in its own worktree on
its own ports. If a ticket will not come together, you get a **draft** pull
request labelled `needs-human` that lists what is still open.

## On GitHub Actions instead

The same agents can run in the cloud — label an issue `ready-for-ai` and one
ships it. The workshop demos that on the main repo; a fork needs an API key for
it, set up as in [github.md](github.md).
