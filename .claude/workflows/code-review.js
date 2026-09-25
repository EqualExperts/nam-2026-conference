export const meta = {
  name: 'code-review',
  description: 'Review a pull request: independent lenses → skeptic per blocker → one comment and a verdict with a confidence',
  whenToUse: 'Reviewing a pull request against its ticket and CLAUDE.md — /code-review 42, or when an agent PR opens.',
  phases: [
    { title: 'Context', detail: 'the PR, its ticket, its Done-when, what humans said' },
    { title: 'Review', detail: 'criteria · rules · logic · tests, each a fresh agent' },
    { title: 'Verify', detail: 'a skeptic tries to refute every blocker' },
    { title: 'Publish', detail: 'one comment, one verdict line' },
  ],
}

// The single agent this replaces read the ticket, the diff, CLAUDE.md and the
// thread, judged all four kinds of defect, checked its own findings and wrote
// the comment — in one context, marking its own work. Here each kind of
// defect is its own reader, a finding has to survive someone trying to
// refute it, and the comment and the verdict are composed by the script from
// what survived, so their shape never depends on a model remembering it.

const pr = Number(typeof args === 'object' && args ? args.pr : args)
if (!Number.isInteger(pr) || pr <= 0) return { verdict: 'error', reason: `code-review needs a PR number, got ${JSON.stringify(args)}` }
// In Actions the job has already checked the pull request out. On a laptop,
// pass `{ pr, workdir }` — a worktree of the PR branch — so nothing runs
// against whatever this checkout happens to be on.
const WORKDIR = typeof args === 'object' && args && args.workdir
const HERE = WORKDIR
  ? `Work in ${WORKDIR}, a checkout of the pull request: cd there at the start of every Bash command. ` +
    `Read docs/harness/ and scripts/context.mjs from the directory you started in — the harness may be newer ` +
    `than the pull request's base. Prefix anything that boots the app or runs Playwright with \`eval "$(node scripts/lane.mjs claim code-review-${pr})" &&\`.\n\n`
  : ''

const PLAYBOOK = 'docs/harness/code-review-playbook.md'
const MAX_FINDINGS = 3

const CONTEXT = {
  type: 'object',
  required: ['issue', 'title', 'doneWhen', 'base', 'files', 'amendments'],
  properties: {
    issue: { type: 'integer', description: 'the issue the PR closes or refs; 0 if none' },
    title: { type: 'string' },
    doneWhen: { type: 'array', items: { type: 'string' }, description: 'each criterion, verbatim; empty if none' },
    base: { type: 'string', description: 'the base branch name' },
    files: { type: 'array', items: { type: 'string' } },
    lines: { type: 'integer', description: 'lines added + removed' },
    amendments: {
      type: 'array', items: { type: 'string' },
      description: 'what a HUMAN on the PR or issue asked to change or drop — quoted, with who said it. Not bots.',
    },
  },
}

const FINDINGS = {
  type: 'object',
  required: ['confidence', 'covered', 'findings'],
  properties: {
    confidence: { enum: ['high', 'medium', 'low'], description: 'how much of the change you could evaluate in your lens — coverage, not certainty' },
    covered: { type: 'string', description: 'what you judged — under 12 words' },
    findings: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        required: ['severity', 'category', 'file', 'line', 'claim', 'evidence'],
        properties: {
          severity: { enum: ['blocker', 'note'] },
          category: { enum: ['criterion-unmet', 'claude-md', 'logic', 'test-proves-nothing', 'actions', 'docs-truth', 'orchestration'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          claim: { type: 'string', description: 'what breaks, and when — one sentence' },
          evidence: { type: 'string', description: 'the quoted line; the rule quoted; or the input and the wrong output' },
        },
      },
    },
  },
}

const REFUTATION = {
  type: 'object',
  required: ['refuted', 'why'],
  properties: { refuted: { type: 'boolean' }, why: { type: 'string' } },
}

const POSTED = {
  type: 'object',
  required: ['ok', 'url'],
  properties: { ok: { type: 'boolean' }, url: { type: 'string' } },
}

