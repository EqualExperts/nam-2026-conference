import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (p) => readFileSync(join(root, p), 'utf8');
const VERSION = '0.10.0';

const lock = read('apm.lock.yaml');
const deployed = [...lock.matchAll(/^ {2}- (\.claude\/skills\/\S+)$/gm)].map((m) => m[1]);

test('apm.yml pins the winnow bundle and the lockfile records it', () => {
  assert.match(read('apm.yml'), new RegExp(`quiram/winnow#v${VERSION.replaceAll('.', '\\.')}\\b`));
  assert.match(lock, new RegExp(`^ {2}version: ${VERSION.replaceAll('.', '\\.')}$`, 'm'));
  assert.match(lock, new RegExp(`^ {2}resolved_ref: v${VERSION.replaceAll('.', '\\.')}$`, 'm'));
});

test('.claude/skills holds exactly what the lockfile deploys', () => {
  assert.ok(deployed.length > 0);
  for (const f of deployed) assert.ok(existsSync(join(root, f)), `${f} is deployed but missing`);
  const tops = new Set(deployed.map((f) => f.split('/')[2]));
  const dirs = readdirSync(join(root, '.claude/skills')).filter((d) => statSync(join(root, '.claude/skills', d)).isDirectory());
  for (const d of dirs) assert.ok(tops.has(d), `.claude/skills/${d} is left over from an older bundle`);
});

test('no reference to the old 0.9.0 pin outside specs/ and the lockfile', () => {
  const skip = new Set(['node_modules', '.git', 'specs', 'apm.lock.yaml', 'package-lock.json', '__pycache__', '.worktrees', 'worktrees', 'data', 'dist', 'test-results', 'playwright-report', '.screenshots']);
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.size < 1_000_000) {
        const text = readFileSync(full);
        if (text.includes(0) ) continue;
        if (text.toString('utf8').includes('0.9.0')) hits.push(relative(root, full));
      }
    }
  };
  walk(root);
  assert.deepEqual(hits, []);
});

test('every skill the README names is deployed', () => {
  const readme = read('README.md');
  const table = readme.slice(readme.indexOf('From meeting to ticket'), readme.indexOf('set-up-your-fork'));
  const names = [...table.matchAll(/`([a-z][a-z-]+)`/g)].map((m) => m[1]);
  assert.ok(names.length > 0);
  for (const n of names) assert.ok(existsSync(join(root, '.claude/skills', n)), `README names ${n}, which is not in .claude/skills`);
});
