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

claude -p "$prompt" \
  --model "$model" \
  --allowedTools "$tools" \
  --output-format stream-json --verbose \
  < /dev/null > "$out"
status=$?

node "$(dirname "$0")/agent-summary.mjs" "$out" "$prompt" >> "$summary" || true
node "$(dirname "$0")/agent-summary.mjs" "$out" "$prompt" --check
checked=$?

# The workflow's own return value, for the job to publish from.
node "$(dirname "$0")/agent-summary.mjs" "$out" "$prompt" --result "${RUNNER_TEMP:-/tmp}/workflow-result.json" || true

[ "$status" -ne 0 ] && exit "$status"
exit "$checked"
