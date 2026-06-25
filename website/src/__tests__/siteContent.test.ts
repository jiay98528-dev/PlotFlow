import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getProjectStatusPath } from '../App';
import { fallbackProjectStatus } from '../data/projectStatusFallback';
import { developmentCopy, guide, landing, locales, officialThemes } from '../data/siteContent';

const projectStatusPath = path.resolve(__dirname, '../../public/data/project-status.json');

function collectVisibleStrings(value: unknown, key = ''): string[] {
  if (key === 'id') {
    return [];
  }
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectVisibleStrings(item));
  }
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
    }
  });

  it('retains core proper nouns in Chinese copy', () => {
    const zhSource = collectVisibleStrings({
      landing: landing.zh,
      guide: guide.zh,
      development: developmentCopy.zh,
      officialThemes: officialThemes.zh,
    }).join('\n');
    expect(zhSource).toMatch(/PlotFlow/);
    expect(zhSource).toMatch(/\.mdstory/);
    expect(zhSource).toMatch(/Windows/);
    expect(zhSource).toMatch(/Graph Lab/);
    expect(zhSource).toMatch(/JSON \/ HTML \/ TXT/);
    expect(zhSource).toMatch(/Godot/);
    expect(zhSource).toMatch(/叙事工作台/);
    expect(zhSource).toMatch(/夜航蓝图/);
    expect(zhSource).not.toMatch(/没有缺陷|完全无缺陷/);
    expect(zhSource).toMatch(/当前无已知阻断 BUG/);
  });

  it('describes official themes without exposing community import', () => {
    expect(officialThemes.zh.items.map((item) => item.id)).toEqual([
      'plotflow-narrative-workbench',
      'plotflow-blueprint-nightwatch',
    ]);
    const visible = collectVisibleStrings(officialThemes.zh).join('\n');
    expect(visible).toContain('官方主题');
    expect(visible).toContain('购买更多官方主题');
    expect(visible).not.toContain('.pf-theme');
    expect(visible).not.toContain('导入主题包');
  });

  it('has generated project status data for the development page', () => {
    const status = JSON.parse(readFileSync(projectStatusPath, 'utf8'));
    expect(status.summary.completed).toBeGreaterThan(0);
    expect(status.summary.total).toBeGreaterThan(status.summary.completed);
    expect(status.releaseGates.length).toBeGreaterThan(4);
    expect(
      status.stableFeatures.some(
        (item: { title: string; zhTitle?: string }) =>
          item.title.includes('Graph Lab') && item.zhTitle?.includes('Graph Lab'),
      ),
    ).toBe(true);
  });

  it('localizes generated release gates without falling back to generic labels', () => {
    const status = JSON.parse(readFileSync(projectStatusPath, 'utf8'));
    const gateByName = new Map<string, { zhName: string; zhDetail: string }>(
      status.releaseGates.map((gate: { name: string; zhName: string; zhDetail: string }) => [
        gate.name,
        gate,
      ]),
    );

    expect(gateByName.get('pnpm.cmd test')?.zhName).toBe('单元测试');
    expect(gateByName.get('pnpm.cmd test')?.zhDetail).toContain('41 个测试文件 / 1231 条测试用例');
    expect(gateByName.get('pnpm.cmd --filter @plotflow/progress-dashboard typecheck')?.zhName).toBe(
      '进度仪表盘类型检查',
    );
    expect(gateByName.get('pnpm.cmd --filter @plotflow/app test:e2e')?.zhName).toBe(
      '应用端到端验收',
    );
  });

  it('builds project status paths from the Vite base URL', () => {
    expect(getProjectStatusPath('/')).toBe('/data/project-status.json');
    expect(getProjectStatusPath('/plotflow/')).toBe('/plotflow/data/project-status.json');
    expect(getProjectStatusPath('/plotflow')).toBe('/plotflow/data/project-status.json');
  });

  it('renders an explicit fallback when project status data is unavailable', () => {
    expect(fallbackProjectStatus.releaseGates).toHaveLength(1);
    expect(fallbackProjectStatus.releaseGates[0]?.zhName).toBe('项目状态数据');
    expect(fallbackProjectStatus.releaseGates[0]?.zhDetail).toContain('sync:data');
  });
});
