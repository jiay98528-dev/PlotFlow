import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseZipEntries } from './zip-evidence.mjs';

export const REVIEW_STATUSES = Object.freeze(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']);
export const REVIEW_PACKS = Object.freeze([
  'install-integrity',
  'graph-main-journey',
  'keyboard-a11y',
  'responsive-visual',
  'performance-recovery',
]);

const SHA256 = /^[0-9a-f]{64}$/i;
const REVISION = /^[0-9a-f]{40}$/i;
export const OFFICIAL_REVIEW_REPOSITORY = 'jiay98528-dev/PlotFlow';
export const OFFICIAL_REVIEW_WORKFLOW = '.github/workflows/release-validation.yml';
const CASES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../spec/external-review/cases');

function loadCaseDefinition(pack) {
  return JSON.parse(readFileSync(path.join(CASES_ROOT, `${pack}.json`), 'utf8'));
}

export const REQUIRED_CASES = Object.freeze(Object.fromEntries(
  REVIEW_PACKS.map((pack) => [pack, loadCaseDefinition(pack)]),
));

export function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value === '' || path.isAbsolute(value) || value.includes('\\')) return false;
  const normalized = path.posix.normalize(value);
  return normalized !== '..' && !normalized.startsWith('../') && normalized === value;
}

function validDate(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function sameWindowsPath(left, right) {
  return typeof left === 'string' && typeof right === 'string'
    && path.win32.normalize(left).toLowerCase() === path.win32.normalize(right).toLowerCase();
}

function windowsPathInside(candidate, root) {
  if (typeof candidate !== 'string' || typeof root !== 'string') return false;
  const normalizedCandidate = path.win32.normalize(candidate).toLowerCase();
  const normalizedRoot = path.win32.normalize(root).replace(/[\\/]+$/, '').toLowerCase();
  return normalizedCandidate.startsWith(`${normalizedRoot}\\`);
}

function windowsCommandExecutable(command) {
  if (typeof command !== 'string') return null;
  const match = /^\s*(?:"([^"]+\.exe)"|([^\s]+\.exe))(?:\s|$)/i.exec(command);
  return match?.[1] ?? match?.[2] ?? null;
}

function validLocalFileReference(value) {
  return isSafeRelativePath(value?.path) && SHA256.test(value?.sha256 ?? '')
    && Number.isInteger(value?.bytes) && value.bytes > 0;
}

function validRemoteArtifact(artifact) {
  const match = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/actions\/runs\/(\d+)\/artifacts\/(\d+)$/.exec(artifact?.url ?? '');
  return Boolean(match)
    && artifact?.provenance?.provider === 'github-actions'
    && match[1].toLowerCase() === OFFICIAL_REVIEW_REPOSITORY.toLowerCase()
    && artifact.provenance.repository?.toLowerCase() === OFFICIAL_REVIEW_REPOSITORY.toLowerCase()
    && artifact.provenance.workflowPath === OFFICIAL_REVIEW_WORKFLOW
    && Number.isInteger(artifact.provenance.runAttempt) && artifact.provenance.runAttempt > 0
    && typeof artifact.provenance.artifactName === 'string' && artifact.provenance.artifactName.length > 0
    && String(artifact.provenance.runId) === match[2]
    && String(artifact.provenance.artifactId) === match[3];
}

