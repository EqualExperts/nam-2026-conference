# Correct ui.md's claim that both talks share ISSUE_140

## What this changes
`context/engineering-context/ui.md` says both presentation talks render ticket #140
from `presentation/issue.js` (`ISSUE_140`) "so they cannot drift apart". Since #271
only the engineering talk (`presentation/intro.jsx`) imports it; the product talk
writes its own ticket copy (`product/winnow.jsx`'s WhereScene and Distil buckets).
The doc will say that, so whoever edits `ISSUE_140` knows the product deck needs a
look too. No code, no attendee-visible change.

## Where
- `context/engineering-context/ui.md` — the two lines starting "Both talks render
  ticket #140" (about line 216); reword to: the engineering talk renders #140 from
  `ISSUE_140`; the product talk keeps its own copy of the ticket, so a change to
  the #140 text is made in both. The `Token` line above it ("travels both talks")
  stays true (`product/raise.jsx` uses it).
- No test file: a documentation-only change.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| ui.md no longer claims both talks share `ISSUE_140` | `git grep -n "Both talks render ticket #140" -- context` (specs/ excluded) matches nothing | grep, by reading |
| ui.md names the product talk's own copy | the new sentence names `product/winnow.jsx` | grep, by reading |
| nothing else broke | `npm test` | unit |

## Decisions
- The ticket has no Done-when; I read its outcome as "ui.md must be true about who uses `ISSUE_140`". Fix the doc rather than make the product deck import the constant again — OK?

## Out of scope
Re-importing `ISSUE_140` into the product deck, or a test that guards the two copies against drift.
