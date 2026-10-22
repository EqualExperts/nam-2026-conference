# Harness follow-ups: #113, #114, #115, #118, #153

Five follow-ups code review filed against PRs that changed the engineering
harness. Each was checked against the current code; the valid ones get the
smallest fix the issue names and a unit test that fails without it.

| Issue | Verdict | Fix |
| --- | --- | --- |
| #113 QA's `follow-up` label says "only with an input nobody gives in normal use" for a `harmless` finding too | valid | `.claude/workflows/qa.js` `LABEL['follow-up']` says "contrived or harmless", as `docs/harness/qa-playbook.md` already does |
| #114 non-replan spec findings are pushed onto `carried` every spec round | valid | `.claude/workflows/ship.js`: a blocker at a location already carried is not sent to a skeptic again, so `carried` and `history` hold it once |
| #115 `uiInteraction` is missing from setup's `sizing.required` | valid | add it to the `required` list in `ship.js` |
| #118 the winnow spec's proof row names a README table | stale — closed | README no longer has a skill table; the skills it names in prose all exist |
| #153 `sync=conflict` with a green gate line is audited as green | valid, low | `ship.js`: a conflicted verify is read as a red gate, so it always reaches the conflict branch |

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| a harmless QA finding is not labelled as needing a contrived input | `review-workflows.test.js` | unit |
| a spec-gap re-raised in round 2 is confirmed and carried once | `ship.test.js` | unit |
| setup must report `uiInteraction` | `ship.test.js` (source check, as for `sizing`) | unit |
| a conflict with a green gate line goes to the fixer, not the auditors | `ship.test.js` | unit |

## Decisions
- #114 dedupes by the same location key `confirm()` already groups on
  (`where`), so a re-raise is recognised however the auditor words it.
- #115 touches `uiInteraction` only. `layoutFit` has the same gap, but the
  issue does not name it; it is left for its own ticket.

## Out of scope
Restructuring the spec or build loops; anything outside the lines each issue names.
