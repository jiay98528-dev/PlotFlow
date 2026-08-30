import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { REQUIRED_CASES } from './review-contract.mjs';
import { parseZipEntries } from './zip-evidence.mjs';

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'finalize-evidence.mjs');
const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const revision = 'a'.repeat(40);
const time = '2026-07-12T00:00:00.000Z';
function hash(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function storedZip(name, data) {
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30 + nameBytes.length + data.length);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBytes.length, 26);
  nameBytes.copy(local, 30); data.copy(local, 30 + nameBytes.length);
  const central = Buffer.alloc(46 + nameBytes.length);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBytes.length, 28); nameBytes.copy(central, 46);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(local.length, 16);
  return Buffer.concat([local, central, eocd]);
}
function mp4Box(type, size) {
  const bytes = Buffer.alloc(size);
  bytes.writeUInt32BE(size, 0);
  bytes.write(type, 4, 'ascii');
  return bytes;
}
function jsonPayload(kind) {
  if (kind === 'installer-manifest') return { installerSha256: hash('installer'), executableSha256: hash('executable'), installerBytes: 10, executableBytes: 10 };
  if (kind === 'registry-snapshot') return { uninstallEntries: [{ id: 'entry' }], fileAssociation: { extension: '.mdstory' }, installReceiptSha256: hash('receipt') };
  throw new Error(`Missing fixture payload for ${kind}`);
}
function artifactFixture(kind, caseId) {
  if (kind === 'video') {
    const bytes = Buffer.concat([mp4Box('ftyp', 24), mp4Box('moov', 16), mp4Box('mdat', 65536 - 40)]);
    return { extension: 'mp4', bytes };
  }
  return {
    extension: 'json',
    bytes: Buffer.from(JSON.stringify({ schemaVersion: 2, revision, caseId, generatedAt: time, payload: jsonPayload(kind) })),
  };
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'plotflow-review-'));
  await mkdir(path.join(root, 'transcripts'));
  await mkdir(path.join(root, 'artifacts'));
  const executions = [];
  for (const definition of REQUIRED_CASES['install-integrity'].cases) {
    const artifacts = [];
    for (const kind of definition.artifacts) {
      const fixtureArtifact = artifactFixture(kind, definition.id);
      const artifactPath = `artifacts/${definition.id}-${kind}.${fixtureArtifact.extension}`;
      const bytes = fixtureArtifact.bytes;
      await writeFile(path.join(root, artifactPath), bytes);
      artifacts.push({ kind, path: artifactPath, bytes: bytes.length, sha256: hash(bytes) });
    }
    const execution = {
      caseId: definition.id, status: 'PASS', actor: { id: 'reviewer', role: 'external-gui-reviewer' },
      startedAt: time, finishedAt: time, exitCode: 0,
      counters: { total: definition.steps.length, passed: definition.steps.length, failed: 0, skipped: 0 },
      steps: definition.steps.map((id) => ({ id, status: 'PASS' })), artifacts,
    };
    const transcriptPath = `transcripts/${definition.id}.json`;
    const transcript = Buffer.from(JSON.stringify({
      schemaVersion: 2, caseId: definition.id, actor: execution.actor,
      startedAt: time, finishedAt: time, exitCode: 0, counters: execution.counters, steps: execution.steps,
      producer: { kind: 'computer-use', name: 'Computer Use', version: '1' },
      events: definition.steps.map((stepId) => ({ stepId, at: time, action: `execute ${stepId}`, outcome: 'PASS', evidenceRefs: [artifacts[0].path] })),
    }));
    await writeFile(path.join(root, transcriptPath), transcript);
    executions.push({ ...execution, transcript: { path: transcriptPath, sha256: hash(transcript) } });
  }
  const result = {
    schemaVersion: 2, pack: 'install-integrity', status: 'PASS', revision,
    startedAt: time, finishedAt: time, actor: { id: 'reviewer', role: 'external-gui-reviewer' }, findings: [], executions,
  };
  const raw = Buffer.from(`${JSON.stringify({ schemaVersion: 2, revision, actor: result.actor, executions, findings: [] })}\n`);
  await writeFile(path.join(root, 'raw-report.json'), raw);
  await writeFile(path.join(root, 'result.json'), JSON.stringify(result));
  const receiptBytes = Buffer.from(JSON.stringify({
    schemaVersion: 2, createdAt: time, registrationId: '74fc8b73-b58d-5573-82e7-75efc9ec526f', installRoot: 'D:/Test/Fablevia',
    executablePath: 'D:/Test/Fablevia/Fablevia.exe', executableSha256: hash('executable'),
    uninstallerPath: 'D:/Test/Fablevia/Uninstall Fablevia.exe', uninstallerSha256: hash('uninstaller'),
  }));
  await writeFile(path.join(root, 'install-receipt.json'), receiptBytes);
  await writeFile(path.join(root, 'environment.json'), JSON.stringify({
    schemaVersion: 2, collectedAt: time, pack: result.pack, revision, preflightStatus: 'PASS',
    repository: { dirty: false, status: [] },
    windows: { caption: 'Windows 11', version: '10.0.26100', build: '26100', uiCulture: 'zh-CN', userLanguages: ['zh-CN'], dpi: 96, scalePercent: 100, screens: [{ deviceName: 'DISPLAY1', width: 1920, height: 1080 }] },
    host: { manufacturer: 'Microsoft', model: 'Virtual Machine', hypervisorPresent: true, user: 'reviewer' },
    installer: { path: 'installer.exe', sha256: hash('installer'), bytes: 1, fileVersion: '0.1.0', productVersion: '0.1.0', authenticode: 'NotSigned' },
    installedExecutable: { path: 'D:/Test/Fablevia/Fablevia.exe', sha256: hash('executable'), bytes: 1, fileVersion: '0.1.0', productVersion: '0.1.0', authenticode: 'NotSigned' },
    releaseManifest: { path: 'SHA256SUMS.txt', sha256: hash('manifest'), bytes: 1, installerExpected: hash('installer'), executableExpected: hash('executable') },
    releaseArtifact: { kind: 'release-binaries', url: 'https://github.com/jiay98528-dev/PlotFlow/actions/runs/123/artifacts/456', sha256: hash('archive'), bytes: 10, provenance: { provider: 'github-actions', repository: 'jiay98528-dev/PlotFlow', workflowPath: '.github/workflows/release-validation.yml', runId: 123, runAttempt: 1, artifactId: 456, artifactName: `plotflow-windows-${revision}` } },
    installReceipt: { path: 'install-receipt.json', sha256: hash(receiptBytes), bytes: receiptBytes.length },
    registration: { valid: true, extensionClass: 'Fablevia.Story', installedDirectory: 'D:/Test/Fablevia', matchingUninstallEntries: [{ registrationId: '74fc8b73-b58d-5573-82e7-75efc9ec526f', installLocation: 'D:/Test/Fablevia', quietUninstallString: '"D:\\Test\\Fablevia\\Uninstall Fablevia.exe" /S' }], associationExecutable: 'D:/Test/Fablevia/Fablevia.exe', iconExecutable: 'D:/Test/Fablevia/file.ico', uninstaller: { path: 'D:/Test/Fablevia/Uninstall Fablevia.exe', sha256: hash('uninstaller'), bytes: 1 }, receiptSha256: hash(receiptBytes), receipt: { installRoot: 'D:/Test/Fablevia', executableSha256: hash('executable'), uninstallerSha256: hash('uninstaller') } },
    cleanProfile: { required: false, existingPaths: [] },
  }));
  await writeFile(path.join(root, 'transcription.json'), JSON.stringify({
    schemaVersion: 2, revision, verifiedBy: result.actor,
    rawReport: { path: 'raw-report.json', sha256: hash(raw) }, executions, findings: [],
  }));
  return root;
}