function validateExecution(execution, definition) {
  const errors = [];
  if (!definition) return [`unexpected case: ${execution?.caseId ?? '<missing>'}`];
  if (!REVIEW_STATUSES.includes(execution?.status)) errors.push(`${definition.id}: invalid status`);
  if (!execution?.actor?.id || !definition.actors.includes(execution?.actor?.role)) errors.push(`${definition.id}: missing or invalid actor identity/role`);
  if (!validDate(execution?.startedAt) || !validDate(execution?.finishedAt)) errors.push(`${definition.id}: invalid execution timestamps`);
  else if (Date.parse(execution.finishedAt) < Date.parse(execution.startedAt)) errors.push(`${definition.id}: execution finishes before it starts`);
  if (!Number.isInteger(execution?.exitCode)) errors.push(`${definition.id}: exitCode must be an integer`);
  const counters = execution?.counters;
  if (!counters || !['total', 'passed', 'failed', 'skipped'].every((key) => Number.isInteger(counters[key]) && counters[key] >= 0)) {
    errors.push(`${definition.id}: counters must be non-negative integers`);
  } else {
    if (counters.total <= 0) errors.push(`${definition.id}: zero-test execution is invalid`);
    if (Array.isArray(execution?.steps) && counters.total !== execution.steps.length) errors.push(`${definition.id}: counters must cover every fixed step`);
    if (counters.total !== counters.passed + counters.failed + counters.skipped) errors.push(`${definition.id}: counters do not balance`);
    if (counters.skipped > 0) errors.push(`${definition.id}: required cases cannot skip tests`);
    if (execution.status === 'PASS' && (execution.exitCode !== 0 || counters.failed > 0 || counters.passed !== counters.total)) {
      errors.push(`${definition.id}: PASS contradicts exit code or counters`);
    }
  }
  if (!Array.isArray(execution?.steps) || execution.steps.length === 0) errors.push(`${definition.id}: step outcomes are required`);
  else {
    const stepIds = new Set();
    if (execution.steps.some((step) => !step?.id || !REVIEW_STATUSES.includes(step?.status))) errors.push(`${definition.id}: step outcome is invalid`);
    if (execution.steps.some((step) => stepIds.size === stepIds.add(step.id).size)) errors.push(`${definition.id}: duplicate step id`);
    if (execution.status === 'PASS' && execution.steps.some((step) => step.status !== 'PASS')) {
      errors.push(`${definition.id}: PASS contradicts non-passing step outcomes`);
    }
    const actualStepIds = new Set(execution.steps.map((step) => step.id));
    if (definition.steps.some((id) => !actualStepIds.has(id)) || execution.steps.some((step) => !definition.steps.includes(step.id))) {
      errors.push(`${definition.id}: step coverage does not match the fixed case contract`);
    }
  }
  if (!isSafeRelativePath(execution?.transcript?.path) || !SHA256.test(execution?.transcript?.sha256 ?? '')) {
    errors.push(`${definition.id}: transcript path/hash is invalid`);
  }
  const artifacts = Array.isArray(execution?.artifacts) ? execution.artifacts : [];
  for (const kind of definition.artifacts) {
    if (!artifacts.some((artifact) => artifact?.kind === kind && SHA256.test(artifact?.sha256 ?? '')
      && Number.isInteger(artifact?.bytes) && artifact.bytes > 0
      && (isSafeRelativePath(artifact?.path) || validRemoteArtifact(artifact)))) {
      errors.push(`${definition.id}: missing valid ${kind} artifact`);
    }
  }
  return errors;
}

export function validateTranscriptDocument(transcript, execution) {
  const errors = [];
  const allowedEvidenceRefs = new Set((execution.artifacts ?? []).flatMap((artifact) => [artifact.path, artifact.url].filter(Boolean)));
  if (transcript?.schemaVersion !== 2 || transcript?.caseId !== execution.caseId) errors.push('transcript identity is invalid');
  if (transcript?.actor?.id !== execution.actor.id || transcript?.actor?.role !== execution.actor.role) errors.push('transcript actor does not match execution');
  if (transcript?.startedAt !== execution.startedAt || transcript?.finishedAt !== execution.finishedAt
    || transcript?.exitCode !== execution.exitCode || JSON.stringify(transcript?.counters) !== JSON.stringify(execution.counters)) {
    errors.push('transcript timing/exit/counters do not conserve execution');
  }
  if (JSON.stringify(transcript?.steps) !== JSON.stringify(execution.steps)) errors.push('transcript steps do not conserve execution');
  if (!transcript?.producer || !['playwright', 'computer-use', 'powershell', 'manual-observation'].includes(transcript.producer.kind)
    || typeof transcript.producer.name !== 'string' || transcript.producer.name.length < 2
    || typeof transcript.producer.version !== 'string' || transcript.producer.version.length < 1) {
    errors.push('transcript requires an identified evidence producer');
  }
  if (!Array.isArray(transcript?.events) || transcript.events.length !== execution.steps.length) errors.push('transcript requires exactly one structured event per step');
  else {
    for (let index = 0; index < transcript.events.length; index += 1) {
      const event = transcript.events[index];
      const step = execution.steps[index];
      if (event?.stepId !== step.id || event?.outcome !== step.status
        || !validDate(event?.at) || Date.parse(event.at) < Date.parse(execution.startedAt) || Date.parse(event.at) > Date.parse(execution.finishedAt)
        || typeof event?.action !== 'string' || event.action.trim().length < 8
        || !Array.isArray(event?.evidenceRefs) || event.evidenceRefs.length === 0
        || event.evidenceRefs.some((reference) => typeof reference !== 'string' || !allowedEvidenceRefs.has(reference))) {
        errors.push('transcript contains an invalid step event');
        break;
      }
    }
  }
  return errors;
}

