export const meta = {
  name: 'qa',
  description: 'Exploratory QA of a pull request: plan probes → run them → reproduce each failure on the branch and its base → report',
  whenToUse: 'Trying to break a pull request in a real browser — /qa 42, or when an agent PR opens.',
  phases: [
    { title: 'Plan', detail: 'on a re-review, the delta and the previous bugs; then what is worth probing that no test already proves' },
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
// Facts the QA job computes from git before this runs — never the planner's
// word: `--app-lines=N` (changed lines under src/ and server/) and
// `--ui-only=yes|no` (every changed file under src/, tests/, docs/ or specs/,
// at least one in src/). Without them — a local run — triage never skips.
const APP_LINES = typeof args === 'object' && args ? args.appLines : Number((/--app-lines=(\d+)/.exec(argText) || [])[1] ?? NaN)
const UI_ONLY = typeof args === 'object' && args ? args.uiOnly === true : /--ui-only=yes\b/.test(argText)
// The team's dial and one more fact: a change that is only prose about the app
// is not QA's to exercise, and "thorough" never lets the planner skip.
const DEPTH = (/--depth=(fast|balanced|thorough)\b/.exec(argText) || [])[1] || (typeof args === 'object' && args && args.depth) || 'balanced'
const DOCS_ONLY = typeof args === 'object' && args ? args.docsOnly === true : /--docs-only=yes\b/.test(argText)
// How hard to look, from the job (scripts/qa-facts.mjs weighs the ticket, the
// code lines and the risk). A one-line fix gets two probes on Sonnet; a large
// change gets five on the session model. No size: large, as before.
const SIZE = (/--size=(tiny|small|large)\b/.exec(argText) || [])[1] || (typeof args === 'object' && args && args.size) || 'large'
const MODEL = SIZE === 'large' ? undefined : 'sonnet'
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

// Where a probe gets a copy of the base to compare against: inside the repo,
// with the other agent worktrees. Every QA agent starts in a worktree of its
// own, so the path is computed from the repo root — relative, it would nest
// the base inside the pull request's checkout. Named once so the three
// prompts that mention it cannot drift apart.
const BASE_WT = '"$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")/.claude/worktrees/qa-base"'

const PLAYBOOK = 'docs/harness/qa-playbook.md'
// A section of the playbook in one read, and the reading discipline every QA
// agent needs: each turn re-reads everything before it, so a turn per grep and
// a whole doc "for context" are what a QA pass mostly pays for.
const qaSection = (from, to) => `\`awk '/^## ${from}\\./,/^## ${to}\\./' ${PLAYBOOK}\``
const LEAN = `Batch the reads you already know you need into one command (\`; echo ---;\` between them), read ` +
  `docs by the part (\`node scripts/context.mjs show <doc> <part>\`), and do not run \`npm test\` or the whole ` +
  `suite — only your probes. `
const PROBE_FILE = 'tests/qa-probe.spec.js'
// Five, not eight: each browser probe runs on both viewports on a 2-core
// runner, and eight of them plus reproductions ran QA past its time limit.
const MAX_PROBES = { tiny: 2, small: 3, large: 5 }[SIZE] || 5
// Exploring a relabelled button is ceremony. The planner may call a change
// covered by its tests — but only a cosmetic one this small, whatever it says.
const TRIVIAL_LINES = 30

// The marker a verdict comment ends with, read back by the next run on the
// same pull request. It is named for this pass because code review comments
// on the same thread — "the newest marker" could otherwise be code review's.
const PASS = 'qa'
const MARK = `orbit-verdict:${PASS}`
// A commit id is interpolated into a shell command in the plan prompt, so
// only something shaped like one is trusted — anything else plans in full.
const sha = v => (typeof v === 'string' && /^[0-9A-Za-z]{4,64}$/.test(v) ? v : null)

const SCOPE_OF = {
  type: 'object',
  required: ['head', 'files'],
  properties: {
    head: { type: 'string', description: 'the pull request head commit — headRefOid, the full sha' },
    files: { type: 'array', items: { type: 'string' }, description: 'every file the pull request changes' },
    previous: {
      type: 'object',
      description: `the JSON from the newest comment containing <!-- ${MARK} {…} -->, as written, plus inHistory; omit if there is none`,
      required: ['pass', 'commit', 'inHistory', 'bugs', 'followUps'],
      properties: {
        pass: { type: 'string' },
        commit: { type: 'string' },
        inHistory: { type: 'boolean', description: 'git merge-base --is-ancestor <commit> <head> exited 0' },
        bugs: { type: 'array', items: { type: 'object' }, description: 'each with the probe that found it' },
        followUps: { type: 'array', items: { type: 'string' } },
      },
    },
  },
}

const PLAN = {
  type: 'object',
  required: ['issue', 'base', 'surface', 'probes'],
  properties: {
    issue: { type: 'integer', description: 'the linked issue; 0 if none' },
    base: { type: 'string' },
    surface: { type: 'boolean', description: 'false only when nothing that changed can be exercised at all — not by a browser, not by running anything' },
    reason: { type: 'string', description: 'if surface is false, why' },
    enough: { type: 'boolean', description: 'true only if the change is cosmetic — copy, a label, a colour, spacing, an icon — touches no logic, data, API, state or flow, and the tests the PR adds or already has pin what changed. Then no probes.' },
    enoughWhy: { type: 'string', description: 'if enough: what changed and which tests cover it, in one sentence' },
    appLines: { type: 'integer', description: 'lines added + removed under src/ and server/ in the diff' },
    criteria: {
      type: 'array',
      description: "every Done-when criterion of the ticket, each mapped to what exercises it: one of your probes, or a test file this pull request changes that asserts it",
      items: {
        type: 'object',
        required: ['criterion', 'by'],
        properties: {
          criterion: { type: 'string' },
          by: { enum: ['probe', 'test', 'code', 'none'], description: "code: the criterion is about how the code is written (a statement at module scope, no db.prepare in a handler) — nothing a caller or attendee can observe, so code review judges it, not QA" },
          ref: { type: 'string', description: 'probe: its id. test: the test file path, as the diff names it' },
        },
      },
    },
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
  properties: {
    refuted: { type: 'boolean' },
    contrived: { type: 'boolean', description: 'real, but only reachable with an input nobody gives in normal use — a hand-edited URL or localStorage value, a forged request' },
    why: { type: 'string' },
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
// Assigned from the planner below; publish() reads it, and the scope stop
// returns before the planner runs.
let plan = null
// The planner chooses where the probes go, so it is the prompt that has to
// carry the delta boundary — and it cannot be built from what the planner is
// about to return. So a cheap agent reads the head, the files and the last
// verdict first, as code review's context does.
const scope = await agent(
  `${HERE}Read what a QA re-review of pull request #${pr} needs, and judge nothing. \`gh pr view ${pr} --json ` +
  `headRefOid,files,comments\`: return \`head\` (headRefOid) and \`files\` (every path). If a comment contains ` +
  `\`<!-- ${MARK} {…} -->\`, take the NEWEST such comment, parse the JSON between the tag and \`-->\`, and ` +
  `return it as \`previous\`, unchanged, with \`inHistory\` set by whether \`git merge-base --is-ancestor ` +
  `<its commit> <head>\` exits 0 (fetch the head first if it is missing). No such comment: omit \`previous\`.`,
  { phase: 'Plan', label: 'scope', schema: SCOPE_OF, effort: 'low', model: 'sonnet' },
)
// Planning blind would silently close every previous bug.
if (!scope) return publish({ verdict: 'none', why: 'could not read the pull request' })
const HEAD_SHA = sha(scope.head)

const files = Array.isArray(scope.files) ? scope.files : []
// The marker's own `pass` is checked here, not trusted to the agent's grep.
const previous = scope.previous && scope.previous.pass === PASS ? scope.previous : null
if (scope.previous && !previous) log(`ignored a verdict marker from another pass (${scope.previous.pass})`)
const before = previous && sha(previous.commit)
const filedBefore = new Set(previous && Array.isArray(previous.followUps) ? previous.followUps : [])
// The previous bugs' probes are the script's: re-run verbatim by id, so a
// planner that forgets one cannot quietly close it. They come out of the
// same budget — they are the probes most likely to matter.
const recheck = [...(previous && Array.isArray(previous.bugs) ? previous.bugs : [])
  .map(b => b && b.probe)
  .filter(p => p && typeof p.id === 'string' && p.id && typeof p.what === 'string')
  .reduce((m, p) => (m.has(p.id) ? m : m.set(p.id, p)), new Map()).values()].slice(0, MAX_PROBES)
const RECHECK_IDS = new Set(recheck.map(p => p.id))
const fresh = MAX_PROBES - recheck.length
// Both ends of the delta are named commits: in Actions the checkout is the
// merge of the branch into its base, not the head the marker recorded.
const ESCAPE = `Probe outside that diff only for something severe enough that it would have blocked a first review.`
const SCOPE = !previous ? ''
  : (!before || !HEAD_SHA
    ? `\n\nThis is a re-review, but the commit the last QA pass looked at is unreadable: plan in full.`
    : previous.inHistory === true
      ? `\n\nThis is a re-review. The last QA pass looked at ${before}; the pull request is now at ${HEAD_SHA}. ` +
        `Plan new probes only for what changed since: \`git diff ${before} ${HEAD_SHA}\`. ${ESCAPE}`
      : `\n\nThis is a re-review, and ${before}, the commit the last QA pass looked at, is no longer in the ` +
        `branch's history — it was rebased. \`git fetch origin ${before}\`, then plan new probes only for ` +
        `\`git diff ${before} ${HEAD_SHA} -- ${files.join(' ')}\` — the files this pull request touches. If that ` +
        `commit cannot be fetched at all, plan for those files in full. ${ESCAPE}`) +
    (recheck.length
      ? ` These probes re-run the bugs the last pass found and are already planned — do not plan them again: ` +
        `${recheck.map(p => p.id).join(', ')}. Pick at most ${fresh} new ${fresh === 1 ? 'one' : 'ones'}.`
      : '')
const budget = recheck.length ? `at most ${fresh} new probes (${recheck.length} of ${MAX_PROBES} are already spent re-running previous bugs)` : `at most ${MAX_PROBES} probes`

// Prose about the app — docs/, specs/, markdown, never the harness playbooks —
// has nothing a browser or a command can exercise that code review's
// docs-truth lens does not already read.
if (DOCS_ONLY && DEPTH !== 'thorough' && !recheck.length) {
  return publish({ verdict: 'pass', confidence: 'medium', skipped: true, covered: 'docs-only change — nothing for QA to exercise', probes: [] })
}

// A tiny change whose own tests already pin every Done-when needs no
// exploring: one quick, cheap read of the ticket and the tests says so, and QA
// passes in a minute instead of driving a browser for ten (#94: a two-line copy
// change with its own browser test). Anything not pinned falls through to the
// full plan below.
if (SIZE === 'tiny' && DEPTH !== 'thorough' && !recheck.length) {
  const quick = await agent(
    `${HERE}Pull request #${pr} is a tiny change. Read its ticket's Done when (\`gh pr view ${pr}\`, then the issue) ` +
    `and the tests the diff adds or changes (\`gh pr diff ${pr} -- tests/\`), in one command. Map every Done-when ` +
    `criterion to the test file in this diff that asserts it (by: test, ref: the file path as the diff names it), ` +
    `\`code\` if the criterion is about how the code is written, or \`none\` if no test in the diff asserts it. ` +
    `Be honest: a test that only exercises nearby code does not count. Write nothing.`,
    { phase: 'Plan', label: 'covered', schema: { type: 'object', required: ['criteria'], properties: { criteria: PLAN.properties.criteria } }, model: 'haiku', effort: 'low' },
  )
  const pinned = criteriaCovered(quick && quick.criteria, new Set())
  if (pinned.all) {
    log(`QA: every criterion is pinned by the PR's own tests — nothing to explore`)
    return publish({ verdict: 'pass', confidence: 'high', skipped: true,
      covered: `no exploration needed — a tiny change, and its own tests pin every Done-when criterion ` +
        `(${pinned.n}/${pinned.of}${pinned.codeOnly ? `, +${pinned.codeOnly} about the code itself, for code review` : ''})`, probes: [] })
  }
  log(`QA: the PR's tests pin ${pinned.n}/${pinned.of} criteria — exploring the rest`)
}

plan = await agent(
  `${HERE}Plan exploratory QA for pull request #${pr}. Read its ticket's Done when (\`gh pr view ${pr}\`, then the ` +
  `issue), \`gh pr diff ${pr}\`, and the tests it adds — what they assert is already proven, so spend nothing ` +
  `there. \`node scripts/context.mjs for <changed files>\` names the docs with the callers and test ids; \`show <doc>\` ` +
  `gives a doc's outline and \`show <doc> <part>\` just that part — read parts, not whole docs. Batch reads you ` +
  `already know you need into one command: every turn re-reads everything before it. ` +
  `Pick ${budget} in the order §1 of ${PLAYBOOK} gives. What a browser cannot reach, probe ` +
  `by running it (kind: command): a changed script with an empty, huge or malformed input; a changed ` +
  `workflow script under the stubs tests/unit already uses, with an agent returning null at the new step; a ` +
  `changed GitHub Actions \`if:\` or expression evaluated in a few lines of node against a realistic payload ` +
  `(an issue comment, a bot's pull request, a draft); every command a changed doc tells an agent to run, run ` +
  `as written. Commands must not touch GitHub or change tracked files. Return surface=false only when there ` +
  `is genuinely nothing to exercise. Before any of that, decide whether exploring is worth it at all: a ` +
  `cosmetic change — copy, a label, a colour, spacing — that the tests already pin needs no probes; say ` +
  `enough=true, why, and appLines, and return no probes. Anything with logic, data, an API, state or a flow ` +
  `in it is never enough. Finally map every Done-when criterion (criteria) to the probe or the test file in ` +
  `this diff that exercises it — honestly: \`none\` where nothing does, \`code\` where the criterion is about how the code is written rather than anything a caller or attendee can observe. A criterion a test in the diff already ` +
  `pins needs no probe; spend probes on what nothing covers and on §1's edges. Write nothing.${SCOPE}`,
  { phase: 'Plan', label: 'plan', schema: PLAN, model: MODEL },
)
if (!plan) return publish({ verdict: 'none', why: 'the planner did not finish' })
// Triage: the planner judged the tests enough, and the change is small
// enough to take its word. Past the line cap it is explored regardless.
const mayTriage = DEPTH !== 'thorough' && (SIZE === 'tiny' || (Number.isInteger(APP_LINES) && APP_LINES > 0 && APP_LINES <= TRIVIAL_LINES && UI_ONLY))
// A skip re-runs nothing, so it is never taken over previous bugs: that
// would publish a clean marker and close them unexamined.
if (plan.enough === true && mayTriage && !recheck.length) {
  log(`QA triage: skipped — ${plan.enoughWhy || 'cosmetic, covered by tests'}`)
  const pinned = criteriaCovered(plan.criteria, new Set())
  return publish({ verdict: 'pass', confidence: pinned.all ? 'high' : 'medium', skipped: true,
    covered: `no exploration needed — ${plan.enoughWhy || 'a cosmetic change the tests already pin'} (${SIZE} change, ${APP_LINES} app lines; ` +
      `criteria pinned by tests in the diff ${pinned.n}/${pinned.of})`, probes: [] })
}
// Over the cap, or no count: the planner said "enough" and so planned no
// probes. Ask again for a real plan — logging "exploring anyway" and then
// falling through to "nothing to exercise" explored nothing.
if (plan.enough === true && mayTriage) {
  log(`QA triage: the planner called it enough — running only the ${recheck.length} previous bug probe(s)`)
  plan.probes = []
} else if (plan.enough === true) {
  log(`QA triage: the planner called it enough, but the change is not a small UI-only one (${Number.isInteger(APP_LINES) ? APP_LINES : 'unknown'} app lines, ui-only ${UI_ONLY}) — exploring anyway`)
  const again = await agent(
    `${HERE}Plan exploratory QA for pull request #${pr}. It cannot be skipped: only a UI-only change of at most ` +
    `${TRIVIAL_LINES} lines may be called covered by its tests, and this is not one. ` +
    `Do not return enough=true. Otherwise plan exactly as before: read the ticket's Done when, \`gh pr diff ${pr}\` ` +
    `and the tests it adds, then pick ${budget} in the order §1 of ${PLAYBOOK} gives — ` +
    `browser probes, or command probes for what a browser cannot reach. Write nothing.${SCOPE}`,
    { phase: 'Plan', label: 'plan-again', schema: PLAN, model: MODEL },
  )
  if (!again) return publish({ verdict: 'none', why: 'the planner did not finish' })
  plan.surface = again.surface
  plan.reason = again.reason
  plan.probes = again.probes
}
// The recheck probes go in first, each id once (the recheck copy wins), and
// the whole list obeys the budget — assigned back to plan.probes so that
// everything downstream counts each id exactly once. Above the early return:
// a planner told to leave the previous bugs alone may fairly plan nothing
// new, and "nothing to exercise" would then close every one of them.
if (recheck.length) {
  const seen = new Set()
  plan.probes = [...recheck, ...(plan.probes || [])].filter(p => p && !seen.has(p.id) && seen.add(p.id)).slice(0, MAX_PROBES)
  plan.surface = true
}
if (!plan.surface || !plan.probes.length) return publish({ verdict: 'pass', confidence: 'low', covered: `nothing to exercise — ${plan.reason || 'no probe could be planned'}`, probes: [] })

// ── Probe ───────────────────────────────────────────────────────────────────
// Browser probes share one spec and one Playwright run per viewport; command
// probes run separately and first, since they need no app.
const browserProbes = plan.probes.filter(p => (p.kind || 'browser') === 'browser')
const commandProbes = plan.probes.filter(p => p.kind === 'command')
phase('Probe')
const ranCommands = commandProbes.length ? await agent(
  `${HERE}${LEAN}Run each of these command probes for pull request #${pr} in this checkout, exactly as written, ` +
  `and report each id's result as \`command\`: pass if what happened is what was expected, fail if not (say ` +
  `what happened), not-run if it could not be run. Put scratch files under a mktemp -d directory; change no ` +
  `tracked file; touch nothing on GitHub.\n\n` +
  commandProbes.map(p => `- ${p.id}: \`${p.run || p.what}\` — ${p.what}; expect: ${p.expect}`).join('\n'),
  { phase: 'Probe', label: 'probe-commands', schema: RAN, model: MODEL },
) : { results: [] }
const ranBrowser = browserProbes.length ? await agent(
  `${HERE}${LEAN}Write ${PROBE_FILE} with one Playwright test per probe below, titled with its id, following §2 of ` +
  `${PLAYBOOK} (${qaSection(2, 3)}): \`visit(page, path, { as, at })\` from tests/helpers.js, roles and test ids, a pinned clock. ` +
  `Do not start the app yourself. Run it once for both projects — \`npx playwright test ${PROBE_FILE} ` +
  `--reporter=json\` runs desktop and mobile together — and report each probe's result from the JSON. Leave ` +
  `the file in place; a later phase needs it.\n\n` +
  browserProbes.map(p => `- ${p.id}${p.viewport && p.viewport !== 'both' ? ` (${p.viewport} only)` : ''}: ${p.what} — expect: ${p.expect}`).join('\n'),
  { phase: 'Probe', label: 'probe', schema: RAN, model: MODEL },
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
    `got ${r.happened || 'a failure'}. ${LEAN}Follow §3 of ${PLAYBOOK} (${qaSection(3, 4)}). Run it again here. Then on the base: \`git ` +
    `worktree add ${BASE_WT} origin/${plan.base}\`, symlink node_modules, run the same command there, and ` +
    `remove the worktree — never check out another commit in this tree. onBase is not-applicable when what it ` +
    `runs does not exist on the base.`,
    { phase: 'Reproduce', label: `repro:${p.id}`, schema: REPRO, model: MODEL },
  ) : await agent(
    `${HERE}A QA probe failed on pull request #${pr}: "${p.id}" (${project}) — ${p.what}; expected ${p.expect}; got ` +
    `${r.happened || 'a failure'}. ${LEAN}Follow §3 of ${PLAYBOOK} (${qaSection(3, 4)}). Run it again on this checkout: ` +
    `\`npx playwright test ${PROBE_FILE} -g "${p.id}" --project=${project}\`. Then on the base: \`git worktree ` +
    `add ${BASE_WT} origin/${plan.base}\`, symlink node_modules, copy the probe file in, run it there, and ` +
    `remove the worktree — never check out another commit in this tree. If it reproduces on the branch and the ` +
    `result would help a reviewer, take a screenshot and put it through \`node scripts/pr-media.mjs ` +
    `${plan.issue || pr} <png>\`.`,
    { phase: 'Reproduce', label: `repro:${p.id}`, schema: REPRO, model: MODEL },
  )
  const again = RECHECK_IDS.has(p.id)
  // A probe nobody could re-run is a question, not a bug.
  let kind = !repro || repro.onBranch === 'passes-now' ? 'flaky'
    : repro.onBase === 'fails' ? 'pre-existing'
    : 'bug'
  // Reproducing on the branch and not on the base proves the probe fails —
  // not that the change is wrong. On #49 QA ran the PR's new tests against
  // main's copy of the code they test, and called their failure a bug. Like
  // code review's, a QA blocker now has to survive someone trying to refute it.
  // A previous bug's probe that fails again already survived a skeptic when
  // it was first found; re-arguing it invites it to flip between rounds.
  let doubt = null
  if (kind === 'bug' && !again) {
    const v = await agent(
      `${HERE}QA reproduced this on pull request #${pr} and not on its base: "${p.id}" — ${p.what}; expected ` +
      `${p.expect}; happened: ${repro.happened}. Try to REFUTE that it is a bug in this change. ${LEAN}Read the probe ` +
      `(${PROBE_FILE} or the command) and \`gh pr diff ${pr}\`. Refute if the probe itself is wrong (a wrong ` +
      `selector, a wrong expectation, the ticket asking for this behaviour), if it tests code or tests the PR ` +
      `adds against the base's version of the code they cover, if the failure is the environment (ports, data ` +
      `left by another test, timing), or if it is behaviour the ticket or a human on the PR asked for. If you ` +
      `cannot tell, it is NOT refuted. If it is real but only reachable with an input nobody gives in normal ` +
      `use — a hand-edited URL or localStorage value, a forged request — say contrived, and why.`,
      { phase: 'Reproduce', label: `skeptic:${p.id}`, schema: REFUTATION, effort: 'medium', model: MODEL },
    )
    // A skeptic that died refuted nothing.
    if (v && v.refuted === true) { kind = 'question'; doubt = String(v.why || '').trim() || 'the skeptic refuted it without giving a reason' }
    // Real, but not through normal use: tracked as an issue, not blocking.
    else if (v && v.contrived === true) { kind = 'follow-up'; doubt = String(v.why || '').trim() || 'only reachable with a contrived input' }
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
const ranIds = new Set(plan.probes.filter(p => { const r = byId.get(p.id); return r && wants(p).every(v => r[v] !== 'not-run') }).map(p => p.id))
const cover = criteriaCovered(plan.criteria, ranIds)
const confidence = ratio === 1 && cover.all ? 'high' : ratio >= 0.5 ? 'medium' : 'low'
const bugs = findings.filter(f => f.kind === 'bug')
return publish({
  verdict: bugs.length ? 'fail' : 'pass',
  confidence,
  covered: `${bothRan}/${plan.probes.length} probes ran as planned: ${plan.probes.map(p => p.id).join(', ')}; ` +
    `criteria exercised ${cover.n}/${cover.of}${cover.codeOnly ? ` (+${cover.codeOnly} about the code itself, for code review)` : ''}` +
    (recheck.length ? ` (re-checked from the last pass: ${recheck.map(p => p.id).join(', ')})` : ''),
  probes: plan.probes,
  findings,
  cleanup: true,
})

// Confidence means coverage: every Done-when criterion exercised by a probe
// that ran, or by a test file this pull request changes — checked against the
// diff's file list, not the planner's word. Probe count was the old proxy, and
// a refactor with one thing worth probing could never read as covered.
function criteriaCovered(criteria, ranIds) {
  // A criterion about the code's shape is code review's to judge — no probe can
  // exercise it, and counting it capped every refactor at medium (#87: 2/3).
  const all = Array.isArray(criteria) ? criteria : []
  const codeOnly = all.filter(c => c && c.by === 'code').length
  const list = all.filter(c => !(c && c.by === 'code'))
  const ok = c => c && ((c.by === 'probe' && ranIds.has(c.ref)) ||
    (c.by === 'test' && typeof c.ref === 'string' && files.includes(c.ref.split(/[:#\s]/)[0]) && /(^|\/)tests\//.test(c.ref)))
  const n = list.filter(ok).length
  return { n, of: list.length, codeOnly, all: n === list.length && (list.length > 0 || codeOnly > 0) }
}

async function publish(r) {
  const CALLOUT = { high: ['TIP', '●●●'], medium: ['NOTE', '●●○'], low: ['WARNING', '●○○'] }
  const LABEL = { bug: 'a bug in this change', 'pre-existing': 'pre-existing', flaky: 'a question — did not reproduce', question: 'a question — reproduced, but refuted as a bug', 'follow-up': 'a follow-up — reproduced, but only with an input nobody gives in normal use; filed as an issue' }
  const findings = r.findings || []
  let head, line
  if (r.verdict === 'fail') {
    head = `> [!CAUTION]\n> ### QA · blocker\n> Reproduced twice on this branch, not on ${plan.base}. Covered: ${r.covered}`
    line = `FAIL ${findings.find(f => f.kind === 'bug').probe.id}: ${findings.find(f => f.kind === 'bug').happened}`
  } else if (r.verdict === 'pass') {
    const [kind, meter] = CALLOUT[r.confidence]
    head = r.skipped
      ? `> [!${kind}]\n> ### QA · skipped — existing tests are enough &nbsp; \`${meter}\`\n> ${r.covered}`
      : `> [!${kind}]\n> ### QA · ${r.confidence} confidence &nbsp; \`${meter}\`\n> ${r.covered}`
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

  // The marker and the follow-up issues only for a pass that finished: one
  // that did not probed no commit, and recording one would let the next run
  // treat every previous bug as closed. Follow-ups are filed on a fail too.
  let comment = body, file = []
  if (r.verdict === 'pass' || r.verdict === 'fail') {
    const fus = findings.filter(f => f.kind === 'follow-up').slice(0, 3)
    file = fus.filter(f => !filedBefore.has(f.probe.id)).map(f => ({
      key: f.probe.id,
      title: `Follow-up from #${pr}: ${f.probe.id} — ${f.happened}`.slice(0, 120),
      body: `QA reproduced this on #${pr} and judged it not a blocker: ${f.doubt}.\n\nProbe ${f.probe.id} (${f.project})\n` +
        `Did: ${f.probe.what}\nExpected: ${f.probe.expect}\nHappened: ${f.happened}`,
    }))
    const mark = {
      pass: PASS,
      commit: HEAD_SHA,
      bugs: findings.filter(f => f.kind === 'bug').map(f => ({ id: f.probe.id, happened: f.happened, probe: f.probe })),
      followUps: [...new Set([...filedBefore, ...fus.map(f => f.probe.id)])],
    }
    // `<` and `>` escaped, so no probe text can close the comment early.
    comment += `\n\n<!-- ${MARK} ${JSON.stringify(mark).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')} -->`
  }

  const out = { verdict: r.verdict, confidence: r.confidence, pr, comment, verdictLine: line, issue: plan && plan.issue, issueNote: head, findings, probes: r.probes || [], followUps: file }
  // In CI the job posts these itself (the runner is thrown away, so there is
  // nothing to clean up either). An agent told to publish once returned
  // posted:false and the check read "did not finish".
  if (!PUBLISH) return out

  phase('Publish')
  const posted = await agent(
    HERE + (r.cleanup ? `First delete ${PROBE_FILE} and any worktree at ${BASE_WT}, and leave \`git status\` clean.\n\n` : '') +
    `Post this as ONE comment on pull request #${pr}, exactly as written — write it to a file and use ` +
    `\`gh pr comment ${pr} --body-file <file>\`:\n\n${comment}\n\n` +
    // In CI the job files these; on a laptop nothing else would, and the
    // marker already says they were filed.
    file.map(f => `Then \`gh issue create --label follow-up\` (without the label if it does not exist) titled ` +
      `${JSON.stringify(f.title)}, with this body:\n${f.body}\n\n`).join('') +
    (plan && plan.issue
      ? `Then comment on issue #${plan.issue} with only the callout block above (the lines starting ">") ` +
        `followed by " → <the PR comment url>" — the findings stay on the pull request.\n\n`
      : '') +
    (line ? `Then write exactly this one line to /tmp/qa-verdict:\n${line}\n` : `Write nothing to /tmp/qa-verdict.\n`) +
    // On a laptop the probes claimed a lane in the PR's worktree, and nothing
    // else gives it back: qa-71 was still holding its ports hours later.
    (WORKDIR ? `Finally \`cd ${WORKDIR} && node scripts/lane.mjs release\` — the probes' lane; "nothing to release" is fine.\n` : '') +
    `Change no code and open no pull request.`,
    { phase: 'Publish', label: 'publish', schema: POSTED, effort: 'low', model: 'haiku' },
  )
  return { ...out, posted: !!(posted && posted.ok) }
}