test('finalizer emits only a pending, hash-bound manifest', async () => {
  const root = await fixture();
  execFileSync(process.execPath, [script, '--evidence-dir', root]);
  const manifest = JSON.parse(await readFile(path.join(root, 'pack-manifest.json'), 'utf8'));
  assert.equal(manifest.verificationStatus, 'PENDING_TRACKED_VERIFICATION');
  assert.equal(manifest.candidateStatus, 'PASS');
  assert.ok(manifest.files.length > 4);
  assert.ok(manifest.files.some((record) => record.path === 'install-receipt.json'));
});

test('ZIP evidence parser reads complete stored archives and rejects empty shells', () => {
  const entries = parseZipEntries(storedZip('evidence.txt', Buffer.from('proof')));
  assert.equal(entries[0].name, 'evidence.txt');
  assert.equal(entries[0].data.toString(), 'proof');
  assert.throws(() => parseZipEntries(Buffer.from('PK')));
});

test('finalizer rejects transcript tampering', async () => {
  const root = await fixture();
  await writeFile(path.join(root, `transcripts/${REQUIRED_CASES['install-integrity'].cases[0].id}.json`), 'tampered');
  assert.throws(() => execFileSync(process.execPath, [script, '--evidence-dir', root], { stdio: 'pipe' }));
});

