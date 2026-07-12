export const REVIEW_STATUSES = Object.freeze(['PASS', 'FAIL', 'BLOCKED', 'NOT_RUN']);

export const REVIEW_PACKS = Object.freeze([
  'install-integrity',
  'graph-main-journey',
  'keyboard-a11y',
  'responsive-visual',
  'performance-recovery',
]);

export function validatePackResult(result) {
  const errors = [];
  if (!REVIEW_PACKS.includes(result?.pack)) errors.push(`unknown pack: ${result?.pack ?? '<missing>'}`);
  if (!REVIEW_STATUSES.includes(result?.status)) errors.push(`unknown status: ${result?.status ?? '<missing>'}`);
  if (typeof result?.revision !== 'string' || !/^[0-9a-f]{40}$/i.test(result.revision)) {
    errors.push('revision must be a 40-character Git SHA');
  }
  if (typeof result?.startedAt !== 'string' || !Number.isFinite(Date.parse(result.startedAt))) {
    errors.push('startedAt must be an ISO date-time');
  }
  if (typeof result?.finishedAt !== 'string' || !Number.isFinite(Date.parse(result.finishedAt))) {
    errors.push('finishedAt must be an ISO date-time');
  }
  if (result?.status === 'FAIL' && (!Array.isArray(result.defects) || result.defects.length === 0)) {
    errors.push('FAIL requires at least one reproducible product defect');
  }
  if ((result?.status === 'BLOCKED' || result?.status === 'NOT_RUN') && Array.isArray(result.defects) && result.defects.length > 0) {
    errors.push(`${result.status} cannot claim product defects`);
  }
  return errors;
}

export function validateEnvironment(environment) {
  const blockers = [];
  const required = ['schemaVersion', 'collectedAt', 'pack', 'revision', 'preflightStatus', 'windows', 'host', 'installer', 'installedExecutable'];
  for (const field of required) {
    if (environment?.[field] === undefined || environment?.[field] === null) blockers.push(`missing environment field: ${field}`);
  }
  if (environment?.preflightStatus && environment.preflightStatus !== 'PASS') blockers.push('Environment preflight did not pass.');
  if (environment?.repository?.dirty) blockers.push('Git worktree is not clean.');
  if (environment?.installer?.sha256 !== environment?.releaseManifest?.installerExpected) {
    blockers.push('Installer SHA256 does not match the release manifest.');
  }
  if (environment?.installedExecutable?.sha256 !== environment?.releaseManifest?.executableExpected) {
    blockers.push('Installed executable does not match the packaged executable.');
  }
  if (environment?.cleanProfile?.required && environment.cleanProfile.existingPaths?.length > 0) {
    blockers.push('PlotFlow user profile already exists.');
  }
  return blockers;
}

export function summarizeReview(packResults) {
  const byPack = new Map(packResults.map((result) => [result.pack, result]));
  const missing = REVIEW_PACKS.filter((pack) => !byPack.has(pack));
  const invalid = packResults.flatMap((result) => validatePackResult(result).map((error) => `${result.pack}: ${error}`));
  const allPassed = missing.length === 0
    && invalid.length === 0
    && REVIEW_PACKS.every((pack) => byPack.get(pack)?.status === 'PASS');
  return {
    gate: allPassed ? 'PASS' : 'FAIL',
    productDefects: packResults.flatMap((result) => result.status === 'FAIL' ? result.defects ?? [] : []),
    missing,
    invalid,
    statuses: Object.fromEntries(REVIEW_PACKS.map((pack) => [pack, byPack.get(pack)?.status ?? 'NOT_RUN'])),
  };
}
