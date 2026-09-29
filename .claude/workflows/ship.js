export const meta = {
  name: 'ship',
  description: 'Issue → spec → spec audit loop → implement → verify + code audit loop → context → learn → PR',
  whenToUse: 'Taking one GitHub issue to a pull request — /ship 42, or the ready-for-ai label.',
  phases: [
    { title: 'Setup', detail: 'read the ticket, gate it, claim it, branch' },
    { title: 'Spec', detail: 'write specs/<n>-<slug>.md' },
    { title: 'Spec Audit', detail: 'fresh-context auditors, revise until clean' },
    { title: 'Implement', detail: 'failing check first, then the change' },
    { title: 'Verify', detail: 'scripts/gate.mjs, every round' },
    { title: 'Code Audit', detail: 'independent reviewers, skeptic-verified, fix, repeat' },
    { title: 'Learn', detail: 'turn what the audits caught into context, on the branch' },
    { title: 'PR', detail: 'push, screenshots, open it' },
  ],
}

// ── Knobs ────────────────────────────────────────────────────────────────────
// A loop that has not converged by these counts is not going to. Past them the
// ticket goes to a person, with everything still open written down, rather than
// burning another round on a finding the implementer keeps failing to fix.
let MAX_SPEC_ROUNDS = 3
let MAX_BUILD_ROUNDS = 4

// How much loop a ticket gets. Setup sizes it; `ship:full` on the issue, or
// `--full` / `--small` after the number, overrides. A three-line copy fix
// does not need two spec auditors, three code auditors and Opus throughout —
// that shape took a medium ticket 57 minutes. Small keeps what makes the
// loop trustworthy — an independent audit, a skeptic, the machine gate — and
// drops the redundancy.
const TIERS = {
  small: {
    // No separate spec audit: the combined code auditor traces every criterion
    // to a test and judges the spec's reading of the ticket (see its ask).
    specRounds: 0, buildRounds: 2,
    specLenses: ['combined'], codeLenses: ['combined', 'browser'],
    think: 'sonnet',   // spec, audits, skeptic, context, learn, PR
    build: 'sonnet',   // implement, fix
  },
  full: {
    specRounds: 3, buildRounds: 4,
    specLenses: ['criteria', 'fit'], codeLenses: ['criteria', 'rules', 'browser'],
    think: undefined,  // the session's model — Opus in CI
    build: undefined,
  },
}
// Phases that run a command and copy its output back need no judgement.
const ROTE = 'haiku'
// …nor CLAUDE.md or a long system prompt: .claude/agents/ship-rote.md omits
// both, and its context starts ~26% smaller than a general agent's (13.6k
// against 18.4k tokens, measured) — paid again on every turn it takes.
const ROTE_AGENT = 'ship-rote'
// A session loads its agent types when it starts, so one opened before
// ship-rote.md existed throws "agent type 'ship-rote' not found" — and the
// whole run with it. Fall back to a plain agent: slower, never broken.
const rote = (prompt, opts) => agent(prompt, { ...opts, agentType: ROTE_AGENT }).catch((e) => {
  if (!/agent type .* not found/i.test(String(e && e.message))) throw e
  log(`${ROTE_AGENT} is not loaded in this session — ${opts.label} runs as a plain agent`)
  return agent(prompt, opts)
})
let T = TIERS.full
// The same finding confirmed this many rounds running means the fixer cannot
// fix it. Escalate early instead of spending the remaining rounds.
const STUCK_AFTER = 2

