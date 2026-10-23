# Onboarding — instructions for Claude

**Audience: you, an AI agent.** A workshop attendee has asked you to set up
their machine for the ORBIT '26 workshop. This file is a procedure. Follow it
step by step, in order. Every step has the same shape:

- **Check** — a command whose output tells you whether the step is already done.
  If it passes, skip to the next step. (So you can safely restart this procedure
  at any point; it is idempotent.)
- **Do** — what to run when the check fails.
- **Verify** — run the check again. Do not continue until it passes.
- **If it fails** — the known causes and fixes. If none applies, read the error
  output, explain it to the person in one or two plain sentences, and fix it with
  them. Never skip a failed step.

The person following along may not be technical. Make this feel like a
friendly onboarding, not a terminal session, and keep them with you on the
**progress board** below.

### Talking to the person

Be a friendly guide getting them ready for launch, not a build log.

- **Welcome them first.** Before the first board, write two or three warm
  sentences: what you're about to do together, that it takes about ten
  minutes, and that you'll do almost all of it for them.
- **Friendly first, technical second.** Lead with what the step means for
  them. A short technical status after that is fine and often reassuring:
  *"You have your own copy of the workshop now: github.com/you/nam-2026-conference."*
  *"The app works on your machine: all 560 tests pass (Node 22, Playwright
  ready)."* Explain a technical term in a few words the first time you use it
  ("a fork, your own copy of the repo"). Skip internals they can't act on:
  exit codes, GraphQL, hook names.
- **Say why, briefly.** One clause on why a step matters makes it feel less
  like a chore: *"turning on Actions lets your copy run its checks on
  GitHub"*.
- **Keep it moving.** Between boards, one short line at most. Don't narrate
  each command.
- **Readable command lines.** The person sees the first line of every command
  you run. Make that line a plain-English comment, such as
  `# Checking your GitHub account`, and put the commands below it.
- **No pasted output.** If something really failed, say so calmly in one or
  two sentences: what went wrong, and what happens next. It's never their
  fault, and you'll fix it together.
- **Celebrate the finish.** At the end, a short, genuine *you're ready* goes a
  long way. Then say clearly what to try first.

### The progress board

This is a workshop, and setup is its first exercise — make it feel like one.
Show the board, as plain Markdown (no code block, so it renders), at these
moments:

- once before Step 0
- whenever you stop for the person (a 🙋)
- after any step that took more than a minute
- at the end

Print it in your own reply text, in full. A task or to-do list does not count:
the person may never see it. Saying that you set up a checklist does not
count either: they need to see the board itself.

With the first board, add one line: setup is automatic except for **one
click** on GitHub, and you will say exactly when. (Count it as one click:
signing in or making a GitHub account only applies when those aren't already
done.)

> **🛰️ ORBIT '26 — launch checklist** · 3 of 11 done
>
> ✅ Ready to set up
> ✅ GitHub account
> ⏭️ Your computer — macOS, Apple Silicon
> 🔄 Install the tools
> ⬜ Sign in to GitHub
> ⬜ Make your own copy of the workshop
> ⬜ Download it to this computer
> ⬜ Connect it to your copy
> ⬜ Turn on GitHub Actions
> ⬜ Set up the workshop labels
> ⬜ Install and test the app
>
> *Tools next — this is the longest step, a few minutes at most.*

- ✅ done in this run · ⏭️ already done · 🔄 in progress ·
  🙋 waiting on the person · ❌ failed — fixing it with them · ⬜ to do. Rows map
  one-to-one to Steps 0–9. After a dash, give the step's one useful fact in
  plain words, as the computer line does: the GitHub account, the link to
  their copy, the folder it's in, how many checks passed.
- Under the board, one short line in italics: what is next and roughly how long
  it takes. At a 🙋, the **👉 Your turn** block (below) replaces it. Light and friendly is
  good; a joke per step is not. Never more than one line.
- Step 10 (*loading the workshop commands*) is not on the board: it is the
  hand-off. When the last row is ✅, show the board one final time with the
  header **🚀 ORBIT '26 — ready for launch** · 11 of 11, then the *Done*
  summary.

