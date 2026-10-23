# Say what was searched for when the schedule finds nothing

## What this changes
When `/schedule` finds no sessions and a search is active, the empty-state heading names it: `No sessions match “zzqx”`. With only filters (no search) the heading stays `No sessions match`. "Clear filters" still clears everything, search included.

## Where
- `src/pages/SchedulePage.jsx` — the `<EmptyState title="No sessions match" …>` near line 288: title becomes `` filters.q ? `No sessions match “${filters.q}”` : 'No sessions match' `` (curly quotes; React escapes the text). `clearAll` is unchanged.
- `tests/schedule.spec.js` — extend the `Schedule` describe next to "an impossible filter combination shows the empty state"; uses `visit`, `waitForResults` from `tests/helpers.js`. These tests only read and book nothing, so no data lane is needed.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| `?q=zzqx` heading reads `No sessions match “zzqx”` | `visit('/schedule?q=zzqx&view=list')`, heading with exact name `No sessions match “zzqx”` is visible (false today: heading has no query) | Playwright spec |
| Filters without search keep `No sessions match` | Query `/api/sessions` over day x track (via `conferenceDays()` and the bootstrap tracks) for a combination with zero results, `visit` it, assert the heading's exact name is `No sessions match` and has no quotes (holds today; pins the behaviour, the first row carries the red) | Playwright spec |
| "Clear filters" clears search and shows sessions | From `?q=zzqx`, click `Clear filters`; `search-input`/URL lose `q`, and `article` is visible | Playwright spec |

## Decisions
- Show the search text as typed, rather than trimmed or truncated — OK?
- If filters and a search are both active, name only the search (it is the likeliest cause) — OK?
