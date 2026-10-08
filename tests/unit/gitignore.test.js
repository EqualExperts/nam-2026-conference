import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

// `git check-ignore -v` prints "<source>:<line>:<pattern>\t<path>" and exits 1
// when nothing ignores the path.
const check = (path) => spawnSync('git', ['check-ignore', '-v', path], { encoding: 'utf8' });

test('bytecode from the audio skills is ignored, and the rule is named', () => {
  for (const p of [
    '.claude/skills/transcribe-audio/scripts/__pycache__/',
    '.claude/skills/listen-to-meeting/scripts/__pycache__/',
    '.claude/skills/transcribe-audio/scripts/__pycache__/x.pyc',
  ]) {
    const r = check(p);
    assert.equal(r.status, 0, `${p} should be ignored`);
    assert.match(r.stdout, /\.gitignore:\d+:/);
    assert.match(r.stdout, /__pycache__\/|\*\.pyc/);
  }
});

test('bytecode is ignored at any depth, under any skill name', () => {
  assert.equal(check('.claude/skills/renamed-skill/lib/__pycache__/').status, 0);
  assert.equal(check('some/deep/dir/mod.cpython-312.pyc').status, 0);
  assert.match(check('mod.pyc').stdout, /\*\.pyc/);
});

test('ordinary python source is not ignored', () => {
  assert.equal(check('.claude/skills/transcribe-audio/scripts/run.py').status, 1);
});
