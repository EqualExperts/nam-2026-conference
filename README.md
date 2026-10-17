<div align="center">

# The AI Engineering Harness

**From GitHub issue to reviewed pull request — built live on ORBIT '26**

</div>

## 🎬 Watch the talk

**[orbit26.up.railway.app/engineering-presentation](https://orbit26.up.railway.app/engineering-presentation)**
— the engineering harness from a ticket to a merged pull request, in 26 beats.
→ or Space to advance, ← to go back, **F** for full screen, `?beat=12` to resume.

Locally: `npm install && npm run dev`, then <http://localhost:5173/engineering-presentation>.

- **[How it works, step by step](docs/harness/README.md)** — every agent, every check, and why it is there.
- **[Workshop quickstart](docs/harness/quickstart.md)** — set up once, then one walkthrough per harness.

## 🎙️ From meeting to ticket

The harness builds tickets — but a ticket can start as a conversation. The
product-side skills, from Abraham's [winnow](https://github.com/quiram/winnow),
turn a meeting or a voice note into issues that are ready to ship:

| Step | Skill | What you get |
| --- | --- | --- |
| 🎧 **Listen** | `listen-to-meeting` | A live transcript, and a flag the moment two people contradict each other or leave something unsaid |
| ✍️ **Transcribe** | `transcribe-audio` | A voice note or recording turned into text on your machine — no hosted service |
| 🧠 **Distil** | `winnow` | The decisions and the work pulled out of the noise, with gaps and conflicts raised for you to agree |
| 🎫 **Raise** | `create-tasks` | GitHub issues — one goal each, no duplicates, each with a **Done when** list |
| 📚 **Remember** | `update-context` | What was agreed written back into the docs the agents read |

No meeting of your own? `/winnow docs/demo/winnow-transcript.txt` runs it on the
[demo transcript](docs/demo/winnow-transcript.txt). First time, run `/setup-winnow`.
Then label the issues `ready-for-ai`, or `/ship` them.

<a id="set-up-your-fork"></a>

## ⚙️ Set up your fork

Once per fork, in this order — step 3 tells you if you missed anything.

1. **Turn on Issues** — Settings → General → Features → *Issues*.
2. **Add the API key** — Actions secret `ANTHROPIC_API_KEY`, a **workspace** key.
3. **Run Actions → *Set up the harness*** — creates the labels and checks the key.
4. **Let Actions open pull requests** — Settings → Actions → General → Workflow permissions.

Keys, tokens and triggers in detail: [docs/harness/github.md](docs/harness/github.md).

## 🎪 The app it builds

The harness needs something real to work on, so this repo is also **ORBIT '26**,
a companion app for a fictional AI conference — seats and waitlists, clashing
sessions, check-in windows, ratings, and a clock that runs.
**[More about the app →](docs/APP.md)**

## 📚 Read next

- **[CLAUDE.md](CLAUDE.md)** — the rules people and agents both work to.
- **[docs/context/](docs/context/README.md)** — the map agents read instead of the source.
- **[specs/](specs/)** — one plan per ticket, written before the code.

## 🙌 Credits

The ship loop at the heart of this is **Andy Vays**'s design. Built by **Jonas
Claesson** and **Abraham Marín Pérez** at Equal Experts.
