import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadOfficialTheme,
  listInstalledOfficialThemes,
  listOfficialRemoteThemes,
  listOfficialRemoteThemeViews,
  validateOfficialThemeRegistry,
} from './official-theme-service';

const TEST_ROOT = join(tmpdir(), 'plotflow-official-theme-service-test');

vi.mock('electron', () => ({
  app: { getPath: () => TEST_ROOT },
}));

const bundleBytes = new TextEncoder().encode('{"entry":"prebuilt:plotflow-neon-dossier"}');
const bundleHash = createHash('sha256').update(bundleBytes).digest('hex');

const validRegistry = {
  themes: [
    {
      id: 'plotflow-neon-dossier',
      name: { 'zh-CN': '霓虹档案', 'en-US': 'Neon Dossier' },
      version: '1.0.0',
      channel: 'stable',
      priceLabel: '免费主题',
      manifestUrl: 'https://plotflow.app/themes/plotflow-neon-dossier/manifest.json',
      bundleUrl: 'https://plotflow.app/themes/plotflow-neon-dossier/theme-bundle.json',
      sha256: bundleHash,
      minAppVersion: '0.1.0',
      themeApiVersion: 1,
      previewUrl: 'https://plotflow.app/themes/plotflow-neon-dossier/preview.svg',
      changelog: 'Initial free official theme.',
    },
  ],
};

describe('official-theme-service', () => {
  beforeEach(async () => {
    await rm(TEST_ROOT, { recursive: true, force: true });
  });

  it('validates official registry entries and requires free theme label', () => {
    expect(validateOfficialThemeRegistry(validRegistry)).toHaveLength(1);

    const paidRegistry = {
      themes: [{ ...validRegistry.themes[0], priceLabel: '付费主题' }],
    };
    expect(() => validateOfficialThemeRegistry(paidRegistry)).toThrow('免费主题');
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

  it('marks remote theme as not installed, then installed after download', async () => {
    const deps = {
      fetchJson: async () => validRegistry,
      fetchBytes: async () => bundleBytes,
      now: () => 123,
    };

    await expect(listOfficialRemoteThemeViews(deps)).resolves.toMatchObject([
      { id: 'plotflow-neon-dossier', status: 'notInstalled' },
    ]);

    const installed = await downloadOfficialTheme('plotflow-neon-dossier', deps);
    expect(installed.ok).toBe(true);

    await expect(listInstalledOfficialThemes()).resolves.toMatchObject([
      { id: 'plotflow-neon-dossier', version: '1.0.0', priceLabel: '免费主题' },
    ]);
    await expect(listOfficialRemoteThemeViews(deps)).resolves.toMatchObject([
      { id: 'plotflow-neon-dossier', status: 'installed', installedVersion: '1.0.0' },
    ]);
  });

  it('rejects bundle hash mismatch without installing', async () => {
    const result = await downloadOfficialTheme('plotflow-neon-dossier', {
      fetchJson: async () => validRegistry,
      fetchBytes: async () => new TextEncoder().encode('tampered'),
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('完整性校验失败');
    await expect(listInstalledOfficialThemes()).resolves.toHaveLength(0);
  });
});
