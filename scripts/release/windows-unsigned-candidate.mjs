import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
export const WORKSPACE_ROOT = path.resolve(scriptDirectory, '..', '..');
const AUTHENTICODE_SCRIPT = path.join(scriptDirectory, 'authenticode-status.ps1');
const EXECUTABLE_VERSION_SCRIPT = path.join(scriptDirectory, 'executable-version.ps1');
const MANIFEST_NAME = 'candidate-manifest.json';
const SUMS_NAME = 'SHA256SUMS.txt';
const STATUS = 'UNSIGNED_PREFLIGHT';

function command(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: WORKSPACE_ROOT,
    encoding: 'utf8',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} exited with ${result.status}${detail ? `:\n${detail}` : ''}`);
  }
  return result.stdout?.trim() ?? '';
}

function git(args) {
  return command('git', args);
}

function assertCleanWorktree() {
  const status = git(['status', '--porcelain', '--untracked-files=all']);
  if (status) throw new Error(`Candidate creation requires a clean worktree:\n${status}`);
}

function currentHead() {
  return assertFullCommit(git(['rev-parse', '--verify', 'HEAD^{commit}']), 'HEAD');
}

function assertHead(expectedCommit) {
  const actualCommit = currentHead();
  if (actualCommit !== expectedCommit) {
    throw new Error(
      `Candidate source HEAD changed during execution: expected ${expectedCommit}, found ${actualCommit}.`,
    );
  }
}

function assertFullCommit(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/u.test(value.toLowerCase())) {
    throw new Error(`${label} must be a full Git commit SHA.`);
  }
  return value.toLowerCase();
}

export function assertPathInside(root, candidate, label = 'path') {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  if (
    relative === '' ||
    relative.startsWith(`..${path.sep}`) ||
    relative === '..' ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${label} must be a child of ${resolvedRoot}: ${resolvedCandidate}`);
  }
  return resolvedCandidate;
}

async function assertNoWorkspaceLinkEscape(candidate, label) {
  const workspaceRoot = path.resolve(WORKSPACE_ROOT);
  const resolvedCandidate = assertPathInside(workspaceRoot, candidate, label);
  const workspaceReal = await realpath(workspaceRoot);
  const relative = path.relative(workspaceRoot, resolvedCandidate);
  let cursor = workspaceRoot;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    try {
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) {
        throw new Error(`${label} cannot traverse a symlink or junction: ${cursor}`);
      }
      if (!info.isDirectory()) {
        throw new Error(`${label} ancestor is not a directory: ${cursor}`);
      }
      const cursorReal = await realpath(cursor);
      const realRelative = path.relative(workspaceReal, cursorReal);
      if (
        realRelative.startsWith(`..${path.sep}`) ||
        realRelative === '..' ||
        path.isAbsolute(realRelative)
      ) {
        throw new Error(`${label} escapes the real workspace root: ${cursorReal}`);
      }
    } catch (error) {
      if (error?.code === 'ENOENT') break;
      throw error;
    }
  }
  return resolvedCandidate;
}

function artifactPath(root, relativePath) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    relativePath.includes('\\') ||
    relativePath.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`Unsafe candidate artifact path: ${String(relativePath)}`);
  }
  return assertPathInside(root, path.resolve(root, ...relativePath.split('/')), 'artifact path');
}

function isOutsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)
  );
}

