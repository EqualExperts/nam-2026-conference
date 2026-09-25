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
// burning another round on a finding the builder keeps failing to fix.
const MAX_SPEC_ROUNDS = 3
const MAX_BUILD_ROUNDS = 4
// The same finding confirmed this many rounds running means the fixer cannot
// fix it. Escalate early instead of spending the remaining rounds.
const STUCK_AFTER = 2

const issue = Number(typeof args === 'object' && args ? args.issue : args)
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
    doneWhen: { type: 'array', items: { type: 'string' }, description: 'each Done-when criterion, verbatim' },
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
  required: ['findings', 'covered'],
  properties: {
    covered: { type: 'string', description: 'what you were able to judge, in a few words' },
    findings: {
      type: 'array',
      // Unbounded, one auditor can fan out a skeptic per nit. Five blockers
      // in one lens means the build is wrong, not that it needs five fixes.
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
const dedupe = fs => [...new Map(fs.map(f => [key(f), f])).values()]

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
      `${ticket}\n\n${inTree()}\n\nThe spec is ${spec.path}. An auditor claims this blocker in ${where}. Try to ` +
      `REFUTE it. Open the cited file and line yourself; \`npm test\` is fine, but do not boot the app or run ` +
      `Playwright — other agents are using the ports. Refute if the line does not say what is claimed, if the ` +
      `behaviour is already on origin/main, if the finding is style rather than a defect, or if CLAUDE.md or ` +
      `the spec *as first committed* (\`git log --diff-filter=A --format=%H -- ${spec.path}\`, then \`git show\`) ` +
      `shows it was deliberate. A later edit to the spec does not make a missed Done-when criterion deliberate. ` +
      `If you cannot tell, it is NOT refuted.\n\n` +
      listFindings([f]),
      { phase: where === 'the spec' ? 'Spec Audit' : 'Code Audit', label: `skeptic:${f.category}`, schema: REFUTATION, effort: 'medium' },
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
  `Work in ${setup.workdir} on branch ${setup.branch}: cd there at the start of every Bash command.` +
  (setup.runner
    ? ''
    : ` This is a laptop with other agents on it, so prefix anything that boots the app or runs Playwright with ` +
      `\`eval "$(node scripts/lane.mjs claim ${issue})" &&\` — shell state does not persist between commands.`)

async function handBack(stage, why, open) {
  log(`handing #${issue} back at ${stage}: ${why}`)
  // A run that could not converge is the one with the most to teach, so it
  // learns before it pushes — the lessons land on the draft with the work.
  const lessons = setup && setup.branch && !learned ? await learn(`stopped at ${stage}: ${why}`) : []
  phase('Learn')
  await agent(
    `Hand GitHub issue #${issue} back to a person. The automated build stopped at "${stage}" because: ${why}\n\n` +
    (open && open.length ? `Still open when it stopped:\n${listFindings(open)}\n\n` : '') +
    (setup && setup.branch
      ? `${inTree()}\nPush whatever is committed (git push -u origin HEAD), then open a DRAFT pull request so the ` +
        `work is not lost — or, if a draft from an earlier attempt is already open on this branch, update its ` +
        `body with \`gh pr edit\` instead: \`gh pr create --draft --base main\`, titled with the issue title, body opening ` +
        `"Refs #${issue}" (not Closes), then a short "Why this stopped" section and the open list above. ` +
        `Skip the draft if nothing beyond the spec is committed.\n`
      : '') +
    `Then comment on the issue — what was tried, what stopped it, what it needs from a person, and the draft ` +
    `PR link if there is one — and run: gh issue edit ${issue} --add-label needs-human --remove-label ai-working`,
    { phase: 'Learn', label: 'hand-back', schema: DONE, effort: 'low' },
  )
  return { outcome: 'needs-human', issue, stage, reason: why, open: open || [], lessons }
}

let learned = false
async function learn(how) {
  learned = true
  phase('Learn')
  if (!history.length) return []
  const result = await agent(
    `${inTree()}\n\nThe build of issue #${issue} ${how}. Along the way independent audits confirmed these ` +
    `problems the builder had missed:\n\n${listFindings(history)}\n\nFind at most two classes of mistake that ` +
    `would recur on a different ticket — not this ticket's specifics. For each, decide where the knowledge ` +
    `would have been seen in time: the *Gotchas* of the docs/context/ doc for that area (usually), CLAUDE.md ` +
    `(only for a decision, not a fact about code), or ${SKILL} (for a process step). If it is already written ` +
    `there, it is being missed: make it shorter and move it higher rather than repeating it. Edit those files, ` +
    `in the voice around them, present tense — they are read instead of the code, so write only what you have ` +
    `checked against it. \`npm test\` (the context check runs there). Commit as "docs(context): …" and push. ` +
    `If nothing generalises, change nothing and return an empty list.`,
    { phase: 'Learn', label: 'learn', schema: LESSON, effort: 'medium' },
  )
  return result ? result.lessons : []
}

// ── 1. Setup ─────────────────────────────────────────────────────────────────
phase('Setup')
setup = await agent(
  `Set up to build GitHub issue #${issue}. Follow §1–§3 of ${SKILL} exactly: read the ticket, decide whether ` +
  `it is buildable (stop if it is closed, already has a ready — non-draft — PR, states no outcome a check could be written ` +
  `against, or asks for two unrelated things; a draft is an earlier attempt to continue), claim it — removing ` +
  `ready-for-ai (and any needs-human left by an earlier attempt) whether or not you proceed — and make the workspace — branch in a runner, ` +
  `worktree + npm install on a laptop. If an issue-${issue}-* branch is already on origin from an earlier ` +
  `attempt, continue on it rather than making a new one, and say so in reason. Do not write the spec or any code. Return proceed=false with the ` +
  `reason if it is not buildable, and in that case also do §9 (comment and label needs-human).`,
  { phase: 'Setup', label: 'setup', schema: SETUP, effort: 'low' },
)
if (!setup) { setup = null; return handBack('Setup', 'the setup agent died, possibly after claiming the ticket') }
if (!setup.proceed) return { outcome: 'declined', issue, reason: setup.reason }
const missingSetup = ['title', 'slug', 'branch', 'workdir', 'doneWhen'].filter(k => !setup[k] || (k === 'doneWhen' && !setup.doneWhen.length))
if (missingSetup.length) {
  const partial = setup
  setup = partial.branch && partial.workdir ? partial : null
  return handBack('Setup', `setup returned no ${missingSetup.join(', ')}`)
}
log(`#${issue} ${setup.title} → ${setup.branch}`)

ticket =
  `GitHub issue #${issue}: ${setup.title}\nDone when:\n` + setup.doneWhen.map(c => `- ${c}`).join('\n')

// ── 2. Spec ──────────────────────────────────────────────────────────────────
phase('Spec')
spec = await agent(
  `${ticket}\n\n${inTree()}\n\nWrite the spec, following §3b of ${SKILL}: specs/${issue}-${setup.slug}.md, ` +
  `commit it as the branch's first commit, push, and comment the link on the issue. ${MAP} Every Done-when ` +
  `criterion must map to a named check at a named layer.`,
  { phase: 'Spec', label: 'write-spec', schema: SPEC_WRITTEN },
)
if (!spec) return handBack('Spec', 'the spec writer died')

// ── 3. Spec Audit ────────────────────────────────────────────────────────────
// Cheapest place to catch a misreading: nothing is built yet.
const SPEC_LENSES = [
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

let specOpen = []
for (let round = 1; round <= MAX_SPEC_ROUNDS; round++) {
  phase('Spec Audit')
  const specAudit = await audit(SPEC_LENSES, (l, retry) =>
    agent(
      `You are auditing a spec you did not write. ${ticket}\n\nRead ${spec.path} on branch ${setup.branch} ` +
      `(in ${setup.workdir}) and the code it names. ${MAP} ${l.ask}\n\nBlockers only for something that would make ` +
      `the build wrong or unprovable; everything else is minor. Cite file and line. Empty is a good answer.`,
      { phase: 'Spec Audit', label: `spec-audit:${l.key}${retry}#${round}`, schema: FINDINGS },
    ))
  if (specAudit.missing.length) return handBack('Spec Audit', `the ${specAudit.missing.join(', ')} auditor could not finish`)
  const found = specAudit.reports.flatMap(r => r.findings)

  const blockers = found.filter(f => f.severity === 'blocker')
  specOpen = blockers.length ? await confirm(blockers, 'the spec') : []
  history.push(...specOpen)
  log(`spec round ${round}: ${found.length} raised, ${specOpen.length} confirmed`)
  if (!specOpen.length) break
  if (round === MAX_SPEC_ROUNDS) return handBack('Spec Audit', `spec still has blockers after ${round} rounds`, specOpen)

  const revised = await agent(
    `${ticket}\n\n${inTree()}\n\nIndependent auditors confirmed these problems with ${spec.path}:\n\n` +
    `${listFindings(specOpen)}\n\nRevise the spec to resolve each one — or, if the ticket itself is wrong, ` +
    `record that under *Decisions*. Commit ("docs(spec): …") and push.`,
    { phase: 'Spec Audit', label: `revise-spec#${round}`, schema: SPEC_WRITTEN },
  )
  if (!revised) return handBack('Spec Audit', 'the spec reviser died', specOpen)
}

// ── 4. Implement ─────────────────────────────────────────────────────────────
phase('Implement')
const built = await agent(
  `${ticket}\n\n${inTree()}\n\n${MAP}\n\nImplement ${spec.path}, following §4–§6 of ${SKILL}: write the check first and ` +
  `confirm it fails for the reason you expect, then implement, running \`npm test\` after every edit. Commit ` +
  `in Conventional Commits and push. Do NOT run the Playwright suite or the gate — the next phase does, once. Return ok=false ` +
  `only if you hit something you cannot resolve; the summary names the proving test and the files changed.`,
  { phase: 'Implement', label: 'implement', schema: DONE },
)
if (!built || !built.ok) return handBack('Implement', built ? built.summary : 'the implementer died')

// ── 5+6. Verify → Code Audit → Fix, until a round is clean ───────────────────
// Every lens is a fresh agent that never sees the builder's reasoning — only
// the ticket, the spec and the diff. That is what makes it an audit.
const CODE_LENSES = [
  {
    key: 'criteria',
    ask: `Read the ticket first, then \`git diff origin/main...HEAD\`. For each Done-when criterion, find what ` +
      `satisfies it and the test that proves it. A criterion with nothing satisfying it is a blocker. So is a ` +
      `test that would pass before the change, or asserts the implementation against itself, or an existing ` +
      `test weakened (category test-weakened) when the ticket did not ask for that behaviour to change.`,
  },
  {
    key: 'rules',
    ask: `Read \`git diff origin/main...HEAD\` against CLAUDE.md. A blocker is a decision it records being ` +
      `contradicted — quote the rule and the line. Also: a logic error, with an input and the wrong output it ` +
      `produces. Follow .claude/skills/code-review/SKILL.md §2–§4 for what not to flag.`,
  },
  {
    key: 'browser',
    ask: `Drive the change in a real browser and try to break it, following .claude/skills/qa/SKILL.md §1–§3 ` +
      `(probes in tests/qa-probe.spec.js, both projects, re-run before calling anything a bug, delete the probe ` +
      `after and leave \`git status\` clean). Never check out another commit or stash in this tree; to try a ` +
      `probe on main, \`git worktree add ../orbit-main-${issue} origin/main\`, symlink node_modules into it, and ` +
      `remove it after. Budget: six probes. A reproduced bug in this change is a blocker; pre-existing is ` +
      `minor. If nothing visible changed, say so in covered and return no findings.`,
    model: 'sonnet',
    // Boots the app and runs Playwright, so it runs after the readers rather
    // than beside the skeptics and the gate that need the same ports.
    alone: true,
  },
]

const rounds = []
const streak = new Map() // finding key → consecutive rounds confirmed
let gate
let open = []
let minors = []

for (let round = 1; round <= MAX_BUILD_ROUNDS; round++) {
  phase('Verify')
  const ran = await agent(
    `${inTree()}\n\nRun \`node scripts/gate.mjs\` once and return the last line it printed, verbatim, as json. ` +
    `It runs npm test and the whole Playwright suite; in a runner Chromium is installed — never run playwright ` +
    `install. Change nothing and interpret nothing.`,
    { phase: 'Verify', label: `verify#${round}`, schema: GATE, effort: 'low' },
  )
  if (!ran) return handBack('Verify', 'the verify agent died')
  gate = readGate(ran)

  if (gate.ok) {
    phase('Code Audit')
    const run = (l, retry) => agent(
      `You are auditing a change you did not write, on branch ${setup.branch} in ${setup.workdir}. ` +
      `${ticket}\n\nThe spec is ${spec.path}. ${MAP} ${l.ask}\n\n` +
      (l.key === 'criteria' && gate.tampered.length
        ? `The gate flagged these lines in tests/ as removed assertions or added skips:\n${gate.tampered.join('\n')}\n\n`
        : '') +
      `Blockers only for something that would change a merge decision; everything else is minor. Change no ` +
      `code. Empty is a good answer.`,
      { phase: 'Code Audit', label: `audit:${l.key}${retry}#${round}`, schema: FINDINGS, model: l.model },
    )
    const readers = await audit(CODE_LENSES.filter(l => !l.alone), run)
    const driver = await audit(CODE_LENSES.filter(l => l.alone), run)
    const missing = [...readers.missing, ...driver.missing]
    if (missing.length) return handBack('Code Audit', `the ${missing.join(', ')} auditor could not finish`)
    const reports = [...readers.reports, ...driver.reports]

    const raised = reports.flatMap(r => r.findings)
    minors = raised.filter(f => f.severity === 'minor')
    open = await confirm(raised.filter(f => f.severity === 'blocker'), 'the change')
    history.push(...open)
    rounds.push({ round, gate: gateLine(gate), raised: raised.length, confirmed: open.length,
      covered: reports.map(r => r.covered).join(' · ') })
    log(`build round ${round}: green, ${raised.length} raised, ${open.length} confirmed`)
    if (!open.length) break
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

  const stuck = open.filter(f => {
    const n = (streak.get(key(f)) || 0) + 1
    streak.set(key(f), n)
    return n > STUCK_AFTER
  })
  for (const k of [...streak.keys()]) if (!open.some(f => key(f) === k)) streak.delete(k)
  if (stuck.length) return handBack('Code Audit', `the same finding survived ${STUCK_AFTER} fix attempts`, open)
  if (round === MAX_BUILD_ROUNDS) return handBack('Code Audit', `still not clean after ${round} rounds`, open)

  const fixed = await agent(
    `${ticket}\n\n${inTree()}\n\nThe spec is ${spec.path}. These were independently confirmed against your ` +
    `branch:\n\n${listFindings(open)}\n\nFix each at its cause. The rules of §5 of ${SKILL} still hold: never ` +
    `edit an existing test to make it pass, never skip or delete one. If a finding shows the spec was wrong, ` +
    `fix the spec too and say so in the summary. \`npm test\` after every edit; do not run the Playwright ` +
    `suite. Leave \`git status\` clean. Commit and push.`,
    { phase: 'Code Audit', label: `fix#${round}`, schema: DONE },
  )
  if (!fixed) return handBack('Code Audit', 'the fixer died', open)
}

// ── 7. Context ───────────────────────────────────────────────────────────────
// The docs are read instead of the code, so they change in the same pull
// request as the code they describe — never in a follow-up nobody writes.
phase('Context')
const context = await agent(
  `${inTree()}\n\nThe change on this branch is done and audited. Keep what describes it true:\n` +
  `1. \`node scripts/context.mjs for $(git diff --name-only origin/main...HEAD)\` lists the docs/context/ ` +
  `docs that own the changed files. Update each where the change made it wrong or incomplete — a new ` +
  `function, a changed payload, a new testid. A file the branch added that no doc owns goes into the ` +
  `\`files\` of the doc for its area. Most changes move a line or two; none is fine.\n` +
  `2. Make ${spec.path} true of what shipped, and add a short *Audit* section: ${rounds.length} round(s), ` +
  `what each confirmed and how it was resolved, a line each.\n` +
  `3. Only if the change made a *decision* a future builder must respect, add it to CLAUDE.md.\n` +
  `\`npm test\` (the context check runs there), commit as "docs(context): …" and push.`,
  { phase: 'Context', label: 'context', schema: DONE, effort: 'low' },
)
if (!context || !context.ok) return handBack('Context', context ? context.summary : 'the context agent died')

// ── 8. Learn ────────────────────────────────────────────────────────────────
// What the audits kept catching is context the builder did not have. It goes
// into the docs before the pull request opens, so the reviewers and the person
// merging see the lesson with the code — never in a push after they looked.
const lessons = await learn('passed its audit')

// ── 9. PR ────────────────────────────────────────────────────────────────────
phase('PR')
const auditTable = rounds.map(r => `| ${r.round} | ${r.gate} | ${r.raised} raised · ${r.confirmed} confirmed | ${r.covered || '—'} |`).join('\n')
const pr = await agent(
  `${ticket}\n\n${inTree()}\n\nOpen the pull request, following §8 of ${SKILL} — ready for review, screenshots ` +
  `only if something visible changed, the body in the shape given there. In the *Proof* table use: ` +
  `\`node scripts/gate.mjs\` → ${gateLine(gate)}, at ${gate.sha.slice(0, 7)}. If \`git log ${gate.sha}..HEAD\` ` +
  `shows later commits, say in one line that they touch only docs — and if any touches code, stop and ` +
  `return ok=false instead. After it, add this section verbatim:\n\n` +
  `### Audit loop\n| Round | Gate | Independent audit | Covered |\n| --- | --- | --- | --- |\n${auditTable}\n\n` +
  (lessons.length ? `And a *Lessons* line listing what Learn wrote: ${lessons.map(l => l.proposal).join('; ')}\n\n` : '') +
  (minors.length
    ? `Put these unconfirmed minor notes inside the "Worth a closer look" block, one line each, only if a ` +
      `reviewer would want them:\n${listFindings(minors)}\n\n`
    : '') +
  `Comment the PR link on the issue and move the label to ready-for-human. Return the PR url.`,
  { phase: 'PR', label: 'open-pr', schema: DONE },
)
if (!pr || !pr.ok) return handBack('PR', pr ? pr.summary : 'the PR agent died')

return {
  outcome: 'shipped',
  issue,
  pr: pr.url,
  rounds,
  lessons,
}
