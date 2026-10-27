import { describe as group, test } from 'node:test';
import assert from 'node:assert/strict';
import { describe, repoOf } from '../../scripts/sync-fork.mjs';

/**
 * A fork days behind the workshop repo ran ship without the latest harness,
 * and nobody could tell. Ship's setup and the onboarding sync it first; this
 * pins what they read back.
 */
group('syncing a fork', () => {
  test('reads owner/name from an https or ssh remote', () => {
    assert.equal(repoOf('https://github.com/jonasingvar/nam-2026-conference.git'), 'jonasingvar/nam-2026-conference');
    assert.equal(repoOf('git@github.com:jonasingvar/nam-2026-conference.git'), 'jonasingvar/nam-2026-conference');
    assert.equal(repoOf('https://github.com/EqualExperts/nam-2026-conference'), 'EqualExperts/nam-2026-conference');
    assert.equal(repoOf('/some/local/path'), null);
  });

  test('the workshop repo itself is not a fork, and is left alone', () => {
    assert.match(describe({ fork: 'EqualExperts/nam-2026-conference', parent: null }), /is not a fork — nothing to sync/);
  });

  test('says whether it fast-forwarded, merged, or was already current', () => {
    const at = { fork: 'me/nam-2026-conference', parent: 'EqualExperts/nam-2026-conference' };
    assert.match(describe({ ...at, result: { merge_type: 'fast-forward' } }), /brought up to date with EqualExperts\/nam-2026-conference \(fast-forward\)/);
    assert.match(describe({ ...at, result: { merge_type: 'merge' } }), /\(merge\)/);
    assert.match(describe({ ...at, result: { merge_type: 'none' } }), /already up to date/);
  });

  test('a conflict changes nothing and says how to sync by hand', () => {
    const line = describe({ fork: 'me/nam-2026-conference', parent: 'EqualExperts/nam-2026-conference', error: 'HTTP 409: Conflict' });
    assert.match(line, /NOT synced/);
    assert.match(line, /conflict/);
    assert.match(line, /carrying on with the fork as it is/);
    assert.match(line, /Sync fork/);
  });
});
