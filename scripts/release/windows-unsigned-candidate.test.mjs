import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  currentPnpmInvocation,
  parseCliOptions,
  sha256File,
  verifyCandidate,
  WORKSPACE_ROOT,
} from './windows-unsigned-candidate.mjs';

const COMMIT = 'a'.repeat(40);
const fakeAuthenticode = async () => 'NotSigned';
const fakeEmbeddedVersion = async () => '0.1.1';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex').toUpperCase();

test('runs packaging through the active pnpm CLI without spawning a Windows .cmd shim', () => {
  const pnpmEntry = path.resolve(WORKSPACE_ROOT, '.tmp', 'fixture-pnpm.cjs');
  assert.deepEqual(currentPnpmInvocation({ npm_execpath: pnpmEntry }), {
    executable: process.execPath,
    prefixArgs: [pnpmEntry],
  });
  assert.throws(() => currentPnpmInvocation({}), /must run through pnpm/u);
  assert.throws(
    () => currentPnpmInvocation({ npm_execpath: 'pnpm.cmd' }),
    /must run through pnpm/u,
  );
});

async function fixture() {
  const base = path.join(WORKSPACE_ROOT, '.tmp', 'release-candidate-tests');
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(path.join(base, 'candidate-'));
  await mkdir(path.join(root, 'win-unpacked'));
  await mkdir(path.join(root, 'win-unpacked', 'resources'));
  const installerPath = path.join(root, 'Fablevia Setup 0.1.1.exe');
  const executablePath = path.join(root, 'win-unpacked', 'Fablevia.exe');
  const appAsarPath = path.join(root, 'win-unpacked', 'resources', 'app.asar');
  const installerBytes = Buffer.from('MZ unsigned installer fixture');
  const executableBytes = Buffer.from('MZ unsigned executable fixture');
  const appAsarBytes = Buffer.from('unsigned app.asar fixture');
  await writeFile(installerPath, installerBytes);
  await writeFile(executablePath, executableBytes);
  await writeFile(appAsarPath, appAsarBytes);
  const manifest = {
    schemaVersion: 2,
    status: 'UNSIGNED_PREFLIGHT',
    stage: 'preflight',
    readyForSigning: false,
    candidateId: 'fixture',
    candidateCommit: COMMIT,
    sourceDirty: false,
    productName: 'Fablevia',
    version: '0.1.1',
    releaseChannel: 'preview',
    createdAt: '2026-08-02T00:00:00.000Z',
    artifacts: [
      {
        path: 'Fablevia Setup 0.1.1.exe',
        bytes: installerBytes.length,
        sha256: hash(installerBytes),
        authenticode: 'NotSigned',
        embeddedVersion: '0.1.1',
      },
      {
        path: 'win-unpacked/Fablevia.exe',
        bytes: executableBytes.length,
        sha256: hash(executableBytes),
        authenticode: 'NotSigned',
        embeddedVersion: '0.1.1',
      },
      {
        path: 'win-unpacked/resources/app.asar',
        bytes: appAsarBytes.length,
        sha256: hash(appAsarBytes),
        authenticode: 'NotApplicable',
        embeddedVersion: '0.1.1',
      },
    ],
  };
  const manifestPath = path.join(root, 'candidate-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(
    path.join(root, 'SHA256SUMS.txt'),
    [
      `${hash(installerBytes)} *Fablevia Setup 0.1.1.exe`,
      `${await sha256File(manifestPath)} *candidate-manifest.json`,
      `${hash(executableBytes)} *win-unpacked/Fablevia.exe`,
      `${hash(appAsarBytes)} *win-unpacked/resources/app.asar`,
    ].join('\n') + '\n',
  );
  return { root, manifest, manifestPath, executablePath };
}

