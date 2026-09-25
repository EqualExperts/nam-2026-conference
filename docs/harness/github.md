# The harness on GitHub

Why the workflows in `.github/workflows/` are wired the way they are. None of
this matters to an agent building the app; all of it matters to whoever
changes the harness, and most of it was learned the hard way.

## Setting it up on a fork

A fork inherits the workflows and the skills but **not the labels**, and
`ready-for-ai` is what starts everything — so on a fresh fork, labelling an
issue does nothing and nothing says why.

Actions → **Set up the harness** → Run workflow. It creates the four labels and
writes a summary saying what else the fork needs: an `ANTHROPIC_API_KEY`
secret **scoped to a workspace** (an organisation-level key is rejected, and
the error does not say which kind to make), and optionally an
`AGENT_GITHUB_TOKEN`.

## When the passes run

They run when a pull request **opens**, and again if it is marked ready for
review — but never on a push. One pull request costs one pass of each.
`synchronize` was the expensive part: it charged for a full review on every
commit, so a fourteen-commit branch paid fourteen times over for one change.
To ask for another look after pushing fixes, put the pull request back to
draft and mark it ready again.

Both passes publish a verdict carrying a **confidence**, which means coverage
rather than feeling: how much of the change the agent could actually exercise
or judge. A high-confidence pass is green, a low-confidence one publishes as
*unproven* — a pass nobody could earn should not read like one.

Code review and QA trigger on the pull request itself. An earlier design keyed
off the build workflow finishing, which cannot work: a build started by an
`issues` event reports its `head_branch` as `main`, so looking up the pull
request by branch found nothing and neither pass ever ran.

**`pull_request` does fire for a pull request the agent opened**, even though
that pull request is created with `GITHUB_TOKEN`. This gets re-derived wrongly
about once a week, because the well-known rule — GitHub does not trigger
workflows from `GITHUB_TOKEN` actions — sounds like it should apply and does
not. Verified on PR #22, opened by `github-actions[bot]` with no
`AGENT_GITHUB_TOKEN` set: `verify` ran on it twice, `event=pull_request`.

What does happen is that every run on it sits at **`action_required`** until
somebody clicks *Approve workflows to run*. Verified on a brand-new repository
in a personal account with no organisation policy of any kind: three workflows
waiting. This is GitHub's behaviour for anything `github-actions[bot]` opens
and there is no setting that turns it off.

`AGENT_GITHUB_TOKEN` is the only way around it — the pull request is then
authored by a person, so nothing is gated. Keeping the click instead is a
defensible choice: it is a human checkpoint before any agent work runs.

