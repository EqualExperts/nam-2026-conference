# Onboarding clones where Claude can work in it

## Why
Following `ONBOARD_CLAUDE.md` from a session started outside the clone (a fresh
folder, as the README invites) put the fork in `~/nam-2026-conference` — a
folder the session cannot read or run things from without a permission prompt
each time. The first `/ship` then could not start: the Workflow tool only loads
a script from the session's folder or one added to it. And Step 10 read as
"nothing works until you restart", when `/ship` itself runs fine from the same
session.

## What changes
- **Step 5** clones into the folder the session started in: reuse it if it
  already is the fork's clone, clone into it if it is empty, otherwise into
  `./nam-2026-conference` beneath it (`~/nam-2026-conference` only when that
  folder is not writable). The path is `<clone>` in every later step.
- **Step 10** keeps the restart as the way in, and says why in terms of what
  the person will see: the project's agent types load only at start, so a
  `/ship` from a session started elsewhere shows *agent type 'ship-rote' not
  found* on every rote step before ship's fallback retries it (seen on #1).
  Running `/ship` before the restart stays possible — the Workflow tool runs
  `<clone>/.claude/workflows/ship.js` by path and ship's setup runs the fork
  guard — with the person told to expect those failures. When the clone is the
  session folder, `/exit` + `claude --continue` keeps the conversation.

## Decisions
- Clone beneath the session folder rather than into `~` — OK? The folder the
  person started Claude in is where they expect the work to be.
- Keep the restart rather than drop it — the hook and the skills only load at
  start, and the hook is the guard for anything ship does not cover.

## Checked
On jonasingvar/nam-2026-conference from a session in an unrelated folder:
issue #1 created on the fork, `/ship 1` started from that session by script path.
