import { describe, expect, it } from 'vitest';
import { appT, appText } from './appI18n';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('appI18n', () => {
  it('keeps zh-CN and en-US dictionaries structurally aligned', () => {
    const zhKeys = flattenKeys(appText['zh-CN']).sort();
    const enKeys = flattenKeys(appText['en-US']).sort();

    expect(enKeys).toEqual(zhKeys);
  });

  it('covers the manual blackbox feedback surfaces in English', () => {
    expect(appT('home.title', undefined, 'en-US')).toContain('interactive stories');
    expect(appT('graphLab.diagnostics', { count: 1 }, 'en-US')).toBe('1 diagnostics');
    expect(appT('inspector.title', undefined, 'en-US')).toBe('Title');
    expect(appT('problemPanel.title', undefined, 'en-US')).toBe('Problems');
    expect(appT('exportDialog.unsupportedFormat', { format: 'json' }, 'en-US')).toBe(
      'Unsupported export format: json',
    );
  });

  it('does not fall back to raw keys for core UI labels', () => {
    const labels = [
      'home.title',
      'toolbar.export',
      'graphLab.openProblems',
      'sourceDock.title',
      'problemPanel.empty',
      'status.saveOpening',
      'themeCenter.title',
    ];

    for (const key of labels) {
      expect(appT(key, { count: 0 }, 'zh-CN')).not.toBe(key);
      expect(appT(key, { count: 0 }, 'en-US')).not.toBe(key);
    }
  });
});
