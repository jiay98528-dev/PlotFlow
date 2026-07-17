import { createHash } from 'node:crypto';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSafeRelativePath, OFFICIAL_REVIEW_REPOSITORY, OFFICIAL_REVIEW_WORKFLOW, validPngEvidence, validateEnvironment, validateInstallReceiptDocument, validateLocalArtifactBytes, validatePackResult, validateTranscriptDocument } from './review-contract.mjs';
import { parseZipEntries } from './zip-evidence.mjs';

function argument(name) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
function git(args, cwd) { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }
function gitBytes(args, cwd) { return execFileSync('git', args, { cwd, encoding: 'buffer' }); }
function stable(value) { return JSON.stringify(value); }

async function fetchVerifiedRemoteArtifact(artifact, revision) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/actions\/runs\/(\d+)\/artifacts\/(\d+)$/.exec(artifact.url);
  if (!match) throw new Error(`Unsupported remote artifact URL: ${artifact.url}`);
  const [, owner, repo, runId, artifactId] = match;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'PlotFlow-evidence-verifier',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
  };
  const request = async (url) => {
    const response = await fetch(url, { headers, redirect: 'follow' });
    if (!response.ok) throw new Error(`GitHub artifact verification failed (${response.status}) for ${artifact.url}`);
    return response;
  };
  const [metadataResponse, runResponse] = await Promise.all([
    request(`https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}`),
    request(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`),
  ]);
  const metadata = await metadataResponse.json();
  const run = await runResponse.json();
  if (String(metadata.id) !== artifactId || String(metadata.workflow_run?.id) !== runId || metadata.expired
    || `${owner}/${repo}`.toLowerCase() !== OFFICIAL_REVIEW_REPOSITORY.toLowerCase()
    || run.repository?.full_name?.toLowerCase() !== OFFICIAL_REVIEW_REPOSITORY.toLowerCase()
    || run.head_repository?.full_name?.toLowerCase() !== OFFICIAL_REVIEW_REPOSITORY.toLowerCase()
    || run.path !== OFFICIAL_REVIEW_WORKFLOW || !['workflow_dispatch', 'schedule'].includes(run.event)
    || String(run.id) !== runId || run.head_sha !== revision || run.conclusion !== 'success'
    || run.run_attempt !== artifact.provenance.runAttempt || metadata.name !== artifact.provenance.artifactName) {
    throw new Error(`Remote artifact provenance does not match successful candidate ${revision}.`);
  }
  const archive = Buffer.from(await (await request(`https://api.github.com/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`)).arrayBuffer());
  if (archive.length !== artifact.bytes || sha256(archive) !== artifact.sha256.toUpperCase()) {
    throw new Error(`Downloaded remote artifact hash/size mismatch: ${artifact.url}`);
  }
  const entries = parseZipEntries(archive).filter((entry) => !entry.isDirectory);
  if (entries.length === 0 || entries.some((entry) => !isSafeRelativePath(entry.name))) {
    throw new Error(`Remote artifact archive is empty or contains an unsafe path: ${artifact.url}`);
  }
  return entries;
}

async function verifyRemoteArtifact(artifact, revision, execution) {
  const entries = await fetchVerifiedRemoteArtifact(artifact, revision);
  if (artifact.kind === 'screenshots') {
    if (!entries.some((entry) => entry.name.toLowerCase().endsWith('.png') && validPngEvidence(entry.data))) {
      throw new Error('Remote screenshots archive contains no PNG evidence.');
    }
    return;
  }
  if (artifact.kind === 'recovery-outputs') {
    const manifestEntry = entries.find((entry) => entry.name === 'manifest.json');
    if (!manifestEntry) throw new Error('Remote recovery archive contains no manifest.');
    let document;
    try { document = JSON.parse(manifestEntry.data.toString('utf8')); } catch { throw new Error('Remote recovery manifest is invalid JSON.'); }
    if (document.schemaVersion !== 2 || document.revision !== revision || document.caseId !== execution.caseId
      || !Array.isArray(document.files) || document.files.length === 0
      || document.files.some((name) => !isSafeRelativePath(name) || !entries.some((entry) => entry.name === name && entry.data.length > 0))) {
      throw new Error('Remote recovery archive manifest does not bind non-empty outputs.');
    }
    return;
  }
  const hasValidPayload = entries.some((entry) => validateLocalArtifactBytes(
    { ...artifact, path: entry.name }, entry.data,
    execution, revision,
  ).length === 0);
  if (!hasValidPayload) throw new Error(`Remote artifact archive has no valid ${artifact.kind} payload.`);
}

async function verifyReleaseEnvironment(environment) {
  const entries = await fetchVerifiedRemoteArtifact(environment.releaseArtifact, environment.revision);
  const manifestEntry = entries.find((entry) => entry.name.endsWith('/SHA256SUMS.txt') || entry.name === 'SHA256SUMS.txt');
  const installerEntry = entries.find((entry) => /(?:^|\/)Fablevia Setup .+\.exe$/.test(entry.name));
  const executableEntry = entries.find((entry) => entry.name.endsWith('win-unpacked/Fablevia.exe'));
  if (!manifestEntry || !installerEntry || !executableEntry) throw new Error('Official release artifact lacks installer, executable, or SHA256 manifest.');
  const manifestBytes = manifestEntry.data;
  const installerBytes = installerEntry.data;
  const executableBytes = executableEntry.data;
  if (sha256(manifestBytes) !== environment.releaseManifest.sha256.toUpperCase() || manifestBytes.length !== environment.releaseManifest.bytes
    || sha256(installerBytes) !== environment.installer.sha256.toUpperCase() || installerBytes.length !== environment.installer.bytes
    || sha256(executableBytes) !== environment.installedExecutable.sha256.toUpperCase() || executableBytes.length !== environment.installedExecutable.bytes) {
    throw new Error('Environment binary hashes are not bound to the official release artifact bytes.');
  }
  const manifest = manifestBytes.toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  if (!manifest.some((line) => line.toUpperCase().startsWith(`${environment.installer.sha256.toUpperCase()} `) && line.endsWith(installerEntry.name.split('/').at(-1)))
    || !manifest.some((line) => line.toUpperCase().startsWith(`${environment.installedExecutable.sha256.toUpperCase()} `) && /win-unpacked\/PlotFlow\.exe$/i.test(line))) {
    throw new Error('Official SHA256 manifest does not bind the environment binaries.');
  }
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixedRoot = path.join(repoRoot, 'spec', 'external-review', 'evidence');
const evidenceDir = path.resolve(argument('evidence-dir') ?? '');
const fixedReal = await realpath(fixedRoot);
const evidenceReal = await realpath(evidenceDir);
if (evidenceReal !== fixedReal && !evidenceReal.startsWith(`${fixedReal}${path.sep}`)) throw new Error('Evidence must live under spec/external-review/evidence/.');

const relativePackDir = path.relative(repoRoot, evidenceDir).replaceAll(path.sep, '/');
if (!isSafeRelativePath(relativePackDir)) throw new Error('Invalid tracked evidence directory.');
const manifest = JSON.parse(await readFile(path.join(evidenceDir, 'pack-manifest.json'), 'utf8'));
const result = JSON.parse(await readFile(path.join(evidenceDir, 'result.json'), 'utf8'));
const environment = JSON.parse(await readFile(path.join(evidenceDir, 'environment.json'), 'utf8'));
const rawBytes = await readFile(path.join(evidenceDir, 'raw-report.json'));
const rawReport = JSON.parse(rawBytes.toString('utf8'));
const transcription = JSON.parse(await readFile(path.join(evidenceDir, 'transcription.json'), 'utf8'));
const errors = validatePackResult(result);
if (errors.length) throw new Error(errors.join('\n'));
const blockers = validateEnvironment(environment);
if (blockers.length) throw new Error(blockers.join('\n'));
if (environment.revision !== result.revision || environment.pack !== result.pack) throw new Error('Environment and result identity do not match.');
await verifyReleaseEnvironment(environment);
if (manifest.schemaVersion !== 2 || manifest.candidateRevision !== result.revision) throw new Error('Manifest candidate does not match result.');
if (manifest.pack !== result.pack || manifest.candidateStatus !== 'PASS'
  || manifest.verificationStatus !== 'PENDING_TRACKED_VERIFICATION') {
  throw new Error('Manifest status or pack identity is invalid.');
}
if (rawReport?.schemaVersion !== 2 || rawReport?.revision !== result.revision
  || rawReport?.actor?.id !== result.actor.id || rawReport?.actor?.role !== result.actor.role) {
  throw new Error('Raw report identity does not match the candidate and actor.');
}
if (transcription?.schemaVersion !== 2 || transcription?.revision !== result.revision
  || transcription?.verifiedBy?.id !== result.actor.id || transcription?.verifiedBy?.role !== result.actor.role
  || transcription?.rawReport?.path !== 'raw-report.json'
  || transcription?.rawReport?.sha256?.toUpperCase() !== sha256(rawBytes)) {
  throw new Error('Transcription does not bind the immutable raw report and reviewer.');
}
if (stable(rawReport.executions) !== stable(result.executions)
  || stable(transcription.executions) !== stable(result.executions)
  || stable(rawReport.findings ?? []) !== stable(result.findings ?? [])
  || stable(transcription.findings ?? []) !== stable(result.findings ?? [])) {
  throw new Error('Raw report, transcription and structured result do not conserve executions/findings.');
}
if (relativePackDir !== `spec/external-review/evidence/${result.revision}/${result.pack}`) {
  throw new Error('Evidence directory must be keyed by the exact candidate revision and pack.');
}
if (git(['status', '--porcelain=v1'], repoRoot)) throw new Error('Formal evidence verification requires a completely clean worktree.');

git(['merge-base', '--is-ancestor', result.revision, 'HEAD'], repoRoot);
for (const finding of result.findings ?? []) {
  if (finding.status !== 'CLOSED' || !['P0', 'P1'].includes(finding.severity)) continue;
  git(['cat-file', '-e', `${finding.closure.fixRevision}^{commit}`], repoRoot);
  git(['merge-base', '--is-ancestor', finding.closure.fixRevision, result.revision], repoRoot);
  for (const caseId of finding.closure.retestCaseIds) {
    if (!result.executions.some((execution) => execution.caseId === caseId && execution.status === 'PASS')) {
      throw new Error(`Closed finding ${finding.id} lacks a passing retest execution for ${caseId}.`);
    }
  }
}
const changedAfterCandidate = git(['diff', '--name-only', `${result.revision}..HEAD`], repoRoot).split(/\r?\n/).filter(Boolean);
if (changedAfterCandidate.some((name) => !name.startsWith('spec/external-review/evidence/'))) {
  throw new Error('Product, contract, or validator changed after the audited candidate.');
}

const requiredPaths = new Set(['result.json', 'environment.json', 'raw-report.json', 'transcription.json']);
requiredPaths.add(environment.installReceipt.path);
for (const execution of result.executions) {
  requiredPaths.add(execution.transcript.path);
  for (const artifact of execution.artifacts) if (artifact.path) requiredPaths.add(artifact.path);
}
const receiptRecord = manifest.files.find((record) => record.path === environment.installReceipt.path);
if (receiptRecord.sha256 !== environment.installReceipt.sha256.toUpperCase() || receiptRecord.bytes !== environment.installReceipt.bytes) {
  throw new Error('Install receipt mismatch.');
}
const receiptDocument = JSON.parse(await readFile(path.join(evidenceDir, environment.installReceipt.path), 'utf8'));
const receiptErrors = validateInstallReceiptDocument(receiptDocument, environment);
if (receiptErrors.length) throw new Error(`Invalid install receipt: ${receiptErrors.join('; ')}`);
for (const finding of result.findings ?? []) {
  if (finding.status === 'CLOSED' && finding.closure?.evidence?.path) requiredPaths.add(finding.closure.evidence.path);
}
const manifestPaths = new Set(manifest.files.map((record) => record.path));
if (manifestPaths.size !== manifest.files.length
  || [...requiredPaths].some((name) => !manifestPaths.has(name))
  || [...manifestPaths].some((name) => !requiredPaths.has(name))) {
  throw new Error('Manifest inventory does not match independently derived required evidence.');
}
const expectedTracked = new Set([...requiredPaths, 'pack-manifest.json', 'SHA256SUMS.txt']);
const actualTracked = git(['ls-files', '--', `${relativePackDir}/`], repoRoot)
  .split(/\r?\n/).filter(Boolean).map((name) => name.slice(relativePackDir.length + 1));
if (actualTracked.some((name) => !expectedTracked.has(name)) || [...expectedTracked].some((name) => !actualTracked.includes(name))) {
  throw new Error('Tracked evidence inventory does not match the immutable manifest.');
}

for (const record of [...manifest.files, { path: 'pack-manifest.json' }, { path: 'SHA256SUMS.txt' }]) {
  if (!isSafeRelativePath(record.path)) throw new Error(`Unsafe manifest path: ${record.path}`);
  const absolute = path.join(evidenceDir, record.path);
  const resolved = await realpath(absolute);
  if (resolved !== evidenceReal && !resolved.startsWith(`${evidenceReal}${path.sep}`)) throw new Error(`Evidence path escapes root: ${record.path}`);
  const info = await lstat(absolute);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Evidence is not a regular file: ${record.path}`);
  const trackedPath = `${relativePackDir}/${record.path}`;
  git(['ls-files', '--error-unmatch', '--', trackedPath], repoRoot);
  const trackedFlags = git(['ls-files', '-v', '--', trackedPath], repoRoot);
  if (!trackedFlags.startsWith('H ')) throw new Error(`Evidence has assume-unchanged/skip-worktree flags: ${record.path}`);
  if (git(['status', '--porcelain=v1', '--', trackedPath], repoRoot)) throw new Error(`Evidence has uncommitted changes: ${record.path}`);
  const bytes = await readFile(absolute);
  const blobBytes = gitBytes(['show', `HEAD:${trackedPath}`], repoRoot);
  if (!bytes.equals(blobBytes)) throw new Error(`Working evidence differs from the committed Git blob: ${record.path}`);
  if (record.bytes !== undefined && (bytes.length !== record.bytes || sha256(bytes) !== record.sha256)) {
    throw new Error(`Tracked evidence hash mismatch: ${record.path}`);
  }
}
for (const execution of result.executions) {
  const transcript = manifest.files.find((record) => record.path === execution.transcript.path);
  if (transcript.sha256 !== execution.transcript.sha256.toUpperCase()) throw new Error(`Transcript hash mismatch: ${transcript.path}`);
  const transcriptBytes = await readFile(path.join(evidenceDir, execution.transcript.path));
  let transcriptDocument;
  try { transcriptDocument = JSON.parse(transcriptBytes.toString('utf8')); } catch { throw new Error(`Transcript must be structured JSON: ${transcript.path}`); }
  const transcriptErrors = validateTranscriptDocument(transcriptDocument, execution);
  if (transcriptErrors.length) throw new Error(`Invalid transcript ${transcript.path}: ${transcriptErrors.join('; ')}`);
  for (const artifact of execution.artifacts) {
    if (artifact.url) {
      await verifyRemoteArtifact(artifact, result.revision, execution);
      continue;
    }
    if (!artifact.path) continue;
    const record = manifest.files.find((item) => item.path === artifact.path);
    if (record.sha256 !== artifact.sha256.toUpperCase() || record.bytes !== artifact.bytes) throw new Error(`Artifact mismatch: ${artifact.path}`);
    const artifactBytes = await readFile(path.join(evidenceDir, artifact.path));
    const artifactErrors = validateLocalArtifactBytes(artifact, artifactBytes, execution, result.revision);
    if (artifactErrors.length) throw new Error(`Invalid artifact ${artifact.path}: ${artifactErrors.join('; ')}`);
  }
}
for (const finding of result.findings ?? []) {
  if (finding.status !== 'CLOSED' || !finding.closure?.evidence?.path) continue;
  const record = manifest.files.find((item) => item.path === finding.closure.evidence.path);
  if (record.sha256 !== finding.closure.evidence.sha256.toUpperCase()
    || record.bytes !== finding.closure.evidence.bytes) throw new Error(`Finding closure evidence mismatch: ${finding.id}`);
}
const expectedSums = `${manifest.files.map((record) => `${record.sha256} *${record.path}`).join('\n')}\n`;
if (await readFile(path.join(evidenceDir, 'SHA256SUMS.txt'), 'utf8') !== expectedSums) throw new Error('SHA256SUMS.txt does not match the manifest.');
console.log(`Verified immutable tracked evidence for ${manifest.pack} at candidate ${result.revision}.`);
