export const meta = {
  name: 'code-review',
  description: 'Review a pull request: independent lenses → skeptic per blocker → one comment and a verdict with a confidence',
  whenToUse: 'Reviewing a pull request against its ticket and CLAUDE.md — /code-review 42, or when an agent PR opens.',
  phases: [
    { title: 'Context', detail: 'the PR, its ticket, its Done-when, what humans said' },
    { title: 'Review', detail: 'criteria · rules · logic · tests, each a fresh agent' },
    { title: 'Recheck', detail: 'on a re-review: is each previous blocker resolved?' },
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

// `/code-review 42`, `/code-review 42 --no-publish` (CI: the job posts what this returns),
// or { pr, workdir, publish }.
const argText = typeof args === 'object' && args ? '' : String(args ?? '')
const pr = Number(typeof args === 'object' && args ? args.pr : (/#?(\d+)/.exec(argText) || [])[1])
const PUBLISH = typeof args === 'object' && args ? args.publish !== false : !/--no-publish/.test(argText)
// Facts the job computes from git, and the team's dial (the REVIEW_DEPTH repo
// variable): fast | balanced | thorough. Review depth follows risk — a copy
// fix and a change to the seat rules should not get the same review.
const flag = (k) => (typeof args === 'object' && args ? args[k] : (new RegExp(`--${k}=([\\w-]+)`).exec(argText) || [])[1])
const DEPTH = ['fast', 'balanced', 'thorough'].includes(flag('depth')) ? flag('depth') : 'balanced'
const FACTS = {
  lines: Number.isInteger(Number(flag('lines'))) && flag('lines') !== undefined ? Number(flag('lines')) : null,
  docsOnly: flag('docs-only') === 'yes' || flag('docsOnly') === true,
  shipped: flag('shipped') === 'yes' || flag('shipped') === true,
  size: ['tiny', 'small', 'large'].includes(flag('size')) ? flag('size') : null,
}
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

// The marker a verdict comment ends with, read back by the next run on the
// same pull request. It is named for this pass because QA comments on the
// same thread, usually last — "the newest marker" would otherwise be QA's.
const PASS = 'code-review'
const MARK = `orbit-verdict:${PASS}`
// A commit id is interpolated into a shell command in every lens prompt, so
// only something shaped like one is trusted — anything else reviews in full.
const sha = v => (typeof v === 'string' && /^[0-9A-Za-z]{4,64}$/.test(v) ? v : null)

const CONTEXT = {
  type: 'object',
  required: ['issue', 'title', 'doneWhen', 'base', 'files', 'amendments', 'head'],
  properties: {
    head: { type: 'string', description: 'the pull request head commit — headRefOid, the full sha' },
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
    previous: {
      type: 'object',
      description: `the JSON from the newest comment containing <!-- ${MARK} {…} -->, as written, plus inHistory; omit if there is none`,
      required: ['pass', 'commit', 'inHistory', 'blockers', 'followUps'],
      properties: {
        pass: { type: 'string' },
        commit: { type: 'string' },
        inHistory: { type: 'boolean', description: 'git merge-base --is-ancestor <commit> <head> exited 0' },
        blockers: { type: 'array', items: { type: 'object' } },
        followUps: { type: 'array', items: { type: 'string' } },
      },
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
        required: ['severity', 'category', 'file', 'line', 'claim', 'evidence', 'how', 'harm'],
        properties: {
          severity: { enum: ['blocker', 'follow-up'], description: 'blocker only if you can name how and harm below; anything else worth tracking is a follow-up' },
          category: { enum: ['criterion-unmet', 'claude-md', 'logic', 'test-proves-nothing', 'actions', 'docs-truth', 'orchestration'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          claim: { type: 'string', description: 'what breaks, and when — one sentence' },
          evidence: { type: 'string', description: 'the quoted line; the rule quoted; or the input and the wrong output' },
          how: { type: 'string', description: 'the path through NORMAL use that reaches it — who does what, where. Empty if you cannot name one' },
          harm: { type: 'string', description: 'what that person loses or sees go wrong at the end of it. Empty if you cannot name it' },
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
    contrived: { type: 'boolean', description: 'real, but only reachable with an input nobody gives in normal use — a hand-edited URL, a forged request' },
    why: { type: 'string' },
  },
}

const RECHECK = {
  type: 'object',
  required: ['resolved', 'why'],
  properties: { resolved: { type: 'boolean' }, why: { type: 'string' } },
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
  `ticket — "drop that button", "the ticket is wrong about X". Do not judge the change.\n\n` +
  `Also return \`head\`: the pull request's headRefOid. And if a comment on the pull request contains ` +
  `\`<!-- ${MARK} {…} -->\`, take the NEWEST such comment, parse the JSON between the tag and \`-->\`, and ` +
  `return it as \`previous\`, unchanged, with \`inHistory\` set by whether \`git merge-base --is-ancestor ` +
  `<its commit> <head>\` exits 0 (fetch the head first if it is missing). No such comment: omit \`previous\`.`,
  { phase: 'Context', label: 'context', schema: CONTEXT, effort: 'low', model: 'sonnet' },
)
if (!ctx) return publish({ verdict: 'none', why: 'could not read the pull request' })

// ── Scope ───────────────────────────────────────────────────────────────────
// A re-review is a second look, not a first one again: it checks the blockers
// it raised and what was pushed since. The marker's own `pass` is checked here,
// not trusted to the agent's grep — QA's marker read as ours would silently
// drop every previous blocker.
const HEAD_SHA = sha(ctx.head)
const previous = ctx.previous && ctx.previous.pass === PASS ? ctx.previous : null
if (ctx.previous && !previous) log(`ignored a verdict marker from another pass (${ctx.previous.pass})`)
const before = previous && sha(previous.commit)
// Both ends are named commits. In Actions the checkout is the merge of the
// branch into its base, so a diff against the checkout would hand the lenses
// everything merged into the base since the last review as well.
const ESCAPE = `Raise something outside that diff only if it is severe enough that it would have blocked a first review.`
const SCOPE = !previous ? ''
  : !before || !HEAD_SHA
    ? `\n\nThis is a re-review, but the commit the last one looked at is unreadable: review in full.`
    : previous.inHistory === true
      ? `\n\nThis is a re-review. The last code review looked at ${before}; the pull request is now at ${HEAD_SHA}. ` +
        `Look for new problems only in what changed since: \`git diff ${before} ${HEAD_SHA}\`. ${ESCAPE}`
      : `\n\nThis is a re-review, and ${before}, the commit the last one looked at, is no longer in the branch's ` +
        `history — it was rebased. \`git fetch origin ${before}\`, then look for new problems only in ` +
        `\`git diff ${before} ${HEAD_SHA} -- ${ctx.files.join(' ')}\` — the files this pull request touches. If ` +
        `that commit cannot be fetched at all, review those files in full. ${ESCAPE}`
const earlier = previous && Array.isArray(previous.blockers)
  ? previous.blockers.filter(b => b && typeof b.claim === 'string' && typeof b.category === 'string')
  : []
const filedBefore = new Set(previous && Array.isArray(previous.followUps) ? previous.followUps : [])

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
    // The whole harness, not four named scripts: qa-facts, ship-progress,
    // ai-cost, agent-run.sh and the agent definitions were read as app code,
    // judged by the app's rules, and never asked whether a dead agent passes.
    else if (/^(\.claude\/(workflows|agents)\/|scripts\/)/.test(f) || f === '.claude/settings.json') kinds.add('orchestration')
    else if (f === 'CLAUDE.md' || f === 'README.md' || f.startsWith('docs/') || /^\.claude\/(skills|rules)\//.test(f) || f.startsWith('specs/')) kinds.add('context')
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
      `too. A test that could flake or race another, or takes a lane or fixture it should not, harms only ` +
      `the suite — a follow-up, never a blocker (§3). \`GATE_BASE=origin/<base branch> node scripts/red-check.mjs\` answers the first question by ` +
      `running the branch's tests against the base branch's app code: failedOnBase false means none of them ` +
      `would notice the change being reverted. Run it, and run a test yourself if that settles the rest.`,
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
      `schema field read that is not required — and what does the script do when it is missing? Does the change ` +
    `move work to a costlier model or add agents or rounds, and is that intended? Do tests/unit's stub tests ` +
    `exercise the new branches?`,
  },
]

// How hard to look. The job's `--size` (scripts/qa-facts.mjs: the ticket,
// the code lines, the risk, the dial) decides; tiny and small get one
// combined reviewer on Sonnet, large the lenses by kind on the session model.
// Without a size — an older job, or a laptop run with no facts — the old rule.
function tierFor({ depth, lines, docsOnly, shipped, size }, kinds, files) {
  if (size) return size === 'large' ? 'full' : 'light'
  if (depth === 'thorough') return 'full'
  if (docsOnly) return 'light'
  const risky = kinds.has('actions') || kinds.has('orchestration') || files.some(f => f.startsWith('server/lib/'))
  if (risky) return 'full'
  if (depth === 'fast') return 'light'
  if (shipped) return 'light'            // ship's own loop already audited it
  return lines !== null && lines <= 150 ? 'light' : 'full'
}

const COMBINED = {
  key: 'combined',
  ask: `Trace each Done-when criterion to what satisfies it in the diff and the test that proves it (an unmet ` +
    `one is criterion-unmet). Check the diff against the decisions CLAUDE.md records (claude-md), look for ` +
    `logic errors with an input and the wrong output (logic), and for a test that would pass without the ` +
    `change or that weakens an existing one (test-proves-nothing). One reader, all four questions.`,
}

const kinds = kindsOf(ctx.files)
const TIER = tierFor({ depth: DEPTH, ...FACTS }, kinds, ctx.files)
const MODEL = TIER === 'light' ? 'sonnet' : undefined
// A light review is one combined reader, but its questions are the app's. A
// small harness change still gets the harness lenses, on Sonnet beside it:
// QA no longer explores a pull request with no app change, so this is the
// only independent reader the harness gets.
const HARNESS = ['actions', 'orchestration']
const ACTIVE = TIER === 'light'
  ? [COMBINED, ...LENSES.filter(l => HARNESS.includes(l.key) && l.when(kinds))]
  : LENSES.filter(l => l.when(kinds))
log(`depth ${DEPTH} · size ${FACTS.size || 'unknown'} · tier ${TIER} · kinds: ${[...kinds].join(', ') || 'none'} → lenses: ${ACTIVE.map(l => l.key).join(', ')}`)

phase('Review')
const lens = (l, retry) => agent(
  `${HERE}You are reviewing a pull request you did not write. Each turn re-reads everything before it, so batch ` +
  `the reads you know you need into one command, and do not run the test suite — the gate has. ${ticket}\n\nFiles: ${ctx.files.join(', ')}. Read ` +
  `\`gh pr diff ${pr}\`, the spec in specs/ if the branch has one, the rule file in .claude/rules/ for each area the diff ` +
  `touches (ui.md for src/, server.md for server/ — a diff does not load them), and the docs/context/ docs that own the ` +
  `changed files (\`node scripts/context.mjs for <files>\`, then \`show <doc>\` for its outline and \`show <doc> <part>\` ` +
  `for the parts you need — not whole docs). Your lens only: ${l.ask}\n\n` +
  `§2–§4 of ${PLAYBOOK} say what never to flag. Cite file:line read from the line, never inferred from a ` +
  `name. A blocker names \`how\` — the path through normal use that reaches it — and \`harm\` — what that ` +
  `person loses; if you cannot name both, it is a follow-up. Change nothing, post nothing. Nothing to flag is ` +
  `the usual correct answer.${SCOPE}`,
  { phase: 'Review', label: `review:${l.key}${retry}`, schema: FINDINGS, model: MODEL, effort: FACTS.size === 'tiny' ? 'low' : undefined },
)
const first = await parallel(ACTIVE.map(l => () => lens(l, '')))
const reports = await parallel(ACTIVE.map((l, i) => async () => first[i] || lens(l, '-retry')))
const missing = ACTIVE.filter((l, i) => !reports[i]).map(l => l.key)
const done = reports.filter(Boolean)

// ── Verify ──────────────────────────────────────────────────────────────────
// One problem, one finding: two lenses often report the same line under
// different categories (on #39 the same missing hand-off was posted twice).
// Keyed by where it is, keeping the most severe reading of it.
const SEVERITY = ['criterion-unmet', 'logic', 'actions', 'orchestration', 'docs-truth', 'claude-md', 'test-proves-nothing']
// The exact line, not a window: two different problems ten lines apart are
// two findings, and merging them left one that no skeptic ever judged.
// Without a line only an identical claim merges: a 60-character prefix once
// merged "…more than three" with "…fewer than three". Judging a duplicate
// twice costs a skeptic; dropping a different problem costs a blocker.
// Merge, never drop: a reading this key already holds joins it in `also`,
// and the skeptic may refute the location only if every reading is wrong. A
// kept-first merge let a refuted criterion take a real logic blocker on the
// same line down with it, unjudged.
// Severity is part of the key: a true note grouped under a false blocker,
// with "refute only if every reading is wrong", kept the blocker alive.
const group = (m, f) => {
  const k = `${f.severity}|${where(f)}`
  // Grouping twice (ship's minors are grouped, then confirmed) must keep
  // the readings the first pass gathered.
  if (!m.has(k)) return m.set(k, { ...f, also: [...(f.also || [])] })
  const g = m.get(k)
  for (const r of [f, ...(f.also || [])]) {
    if (g.claim !== r.claim && !g.also.some(a => a.claim === r.claim)) g.also.push({ category: r.category, claim: r.claim, evidence: r.evidence })
  }
  return m
}
const where = f => `${f.file}|${f.line ? f.line : f.claim.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`
// The blocker bar, checked by the script: a model asked whether its own
// finding is realistic says yes. A blank how or harm is the model saying it
// cannot name a path or a cost, so it is a follow-up. (Both are required by
// the schema; only a present-and-blank one is read as that answer.)
const blank = v => typeof v === 'string' && !v.trim()
const demote = f => (f.severity !== 'blocker' ? { ...f, severity: 'follow-up' }
  : blank(f.how) || blank(f.harm) ? { ...f, severity: 'follow-up', why: 'no path through normal use, or no harm, was named' }
  : f)
const raised = [...done.flatMap(r => r.findings).map(demote)
  .sort((a, b) => (a.severity === 'blocker' ? 0 : 1) - (b.severity === 'blocker' ? 0 : 1) || SEVERITY.indexOf(a.category) - SEVERITY.indexOf(b.category))
  .reduce(group, new Map()).values()]

// ── Recheck ─────────────────────────────────────────────────────────────────
// Each previous blocker is re-opened, not re-argued: it survived a skeptic
// when it was raised, so one still there goes straight to the confirmed list,
// and one that is gone leaves the verdict. A recheck that died resolved
// nothing — the blocker stays.
if (earlier.length) phase('Recheck')
const rechecked = await parallel(earlier.map(b => () =>
  agent(
    `${HERE}${ticket}\n\nThe last code review of pull request #${pr} raised this blocker. Is it resolved at ` +
    `${HEAD_SHA || 'the pull request head'}? Open ${b.file}:${b.line} there (the line may have moved) and check ` +
    `whether what is claimed can still happen. Resolved means it cannot, not that the line changed. If you ` +
    `cannot tell, it is NOT resolved.\n\n[${b.category}] ${b.file}:${b.line} — ${b.claim}\nevidence: ${b.evidence || ''}`,
    { phase: 'Recheck', label: `recheck:${b.category}`, schema: RECHECK, effort: 'medium', model: MODEL },
  ).then(v => ({ resolved: !!(v && v.resolved === true) }))))
const stillOpen = earlier.filter((b, i) => !(rechecked[i] && rechecked[i].resolved))
  .map(b => ({ ...b, severity: 'blocker', also: [] }))
const openAt = new Set(stillOpen.map(where))
// A lens that finds an unresolved blocker again is not a second blocker.
const blockers = raised.filter(f => f.severity === 'blocker' && !openAt.has(where(f)))

phase('Verify')
const judged = await parallel(blockers.map(f => () =>
  agent(
    `${HERE}${ticket}\n\n${ctx.amendments.length ? `A human amended the ticket on the thread:\n${ctx.amendments.map(a => `- ${a}`).join('\n')}\n\n` : ''}` +
    `A reviewer claims this blocker on pull request #${pr}. Try to REFUTE it: open ${f.file}:${f.line} in ` +
    `\`gh pr diff ${pr}\` or the checkout and check it says what is claimed. Refute if it does not, if the ` +
    `behaviour is already on ${ctx.base}, if a human amendment above asked for exactly this, or if it is ` +
    `style rather than a defect. If you cannot tell, it is NOT refuted. If it is real but only reachable with ` +
    `an input nobody gives in normal use — a hand-edited URL, a forged request — say contrived, and why. ` +
    `If the only harm is to the test suite — a test that could flake or race another, not one that fails ` +
    `to prove the change — say contrived too: nobody using the app loses anything.` +
    (f.also && f.also.length ? ` Several reviewers read this line differently ("also" below): refute only if EVERY reading is wrong.` : '') +
    `\n\n[${f.category}] ${f.file}:${f.line} — ${f.claim}\nevidence: ${f.evidence}` +
    (f.also || []).map(a => `\nalso, [${a.category}]: ${a.claim} — ${a.evidence}`).join(''),
    { phase: 'Verify', label: `skeptic:${f.category}`, schema: REFUTATION, effort: 'medium', model: MODEL },
  ).then(v => (!v ? f   // a skeptic that died refuted nothing
    : v.refuted ? null
    : v.contrived ? { ...f, severity: 'follow-up', why: String(v.why || '').trim() || 'only with a contrived input' }
    : f))))
const RANK = ['criterion-unmet', 'logic', 'actions', 'orchestration', 'docs-truth', 'claude-md', 'test-proves-nothing']
// Blockers the last review raised and this one could not close rank first:
// they are the ones the author was already told about.
const confirmed = [...stillOpen, ...judged.filter(f => f && f.severity === 'blocker')
  .sort((a, b) => RANK.indexOf(a.category) - RANK.indexOf(b.category))]
const shown = confirmed.slice(0, MAX_FINDINGS)
if (confirmed.length > shown.length) log(`${confirmed.length - shown.length} confirmed blocker(s) not shown — capped at ${MAX_FINDINGS}`)

// ── Publish ─────────────────────────────────────────────────────────────────
// Confidence is coverage: the weakest lens sets it, and a lens that never
// finished makes the whole review low — an unread lens is not a passed one.
const LEVELS = ['low', 'medium', 'high']
const confidence = missing.length ? 'low'
  : LEVELS[Math.min(...done.map(r => LEVELS.indexOf(r.confidence)))]
const covered = done.map(r => r.covered).join(' · ') + (missing.length ? ` · not finished: ${missing.join(', ')}` : '') +
  (earlier.length ? ` · re-checked ${earlier.length} previous blocker(s), ${stillOpen.length} still open` : '')

// Follow-ups: raised as one, demoted by the script, or called contrived by a
// skeptic. Whatever the verdict — only blockers colour the check, and a
// finding worth tracking does not depend on what else was found this round.
const followUps = [...[...raised.filter(f => f.severity === 'follow-up'), ...judged.filter(f => f && f.severity === 'follow-up')]
  .reduce((m, f) => (m.has(keyOf(f)) ? m : m.set(keyOf(f), f)), new Map()).values()].slice(0, MAX_FINDINGS)

return publish(shown.length
  ? { verdict: 'fail', findings: shown, covered, blockers: confirmed, followUps }
  : { verdict: 'pass', confidence, covered, blockers: [], followUps })

// One key per place, so a re-review can tell a follow-up it already filed.
function keyOf(f) { return `${f.category}|${f.file}|${Math.floor((f.line || 0) / 10)}` }

async function publish(r) {
  const CALLOUT = { high: ['TIP', '●●●'], medium: ['NOTE', '●●○'], low: ['WARNING', '●○○'] }
  const fus = r.followUps || []
  const listed = fus.length
    ? `\n\n#### Follow-ups\nNot blockers, so they do not colour the check — each is filed as an issue.\n\n` +
      fus.map(f => `- \`${f.file}:${f.line}\` ${f.claim}${f.why ? ` — *${f.why}*` : ''}`).join('\n')
    : ''
  let body, line
  if (r.verdict === 'fail') {
    body = `> [!CAUTION]\n> ### Code review · blocker\n> ${r.findings.length} confirmed by a second reader. Judged: ${r.covered}\n\n` +
      r.findings.map(f => `**\`${f.file}:${f.line}\`** — ${f.claim}\n${f.evidence}` +
        (f.how ? `\nHow: ${f.how}` : '') + (f.harm ? `\nHarm: ${f.harm}` : '') +
        (f.also || []).map(a => `\n\nThe same line, read as ${a.category}: ${a.claim}\n${a.evidence}`).join('')).join('\n\n') + listed
    line = `FAIL ${r.findings[0].claim}`
  } else if (r.verdict === 'pass') {
    const [kind, meter] = CALLOUT[r.confidence]
    body = `> [!${kind}]\n> ### Code review · ${r.confidence} confidence &nbsp; \`${meter}\`\n> ${fus.length ? 'No blockers' : 'Nothing to flag'}. Judged: ${r.covered}` + listed
    line = `PASS ${r.confidence} ${r.covered}`
  } else {
    body = `> [!WARNING]\n> ### Code review · did not finish\n> ${r.why}. Treat as unproven.`
    line = ''
  }

  // The marker and the issues only for a review that finished. A pass that
  // did not finish reviewed no commit; recording one would let the next run
  // treat every previous blocker as closed.
  let file = []
  if (r.verdict === 'pass' || r.verdict === 'fail') {
    file = fus.filter(f => !filedBefore.has(keyOf(f))).map(f => ({
      key: keyOf(f),
      title: `Follow-up from #${pr}: ${f.claim}`.slice(0, 120),
      body: `Raised by code review on #${pr} at \`${f.file}:${f.line}\` and judged not a blocker` +
        `${f.why ? `: ${f.why}` : ''}.\n\n${f.claim}\n\n${f.evidence || ''}` +
        (f.how ? `\n\nHow: ${f.how}` : '') + (f.harm ? `\nHarm: ${f.harm}` : ''),
    }))
    const mark = {
      pass: PASS,
      commit: HEAD_SHA,
      blockers: (r.blockers || []).map(({ category, file, line, claim, evidence, how, harm }) => ({ category, file, line, claim, evidence, how, harm })),
      followUps: [...new Set([...filedBefore, ...fus.map(keyOf)])],
    }
    // `<` and `>` escaped, so no claim can close the comment early.
    body += `\n\n<!-- ${MARK} ${JSON.stringify(mark).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')} -->`
  }

  const out = { verdict: r.verdict, confidence: r.confidence, pr, comment: body, verdictLine: line, findings: r.findings || [], followUps: file }
  // In CI the job posts `comment` and reads `verdictLine` itself — no model
  // between the verdict and the check. An agent told to publish once
  // returned posted:false and the check read "did not finish".
  if (!PUBLISH) return out

  phase('Publish')
  const posted = await agent(
    `Post this as ONE comment on pull request #${pr}, exactly as written — write it to a file and use ` +
    `\`gh pr comment ${pr} --body-file <file>\`:\n\n${body}\n\n` +
    // In CI the job files these; on a laptop nothing else would, and the
    // marker already says they were filed.
    file.map(f => `Then \`gh issue create --label follow-up\` (without the label if it does not exist) titled ` +
      `${JSON.stringify(f.title)}, with this body:\n${f.body}\n\n`).join('') +
    (line
      ? `Then write exactly this one line to /tmp/review-verdict:\n${line}\n`
      : `Write nothing to /tmp/review-verdict — no file publishes as unproven, which is the truth.\n`) +
    // A reviewer that booted the app on a laptop claimed a lane nothing else
    // releases (code-review-73 was still held after the PR merged).
    (WORKDIR ? `Finally \`cd ${WORKDIR} && node scripts/lane.mjs release\`; "nothing to release" is fine.\n` : '') +
    `Never approve, request changes or merge.`,
    { phase: 'Publish', label: 'publish', schema: POSTED, effort: 'low', model: 'haiku' },
  )
  return { ...out, commentUrl: posted ? posted.url : null }
}
