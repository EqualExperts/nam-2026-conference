# Deploy main to Railway from GitHub Actions

## What this changes
A new workflow, `deploy`, runs when the `verify` workflow finishes for a push to `main`. If `verify` succeeded it checks out that exact commit and runs `railway up --ci`, which uploads the commit and streams the build, then waits for the deployment it created to reach `SUCCESS` (healthcheck passed), so a deployment that builds but fails to boot is a red run. If `verify` failed, nothing deploys. If the `RAILWAY_TOKEN` secret is unset the job skips with a notice and the run stays green. No dashboard action is needed after a merge; `https://orbit26.up.railway.app/api/health` serves the new commit. The app and `verify` are untouched.

## Where
- `.github/workflows/deploy.yml` (new) — `on.workflow_run` with `workflows: ["✅ verify"]` (the `name:` in verify.yml, line 7), `types: [completed]`, `branches: [main]`; job `if:` requires `github.event.workflow_run.conclusion == 'success'` and `github.event.workflow_run.event == 'push'` (so a fork pull request from a branch named `main` never deploys). `concurrency: { group: deploy, cancel-in-progress: false }` so deploys land in order. `permissions: contents: read`. Steps: checkout with `ref: ${{ github.event.workflow_run.head_sha }}`; a `check` step that reads `RAILWAY_TOKEN` from `env: ${{ secrets.RAILWAY_TOKEN }}` (secrets cannot be used in `if:`), writes `has_token` to `$GITHUB_OUTPUT`, and otherwise prints `::notice::RAILWAY_TOKEN is not set, skipping the deploy`; then, `if: steps.check.outputs.has_token == 'true'`, setup-node 22 and `npx --yes @railway/cli up --ci` with `RAILWAY_TOKEN` in that step's own `env:` (and `--service "$RAILWAY_SERVICE"` when the `RAILWAY_SERVICE` repository variable is set). Railway builds the app itself, so the workflow does not run `npm ci` or the build.
- `docs/harness/github.md` — new section "Deploying main to Railway": `RAILWAY_TOKEN` is a Railway **project token** for the production environment, created by a person in Railway (project settings, Tokens) and added under repo Settings, Secrets and variables, Actions; optional `RAILWAY_SERVICE` variable; the workflow lives in `.github/workflows/deploy.yml`, runs after `verify` on `main`, skips when the secret is unset. Also add one line to `setup.yml`'s summary only if it lists secrets (read it first; otherwise leave it).
- `docs/context/harness.md` — one line in the workflow list naming `deploy.yml` (run `node scripts/context.mjs for .github/workflows/deploy.yml`).
- `tests/unit/deploy-workflow.test.js` (new) — reads `.github/workflows/deploy.yml` and `verify.yml` as text with `readFileSync`, like `tests/unit/review-workflows.test.js`; no lane or helpers, no database or browser (there is no YAML parser in the repo, so assertions are on exact lines).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Merging to `main` produces a deployment of that commit with no dashboard action | `deploy.yml` triggers on `workflow_run` of the name found in `verify.yml`, `branches: [main]`, checks out `workflow_run.head_sha`, and runs `railway up --ci`; false today, the file does not exist | unit |
| `/api/health` serves it | after merge, `GET https://orbit26.up.railway.app/api/health` returns `ok` and the deploy run is green | manual, outside CI |
| A `main` commit whose `verify` fails does not deploy | the job `if:` contains `conclusion == 'success'` and `event == 'push'` | unit |
| A failed Railway deployment fails the run | `--ci` alone ends when the build does, so a wait step polls `deployment list` for the new deployment: `SUCCESS` passes, `FAILED`/`CRASHED`/`REMOVED`/`SKIPPED` or a 15-minute timeout fail; no `continue-on-error` or `\|\| true` | unit |
| With `RAILWAY_TOKEN` unset, skip with a message, no failure | the check step emits `::notice::` and `has_token`, the deploy steps are gated on `has_token == 'true'`, and no step `exit 1`s on a missing token | unit |
| The secret is documented | `docs/harness/github.md` mentions `RAILWAY_TOKEN`, `deploy.yml` and "project token" | unit |
| `npm test` and `npm run verify` behave as before | no file under `server/`, `src/` or `tests/` other than the new test changes; `npm test` and `npm run verify` stay green | existing suites |

## Decisions
- Deploy from a `workflow_run` after `verify`, rather than adding a job to `verify.yml`: `verify` also runs on pull requests, and a gate inside it would put a deploy job on every one.
- A Railway project token (`RAILWAY_TOKEN`), not an account token: scoped to one environment, which is all `railway up` needs.
- The service is chosen by an optional `RAILWAY_SERVICE` variable; unset, the CLI uses the project's only service.

## Out of scope
Creating the token (a person does that), preview deployments for pull requests, rollbacks, and moving the Railway dashboard settings into repo config.
