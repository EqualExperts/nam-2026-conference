export const meta = {
  name: 'qa',
  description: 'Exploratory QA of a pull request: plan probes → run them → reproduce each failure on the branch and its base → report',
  whenToUse: 'Trying to break a pull request in a real browser — /qa 42, or when an agent PR opens.',
  phases: [
    { title: 'Plan', detail: 'what is worth probing that no test already proves' },
    { title: 'Probe', detail: 'one spec, every probe, both viewports' },
    { title: 'Reproduce', detail: 'each failure: again on the branch, then on its base' },
    { title: 'Publish', detail: 'comment, one line on the issue, verdict' },
  ],
}

// A QA pass can stop a merge, so what it reports has to have happened twice
// on this branch and not on the one it came from. The single agent this
// replaces was trusted to do both checks; here they are phases, and the
// verdict is computed from their results.

const pr = Number(typeof args === 'object' && args ? args.pr : args)
if (!Number.isInteger(pr) || pr <= 0) return { verdict: 'error', reason: `qa needs a PR number, got ${JSON.stringify(args)}` }
// In Actions the job has already checked the pull request out. On a laptop,
// pass `{ pr, workdir }` — a worktree of the PR branch — so nothing runs
// against whatever this checkout happens to be on.
const WORKDIR = typeof args === 'object' && args && args.workdir
const HERE = WORKDIR
  ? `Work in ${WORKDIR}, a checkout of the pull request: cd there at the start of every Bash command. ` +
    `Read docs/harness/ and scripts/context.mjs from the directory you started in — the harness may be newer ` +
    `than the pull request's base. Prefix anything that boots the app or runs Playwright with \`eval "$(node scripts/lane.mjs claim qa-${pr})" &&\`.\n\n`
  : ''

const PLAYBOOK = 'docs/harness/qa-playbook.md'
const PROBE_FILE = 'tests/qa-probe.spec.js'
const MAX_PROBES = 8

const PLAN = {
  type: 'object',
  required: ['issue', 'base', 'surface', 'probes'],
  properties: {
    issue: { type: 'integer', description: 'the linked issue; 0 if none' },
    base: { type: 'string' },
    surface: { type: 'boolean', description: 'false when nothing that changed is reachable from a browser' },
    reason: { type: 'string', description: 'if surface is false, why' },
    probes: {
      type: 'array',
      maxItems: MAX_PROBES,
      items: {
        type: 'object',
        required: ['id', 'what', 'expect', 'why'],
        properties: {
          id: { type: 'string', description: 'kebab-case, unique — becomes the test title' },
          what: { type: 'string', description: 'the steps: route, attendee, clock, clicks' },
          expect: { type: 'string', description: 'what should happen' },
          why: { enum: ['empty-or-extreme', 'other-viewport', 'other-day', 'second-interaction', 'callers', 'console'] },
          viewport: { enum: ['both', 'desktop', 'mobile'], description: 'both unless the probe is about one layout' },
        },
      },
    },
  },
}

const RAN = {
  type: 'object',
  required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'desktop', 'mobile'],
        properties: {
          id: { type: 'string' },
          desktop: { enum: ['pass', 'fail', 'not-run'] },
          mobile: { enum: ['pass', 'fail', 'not-run'] },
          happened: { type: 'string', description: 'on a fail: the assertion or error, one line' },
        },
      },
    },
  },
}

const REPRO = {
  type: 'object',
  required: ['onBranch', 'onBase', 'happened'],
  properties: {
    onBranch: { enum: ['fails-again', 'passes-now'] },
    onBase: { enum: ['fails', 'passes', 'not-applicable'], description: 'not-applicable when the feature does not exist on the base' },
    happened: { type: 'string' },
    image: { type: 'string', description: 'markdown image line from scripts/pr-media.mjs, if you took one' },
  },
}

const POSTED = {
  type: 'object',
  required: ['ok'],
  properties: { ok: { type: 'boolean' }, url: { type: 'string' } },
}

// ── Plan ────────────────────────────────────────────────────────────────────
phase('Plan')
const plan = await agent(
  `${HERE}Plan exploratory QA for pull request #${pr}. Read its ticket's Done when (\`gh pr view ${pr}\`, then the ` +
  `issue), \`gh pr diff ${pr}\`, and the tests it adds — what they assert is already proven, so spend nothing ` +
  `there. \`node scripts/context.mjs for <changed files>\` names the docs with the callers and test ids. ` +
  `Pick at most ${MAX_PROBES} probes in the order §1 of ${PLAYBOOK} gives. If nothing that changed can be ` +
  `reached from a browser, return surface=false and no probes. Write nothing.`,
  { phase: 'Plan', label: 'plan', schema: PLAN },
)
if (!plan) return publish({ verdict: 'none', why: 'the planner did not finish' })
if (!plan.surface) return publish({ verdict: 'pass', confidence: 'low', covered: `no browser surface — ${plan.reason || 'nothing visible changed'}`, probes: [] })

// ── Probe ───────────────────────────────────────────────────────────────────
phase('Probe')
const ran = await agent(
  `${HERE}Write ${PROBE_FILE} with one Playwright test per probe below, titled with its id, following §2 of ` +
  `${PLAYBOOK}: \`visit(page, path, { as, at })\` from tests/helpers.js, roles and test ids, a pinned clock. ` +
  `Do not start the app yourself. Run it once per project — \`npx playwright test ${PROBE_FILE} ` +
  `--project=desktop --reporter=json\`, then mobile — and report each probe's result from the JSON. Leave ` +
  `the file in place; a later phase needs it.\n\n` +
  plan.probes.map(p => `- ${p.id}${p.viewport && p.viewport !== 'both' ? ` (${p.viewport} only)` : ''}: ${p.what} — expect: ${p.expect}`).join('\n'),
  { phase: 'Probe', label: 'probe', schema: RAN },
)
if (!ran) return publish({ verdict: 'none', why: 'the probes never ran', cleanup: true })