// `/ship 42`, `/ship 42 <what the person said>` (a comment that asked for
// this run), `/ship 42 43 44` (several tickets, in parallel), or
// `{ issue, base, notes }`.
const argText = typeof args === 'object' && args ? '' : String(args ?? '').trim()
// The leading run of issue numbers: `42`, `42 43 44`, `#42, #43 and #44`.
const LEAD = (/^#?\d+(?:(?:\s*,\s*|\s+and\s+|\s+)#?\d+)*/.exec(argText) || [''])[0]
const ISSUES = [...new Set((LEAD.match(/\d+/g) || []).map(Number))]
const issue = Number(typeof args === 'object' && args ? args.issue : ISSUES[0])
const FORCED = typeof args === 'object' && args ? args.size : (/--(full|small)\b/.exec(argText) || [])[1]
const NOTES = String((typeof args === 'object' && args ? args.notes : argText.slice(LEAD.length)) || '')
  .replace(/@claude\b/gi, '').replace(/--(full|small)\b/g, '').trim()

// Several tickets: one whole ship per ticket, all at once. Each gets its own
// worktree and lane, so they build, boot the app and run the suite side by
// side; each sizes itself, so a copy fix and a feature in the same batch get
// the loops they need. A ticket that fails does not stop the others.
if (ISSUES.length > 1 && !(typeof args === 'object' && args)) {
  if (typeof workflow !== 'function') {
    return { outcome: 'error', reason: 'shipping several tickets needs the workflow() hook — run each with /ship <n>' }
  }
  log(`shipping ${ISSUES.length} tickets in parallel: ${ISSUES.map(n => `#${n}`).join(', ')}`)
  const runs = await parallel(ISSUES.map(n => () =>
    workflow('ship', { issue: n, notes: NOTES, ...(FORCED ? { size: FORCED } : {}) })))
  return {
    outcome: 'batch',
    runs: runs.map((r, i) => r || { outcome: 'error', issue: ISSUES[i], reason: 'the run died' }),
  }
}
// The branch the work starts from and the pull request targets. `main`
// unless this ticket stacks on another pull request that has not landed.
const BASE = (typeof args === 'object' && args && args.base) || 'main'
if (!Number.isInteger(issue) || issue <= 0) {
  return { outcome: 'error', reason: `ship needs an issue number, got ${JSON.stringify(args)}` }
}

const SKILL = 'docs/harness/ship-playbook.md'
// The sections a step needs, as one read. Told "follow §4–§6", every agent
// on #64 spent two to four turns grepping the playbook's headings and paging
// through it; this prints exactly those sections in one command.
const sections = (from, to) => `\`awk '/^## ${from}\\./,/^## ${to}\\./' ${SKILL}\``

// Every agent is a fresh context. Without this line each one re-reads the
// source to learn how the app fits together, and that is most of the bill.
const MAP =
  `Start from \`node scripts/context.mjs index\` and pick the one or two docs in docs/context/ for the area ` +
  `this touches. \`node scripts/context.mjs show <doc>\` prints a doc's outline; \`show <doc> Gotchas <part>…\` ` +
  `prints only those parts — read the Gotchas and the parts you need, never a whole doc: what you read is ` +
  `re-read on every turn after. Take their word for how the app fits together; open source only for the lines ` +
  `you will change or must verify.`

// ── Schemas ──────────────────────────────────────────────────────────────────
const SETUP = {
  type: 'object',
  required: ['proceed', 'reason'],
  properties: {
    proceed: { type: 'boolean' },
    reason: { type: 'string', description: 'why not, if proceed is false; else one line on the ticket' },
    title: { type: 'string' },
    slug: { type: 'string', description: 'short kebab-case slug' },
    branch: { type: 'string', description: 'issue-<n>-<slug>' },
    workdir: { type: 'string', description: 'absolute path every later agent works in' },
    runner: { type: 'boolean', description: 'true when $GITHUB_ACTIONS is set' },
    harnessOnBase: { type: 'boolean', description: 'origin/<base> has scripts/gate.mjs and docs/harness/ship-playbook.md' },
    // Before `doneWhen`: an agent's `resultPreview` is capped at 400
    // characters, and `doneWhen` is verbatim ticket text -- with the tier
    // after it, the tier falls off the end of a live progress render before
    // anyone reading the issue ever sees it. See docs/context/harness.md.
    size: { enum: ['small', 'full'], description: 'small unless the issue is labelled ship:full, or it changes a rule in server/lib, the schema or seed, an API shape, or several areas at once, or has more than four Done-when criteria' },
    doneWhen: { type: 'array', items: { type: 'string' }, description: 'each Done-when criterion, verbatim' },
    spec: {
      type: 'object',
      description: 'only when you sized it small and proceeded: the spec you wrote',
      properties: {
        path: { type: 'string' },
        summary: { type: 'string', description: 'two sentences: the approach and how it will be proved' },
        editsHarness: { type: 'boolean', description: 'true if the plan changes any file under .claude/' },
        decisions: { type: 'array', items: { type: 'string' }, description: 'choices the ticket left open that you made, each phrased as a yes/no question for the reviewer ("Show nothing before check-in opens, rather than a greyed status — OK?"); empty if none' },
      },
    },
  },
}

const SPEC_WRITTEN = {
  type: 'object',
  required: ['path', 'summary'],
  properties: {
    path: { type: 'string' },
    summary: { type: 'string', description: 'two sentences: the approach and how it will be proved' },
    editsHarness: { type: 'boolean', description: 'true if the plan changes any file under .claude/' },
    decisions: { type: 'array', items: { type: 'string' }, description: 'choices the ticket left open that you made, each phrased as a yes/no question for the reviewer ("Show nothing before check-in opens, rather than a greyed status — OK?"); empty if none' },
  },
}

const FINDINGS = {
  type: 'object',
  required: ['findings', 'covered', 'ran'],
  properties: {
    ran: { enum: ['nothing', 'unit', 'browser', 'unit+browser'], description: 'which suites or probes YOU executed — reading is not running' },
    covered: { type: 'string', description: 'what you were able to judge — under 12 words; it is a table cell' },
    findings: {
      type: 'array',
      // Unbounded, one auditor can fan out a skeptic per nit. Five blockers
      // in one lens means the implementation is wrong, not that it needs five fixes.
      maxItems: 5,
      items: {
        type: 'object',
        required: ['severity', 'category', 'file', 'claim', 'evidence', 'fix'],
        properties: {
          severity: { enum: ['blocker', 'minor'] },
          category: {
            enum: ['criterion-unmet', 'claude-md', 'logic', 'test-proves-nothing', 'test-weakened', 'browser', 'spec-gap', 'scope', 'gate', 'docs-stale'],
          },
          file: { type: 'string' },
          line: { type: 'integer' },
          claim: { type: 'string', description: 'what is wrong, in one sentence' },
          evidence: { type: 'string', description: 'the quoted line, the input and wrong output, or the repro' },
          fix: { type: 'string', description: 'what would resolve it, in one sentence' },
        },
      },
    },
  },
}

const REFUTATION = {
  type: 'object',
  required: ['refuted', 'why'],
  properties: {
    refuted: { type: 'boolean' },
    why: { type: 'string' },
  },
}

// The verify agent only runs `node scripts/gate.mjs` and hands back the JSON
// line it printed. The script decides green from Playwright's own report; the
// agent's opinion of the run is never asked for.
const GATE = {
  type: 'object',
  required: ['json'],
  properties: {
    json: { type: 'string', description: 'the last line gate.mjs printed, verbatim' },
    red: { type: 'string', description: 'verify only: the last line red-check.mjs printed, verbatim, if it was run' },
  },
}

const DONE = {
  type: 'object',
  required: ['ok', 'summary'],
  properties: {
    ok: { type: 'boolean' },
    summary: { type: 'string' },
    url: { type: 'string' },
    ui: { type: 'boolean', description: 'implement only: did anything an attendee sees in a browser change' },
    browserTest: { type: 'boolean', description: 'implement only: did you add or change a Playwright test (tests/*.spec.js) that drives the changed behaviour' },
    tryIt: { type: 'string', description: 'implement only: how a reviewer sees the change in one or two steps — a URL with ?at= to pin the clock and which attendee to pick, or a command for a non-visual change' },
    keyFiles: {
      type: 'array', maxItems: 3,
      description: 'implement only: the one to three files where the change actually lives, for a reviewer to start with',
      items: { type: 'object', required: ['file', 'why'], properties: { file: { type: 'string' }, why: { type: 'string' } } },
    },
  },
}

const LESSON = {
  type: 'object',
  required: ['lessons'],
  properties: {
    lessons: {
      type: 'array',
      items: {
        type: 'object',
        required: ['pattern', 'proposal'],
        properties: {
          pattern: { type: 'string', description: 'the class of mistake the audits caught' },
          proposal: { type: 'string', description: 'what was written, and in which file' },
        },
      },
    },
  },
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// Where a finding is, not how it is worded: a fresh auditor rewords the same
// bug every round, so a key built from the claim never repeats.
// With no line to place it, the claim is all that tells two findings apart —
// two unmet criteria both cite the spec file.
const key = f => `${f.category}|${f.file}|${f.line ? Math.floor(f.line / 10) : f.claim.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)}`
// A table cell, not a report: the second live run's auditors each wrote a
// paragraph here and the PR's audit table became a wall.
const brief = s => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > 90 ? t.slice(0, 87).replace(/\s\S*$/, '') + '…' : t }
// One problem, one finding, whatever category each lens filed it under —
// keyed by where it is, first report kept. Stuck detection still uses key().
// The exact line, not a window: two different problems ten lines apart are
// two findings, and merging them left one that no skeptic ever judged.
// Without a line only an identical claim merges: a 60-character prefix once
// merged "…more than three" with "…fewer than three". Judging a duplicate
// twice costs a skeptic; dropping a different problem costs a blocker.
const where = f => `${f.file}|${f.line ? f.line : f.claim.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
// Merge, never drop: a reading this key already holds joins it in `also`,
// and the skeptic may refute the location only if every reading is wrong. A
// kept-first merge let a refuted criterion take a real logic blocker on the
// same line down with it, unjudged.
const group = (m, f) => {
  const k = where(f)
  // Grouping twice (ship's minors are grouped, then confirmed) must keep
  // the readings the first pass gathered.
  if (!m.has(k)) return m.set(k, { ...f, also: [...(f.also || [])] })
  const g = m.get(k)
  for (const r of [f, ...(f.also || [])]) {
    if (g.claim !== r.claim && !g.also.some(a => a.claim === r.claim)) g.also.push({ category: r.category, claim: r.claim, evidence: r.evidence })
  }
  return m
}
const dedupe = fs => [...fs.reduce(group, new Map()).values()]

// Parse what gate.mjs printed. Anything that is not its JSON is a red gate
// with a reason, never a green one.
function readGate(g) {
  try {
    const r = JSON.parse(g.json)
    if (typeof r.ok !== 'boolean' || typeof r.sha !== 'string' || !r.unit || !r.browser ||
        !Array.isArray(r.browser.failed) || !Array.isArray(r.tampered)) throw new Error('not a gate result')
    // Green on a tree with uncommitted changes is green on code the PR will
    // not contain.
    if (r.dirty) return { ...r, ok: false, browser: { ...r.browser, failed: [...r.browser.failed,
      { test: 'git status', error: 'the gate ran on uncommitted changes — commit or discard them' }] } }
    return r
  } catch (e) {
    return { ok: false, sha: '?', unit: { passed: 0, failed: 0 }, tampered: [],
      browser: { passed: 0, flaky: 0, skipped: 0, failed: [{ test: 'gate.mjs', error: `unreadable gate output: ${String(g.json).slice(0, 200)}` }] } }
  }
}
const gateLine = r =>
  `unit ${r.unit.passed} passed${r.unit.failed ? ` · ${r.unit.failed} failed` : ''} · browser ${r.browser.passed} passed` +
  (r.browser.failed.length ? ` · ${r.browser.failed.length} failed` : '') + (r.browser.flaky ? ` · ${r.browser.flaky} flaky` : '')

const listFindings = fs =>
  fs.map((f, i) => `${i + 1}. [${f.category}] ${f.file}${f.line ? ':' + f.line : ''} — ${f.claim}\n   evidence: ${f.evidence}\n   fix: ${f.fix}` +
    (f.also && f.also.length ? f.also.map(a => `\n   also, [${a.category}]: ${a.claim} — ${a.evidence}`).join('') : '')).join('\n')

// Every finding goes past a skeptic before it costs a fix round. A false
// positive here is worse than on a PR comment: the fixer will obediently
// "fix" correct code, and the next audit will flag the damage.
async function confirm(findings, where) {
  const judged = await parallel(dedupe(findings).map(f => () =>
    agent(
      `${ticket}\n\n${inTree()}\n\nThe spec is ${spec.path}. An auditor claims this ${f.severity === 'minor' ? 'minor problem' : 'blocker'} in ${where}. Try to ` +
      `REFUTE it. Open the cited file and line yourself; \`npm test\` is fine, but do not boot the app or run ` +
      `Playwright — other agents are using the ports. Refute if the line does not say what is claimed, if the ` +
      `behaviour is already on origin/${BASE}, if the finding is style rather than a defect, if its suggested fix ` +
      `would contradict CLAUDE.md, or if CLAUDE.md or ` +
      `the spec *as first committed* (\`git log --diff-filter=A --format=%H -- ${spec.path}\`, then \`git show\`) ` +
      `shows it was deliberate. A later edit to the spec does not make a missed Done-when criterion deliberate. ` +
      `If you cannot tell, it is NOT refuted.` +
      (f.also && f.also.length ? ` Several auditors read this location differently ("also" below): refute only if EVERY reading is wrong.` : '') +
      `\n\n` + listFindings([f]),
      { phase: where === 'the spec' ? 'Spec Audit' : 'Code Audit', label: `skeptic:${f.category}`, schema: REFUTATION, effort: 'medium', model: T.think },
    // A skeptic that died refuted nothing. Dropping its finding would let a
    // crash read as a clean audit.
    ).then(v => (v && v.refuted ? null : f))))
  return judged.filter(Boolean)
}