// ── Context ─────────────────────────────────────────────────────────────────
phase('Context')
const ctx = await agent(
  `${HERE}Gather what a review of pull request #${pr} needs, and nothing more. \`gh pr view ${pr} --json ` +
  `title,body,baseRefName,files,additions,deletions,closingIssuesReferences\`; find the issue it closes or ` +
  `refs, and \`gh issue view\` it for its Done-when criteria, verbatim. Then read the human comments on both ` +
  `(\`gh api repos/{owner}/{repo}/issues/<n>/comments\`), skipping bots, and return only those that amend the ` +
  `ticket — "drop that button", "the ticket is wrong about X". Do not judge the change.`,
  { phase: 'Context', label: 'context', schema: CONTEXT, effort: 'low' },
)
if (!ctx) return publish({ verdict: 'none', why: 'could not read the pull request' })

const ticket = ctx.issue
  ? `Pull request #${pr} for issue #${ctx.issue}: ${ctx.title}\nDone when:\n${ctx.doneWhen.map(c => `- ${c}`).join('\n') || '- (the ticket states none)'}`
  : `Pull request #${pr}: ${ctx.title} (no linked issue — judge it against its own description)`

// ── Review ──────────────────────────────────────────────────────────────────
// No lens sees the thread. A stated opinion pulls a reader towards it; the
// amendments go to the skeptic, who reconciles.
// Which lenses run is decided by what the diff touches, not by a model. A
// fixed set of app lenses read this repo's own harness PRs — YAML, workflow
// scripts, context docs — said "nothing to flag", and missed triggers that
// could not fire and a loop that passed when its agents died.
function kindsOf(files) {
  const kinds = new Set()
  for (const f of files) {
    if (f.startsWith('.github/workflows/')) kinds.add('actions')
    else if (f.startsWith('.claude/workflows/') || /^scripts\/(gate|context|lane|pr-media)\.mjs$/.test(f)) kinds.add('orchestration')
    else if (f === 'CLAUDE.md' || f === 'README.md' || f.startsWith('docs/') || f.startsWith('.claude/skills/') || f.startsWith('specs/')) kinds.add('context')
    else if (f.startsWith('tests/') || f === 'playwright.config.js') kinds.add('tests')
    else if (f !== 'package-lock.json') kinds.add('app')
  }
  return kinds
}

