import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getProjectStatusPath } from '../App';
import { fallbackProjectStatus } from '../data/projectStatusFallback';
import { developmentCopy, guide, landing, locales, officialThemes } from '../data/siteContent';

const projectStatusPath = path.resolve(__dirname, '../../public/data/project-status.json');

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function collectVisibleStrings(value: unknown, key = ''): string[] {
  if (key === 'id') return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((item) => collectVisibleStrings(item));
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([childKey, childValue]) =>
      collectVisibleStrings(childValue, childKey),
    );
  }
  return [];
}

describe('site content', () => {
  it('ships both Chinese and English landing copy', () => {
    for (const locale of locales) {
      expect(landing[locale].title).toBeTruthy();
      expect(landing[locale].features.length).toBeGreaterThanOrEqual(4);
      expect(guide[locale].sections.length).toBeGreaterThanOrEqual(8);
      expect(developmentCopy[locale].title).toBeTruthy();
    }
  });

  it('retains core product nouns in Chinese copy', () => {
    const zhSource = collectVisibleStrings({
      landing: landing.zh,
      guide: guide.zh,
      development: developmentCopy.zh,
      officialThemes: officialThemes.zh,
    }).join('\n');
    expect(zhSource).toMatch(/维叙（Fablevia）/);
    expect(zhSource).toMatch(/\.mdstory/);
    expect(zhSource).toMatch(/Windows/);
    expect(zhSource).toMatch(/Graph Lab/);
    expect(zhSource).toMatch(/JSON \/ HTML \/ TXT/);
    expect(zhSource).toMatch(/Godot/);
    expect(zhSource).toMatch(/叙事工作台/);
    expect(zhSource).toMatch(/棱镜铸造台/);
    expect(zhSource).toMatch(/引擎遥测台/);
    expect(zhSource).toMatch(/本地/);
  });

  it('describes exactly the three bundled themes without claiming remote availability', () => {
    expect(officialThemes.zh.items.map((item) => item.id)).toEqual([
      'plotflow-prism-foundry',
      'plotflow-narrative-workbench',
      'plotflow-engine-telemetry',
    ]);
    const visible = collectVisibleStrings(officialThemes.zh).join('\n');
    expect(visible).toContain('官方内置主题');
    expect(visible).toContain('随应用');
    expect(visible).not.toContain('霓虹档案');
    expect(visible).not.toContain('.pf-theme');
    expect(visible).not.toContain('购买');
    expect(visible).not.toContain('授权');
    expect(visible).not.toContain('社区');
  });

  it('publishes an empty remote theme registry while the runtime is paused', () => {
    const registryPath = path.resolve(__dirname, '../../public/data/official-themes.json');
    const registry = readJsonFile(registryPath) as { themes: Array<Record<string, unknown>> };
    expect(registry.themes).toEqual([]);
  });

  it('has generated project status data for the development page', () => {
    let status: {
      summary: { version: string; channel: string };
      releaseGates: Array<{
        name: string;
        status?: string;
        zhName?: string;
        zhDetail?: string;
        result?: string;
      }>;
      stableFeatures: Array<{ title: string; zhTitle?: string }>;
    };
    try {
      status = readJsonFile(projectStatusPath) as typeof status;
    } catch {
      status = fallbackProjectStatus;
    }
    const product = readJsonFile(path.resolve(__dirname, '../../../package.json')) as {
      version: string;
      releaseChannel: string;
    };
    expect(status.summary.version).toBe(product.version);
    expect(status.summary.channel).toBe(product.releaseChannel);
    expect(status.releaseGates.length).toBeGreaterThan(0);

    const unitGate = status.releaseGates.find((gate) => gate.name === 'pnpm.cmd test');
    const appE2eGate = status.releaseGates.find(
      (gate) => gate.name === 'pnpm.cmd --filter @plotflow/app test:e2e:background',
    );
    const packageGate = status.releaseGates.find((gate) => gate.name === 'pnpm.cmd package:win');

    const progress = readFileSync(path.resolve(__dirname, '../../../spec/progress.md'), 'utf8');
    expect(unitGate?.zhDetail).toBeTruthy();
    expect(progress).toContain(unitGate!.zhDetail!);
    expect(unitGate?.status).toBe('pass');
    expect(appE2eGate?.zhDetail).toBeTruthy();
    expect(progress).toContain(appE2eGate!.zhDetail!);
    expect(packageGate?.zhDetail).toBeTruthy();

    const visibleStatus = collectVisibleStrings(status).join('\n');
    expect(visibleStatus).not.toContain('39 条应用 E2E');
    expect(visibleStatus).not.toContain('43 个测试文件 / 1248 条测试用例');
  });

  it('builds project status paths from the Vite base URL', () => {
    expect(getProjectStatusPath('/')).toBe('/data/project-status.json');
    expect(getProjectStatusPath('/plotflow/')).toBe('/plotflow/data/project-status.json');
    expect(getProjectStatusPath('/plotflow')).toBe('/plotflow/data/project-status.json');
  });

  it('renders an explicit fallback when project status data is unavailable', () => {
    expect(fallbackProjectStatus.releaseGates).toHaveLength(1);
    expect(fallbackProjectStatus.releaseGates[0]?.name).toBeTruthy();
    expect(fallbackProjectStatus.releaseGates[0]?.detail).toContain('sync:data');
  });
});