// Run every lens; a lens that died is run once more, and one that dies twice
// hands the ticket back. An audit nobody finished is not a clean audit.
async function audit(lenses, run) {
  const first = await parallel(lenses.map(l => () => run(l, '')))
  const again = await parallel(lenses.map((l, i) => async () => first[i] || run(l, '-retry')))
  const missing = lenses.filter((l, i) => !again[i]).map(l => l.key)
  return { reports: again.filter(Boolean), missing }
}

let setup, ticket, spec
// Everything any audit confirmed, across every loop — what Learn works from.
const history = []
// Every turn re-reads the agent's whole context (~50k tokens and up), and
// the spec writer on #65 spent 28 turns on one grep or sed each. Batching
// what it already knows it needs is the cheapest cut there is.
const BATCH = `Each turn re-reads your whole context, so batch: when you know you need several reads — greps, seds, ` +
  `cats — put them in one Bash command, separated by \`; echo ---;\`.`
const inTree = ({ releases = false } = {}) =>
  `Work in ${setup.workdir} on branch ${setup.branch} (based on ${BASE}): cd there at the start of every Bash command. ${BATCH}` +
  (setup.runner
    ? ''
    : ` This is a laptop with other agents on it, so prefix anything that boots the app or runs Playwright with ` +
      `\`eval "$(node scripts/lane.mjs claim ${issue})" &&\` — shell state does not persist between commands.` +
      (releases ? '' : ` Never release the lane: it belongs to the whole run, and the last step releases it.`))

async function handBack(stage, why, open, alsoOpen) {
  log(`handing #${issue} back at ${stage}: ${why}`)
  // A run that could not converge is the one with the most to teach, so it
  // learns before it pushes — the lessons land on the draft with the work.
  const lessons = setup && setup.branch && !learned ? await learn(`stopped at ${stage}: ${why}`) : []
  phase('Learn')
  await agent(
    `Hand GitHub issue #${issue} back to a person. The automated ship run stopped at "${stage}" because: ${why}\n\n` +
    (open && open.length ? `Still open when it stopped:\n${listFindings(open)}\n\n` : '') +
    (alsoOpen && alsoOpen.length ? `Also still open — technical, not why it stopped, but the next run must settle them:\n${listFindings(alsoOpen)}\n\n` : '') +
    (setup && setup.branch
      ? `${inTree()}\nPush whatever is committed (git push -u origin HEAD), then open a DRAFT pull request so the ` +
        `work is not lost — or, if a draft from an earlier attempt is already open on this branch, update its ` +
        `body with \`gh pr edit\` instead: \`gh pr create --draft --base ${BASE}\`, titled with the issue title, body opening ` +
        `"Refs #${issue}" (not Closes), then a short "Why this stopped" section and the open list above. ` +
        `Skip the draft if nothing beyond the spec is committed.\n`
      : '') +
    `Then comment on the issue — what was tried, what stopped it, what it needs from a person, and the draft ` +
    `PR link if there is one — and run: gh issue edit ${issue} --add-label needs-human --remove-label ai-working`,
    { phase: 'Learn', label: 'hand-back', schema: DONE, effort: 'low', model: ROTE },
  )
  await cleanup()
  return { outcome: 'needs-human', issue, stage, reason: why, open: open || [], lessons }
}

// On a laptop the run holds a lane (a port pair) for its worktree. It is the
// run's, not any one agent's, so it is released here — once, at the end.
async function cleanup() {
  if (!setup || setup.runner || !setup.workdir) return
  await agent(
    `cd ${setup.workdir} && node scripts/lane.mjs release ${issue} — then \`node scripts/lane.mjs list\` and ` +
    `confirm no lane is held for ${setup.workdir}. Leave the worktree itself; a person may want it.`,
    { phase: 'PR', label: 'release-lane', schema: DONE, effort: 'low', model: ROTE },
  )
}