function parseMp4Boxes(bytes) {
  const types = new Set();
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const rawSize = bytes.readUInt32BE(offset);
    let size = rawSize;
    let headerSize = 8;
    if (rawSize === 1) {
      if (offset + 16 > bytes.length) return null;
      const largeSize = bytes.readBigUInt64BE(offset + 8);
      if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(largeSize);
      headerSize = 16;
    } else if (rawSize === 0) {
      size = bytes.length - offset;
    }
    if (size < headerSize || offset + size > bytes.length) return null;
    types.add(bytes.subarray(offset + 4, offset + 8).toString('ascii'));
    offset += size;
  }
  return offset === bytes.length ? types : null;
}

export function validPngEvidence(bytes) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes.length >= 33 && bytes.subarray(0, 8).equals(signature)
    && bytes.subarray(12, 16).toString('ascii') === 'IHDR'
    && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(20) > 0;
}

function validateJsonPayload(kind, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (kind === 'installer-manifest') return SHA256.test(payload.installerSha256 ?? '') && SHA256.test(payload.executableSha256 ?? '')
    && Number.isInteger(payload.installerBytes) && payload.installerBytes > 0 && Number.isInteger(payload.executableBytes) && payload.executableBytes > 0;
  if (kind === 'registry-snapshot') return Array.isArray(payload.uninstallEntries) && payload.uninstallEntries.length === 1
    && typeof payload.fileAssociation === 'object' && typeof payload.installReceiptSha256 === 'string' && SHA256.test(payload.installReceiptSha256);
  if (kind === 'schema-report') return payload.valid === true && typeof payload.schemaUrl === 'string'
    && Array.isArray(payload.outputs) && payload.outputs.length > 0;
  if (kind === 'performance-report') return payload.sourceUnchanged === true && Array.isArray(payload.measurements)
    && [100, 500, 1000].every((count) => payload.measurements.some((item) => item?.nodeCount === count && Number.isFinite(item?.durationMs)));
  if (kind === 'story-hashes') return payload.unchanged === true && SHA256.test(payload.before ?? '') && payload.before === payload.after;
  return false;
}

