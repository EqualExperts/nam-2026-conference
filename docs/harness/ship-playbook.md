# Ship playbook

How each step of a ship run is done. **This is not a command** — `/ship <n>`
runs the loop (`.claude/workflows/ship.js`), and each of its phase agents is
told which numbered sections here are theirs. Do those and nothing else: the
workflow owns the order, the loops and when to stop.

| Phase | Sections |
| --- | --- |
| Setup | §1–§3 |
| Spec | §3b |
| Implement | §4–§6 |
| Verify | §7 |
| Fix | §5's rules still hold |
| PR | §8 |
| Hand-back | §9 |
| Cleanup (laptop) | §10 |

`CLAUDE.md` is the specification for this repo — most of what looks like a
judgement call is settled there.

Every step re-reads the whole conversation, so anything you pull in early is
paid for on every step after it. Ask for the narrowest thing that answers the
question, and never run a command twice to grep it the second time.

## 1. Read the ticket

```bash
gh issue view <n> --json number,title,body,labels,state
gh pr list --state open --json number,headRefName,isDraft \
  --jq '.[] | select(.headRefName | startswith("issue-<n>-"))'
```

The **Done when:** clause is what you build, and later what you prove. Go to
step 9 and stop if the issue is closed, already has a **ready** (non-draft)
pull request, states no outcome you could write a check against, or asks for
two unrelated things. A **draft** on an `issue-<n>-*` branch is an earlier
attempt handed back: this run continues on that branch, and §8 turns the draft
into the pull request.

## 2. Claim it

```bash
gh issue edit <n> --add-label ai-working --remove-label ready-for-ai --remove-label needs-human --remove-label ready-for-human
```

`needs-human` goes too: on a retry it is left from the attempt that was
handed back, and a ticket that ships should not still say it is stuck.

## 3. Get a workspace

In a runner (`$GITHUB_ACTIONS` set) the machine is yours — just branch:

```bash
git checkout -b issue-<n>-<short-slug> origin/main
```

On a laptop, other agents may hold other tickets, so take a worktree and a
lane, or you will eventually test another branch's code and pass:

```bash
git worktree add -b issue-<n>-<short-slug> ../orbit-wt-<n> origin/main
cd ../orbit-wt-<n> && npm install
eval "$(node scripts/lane.mjs claim <n>)"
```

## 3b. Write the spec first

Before changing any code, write `specs/<n>-<short-slug>.md` and push it as the
branch's **first commit**, so a reviewer reads what you intend before the diff.
Headings: *What this changes* (in terms of what an attendee sees), *Where*
(file by file), *How it will be proved* (the check, and which layer), and only
where they apply, *Decisions* (anything the ticket left open, or got wrong) and
*Out of scope*.

Every row of *How it will be proved* must name an assertion that is **false on
main today** — run the scenario against the branch point before you write the
row. A row whose assertions all already hold (typically because it names an
absence, or a side effect the change happens to keep) proves nothing, and it
reads as proof right through the audit.

```bash
git add specs/<n>-<short-slug>.md
git commit -m "docs(spec): <the ticket's title, lower case>"
git push -u origin HEAD
gh issue comment <n> --body "Spec: <link to the file on this branch>"
```

A plan, not an essay — half a page. If writing it changes your mind about the
approach, that is the step working. It lands with the change and stays, so keep
it true: a spec that disagrees with its own pull request is worse than none.

## 4. Find the change site

```bash
node scripts/context.mjs index
```

That is the map: one entry per area of the app, saying what it covers and when
to read it. Read the one or two docs in `docs/context/` your ticket touches;
they name the functions, payloads and test ids, so you open source only for
the lines you will change. **Take their word, and `CLAUDE.md`'s, rather than
re-deriving how the repo is organised from source** — reading the Playwright
config, the test helpers or the seed to work that out is the expensive mistake
here. A doc that turns out to be wrong is a finding: fix it on your branch.

It also carries the reasoning behind decisions that look arbitrary and are
not. A change contradicting a stated decision is wrong even when it is green.

## 5. Write the check first

Derive a check from **Done when:**, at the cheapest layer that can prove it —
`CLAUDE.md` says which. Run it and confirm it is red for the reason §3b made
you predict.

- **Never edit an existing test to make it pass.** A failing test means your
  change is wrong, unless the ticket explicitly changes that behaviour.
- **Never delete, skip or `.only` a test.**
- **Never assert a value copied from your own output.** It comes from the
  ticket, or from reasoning about it.
- **Assert the decision, not the instruction.** A check that an agent's prompt
  contains some string proves the prompt, and stays green while the code
  ignores what comes back. Prove it through what the run returns — the verdict,
  the findings, the rendered page.

## 6. Implement

`npm test` after every edit — 160-odd tests in under a second. Match the
surrounding code, and commit in the Conventional Commits style `CLAUDE.md`
describes.

## 7. Prove it

```bash
node scripts/gate.mjs         # npm test + the whole browser suite → one JSON line
npm run shot -- /the-route    # only if something visual moved
```