let learned = false
async function learn(how) {
  learned = true
  phase('Learn')
  if (!history.length) return []
  const result = await agent(
    `${inTree()}\n\nThe ship run for issue #${issue} ${how}. Along the way independent audits confirmed these ` +
    `problems the implementer had missed:\n\n${listFindings(history)}\n\nFind at most two classes of mistake that ` +
    `would recur on a different ticket — not this ticket's specifics. For each, decide where the knowledge ` +
    `would have been seen in time: the *Gotchas* of the docs/context/ doc for that area (usually), CLAUDE.md ` +
    `(only for a decision, not a fact about code), or ${SKILL} (for a process step). If it is already written ` +
    `there, it is being missed: make it shorter and move it higher rather than repeating it. Edit those files, ` +
    `in the voice around them, present tense — they are read instead of the code, so write only what you have ` +
    `checked against it. \`npm test\` (the context check runs there). Commit as "docs(context): …" and push. ` +
    `If nothing generalises, change nothing and return an empty list.`,
    { phase: 'Learn', label: 'learn', schema: LESSON, effort: 'medium', model: T.think },
  )
  return result ? result.lessons : []
}

// What a spec must be, for whichever agent writes it: setup on a small ticket
// (it has just read the ticket and the map, and a second agent would re-read
// both), the spec writer on a full one.
const specAsk = (path) =>
  `Write the spec, following §3b of ${SKILL} (${sections('3b', '4')} prints it): ${path}, ` +
  `commit it as the branch's first commit, push, and comment the link on the issue. Its *Where* is the builder's ` +
  `map — name each file, the function or line to change, the test file, and the lane or helpers the test will ` +
  `use (tests/helpers.js), so the builder opens those and searches for nothing. Set editsHarness if the ` +
  `plan changes any file under .claude/. ${MAP} Every Done-when ` +
  `criterion must map to a named check at a named layer — judged by reading, not by running anything: the ` +
  `red-check proves it after the build. Never open data/orbit.db; the seed doc and the API say what it holds. ` +
  `Do not read other specs for the format; it is this, half a page:\n` +
  `# <title>\n## What this changes\n<what an attendee or caller sees now>\n## Where\n- \`<file>\` — <function or line>; ` +
  `test in \`<test file>\` using <lane or helper>\n## How it will be proved\n| Done when | Check | Layer |\n| --- | --- | --- |\n` +
  `## Decisions\n<only if the ticket left something open>\n## Out of scope\n<only if needed>\n` +
  `Return each Decision as decisions, phrased as a yes/no question for the reviewer.`

// ── 1. Setup ─────────────────────────────────────────────────────────────────
phase('Setup')
setup = await agent(
  (NOTES ? `This run was asked for in a comment: "${NOTES}". A closed pull request from an earlier attempt is ` +
    `not a reason to stop.\n\n` : '') +
  `${BATCH} Set up to ship GitHub issue #${issue}. Follow §1–§3 of ${SKILL} exactly (${sections(1, '4')} prints them, and §9 is ${sections(9, '10')}): read the ticket, decide whether ` +
  `it is shippable (stop if it is closed, already has a ready — non-draft — PR, states no outcome a check could be written ` +
  `against, or asks for two unrelated things; a draft is an earlier attempt to continue), claim it — removing ` +
  `ready-for-ai (and any needs-human or ready-for-human left by an earlier attempt) whether or not you proceed — ` +
  `and make the workspace — branch in a runner, ` +
  `worktree + npm install on a laptop, at exactly the path §3 gives (orbit-wt-${issue} beside the main checkout) — from origin/${BASE}, not necessarily main. If an issue-${issue}-* branch is already on origin from an earlier ` +
  `attempt, continue on it rather than making a new one, and say so in reason. First of all, check the base ` +
  `carries the harness this run depends on: \`git cat-file -e origin/${BASE}:scripts/gate.mjs && git cat-file -e ` +
  `origin/${BASE}:docs/harness/ship-playbook.md\`. If not, set harnessOnBase=false and proceed=false — every ` +
  `later phase would run commands that do not exist in the worktree. \`gh\` works on the repository origin points ` +
  `at, as whoever is signed in: if it cannot read the issue, return proceed=false saying so — never \`gh auth ` +
  `switch\`/\`login\`, never guess another repository, never change git or gh configuration outside the worktree. ` +
  `Write no code. If you proceed and size it small, write the spec too, in the workspace you made — ` +
  `${specAsk(`specs/${issue}-<your slug>.md`)} — and return it as spec; a full ticket's spec is the next step's. ` +
  `Return proceed=false with the ` +
  `reason if it is not shippable, and in that case also do §9 (comment and label needs-human). Size it: small ` +
  `unless it carries the ship:full label or the size description says otherwise — most tickets are small.`,
  { phase: 'Setup', label: 'setup', schema: SETUP, model: 'sonnet' },
)
if (!setup) { setup = null; return handBack('Setup', 'the setup agent died, possibly after claiming the ticket') }
if (!setup.proceed) return { outcome: 'declined', issue, reason: setup.harnessOnBase === false
  ? `origin/${BASE} has no harness (scripts/gate.mjs, docs/harness/) — pass { issue, base } with a branch that does`
  : setup.reason }
const SIZE = FORCED || (setup.size === 'small' ? 'small' : 'full')
T = TIERS[SIZE]
MAX_SPEC_ROUNDS = T.specRounds
MAX_BUILD_ROUNDS = T.buildRounds
log(`#${issue} sized ${SIZE}${FORCED ? ' (forced)' : ''}`)
const missingSetup = ['title', 'slug', 'branch', 'workdir', 'doneWhen'].filter(k => !setup[k] || (k === 'doneWhen' && !setup.doneWhen.length))
if (missingSetup.length) {
  const partial = setup
  setup = partial.branch && partial.workdir ? partial : null
  return handBack('Setup', `setup returned no ${missingSetup.join(', ')}`)
}
log(`#${issue} ${setup.title} → ${setup.branch}`)

ticket =
  `GitHub issue #${issue}: ${setup.title}\nDone when:\n` + setup.doneWhen.map(c => `- ${c}`).join('\n') +
  (NOTES ? `\n\nThe person who asked for this run wrote: "${NOTES}" — where it changes what to build, it amends ` +
    `the ticket; where it is about process, it is context.` : '')

// ── 2. Spec ──────────────────────────────────────────────────────────────────
phase('Spec')
spec = setup.spec && setup.spec.path ? setup.spec : await agent(
  `${ticket}\n\n${inTree()}\n\n${specAsk(`specs/${issue}-${setup.slug}.md`)}`,
  { phase: 'Spec', label: 'write-spec', schema: SPEC_WRITTEN, model: T.think },
)
if (!spec) return handBack('Spec', 'the spec writer died')
// Claude Code in CI refuses edits under .claude/ as sensitive — rightly: an
// agent in a runner should not rewrite its own harness. #52 found that out an
// hour in, after writing everything else. A spec that needs .claude/ goes
// back now, with the spec kept, to be built by a person or a local session.
if (spec.editsHarness && setup.runner) {
  return handBack('Spec', 'the plan changes files under .claude/, which an agent in CI may not edit — build it locally from the spec on this branch')
}

