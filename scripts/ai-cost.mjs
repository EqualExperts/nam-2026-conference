/**
 * What an agent run cost, and a running total on the ticket.
 *
 *   node scripts/ai-cost.mjs line --stream <claude-run.jsonl>        # one line, for a summary
 *   node scripts/ai-cost.mjs record --issue 42 --kind ship --run <url> \
 *     (--stream <claude-run.jsonl> | --transcripts <workflow transcript dir>) [--pr 57]
 *
 * `record` keeps one comment on the issue — every ship, code review, QA and
 * @claude run as a row, and the total — so the ticket says what AI spent on
 * it without anyone adding it up. With --pr it also comments the run's line
 * on the pull request.
 *
 * In CI the CLI's final `result` carries `modelUsage` with `costUSD` at list
 * prices, which is used as given. A local run has no bill (it is a
 * subscription), so the per-agent transcripts are priced with RATES below —
 * an estimate, and labelled as one.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** $ per million tokens. Cache writes are the 1-hour TTL the CLI uses (2× input). */
export const RATES = {
  haiku: { in: 1, out: 5, read: 0.1, write: 2 },
  sonnet: { in: 3, out: 15, read: 0.3, write: 6 },
  opus: { in: 5, out: 25, read: 0.5, write: 10 },
};
const family = (model) => (/haiku/.test(model) ? 'haiku' : /opus/.test(model) ? 'opus' : 'sonnet');

export const MARKER = 'orbit-ai-spend';

const empty = () => ({ in: 0, out: 0, read: 0, write: 0, cost: 0 });
const add = (a, b) => ({ in: a.in + b.in, out: a.out + b.out, read: a.read + b.read, write: a.write + b.write, cost: a.cost + b.cost });
export const tokens = (u) => u.in + u.out + u.read + u.write;
export const priced = (model, u) => {
  const r = RATES[family(model)];
  return (u.in * r.in + u.out * r.out + u.read * r.read + u.write * r.write) / 1e6;
};

/** A `claude -p --output-format stream-json` transcript → usage by model, as billed. */
export function fromStream(text) {
  // JSON lines from `claude -p`, or one JSON array — claude-code-action's execution file.
  let events;
  try { const all = JSON.parse(text); events = Array.isArray(all) ? all : [all]; }
  catch { events = text.split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }); }
  const result = events.filter((e) => e && e.type === 'result').at(-1);
  const models = {};
  for (const [name, m] of Object.entries(result?.modelUsage || {})) {
    const u = { in: m.inputTokens || 0, out: m.outputTokens || 0, read: m.cacheReadInputTokens || 0, write: m.cacheCreationInputTokens || 0 };
    models[name] = { ...u, cost: typeof m.costUSD === 'number' ? m.costUSD : priced(name, u) };
  }
  return { models, estimated: false };
}

/** A local workflow's transcript dir (agent-*.jsonl + .meta.json) → usage by model, priced by RATES. */
export function fromTranscripts(dir) {
  const models = {};
  for (const f of readdirSync(dir).filter((f) => /^agent-.*\.jsonl$/.test(f))) {
    let model = 'sonnet';
    try { model = JSON.parse(readFileSync(join(dir, f.replace(/\.jsonl$/, '.meta.json')), 'utf8')).model || model; } catch { /* default */ }
    const byMessage = new Map();
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean)) {
      let e; try { e = JSON.parse(line); } catch { continue; }
      if (e.type === 'assistant' && e.message?.usage) {
        byMessage.set(e.message.id, e.message.usage);
        if (e.message.model && e.message.model !== '<synthetic>') model = e.message.model;
      }
    }
    let u = empty();
    for (const m of byMessage.values()) {
      u = add(u, { in: m.input_tokens || 0, out: m.output_tokens || 0, read: m.cache_read_input_tokens || 0, write: m.cache_creation_input_tokens || 0, cost: 0 });
    }
    u.cost = priced(model, u);
    const key = family(model);
    models[key] = add(models[key] || empty(), u);
  }
  return { models, estimated: true };
}

export function total(usage) {
  return Object.values(usage.models).reduce(add, empty());
}

const human = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));
const dollars = (n) => `$${n < 10 ? n.toFixed(2) : n.toFixed(0)}`;