const LENSES = [
  {
    key: 'criteria',
    when: () => true,
    ask: `For each Done-when criterion, find what satisfies it in the diff and the test that proves it. One ` +
      `with nothing satisfying it is a blocker (criterion-unmet) — quote the criterion. This is the category ` +
      `most often got wrong by reading a criterion too literally: hold it to the highest bar. With no ticket, ` +
      `hold the diff to what its description says it does.`,
  },
  {
    key: 'rules',
    when: k => k.has('app'),
    ask: `Does the diff contradict a decision CLAUDE.md records? Quote the rule exactly and the line that ` +
      `breaks it (claude-md). The decisions that were tried and rejected matter most: one action rather than ` +
      `bookmark-plus-reserve, no invented links, no map coordinates, nothing claiming to be true that is not.`,
  },
  {
    key: 'logic',
    when: k => k.has('app') || k.has('orchestration') || k.size === 0,
    ask: `Find logic errors the diff introduces. Each needs an input and the wrong output it produces (logic). ` +
      `Not "this looks wrong". A bug already on the base branch is not this PR's.`,
  },
  {
    key: 'tests',
    when: k => k.has('app') || k.has('tests') || k.has('orchestration'),
    ask: `Read the tests the diff adds or changes. A blocker is a test that would pass before the change, ` +
      `asserts the implementation against itself, or an existing test weakened without the ticket asking ` +
      `(test-proves-nothing). Code that changes behaviour with no test that would catch it breaking is one ` +
      `too. Run a test if that settles it.`,
  },
  {
    key: 'actions',
    when: k => k.has('actions'),
    ask: `Review the GitHub Actions changes as someone who has been burned by them (actions). For each changed ` +
      `workflow: can every trigger actually fire as intended — \`issues\` events run the default branch's file; ` +
      `a pull request a bot opened sits at action_required; a push made with GITHUB_TOKEN triggers nothing; ` +
      `drafts? Evaluate each changed \`if:\` against a concrete payload and say what it does. Does untrusted ` +
      `text — an issue, comment or PR body, a branch name — reach a \`run:\` script through \`\${{ }}\` (script ` +
      `injection), or reach an agent that holds write tools and a token? Least-privilege permissions, which ` +
      `token each step uses, concurrency groups that queue or cancel the right runs, timeouts against the ` +
      `worst case, \`always()\` steps after a timeout. docs/harness/github.md records what this repo learned ` +
      `the hard way — a change that contradicts it is a blocker.`,
  },
  {
    key: 'docs',
    when: k => k.has('context'),
    ask: `Review the changed AI-context and docs — CLAUDE.md, docs/context/, docs/harness/ playbooks, README, ` +
      `specs — as text agents will read INSTEAD of the code (docs-truth). Check every changed factual claim ` +
      `against the code it describes: file:function names, payload fields, test ids, commands and flags, ` +
      `section numbers that the workflow scripts cite. A blocker is a claim that is false, two documents that ` +
      `now contradict each other, or an instruction an agent would follow into a wrong action. Where a fact ` +
      `belongs is set by docs/context/README.md: decisions in CLAUDE.md, where-and-how in docs/context.`,
  },
  {
    key: 'orchestration',
    when: k => k.has('orchestration'),
    ask: `Review the changed workflow scripts and harness scripts (orchestration). agent() returns null when an ` +
      `agent dies and parallel() turns a failed thunk into null: does every new path fail closed, or can a ` +
      `dead agent read as a pass? Is every loop bounded and every escalation reachable? Do agents that run at ` +
      `once share a worktree, a port or a file? Does a prompt contradict the playbook section it cites? Is a ` +
      `schema field read that is not required? Do tests/unit's stub tests exercise the new branches?`,
  },
]

const kinds = kindsOf(ctx.files)
const ACTIVE = LENSES.filter(l => l.when(kinds))
log(`kinds: ${[...kinds].join(', ') || 'none'} → lenses: ${ACTIVE.map(l => l.key).join(', ')}`)

phase('Review')
const lens = (l, retry) => agent(
  `${HERE}You are reviewing a pull request you did not write. ${ticket}\n\nFiles: ${ctx.files.join(', ')}. Read ` +
  `\`gh pr diff ${pr}\`, the spec in specs/ if the branch has one, and the docs/context/ docs that own the ` +
  `changed files (\`node scripts/context.mjs for <files>\`). Your lens only: ${l.ask}\n\n` +
  `§2–§4 of ${PLAYBOOK} say what never to flag. Cite file:line read from the line, never inferred from a ` +
  `name. Change nothing, post nothing. Nothing to flag is the usual correct answer.`,
  { phase: 'Review', label: `review:${l.key}${retry}`, schema: FINDINGS },
)
const first = await parallel(ACTIVE.map(l => () => lens(l, '')))
const reports = await parallel(ACTIVE.map((l, i) => async () => first[i] || lens(l, '-retry')))
const missing = ACTIVE.filter((l, i) => !reports[i]).map(l => l.key)
const done = reports.filter(Boolean)

// ── Verify ──────────────────────────────────────────────────────────────────
const key = f => `${f.category}|${f.file}|${Math.floor((f.line || 0) / 10)}`
const raised = [...new Map(done.flatMap(r => r.findings).map(f => [key(f), f])).values()]
const blockers = raised.filter(f => f.severity === 'blocker')