The Verify phase runs this and returns its last line verbatim — nothing
else. It is `npm test` plus the whole Playwright suite, with the verdict read
from Playwright's JSON report, one retry for a flaky browser test, and a list
of any assertions the branch removed. Run it once; in a runner Chromium is
already installed — never run `playwright install`.

**Do not interpret a red result or try to fix it.** Return the line. The loop
decides what happens next: red goes to a fix round, and only the workflow
hands a ticket back.

## 8. Open the pull request

Open it **ready for review**, not as a draft — the code review and QA passes
start when it opens, and a draft would stall them waiting for somebody to
notice.

Show the change if it is visible. A reviewer looking at a UI change should
see the UI, not read a description of it:

```bash
node scripts/pr-media.mjs <n> .screenshots/<name>.png   # prints the markdown
```

**One shot of the new state is usually right** — it is what an attendee will
see, and it is what the ticket asked for.

Reach for a **before and after** only when the change is to something that
already existed and the difference is the point: a layout that moved, an
element that changed shape, a page that reads differently. Then a lone "after"
tells a reviewer nothing, because they have no idea what it replaced. You
already stash your own work to prove the test went red, so do it again for the
picture:

```bash
npm run shot -- /the-route              # after — your change is in the tree
mv .screenshots/<name>.png /tmp/after.png
git stash                               # the page as main has it
npm run shot -- /the-route
mv .screenshots/<name>.png /tmp/before.png
git stash pop
node scripts/pr-media.mjs <n> /tmp/before.png /tmp/after.png
```

Put those two in a table so they sit side by side, which is the only
arrangement where a difference is legible:

```markdown
| Before | After |
| --- | --- |
| ![before](…) | ![after](…) |
```

For a change to an *interaction*, the two states are the ones either side of
the click, and your proof spec already drives the browser through exactly that
sequence:

```js
await page.screenshot({ path: '.screenshots/before.png' });
await page.getByRole('button', { name: 'Add' }).click();
await page.screenshot({ path: '.screenshots/after.png' });
```

How many, and which, is a judgement call. The test is that **every image
shows something the one before it did not**:

- **A new screen or a new element** — shoot it. One image of the thing the
  ticket asked for.
- **An interaction** — one per state it moves through. The empty form, the
  filled one, the result. Your proof spec is already walking that sequence, so
  take them there.
- **A bug fix** — before and after. The fix *is* the difference, and an
  "after" on its own looks like an ordinary screen with nothing to see.
- **Nothing an attendee can see** — a refactor, an endpoint, a rule with no
  visible surface. No images. One that does not show the change is worse than
  none, because it implies you checked something you did not.

Five is the hard limit and `pr-media.mjs` enforces it per pull request, but
it is a backstop, not a target.

Write the body to `/tmp/pr-body.md`, in the shape below. If a draft already
exists for this branch — an earlier attempt that was handed back — do not
create a second one: `gh pr edit <draft> --body-file /tmp/pr-body.md` and then
`gh pr ready <draft>`.

```bash
git push -u origin HEAD
gh pr create --base main --title "<the issue's title>" --body-file /tmp/pr-body.md
gh issue comment <n> --body "Ready for review: <pr url>"
gh issue edit <n> --add-label ready-for-human --remove-label ai-working
```

That issue comment matters: `Closes #<n>` does not reliably register when a
pull request is opened by automation, so without it nothing on the ticket
points at your work. Keep the keyword too — it still closes on merge.

The body is read in a narrow column beside the diff. Keep it scannable, and
resist adding to this shape:

```markdown
Closes #<n>

<One sentence: what an attendee sees now that they did not before.>

[Spec](specs/<n>-<short-slug>.md)

### Changed
- `<file>` — <what, in a few words>

<the line pr-media.mjs printed — or, for a before-and-after, the two-column
table so they sit side by side>

### Proof
| Check | Result |
| --- | --- |
| `<the test that proves the ticket>` | red before, green after |
| `node scripts/gate.mjs` | unit 178 passed · browser 155 passed, at `abc1234` |

<details>
<summary>Worth a closer look</summary>

<Only a trade-off you made, a criterion you could not test, or something in
the ticket that turned out to be wrong. Two short paragraphs. Omit the block
entirely if there is nothing.>
</details>
```

## 9. If you cannot finish

A normal outcome, not a failure. Push what is committed and open a **draft**
pull request so the work is not lost — `Refs #<n>`, never `Closes`, and a
*Why this stopped* section listing what is still open. Skip the draft if
nothing beyond the spec is committed.

If a draft from an earlier attempt is already open on this branch, update it
(`gh pr edit <draft> --body-file /tmp/pr-body.md`) rather than creating one.

```bash
gh pr create --draft --base main --title "<the issue's title>" --body-file /tmp/pr-body.md
gh issue comment <n> --body "<what you tried, what stopped it, what it needs from a person, the draft>"
gh issue edit <n> --add-label needs-human --remove-label ai-working
```

A draft never presents itself as done: code review and QA skip it until a
person marks it ready. **Do not narrow the ticket to something you can finish and
present that as done** — a half-built ticket that looks complete costs more
than one that is honestly stuck.

## 10. Clean up

Laptop only; a runner disappears on its own.

```bash
node scripts/lane.mjs release
git worktree remove ../orbit-wt-<n>
```
