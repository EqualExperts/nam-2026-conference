# Say what was searched for when the speakers page finds nothing
## What this changes
When `/speakers` finds nobody and a search is active, the empty-state heading names it: `No speakers match “zzqx”`. With no search the heading stays `No speakers match`, and the "following" view's `You are not following anyone yet` is unchanged. This matches the schedule page (#93).
## Where
- `src/pages/SpeakersPage.jsx` — the `<EmptyState title=…>` near line 206: the non-following branch becomes `` q ? `No speakers match “${q}”` : 'No speakers match' `` (`q` is already read from the URL at line 79; curly quotes; React escapes it). Description and "Show everyone" are unchanged.
- `tests/speakers.spec.js` — two new tests using `visit` and `shotForPR` from `tests/helpers.js`; they only read, so no attendee lane is needed.
## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| `?q=zzqx` heading reads `No speakers match “zzqx”` | `visit(page, '/speakers?q=zzqx')`, heading with exact name `No speakers match “zzqx”` is visible (false today: heading has no query) | Playwright spec |
| No search keeps `No speakers match`; following view unchanged | `visit('/speakers?view=following')` as a fresh attendee shows exact heading `You are not following anyone yet`; a no-search empty state is reached via an impossible day/track filter and shows exact `No speakers match` (holds today; pins the behaviour) | Playwright spec |
## Decisions
- Show the search text as typed, not trimmed or truncated — OK?
- In the following view with a search active, leave the heading unchanged — OK?
