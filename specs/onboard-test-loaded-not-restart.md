# Onboarding tests whether the clone loaded instead of always restarting

## Why
`specs/onboard-clone-location.md` kept the restart in Step 10 because "the hook
and the skills only load at start". A live onboarding run contradicts that. On
Claude Code (macOS, jonasingvar fork), the clone was made into the empty session
folder (Step 5, rule 2) and the session was **not** restarted. In that session:

- the project's commands (`/ship`, `/qa`, `/code-review`, `/winnow`,
  `/create-tasks`…), the `ship-rote` agent type and `CLAUDE.md` appeared;
- `/ship 1` ran twice, full (14/14 agents) and `--fast` (12/12, 0 errors), with
  agents of type `ship-rote` and no *agent type 'ship-rote' not found*;
- the fork-guard hook was live: `true || gh issue edit 1 --add-label
  ready-for-ai` was blocked with its label message.

So "always restart" asks attendees to quit a session that already works.

## What changes
- **Step 10** has the Check / Do / Verify shape of the other steps. It checks
  whether `ship` is among the session's commands and `ship-rote` among its agent
  types, and whether the hook is live, using `true || gh issue edit 0 --add-label
  ready-for-ai` (`gh` never runs). If both pass, it continues with no restart.
  If either fails, it falls back to today's restart (`/exit` + `claude
  --continue` when the clone is the session folder, else `cd <clone> && claude`),
  keeping the note on running `/ship` by script path before restarting.
- **The final checklist's** restart line applies only when Step 10's checks
  failed.
- **`docs/context/harness.md`**: the rote-agent fallback applies when the type
  did not load, not to every session started outside the checkout.

## Decisions
- **A test, not "never restart".** Rule 3 of Step 5 (a clone in a
  `./nam-2026-conference` subfolder of the session folder) is not verified, and
  other clients may differ. The checks decide.
- **The hook probe uses the label rule, not a create on the upstream repo.** The
  fork guard lets maintainers of EqualExperts/nam-2026-conference create issues
  there, so an upstream-create probe passes for them even with the hook live.
  The label rule blocks everyone.

## Supersedes
The *Decisions* line in `specs/onboard-clone-location.md`: "Keep the restart
rather than drop it — the hook and the skills only load at start". That spec is
left as written, and this one records the correction.

## Checked
The run above, as relayed by the session that did the onboarding. Not checked:
Step 5 rule 3, and Claude Desktop.
