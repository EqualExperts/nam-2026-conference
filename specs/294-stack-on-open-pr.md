# Let ship stack on a dependency that is an open pull request
## What this changes
`**Depends on:** #277` where #277 is an open pull request (any branch name) now counts as in flight: `node scripts/depends.mjs <n>` reports that pull request's head branch in `unmet` and `stackOn`, so ship stacks on it instead of declining. Issues and `issue-<n>-` branches behave as before.
## Where
- `scripts/depends.mjs` — `inFlight(n, prs, branches)`: first, a pull request with `number === n`, not `isDraft`, not `isCrossRepository`, returns `{ branch: headRefName, pr: number }`; the existing rules follow unchanged. `isDone`: also true for `state === 'MERGED'`. `main()`: add `isDraft,isCrossRepository` to the `gh pr list --json` fields; update the header comment.
- `tests/unit/depends.test.js` — new `node:test` cases on the pure functions (no lane or helpers needed): open PR on a non-`issue-` branch; draft PR and fork PR not in flight; a merged or closed PR number is absent from the open list so `inFlight` is null, and `isDone` is true for MERGED; existing cases untouched.
- `context/engineering-context/harness/ship-playbook.md` (the "Depends on" paragraph near line 41) and `context/engineering-context/harness.md` ("A dependent ticket stacks on its dependency", near line 364) — say a dependency may itself be an open, non-draft, same-repository pull request, and that it is stacked on by its head branch.
## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| An open PR on a non-`issue-<m>-` branch is reported as the branch to stack on | `inFlight(277, [{number:277, headRefName:'opening-presentation', isDraft:false, isCrossRepository:false}], [])` equals `{branch:'opening-presentation', pr:277}`, and `stackFor` of it gives that branch (false on main: returns null) | unit |
| Draft or fork PR is not in flight; merged PR is done | `inFlight` null for draft and fork; `isDone({state:'MERGED'})` true (false on main) | unit |
| Issues and `issue-<n>-` branches behave as before | the existing `inFlight`/`stackFor` tests pass unchanged | unit |
| Both docs describe the rule | read in review; `node scripts/context.mjs for scripts/depends.mjs` lists them | review |
## Decisions
- The `gh issue view` lookup of a PR number returns state `MERGED` for a merged PR, which `isDone` rejects today; treat MERGED as done so a merged dependency PR is "done, not in flight", as the ticket asks — OK?
- A closed-unmerged PR stays not done and not in flight (declined), like an issue closed as not planned — OK?
## Out of scope
How a stacked pull request is opened or retargeted; native GitHub stacks.
