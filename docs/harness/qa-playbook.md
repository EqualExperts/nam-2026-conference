<!--
The rules a QA pass follows. Not a command: `/qa <pr>` runs the workflow
(.claude/workflows/qa.js) — plan, probe, reproduce on the branch and its base,
publish — and its agents are pointed at the numbered sections here. The
workflow composes the comment and the verdict line (§4–§5) from what
reproduced, so where this says "you" write them, it does.
-->

# QA a change

The suite is already green. **Running it again proves nothing.** You are here
for what nobody thought to write down.

**You can stop a merge**, so a finding you cannot reproduce is not a finding.

**Your verdict is a file** — one line in `/tmp/qa-verdict`, nothing else is
read. Saying "Verdict: PASS" in prose leaves the check reading *unproven*.

**Budget: five probes, or fifteen minutes.** Then write the verdict with
whatever confidence that earned. Exploring until you find something is how a
QA pass becomes a fishing trip.

## 1. Decide what is worth probing

**First: is exploring worth it at all?** A cosmetic change — copy, a label, a
colour, spacing, an icon — that the tests already pin needs no probes. Say
so, say which tests cover it, and stop. The workflow takes your word only for
a UI-only change of at most 30 lines — facts the job computes from git, not
from you — and never for anything with logic, data, an API, state or a flow; it then publishes a medium-confidence pass that
reads *skipped — existing tests are enough*.

Read the ticket's **Done when:**, the diff, and the tests it added. The tests
say where *not* to spend time — what they assert is already proven. The
`docs/context/` doc for the area (`node scripts/context.mjs index`) names its
callers and test ids, which is most of what you need to aim a probe.

**On a re-review, the previous bugs come first.** Your last comment ended
with `<!-- orbit-verdict:qa {…} -->`, recording the commit you probed and each
bug with the probe that found it. The workflow re-runs those probes itself,
verbatim, and hands them to you as already spent: **do not plan them again**,
and pick at most five minus that many new ones. Aim the new ones at what was
pushed since — `git diff <that commit> <head sha>`, never `HEAD`, which in
Actions is the merge commit; after a rebase, that diff limited to the pull
request's files — and step outside it only for something that would have
blocked a first review. A previous bug whose probe now passes is resolved and
leaves the verdict; **all resolved and nothing new is a pass.**

Then pick from these, in this order:

- **The empty and the extreme.** Zero, one, many. An attendee with nothing
  booked, the one with clashes, a full room.
- **The other viewport.** Mobile is a first-class project here and half the
  layout differs. Proven on desktop is proven on half of it.
- **The other day.** Almost everything moves with the clock. Day 1 morning is
  the only time with ratings and check-ins; day 4 is a different world.
- **The second interaction.** Add then remove. Sort then filter. Navigate away
  and back. State surviving when it should not is this app's classic bug.
- **The callers.** If the diff touched something shared — anything in
  `server/lib/`, a component used on several pages — exercise what *uses* it,
  not just the new path. A change breaking its consumers is the most common
  regression there is, and the one a diff-shaped reading misses.
- **The console.** A page that renders correctly while throwing is broken, and
  nobody looks.

**No browser surface is not "nothing to test".** A change to a script, a
workflow, the Actions YAML or a doc is probed by running it:

- **A script** — with an empty, huge or malformed input, and with what it
  reads missing.
- **A workflow script** — under the stubs `tests/unit` already uses, with an
  agent returning `null` at the new step. A dead agent must never read as a
  pass.
- **An Actions `if:` or expression** — evaluated in a few lines of node
  against a realistic payload: an issue comment, a bot's pull request, a
  draft.
- **A doc** — every command it tells an agent to run, run as written.

Nothing that touches GitHub, and nothing that changes a tracked file.

## 2. Write probes where Playwright will find them

**Do not start the app yourself.** `playwright.config.js` has a `webServer`
block that seeds the database and boots the app, and under CI it refuses to
reuse a running server — so your own `npm run dev &` collides with it and the
run dies on a taken port.

**Do not put probes in `/tmp`.** `testDir` is `./tests`, so anything outside
it is never collected: the run reports "no tests found", which looks like a
pass.

