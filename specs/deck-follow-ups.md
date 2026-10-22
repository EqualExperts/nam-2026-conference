# Deck follow-ups (#145, #146, #147, #168, #169, #170)

Six non-blocking findings that code review raised on the presentation-deck PRs
(#144, #167). Each was checked against the current code before anything changed.

| Issue | Finding | Verdict |
|---|---|---|
| #145 | Space re-fires a clicked chrome button instead of advancing | Stale: `keepFocusOnStage` (`Deck.jsx`) stops a mouse click focusing chrome buttons |
| #146 | testing.md says every new route goes into smoke `ROUTES` | Stale: testing.md already makes full-screen routes the exception |
| #147 | `.claude/rules/ui.md` says motion is CSS only | Stale: the rule already names the presentation's `motion/react` exception |
| #168 | ui.md "Where to change…" sends every new chapter to the engineering deck | Fix: name both chapter lists |
| #169 | Reduced-motion hand-off test passes whether or not the short-circuit exists | Fix: test it with the page's timers paused |
| #170 | Cancelling the hand-off races its 900 ms timer | Fix: test it with the page's timers paused |

## The two tests

Both now install Playwright's fake clock before loading the page and pause it on
the last beat, so the 900 ms hand-off timer fires only when the test says so:

- **Reduced motion navigates at once**: with timers paused, the only way to reach
  `/engineering-presentation` is the synchronous path. Without it, the test fails
  rather than passing 900 ms later.
- **Back cancels the hand-off**: forward then back with time paused, then run
  the clock well past 900 ms. The URL must not change. There is no real-time
  window left to overrun.

Each was checked by removing the code under test and watching it fail.

## Out of scope

No behaviour change to the deck itself.
