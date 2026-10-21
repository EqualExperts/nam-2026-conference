<div align="center">

# The AI Engineering Harness

**From a conversation to a reviewed pull request — fork it, set it up, ship a ticket**

</div>

This repo is a working app (**ORBIT '26**, a conference companion) wired to two
AI harnesses: a **product harness** that turns a conversation into a GitHub
issue, and an **engineering harness** that turns that issue into a reviewed pull
request. Fork it and you can run both on your own copy in under an hour.

**How it works:** watch the two talks, in order —
[🎙️ the product harness](https://orbit26.up.railway.app/product-presentation) and
[🚢 the engineering harness](https://orbit26.up.railway.app/engineering-presentation).
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

## 3. 🎙️ Turn a conversation into a ticket

```
/winnow docs/demo/winnow-transcript.txt
```

The [demo transcript](docs/demo/winnow-transcript.txt) is a 40-second request for
a schedule change. Winnow sorts it into noise, decisions and work, asks you about
anything unclear, and writes nothing until you agree. Then it raises a GitHub
issue on your fork with a **Done when** list, and records any decisions in
`docs/`.

Other ways in: `/create-tasks <one line>` writes a ticket directly;
`/listen-to-meeting` listens to a live meeting (needs the audio setup).

## 4. 🚢 Ship the ticket

```
/ship 42
```

…with your new issue's number. It plans, writes a failing test, writes the code,
runs every test on desktop and mobile, and audits until the work is clean —
about 10–20 minutes for a small ticket. Progress is posted on the issue.

Or, with no terminal: **label the issue `ready-for-ai`** and an agent on GitHub
Actions picks it up.

## 5. ✅ Review and merge

You get a pull request with the plan, the test evidence, every audit round and
the cost; code review and QA agents comment on it. Ask for a change with
`@claude …` in a comment. **Nothing merges itself** — that is your call. A ticket
that will not come together comes back as a draft labelled `needs-human`.

## Read next

- **[Workshop quickstart](docs/harness/quickstart.md)** — the same steps in more detail, including the GitHub-only route.
- **[How the harness works](docs/harness/README.md)** — every agent, every check, and why it is there.
- **[The app](docs/APP.md)** — what ORBIT '26 does; **[CLAUDE.md](CLAUDE.md)** — the rules people and agents both work to.

## 🙌 Credits

The ship loop at the heart of this is **Andy Vays**'s design. Built by **Jonas
Claesson** and **Abraham Marín Pérez** at Equal Experts. The product-side skills
are Abraham's [winnow](https://github.com/quiram/winnow).