```bash
cat > tests/qa-probe.spec.js <<'SPEC'
import { test, expect } from '@playwright/test';
import { visit, ATTENDEES, momentOn } from './helpers.js';
// …probes…
SPEC

npx playwright test tests/qa-probe.spec.js --project=desktop
npx playwright test tests/qa-probe.spec.js --project=mobile

rm tests/qa-probe.spec.js
```

`tests/helpers.js` is what makes a probe cheap: `visit(page, path, { as, at })`
signs in as any seeded attendee and pins the conference clock,
`momentOn(day, time)` builds the timestamp, `ATTENDEES` names the six.

Assert on roles and test ids — `getByRole`, `getByTestId` — not CSS classes or
positions, which move for reasons that are not bugs.

## 3. Before you call anything a bug

Two checks, both required.

**Re-run it.** A probe that fails once and passes once has not reproduced.
That is flakiness, and filing it as a defect is worse than missing it.

**Try it on `main`.** Stash the probe, check out `origin/main`, run it there.
If it fails there too the bug is real but **pre-existing** — report it and
pass. Blaming this pull request sends somebody to fix code that did not
change.

**A blocker is something someone will hit.** A failure that reproduces but
only from an input nobody gives in normal use — a hand-edited URL or
localStorage value, a forged request — is a **follow-up**: the skeptic says
`contrived`, the check stays green, and it is filed as a `follow-up` issue
linking the pull request, on a pass or a fail. A previous bug whose probe
fails again is a bug without a second skeptic; it survived one already.

## 4. Report

One comment. The callout, then at most three short paragraphs. Each finding is
three lines: **what you did, what you expected, what happened.**

```markdown
> [!TIP]
> ### QA · high confidence &nbsp; `●●●`
> Both viewports, empty and full agendas, days 1 and 4.
```

| Verdict | Callout | Meter |
| --- | --- | --- |
| pass, high | `> [!TIP]` | `●●●` |
| pass, medium | `> [!NOTE]` | `●●○` |
| pass, low | `> [!WARNING]` | `●○○` |
| blocker | `> [!CAUTION]` | *none* |

Label every finding **a bug in this change**, **pre-existing**, **a
follow-up** (real, but contrived), or **a question** you cannot tell is
intended. The workflow ends the comment with the `orbit-verdict:qa` marker the
next pass reads back. Show it rather than describe it:

```bash
node scripts/pr-media.mjs <issue> /tmp/<name>.png
gh pr comment <pr> --body "<the callout, then what you found>"
```

Then **one line back on the issue** — the ticket asked for something, and
whether it works is the ticket's business. Somebody following the board should
not have to open the pull request to learn it:

```bash
gh issue comment <issue> --body "> [!TIP]
> ### QA · high confidence &nbsp; \`●●●\`
> Both viewports, empty and full agendas, days 1 and 4. → <pr url>"
```

The callout and one sentence. The findings stay on the pull request, beside
the diff they are about — repeating them here makes both harder to scan.

**"I tried these five things and found nothing" is a good report.** Name
them, a few words each. A reviewer learns more from knowing what was probed
than from a finding you had to reach for.

## 5. Write the verdict

```bash
echo "PASS high both viewports, empty and full agendas, days 1 and 4" > /tmp/qa-verdict
echo "PASS low  change is in the seed; none of it is reachable from the UI" > /tmp/qa-verdict
echo "FAIL the hours tile reads 0 when an attendee's only booking is a waitlist place" > /tmp/qa-verdict
```

`PASS <high|medium|low> <what you covered>` or `FAIL <what breaks, and when>`.

Confidence is **coverage, not feeling** — how much of what changed you put a
browser through. High means everything that changed, on both viewports,
including the empty and extreme cases. Low means you could barely test it:
server-side, config, no visible surface. **A low pass publishes as unproven
rather than green**, which is the honest reading.

Do not round up. "Mostly worked" is `medium`.

A `FAIL` stops the merge, so: **only a bug in this change, only one you
reproduced, never a question or a suspicion.** Unsure is a `PASS` with the
doubt written into your comment, where a person can weigh it.

Do not open a pull request, change any code, or add tests to the suite. If a
finding deserves a permanent test, say so and let a person decide.