test('verifies a bound unsigned candidate and rejects hash drift', async () => {
  const item = await fixture();
  try {
    await verifyCandidate(item.root, {
      expectedCommit: COMMIT,
      expectedVersion: '0.1.1',
      getAuthenticodeStatus: fakeAuthenticode,
      getEmbeddedVersion: fakeEmbeddedVersion,
    });
    await writeFile(item.executablePath, 'changed');
    await assert.rejects(
      verifyCandidate(item.root, {
        getAuthenticodeStatus: fakeAuthenticode,
        getEmbeddedVersion: fakeEmbeddedVersion,
      }),
      /hash\/size drift/u,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test('rejects multiple installers', async () => {
  const item = await fixture();
  try {
    await writeFile(path.join(item.root, 'Fablevia Setup stale.exe'), 'stale');
    await assert.rejects(
      verifyCandidate(item.root, {
        getAuthenticodeStatus: fakeAuthenticode,
        getEmbeddedVersion: fakeEmbeddedVersion,
      }),
      /exactly one installer/u,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test('rejects a candidate bound to a different commit', async () => {
  const item = await fixture();
  try {
    await assert.rejects(
      verifyCandidate(item.root, {
        expectedCommit: 'b'.repeat(40),
        getAuthenticodeStatus: fakeAuthenticode,
        getEmbeddedVersion: fakeEmbeddedVersion,
      }),
      /Candidate commit mismatch/u,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test('rejects artifact path escape before reading external bytes', async () => {
  const item = await fixture();
  try {
    const manifest = JSON.parse(await readFile(item.manifestPath, 'utf8'));
    manifest.artifacts[0].path = '../outside.exe';
    await writeFile(item.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await assert.rejects(
      verifyCandidate(item.root, {
        getAuthenticodeStatus: fakeAuthenticode,
        getEmbeddedVersion: fakeEmbeddedVersion,
      }),
      /artifact paths are invalid|Unsafe candidate artifact path/u,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test('rejects a declared or packaged version that differs from the candidate version', async () => {
  const item = await fixture();
  try {
    await assert.rejects(
      verifyCandidate(item.root, {
        getAuthenticodeStatus: fakeAuthenticode,
        getEmbeddedVersion: async () => '0.1.0',
      }),
      /embedded version mismatch/u,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test('binds the unpacked app.asar bytes used as the application version source', async () => {
  const item = await fixture();
  try {
    await writeFile(path.join(item.root, 'win-unpacked', 'resources', 'app.asar'), 'changed');
    await assert.rejects(
      verifyCandidate(item.root, {
        getAuthenticodeStatus: fakeAuthenticode,
        getEmbeddedVersion: fakeEmbeddedVersion,
      }),
      /hash\/size drift/u,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
  }
});

test('rejects an app.asar reached through an escaping directory junction', async () => {
  const item = await fixture();
  const base = path.join(WORKSPACE_ROOT, '.tmp', 'release-candidate-tests');
  const externalResources = await mkdtemp(path.join(base, 'external-resources-'));
  const resourcesPath = path.join(item.root, 'win-unpacked', 'resources');
  try {
    const appAsar = await readFile(path.join(resourcesPath, 'app.asar'));
    await rm(resourcesPath, { recursive: true, force: true });
    await writeFile(path.join(externalResources, 'app.asar'), appAsar);
    await symlink(
      externalResources,
      resourcesPath,
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    await assert.rejects(
      verifyCandidate(item.root, {
        getAuthenticodeStatus: fakeAuthenticode,
        getEmbeddedVersion: fakeEmbeddedVersion,
      }),
      /symlink or junction|escapes the real candidate root/u,
    );
  } finally {
    await rm(item.root, { recursive: true, force: true });
    await rm(externalResources, { recursive: true, force: true });
  }
});

test('rejects missing, duplicate, and unknown CLI option values', () => {
  assert.throws(() => parseCliOptions(['--release-root'], ['--release-root']), /requires a value/u);
  assert.throws(
    () => parseCliOptions(['--release-root', 'one', '--release-root', 'two'], ['--release-root']),
    /Duplicate option/u,
  );
  assert.throws(
    () => parseCliOptions(['--unexpected', 'value'], ['--release-root']),
    /Unknown option/u,
  );
});
