<div align="center">

# The AI Engineering Harness

**From a conversation to a reviewed pull request — fork it, set it up, ship a ticket**

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

On GitHub, once per fork, in this order — step 3 tells you if you missed anything:

1. **Fork the repo, then turn on Issues** — Settings → General → Features → *Issues*.
2. **Add the API key** — Actions secret `ANTHROPIC_API_KEY`, a **workspace** key.
   Only needed for the agents on GitHub Actions; from your terminal, Claude Code
   uses your own sign-in.
3. **Run Actions → *Set up the harness*** — creates the labels and checks the key.
4. **Let Actions open pull requests** — Settings → Actions → General → Workflow permissions.

Keys, tokens and triggers in detail: [docs/harness/github.md](docs/harness/github.md).

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
