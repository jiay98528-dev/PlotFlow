import assert from 'node:assert/strict';
import test from 'node:test';
import {
  REQUIRED_CASES,
  REVIEW_PACKS,
  derivePackStatus,
  isSafeRelativePath,
  summarizeReview,
  validateEnvironment,
  validateLocalArtifactBytes,
  validatePackResult,
  validateTranscriptDocument,
} from './review-contract.mjs';

const revision = 'a'.repeat(40);
const hash = 'b'.repeat(64);
const time = '2026-07-12T00:00:00.000Z';

function passingResult(pack) {
  return {
    schemaVersion: 2,
    pack,
    status: 'PASS',
    revision,
    startedAt: time,
    finishedAt: '2026-07-12T00:10:00.000Z',
    actor: { id: 'reviewer-1', role: REQUIRED_CASES[pack].cases[0].actors[0] },
    findings: [],
    executions: REQUIRED_CASES[pack].cases.map((definition) => ({
      caseId: definition.id,
      status: 'PASS',
      actor: { id: 'reviewer-1', role: definition.actors[0] },
      startedAt: time,
      finishedAt: '2026-07-12T00:01:00.000Z',
      exitCode: 0,
      counters: { total: definition.steps.length, passed: definition.steps.length, failed: 0, skipped: 0 },
      steps: definition.steps.map((id) => ({ id, status: 'PASS' })),
      transcript: { path: `transcripts/${definition.id}.txt`, sha256: hash },
      artifacts: definition.artifacts.map((kind) => ({ kind, path: `artifacts/${definition.id}-${kind}.bin`, sha256: hash, bytes: 1 })),
    })),
  };
}

test('all required executions derive a five-pack PASS gate', () => {
  const results = REVIEW_PACKS.map(passingResult);
  assert.ok(results.every((result) => validatePackResult(result).length === 0));
  assert.equal(summarizeReview(results).gate, 'PASS');
});

test('empty-shell PASS, skipped and zero-test executions cannot pass', () => {
  assert.ok(validatePackResult({ pack: REVIEW_PACKS[0], status: 'PASS', revision, startedAt: time, finishedAt: time }).length > 0);
  const skipped = passingResult(REVIEW_PACKS[0]);
  skipped.executions[0].counters = { total: 1, passed: 0, failed: 0, skipped: 1 };
  assert.match(validatePackResult(skipped).join('\n'), /cannot skip|contradicts/);
  const zero = passingResult(REVIEW_PACKS[0]);
  zero.executions[0].counters = { total: 0, passed: 0, failed: 0, skipped: 0 };
  assert.match(validatePackResult(zero).join('\n'), /zero-test/);
});

test('PASS cannot hide a failed step or a different execution actor', () => {
  const failedStep = passingResult(REVIEW_PACKS[0]);
  failedStep.executions[0].steps[0].status = 'FAIL';
  assert.match(validatePackResult(failedStep).join('\n'), /non-passing step/);

  const borrowedExecution = passingResult(REVIEW_PACKS[0]);
  borrowedExecution.executions[0].actor.id = 'different-reviewer';
  assert.match(validatePackResult(borrowedExecution).join('\n'), /must match the pack reviewer/);
});

test('self-invented steps and remote artifacts cannot manufacture PASS', () => {
  const result = passingResult(REVIEW_PACKS[0]);
  result.executions[0].steps = [{ id: 'I did nothing', status: 'PASS' }];
  result.executions[0].artifacts[0] = {
    kind: result.executions[0].artifacts[0].kind,
    url: 'https://example.invalid/self-claim',
    sha256: hash,
    bytes: 1,
  };
  const errors = validatePackResult(result).join('\n');
  assert.match(errors, /fixed case contract/);
  assert.match(errors, /missing valid/);
});

test('remote artifacts must bind the official repository and workflow', () => {
  const result = passingResult(REVIEW_PACKS[0]);
  result.executions[0].artifacts[0] = {
    kind: result.executions[0].artifacts[0].kind,
    url: 'https://github.com/attacker/PlotFlow/actions/runs/123/artifacts/456',
    sha256: hash, bytes: 100,
    provenance: { provider: 'github-actions', repository: 'attacker/PlotFlow', workflowPath: '.github/workflows/release-validation.yml', runId: 123, runAttempt: 1, artifactId: 456, artifactName: 'fake' },
  };
  assert.match(validatePackResult(result).join('\n'), /missing valid/);
});