// ── 3. Spec Audit ────────────────────────────────────────────────────────────
// Cheapest place to catch a misreading: nothing is built yet.
const SPEC_LENSES_ALL = [
  {
    key: 'combined',
    ask: `Does every Done-when criterion map to a check that would fail today and pass once built, at the ` +
      `cheapest layer CLAUDE.md allows — and does the plan contradict anything CLAUDE.md decides, or name files ` +
      `that do not exist or do not own what it says?`,
  },
  {
    key: 'criteria',
    ask: `Does every Done-when criterion map to a check that would fail today and pass once built — at the ` +
      `cheapest layer CLAUDE.md allows? Is anything in the spec not asked for by the ticket?`,
  },
  {
    key: 'fit',
    ask: `Does the plan contradict anything CLAUDE.md decides (one action not bookmark+reserve, thin routes with ` +
      `rules in server/lib, camelCase at the boundary, useFetch, filters in the URL, tokens not hexes, nothing ` +
      `claiming to be true that is not, the clock)? Do the files it names exist and own what it says they own?`,
  },
]
const SPEC_LENSES = SPEC_LENSES_ALL.filter(l => T.specLenses.includes(l.key))

let specOpen = []
// Technical findings still open when the spec rounds run out: the build must
// resolve them, and the code audit is told to check that it did.
let carried = []
// Recorded like the build rounds: the spec audit's catches are the cheapest
// the loop makes, and the first live run's spec said "no findings" about a
// round that had confirmed and fixed one.
const specRounds = []
for (let round = 1; round <= MAX_SPEC_ROUNDS; round++) {
  phase('Spec Audit')
  const specAudit = await audit(SPEC_LENSES, (l, retry) =>
    agent(
      `You are auditing a spec you did not write. ${BATCH} ${ticket}\n\nRead ${spec.path} on branch ${setup.branch} ` +
      `(in ${setup.workdir}) and the docs/context/ docs for the files it names. ${MAP} ${l.ask}\n\n` +
      `You are judging the plan, not building it: open source only for a line the spec cites that the docs do ` +
      `not settle, and do not run tests or read node_modules — the build and the gate prove whether it works. ` +
      `A spec audit that re-derives the implementation costs more than the implementation.\n\n` +
      `Blockers only for something that would make ` +
      `the change wrong or unprovable; everything else is minor. Use category scope only when the TICKET itself ` +
      `is contradictory, unclear about what to build, or asks for something that cannot be built as written — ` +
      `that is what goes to a person; a flaw in the spec's plan is spec-gap or logic. Cite file and line. Empty ` +
      `is a good answer.`,
      { phase: 'Spec Audit', label: `spec-audit:${l.key}${retry}#${round}`, schema: FINDINGS, model: T.think, effort: SIZE === 'small' ? 'low' : undefined },
    ))
  if (specAudit.missing.length) return handBack('Spec Audit', `the ${specAudit.missing.join(', ')} auditor could not finish`)
  const found = specAudit.reports.flatMap(r => r.findings)

  const blockers = found.filter(f => f.severity === 'blocker')
  specOpen = blockers.length ? await confirm(blockers, 'the spec') : []
  history.push(...specOpen)
  specRounds.push({ round, raised: found.length, confirmed: specOpen.length, what: specOpen.map(f => f.claim) })
  log(`spec round ${round}: ${found.length} raised, ${specOpen.length} confirmed`)
  if (!specOpen.length) break
  // A person is needed only when the ticket itself is in question (scope).
  // Anything technical still open after the last round is revised once more,
  // decided in the spec, and carried into the build for the code audit to
  // check — #52 went to a person over a missing --repo flag.
  if (round === MAX_SPEC_ROUNDS && specOpen.some(f => f.category === 'scope')) {
    return handBack('Spec Audit', `the ticket itself is in question after ${round} spec rounds`,
      specOpen.filter(f => f.category === 'scope'), specOpen.filter(f => f.category !== 'scope'))
  }
  if (round === MAX_SPEC_ROUNDS) carried = specOpen

  const revised = await agent(
    `${ticket}\n\n${inTree()}\n\nIndependent auditors confirmed these problems with ${spec.path}:\n\n` +
    `${listFindings(specOpen)}\n\nRevise the spec to resolve each one — or, if the ticket itself is wrong, ` +
    `record that under *Decisions*. A technical question the ticket does not settle is yours to decide: ` +
    `decide it, and record the decision and why under *Decisions*. Commit ("docs(spec): …") and push.`,
    { phase: 'Spec Audit', label: `revise-spec#${round}`, schema: SPEC_WRITTEN, model: T.think },
  )
  if (!revised) return handBack('Spec Audit', 'the spec reviser died', specOpen)
  if (round === MAX_SPEC_ROUNDS) break
}

// ── 4. Implement ─────────────────────────────────────────────────────────────
phase('Implement')
const built = await agent(
  `${ticket}\n\n${inTree()}\n\n${MAP}\n\nImplement ${spec.path}, following §4–§6 of ${SKILL} (${sections(4, '7')} prints them). The spec's *Where* is your map: open ` +
  `those files directly — the spec writer has already found them, so do not search for the change site again ` +
  `unless *Where* turns out wrong. Write the check first and ` +
  `confirm it fails for the reason you expect — then commit it on its own, red, as "test(…)", before any fix; ` +
  `that commit is the evidence the check proves something. Then implement, running \`npm test\` after every edit. Commit ` +
  `in Conventional Commits and push. In the same push keep the docs true — you know what changed, a fresh agent ` +
  `would have to re-learn it: \`node scripts/context.mjs for <changed files>\` names the docs/context/ docs that ` +
  `own them; update each the change made wrong or incomplete (a new function, payload or testid — usually a ` +
  `line or two), and a new file no doc owns goes into the \`files\` of the doc for its area. ` +
  `Do NOT run the whole Playwright suite or the gate — the next phase does, once — but a browser test you ` +
  `added runs before you hand over, alone: \`npx playwright test <file> -g "<its title>"\` (on a laptop, behind ` +
  `the lane prefix). On #64 an unpinned clock in a new spec cost a whole red gate and a fix round. Return ok=false ` +
  `only if you hit something you cannot resolve; the summary names the proving test and the files changed. ` +
  `Every state the change adds gets its own assertion — each branch of a status or label, the empty case, and, ` +
  `when a state depends on the clock, a moment before it applies (Day 1 08:00: the seed's morning is already ` +
  `attended and rated). On #70 an untested branch became a follow-up and an unpinned early morning an escape. ` +
  `Set ui=true if anything an attendee sees in a browser changed — and then, in the browser test that proves it, ` +
  `call \`await shotForPR(page, '<what it shows>')\` (tests/helpers.js) at the moment the change is on screen: ` +
  `that is the pull request's picture, and it costs nothing when PR_SHOTS is unset. Set browserTest=true if you ` +
  `added or changed a Playwright test that drives the changed behaviour. For the pull request, return tryIt — how a ` +
  `reviewer sees the change in a step or two (a URL with ?at=YYYY-MM-DDTHH:MM and the attendee to pick, or a command) — and ` +
  `keyFiles, the one to three files where the change actually lives, each with why in a few words.` +
  (carried.length ? `\n\nThe spec audit left these open; resolve each in the build, and say how in the summary:\n${listFindings(carried)}` : ''),
  { phase: 'Implement', label: 'implement', schema: DONE, model: T.build },
)
if (!built || !built.ok) return handBack('Implement', built ? built.summary : 'the implementer died')

