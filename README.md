<div align="center">

# ORBIT '26

**A workshop on AI across the software delivery lifecycle — from a conversation to a reviewed pull request**

</div>

This repo is a working app (**ORBIT '26**, a conference companion) wired to two
AI harnesses: a **product harness** that turns a conversation into a GitHub
issue, and an **engineering harness** that turns that issue into a reviewed pull
request. My Agenda is deliberately blank — building it is the workshop.

## 📺 The two talks

Watch them in order:

1. [🎙️ **The product harness**](https://orbit26.up.railway.app/product-presentation) — a conversation → a ticket
2. [🚢 **The engineering harness**](https://orbit26.up.railway.app/engineering-presentation) — a ticket → a pull request

→ or Space to advance, **F** for full screen.

<a id="set-up-your-fork"></a>

## 1. ⚙️ Set up your fork

On GitHub, once per fork, in this order:

1. **Fork the repo, then turn on Issues** — a fork starts with them off:
   Settings → General → Features → *Issues*. Your tickets go here.
2. **Turn on Actions** — a fork starts with its workflows paused: open the
   **Actions** tab and click *I understand my workflows, go ahead and enable them*.
3. **Run Actions → *Set up the harness*** → *Run workflow* — creates the labels
   `/ship` puts on your issues. Its summary lists anything else missing.

That is all the workshop needs: you run the agents from Claude Code on your
laptop, signed in as yourself.

<details>
<summary><b>Optional — run the agents on GitHub Actions too</b></summary>

The same agents can run in the cloud: label an issue `ready-for-ai` and one
ships it, and every pull request gets a code review and QA pass. The workshop
demos this on the main repo; to have it on your fork as well:

- **Add the API key** — Actions secret `ANTHROPIC_API_KEY`, a **workspace** key.
- **Let Actions open pull requests** — Settings → Actions → General → Workflow
  permissions → *Allow GitHub Actions to create and approve pull requests*.

Without the key, the 🔍 code review and 🧪 QA checks on your fork's pull
requests fail straight away. That is expected: run `/code-review 42` and
`/qa 42` from Claude Code instead.

Keys, tokens and triggers in detail: [docs/harness/github.md](docs/harness/github.md).

</details>

## 2. 💻 Set up your laptop

You need [Claude Code](https://docs.claude.com/en/docs/claude-code/overview)
(signed in), Node 22 (`nvm use`) and the [GitHub CLI](https://cli.github.com)
(`gh auth login`).

```bash
gh repo clone <you>/nam-2026-conference && cd nam-2026-conference
gh repo set-default "$(git remote get-url origin)"   # keep gh on your fork, not the original
npm install
npx playwright install chromium   # the browser the tests run in
npm run dev                       # optional: the app on http://localhost:5173
```

Then start Claude Code in the folder (`claude`) and run **`/setup-winnow`**. Say
**no** to audio unless you want to capture a live meeting (it needs `uv` and a
~500 MB model).

## 3. ▶️ Go

The **[workshop quickstart](docs/harness/quickstart.md)** walks through both
harnesses: turning a conversation into tickets, then shipping a ticket to a
pull request — from your terminal or from GitHub alone.

## Read next

- **[How the harness works](docs/harness/README.md)** — every agent, every check, and why it is there.
- **[The app](docs/APP.md)** — what ORBIT '26 does; **[CLAUDE.md](CLAUDE.md)** — the rules people and agents both work to.

## 🙌 Credits

The ship loop at the heart of this is **Andy Vays**'s design. Built by **Jonas
Claesson** and **Abraham Marín Pérez** at Equal Experts. The product-side skills
are Abraham's [winnow](https://github.com/quiram/winnow).
