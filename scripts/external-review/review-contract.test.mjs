import assert from 'node:assert/strict';
import test from 'node:test';
import { REVIEW_PACKS, summarizeReview, validateEnvironment, validatePackResult } from './review-contract.mjs';

const base = {
  revision: 'a'.repeat(40),
  startedAt: '2026-07-12T00:00:00.000Z',
  finishedAt: '2026-07-12T00:10:00.000Z',
  defects: [],
};

test('all five PASS packs satisfy the external-review gate', () => {
  const summary = summarizeReview(REVIEW_PACKS.map((pack) => ({ ...base, pack, status: 'PASS' })));
  assert.equal(summary.gate, 'PASS');
  assert.deepEqual(summary.missing, []);
});

test('BLOCKED remains a gate failure without becoming a product defect', () => {
  const results = REVIEW_PACKS.map((pack) => ({ ...base, pack, status: pack === REVIEW_PACKS[0] ? 'BLOCKED' : 'PASS' }));
  const summary = summarizeReview(results);
  assert.equal(summary.gate, 'FAIL');
  assert.deepEqual(summary.productDefects, []);
  assert.equal(summary.statuses[REVIEW_PACKS[0]], 'BLOCKED');
});

test('FAIL requires a reproducible defect while BLOCKED cannot claim one', () => {
  assert.deepEqual(validatePackResult({ ...base, pack: REVIEW_PACKS[0], status: 'FAIL' }), [
    'FAIL requires at least one reproducible product defect',
  ]);
  assert.deepEqual(validatePackResult({ ...base, pack: REVIEW_PACKS[0], status: 'BLOCKED', defects: [{ id: 'B-1' }] }), [
    'BLOCKED cannot claim product defects',
  ]);
});

test('environment contract blocks missing fields, hash mismatch, dirty tree and an existing profile', () => {
  const blockers = validateEnvironment({
    schemaVersion: 1,
    collectedAt: base.startedAt,
    pack: REVIEW_PACKS[0],
    revision: base.revision,
    preflightStatus: 'BLOCKED',
    windows: {},
    host: {},
    repository: { dirty: true },
    installer: { sha256: 'bad-installer' },
    installedExecutable: { sha256: 'bad-executable' },
    releaseManifest: { installerExpected: 'expected-installer', executableExpected: 'expected-executable' },
    cleanProfile: { required: true, existingPaths: ['C:/Users/qa/AppData/Roaming/PlotFlow'] },
  });
  assert.deepEqual(blockers, [
    'Environment preflight did not pass.',
    'Git worktree is not clean.',
    'Installer SHA256 does not match the release manifest.',
    'Installed executable does not match the packaged executable.',
    'PlotFlow user profile already exists.',
  ]);
  assert.deepEqual(validateEnvironment({}), [
    'missing environment field: schemaVersion',
    'missing environment field: collectedAt',
    'missing environment field: pack',
    'missing environment field: revision',
    'missing environment field: preflightStatus',
    'missing environment field: windows',
    'missing environment field: host',
    'missing environment field: installer',
    'missing environment field: installedExecutable',
  ]);
});
