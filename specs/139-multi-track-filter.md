# Let attendees filter the schedule by several tracks at once

## What this changes

On `/schedule`, the track pills become a multi-select: an attendee can hold
Engineering *and* Agents at the same time and the list shows sessions from
either track and nothing else. The selection rides in the URL as
`?track=engineering,agents`, so a reload restores both pills; the **All** pill
clears every track. A track filter is still a grid blocker, so the Grid tab
stays disabled — naming "a track filter" — while any track is selected.
`GET /api/sessions?trackSlug=engineering,agents` returns the union of the two.

## Where

- `server/routes/sessions.js` — the `GET /` handler, the `if (trackSlug)` line
  (`where.push('t.slug = ?')`): split the value on `,`, drop empties, and push
  `t.slug IN (?,…)` with one bound `?` per slug (every value stays a bound
  parameter; a single slug still works unchanged). Update the route's `Filters:`
  comment. Test in `tests/api/endpoints.test.js` — add a
  `/sessions?trackSlug=<a>,<b>` row to `filtered()` and a new test in the
  sessions area that fetches each track alone and the pair, using the
  `startApi()` harness already imported there (`tests/api/harness.js`); a
  session's track is `track.slug` in the payload (`server/lib/query.js`
  `toSession`).
- `src/pages/SchedulePage.jsx` — `filters.track` (line ~29) becomes a
  comma-split array (`[]` when the param is absent, replacing the `ALL`
  sentinel for this one key); `useFetch` (line ~50) passes
  `trackSlug: filters.track.join(',')` and keys on that string; a new
  `toggleTrack(slug)` beside `set()` adds/removes the slug and deletes the
  param when the list empties; the track pill block (lines ~163–182) renders
  `active = filters.track.includes(t.slug)`, calls `toggleTrack`, and gains
  `aria-pressed={active}` plus `data-testid={`track-${t.slug}`}` (the All pill
  gets `data-testid="track-all"` and `aria-pressed={filters.track.length === 0}`),
  and `activeKeys` (line ~62) and the `BLOCKERS` lookup (line ~83) treat `track`
  as "non-empty array" rather than `!== ALL`. `clearAll` and `clearBlocker`
  already delete the key, so they need no change. Test in
  `tests/schedule.spec.js`, in the existing `Schedule filters` describe, using
  `visit()` and `waitForResults()` from `tests/helpers.js` and reading the track
  slugs from `${API}/bootstrap` as the neighbouring test does — read-only
  browsing, so no data lane and no reservations.
- `docs/context/schedule.md` — the `trackSlug` row of the `GET /api/sessions`
  param table (line 32), the URL-keys sentence and `track→trackSlug` mapping
  (lines 55–56), and the `BLOCKERS` paragraph (line 62), to say the track key is
  a comma-separated list.

## How it will be proved

| Done when | Check | Layer |
| --- | --- | --- |
| More than one track pill can be selected at once | `tests/schedule.spec.js`: click two track pills, both `track-<slug>` have `aria-pressed="true"` (on main the second click replaces the first) | spec |
| With two tracks selected the list shows sessions from either and no others | `tests/api/endpoints.test.js`: `/sessions?trackSlug=a,b` returns `countA + countB` sessions and every `track.slug` is `a` or `b` (on main it returns 0 — no track is named "a,b") | API |
| The selection is in the URL and restored after a reload | `tests/schedule.spec.js`: after the two clicks the URL carries `track=<a>,<b>`; `page.reload()` and both pills are still `aria-pressed="true"` | spec |
| "All" clears every selected track | `tests/schedule.spec.js`: from two selected, click `track-all`; URL has no `track=` and both pills are `aria-pressed="false"` | spec |
| The Grid tab stays disabled while any track is selected, naming the blocker | `tests/schedule.spec.js`: visit `?track=<a>,<b>&day=<d>`, `view-grid` is disabled with title `/a track filter/` **and** `result-count` is not "0 sessions" (on main the two-slug URL matches nothing) | spec |
| `GET /api/sessions` returns the union, covered by an API test | the union test above, plus the `filtered()` row keeping the multi-track URL answering 200 | API |

## Decisions

- Several tracks travel as one comma-separated `track` / `trackSlug` value
  (`track=engineering,agents`) rather than a repeated parameter, because
  `qs()` in `src/lib/api.js` builds from a flat object and the page already
  reads single params.
- The API keeps the name `trackSlug` and simply accepts a list, rather than
  gaining a second `trackSlugs` parameter, so existing single-track callers
  (`SpeakersPage`, the session page) are untouched.
- Track pills gain `aria-pressed` and `data-testid="track-<slug>"`, which they
  do not have today, so the selection is assertable and announced.

## Out of scope

Multi-select for venue, level, format or topic; the grid rendering more than
one track.
