<div align="center">

# ORBIT '26

**A workshop on AI across the software delivery lifecycle**

[▶️ Try the app](https://orbit26.up.railway.app/)

</div>

A conference app wired to two AI harnesses: one turns a conversation into a
ticket, the other turns the ticket into a reviewed pull request. My Agenda is
blank — building it is the workshop.

## 📺 Watch

The three talks, in the order they're given — the opening sets out why the day is
built around shared context and parallel work, then each harness gets its own.

1. [🛰️ Welcome to NAM 2026](https://orbit26.up.railway.app/opening-presentation) — the opening: shared context and parallel work
2. [🎙️ The product harness](https://orbit26.up.railway.app/product-presentation) — a conversation → a ticket
3. [🚢 The engineering harness](https://orbit26.up.railway.app/engineering-presentation) — a ticket → a pull request

## 🚀 Set up

Start [Claude Code](https://docs.claude.com/en/docs/claude-code/overview), copy
this and paste it in:

```text
Set me up for the Equal Experts workshop. Read https://raw.githubusercontent.com/EqualExperts/nam-2026-conference/main/ONBOARD_CLAUDE.md and follow it step by step.
```

**Claude will** install what's missing (git, the GitHub CLI, Node 22), fork this
repo, clone your fork and run the tests.
**It asks** whether you have a GitHub account (no account? it helps you make
one, or pair with someone who has one) and where to fork to — and needs you only
to sign in to GitHub, type a password if an installer wants one, and click once
to turn on Actions. A checklist shows how far along you are.
([Every step](ONBOARD_CLAUDE.md))

<a id="set-up-your-fork"></a>

<details>
<summary>Or set up by hand</summary>

1. Fork this repo; turn on **Issues** (Settings → General → Features).
2. **Actions** tab → *I understand my workflows, go ahead and enable them*.
3. **Actions → *Set up the harness* → Run workflow**.
4. With Node 22 and the [GitHub CLI](https://cli.github.com):

   ```bash
   gh repo clone <you>/nam-2026-conference && cd nam-2026-conference
   gh repo set-default "$(git remote get-url origin)"
   npm install && npx playwright install chromium
   claude
   ```

</details>

Then `/winnow` turns a conversation into tickets and `/ship 42` builds one —
the [workshop quickstart](context/engineering-context/harness/quickstart.md) walks through both.
Both read and write [`context/`](context/index.md): the product and engineering
knowledge they share, and the conversations Winnow works from.
