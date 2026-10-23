import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startApi } from './harness.js';

/**
 * Production serving.
 *
 * `npm run dev` never builds `dist/`, so these prove the branch that only
 * mounts when it does exist — the one Railway's `npm start` hits after
 * `npm run build`. A fixture `dist/` stands in for a real Vite build so the
 * test never touches the project's own (gitignored) one.
 */

let api;
let close;
let origin;
let distDir;
let tmpRoot;

const INDEX_BODY = '<!doctype html><title>fixture shell</title><div id="root">orbit fixture shell</div>';
const AVATAR_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9, 0x01, 0x02, 0x03]);

before(async () => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'orbit-dist-'));
  distDir = join(tmpRoot, 'dist');
  mkdirSync(join(distDir, 'avatars'), { recursive: true });
  writeFileSync(join(distDir, 'index.html'), INDEX_BODY);
  writeFileSync(join(distDir, 'avatars', 'fixture.jpg'), AVATAR_BYTES);

  ({ api, close, origin } = await startApi({ distDir }));
});

after(async () => {
  await close();
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe('Serving the build', () => {
  test('the home page renders from the build', async () => {
    const res = await fetch(`${origin}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    assert.equal((await res.text()).trim(), INDEX_BODY);
  });

  test('a deep link renders instead of 404ing', async () => {
    const res = await fetch(`${origin}/speakers/12`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    assert.equal((await res.text()).trim(), INDEX_BODY);
  });

  test('a portrait under /avatars/ loads', async () => {
    const res = await fetch(`${origin}/avatars/fixture.jpg`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /image\/jpeg/);
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), AVATAR_BYTES);
  });

  test('/api still answers JSON, not the fallback', async () => {
    const res = await api.get('/does-not-exist');
    assert.equal(res.status, 404);
    assert.match(res.type, /json/);
    assert.match(res.body.error, /No route for/);
  });

  test('a missing file is a 404, not the HTML shell', async () => {
    const res = await fetch(`${origin}/avatars/x.png`);
    assert.equal(res.status, 404);
    assert.doesNotMatch(await res.text(), /fixture shell/);
  });
});