async function regularPath(pathType, targetPath, rootPath) {
  const resolvedTarget = path.resolve(targetPath);
  if (!rootPath) {
    const info = await lstat(resolvedTarget);
    const isExpectedType = pathType === 'file' ? info.isFile() : info.isDirectory();
    if (!isExpectedType || info.isSymbolicLink()) {
      throw new Error(
        `Candidate ${pathType === 'file' ? 'artifacts' : 'directories'} must be regular non-symlink ${pathType}s: ${resolvedTarget}`,
      );
    }
    return info;
  }

  const resolvedRoot = path.resolve(rootPath);
  assertPathInside(resolvedRoot, resolvedTarget, `candidate ${pathType}`);
  const rootInfo = await lstat(resolvedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error(`Candidate root must be a regular non-symlink directory: ${resolvedRoot}`);
  }
  const realRoot = await realpath(resolvedRoot);
  const segments = path.relative(resolvedRoot, resolvedTarget).split(path.sep).filter(Boolean);
  let cursor = resolvedRoot;
  let targetInfo;
  for (const [index, segment] of segments.entries()) {
    cursor = path.join(cursor, segment);
    const info = await lstat(cursor);
    const isTarget = index === segments.length - 1;
    if (info.isSymbolicLink()) {
      throw new Error(`Candidate path cannot traverse a symlink or junction: ${cursor}`);
    }
    if ((!isTarget && !info.isDirectory()) || (isTarget && pathType === 'file' && !info.isFile())) {
      throw new Error(`Candidate path component has an invalid type: ${cursor}`);
    }
    if (isTarget && pathType === 'directory' && !info.isDirectory()) {
      throw new Error(`Candidate directory has an invalid type: ${cursor}`);
    }
    const realCursor = await realpath(cursor);
    if (isOutsideRoot(realRoot, realCursor)) {
      throw new Error(`Candidate path escapes the real candidate root: ${realCursor}`);
    }
    if (isTarget) targetInfo = info;
  }
  return targetInfo;
}

async function regularFile(filePath, rootPath) {
  return regularPath('file', filePath, rootPath);
}

async function regularDirectory(directoryPath, rootPath) {
  return regularPath('directory', directoryPath, rootPath);
}

export async function sha256File(filePath) {
  const bytes = await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}

async function defaultAuthenticodeStatus(filePath) {
  if (process.platform !== 'win32') throw new Error('Authenticode verification requires Windows.');
  return command('pwsh', ['-NoProfile', '-File', AUTHENTICODE_SCRIPT, '-Path', filePath]);
}

function normalizeEmbeddedVersion(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} did not provide a version string.`);
  const match = /^(\d+\.\d+\.\d+)(?:\.0)?(?:[ +].*)?$/u.exec(value.trim());
  if (!match) throw new Error(`${label} returned an invalid version: ${value}`);
  return match[1];
}

async function defaultEmbeddedVersion(item, releaseRoot) {
  if (item.path.startsWith('win-unpacked/')) {
    const appAsarPath = artifactPath(releaseRoot, 'win-unpacked/resources/app.asar');
    await regularFile(appAsarPath, releaseRoot);
    const electronBuilderEntry = require.resolve('electron-builder');
    const asarEntry = require.resolve('@electron/asar', { paths: [electronBuilderEntry] });
    const asar = require(asarEntry);
    let packageJson;
    try {
      packageJson = JSON.parse(asar.extractFile(appAsarPath, 'package.json').toString('utf8'));
    } catch (error) {
      throw new Error(
        `Cannot read the unpacked app version from ${appAsarPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return normalizeEmbeddedVersion(packageJson?.version, 'unpacked app.asar package.json');
  }
  if (process.platform !== 'win32') throw new Error('Executable version verification requires Windows.');
  return normalizeEmbeddedVersion(
    command('pwsh', ['-NoProfile', '-File', EXECUTABLE_VERSION_SCRIPT, '-Path', item.absolutePath]),
    'installer ProductVersion',
  );
}

async function discoverCandidateArtifacts(releaseRoot, productName, version) {
  const entries = await readdir(releaseRoot, { withFileTypes: true });
  const installers = entries.filter(
    (entry) => entry.isFile() && /Setup .+\.exe$/iu.test(entry.name),
  );
  if (installers.length !== 1) {
    throw new Error(`Expected exactly one installer, found ${installers.length}.`);
  }
  const expectedInstaller = `${productName} Setup ${version}.exe`;
  if (installers[0].name !== expectedInstaller) {
    throw new Error(
      `Installer/version mismatch: expected ${expectedInstaller}, found ${installers[0].name}.`,
    );
  }
  const unpackedDirectory = artifactPath(releaseRoot, 'win-unpacked');
  await regularDirectory(unpackedDirectory, releaseRoot);
  const unpackedEntries = await readdir(unpackedDirectory, { withFileTypes: true });
  const executables = unpackedEntries.filter(
    (entry) => entry.isFile() && entry.name === `${productName}.exe`,
  );
  if (executables.length !== 1) {
    throw new Error(
      `Expected exactly one unpacked ${productName}.exe, found ${executables.length}.`,
    );
  }
  const appAsarPath = artifactPath(releaseRoot, 'win-unpacked/resources/app.asar');
  await regularFile(appAsarPath, releaseRoot);
  return [
    { path: expectedInstaller, absolutePath: artifactPath(releaseRoot, expectedInstaller) },
    {
      path: `win-unpacked/${productName}.exe`,
      absolutePath: artifactPath(releaseRoot, `win-unpacked/${productName}.exe`),
    },
    {
      path: 'win-unpacked/resources/app.asar',
      absolutePath: appAsarPath,
    },
  ];
}