**Ask at most two questions:** whether they have a GitHub account (Step 0b),
and only when `gh` is not signed in already; and **where to fork the
repository to** (Step 4). Decide
everything else yourself with the defaults given here. The person is otherwise
only interrupted for things no agent can do for them — typing a password,
approving an administrator prompt, logging in in a browser, or clicking a
button on github.com — and for those you tell them exactly what to do, you do
not ask.

**Whenever the person has to do something, make it impossible to miss.** End
your message with one block in this shape, with nothing after it:

> **👉 Your turn:** open https://github.com/you/nam-2026-conference/actions and
> click the green **I understand my workflows, go ahead and enable them**.

Give one action, with the link or the exact command, and the button's exact
label. Use this block only for real requests, never for status. Don't call
anything "waiting on you" unless you have actually stopped for it. If you are
carrying on in the meantime, end the block with *(I'll keep going meanwhile.)*

---

## Rules you must follow throughout

1. **Everything the attendee creates goes on their own fork.** Never create an
   issue, pull request, comment or label on `EqualExperts/nam-2026-conference`.
   Every attendee does this exercise at the same time; one stray ticket on the
   shared repo is everyone's noise. The fork is `<you>/nam-2026-conference`,
   where `<you>` is the GitHub account found in step 2.
2. **Never pass `-R` / `--repo` naming any repo other than the fork** for a
   write, and never `cd` into a checkout of the original to "make it work".
3. **The fork guard is authoritative.** Once the repo is cloned,
   `.claude/settings.json` runs `scripts/fork-guard.mjs` as a hook before
   commands that create issues or pull requests. If it blocks something, you are
   in the wrong checkout or `gh` is not pinned — go back to step 6. Do not work
   around it.
4. **Credentials belong to the person.** Never ask for, type, store or echo a
   password, token or API key. Anything that prompts for a password, an
   administrator approval, a browser login or a click is done **by the person**:
   give them the exact command. In Claude Code they can run a command themselves
   by typing it with a leading `!` (e.g. `! gh auth login`) — the output then
   appears in your context.
5. **Do not add** an `ANTHROPIC_API_KEY` secret or the `ready-for-ai` label. The
   workshop runs the agents from Claude on the laptop, not on GitHub Actions.
6. **Do not use `sudo`** yourself. If something genuinely needs it, hand the
   command to the person.
7. **A check that finds "not done yet" is not an error, so don't let it look
   like one.** A command that exits non-zero shows up as a red *Error* to the
   person, even when the result is expected. Write each probe so it always exits
   0 and prints a plain answer: send stderr to `/dev/null`, end it with
   `|| echo "<what that means>"`, and end any batch of probes run together
   with `true`. The checks below are already written this way. Keep that shape
   when you combine or adapt them. Save real errors for real failures.

---

## Step 0 — Can you run commands at all?

**Check:** run `echo ok`.

- If you have no shell tool (for example a plain chat with no Bash/terminal
  tool), stop and tell the person: *"I need to run commands to do this. Please
  open this in Claude Code (the `claude` command in a terminal) or the Code tab
  of Claude Desktop, and ask me again."* Do nothing else.

## Step 0b — Does the person have a GitHub account?

Developers at the workshop have one; product managers and others often do not.
Everything the exercise makes lives on GitHub, so find out now — not after ten
minutes of installing.

**Check:** `gh auth status 2>&1`. If it shows `✓ Logged in to github.com`, they
have an account: mark the row ✅ with the account name and go on. (A missing
`gh` or "not logged in" proves nothing yet.)

**Do:** ask — this is the first of the two questions:

> *"Do you have a GitHub account? You'll need one — the workshop's tickets and
> pull requests live there."*
> - **Yes** — carry on; they sign in at Step 3.
> - **No, I'll make one now** — free, about two minutes.
> - **No — I'll team up with someone who has one**

- **Yes:** ✅ and carry on.
- **Make one now:** 🙋. Tell them: open https://github.com/signup, use any email
  they can read now (work or personal), pick the **Free** plan, and confirm the
  email GitHub sends — an unconfirmed account cannot fork. Carry on with Steps 1
  and 2 while they do it; they sign in at Step 3. Mark ✅ when they say it is
  done.
- **Team up:** stop here. Tell them: *"No problem — pair with a developer, or
  anyone with a GitHub account, and run the exercise together on their laptop,
  signed in as them. Please don't type their password here; work at their
  machine instead. Or come back to me any time once you've made an account at
  https://github.com/signup."* Do nothing else on this machine.

Never create the account for them, and never ask for, or accept, anyone's
password (rule 4).

## Step 1 — Identify the operating system and shell

**Check:** run

```bash
uname -s 2>/dev/null; uname -m 2>/dev/null; echo "OSTYPE=$OSTYPE"; echo "SHELL=$SHELL"
```

Classify:

| Output contains | Platform | Notes |
| --- | --- | --- |
| `Darwin` and `arm64` | **macOS, Apple Silicon** | Homebrew prefix `/opt/homebrew` |
| `Darwin` and `x86_64` | **macOS, Intel** | Homebrew prefix `/usr/local` |
| `MINGW`, `MSYS` or `CYGWIN`, or `OSTYPE=msys` | **Windows, Git Bash** | Claude Code on Windows runs commands here |
| `Linux` and `/proc/version` mentions `microsoft` | **Windows, WSL** | Treat as Linux, but warn: a browser opened by `npm run dev` lives on the Windows side |
| `Linux` otherwise | **Linux** | |

If none of these commands work but `$PSVersionTable` does, you are in
**PowerShell**: the commands below are written for bash — ask the person to
start Claude Code from Git Bash, or translate each command carefully (`$(...)`,
`&&`, `grep` and `export` do not exist as such in PowerShell).

Remember the platform; later steps branch on it.

## Step 2 — Install the tools

Three tools are required. Check all three first:

```bash
git --version
gh --version
node -v
```

Requirements: **git** any version; **gh** (the GitHub CLI) any version;
**node must be `v22.x`** — the repo pins 22 in `.nvmrc` and is tested on nothing
else. A newer Node (23, 24…) can break the native SQLite module
(`better-sqlite3`); do not "make do" with it.

Install only what is missing or wrong, following your platform below.

**After installing anything:** a program's folder is usually only added to
`PATH` for *new* shells. If a tool you just installed reports "command not found",
first try the platform's PATH fix below; if that does not help, ask the person to
quit and restart Claude (or open a new terminal and start `claude` again), then
resume this procedure from Step 2 — the checks will skip what is already done.

### macOS

1. **git.** If `git --version` fails or opens a dialog: run `xcode-select --install`.
   A system dialog appears — the person must click **Install** and accept the
   licence; it takes several minutes. Wait for them to say it finished, then
   verify `git --version`.
   - *If it says "command line tools are already installed"* but git still fails:
     ask the person to run `! sudo xcode-select --reset` (needs their password).
2. **Homebrew** (the macOS package manager). Check `brew --version`.
   - If missing, the person runs (it asks for their Mac password and may take
     several minutes):
     `! /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
   - Then put brew on PATH for this shell and future ones — use the prefix from
     Step 1:
     ```bash
     eval "$(/opt/homebrew/bin/brew shellenv)"        # Intel: /usr/local/bin/brew
     grep -q 'brew shellenv' ~/.zprofile 2>/dev/null || echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
     brew --version
     ```
   - *If the person's laptop is managed and they are not an administrator*, the
     installer fails. Use the official installers instead (they need no
     Homebrew): gh from https://cli.github.com (a `.pkg`), Node
     22 from https://nodejs.org/en/download (choose **v22**, macOS installer).
3. **gh:** `brew install gh`, then verify `gh --version`.
4. **Node 22:** `brew install node@22`. Homebrew does not put a versioned Node on
   PATH by itself, so:
   ```bash
   NODE22="$(brew --prefix node@22)/bin"
   export PATH="$NODE22:$PATH"
   grep -q 'node@22' ~/.zprofile 2>/dev/null || echo "export PATH=\"$NODE22:\$PATH\"" >> ~/.zprofile
   node -v      # → v22.x
   ```
   - *If `node -v` still shows another version* (an older nvm, Volta or a
     nodejs.org install is earlier on PATH): run `which -a node` to see them all.
     If `nvm` exists (`command -v nvm` or `~/.nvm` exists), prefer
     `nvm install 22 && nvm use 22 && nvm alias default 22` and skip the brew Node.

### Windows (Git Bash)

Claude Code on Windows needs Git for Windows, so git is usually present already.
`winget` (the Windows package manager) is callable from Git Bash.

1. **git** (only if missing): `winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements`
2. **gh:** `winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements`
3. **Node 22** — use **nvm-windows**, so the version is exact:
   - `winget install --id CoreyButler.NVMforWindows -e --source winget --accept-package-agreements --accept-source-agreements`
   - Switching Node versions with nvm-windows needs an **administrator** shell.
     Ask the person to open *PowerShell as Administrator* (Start menu → type
     "PowerShell" → right-click → *Run as administrator*) and run:
     `nvm install 22` then `nvm use 22`.
   - *If Node is already installed at another version from nodejs.org*, nvm-windows
     may conflict with it: ask the person to uninstall "Node.js" from *Settings →
     Apps* first.
4. Ask the person to **restart Claude** (close the terminal, open a new Git Bash,
   run `claude`), because winget changes PATH only for new shells. Resume at
   Step 2 and verify all three tools.
- *If `winget` is not found:* it ships with Windows 10 1809+ and 11 as "App
  Installer" from the Microsoft Store. Otherwise use the official installers:
  https://git-scm.com/download/win, https://cli.github.com, and Node **22** from
  https://nodejs.org/en/download.

### Linux / WSL

Use the distribution's package manager for git (`sudo apt-get install -y git` —
the person runs it). For gh follow https://github.com/cli/cli/blob/trunk/docs/install_linux.md.
For Node 22 use nvm, which needs no sudo:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"
nvm install 22 && nvm alias default 22
node -v   # → v22.x
```

**Verify Step 2:** `git --version && gh --version && node -v` all succeed and
Node prints `v22.`.

## Step 3 — Sign in to GitHub

**Check:** `gh auth status`. Passing looks like `✓ Logged in to github.com account <name>`.

**Do:** the person runs `! gh auth login` and answers: *GitHub.com* → *HTTPS* →
*Yes* (authenticate Git with GitHub credentials) → *Login with a web browser*.
It shows a one-time code and opens the browser; they paste the code and approve.

**Verify:** `gh auth status` passes. Then record the account:

```bash
gh api user --jq .login        # this is <you> for every later step
```

- *If several accounts are logged in*, `gh auth status` marks one *Active*; use
  it. Step 4's question shows it to the person, which is their chance to say
  otherwise (then they run `! gh auth switch`).
- *If `gh api user` fails with SSO or 403 errors*, the token is restricted;
  the person re-runs `! gh auth login`.

Also make sure git can commit as them (ship makes commits):

```bash
git config --global user.name  || echo "missing name"
git config --global user.email || echo "missing email"
```

If either is missing, take them from the GitHub account — the name on the
profile (falling back to the login) and GitHub's private no-reply address, which
links commits to the account without exposing a real email:

```bash
NAME=$(gh api user --jq '.name // .login'); ID=$(gh api user --jq .id); LOGIN=$(gh api user --jq .login)
git config --global user.name  >/dev/null || git config --global user.name  "$NAME"
git config --global user.email >/dev/null || git config --global user.email "$ID+$LOGIN@users.noreply.github.com"
```

Never overwrite values that are already set.

## Step 4 — Fork the repository and turn on Issues

**The other question — where to fork to.** If the person already said where
(for example "set me up and fork it to my-org", or named an account), use that
and do not ask. Otherwise list the options and ask:

```bash
gh api user --jq .login                      # the signed-in personal account
gh api user/orgs --jq '.[].login'            # organisations it belongs to (may be empty)
gh auth status 2>&1 | grep -E 'account|Active'   # every account gh is signed in to
```

> *"Where should I fork the workshop repo to — your personal account
> **<login>** (recommended), or …?"* — list the organisations, and any other
> signed-in personal accounts, as the alternatives.

Their answer is `<you>` from here on: a personal account or an organisation.

### 4a — Check you are allowed to fork there, before forking

Run all of these; fix any that fail before Step 4's **Do**. Each fix is the
person's (a browser login), so give them the exact command.

1. **The token has the scopes the setup needs** — `repo` (fork, change the
   fork's settings) and `workflow` (run *Set up the harness*):
   ```bash
   gh api -i user 2>/dev/null | grep -i '^x-oauth-scopes'   # must list repo and workflow
   ```
   If either is missing: the person runs `! gh auth refresh -h github.com -s repo,workflow`.
   (A fine-grained token prints no scopes line; gh's own browser login always
   does — if there is no line, have the person run `! gh auth login` as above.)

2. **If `<you>` is a personal account, gh must be signed in as that account** —
   you can only fork into the account you are acting as:
   ```bash
   [ "$(gh api user --jq .login)" = "<you>" ] && echo "acting as <you>: ok"
   ```
   If not: if `gh auth status` lists `<you>` among the signed-in accounts, run
   `gh auth switch -h github.com -u <you>` yourself (it needs no password).
   Otherwise the person signs in as that account: `! gh auth login` (Step 3's
   answers). Then re-run this check and check 1.

3. **If `<you>` is an organisation**, the signed-in account must be an active
   member allowed to create repositories in it:
   ```bash
   gh api user/memberships/orgs/<you> --jq '"state=\(.state) role=\(.role)"'      # state=active
   gh api orgs/<you> --jq '"create_public=\(.members_can_create_public_repositories)"'
   ```
   Passing: `state=active`, and either `role=admin` or `create_public=true`.
   `create_public=null` means the token cannot read that setting (it needs the
   `admin:org` scope, which members rarely have) — treat it as *unknown*: carry
   on, and if the fork in Step 4 fails with 403, that setting was false.
   - *`state=pending`*: the person has an unaccepted invitation — they accept it
     at `https://github.com/orgs/<you>/invitation`.
   - *404*: not a member. *`create_public=false` (or the fork fails with 403) and
     not admin*: the organisation does not let members create repositories. In
     both cases tell the person and offer their personal account instead — this
     is the same question, asked again.
   - *A 403 mentioning SAML or SSO*: the organisation requires single sign-on
     for the token. The person runs `! gh auth refresh -h github.com -s repo,workflow`
     and, in the browser page that opens, clicks **Authorize** next to the
     organisation.

4. **The name is free, or already the right fork:**
   ```bash
   gh repo view <you>/nam-2026-conference --json isFork,parent \
     --jq '"fork=\(.isFork) parent=\(.parent.owner.login)/\(.parent.name)"' 2>/dev/null \
     || echo "name free"
   ```
   `name free` means free; `fork=true parent=EqualExperts/nam-2026-conference`
   means it was already forked (fine — Step 4 reuses it); anything else is a
   different repository with that name (see *If it fails* below).

Only when all four pass, carry on.

**Check:**

```bash
gh repo view <you>/nam-2026-conference --json isFork,parent,hasIssuesEnabled \
  --jq '"fork=\(.isFork) parent=\(.parent.owner.login)/\(.parent.name) issues=\(.hasIssuesEnabled)"' \
  2>/dev/null || echo "not forked yet"
```

Passing: `fork=true parent=EqualExperts/nam-2026-conference issues=true`.

**Do:**

```bash
gh repo fork EqualExperts/nam-2026-conference --clone=false          # organisation: add --org <you>
gh api -X PATCH repos/<you>/nam-2026-conference -F has_issues=true --jq .has_issues   # → true
gh api repos/<you>/nam-2026-conference --jq .permissions.admin       # → true: you can change its settings and run its workflows
```

A fork starts with **Issues off**; the attendee's tickets go there, so it must
be on.

- *If the fork already exists*, `gh repo fork` says so — fine, continue.
- *If `<you>/nam-2026-conference` exists but is not a fork* (`fork=false`), it is
  an unrelated repository with the same name. Do not touch it: fork under another
  name with `gh repo fork EqualExperts/nam-2026-conference --clone=false
  --fork-name nam-2026-conference-workshop` and use that name wherever
  `nam-2026-conference` follows `<you>/` below.
- *If the PATCH returns 404 or 403*, the gh token lacks the `repo` scope: the
  person runs `! gh auth refresh -s repo` and you retry.

## Step 5 — Clone the fork

Clone into the folder this session was started in, so you can read and run
the clone from here without a restart (Step 10). Do not ask where — tell the
person where it went at the end. Call that absolute path `<clone>`, and take
the first rule that fits:

1. The session folder already is a clone whose `origin` is the fork → `<clone>`
   is the session folder; there is nothing to clone. Probe it with
   `git remote get-url origin 2>/dev/null || echo "not a clone"`, not with a
   bare `git` command that fails with *fatal: not a git repository*.
2. The session folder is empty (`ls -A` prints nothing) → `<clone>` is the
   session folder itself.
3. Anything else, the home folder included → `<clone>` is
   `<session folder>/nam-2026-conference`.

If the session folder cannot be written to (`/`, a system folder), use
`~/nam-2026-conference`. Shell state does not carry between commands, so write
`<clone>` out in full in every command below.

**Check:**

```bash
git -C <clone> remote get-url origin 2>/dev/null || echo "not cloned yet"
```

Passing: a URL ending in `<you>/nam-2026-conference.git` (or without `.git`).

**Do** (only if `<clone>` does not exist, or is the empty session folder):

```bash
gh repo clone <you>/nam-2026-conference <clone>
```

- *If the folder exists but `origin` is anything other than the fork* (for
  example a clone of the original `EqualExperts/nam-2026-conference`), leave it
  untouched and clone the fork to `<clone>-fork` instead; if that is taken too,
  add `-2`, `-3`… That folder is `<clone>` from here on; tell the person at the
  end why their existing folder was not used.
- Never delete, move or modify an existing folder.

From here on, **run every command inside the clone folder**
(`cd <clone>` first, or `git -C`).

## Step 6 — Pin `gh` to the fork

`gh repo clone` of a fork adds a second remote, `upstream`, pointing at
EqualExperts — and `gh` run without a terminal prefers `upstream`. Unpinned,
every `gh` command would read and write the original repo.

**Check:**

```bash
cd <clone>
gh repo set-default --view 2>/dev/null || echo "not set"   # must print <you>/nam-2026-conference
```

**Do:**

```bash
gh repo set-default "$(git remote get-url origin)"
```

**Verify:** `gh repo set-default --view` prints `<you>/nam-2026-conference`, and
`node scripts/fork-guard.mjs && echo "fork guard: ok"` prints `fork guard: ok`.
Do not continue until both pass.

## Step 7 — Turn on Actions (the person clicks)

A fork starts with its workflows **paused**, and GitHub offers no API to resume
them.

**Check:**

```bash
gh api repos/<you>/nam-2026-conference/actions/workflows --jq .total_count   # passing: greater than 0
```

**Do:** ask the person to open
`https://github.com/<you>/nam-2026-conference/actions` in their browser and click
the green button **I understand my workflows, go ahead and enable them**. This is
the one click. Ask for it once, in the **👉 Your turn** block, ending with
*(I'll keep going meanwhile.)* Do not ask them to tell you when they're done, and do not repeat
the request.

Do not wait for a reply. Step 9 does not need Actions, so run it now: mark this
row 🙋 and that one 🔄. When Step 9 finishes, run this step's check yourself.
If it passes, mark the step ✅ and go on to Step 8 without saying anything
about it. Only if it still fails, show the 🙋 row again with the
**👉 Your turn** block. (`total_count` can take a few seconds to update after
the click; retry once or twice before you ask again.)

## Step 8 — Set up the harness (creates the labels)

`/ship` labels issues as it works (`ai-working`, `ready-for-human`,
`needs-human`). A fork does not inherit labels; this workflow creates them.

**Check:**

```bash
gh label list -R <you>/nam-2026-conference --limit 100 --json name --jq '.[].name' \
  | grep -c -x -E 'ready-for-ai|ai-working|ready-for-human|needs-human'   # passing: 4
```

**Do:**

```bash
gh workflow run setup.yml -R <you>/nam-2026-conference
sleep 5
RUN=$(gh run list -R <you>/nam-2026-conference --workflow setup.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN" -R <you>/nam-2026-conference --exit-status
```

**Verify:** the check prints `4`.

- The run's summary lists the `ANTHROPIC_API_KEY` secret as *optional*. That is
  expected; do **not** add one (rule 5).
- *If `gh workflow run` says the workflow is not found or disabled*, Step 7 was
  not done.
- *If it says "HTTP 403: Must have admin rights"*, the active gh account is not
  the fork's owner — recheck Step 3.

## Step 9 — Install and test the app

```bash
cd <clone>
npm install
npx playwright install chromium
npm test
```

**Verify:** `npm test` ends with `# fail 0`. It takes a few seconds.

- *`npm install` fails building `better-sqlite3`* (errors mention `node-gyp`,
  `prebuild` or a compiler): Node is not 22 — fix Step 2, then
  `rm -rf node_modules && npm install`.
- *Errors like `SELF_SIGNED_CERT_IN_CHAIN` or `unable to get local issuer
  certificate`*: a corporate proxy is intercepting HTTPS. Look for the
  company's root certificate where such tools usually put it (on macOS, export
  it from the System keychain: `security find-certificate -a -p
  /Library/Keychains/System.keychain > ~/corp-ca.pem`), set
  `export NODE_EXTRA_CA_CERTS=~/corp-ca.pem` and retry. If that does not help,
  tell the person their network blocks the install and that their IT team's
  certificate is needed. Never disable TLS checking (`strict-ssl false`).
- *On Linux, Playwright complains about missing libraries*: the person runs
  `! sudo npx playwright install-deps chromium`.
- *A test fails*: re-run `npm test` once. If it fails the same way, report the
  failing test's name and first error lines in the final summary — say plainly
  that setup finished with a failing test rather than declaring success.

Do not start `npm run dev` as part of setup. Mention at the end that it starts
the app at http://localhost:5173.

## Step 10 — Working in the clone

The workshop's commands — `/winnow`, `/create-tasks`, `/ship`, `/code-review`,
`/qa` — the project's agent types (`.claude/agents/`, e.g. `ship-rote`) and the
fork-guard hook come from `<clone>/.claude/`. A clone made inside the session's
folder (Step 5) is often picked up by the running session without a restart —
but not always, so test it rather than assume either way.

**Check — commands:** is `ship` among the commands (skills) you can run, and
`ship-rote` among the agent types you can start? You can see both lists.

**Check — hook:** run, from `<clone>`:

```bash
true || gh issue edit 0 --add-label ready-for-ai
```

`true ||` means `gh` never runs, so this touches nothing. Blocked with the fork
guard's message (*adding the ready-for-ai label…*) → the hook is live. It just
runs → the hook is not loaded. This is the one block that is expected — rule 3
does not apply to it. Use this probe, not a create on the upstream repository:
the fork guard lets the workshop's maintainers create there, so that probe
passes for them even with the hook live; the label rule blocks everyone.

**Both pass:** nothing to restart. Tell the person they can carry on in this
session, and to run `/setup-winnow` and answer **no** to audio.

**Only `ship-rote` is missing** (`ship` is listed and the hook blocks): do
not ask for a restart. `/ship` works from this session. Its first rote step
shows one red ✗ (*agent type 'ship-rote' not found*), and the rest run as plain
agents, which is a bit slower. Mention it only as the 💡 tip in the *Done*
hand-off, without naming the agent type.

**`ship` is missing or the hook does not block — Do:** a restart loads them. If `<clone>` is the session folder
(rule 2 of Step 5), tell the person: type `/exit`, then `claude --continue` in
the same terminal — it picks this conversation back up with the commands
loaded. Otherwise tell them exactly:

> Setup is done. To load the workshop's commands, quit Claude and start it
> again in the project folder: in a terminal, `cd <clone> && claude` (or in
> Claude Desktop, open the folder `<clone>`). In the new session, run
> `/setup-winnow` and answer **no** to audio.

Without the agent type, `/ship`'s first rote step fails with *agent type
'ship-rote' not found* — a red ✗ in `/workflows` — and every rote step after it
runs as a plain agent: slower, and heavier on context.

**Only if they want `/ship` before restarting:** it does run from this session,
because Step 5 put `<clone>` inside the session folder — use the Workflow tool
with `scriptPath` `<clone>/.claude/workflows/ship.js` and args
`{ "issue": <n>, "notes": "The checkout is <clone>; cd there first." }`. Tell
the person first that one *'ship-rote' not found* failure, followed by a
retry, is expected. Its setup pins
`gh` and runs `scripts/fork-guard.mjs` before it touches the ticket, so it
stays on the fork without the hook; anything else that creates an issue or pull
request from this session runs `node scripts/fork-guard.mjs` in `<clone>`
first — nothing else is watching.

**Verify** (after a restart): both checks pass in the new session.

Claude Code may ask the person to **trust the folder** and to approve the
project's hook the first time — they should accept; the hook is the fork guard.

## Done — final checklist

Run these from the clone folder and confirm each before telling the person they
are ready:

```bash
cd <clone>
node -v                                    # v22.x
gh repo set-default --view                 # <you>/nam-2026-conference
git remote get-url origin                  # …/<you>/nam-2026-conference(.git)
node scripts/fork-guard.mjs && echo ok     # ok
gh api repos/<you>/nam-2026-conference --jq .has_issues               # true
gh label list --json name --jq '.[].name' | grep -c -x -E 'ai-working|ready-for-human|needs-human|ready-for-ai'   # 4
npm test 2>&1 | grep -E '^# fail'          # # fail 0
```

Then show the final board (**🚀 ORBIT '26 — ready for launch** · 11 of 11)
and, under it, a short, warm hand-off in this shape. Fill in the real values.
Leave out a line that doesn't apply.

> 🎉 **You're ready for launch!** Everything is set up and checked.
>
> - 📁 **Your project:** `<clone>`
> - 🌐 **Your copy on GitHub:** https://github.com/<you>/nam-2026-conference.
>   Everything you make today goes here, and nothing goes to the shared repo.
> - ▶️ **See the app:** run `npm run dev` in that folder, then open
>   http://localhost:5173
>
> **Your first move:** type `/setup-winnow` and answer **no** when it asks
> about audio. After that:
>
> 1. `/winnow docs/demo/winnow-transcript.txt` turns a sample conversation
>    into tickets. Or try `/create-tasks <one line describing a feature>`.
> 2. `/ship <ticket number>` builds one of them for you, all the way to a pull
>    request.
>
> 📖 New to this? `docs/harness/quickstart.md` walks you through it.
>
> 💡 *Tip: for the fastest `/ship`, type `/exit` and then `claude --continue`.
> It reloads this conversation with everything in place.*

- Include the 💡 tip only when Step 10 found just `ship-rote` missing. Don't
  name the agent type or describe the red ✗.
- When Step 10's command or hook check failed, the restart isn't optional.
  Replace **Your first move** with that restart, using Step 10's exact words,
  and put `/setup-winnow` after it.
- Don't list the commands that now work, mention the fork guard, or say that
  you reran the checks. The board already says so.
