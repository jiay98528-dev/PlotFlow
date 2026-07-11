import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import AdmZip from 'adm-zip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadOfficialTheme,
  listInstalledOfficialThemes,
  listOfficialRemoteThemes,
  listOfficialRemoteThemeViews,
  normalizeOfficialThemePackagePath,
  validateOfficialThemeRegistry,
} from './official-theme-service';

const TEST_ROOT = join(tmpdir(), 'plotflow-official-theme-service-test');

vi.mock('electron', () => ({
  app: { getPath: () => TEST_ROOT },
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  },
}));

function makeThemeZip(files?: Record<string, string>): Buffer {
  const zip = new AdmZip();
  const defaultFiles: Record<string, string> = {
    'manifest.json': JSON.stringify({
      id: 'plotflow-neon-dossier',
      version: '1.0.0',
      themeApiVersion: 1,
      entry: 'index.mjs',
      styles: ['theme.css'],
      assetsBase: 'assets',
    }),
    'index.mjs': 'export function createTheme(host) { return { descriptor: {} }; }',
    'theme.css': '[data-theme-id="plotflow-neon-dossier"] { --remote-fixture: 1; }',
    'assets/preview.svg': '<svg xmlns="http://www.w3.org/2000/svg" />',
  };
  for (const [name, content] of Object.entries(files ?? defaultFiles)) {
    zip.addFile(name, Buffer.from(content, 'utf-8'));
  }
  return zip.toBuffer();
}

function makeRegistry(bundleBytes: Buffer) {
  return {
    themes: [
      {
        id: 'plotflow-neon-dossier',
        name: { 'zh-CN': '霓虹档案', 'en-US': 'Neon Dossier' },
        version: '1.0.0',
        channel: 'stable',
        priceLabel: '免费主题',
        manifestUrl: 'https://plotflow.app/themes/plotflow-neon-dossier/manifest.json',
        bundleUrl: 'https://plotflow.app/themes/plotflow-neon-dossier/plotflow-neon-dossier-1.0.0.pf-official-theme.zip',
        sha256: createHash('sha256').update(bundleBytes).digest('hex'),
        minAppVersion: '0.1.0',
        themeApiVersion: 1,
        previewUrl: 'https://plotflow.app/themes/plotflow-neon-dossier/preview.svg',
        changelog: 'Initial free official theme.',
      },
    ],
  };
}

describe('official-theme-service', () => {
  beforeEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  it('validates official registry entries and requires free theme label', () => {
    const validRegistry = makeRegistry(makeThemeZip());
    expect(validateOfficialThemeRegistry(validRegistry)).toHaveLength(1);

    const paidRegistry = {
      themes: [{ ...validRegistry.themes[0], priceLabel: '付费主题' }],
    };
    expect(() => validateOfficialThemeRegistry(paidRegistry)).toThrow('免费主题');
  });

  it('requires registry bundleUrl to point at official theme zip', () => {
    const bundleBytes = makeThemeZip();
    const registry = makeRegistry(bundleBytes);

    expect(() => validateOfficialThemeRegistry({
      themes: [{ ...registry.themes[0], bundleUrl: 'https://plotflow.app/themes/theme-bundle.json' }],
    })).toThrow('.pf-official-theme.zip');
  });

  it('normalizes zip paths and rejects traversal or absolute paths', () => {
    expect(normalizeOfficialThemePackagePath('assets/preview.svg')).toBe('assets/preview.svg');
    expect(() => normalizeOfficialThemePackagePath('../outside.svg')).toThrow('越界');
    expect(() => normalizeOfficialThemePackagePath('/absolute.svg')).toThrow('绝对路径');
    expect(() => normalizeOfficialThemePackagePath('C:\\temp\\evil.svg')).toThrow('绝对路径');
  });

  it('fails closed when remote registry cannot be fetched', async () => {
    const result = await listOfficialRemoteThemes({
      fetchJson: async () => {
        throw new Error('network down');
      },
    });

    expect(result.ok).toBe(false);
    expect(result.entries).toHaveLength(0);
  });

  it('marks remote theme as not installed, then installed after zip download', async () => {
    const bundleBytes = makeThemeZip();
    const deps = {
      fetchJson: async () => makeRegistry(bundleBytes),
      fetchBytes: async () => bundleBytes,
      now: () => 123,
    };

    await expect(listOfficialRemoteThemeViews(deps)).resolves.toMatchObject([
      { id: 'plotflow-neon-dossier', status: 'notInstalled' },
    ]);

    const installed = await downloadOfficialTheme('plotflow-neon-dossier', deps);
    expect(installed.ok).toBe(true);

    await expect(readFile(join(TEST_ROOT, 'official-themes', 'plotflow-neon-dossier', '1.0.0', 'index.mjs'), 'utf-8'))
      .resolves.toContain('createTheme');
    await expect(listInstalledOfficialThemes()).resolves.toMatchObject([
      {
        id: 'plotflow-neon-dossier',
        version: '1.0.0',
        priceLabel: '免费主题',
        runtime: {
          moduleUrl: 'plotflow-theme://official/plotflow-neon-dossier/1.0.0/index.mjs',
          styleUrls: ['plotflow-theme://official/plotflow-neon-dossier/1.0.0/theme.css'],
          assetBaseUrl: 'plotflow-theme://official/plotflow-neon-dossier/1.0.0/assets/',
        },
      },
    ]);
    await expect(listOfficialRemoteThemeViews(deps)).resolves.toMatchObject([
      { id: 'plotflow-neon-dossier', status: 'installed', installedVersion: '1.0.0' },
    ]);
  });

  it('rejects bundle hash mismatch without installing', async () => {
    const bundleBytes = makeThemeZip();
    const result = await downloadOfficialTheme('plotflow-neon-dossier', {
      fetchJson: async () => makeRegistry(bundleBytes),
      fetchBytes: async () => Buffer.from('tampered', 'utf-8'),
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('完整性校验失败');
    await expect(listInstalledOfficialThemes()).resolves.toHaveLength(0);
  });

  it('rejects official zips without manifest or runtime entry', async () => {
    const noManifest = makeThemeZip({ 'index.mjs': 'export function createTheme() {}' });
    const missingEntry = makeThemeZip({
      'manifest.json': JSON.stringify({
        id: 'plotflow-neon-dossier',
        version: '1.0.0',
        themeApiVersion: 1,
        entry: 'missing.mjs',
      }),
    });

    await expect(downloadOfficialTheme('plotflow-neon-dossier', {
      fetchJson: async () => makeRegistry(noManifest),
      fetchBytes: async () => noManifest,
    })).resolves.toMatchObject({ ok: false, message: expect.stringContaining('manifest.json') });

    await expect(downloadOfficialTheme('plotflow-neon-dossier', {
      fetchJson: async () => makeRegistry(missingEntry),
      fetchBytes: async () => missingEntry,
    })).resolves.toMatchObject({ ok: false, message: expect.stringContaining('entry') });
  });

  it('rejects official zips with path traversal entries', async () => {
    const bundleBytes = makeThemeZip({
      'manifest.json': JSON.stringify({
        id: 'plotflow-neon-dossier',
        version: '1.0.0',
        themeApiVersion: 1,
        entry: '../index.mjs',
      }),
      'index.mjs': 'export function createTheme() {}',
    });

    await expect(downloadOfficialTheme('plotflow-neon-dossier', {
      fetchJson: async () => makeRegistry(bundleBytes),
      fetchBytes: async () => bundleBytes,
    })).resolves.toMatchObject({ ok: false, message: expect.stringContaining('越界') });
  });
});