async function fileEvidence(item, releaseRoot, getAuthenticodeStatus, getEmbeddedVersion) {
  const info = await regularFile(item.absolutePath, releaseRoot);
  const isExecutable = item.path.toLowerCase().endsWith('.exe');
  return {
    path: item.path,
    bytes: info.size,
    sha256: await sha256File(item.absolutePath),
    authenticode: isExecutable ? await getAuthenticodeStatus(item.absolutePath) : 'NotApplicable',
    embeddedVersion: await getEmbeddedVersion(item, releaseRoot),
  };
}

function parseSums(source) {
  const records = new Map();
  for (const line of source.trim().split(/\r?\n/u)) {
    const match = /^([0-9A-F]{64}) \*(.+)$/u.exec(line);
    if (!match) throw new Error(`Malformed SHA256SUMS entry: ${line}`);
    if (records.has(match[2])) throw new Error(`Duplicate SHA256SUMS entry: ${match[2]}`);
    records.set(match[2], match[1]);
  }
  return records;
}

export async function verifyCandidate(
  releaseRoot,
  {
    expectedCommit,
    expectedProductName = 'Fablevia',
    expectedVersion,
    getAuthenticodeStatus = defaultAuthenticodeStatus,
    getEmbeddedVersion = defaultEmbeddedVersion,
  } = {},
) {
  const requestedRoot = path.resolve(releaseRoot);
  const requestedRootInfo = await lstat(requestedRoot);
  if (!requestedRootInfo.isDirectory() || requestedRootInfo.isSymbolicLink()) {
    throw new Error(`Candidate root must be a regular non-symlink directory: ${requestedRoot}`);
  }
  const resolvedRoot = await realpath(requestedRoot);
  const rootInfo = await lstat(resolvedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    throw new Error(`Candidate root must be a regular directory: ${resolvedRoot}`);
  }

  const manifestPath = artifactPath(resolvedRoot, MANIFEST_NAME);
  await regularFile(manifestPath, resolvedRoot);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (
    manifest?.schemaVersion !== 2 ||
    manifest?.status !== STATUS ||
    manifest?.stage !== 'preflight' ||
    manifest?.readyForSigning !== false ||
    manifest?.sourceDirty !== false
  ) {
    throw new Error('Candidate manifest status/schema/source identity is invalid.');
  }
  if (
    typeof manifest.candidateCommit !== 'string' ||
    !/^[0-9a-f]{40}$/u.test(manifest.candidateCommit)
  ) {
    throw new Error('Candidate commit must be a full lowercase Git SHA.');
  }
  if (expectedCommit && manifest.candidateCommit !== expectedCommit.toLowerCase()) {
    throw new Error(
      `Candidate commit mismatch: expected ${expectedCommit}, found ${manifest.candidateCommit}.`,
    );
  }
  if (expectedVersion && manifest.version !== expectedVersion) {
    throw new Error(
      `Candidate version mismatch: expected ${expectedVersion}, found ${manifest.version}.`,
    );
  }
  if (manifest.productName !== expectedProductName) {
    throw new Error(
      `Candidate product mismatch: expected ${expectedProductName}, found ${manifest.productName}.`,
    );
  }
  if (manifest.releaseChannel !== 'preview')
    throw new Error('Unsigned candidate releaseChannel must be preview.');
  if (typeof manifest.productName !== 'string' || typeof manifest.version !== 'string') {
    throw new Error('Candidate product/version identity is missing.');
  }

  const discovered = await discoverCandidateArtifacts(
    resolvedRoot,
    manifest.productName,
    manifest.version,
  );
  const expectedPaths = discovered.map((item) => item.path).sort();
  const declaredArtifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const declaredPaths = declaredArtifacts.map((item) => item?.path).sort();
  if (JSON.stringify(declaredPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error(`Candidate artifact paths are invalid: ${JSON.stringify(declaredPaths)}.`);
  }

  for (const declared of declaredArtifacts) {
    const absolutePath = artifactPath(resolvedRoot, declared.path);
    const actual = await fileEvidence(
      { path: declared.path, absolutePath },
      resolvedRoot,
      getAuthenticodeStatus,
      getEmbeddedVersion,
    );
    if (actual.bytes !== declared.bytes || actual.sha256 !== declared.sha256) {
      throw new Error(`Candidate artifact hash/size drift: ${declared.path}.`);
    }
    const expectedAuthenticode = declared.path.toLowerCase().endsWith('.exe')
      ? 'NotSigned'
      : 'NotApplicable';
    if (
      declared.authenticode !== expectedAuthenticode ||
      actual.authenticode !== expectedAuthenticode
    ) {
      throw new Error(
        `UNSIGNED_PREFLIGHT requires ${expectedAuthenticode} for ${declared.path}.`,
      );
    }
    if (
      declared.embeddedVersion !== manifest.version ||
      actual.embeddedVersion !== manifest.version ||
      declared.embeddedVersion !== actual.embeddedVersion
    ) {
      throw new Error(
        `Candidate embedded version mismatch for ${declared.path}: expected ${manifest.version}, declared ${String(declared.embeddedVersion)}, found ${actual.embeddedVersion}.`,
      );
    }
  }

  const sumsPath = artifactPath(resolvedRoot, SUMS_NAME);
  await regularFile(sumsPath, resolvedRoot);
  const sums = parseSums(await readFile(sumsPath, 'utf8'));
  const summedPaths = [...expectedPaths, MANIFEST_NAME].sort();
  if (JSON.stringify([...sums.keys()].sort()) !== JSON.stringify(summedPaths)) {
    throw new Error(`SHA256SUMS paths are invalid: ${JSON.stringify([...sums.keys()].sort())}.`);
  }
  for (const relativePath of summedPaths) {
    const summedPath = artifactPath(resolvedRoot, relativePath);
    await regularFile(summedPath, resolvedRoot);
    const actualHash = await sha256File(summedPath);
    if (sums.get(relativePath) !== actualHash)
      throw new Error(`SHA256SUMS drift: ${relativePath}.`);
  }

  return { releaseRoot: resolvedRoot, manifestPath, manifest };
}

export function parseCliOptions(args, allowedNames) {
  const allowed = new Set(allowedNames);
  const parsed = new Map();
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (!allowed.has(name)) throw new Error(`Unknown option: ${String(name)}`);
    if (parsed.has(name)) throw new Error(`Duplicate option: ${name}`);
    const value = args[index + 1];
    if (typeof value !== 'string' || value.startsWith('--')) {
      throw new Error(`Option ${name} requires a value.`);
    }
    parsed.set(name, value);
    index += 1;
  }
  return parsed;
}