// ── 5+6. Verify → Code Audit → Fix, until a round is clean ───────────────────
// Every lens is a fresh agent that never sees the implementer's reasoning — only
// the ticket, the spec and the diff. That is what makes it an audit.
const CODE_LENSES_ALL = [
  {
    key: 'combined',
    ask: `Read the ticket first, then the spec — on a small ticket nobody else has checked that it reads the ticket ` +
      `right; a misreading is criterion-unmet, a ticket that contradicts itself is scope — then \`git diff origin/${BASE}...HEAD\`. For each Done-when criterion, find what ` +
      `satisfies it and the test that proves it — one with nothing satisfying it is a blocker, and so is a test ` +
      `that would pass before the change or an existing test weakened when the ticket did not ask for it ` +
      `(test-weakened). Then the same diff against CLAUDE.md: a decision it contradicts (quote the rule and the ` +
      `line) or a rule in .claude/rules/ for an area the diff touches, or a logic error with an input and the wrong output it produces. Last, \`node scripts/context.mjs ` +
      `for <changed files>\`: a docs/context/ doc that now describes the code wrongly is docs-stale (a minor ` +
      `unless an agent following it would build the wrong thing). ` +
      `docs/harness/code-review-playbook.md §2–§4 says what not to flag.`,
  },
  {
    key: 'criteria',
    ask: `Read the ticket first, then the spec — on a small ticket nobody else has checked that it reads the ticket ` +
      `right; a misreading is criterion-unmet, a ticket that contradicts itself is scope — then \`git diff origin/${BASE}...HEAD\`. For each Done-when criterion, find what ` +
      `satisfies it and the test that proves it. A criterion with nothing satisfying it is a blocker. So is a ` +
      `test that would pass before the change, or asserts the implementation against itself, or an existing ` +
      `test weakened (category test-weakened) when the ticket did not ask for that behaviour to change.`,
  },
  {
    key: 'rules',
    ask: `Read \`git diff origin/${BASE}...HEAD\` against CLAUDE.md. A blocker is a decision it records being ` +
      `contradicted — quote the rule and the line. Also: a logic error, with an input and the wrong output it ` +
      `produces. Follow docs/harness/code-review-playbook.md §2–§4 for what not to flag.`,
  },
  {
    key: 'browser',
    ask: `Drive the change in a real browser and try to break it, following docs/harness/qa-playbook.md §1–§3 ` +
      `(\`awk '/^## 1\\./,/^## 4\\./' docs/harness/qa-playbook.md\` prints them) ` +
      `(probes in tests/qa-probe.spec.js, both projects, re-run before calling anything a bug, delete the probe ` +
      `after and leave \`git status\` clean). Never check out another commit or stash in this tree; to try a ` +
      `probe on main, \`git worktree add ../orbit-main-${issue} origin/${BASE}\`, symlink node_modules into it, and ` +
      `remove it after. Budget: ${SIZE === 'full' ? 'five probes' : 'two probes — a small change; spend them where the tests it added do not reach'}. ` +
      `If the change depends on the time, one probe pins the clock before it applies — Day 1 08:00, when the ` +
      `seed's morning has not happened yet. ` +
      `A reproduced bug in this change is a blocker; pre-existing is ` +
      `minor. If nothing visible changed, say so in covered and return no findings.`,
    model: 'sonnet',
    // Boots the app and runs Playwright, so it runs after the readers rather
    // than beside the skeptics and the gate that need the same ports.
    alone: true,
  },
]
// The lenses that trace the ticket's criteria to tests — the ones the gate's
// weakened-test and flaky-test evidence must reach. Keyed by role, not by one
// lens name: the small tier's `combined` lens once missed it entirely.
const TRACES_CRITERIA = new Set(['criteria', 'combined'])
// Small tickets only get a browser pass when something visible changed.
// On a small ticket a browser test the branch added already runs in the gate on
// both viewports, and QA explores the browser once the PR opens; a second
// exploration inside ship cost #64 1.6M context tokens to probe two edges.
const CODE_LENSES = CODE_LENSES_ALL.filter(l =>
  T.codeLenses.includes(l.key) &&
  (l.key !== 'browser' || SIZE === 'full' || (built.ui !== false && built.browserTest !== true)))

const rounds = []
const streak = new Map() // finding key → consecutive rounds confirmed
let gate
let open = []
let minors = []

