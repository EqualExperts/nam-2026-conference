#!/usr/bin/env bash
# Run one Claude Code command headless in CI, and wait for it.
#
#   scripts/agent-run.sh "<prompt>" "<allowed tools>" [model]
#
# Why not anthropics/claude-code-action: it drives the Agent SDK and stops at
# the first `result` message. A saved workflow (/ship, /code-review, /qa) is
# launched in the background, and its launcher's first result is "workflow
# is running in the background" — two turns, four seconds. The action took
# that as the end of the run, the process exited, and the workflow died
# before its first agent started. Every run reported success and did nothing.
#
# The CLI in -p mode waits for background work, then reports again. So this
# runs the CLI, keeps the whole transcript as JSON lines, and writes what
# happened to the job summary — the action hid all of that by default, which
# is how a do-nothing run passed for a working one.
set -uo pipefail

prompt="$1"
tools="$2"
model="${3:-claude-opus-5}"
out="${RUNNER_TEMP:-/tmp}/claude-run.jsonl"
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

# Wait for the workflow however long it takes; the CI step's timeout-minutes
# bounds it. The CLI's own default gives up — and kills it — at 600s.
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS="${CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS:-0}"

# Cache writes are most of what a run costs: every agent writes its context,
# at 2x the input price for the default 1-hour cache and 1.25x for 5 minutes.
# An agent's turns are seconds apart and its life is minutes, so 5 minutes
# loses nothing and cuts the write bill by ~40% (verified with the CLI's own
# billing: ephemeral_5m_input_tokens instead of ephemeral_1h_input_tokens).
export CLAUDE_CODE_PROMPT_CACHE_TTL="${CLAUDE_CODE_PROMPT_CACHE_TTL:-5m}"
export CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL="${CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL:-5m}"

# Only when the caller left a progress comment for this run to update — a
# laptop run sets neither and is unchanged. It reads $out as it grows, beside
# the CLI, never inside its pipeline: piping the CLI's own output through the
# follower would let a follower that died mid-write take the CLI down with it
# (EPIPE), and this updater must never be able to touch the run it reports on.
follower=""
here="$(dirname "$0")"
if [ -n "${SHIP_PROGRESS_ISSUE:-}" ] || [ -n "${SHIP_PROGRESS_PR:-}" ]; then
  node "$here/ship-progress.mjs" follow &
  follower=$!
fi

claude -p "$prompt" \
  --model "$model" \
  --allowedTools "$tools" \
  --output-format stream-json --verbose \
  < /dev/null > "$out"
status=$?

# A step's own `timeout-minutes` kills the whole process tree, this follower
# included, before it ever reaches this line — that is what `finish`, in its
# own always() step outside the kill, is for. In the ordinary case the
# follower is still tailing $out; give it one more moment to catch the
# stream's own end, then stop it either way.
[ -n "$follower" ] && { sleep 1; kill "$follower" 2>/dev/null || true; wait "$follower" 2>/dev/null || true; }

node "$(dirname "$0")/agent-summary.mjs" "$out" "$prompt" >> "$summary" || true
node "$(dirname "$0")/agent-summary.mjs" "$out" "$prompt" --check
checked=$?

# The workflow's own return value, for the job to publish from.
node "$(dirname "$0")/agent-summary.mjs" "$out" "$prompt" --result "${RUNNER_TEMP:-/tmp}/workflow-result.json" || true

[ "$status" -ne 0 ] && exit "$status"
exit "$checked"
