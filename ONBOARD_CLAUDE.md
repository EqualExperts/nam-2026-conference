# Onboarding — for Claude

You are setting up a workshop attendee to work on **ORBIT '26** with the AI
harness. Read this whole file, then carry out the steps in order, checking each
one before the next. Tell the person what you are doing in a sentence per step;
stop and ask only where a step says so.

## The rule that matters most

**Everything the attendee creates goes on their own fork, never on
`EqualExperts/nam-2026-conference`.** Every attendee does this exercise at
once; one ticket on the shared repo is everyone's noise. So:

- Work only in a clone of the attendee's fork, with `gh` pinned to it
  (step 4). Never create an issue or pull request with `-R` naming another repo.
- If a command is blocked by the fork guard (`scripts/fork-guard.mjs`, run as a
  hook by `.claude/settings.json`), do not work around it — it means you are in
  the wrong checkout. Go back to step 3.
- The original repo is read-only for this workshop: no issues, no pull requests,
  no comments, no labels.

## 1. Check the tools

```bash
gh auth status            # signed in to github.com — note the account name
node -v                   # v22.x  (nvm use 22 if not)
git --version
```

If `gh` is not signed in, ask the person to run `gh auth login` themselves
(`! gh auth login` in Claude Code) — never handle their credentials. Call the
signed-in account `<you>` below.

## 2. Fork, and turn on Issues

```bash
gh repo fork EqualExperts/nam-2026-conference --clone=false
gh api -X PATCH repos/<you>/nam-2026-conference -F has_issues=true --jq .has_issues   # → true
```

A fork starts with Issues off; the tickets go there, so it must be on. If the
fork already exists, `gh repo fork` says so — that is fine, carry on.

## 3. Clone the fork

Ask where to put it if they have no preference; their home folder is fine.

```bash
gh repo clone <you>/nam-2026-conference ~/nam-2026-conference
cd ~/nam-2026-conference
git remote get-url origin   # → …/<you>/nam-2026-conference — the fork, not EqualExperts
```

## 4. Pin `gh` to the fork

`gh repo clone` of a fork adds an `upstream` remote pointing at EqualExperts, and
`gh` without a terminal prefers it. Pin it once:

```bash
gh repo set-default "$(git remote get-url origin)"
gh repo set-default --view          # → <you>/nam-2026-conference
node scripts/fork-guard.mjs && echo "fork guard: ok"
```

Do not go on until the guard says ok.

## 5. Turn on Actions — the person does this one

A fork starts with its workflows paused, and there is no API to resume them. Ask
the person to open `https://github.com/<you>/nam-2026-conference/actions` and
click **I understand my workflows, go ahead and enable them**. Then check:

```bash
gh api repos/<you>/nam-2026-conference/actions/workflows --jq .total_count   # → more than 0
```

## 6. Set up the harness

It creates the labels `/ship` puts on issues.

```bash
gh workflow run setup.yml -R <you>/nam-2026-conference
gh run list -R <you>/nam-2026-conference --workflow setup.yml --limit 1   # wait for "completed success"
gh label list -R <you>/nam-2026-conference | grep -c -E "ready-for-ai|ai-working|ready-for-human|needs-human"   # → 4
```

The run's summary marks the API key as optional — the workshop does not need it.
Do **not** add `ANTHROPIC_API_KEY` or the `ready-for-ai` label: the attendee runs
the agents from Claude on their laptop, not on GitHub Actions.

## 7. Install and check the app

```bash
npm install
npx playwright install chromium
npm test                  # every test passes, in a few seconds
```

Optionally `npm run dev` and open http://localhost:5173 to see the app.

## 8. Restart Claude in the clone

The harness commands (`/winnow`, `/create-tasks`, `/ship`, `/code-review`,
`/qa`) and the fork guard load from the project folder. If this session did not
start in `~/nam-2026-conference`, tell the person to start Claude there — `cd
~/nam-2026-conference && claude`, or open that folder in Claude Desktop — and to
run `/setup-winnow` in the new session (say **no** to audio).

## Done — check before you say so

All of these must hold:

- [ ] `gh repo set-default --view` names `<you>/nam-2026-conference`.
- [ ] `node scripts/fork-guard.mjs` exits 0.
- [ ] Issues are on and the four harness labels exist on the fork.
- [ ] `npm test` passes.

Then tell the person they are ready, and what comes next: turn a conversation
into tickets with `/winnow` (try `/winnow docs/demo/winnow-transcript.txt`) or
`/create-tasks <one line>`, then ship one with `/ship <issue number>`. Every
ticket lands on their fork; the walkthrough is in
[docs/harness/quickstart.md](docs/harness/quickstart.md).
