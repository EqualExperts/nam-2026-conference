# Hold ship's layout work to modern phones, not just the Pixel 7

## What this changes
A ship run on a "fits on a phone" ticket is now proven on the phone most
attendees hold, not on the one that flatters every layout. The `mobile` project
runs at an iPhone 15's viewport (393×659) instead of a Pixel 7's (412×839), so a
layout that only fits in 839px goes red in the gate. Setup reports a new sizing
fact, `layoutFit`, which buys the browser auditor even when the diff is only
CSS classes. And a spec that finds a criterion already holding on `main` has to
say so in its first Decision, rather than quietly proving a different reading.

## Where
- `playwright.config.js`: the `mobile` project keeps the Pixel 7 profile (a
  Chromium phone: touch, mobile UA) with `viewport: { width: 393, height: 659 }`,
  the iPhone 15's Safari viewport. WebKit is not installed in CI, so no
  `devices['iPhone 15']`.
- `.claude/workflows/ship.js`
  - `SETUP.properties.sizing`: `layoutFit` (boolean).
  - `profileFor`: `layoutFit` sets `browserAlways` and four probes, like
    `uiInteraction`, logged as "fits a screen → a browser audit, four probes".
  - `specAsk`: the rule for a criterion that already holds on `main`.
- `docs/context/testing.md`: the projects line says `mobile` is an iPhone-15-sized
  Chromium phone, and why.
- `docs/harness/ship-playbook.md` §3b: the already-holds rule, next to the
  red-today rule it complements.
- Tests: `tests/unit/ship.test.js` (sizing, spec prompt) and
  `tests/unit/lane.test.js`, which already reads `playwright.config.js`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| mobile runs at iPhone 15 size and the suite passes | a unit test imports `playwright.config.js` and asserts the `mobile` viewport is 393×659 (it is 412×839 on main); `npm run verify` green | unit + browser |
| `layoutFit` buys the browser auditor | setup returns `layoutFit: true` on an otherwise small ticket: an `audit:browser` agent runs, with a budget of 4 probes (on main no auditor runs, since the fact is unknown) | unit |
| the already-holds rule | the `setup` prompt of a small ticket and the `write-spec` prompt of a full one both contain "already holds on main" (absent on main) | unit |

## Decisions
- Should the mobile project change its viewport rather than add a second phone
  project? Yes. A second project would add a third run of every test, and the
  shorter phone is the stricter one, so it covers the taller one for anything
  about fitting. Taller phones are not lost: every layout that fits in 659px
  fits in 839px.
- Should a criterion that already holds on main hand back to a person? No. That
  would stop #140, which the ticket owner wants built. The run carries on, and the
  reinterpretation leads the PR's *Decisions for you*, where the person merging
  confirms it.

## Out of scope
Phones narrower or shorter than an iPhone 15 (SE, mini, small Android). The app is
a workshop demo, and modern phones are the bar.
