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
    { title: 'Context', detail: 'update the docs/context files this change touched' },
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
    specRounds: 1, buildRounds: 2,
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
let T = TIERS.full
// The same finding confirmed this many rounds running means the fixer cannot
// fix it. Escalate early instead of spending the remaining rounds.
const STUCK_AFTER = 2

// `/ship 42`, `/ship 42 <what the person said>` (a comment that asked for
// this run), or `{ issue, base, notes }`.
const argText = typeof args === 'object' && args ? '' : String(args ?? '').trim()
const issue = Number(typeof args === 'object' && args ? args.issue : (/^#?(\d+)/.exec(argText) || [])[1])
const FORCED = typeof args === 'object' && args ? args.size : (/--(full|small)\b/.exec(argText) || [])[1]
const NOTES = String((typeof args === 'object' && args ? args.notes : argText.replace(/^#?\d+\s*/, '')) || '')
  .replace(/@claude\b/gi, '').replace(/--(full|small)\b/g, '').trim()
// The branch the work starts from and the pull request targets. `main`
// unless this ticket stacks on another pull request that has not landed.
const BASE = (typeof args === 'object' && args && args.base) || 'main'
if (!Number.isInteger(issue) || issue <= 0) {
  return { outcome: 'error', reason: `ship needs an issue number, got ${JSON.stringify(args)}` }
}

const SKILL = 'docs/harness/ship-playbook.md'

// Every agent is a fresh context. Without this line each one re-reads the
// source to learn how the app fits together, and that is most of the bill.
const MAP =
  `Start from \`node scripts/context.mjs index\` and read the one or two docs in docs/context/ for the area ` +
  `this touches. Take their word for how the app fits together; open source only for the lines you will ` +
  `change or must verify.`

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
    doneWhen: { type: 'array', items: { type: 'string' }, description: 'each Done-when criterion, verbatim' },
    size: { enum: ['small', 'full'], description: 'small unless the issue is labelled ship:full, or it changes a rule in server/lib, the schema or seed, an API shape, or several areas at once, or has more than four Done-when criteria' },
  },
}

const SPEC_WRITTEN = {
  type: 'object',
  required: ['path', 'summary'],
  properties: {
    path: { type: 'string' },
    summary: { type: 'string', description: 'two sentences: the approach and how it will be proved' },
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
            enum: ['criterion-unmet', 'claude-md', 'logic', 'test-proves-nothing', 'test-weakened', 'browser', 'spec-gap', 'scope', 'gate'],
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
const where = f => `${f.file}|${f.line ? f.line : f.claim.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 60)}`
const dedupe = fs => [...fs.reduce((m, f) => (m.has(where(f)) ? m : m.set(where(f), f)), new Map()).values()]

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
  fs.map((f, i) => `${i + 1}. [${f.category}] ${f.file}${f.line ? ':' + f.line : ''} — ${f.claim}\n   evidence: ${f.evidence}\n   fix: ${f.fix}`).join('\n')

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
      `If you cannot tell, it is NOT refuted.\n\n` +
      listFindings([f]),
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
const inTree = () =>
  `Work in ${setup.workdir} on branch ${setup.branch} (based on ${BASE}): cd there at the start of every Bash command.` +
  (setup.runner
    ? ''
    : ` This is a laptop with other agents on it, so prefix anything that boots the app or runs Playwright with ` +
      `\`eval "$(node scripts/lane.mjs claim ${issue})" &&\` — shell state does not persist between commands. ` +
      `Never release the lane: it belongs to the whole run, and the workflow releases it at the end.`)

async function handBack(stage, why, open) {
  log(`handing #${issue} back at ${stage}: ${why}`)
  // A run that could not converge is the one with the most to teach, so it
  // learns before it pushes — the lessons land on the draft with the work.
  const lessons = setup && setup.branch && !learned ? await learn(`stopped at ${stage}: ${why}`) : []
  phase('Learn')
  await agent(
    `Hand GitHub issue #${issue} back to a person. The automated ship run stopped at "${stage}" because: ${why}\n\n` +
    (open && open.length ? `Still open when it stopped:\n${listFindings(open)}\n\n` : '') +
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

// ── 1. Setup ─────────────────────────────────────────────────────────────────
phase('Setup')
setup = await agent(
  (NOTES ? `This run was asked for in a comment: "${NOTES}". A closed pull request from an earlier attempt is ` +
    `not a reason to stop.\n\n` : '') +
  `Set up to ship GitHub issue #${issue}. Follow §1–§3 of ${SKILL} exactly: read the ticket, decide whether ` +
  `it is shippable (stop if it is closed, already has a ready — non-draft — PR, states no outcome a check could be written ` +
  `against, or asks for two unrelated things; a draft is an earlier attempt to continue), claim it — removing ` +
  `ready-for-ai (and any needs-human or ready-for-human left by an earlier attempt) whether or not you proceed — ` +
  `and make the workspace — branch in a runner, ` +
  `worktree + npm install on a laptop — from origin/${BASE}, not necessarily main. If an issue-${issue}-* branch is already on origin from an earlier ` +
  `attempt, continue on it rather than making a new one, and say so in reason. First of all, check the base ` +
  `carries the harness this run depends on: \`git cat-file -e origin/${BASE}:scripts/gate.mjs && git cat-file -e ` +
  `origin/${BASE}:docs/harness/ship-playbook.md\`. If not, set harnessOnBase=false and proceed=false — every ` +
  `later phase would run commands that do not exist in the worktree. Do not write the spec or any code. Return proceed=false with the ` +
  `reason if it is not shippable, and in that case also do §9 (comment and label needs-human). Size it: small ` +
  `unless it carries the ship:full label or the size description says otherwise — most tickets are small.`,
  { phase: 'Setup', label: 'setup', schema: SETUP, effort: 'low', model: 'sonnet' },
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
spec = await agent(
  `${ticket}\n\n${inTree()}\n\nWrite the spec, following §3b of ${SKILL}: specs/${issue}-${setup.slug}.md, ` +
  `commit it as the branch's first commit, push, and comment the link on the issue. ${MAP} Every Done-when ` +
  `criterion must map to a named check at a named layer.`,
  { phase: 'Spec', label: 'write-spec', schema: SPEC_WRITTEN, model: T.think },
)
if (!spec) return handBack('Spec', 'the spec writer died')

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
// Recorded like the build rounds: the spec audit's catches are the cheapest
// the loop makes, and the first live run's spec said "no findings" about a
// round that had confirmed and fixed one.
const specRounds = []
for (let round = 1; round <= MAX_SPEC_ROUNDS; round++) {
  phase('Spec Audit')
  const specAudit = await audit(SPEC_LENSES, (l, retry) =>
    agent(
      `You are auditing a spec you did not write. ${ticket}\n\nRead ${spec.path} on branch ${setup.branch} ` +
      `(in ${setup.workdir}) and the code it names. ${MAP} ${l.ask}\n\nBlockers only for something that would make ` +
      `the change wrong or unprovable; everything else is minor. Cite file and line. Empty is a good answer.`,
      { phase: 'Spec Audit', label: `spec-audit:${l.key}${retry}#${round}`, schema: FINDINGS, model: T.think },
    ))
  if (specAudit.missing.length) return handBack('Spec Audit', `the ${specAudit.missing.join(', ')} auditor could not finish`)
  const found = specAudit.reports.flatMap(r => r.findings)

  const blockers = found.filter(f => f.severity === 'blocker')
  specOpen = blockers.length ? await confirm(blockers, 'the spec') : []
  history.push(...specOpen)
  specRounds.push({ round, raised: found.length, confirmed: specOpen.length, what: specOpen.map(f => f.claim) })
  log(`spec round ${round}: ${found.length} raised, ${specOpen.length} confirmed`)
  if (!specOpen.length) break
  // Full: a spec that will not converge goes to a person. Small: one audit,
  // one revision, on to the build — the code audit still stands behind it.
  if (round === MAX_SPEC_ROUNDS && SIZE === 'full') return handBack('Spec Audit', `spec still has blockers after ${round} rounds`, specOpen)

  const revised = await agent(
    `${ticket}\n\n${inTree()}\n\nIndependent auditors confirmed these problems with ${spec.path}:\n\n` +
    `${listFindings(specOpen)}\n\nRevise the spec to resolve each one — or, if the ticket itself is wrong, ` +
    `record that under *Decisions*. Commit ("docs(spec): …") and push.`,
    { phase: 'Spec Audit', label: `revise-spec#${round}`, schema: SPEC_WRITTEN, model: T.think },
  )
  if (!revised) return handBack('Spec Audit', 'the spec reviser died', specOpen)
  if (round === MAX_SPEC_ROUNDS) break
}

// ── 4. Implement ─────────────────────────────────────────────────────────────
phase('Implement')
const built = await agent(
  `${ticket}\n\n${inTree()}\n\n${MAP}\n\nImplement ${spec.path}, following §4–§6 of ${SKILL}: write the check first and ` +
  `confirm it fails for the reason you expect — then commit it on its own, red, as "test(…)", before any fix; ` +
  `that commit is the evidence the check proves something. Then implement, running \`npm test\` after every edit. Commit ` +
  `in Conventional Commits and push. Do NOT run the Playwright suite or the gate — the next phase does, once. Return ok=false ` +
  `only if you hit something you cannot resolve; the summary names the proving test and the files changed. ` +
  `Set ui=true if anything an attendee sees in a browser changed.`,
  { phase: 'Implement', label: 'implement', schema: DONE, model: T.build },
)
if (!built || !built.ok) return handBack('Implement', built ? built.summary : 'the implementer died')

// ── 5+6. Verify → Code Audit → Fix, until a round is clean ───────────────────
// Every lens is a fresh agent that never sees the implementer's reasoning — only
// the ticket, the spec and the diff. That is what makes it an audit.
const CODE_LENSES_ALL = [
  {
    key: 'combined',
    ask: `Read the ticket first, then \`git diff origin/${BASE}...HEAD\`. For each Done-when criterion, find what ` +
      `satisfies it and the test that proves it — one with nothing satisfying it is a blocker, and so is a test ` +
      `that would pass before the change or an existing test weakened when the ticket did not ask for it ` +
      `(test-weakened). Then the same diff against CLAUDE.md: a decision it contradicts (quote the rule and the ` +
      `line), or a logic error with an input and the wrong output it produces. ` +
      `docs/harness/code-review-playbook.md §2–§4 says what not to flag.`,
  },
  {
    key: 'criteria',
    ask: `Read the ticket first, then \`git diff origin/${BASE}...HEAD\`. For each Done-when criterion, find what ` +
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
      `(probes in tests/qa-probe.spec.js, both projects, re-run before calling anything a bug, delete the probe ` +
      `after and leave \`git status\` clean). Never check out another commit or stash in this tree; to try a ` +
      `probe on main, \`git worktree add ../orbit-main-${issue} origin/${BASE}\`, symlink node_modules into it, and ` +
      `remove it after. Budget: six probes. A reproduced bug in this change is a blocker; pre-existing is ` +
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
const CODE_LENSES = CODE_LENSES_ALL.filter(l =>
  T.codeLenses.includes(l.key) && (l.key !== 'browser' || SIZE === 'full' || built.ui !== false))

const rounds = []
const streak = new Map() // finding key → consecutive rounds confirmed
let gate
let open = []
let minors = []

for (let round = 1; round <= MAX_BUILD_ROUNDS; round++) {
  phase('Verify')
  const ran = await agent(
    `${inTree()}\n\nRun \`GATE_BASE=origin/${BASE} node scripts/gate.mjs\` once and return the last line it printed, verbatim, as json. ` +
    `It runs npm test and the whole Playwright suite; in a runner Chromium is installed — never run playwright ` +
    `install. Change nothing and interpret nothing.`,
    { phase: 'Verify', label: `verify#${round}`, schema: GATE, effort: 'low', model: ROTE },
  )
  if (!ran) return handBack('Verify', 'the verify agent died')
  gate = readGate(ran)

  if (gate.ok) {
    phase('Code Audit')
    const run = (l, retry) => agent(
      `You are auditing a change you did not write, on branch ${setup.branch} in ${setup.workdir}. ` +
      `${ticket}\n\nThe spec is ${spec.path}. ${MAP} ${l.ask}\n\n` +
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
    const red = await agent(
      `${inTree()}\n\nRun \`GATE_BASE=origin/${BASE} node scripts/red-check.mjs\` once and return the last line it ` +
      `printed, verbatim, as json. Change nothing and interpret nothing.`,
      { phase: 'Verify', label: `red-check#${round}`, schema: GATE, effort: 'low', model: ROTE },
    )
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
  if (stuck.length) return handBack('Code Audit', `the same finding survived ${STUCK_AFTER} fix attempts`, open)
  if (round === MAX_BUILD_ROUNDS) return handBack('Code Audit', `still not clean after ${round} rounds`, open)

  const fixed = await agent(
    `${ticket}\n\n${inTree()}\n\nThe spec is ${spec.path}. These were independently confirmed against your ` +
    `branch:\n\n${listFindings(open)}\n\nFix each at its cause. The rules of §5 of ${SKILL} still hold: never ` +
    `edit an existing test to make it pass, never skip or delete one. If a finding shows the spec was wrong, ` +
    `fix the spec too and say so in the summary. \`npm test\` after every edit; do not run the Playwright ` +
    `suite. Leave \`git status\` clean. Commit and push.`,
    { phase: 'Code Audit', label: `fix#${round}`, schema: DONE, model: T.build },
  )
  if (!fixed) return handBack('Code Audit', 'the fixer died', open)
}

// ── 7. Context ───────────────────────────────────────────────────────────────
// The docs are read instead of the code, so they change in the same pull
// request as the code they describe — never in a follow-up nobody writes.
phase('Context')
const context = await agent(
  `${inTree()}\n\nThe change on this branch is done and audited. Keep what describes it true:\n` +
  `1. \`node scripts/context.mjs for $(git diff --name-only origin/${BASE}...HEAD)\` lists the docs/context/ ` +
  `docs that own the changed files. Update each where the change made it wrong or incomplete — a new ` +
  `function, a changed payload, a new testid. A file the branch added that no doc owns goes into the ` +
  `\`files\` of the doc for its area. Most changes move a line or two; none is fine.\n` +
  `2. Make ${spec.path} true of what shipped, and add a short *Audit* section — a line per round, what it ` +
  `confirmed and how that was resolved (\`git log\` shows the fix commits). These are the rounds; do not ` +
  `describe any other:\n` +
  specRounds.map(r => `   spec round ${r.round}: ${r.raised} raised, ${r.confirmed} confirmed${r.what.length ? ` — ${r.what.join('; ')}` : ''}`).join('\n') + '\n' +
  rounds.map(r => `   build round ${r.round}: ${r.gate}; ${r.raised} raised, ${r.confirmed} confirmed`).join('\n') + '\n' +
  `3. Only if the change made a *decision* a future implementer must respect, add it to CLAUDE.md.\n` +
  `\`npm test\` (the context check runs there), commit as "docs(context): …" and push.`,
  { phase: 'Context', label: 'context', schema: DONE, effort: 'low', model: T.think },
)
if (!context || !context.ok) return handBack('Context', context ? context.summary : 'the context agent died')

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
const pr = await agent(
  `${ticket}\n\n${inTree()}\n\nOpen the pull request against ${BASE}, following §8 of ${SKILL} — ready for review, screenshots ` +
  `only if something visible changed, the body in the shape given there. In the *Proof* table use: ` +
  `\`node scripts/gate.mjs\` → ${gateLine(gate)}, at ${gate.sha.slice(0, 7)}. If \`git log ${gate.sha}..HEAD\` ` +
  `shows later commits, say in one line that they touch only docs — and if any touches code, stop and ` +
  `return ok=false instead. After it, add this section verbatim:\n\n` +
  `### Audit loop\n| Round | Gate | Independent audit | Confirmed / covered |\n| --- | --- | --- | --- |\n${auditTable}\n\n` +
  (gate.browser.flakyTests && gate.browser.flakyTests.length ? `Under the table, one line: flaky on retry — ${gate.browser.flakyTests.join(', ')}.\n\n` : '') +
  `Link the spec as a full URL to the file on this branch (https://github.com/<owner>/<repo>/blob/${setup.branch}/${spec.path}) — a ` +
  `relative link does not resolve from a PR body. List every test the change added in the Proof table.\n\n` +
  (lessons.length ? `And a *Lessons* line listing what Learn wrote: ${lessons.map(l => l.proposal.split(setup.workdir + '/').join('')).join('; ')}\n\n` : '') +
  (minors.length
    ? `Put these unconfirmed minor notes inside the "Worth a closer look" block, one line each, only if a ` +
      `reviewer would want them:\n${listFindings(minors)}\n\n`
    : '') +
  `Comment the PR link on the issue and move the label to ready-for-human. Return the PR url.`,
  { phase: 'PR', label: 'open-pr', schema: DONE, model: T.think },
)
if (!pr || !pr.ok) return handBack('PR', pr ? pr.summary : 'the PR agent died')

await cleanup()

return {
  outcome: 'shipped',
  issue,
  size: SIZE,
  pr: pr.url,
  rounds,
  lessons,
}