// A round that stops at a red gate never reached an auditor, so it does not
// spend the audit budget — on #64 a red gate took round 1 of a small ticket's
// two, and the only audit that ran was also the last. Red rounds get two
// extra rounds of slack; the same failure twice is caught as stuck anyway.
let audited = 0
let lastRed = null // the last red-check, for the PR's one-line summary
for (let round = 1; ; round++) {
  phase('Verify')
  // One rote agent for both commands: each agent costs its ~30k-token
  // baseline before it runs anything, and red-check needs no judgement.
  const ran = await rote(
    `${inTree()}\n\nRun \`GATE_BASE=origin/${BASE} node scripts/gate.mjs\` once and return the last line it printed, verbatim, as json. ` +
    `It runs npm test and the whole Playwright suite; in a runner Chromium is installed — never run playwright ` +
    `install. Only if that line contains "ok":true, then run \`GATE_BASE=origin/${BASE} node scripts/red-check.mjs\` ` +
    `once and return its last line, verbatim, as red. Change nothing and interpret nothing.`,
    { phase: 'Verify', label: `verify#${round}`, schema: GATE, effort: 'low', model: ROTE },
  )
  if (!ran) return handBack('Verify', 'the verify agent died')
  gate = readGate(ran)

  if (gate.ok) {
    audited++
    phase('Code Audit')
    const run = (l, retry) => agent(
      `You are auditing a change you did not write, on branch ${setup.branch} in ${setup.workdir}. ${BATCH} ` +
      `${ticket}\n\nThe spec is ${spec.path}. ${MAP} ${l.ask}\n\n` +
      (l.key === 'browser'
        ? `The gate has just run the whole suite green at ${gate.sha.slice(0, 7)} — do not run \`npm test\` or the suite; ` +
          `read the branch's own tests only to aim your probes past them. Write every probe into one file and run it ` +
          `once for both viewports (\`npx playwright test tests/qa-probe.spec.js\` runs both projects)` +
          `${setup.runner ? '' : `, behind \`eval "$(node scripts/lane.mjs claim ${issue})" &&\`; never release the lane — it belongs to the run`}.\n\n`
        : `The gate has just run the whole suite at ${gate.sha.slice(0, 7)}: ${gateLine(gate)}. Do not ` +
          `re-run it or \`npm test\` — read the tests instead; run a command only to prove one specific claim.\n\n`) +
      (TRACES_CRITERIA.has(l.key) && carried.length
        ? `The spec audit left these for the build to resolve — a blocker if any is still unresolved:\n${listFindings(carried)}\n\n`
        : '') +
      (TRACES_CRITERIA.has(l.key) && gate.tampered.length
        ? `The gate flagged these lines in tests/ as removed assertions or added skips:\n${gate.tampered.join('\n')}\n\n`
        : '') +
      (TRACES_CRITERIA.has(l.key) && gate.browser.flakyTests && gate.browser.flakyTests.length
        ? `These tests failed once and passed on retry: ${gate.browser.flakyTests.join(', ')}. One this branch added ` +
          `is a blocker (test-proves-nothing) — a flaky proof proves nothing. One it did not touch is not.\n\n`
        : '') +
      `Blockers only for something that would change a merge decision; everything else is minor. Change no ` +
      `code. Empty is a good answer.`,
      { phase: 'Code Audit', label: `audit:${l.key}${retry}#${round}`, schema: FINDINGS, model: l.model || T.think },
    )
    // Would the new tests fail without the change? A command answers it —
    // on #41 the small-tier auditor said it had checked, and the tests only
    // exercised a helper the change never touched. The result is a finding
    // for the skeptic, not a verdict: a refactor's tests pass either way.
    const red = { json: ran.red || '' }
    // Validated like readGate: a cheap model relaying the line can drop a
    // field, and a finding built from a partial result crashed the round.
    const redCheck = (() => {
      try {
        const r = JSON.parse(red.json)
        if (typeof r.checked !== 'boolean') return null
        if (r.checked && (typeof r.failedOnBase !== 'boolean' || !Array.isArray(r.tests) || !Array.isArray(r.reverted))) return null
        return r
      } catch { return null }
    })()
    lastRed = redCheck
    if (redCheck && redCheck.checked && redCheck.failedOnBase === false) {
      log(`build round ${round}: red-check — the new tests pass without the change`)
    }
    const readers = await audit(CODE_LENSES.filter(l => !l.alone), run)
    const driver = await audit(CODE_LENSES.filter(l => l.alone), run)
    const missing = [...readers.missing, ...driver.missing]
    if (missing.length) return handBack('Code Audit', `the ${missing.join(', ')} auditor could not finish`)
    const reports = [...readers.reports, ...driver.reports]

    const raised = [
      ...reports.flatMap(r => r.findings),
      ...(redCheck && redCheck.checked && redCheck.failedOnBase === false ? [{
        severity: 'blocker', category: 'test-proves-nothing', file: redCheck.tests[0] || 'tests/',
        claim: 'the tests this branch added or changed pass with its app code reverted',
        evidence: `scripts/red-check.mjs reverted ${redCheck.reverted.join(', ')} to ${BASE} and ran ${redCheck.tests.join(', ')}: none failed`,
        fix: 'add a test that exercises the changed code where an attendee meets it, and fails on the base branch',
      }] : []),
    ]
    minors = raised.filter(f => f.severity === 'minor')
    open = await confirm(raised.filter(f => f.severity === 'blocker'), 'the change')
    history.push(...open)
    rounds.push({ round, gate: gateLine(gate), raised: raised.length, confirmed: open.length,
      covered: reports.map(r => `ran ${r.ran || 'nothing'}: ${brief(r.covered)}`).join(' · ') })
    log(`build round ${round}: green, ${raised.length} raised, ${open.length} confirmed`)
    if (!open.length) {
      // About to ship: the minor notes go in the PR body, so they face a
      // skeptic too — a plausible-but-wrong note is still wrong, and a
      // reviewer acts on it.
      minors = await confirm(dedupe(minors).slice(0, 3), 'the change')
      break
    }
  } else {
    const failures = [
      ...(gate.unit.failed ? [{ test: 'npm test', error: gate.unit.output || `${gate.unit.failed} failed` }] : []),
      ...gate.browser.failed,
    ]
    // Red with nothing to point at — the app never booted, the report never
    // got written — is not something another fix round can aim at.
    if (!failures.length) return handBack('Verify', 'the gate is red but names no failing test')
    open = dedupe(failures.map(f => ({
      severity: 'blocker', category: 'gate', file: f.test, claim: `gate red: ${f.test}`, evidence: f.error,
      fix: 'make the gate green without editing, skipping or deleting an existing test',
    })))
    rounds.push({ round, gate: `red — ${gateLine(gate)}`, raised: open.length, confirmed: open.length, covered: '' })
    log(`build round ${round}: gate red, ${open.length} failing`)
  }

  // Once per key per round: several distinct findings inside one ten-line
  // window share a key, and counting each of them handed tickets back as
  // "survived 2 fix attempts" before a single fix had run.
  const roundKeys = new Set(open.map(key))
  for (const k of roundKeys) streak.set(k, (streak.get(k) || 0) + 1)
  const stuck = open.filter(f => streak.get(key(f)) > STUCK_AFTER)
  for (const k of [...streak.keys()]) if (!open.some(f => key(f) === k)) streak.delete(k)
  // A ticket that contradicts itself is not something a fixer can fix. On a
  // small ticket the code audit is the first reader to see the ticket at all.
  if (open.some(f => f.category === 'scope')) {
    return handBack('Code Audit', 'the ticket itself is in question', open.filter(f => f.category === 'scope'), open.filter(f => f.category !== 'scope'))
  }
  if (stuck.length) return handBack('Code Audit', `the same finding survived ${STUCK_AFTER} fix attempts`, open)
  if (audited >= MAX_BUILD_ROUNDS || round >= MAX_BUILD_ROUNDS + 2) return handBack('Code Audit', `still not clean after ${round} rounds`, open)

  const fixed = await agent(
    `${ticket}\n\n${inTree()}\n\nThe spec is ${spec.path}. These were independently confirmed against your ` +
    `branch:\n\n${listFindings(open)}\n\nFix each at its cause. The rules of §5 of ${SKILL} (${sections(5, '6')}) still hold: never ` +
    `edit an existing test to make it pass, never skip or delete one. If a finding shows the spec was wrong, ` +
    `fix the spec too and say so in the summary; if a fix changes what a docs/context/ doc says, fix the doc. ` +
    `\`npm test\` after every edit, and a browser test you added or changed alone by title; do not run the whole Playwright ` +
    `suite. Leave \`git status\` clean. Commit and push.`,
    { phase: 'Code Audit', label: `fix#${round}`, schema: DONE, model: T.build },
  )
  if (!fixed) return handBack('Code Audit', 'the fixer died', open)
}

// ── 7. Context ───────────────────────────────────────────────────────────────
// The docs are read instead of the code, so they change in the same pull
// request as the code they describe. The implementer and fixer update them as
// they go — they know what changed; a separate context agent re-learnt the
// whole change to move a line or two (~400k context tokens a ticket) — and
// the code audit checks them (docs-stale). The rounds live in the PR body.

// ── 8. Learn ────────────────────────────────────────────────────────────────
// What the audits kept catching is context the implementer did not have. It goes
// into the docs before the pull request opens, so the reviewers and the person
// merging see the lesson with the code — never in a push after they looked.
const lessons = await learn('passed its audit')

