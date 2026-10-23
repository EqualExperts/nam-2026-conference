/**
 * Read a `claude -p --output-format stream-json` transcript and say what the
 * run actually did.
 *
 *   node scripts/agent-summary.mjs run.jsonl "/ship 34"            # markdown for the job summary
 *   node scripts/agent-summary.mjs run.jsonl "/ship 34" --check    # exit 1 if it did nothing
 *   node scripts/agent-summary.mjs run.jsonl "/qa 35" --result out.json   # the workflow's return value
 *
 * `--check` exists because the failure it guards against looked like
 * success: a workflow launched in the background, the runner stopped at the
 * launcher's first reply, and the step went green having done nothing. A run
 * that launched a workflow must end with a later result than the launch.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A finished background workflow is announced as a `task_notification` whose
 * `output_file` holds its return value and the state of every agent it ran.
 * That return value is what CI publishes from — not a model's retelling of it.
 */
export function workflowRuns(events, read = (f) => JSON.parse(readFileSync(f, 'utf8'))) {
  return events
    .filter(e => e.type === 'system' && e.subtype === 'task_notification' && e.output_file)
    .map(e => {
      let out = null;
      try { out = read(e.output_file); } catch { /* the file is gone: report what we have */ }
      const agents = (out?.workflowProgress || []).filter(p => p.type === 'workflow_agent')
        .map(a => ({ label: a.label, state: a.state, phase: a.phaseTitle }));
      return { status: e.status, summary: e.summary, result: out?.result ?? null, agents };
    });
}

export function summarise(lines, read) {
  const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const launched = [];
  const results = [];
  const texts = [];
  for (const e of events) {
    if (e.type === 'assistant') {
      for (const c of e.message?.content || []) {
        if (c.type === 'tool_use' && c.name === 'Workflow') launched.push(c.input?.name || c.input?.scriptPath || 'inline');
        if (c.type === 'text' && c.text.trim()) texts.push(c.text.trim());
      }
    }
    if (e.type === 'result') results.push(e);
  }
  const runs = workflowRuns(events, read);
  const last = results.at(-1);
  // A launch followed by only the launcher's own result is the silent
  // failure: the workflow's completion never came back.
  const waited = launched.length === 0 || results.length >= 2;
  return {
    launched,
    results: results.length,
    waited,
    ok: !!last && !last.is_error && waited,
    turns: results.reduce((n, r) => n + (r.num_turns || 0), 0),
    cost: results.reduce((n, r) => n + (r.total_cost_usd || 0), 0),
    seconds: Math.round(results.reduce((n, r) => n + (r.duration_ms || 0), 0) / 1000),
    final: String(last?.result ?? texts.at(-1) ?? ''),
    runs,
  };
}

export function markdown(s, prompt) {
  const head = s.ok ? '✅' : '❌';
  return [
    `### ${head} \`${prompt}\``,
    '',
    `| Workflows launched | Results | Turns | Time | Cost |`,
    `| --- | --- | --- | --- | --- |`,
    `| ${s.launched.join(', ') || 'none'} | ${s.results} | ${s.turns} | ${s.seconds}s | $${s.cost.toFixed(2)} |`,
    '',
    s.waited ? '' : '> [!CAUTION]\n> A workflow was launched but its result never came back — the run ended at the launch.\n',
    ...s.runs.flatMap(r => [
      `**${r.summary || 'workflow'}** — ${r.status}`,
      '',
      '| Agent | Phase | State |',
      '| --- | --- | --- |',
      ...r.agents.map(a => `| ${a.label} | ${a.phase || ''} | ${a.state === 'done' ? 'done' : `**${a.state}**`} |`),
      '',
    ]),
    '<details><summary>Final message</summary>',
    '',
    s.final.slice(0, 6000) || '_none_',
    '</details>',
    '',
  ].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, prompt = '', flag] = process.argv.slice(2);
  let lines = [];
  try { lines = readFileSync(file, 'utf8').split('\n'); } catch { /* no transcript: nothing ran */ }
  const s = summarise(lines);
  if (flag === '--check') process.exit(s.ok ? 0 : 1);
  if (flag === '--result') {
    const result = s.runs.at(-1)?.result ?? null;
    writeFileSync(process.argv[5], JSON.stringify(result, null, 2));
    process.exit(result ? 0 : 1);
  }
  process.stdout.write(markdown(s, prompt));
}