async function readProductIdentity() {
  const packageJson = JSON.parse(await readFile(path.join(WORKSPACE_ROOT, 'package.json'), 'utf8'));
  if (
    typeof packageJson.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(packageJson.version) ||
    packageJson.productName !== 'Fablevia' ||
    packageJson.releaseChannel !== 'preview'
  ) {
    throw new Error('Root package identity must define a SemVer Fablevia preview release.');
  }
  return packageJson;
}

async function createCandidate(args) {
  if (process.platform !== 'win32') throw new Error('Windows candidate creation requires Windows.');
  parseCliOptions(args, []);
  assertCleanWorktree();
  const identity = await readProductIdentity();
  const commit = currentHead();

  const candidatesRoot = await assertNoWorkspaceLinkEscape(
    path.resolve(WORKSPACE_ROOT, 'release', 'candidates'),
    'candidates root',
  );
  await mkdir(candidatesRoot, { recursive: true });
  await regularDirectory(candidatesRoot);
  await assertNoWorkspaceLinkEscape(candidatesRoot, 'candidates root');

  const utcRun = new Date().toISOString().replaceAll(/[-:.]/gu, '');
  const commitDirectory = await assertNoWorkspaceLinkEscape(
    path.join(candidatesRoot, identity.version, commit),
    'candidate commit directory',
  );
  await mkdir(commitDirectory, { recursive: true });
  await regularDirectory(commitDirectory);
  const candidateDirectory = assertPathInside(
    commitDirectory,
    path.join(commitDirectory, utcRun),
    'candidate directory',
  );
  await mkdir(candidateDirectory);
  await regularDirectory(candidateDirectory);
  await assertNoWorkspaceLinkEscape(candidateDirectory, 'candidate directory');
  const candidateId = `${identity.version}/${commit}/${utcRun}`;

  const packageCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  command(packageCommand, ['package:win'], {
    cwd: WORKSPACE_ROOT,
    env: { ...process.env, PLOTFLOW_RELEASE_OUTPUT: candidateDirectory },
    stdio: 'inherit',
  });
  assertCleanWorktree();
  assertHead(commit);

  const artifacts = await discoverCandidateArtifacts(
    candidateDirectory,
    identity.productName,
    identity.version,
  );
  const evidence = await Promise.all(
    artifacts.map((item) =>
      fileEvidence(item, candidateDirectory, defaultAuthenticodeStatus, defaultEmbeddedVersion),
    ),
  );
  if (
    evidence.some(
      (item) =>
        item.authenticode !== (item.path.toLowerCase().endsWith('.exe') ? 'NotSigned' : 'NotApplicable'),
    )
  ) {
    throw new Error('Unsigned preflight creation refuses signed or invalid-signature artifacts.');
  }
  const manifest = {
    schemaVersion: 2,
    status: STATUS,
    stage: 'preflight',
    readyForSigning: false,
    candidateId,
    candidateCommit: commit,
    sourceDirty: false,
    productName: identity.productName,
    version: identity.version,
    releaseChannel: identity.releaseChannel,
    createdAt: new Date().toISOString(),
    artifacts: evidence,
  };
  const manifestPath = path.join(candidateDirectory, MANIFEST_NAME);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const sumRecords = [
    ...evidence.map((item) => ({ path: item.path, sha256: item.sha256 })),
    { path: MANIFEST_NAME, sha256: await sha256File(manifestPath) },
  ].sort((left, right) => left.path.localeCompare(right.path));
  await writeFile(
    path.join(candidateDirectory, SUMS_NAME),
    `${sumRecords.map((item) => `${item.sha256} *${item.path}`).join('\n')}\n`,
    'utf8',
  );
  assertHead(commit);
  await verifyCandidate(candidateDirectory, {
    expectedCommit: commit,
    expectedVersion: identity.version,
  });
  assertCleanWorktree();
  assertHead(commit);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `candidate_dir=${candidateDirectory}\n`, 'utf8');
    await appendFile(process.env.GITHUB_OUTPUT, `candidate_manifest=${manifestPath}\n`, 'utf8');
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `unpacked_exe=${path.join(candidateDirectory, 'win-unpacked', identity.productName + '.exe')}\n`,
      'utf8',
    );
  }
  assertCleanWorktree();
  assertHead(commit);
  console.log(`CANDIDATE_DIR=${candidateDirectory}`);
  console.log(`CANDIDATE_MANIFEST=${manifestPath}`);
  console.log(
    `UNPACKED_EXE=${path.join(candidateDirectory, 'win-unpacked', identity.productName + '.exe')}`,
  );
}