// ── 9. PR ────────────────────────────────────────────────────────────────────
phase('PR')
const auditTable = [
  ...specRounds.map(r => `| spec ${r.round} | — | ${r.raised} raised · ${r.confirmed} confirmed | ${r.what.map(brief).join('; ') || '—'} |`),
  ...rounds.map(r => `| build ${r.round} | ${r.gate} | ${r.raised} raised · ${r.confirmed} confirmed | ${r.covered || '—'} |`),
].join('\n')
// Everything the body needs, the script already holds — the gate, the rounds,
// the spec, the criteria. Told to "follow §8" the agent spent 20 turns on #61
// finding §8, re-reading the spec and code and re-running npm test. So the
// shape is given here, nothing is re-verified, and only a visible change —
// screenshots are a judgement — gets more than the rote model.
const visible = built.ui !== false
const fixed = rounds.reduce((n, r) => n + r.confirmed, 0) + specRounds.reduce((n, r) => n + r.confirmed, 0)
// What the loop did not prove, said plainly: an agent PR that claims more than
// it did merges far less often, and "not verified" is where a reviewer looks.
const notVerified = [
  ...(!(lastRed && lastRed.checked) ? ['no red-check ran — no app code changed, or it could not'] : []),
  ...(lastRed && lastRed.checked && !lastRed.failedOnBase ? ['the new tests also pass without the change (judged a refactor)'] : []),
  ...(!CODE_LENSES.some(l => l.key === 'browser') ? ['not explored in a browser beyond its own tests — QA does that next'] : []),
  ...(gate.browser.flakyTests && gate.browser.flakyTests.length ? [`${gate.browser.flakyTests.length} test(s) flaky, passed on retry`] : []),
]
const checksLine = [
  `All tests pass — ${gate.unit.passed} unit · ${gate.browser.passed} browser, desktop and mobile`,
  ...(lastRed && lastRed.checked && lastRed.failedOnBase ? ['the new tests fail without the change'] : []),
  `independent audit: ${fixed ? `${fixed} problem${fixed === 1 ? '' : 's'} found and fixed, ` : ''}clean after ${rounds.length} round${rounds.length === 1 ? '' : 's'}`,
].join(' · ')
const pr = await rote(
  `${ticket}\n\n${inTree({ releases: true })}\n\nOpen the pull request for this branch. Everything is built, gated and audited: do ` +
  `not re-read the spec, the playbook or the code, and do not run tests. Gather what *Changed* needs in ONE command, ` +
  `then write — on #70 this step took 22 turns one command at a time:\n` +
  `\`git diff --stat origin/${BASE}...HEAD; echo ---; git log --oneline origin/${BASE}..HEAD; echo ---; ` +
  `git log --name-only --format=%h ${gate.sha}..HEAD; echo ---; git remote get-url origin\`\n` +
  `If the third part lists a file outside docs/, specs/ or *.md, stop and return ok=false.\n\n` +
  (visible
    ? `Something an attendee sees changed. The branch's browser test calls shotForPR at the moment worth seeing: ` +
      `run the test files this branch added or changed with \`PR_SHOTS=1 npx playwright test <files> --project=desktop\`` +
      `${setup.runner ? '' : ' (behind the lane prefix)'}, then \`node scripts/pr-media.mjs ${issue} .screenshots/pr/*.png\` and ` +
      `put what it prints where the body shows <media>. If no file appears, drop the <media> line — do not write a ` +
      `script, start a server or drive a browser to make one.\n\n`
    : `Nothing visible changed: no screenshots, and drop the <media> line.\n\n`) +
  // Written for the person who has to decide: what changed for an attendee,
  // what it looks like, how to see it, which criteria are proved, where to
  // look first — the machine detail folded away. #77's body led with eleven
  // file paths and a table of agent shorthand.
  `Write this body to /tmp/pr-body-${issue}.md, filling the <…> parts in plain words:\n\n` +
  `Closes #${issue} · 📄 [Spec](https://github.com/<owner>/<repo>/blob/${setup.branch}/${spec.path})\n\n` +
  `## What changes\n<two or three short sentences: why this was needed (from the ticket), then what an attendee or ` +
  `developer sees or gets now — not how it was built>\n\n` +
  `<media — each screenshot on its own line with a one-line bold caption above it>\n\n` +
  (built.tryIt ? `## 🧪 Try it\n${built.tryIt}\n\n` : '') +
  `## ✅ Done when\n` + (setup.doneWhen || []).map(c => `- [x] ${c} — \`<the test that proves it>\``).join('\n') + `\n\n` +
  (spec.decisions && spec.decisions.length
    ? `## 🤔 Decisions for you\n` + spec.decisions.map(d => `- ${d}`).join('\n') + `\n\n`
    : '') +
  (built.keyFiles && built.keyFiles.length
    ? `## 👀 Where to look\n` + built.keyFiles.map(k => `- \`${k.file}\` — ${k.why}`).join('\n') + `\n\n`
    : '') +
  `## 🛡️ Checks\n${checksLine}` +
  (notVerified.length ? `\n\n**Not verified:** ${notVerified.join('; ')}.` : '') +
  (gate.tampered.length ? `\n\n⚠️ **This changes tests or CI config** — look at these first: ${[...new Set(gate.tampered.map(t => t.split(':')[0]))].map(f => `\`${f}\``).join(', ')}` : '') +
  `\n\n` +
  (minors.length
    ? `<details><summary>Worth a closer look</summary>\n\n<only those of these unconfirmed notes a reviewer would ` +
      `want, one line each:\n${listFindings(minors)}>\n</details>\n\n`
    : '') +
  `<details><summary>Every file changed</summary>\n\n<from git diff --stat: one line per file — \`file\` — what, in a few words>\n</details>\n\n` +
  `<details><summary>Audit rounds</summary>\n\n| Round | Gate | Independent audit | Covered |\n| --- | --- | --- | --- |\n${auditTable}\n` +
  (gate.browser.flakyTests && gate.browser.flakyTests.length ? `\nFlaky, passed on retry: ${gate.browser.flakyTests.join(', ')}.\n` : '') +
  (lessons.length ? `\nLessons written to the docs: ${lessons.map(l => l.proposal.split(setup.workdir + '/').join('')).join('; ')}\n` : '') +
  `</details>\n\n` +
  `<sub>🤖 Built by ship · ${SIZE} ticket · ${SIZE === 'full' ? 'Opus' : 'Sonnet'} · its cost is posted below · ` +
  `to ask for a change, comment \`@claude …\` — put all your comments in one review</sub>\n\n` +
  `Keep everything above the folded sections under 250 words. In *Done when*, cite only tests in files that ` +
  `\`git diff --stat\` shows this branch changed — never a test that is not in the diff.\n\n` +
  `Then, from the worktree: \`git push -u origin HEAD\`; \`gh pr create --base ${BASE} --title "${setup.title.replace(/"/g, '\\"')}" ` +
  `--body-file /tmp/pr-body-${issue}.md${SIZE === 'full' ? ' --label ship:full' : ''}\` (if an open draft already exists ` +
  `for this branch, \`gh pr edit\` its body and \`gh pr ready\` it instead); \`gh issue comment ${issue} --body "Ready ` +
  `for review: <url>"\`; \`gh issue edit ${issue} --add-label ready-for-human --remove-label ai-working\`` +
  (setup.runner ? '' : `; then \`node scripts/lane.mjs release ${issue}\``) + `. Return the PR url.`,
  { phase: 'PR', label: 'open-pr', schema: DONE, effort: 'low', model: ROTE },
)
if (!pr || !pr.ok) return handBack('PR', pr ? pr.summary : 'the PR agent died')

// The PR agent released the lane on its way out.
return {
  outcome: 'shipped',
  issue,
  size: SIZE,
  pr: pr.url,
  rounds,
  lessons,
}