const byId = new Map(ran.results.map(r => [r.id, r]))
const failing = plan.probes.filter(p => {
  const r = byId.get(p.id)
  return r && (r.desktop === 'fail' || r.mobile === 'fail')
})

// ── Reproduce ───────────────────────────────────────────────────────────────
// One at a time: each reruns Playwright, and two runs cannot share the ports.
phase('Reproduce')
const findings = []
for (const p of failing) {
  const r = byId.get(p.id)
  const project = r.desktop === 'fail' ? 'desktop' : 'mobile'
  const repro = await agent(
    `${HERE}A QA probe failed on pull request #${pr}: "${p.id}" (${project}) — ${p.what}; expected ${p.expect}; got ` +
    `${r.happened || 'a failure'}. Follow §3 of ${PLAYBOOK}. Run it again on this checkout: ` +
    `\`npx playwright test ${PROBE_FILE} -g "${p.id}" --project=${project}\`. Then on the base: \`git worktree ` +
    `add ../orbit-qa-base origin/${plan.base}\`, symlink node_modules, copy the probe file in, run it there, and ` +
    `remove the worktree — never check out another commit in this tree. If it reproduces on the branch and the ` +
    `result would help a reviewer, take a screenshot and put it through \`node scripts/pr-media.mjs ` +
    `${plan.issue || pr} <png>\`.`,
    { phase: 'Reproduce', label: `repro:${p.id}`, schema: REPRO },
  )
  // A probe nobody could re-run is a question, not a bug.
  const kind = !repro || repro.onBranch === 'passes-now' ? 'flaky'
    : repro.onBase === 'fails' ? 'pre-existing'
    : 'bug'
  findings.push({ probe: p, project, kind, happened: repro ? repro.happened : r.happened, image: repro && repro.image })
}

// ── Publish ─────────────────────────────────────────────────────────────────
// Confidence is how much of the plan actually ran, on the viewports each
// probe was planned for — a probe about the phone layout is not "missing" on
// desktop.
const wants = p => (p.viewport && p.viewport !== 'both' ? [p.viewport] : ['desktop', 'mobile'])
const bothRan = plan.probes.filter(p => { const r = byId.get(p.id); return r && wants(p).every(v => r[v] !== 'not-run') }).length
const ratio = plan.probes.length ? bothRan / plan.probes.length : 0
const confidence = ratio === 1 && plan.probes.length >= 4 ? 'high' : ratio >= 0.5 ? 'medium' : 'low'
const bugs = findings.filter(f => f.kind === 'bug')
return publish({
  verdict: bugs.length ? 'fail' : 'pass',
  confidence,
  covered: `${bothRan}/${plan.probes.length} probes ran as planned: ${plan.probes.map(p => p.id).join(', ')}`,
  probes: plan.probes,
  findings,
  cleanup: true,
})

async function publish(r) {
  const CALLOUT = { high: ['TIP', '●●●'], medium: ['NOTE', '●●○'], low: ['WARNING', '●○○'] }
  const LABEL = { bug: 'a bug in this change', 'pre-existing': 'pre-existing', flaky: 'a question — did not reproduce' }
  const findings = r.findings || []
  let head, line
  if (r.verdict === 'fail') {
    head = `> [!CAUTION]\n> ### QA · blocker\n> Reproduced twice on this branch, not on ${plan.base}. Covered: ${r.covered}`
    line = `FAIL ${findings.find(f => f.kind === 'bug').probe.id}: ${findings.find(f => f.kind === 'bug').happened}`
  } else if (r.verdict === 'pass') {
    const [kind, meter] = CALLOUT[r.confidence]
    head = `> [!${kind}]\n> ### QA · ${r.confidence} confidence &nbsp; \`${meter}\`\n> ${r.covered}`
    line = `PASS ${r.confidence} ${r.covered}`
  } else {
    head = `> [!WARNING]\n> ### QA · did not finish\n> ${r.why}. Treat as unproven.`
    line = ''
  }
  const body = head + (findings.length
    ? '\n\n' + findings.map(f =>
        `**${f.probe.id}** (${f.project}) — *${LABEL[f.kind]}*\n` +
        `Did: ${f.probe.what}\nExpected: ${f.probe.expect}\nHappened: ${f.happened}` + (f.image ? `\n${f.image}` : '')).join('\n\n')
    : '')

  phase('Publish')
  const posted = await agent(
    HERE + (r.cleanup ? `First delete ${PROBE_FILE} and any ../orbit-qa-base worktree, and leave \`git status\` clean.\n\n` : '') +
    `Post this as ONE comment on pull request #${pr}, exactly as written — write it to a file and use ` +
    `\`gh pr comment ${pr} --body-file <file>\`:\n\n${body}\n\n` +
    (plan && plan.issue
      ? `Then comment on issue #${plan.issue} with only the callout block above (the lines starting ">") ` +
        `followed by " → <the PR comment url>" — the findings stay on the pull request.\n\n`
      : '') +
    (line ? `Then write exactly this one line to /tmp/qa-verdict:\n${line}\n` : `Write nothing to /tmp/qa-verdict.\n`) +
    `Change no code and open no pull request.`,
    { phase: 'Publish', label: 'publish', schema: POSTED, effort: 'low' },
  )
  return { verdict: r.verdict, confidence: r.confidence, pr, posted: !!(posted && posted.ok), findings }
}