test('finalizer rejects hash-consistent but semantically empty artifacts', async () => {
  const root = await fixture();
  const result = JSON.parse(await readFile(path.join(root, 'result.json'), 'utf8'));
  const raw = JSON.parse(await readFile(path.join(root, 'raw-report.json'), 'utf8'));
  const transcription = JSON.parse(await readFile(path.join(root, 'transcription.json'), 'utf8'));
  const artifact = result.executions[0].artifacts[0];
  const invalidBytes = Buffer.alloc(artifact.bytes);
  const invalidHash = hash(invalidBytes);
  await writeFile(path.join(root, artifact.path), invalidBytes);
  for (const document of [result, raw, transcription]) {
    const match = document.executions[0].artifacts.find((item) => item.path === artifact.path);
    match.sha256 = invalidHash;
  }
  const rawBytes = Buffer.from(`${JSON.stringify(raw)}\n`);
  transcription.rawReport.sha256 = hash(rawBytes);
  await writeFile(path.join(root, 'result.json'), JSON.stringify(result));
  await writeFile(path.join(root, 'raw-report.json'), rawBytes);
  await writeFile(path.join(root, 'transcription.json'), JSON.stringify(transcription));
  assert.throws(() => execFileSync(process.execPath, [script, '--evidence-dir', root], { stdio: 'pipe' }));
});

test('tracked verifier re-derives conservation and compares committed Git blobs', async () => {
  const source = await readFile(path.join(toolRoot, 'verify-evidence.mjs'), 'utf8');
  assert.match(source, /rawReport\.executions/);
  assert.match(source, /transcription\.executions/);
  assert.match(source, /gitBytes\(\['show'/);
  assert.match(source, /ls-files', '-v'/);
  assert.match(source, /independently derived required evidence/);
  assert.match(source, /api\.github\.com\/repos/);
  assert.match(source, /run\.head_sha !== revision/);
  assert.match(source, /run\.conclusion !== 'success'/);
  assert.match(source, /OFFICIAL_REVIEW_REPOSITORY/);
  assert.match(source, /run\.path !== OFFICIAL_REVIEW_WORKFLOW/);
  assert.match(source, /verifyReleaseEnvironment/);
  assert.match(source, /Remote screenshots archive contains no PNG evidence/);
});

test('installed helper refuses pre-existing state and cleans only with a same-run hash receipt', async () => {
  const source = await readFile(path.join(toolRoot, 'install-release-candidate.ps1'), 'utf8');
  assert.match(source, /74fc8b73-b58d-5573-82e7-75efc9ec526f/);
  assert.match(source, /Refusing an unknown Fablevia uninstall registration/);
  assert.match(source, /Refusing to terminate an unverified Fablevia process/);
  assert.match(source, /RequireInstallLocation/);
  assert.match(source, /Install mode refuses all pre-existing Fablevia or legacy uninstall registrations/);
  assert.match(source, /Install receipt hash mismatch/);
  assert.match(source, /Registered uninstaller does not match the same-run receipt/);
  assert.doesNotMatch(source, /Get-Process -Name Fablevia[^\r\n]*\| Stop-Process/);
});

test('release workflow carries upload provenance and same-run receipt into cleanup', async () => {
  const workflow = await readFile(path.resolve(toolRoot, '../../.github/workflows/release-validation.yml'), 'utf8');
  assert.match(workflow, /id: release-upload/);
  assert.match(workflow, /artifact-digest/);
  assert.match(workflow, /PLOTFLOW_INSTALL_RECEIPT_SHA256/);
  assert.match(workflow, /-ExpectedReceiptHash \$env:PLOTFLOW_INSTALL_RECEIPT_SHA256/);
  assert.match(workflow, /actions\/artifacts\/\$env:RELEASE_ARTIFACT_ID/);
});