/** "4.2M tokens (3.9M cached reads · 18k output) · $2.40" — `~` when it is an estimate. */
export function line(usage) {
  const t = total(usage);
  const models = Object.entries(usage.models).sort((a, b) => b[1].cost - a[1].cost)
    .map(([name, u]) => `${family(name)} ${dollars(u.cost)}`).join(', ');
  return `${human(tokens(t))} tokens (${human(t.read)} cached reads · ${human(t.write)} cache writes · ${human(t.out)} output) · ` +
    `${usage.estimated ? '~' : ''}${dollars(t.cost)}${models ? ` — ${models}` : ''}`;
}

/** The ledger kept in the issue comment: rows in, markdown (with the rows hidden in it) out. */
export function ledgerBody(rows) {
  const t = rows.reduce((a, r) => ({ tokens: a.tokens + r.tokens, cost: a.cost + r.cost, est: a.est || r.estimated }), { tokens: 0, cost: 0, est: false });
  return [
    `### 🧾 AI spend on this ticket: ${human(t.tokens)} tokens · ${t.est ? '~' : ''}${dollars(t.cost)}`,
    '',
    '| Run | Tokens | Cost |',
    '| --- | --- | --- |',
    ...rows.map((r) => `| ${r.run ? `[${r.kind}](${r.run})` : r.kind}${r.pr ? ` · #${r.pr}` : ''} | ${human(r.tokens)} | ${r.estimated ? '~' : ''}${dollars(r.cost)} |`),
    '',
    `<sub>Updated after every ship, code review, QA and @claude run. CI rows are billed list prices; ~ marks a local run priced from its transcripts.</sub>`,
    '',
    `<!-- ${MARKER} ${JSON.stringify(rows)} -->`,
  ].join('\n');
}

export function parseLedger(body) {
  const m = new RegExp(`<!-- ${MARKER} (\\[.*\\]) -->`, 's').exec(body || '');
  try { return m ? JSON.parse(m[1]) : []; } catch { return []; }
}

function gh(args, input) {
  return execFileSync('gh', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function record(opts) {
  const usage = opts.stream ? fromStream(readFileSync(opts.stream, 'utf8')) : fromTranscripts(opts.transcripts);
  const t = total(usage);
  const text = line(usage);
  if (!tokens(t)) { console.log(`no usage found — nothing recorded`); return; }
  const repo = process.env.GH_REPO || gh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']).trim();
  const row = { kind: opts.kind, run: opts.run || '', pr: opts.pr ? Number(opts.pr) : undefined, tokens: tokens(t), cost: Math.round(t.cost * 100) / 100, estimated: usage.estimated };
  if (opts.issue) {
    const found = gh(['api', `repos/${repo}/issues/${opts.issue}/comments`, '--paginate', '--jq',
      `.[] | select(.body | contains("${MARKER}")) | .id`]).split('\n').filter(Boolean).at(-1);
    if (found) {
      const rows = parseLedger(gh(['api', `repos/${repo}/issues/comments/${found}`, '--jq', '.body']));
      gh(['api', `repos/${repo}/issues/comments/${found}`, '-X', 'PATCH', '-F', 'body=@-'], ledgerBody([...rows, row]));
    } else {
      gh(['api', `repos/${repo}/issues/${opts.issue}/comments`, '-F', 'body=@-'], ledgerBody([row]));
    }
  }
  if (opts.pr) {
    gh(['api', `repos/${repo}/issues/${opts.pr}/comments`, '-F', 'body=@-'],
      `🧾 **${opts.kind}** run: ${text}${opts.run ? ` · [run](${opts.run})` : ''}`);
  }
  console.log(text);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < rest.length; i += 2) opts[rest[i].replace(/^--/, '')] = rest[i + 1];
  try {
    if (cmd === 'line') console.log(line(opts.stream ? fromStream(readFileSync(opts.stream, 'utf8')) : fromTranscripts(opts.transcripts)));
    else if (cmd === 'record') record(opts);
    else { console.error('usage: ai-cost.mjs line|record …'); process.exit(2); }
  } catch (e) {
    // Reporting cost must never fail the job that did the work.
    console.error(`ai-cost: ${e.message}`);
  }
}