export function validateLocalArtifactBytes(artifact, bytes, execution, revision) {
  const errors = [];
  const lowerPath = artifact.path.toLowerCase();
  if (artifact.kind === 'video') {
    const boxes = parseMp4Boxes(bytes);
    if (!lowerPath.endsWith('.mp4') || bytes.length < 64 * 1024 || !boxes
      || !['ftyp', 'moov', 'mdat'].every((type) => boxes.has(type))) {
      errors.push('video artifact is not a complete MP4 container with media and metadata');
    }
  } else if (['screenshots', 'recovery-outputs'].includes(artifact.kind)) {
    try {
      if (!lowerPath.endsWith('.zip')) throw new Error('extension');
      const entries = parseZipEntries(bytes).filter((entry) => !entry.isDirectory);
      if (entries.length === 0 || entries.some((entry) => !isSafeRelativePath(entry.name))) throw new Error('entries');
      if (artifact.kind === 'screenshots' && !entries.some((entry) => entry.name.toLowerCase().endsWith('.png') && validPngEvidence(entry.data))) throw new Error('png');
      if (artifact.kind === 'recovery-outputs') {
        const manifest = entries.find((entry) => entry.name === 'manifest.json');
        if (!manifest) throw new Error('manifest');
        const document = JSON.parse(manifest.data.toString('utf8'));
        if (document.schemaVersion !== 2 || document.revision !== revision || document.caseId !== execution.caseId
          || !Array.isArray(document.files) || document.files.length === 0
          || document.files.some((name) => !isSafeRelativePath(name) || !entries.some((entry) => entry.name === name && entry.data.length > 0))) throw new Error('manifest');
      }
    } catch {
      errors.push(`${artifact.kind} artifact is not a valid semantic ZIP archive`);
    }
  } else if (artifact.kind === 'story-output') {
    const text = bytes.toString('utf8');
    if (!lowerPath.endsWith('.mdstory') || !/^##\s+(?:节点[:：]|Node[:：])/m.test(text)) errors.push('story output is not a usable .mdstory source');
  } else if (artifact.kind === 'html-output') {
    if (!lowerPath.endsWith('.html') || !/^<!doctype html>/i.test(bytes.toString('utf8').trimStart())) errors.push('HTML output is invalid');
  } else {
    let document;
    try { document = JSON.parse(bytes.toString('utf8')); } catch { errors.push(`${artifact.kind} artifact must be structured JSON`); }
    if (document && (document.schemaVersion !== 2 || document.revision !== revision || document.caseId !== execution.caseId
      || !validDate(document.generatedAt) || Date.parse(document.generatedAt) < Date.parse(execution.startedAt)
      || Date.parse(document.generatedAt) > Date.parse(execution.finishedAt)
      || !validateJsonPayload(artifact.kind, document.payload))) {
      errors.push(`${artifact.kind} artifact envelope is invalid`);
    }
  }
  return errors;
}

export function derivePackStatus(result) {
  const definition = REQUIRED_CASES[result?.pack];
  if (!definition) return 'NOT_RUN';
  const executions = result?.executions ?? [];
  if (definition.cases.some((required) => required.actors.some((role) => !executions.some(
    (execution) => execution.caseId === required.id && execution.actor?.role === role,
  )))) return 'NOT_RUN';
  const values = definition.cases.flatMap((required) => required.actors.map((role) => executions.find(
    (execution) => execution.caseId === required.id && execution.actor?.role === role,
  )));
  if (values.some((execution) => execution.status === 'BLOCKED')) return 'BLOCKED';
  if (values.some((execution) => execution.status === 'NOT_RUN')) return 'NOT_RUN';
  if (values.some((execution) => execution.status === 'FAIL')) return 'FAIL';
  const openHigh = (result?.findings ?? []).some((finding) => ['P0', 'P1'].includes(finding?.severity) && finding?.status !== 'CLOSED');
  return openHigh ? 'FAIL' : 'PASS';
}

export function validatePackResult(result) {
  const errors = [];
  if (result?.schemaVersion !== 2) errors.push('schemaVersion must be 2');
  if (!REVIEW_PACKS.includes(result?.pack)) return [...errors, `unknown pack: ${result?.pack ?? '<missing>'}`];
  if (!REVISION.test(result?.revision ?? '')) errors.push('revision must be a 40-character Git SHA');
  if (!validDate(result?.startedAt) || !validDate(result?.finishedAt)) errors.push('pack timestamps must be ISO date-times');
  else if (Date.parse(result.finishedAt) < Date.parse(result.startedAt)) errors.push('pack finishes before it starts');
  if (!result?.actor?.id || !result?.actor?.role) errors.push('pack actor id and role are required');
  if (!Array.isArray(result?.executions)) errors.push('executions are required');

  const definition = REQUIRED_CASES[result.pack];
  const seen = new Set();
  const transcriptPaths = new Set();
  for (const execution of result?.executions ?? []) {
    const identity = `${execution.caseId}:${execution.actor?.role ?? '<missing>'}`;
    if (seen.has(identity)) errors.push(`duplicate case/actor execution: ${identity}`);
    seen.add(identity);
    errors.push(...validateExecution(execution, definition.cases.find((item) => item.id === execution.caseId)));
    if (execution.actor?.id !== result.actor?.id || execution.actor?.role !== result.actor?.role) {
      errors.push(`${execution.caseId}: execution actor must match the pack reviewer`);
    }
    if (transcriptPaths.has(execution.transcript?.path)) errors.push(`${execution.caseId}: transcript must be unique per execution`);
    transcriptPaths.add(execution.transcript?.path);
  }
  for (const required of definition.cases) {
    for (const role of required.actors) {
      if (!seen.has(`${required.id}:${role}`)) errors.push(`missing required case/actor: ${required.id}:${role}`);
    }
  }

  const findings = Array.isArray(result?.findings) ? result.findings : [];
  if (!Array.isArray(result?.findings) || findings.some((finding) => !finding?.id
    || !['observation', 'product-defect'].includes(finding?.kind)
    || !['P0', 'P1', 'P2', 'P3'].includes(finding?.severity)
    || !['OPEN', 'CLOSED', 'MITIGATED'].includes(finding?.status)
    || typeof finding?.summary !== 'string' || finding.summary.length === 0
    || !Array.isArray(finding?.caseIds) || finding.caseIds.length === 0
    || !finding.caseIds.every((id) => definition.cases.some((item) => item.id === id)))) {
    errors.push('findings must use the stable id/kind/severity/status contract');
  }
  for (const finding of findings) {
    if (finding.kind === 'product-defect' && (
      typeof finding.expected !== 'string' || finding.expected.length === 0
      || typeof finding.actual !== 'string' || finding.actual.length === 0
      || !Number.isInteger(finding?.reproduction?.attempts) || finding.reproduction.attempts <= 0
      || !Number.isInteger(finding?.reproduction?.occurrences) || finding.reproduction.occurrences <= 0
      || finding.reproduction.occurrences > finding.reproduction.attempts
    )) errors.push(`${finding.id}: product defect lacks reproducible expected/actual evidence`);
    if (['P0', 'P1'].includes(finding.severity) && finding.status === 'CLOSED') {
      if (!REVISION.test(finding?.closure?.fixRevision ?? '')
        || !Array.isArray(finding?.closure?.retestCaseIds) || finding.closure.retestCaseIds.length === 0
        || !finding.closure.retestCaseIds.every((id) => definition.cases.some((item) => item.id === id))
        || !validLocalFileReference(finding?.closure?.evidence)) {
        errors.push(`${finding.id}: closed P0/P1 requires a fix revision and tracked retest evidence`);
      }
    }
  }
  if (result?.status === 'FAIL' && findings.filter((finding) => ['P0', 'P1'].includes(finding?.severity)).length === 0
    && !(result.executions ?? []).some((execution) => execution.status === 'FAIL')) {
    errors.push('FAIL requires a failed execution or an open P0/P1 finding');
  }
  if (['BLOCKED', 'NOT_RUN'].includes(result?.status) && findings.some((finding) => finding?.kind === 'product-defect')) {
    errors.push(`${result.status} cannot claim product defects`);
  }
  const derived = derivePackStatus(result);
  if (result?.status !== derived) errors.push(`reported status ${result?.status ?? '<missing>'} contradicts derived status ${derived}`);
  return errors;
}

export function validateEnvironment(environment) {
  const blockers = [];
  const required = ['schemaVersion', 'collectedAt', 'pack', 'revision', 'preflightStatus', 'repository', 'windows', 'host', 'installer', 'installedExecutable', 'releaseManifest', 'releaseArtifact', 'registration', 'installReceipt', 'cleanProfile'];
  for (const field of required) if (environment?.[field] == null) blockers.push(`missing environment field: ${field}`);
  if (environment?.schemaVersion != null && environment.schemaVersion !== 2) blockers.push('Environment schemaVersion must be 2.');
  if (environment?.preflightStatus && environment.preflightStatus !== 'PASS') blockers.push('Environment preflight did not pass.');
  if (!validDate(environment?.collectedAt)) blockers.push('Environment collection time is invalid.');
  if (!REVISION.test(environment?.revision ?? '')) blockers.push('Environment revision is invalid.');
  if (environment?.repository?.dirty !== false || !Array.isArray(environment?.repository?.status) || environment.repository.status.length > 0) blockers.push('Git worktree is not clean.');
  for (const [label, file] of [['installer', environment?.installer], ['installed executable', environment?.installedExecutable]]) {
    if (typeof file?.path !== 'string' || !SHA256.test(file?.sha256 ?? '') || !Number.isInteger(file?.bytes) || file.bytes <= 0
      || typeof file?.fileVersion !== 'string' || file.fileVersion.length === 0
      || typeof file?.productVersion !== 'string' || file.productVersion.length === 0
      || typeof file?.authenticode !== 'string' || file.authenticode.length === 0) blockers.push(`${label} evidence is incomplete.`);
  }
  if (typeof environment?.releaseManifest?.path !== 'string' || !SHA256.test(environment?.releaseManifest?.sha256 ?? '')
    || !Number.isInteger(environment?.releaseManifest?.bytes) || environment.releaseManifest.bytes <= 0
    || !SHA256.test(environment?.releaseManifest?.installerExpected ?? '')
    || !SHA256.test(environment?.releaseManifest?.executableExpected ?? '')) blockers.push('Release manifest evidence is incomplete.');
  if (environment?.installer?.sha256 !== environment?.releaseManifest?.installerExpected) blockers.push('Installer SHA256 does not match the release manifest.');
  if (environment?.installedExecutable?.sha256 !== environment?.releaseManifest?.executableExpected) blockers.push('Installed executable does not match the packaged executable.');
  if (!validRemoteArtifact(environment?.releaseArtifact)
    || !SHA256.test(environment?.releaseArtifact?.sha256 ?? '')
    || !Number.isInteger(environment?.releaseArtifact?.bytes) || environment.releaseArtifact.bytes <= 0
    || environment.releaseArtifact.provenance.artifactName !== `plotflow-windows-${environment.revision}`) blockers.push('Release artifact provenance is incomplete or not official.');
  if (!validLocalFileReference(environment?.installReceipt)
    || environment?.installReceipt?.sha256 !== environment?.registration?.receiptSha256) blockers.push('Install receipt is missing or not hash-bound to registration.');
  const registrationEntry = environment?.registration?.matchingUninstallEntries?.[0];
  const quietExecutable = windowsCommandExecutable(registrationEntry?.quietUninstallString);
  if (environment?.registration?.valid !== true || typeof environment.registration.installedDirectory !== 'string'
    || !Array.isArray(environment.registration.matchingUninstallEntries) || environment.registration.matchingUninstallEntries.length !== 1
    || registrationEntry?.registrationId !== '74fc8b73-b58d-5573-82e7-75efc9ec526f'
    || typeof registrationEntry?.installLocation !== 'string' || registrationEntry.installLocation.length === 0
    || typeof registrationEntry?.quietUninstallString !== 'string' || registrationEntry.quietUninstallString.length === 0
    || typeof environment.registration.associationExecutable !== 'string'
    || typeof environment.registration.iconExecutable !== 'string'
    || !sameWindowsPath(environment.registration.installedDirectory, path.win32.dirname(environment.installedExecutable?.path ?? ''))
    || !sameWindowsPath(registrationEntry?.installLocation, environment.registration.installedDirectory)
    || !sameWindowsPath(environment.registration.associationExecutable, environment.installedExecutable?.path)
    || !windowsPathInside(environment.registration.iconExecutable, environment.registration.installedDirectory)
    || !windowsPathInside(quietExecutable, environment.registration.installedDirectory)
    || path.win32.basename(quietExecutable ?? '').toLowerCase() !== 'uninstall plotflow.exe'
    || !sameWindowsPath(environment.registration.uninstaller?.path, quietExecutable)
    || !SHA256.test(environment.registration.uninstaller?.sha256 ?? '')
    || !Number.isInteger(environment.registration.uninstaller?.bytes) || environment.registration.uninstaller.bytes <= 0
    || environment.registration.uninstaller.sha256 !== environment.registration.receipt?.uninstallerSha256
    || environment.installedExecutable.sha256 !== environment.registration.receipt?.executableSha256
    || !sameWindowsPath(environment.registration.receipt?.installRoot, environment.registration.installedDirectory)) {
    blockers.push('Installed registration is not bound to the exact executable.');
  }
  const screensValid = Array.isArray(environment?.windows?.screens) && environment.windows.screens.length > 0
    && environment.windows.screens.every((screen) => typeof screen?.deviceName === 'string'
      && Number.isInteger(screen?.width) && screen.width > 0 && Number.isInteger(screen?.height) && screen.height > 0);
  if (!screensValid || typeof environment?.windows?.caption !== 'string' || typeof environment?.windows?.version !== 'string'
    || typeof environment?.windows?.build !== 'string' || typeof environment?.windows?.uiCulture !== 'string'
    || !Array.isArray(environment?.windows?.userLanguages) || environment.windows.userLanguages.length === 0
    || !Number.isFinite(environment?.windows?.dpi) || !Number.isFinite(environment?.windows?.scalePercent)
    || typeof environment?.host?.manufacturer !== 'string' || typeof environment?.host?.model !== 'string'
    || typeof environment?.host?.hypervisorPresent !== 'boolean' || typeof environment?.host?.user !== 'string') {
    blockers.push('Windows host evidence is incomplete.');
  }
  if (environment?.cleanProfile?.required && environment.cleanProfile.existingPaths?.length > 0) blockers.push('PlotFlow user profile already exists.');
  return blockers;
}

export function validateInstallReceiptDocument(receipt, environment) {
  const errors = [];
  if (receipt?.schemaVersion !== 2 || !validDate(receipt?.createdAt)
    || receipt?.registrationId !== '74fc8b73-b58d-5573-82e7-75efc9ec526f') errors.push('install receipt identity is invalid');
  if (validDate(receipt?.createdAt) && validDate(environment?.collectedAt)
    && (Date.parse(receipt.createdAt) > Date.parse(environment.collectedAt)
      || Date.parse(environment.collectedAt) - Date.parse(receipt.createdAt) > 24 * 60 * 60 * 1000)) errors.push('install receipt is not from the current evidence run');
  if (!sameWindowsPath(receipt?.installRoot, environment?.registration?.installedDirectory)
    || !sameWindowsPath(receipt?.executablePath, environment?.installedExecutable?.path)
    || !sameWindowsPath(receipt?.uninstallerPath, environment?.registration?.uninstaller?.path)) errors.push('install receipt paths do not match environment');
  if (receipt?.executableSha256 !== environment?.installedExecutable?.sha256
    || receipt?.uninstallerSha256 !== environment?.registration?.uninstaller?.sha256) errors.push('install receipt hashes do not match environment');
  return errors;
}

export function summarizeReview(packResults) {
  const byPack = new Map(packResults.map((result) => [result.pack, result]));
  const missing = REVIEW_PACKS.filter((pack) => !byPack.has(pack));
  const invalid = packResults.flatMap((result) => validatePackResult(result).map((error) => `${result.pack}: ${error}`));
  const statuses = Object.fromEntries(REVIEW_PACKS.map((pack) => [pack, byPack.has(pack) ? derivePackStatus(byPack.get(pack)) : 'NOT_RUN']));
  return {
    gate: missing.length === 0 && invalid.length === 0 && REVIEW_PACKS.every((pack) => statuses[pack] === 'PASS') ? 'PASS' : 'FAIL',
    productDefects: packResults.flatMap((result) => (result.findings ?? []).filter((finding) => finding.kind === 'product-defect')),
    missing,
    invalid,
    statuses,
  };
}