async function verifyCommand(args) {
  const options = parseCliOptions(args, [
    '--release-root',
    '--expected-commit',
  ]);
  assertCleanWorktree();
  const identity = await readProductIdentity();
  const releaseRoot = options.get('--release-root') ?? process.env.PLOTFLOW_VALIDATED_RELEASE;
  if (!releaseRoot) {
    throw new Error('verify requires --release-root or PLOTFLOW_VALIDATED_RELEASE.');
  }
  const headCommit = currentHead();
  const expectedCommit = assertFullCommit(
    options.get('--expected-commit') ?? process.env.GITHUB_SHA ?? headCommit,
    'expected commit',
  );
  if (expectedCommit !== headCommit) {
    throw new Error(
      `Verification commit must match checked-out HEAD: expected ${expectedCommit}, HEAD ${headCommit}.`,
    );
  }
  const result = await verifyCandidate(releaseRoot, {
    expectedCommit,
    expectedVersion: identity.version,
  });
  assertCleanWorktree();
  assertHead(headCommit);
  console.log(`Verified ${result.manifest.status}: ${result.releaseRoot}`);
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'create') return createCandidate(args);
  if (mode === 'verify') return verifyCommand(args);
  throw new Error('Usage: windows-unsigned-candidate.mjs <create|verify> [options]');
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