phase('Verify')
const judged = await parallel(blockers.map(f => () =>
  agent(
    `${HERE}${ticket}\n\n${ctx.amendments.length ? `A human amended the ticket on the thread:\n${ctx.amendments.map(a => `- ${a}`).join('\n')}\n\n` : ''}` +
    `A reviewer claims this blocker on pull request #${pr}. Try to REFUTE it: open ${f.file}:${f.line} in ` +
    `\`gh pr diff ${pr}\` or the checkout and check it says what is claimed. Refute if it does not, if the ` +
    `behaviour is already on ${ctx.base}, if a human amendment above asked for exactly this, or if it is ` +
    `style rather than a defect. If you cannot tell, it is NOT refuted.\n\n` +
    `[${f.category}] ${f.file}:${f.line} — ${f.claim}\nevidence: ${f.evidence}`,
    { phase: 'Verify', label: `skeptic:${f.category}`, schema: REFUTATION, effort: 'medium' },
  ).then(v => (v && v.refuted ? null : f))))   // a skeptic that died refuted nothing
const RANK = ['criterion-unmet', 'logic', 'actions', 'orchestration', 'docs-truth', 'claude-md', 'test-proves-nothing']
const confirmed = judged.filter(Boolean).sort((a, b) => RANK.indexOf(a.category) - RANK.indexOf(b.category))
const shown = confirmed.slice(0, MAX_FINDINGS)
if (confirmed.length > shown.length) log(`${confirmed.length - shown.length} confirmed blocker(s) not shown — capped at ${MAX_FINDINGS}`)

// ── Publish ─────────────────────────────────────────────────────────────────
// Confidence is coverage: the weakest lens sets it, and a lens that never
// finished makes the whole review low — an unread lens is not a passed one.
const LEVELS = ['low', 'medium', 'high']
const confidence = missing.length ? 'low'
  : LEVELS[Math.min(...done.map(r => LEVELS.indexOf(r.confidence)))]
const covered = done.map(r => r.covered).join(' · ') + (missing.length ? ` · not finished: ${missing.join(', ')}` : '')

return publish(shown.length
  ? { verdict: 'fail', findings: shown, covered }
  : { verdict: 'pass', confidence, covered, notes: raised.filter(f => f.severity === 'note').slice(0, 2) })

async function publish(r) {
  const CALLOUT = { high: ['TIP', '●●●'], medium: ['NOTE', '●●○'], low: ['WARNING', '●○○'] }
  let body, line
  if (r.verdict === 'fail') {
    body = `> [!CAUTION]\n> ### Code review · blocker\n> ${r.findings.length} confirmed by a second reader. Judged: ${r.covered}\n\n` +
      r.findings.map(f => `**\`${f.file}:${f.line}\`** — ${f.claim}\n${f.evidence}`).join('\n\n')
    line = `FAIL ${r.findings[0].claim}`
  } else if (r.verdict === 'pass') {
    const [kind, meter] = CALLOUT[r.confidence]
    body = `> [!${kind}]\n> ### Code review · ${r.confidence} confidence &nbsp; \`${meter}\`\n> Nothing to flag. Judged: ${r.covered}` +
      (r.notes.length ? `\n\n<details><summary>Not blockers</summary>\n\n${r.notes.map(f => `- \`${f.file}:${f.line}\` ${f.claim}`).join('\n')}\n</details>` : '')
    line = `PASS ${r.confidence} ${r.covered}`
  } else {
    body = `> [!WARNING]\n> ### Code review · did not finish\n> ${r.why}. Treat as unproven.`
    line = ''
  }

  phase('Publish')
  const posted = await agent(
    `Post this as ONE comment on pull request #${pr}, exactly as written — write it to a file and use ` +
    `\`gh pr comment ${pr} --body-file <file>\`:\n\n${body}\n\n` +
    (line
      ? `Then write exactly this one line to /tmp/review-verdict:\n${line}\n`
      : `Write nothing to /tmp/review-verdict — no file publishes as unproven, which is the truth.\n`) +
    `Never approve, request changes or merge.`,
    { phase: 'Publish', label: 'publish', schema: POSTED, effort: 'low' },
  )
  return { verdict: r.verdict, confidence: r.confidence, pr, comment: posted ? posted.url : null, findings: r.findings || [] }
}
