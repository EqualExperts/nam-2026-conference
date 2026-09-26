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

// `/qa 42`, `/qa 42 --no-publish` (CI: the job posts what this returns),
// or { pr, workdir, publish }.
const argText = typeof args === 'object' && args ? '' : String(args ?? '')
const pr = Number(typeof args === 'object' && args ? args.pr : (/#?(\d+)/.exec(argText) || [])[1])
const PUBLISH = typeof args === 'object' && args ? args.publish !== false : !/--no-publish/.test(argText)
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
// Five, not eight: each browser probe runs on both viewports on a 2-core
// runner, and eight of them plus reproductions ran QA past its time limit.
const MAX_PROBES = 5

const PLAN = {
  type: 'object',
  required: ['issue', 'base', 'surface', 'probes'],
  properties: {
    issue: { type: 'integer', description: 'the linked issue; 0 if none' },
    base: { type: 'string' },
    surface: { type: 'boolean', description: 'false only when nothing that changed can be exercised at all — not by a browser, not by running anything' },
    reason: { type: 'string', description: 'if surface is false, why' },
    probes: {
      type: 'array',
      maxItems: MAX_PROBES,
      items: {
        type: 'object',
        required: ['id', 'kind', 'what', 'expect', 'why'],
        properties: {
          id: { type: 'string', description: 'kebab-case, unique — becomes the test title' },
          kind: { enum: ['browser', 'command'], description: 'browser: a Playwright probe. command: run something — a script with an edge input, a workflow under stubs, a YAML if: evaluated against a payload' },
          run: { type: 'string', description: 'command probes: the exact shell command(s)' },
          what: { type: 'string', description: 'the steps: route, attendee, clock, clicks' },
          expect: { type: 'string', description: 'what should happen' },
          why: { enum: ['empty-or-extreme', 'other-viewport', 'other-day', 'second-interaction', 'callers', 'console', 'trigger', 'failure-path', 'doc-claim'] },
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
        required: ['id'],
        properties: {
          id: { type: 'string' },
          desktop: { enum: ['pass', 'fail', 'not-run'] },
          mobile: { enum: ['pass', 'fail', 'not-run'] },
          command: { enum: ['pass', 'fail', 'not-run'] },
          happened: { type: 'string', description: 'on a fail: the assertion or error, one line' },
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
  `Pick at most ${MAX_PROBES} probes in the order §1 of ${PLAYBOOK} gives. What a browser cannot reach, probe ` +
  `by running it (kind: command): a changed script with an empty, huge or malformed input; a changed ` +
  `workflow script under the stubs tests/unit already uses, with an agent returning null at the new step; a ` +
  `changed GitHub Actions \`if:\` or expression evaluated in a few lines of node against a realistic payload ` +
  `(an issue comment, a bot's pull request, a draft); every command a changed doc tells an agent to run, run ` +
  `as written. Commands must not touch GitHub or change tracked files. Return surface=false only when there ` +
  `is genuinely nothing to exercise. Write nothing.`,
  { phase: 'Plan', label: 'plan', schema: PLAN },
)
if (!plan) return publish({ verdict: 'none', why: 'the planner did not finish' })
if (!plan.surface || !plan.probes.length) return publish({ verdict: 'pass', confidence: 'low', covered: `nothing to exercise — ${plan.reason || 'no probe could be planned'}`, probes: [] })

// ── Probe ───────────────────────────────────────────────────────────────────
// Browser probes share one spec and one Playwright run per viewport; command
// probes run separately and first, since they need no app.
const browserProbes = plan.probes.filter(p => (p.kind || 'browser') === 'browser')
const commandProbes = plan.probes.filter(p => p.kind === 'command')
phase('Probe')
const ranCommands = commandProbes.length ? await agent(
  `${HERE}Run each of these command probes for pull request #${pr} in this checkout, exactly as written, ` +
  `and report each id's result as \`command\`: pass if what happened is what was expected, fail if not (say ` +
  `what happened), not-run if it could not be run. Put scratch files under a mktemp -d directory; change no ` +
  `tracked file; touch nothing on GitHub.\n\n` +
  commandProbes.map(p => `- ${p.id}: \`${p.run || p.what}\` — ${p.what}; expect: ${p.expect}`).join('\n'),
  { phase: 'Probe', label: 'probe-commands', schema: RAN },
) : { results: [] }
const ranBrowser = browserProbes.length ? await agent(
  `${HERE}Write ${PROBE_FILE} with one Playwright test per probe below, titled with its id, following §2 of ` +
  `${PLAYBOOK}: \`visit(page, path, { as, at })\` from tests/helpers.js, roles and test ids, a pinned clock. ` +
  `Do not start the app yourself. Run it once per project — \`npx playwright test ${PROBE_FILE} ` +
  `--project=desktop --reporter=json\`, then mobile — and report each probe's result from the JSON. Leave ` +
  `the file in place; a later phase needs it.\n\n` +
  browserProbes.map(p => `- ${p.id}${p.viewport && p.viewport !== 'both' ? ` (${p.viewport} only)` : ''}: ${p.what} — expect: ${p.expect}`).join('\n'),
  { phase: 'Probe', label: 'probe', schema: RAN },
) : { results: [] }
if (!ranCommands || !ranBrowser) return publish({ verdict: 'none', why: 'the probes never ran', cleanup: true })
const ran = { results: [...ranCommands.results, ...ranBrowser.results] }

const byId = new Map(ran.results.map(r => [r.id, r]))
const failing = plan.probes.filter(p => {
  const r = byId.get(p.id)
  return r && (r.desktop === 'fail' || r.mobile === 'fail' || r.command === 'fail')
})

// ── Reproduce ───────────────────────────────────────────────────────────────
// One at a time: each reruns Playwright, and two runs cannot share the ports.
phase('Reproduce')
const findings = []
for (const p of failing) {
  const r = byId.get(p.id)
  const project = r.command === 'fail' ? 'command' : r.desktop === 'fail' ? 'desktop' : 'mobile'
  const repro = p.kind === 'command' ? await agent(
    `${HERE}A command probe failed on pull request #${pr}: "${p.id}" — \`${p.run || p.what}\`; expected ${p.expect}; ` +
    `got ${r.happened || 'a failure'}. Follow §3 of ${PLAYBOOK}. Run it again here. Then on the base: \`git ` +
    `worktree add ../orbit-qa-base origin/${plan.base}\`, symlink node_modules, run the same command there, and ` +
    `remove the worktree — never check out another commit in this tree. onBase is not-applicable when what it ` +
    `runs does not exist on the base.`,
    { phase: 'Reproduce', label: `repro:${p.id}`, schema: REPRO },
  ) : await agent(
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
  let kind = !repro || repro.onBranch === 'passes-now' ? 'flaky'
    : repro.onBase === 'fails' ? 'pre-existing'
    : 'bug'
  // Reproducing on the branch and not on the base proves the probe fails —
  // not that the change is wrong. On #49 QA ran the PR's new tests against
  // main's copy of the code they test, and called their failure a bug. Like
  // code review's, a QA blocker now has to survive someone trying to refute it.
  let doubt = null
  if (kind === 'bug') {
    const v = await agent(
      `${HERE}QA reproduced this on pull request #${pr} and not on its base: "${p.id}" — ${p.what}; expected ` +
      `${p.expect}; happened: ${repro.happened}. Try to REFUTE that it is a bug in this change. Read the probe ` +
      `(${PROBE_FILE} or the command) and \`gh pr diff ${pr}\`. Refute if the probe itself is wrong (a wrong ` +
      `selector, a wrong expectation, the ticket asking for this behaviour), if it tests code or tests the PR ` +
      `adds against the base's version of the code they cover, if the failure is the environment (ports, data ` +
      `left by another test, timing), or if it is behaviour the ticket or a human on the PR asked for. If you ` +
      `cannot tell, it is NOT refuted.`,
      { phase: 'Reproduce', label: `skeptic:${p.id}`, schema: REFUTATION, effort: 'medium' },
    )
    // A skeptic that died refuted nothing.
    if (v && v.refuted) { kind = 'question'; doubt = v.why }
  }
  findings.push({ probe: p, project, kind, happened: repro ? repro.happened : r.happened, image: repro && repro.image, doubt })
}

// ── Publish ─────────────────────────────────────────────────────────────────
// Confidence is how much of the plan actually ran, on the viewports each
// probe was planned for — a probe about the phone layout is not "missing" on
// desktop.
const wants = p => (p.kind === 'command' ? ['command'] : p.viewport && p.viewport !== 'both' ? [p.viewport] : ['desktop', 'mobile'])
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
  const LABEL = { bug: 'a bug in this change', 'pre-existing': 'pre-existing', flaky: 'a question — did not reproduce', question: 'a question — reproduced, but refuted as a bug' }
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
        `Did: ${f.probe.what}\nExpected: ${f.probe.expect}\nHappened: ${f.happened}` + (f.doubt ? `\nWhy it is not a blocker: ${f.doubt}` : '') + (f.image ? `\n${f.image}` : '')).join('\n\n')
    : '')

  const out = { verdict: r.verdict, confidence: r.confidence, pr, comment: body, verdictLine: line, issue: plan && plan.issue, issueNote: head, findings }
  // In CI the job posts these itself (the runner is thrown away, so there is
  // nothing to clean up either). An agent told to publish once returned
  // posted:false and the check read "did not finish".
  if (!PUBLISH) return out

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
  return { ...out, posted: !!(posted && posted.ok) }
}
