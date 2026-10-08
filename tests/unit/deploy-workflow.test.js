import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

/**
 * The deploy workflow, read as text: there is no YAML parser in the repo, so
 * these assert on exact lines. They prove the decisions (what triggers a
 * deploy, what blocks one, what a missing token does), not the Railway CLI.
 */

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const deployPath = '.github/workflows/deploy.yml';
const deploy = () => (existsSync(new URL(deployPath, root)) ? read(deployPath) : '');
const lines = (s) => s.split('\n').map(l => l.trim());

describe('deploy workflow', () => {
  test('runs after the verify workflow completes on main', () => {
    const verifyName = read('.github/workflows/verify.yml').match(/^name: (.+)$/m)[1].trim();
    const d = deploy();
    assert.ok(d, 'deploy.yml exists');
    const l = lines(d);
    assert.ok(l.includes('workflow_run:'));
    assert.ok(l.includes(`workflows: ["${verifyName}"]`), 'names verify.yml\'s name');
    assert.ok(l.includes('types: [completed]'));
    assert.ok(l.includes('branches: [main]'));
  });

  test('only a successful push run of verify deploys, at that commit', () => {
    const d = deploy();
    assert.match(d, /github\.event\.workflow_run\.conclusion == 'success'/);
    assert.match(d, /github\.event\.workflow_run\.event == 'push'/);
    assert.match(d, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/);
  });

  test('deploys run one at a time, in order, with read-only permissions', () => {
    const l = lines(deploy());
    assert.ok(l.includes('group: deploy'));
    assert.ok(l.includes('cancel-in-progress: false'));
    assert.ok(l.includes('contents: read'));
  });

  test('a failed Railway deployment fails the run', () => {
    const d = deploy();
    assert.match(d, /@railway\/cli up --ci/);
    assert.doesNotMatch(d, /continue-on-error/);
    assert.doesNotMatch(d, /\|\|\s*true/);
  });

  // `up --ci` exits when the build ends, so a deployment that builds and then
  // fails its healthcheck would be a green run without this step.
  test('the run waits for the deployment to be live, not just built', () => {
    const d = deploy();
    const wait = d.slice(d.indexOf('Wait for the deployment to go live'));
    assert.ok(wait.includes('deployment list'), 'reads the deployment status');
    assert.match(wait, /SUCCESS\).*exit 0/);
    assert.match(wait, /FAILED\|CRASHED\|REMOVED\|SKIPPED\).*exit 1/);
    assert.match(wait, /did not go live[^\n]*\n\s*exit 1/, 'gives up red, not green');
    assert.ok(d.indexOf('before.json') < d.indexOf('up --ci'), 'records existing deployments before uploading');
  });

  test('uses the same action versions as verify.yml', () => {
    const versions = (t) => Object.fromEntries([...t.matchAll(/uses: (actions\/[\w-]+)@(\S+)/g)].map(m => [m[1], m[2]]));
    const verify = versions(read('.github/workflows/verify.yml'));
    for (const [action, v] of Object.entries(versions(deploy()))) {
      assert.equal(v, verify[action], `${action} matches verify.yml`);
    }
  });

  test('without RAILWAY_TOKEN it skips with a notice and does not fail', () => {
    const d = deploy();
    const check = d.slice(d.indexOf('Check for a Railway token'), d.indexOf('actions/setup-node'));
    assert.match(d, /::notice::RAILWAY_TOKEN is not set, skipping the deploy/);
    assert.match(d, /has_token/);
    assert.match(d, /if: steps\.check\.outputs\.has_token == 'true'/);
    assert.doesNotMatch(check, /exit 1/);
  });

  test('the secret is documented', () => {
    const doc = read('docs/harness/github.md');
    assert.match(doc, /RAILWAY_TOKEN/);
    assert.match(doc, /deploy\.yml/);
    assert.match(doc, /project token/);
  });
});
