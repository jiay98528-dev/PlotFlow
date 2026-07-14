import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { derivePackStatus, isSafeRelativePath, validateEnvironment, validateInstallReceiptDocument, validateLocalArtifactBytes, validatePackResult, validateTranscriptDocument } from './review-contract.mjs';

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex').toUpperCase(); }
function stable(value) { return JSON.stringify(value); }

const evidenceDir = path.resolve(argument('evidence-dir') ?? '');
const evidenceReal = await realpath(evidenceDir);

async function localEvidence(relativePath) {
  if (!isSafeRelativePath(relativePath)) throw new Error(`Unsafe evidence path: ${relativePath}`);
  const absolute = path.resolve(evidenceDir, relativePath);
  const resolved = await realpath(absolute);
  if (resolved !== evidenceReal && !resolved.startsWith(`${evidenceReal}${path.sep}`)) throw new Error(`Evidence escapes pack root: ${relativePath}`);
  const info = await lstat(absolute);
  if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Evidence must be a regular non-symlink file: ${relativePath}`);
  const bytes = await readFile(absolute);
  return { path: relativePath, bytes: info.size, sha256: sha256(bytes) };
}

const [result, environment, transcription, rawBytes] = await Promise.all([
  readFile(path.join(evidenceDir, 'result.json'), 'utf8').then(JSON.parse),
  readFile(path.join(evidenceDir, 'environment.json'), 'utf8').then(JSON.parse),
  readFile(path.join(evidenceDir, 'transcription.json'), 'utf8').then(JSON.parse),
  readFile(path.join(evidenceDir, 'raw-report.json')),
]);
const rawReport = JSON.parse(rawBytes.toString('utf8'));
const errors = validatePackResult(result);
if (errors.length) throw new Error(`Invalid pack result:\n- ${errors.join('\n- ')}`);
const blockers = validateEnvironment(environment);
if (blockers.length) throw new Error(`Environment is not authoritative:\n- ${blockers.join('\n- ')}`);
if (environment.revision !== result.revision || environment.pack !== result.pack) throw new Error('Environment and result identity do not match.');
if (transcription?.schemaVersion !== 2 || transcription?.revision !== result.revision) throw new Error('Transcription revision/schema is invalid.');
if (transcription?.rawReport?.path !== 'raw-report.json' || transcription.rawReport.sha256?.toUpperCase() !== sha256(rawBytes)) {
  throw new Error('Transcription does not bind the immutable raw report.');
}
if (transcription?.verifiedBy?.id !== result.actor.id || transcription?.verifiedBy?.role !== result.actor.role) {
  throw new Error('The same read-only reviewer must verify the transcription.');
}
if (stable(transcription.executions) !== stable(result.executions)) throw new Error('Raw transcription and structured executions do not conserve results.');
if (rawReport?.schemaVersion !== 2 || rawReport?.revision !== result.revision
  || rawReport?.actor?.id !== result.actor.id || rawReport?.actor?.role !== result.actor.role) {
  throw new Error('Raw report identity does not match the candidate and actor.');
}
if (stable(rawReport.executions) !== stable(result.executions)
  || stable(rawReport.findings ?? []) !== stable(result.findings ?? [])
  || stable(transcription.findings ?? []) !== stable(result.findings ?? [])) {
  throw new Error('Raw report, findings and structured transcription do not conserve results.');
}

const requiredPaths = new Set(['result.json', 'environment.json', 'raw-report.json', 'transcription.json']);
requiredPaths.add(environment.installReceipt.path);
for (const execution of result.executions) {
  requiredPaths.add(execution.transcript.path);
  for (const artifact of execution.artifacts) if (artifact.path) requiredPaths.add(artifact.path);
}
for (const finding of result.findings ?? []) {
  if (finding.status === 'CLOSED' && finding.closure?.evidence?.path) {
    requiredPaths.add(finding.closure.evidence.path);
  }
}
const records = [];
for (const relativePath of [...requiredPaths].sort()) records.push(await localEvidence(relativePath));
const receiptRecord = records.find((record) => record.path === environment.installReceipt.path);
if (receiptRecord.sha256 !== environment.installReceipt.sha256.toUpperCase() || receiptRecord.bytes !== environment.installReceipt.bytes) {
  throw new Error('Install receipt local bytes do not match environment evidence.');
}
const receiptDocument = JSON.parse(await readFile(path.join(evidenceDir, environment.installReceipt.path), 'utf8'));
const receiptErrors = validateInstallReceiptDocument(receiptDocument, environment);
if (receiptErrors.length) throw new Error(`Invalid install receipt: ${receiptErrors.join('; ')}`);
for (const execution of result.executions) {
  const transcript = records.find((record) => record.path === execution.transcript.path);
  if (transcript.sha256 !== execution.transcript.sha256.toUpperCase()) throw new Error(`Transcript hash mismatch: ${transcript.path}`);
  const transcriptBytes = await readFile(path.join(evidenceDir, execution.transcript.path));
  let transcriptDocument;
  try { transcriptDocument = JSON.parse(transcriptBytes.toString('utf8')); } catch { throw new Error(`Transcript must be structured JSON: ${transcript.path}`); }
  const transcriptErrors = validateTranscriptDocument(transcriptDocument, execution);
  if (transcriptErrors.length) throw new Error(`Invalid transcript ${transcript.path}: ${transcriptErrors.join('; ')}`);
  for (const artifact of execution.artifacts) {
    if (!artifact.path) continue;
    const record = records.find((item) => item.path === artifact.path);
    if (record.sha256 !== artifact.sha256.toUpperCase() || record.bytes !== artifact.bytes) throw new Error(`Artifact mismatch: ${artifact.path}`);
    const artifactBytes = await readFile(path.join(evidenceDir, artifact.path));
    const artifactErrors = validateLocalArtifactBytes(artifact, artifactBytes, execution, result.revision);
    if (artifactErrors.length) throw new Error(`Invalid artifact ${artifact.path}: ${artifactErrors.join('; ')}`);
  }
}
for (const finding of result.findings ?? []) {
  if (finding.status !== 'CLOSED' || !finding.closure?.evidence?.path) continue;
  const record = records.find((item) => item.path === finding.closure.evidence.path);
  if (record.sha256 !== finding.closure.evidence.sha256.toUpperCase()
    || record.bytes !== finding.closure.evidence.bytes) {
    throw new Error(`Finding closure evidence mismatch: ${finding.id}`);
  }
}

await writeFile(path.join(evidenceDir, 'SHA256SUMS.txt'), `${records.map((r) => `${r.sha256} *${r.path}`).join('\n')}\n`, 'utf8');
await writeFile(path.join(evidenceDir, 'pack-manifest.json'), `${JSON.stringify({
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  pack: result.pack,
  candidateRevision: result.revision,
  candidateStatus: derivePackStatus(result),
  verificationStatus: 'PENDING_TRACKED_VERIFICATION',
  files: records,
  externalArtifacts: result.executions.flatMap((execution) => execution.artifacts.filter((artifact) => artifact.url)),
}, null, 2)}\n`, 'utf8');
console.log(`Finalized ${result.pack} as pending tracked verification (${records.length} files).`);
