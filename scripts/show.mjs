/**
 * Open the branch being worked on in a browser — that branch, not whatever
 * the main checkout happens to be on.
 *
 *   npm run show -- 219                    # issue 219's worktree (wt-219), or its branch
 *   npm run show -- 226                    # …or pull request 226's branch
 *   npm run show -- issue-219-choose-x     # a branch by name
 *   npm run show                           # this checkout, as it is
 *
 * "Try it in the browser" used to mean http://localhost:5173, which is
 * whichever checkout ran `npm run dev` last: on a laptop with a feature in a
 * worktree, that was the main checkout on another branch, and the feature
 * looked missing. This finds the worktree that has the branch — making one
 * from origin if none does — claims that worktree's lane, starts its app
 * there, and opens the page once it answers. It runs until stopped
 * (Ctrl-C), and gives the lane back when it is.
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claim, release } from './lane.mjs';

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** `git worktree list --porcelain` → [{ path, branch }]. */
export function worktrees(porcelain) {
  return porcelain.split('\n\n').filter(Boolean).map((block) => ({
    path: (/^worktree (.+)$/m.exec(block) || [])[1],
    branch: ((/^branch refs\/heads\/(.+)$/m.exec(block) || [])[1]) || null,
  })).filter((w) => w.path);
}

/**
 * What to serve for `arg`: an existing worktree, or a branch that needs one.
 * A number is a ticket — its `wt-<n>` worktree, else its `issue-<n>-*`
 * branch — or failing both, a pull request (`prBranch`, looked up only then).
 */
export function pick(arg, { trees, branches, prBranch = () => null }) {
  const byBranch = (b) => trees.find((w) => w.branch === b);
  if (/^#?\d+$/.test(arg)) {
    const n = arg.replace('#', '');
    const tree = trees.find((w) => basename(w.path) === `wt-${n}`);
    if (tree) return { tree };
    const branch = branches.find((b) => b.startsWith(`issue-${n}-`)) || prBranch(n);
    if (!branch) return { error: `nothing found for ${arg}: no wt-${n} worktree, no issue-${n}-* branch, no pull request #${n}` };
    return byBranch(branch) ? { tree: byBranch(branch) } : { branch };
  }
  if (byBranch(arg)) return { tree: byBranch(arg) };
  if (branches.includes(arg)) return { branch: arg };
  return { error: `no branch named ${arg}, here or on origin` };
}

async function main() {
  const arg = process.argv[2];
  const here = git(['rev-parse', '--show-toplevel']);
  const main = dirname(resolve(here, git(['rev-parse', '--path-format=absolute', '--git-common-dir'])));
  let dir = here;
  let branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], here);

  if (arg) {
    try { git(['fetch', '--prune', '-q', 'origin'], here); } catch { /* offline: use what is known */ }
    const trees = worktrees(git(['worktree', 'list', '--porcelain'], here));
    const branches = [...new Set(git(['branch', '-a', '--format=%(refname:short)'], here).split('\n')
      .map((b) => b.replace(/^origin\//, '')).filter((b) => b && b !== 'origin' && b !== 'HEAD'))];
    const prBranch = (n) => {
      try { return execFileSync('gh', ['pr', 'view', n, '--json', 'headRefName', '-q', '.headRefName'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null; }
      catch { return null; }
    };
    const found = pick(arg, { trees, branches, prBranch });
    if (found.error) { console.error(`show: ${found.error}`); process.exit(1); }
    if (found.tree) {
      ({ path: dir, branch } = found.tree);
    } else {
      branch = found.branch;
      dir = join(main, '.claude', 'worktrees', `wt-${branch.replace(/[^\w.-]+/g, '-')}`);
      const local = git(['branch', '--list', branch], here);
      git(local ? ['worktree', 'add', dir, branch] : ['worktree', 'add', '-b', branch, dir, `origin/${branch}`], here);
      console.log(`show: made a worktree for ${branch} at ${dir}`);
    }
  }

  // Behind origin is the commonest way to show yesterday's feature.
  try {
    const behind = git(['rev-list', '--count', `HEAD..origin/${branch}`], dir);
    if (Number(behind) > 0) console.log(`show: ${branch} is ${behind} commit(s) behind origin — run \`git -C ${dir} pull\` to see the latest`);
  } catch { /* a branch with no upstream */ }
  if (!existsSync(join(dir, 'node_modules'))) {
    console.log('show: installing packages…');
    execFileSync('npm', ['install', '--silent'], { cwd: dir, stdio: 'inherit' });
  }

  const lane = await claim({ worktree: dir, label: `show ${branch}` });
  const url = `http://localhost:${lane.webPort}/${process.argv[3] ? process.argv[3].replace(/^\//, '') : ''}`;
  const sha = git(['rev-parse', '--short', 'HEAD'], dir);
  const app = spawn('npm', ['run', 'dev'], {
    cwd: dir, stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, ORBIT_LANE: String(lane.lane), PORT: String(lane.port), WEB_PORT: String(lane.webPort), NO_OPEN: '1' },
  });
  const stop = () => { app.kill(); release({ worktree: dir }); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  app.on('exit', (code) => { release({ worktree: dir }); process.exit(code ?? 0); });

  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(`show: ${branch} at ${sha} → ${url}  (from ${dir}; Ctrl-C to stop)`);
  if (process.platform === 'darwin' && !process.env.CI) spawn('open', [url], { stdio: 'ignore' });
  else if (process.platform === 'linux' && !process.env.CI) spawn('xdg-open', [url], { stdio: 'ignore' }).on('error', () => {});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