test('semantic evidence rejects header-only media, empty payloads, and self-described transcript shells', () => {
  const execution = passingResult('install-integrity').executions[0];
  const fakeMp4 = Buffer.alloc(64 * 1024);
  fakeMp4.writeUInt32BE(fakeMp4.length, 0);
  fakeMp4.write('ftyp', 4, 'ascii');
  assert.match(validateLocalArtifactBytes({ kind: 'video', path: 'fake.mp4' }, fakeMp4, execution, revision).join('\n'), /complete MP4/);
  const emptyEnvelope = Buffer.from(JSON.stringify({ schemaVersion: 2, revision, caseId: execution.caseId, generatedAt: time, payload: {} }));
  assert.match(validateLocalArtifactBytes({ kind: 'installer-manifest', path: 'manifest.json' }, emptyEnvelope, execution, revision).join('\n'), /envelope/);
  const transcript = {
    schemaVersion: 2, caseId: execution.caseId, actor: execution.actor,
    startedAt: execution.startedAt, finishedAt: execution.finishedAt, exitCode: 0,
    counters: execution.counters, steps: execution.steps,
    producer: { kind: 'manual-observation', name: 'AI', version: '1' },
    events: execution.steps.map((step) => ({ stepId: step.id, outcome: 'PASS', at: execution.startedAt, action: 'self claim', evidenceRefs: ['not-an-artifact'] })),
  };
  assert.match(validateTranscriptDocument(transcript, execution).join('\n'), /invalid step event/);
});

test('status is derived and open P1 findings block PASS', () => {
  const result = passingResult(REVIEW_PACKS[0]);
  result.findings.push({
    id: 'P1-1', kind: 'product-defect', severity: 'P1', status: 'MITIGATED',
    summary: 'save failed', caseIds: [REQUIRED_CASES[REVIEW_PACKS[0]].cases[0].id],
    expected: 'save succeeds', actual: 'save fails', reproduction: { occurrences: 1, attempts: 1 },
  });
  assert.equal(derivePackStatus(result), 'FAIL');
  assert.match(validatePackResult(result).join('\n'), /contradicts derived status FAIL/);
});

test('unsafe evidence paths are rejected', () => {
  assert.equal(isSafeRelativePath('transcripts/run.txt'), true);
  assert.equal(isSafeRelativePath('../run.txt'), false);
  assert.equal(isSafeRelativePath('C:/run.txt'), false);
  assert.equal(isSafeRelativePath('folder\\run.txt'), false);
});

test('environment requires clean hashes and exact installed registration', () => {
  const blockers = validateEnvironment({
    schemaVersion: 2,
    collectedAt: time,
    pack: REVIEW_PACKS[0],
    revision,
    preflightStatus: 'PASS',
    windows: { caption: 'Windows 11', version: '10.0.26100', build: '26100', uiCulture: 'zh-CN', userLanguages: ['zh-CN'], dpi: 96, scalePercent: 100, screens: [{ deviceName: 'DISPLAY1', width: 1920, height: 1080 }] },
    host: { manufacturer: 'Microsoft', model: 'Virtual Machine', hypervisorPresent: true, user: 'reviewer' },
    repository: { dirty: false, status: [] },
    installer: { path: 'installer.exe', sha256: hash, bytes: 1, fileVersion: '0.1.0', productVersion: '0.1.0', authenticode: 'NotSigned' },
    installedExecutable: { path: 'PlotFlow.exe', sha256: hash, bytes: 1, fileVersion: '0.1.0', productVersion: '0.1.0', authenticode: 'NotSigned' },
    releaseManifest: { path: 'SHA256SUMS.txt', sha256: hash, bytes: 1, installerExpected: hash, executableExpected: hash },
    releaseArtifact: { kind: 'release-binaries', url: `https://github.com/jiay98528-dev/PlotFlow/actions/runs/123/artifacts/456`, sha256: hash, bytes: 1, provenance: { provider: 'github-actions', repository: 'jiay98528-dev/PlotFlow', workflowPath: '.github/workflows/release-validation.yml', runId: 123, runAttempt: 1, artifactId: 456, artifactName: `plotflow-windows-${revision}` } },
    installReceipt: { path: 'install-receipt.json', sha256: hash, bytes: 1 },
    registration: { valid: false, receiptSha256: hash, installedDirectory: 'D:/Test/PlotFlow', matchingUninstallEntries: [], associationExecutable: 'D:/Test/PlotFlow/PlotFlow.exe', iconExecutable: 'D:/Test/PlotFlow/file.ico' },
    cleanProfile: { required: false, existingPaths: [] },
  });
  assert.deepEqual(blockers, ['Installed registration is not bound to the exact executable.']);
});

test('environment cannot self-report PASS without repository and manifest evidence', () => {
  const blockers = validateEnvironment({
    schemaVersion: 2, collectedAt: time, pack: REVIEW_PACKS[0], revision,
    preflightStatus: 'PASS', windows: {}, host: {}, installer: {}, installedExecutable: {},
    registration: { valid: true }, cleanProfile: { required: false, existingPaths: [] },
  });
  assert.ok(blockers.length > 0);
  assert.match(blockers.join('\n'), /releaseManifest|worktree|manifest evidence/i);
});
