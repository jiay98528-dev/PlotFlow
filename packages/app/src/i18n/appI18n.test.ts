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
    expect(appT('parse.graphIncomplete', { count: 2 }, 'en-US')).toBe('Graph view has 2 blocking errors');
    expect(appT('graphLab.diagnostics', { count: 1 }, 'en-US')).toBe('1 diagnostics');
    expect(appT('graphLab.chapterDiagnosticCount', { count: 2 }, 'en-US')).toBe('2 diagnostics');
    expect(appT('inspector.title', undefined, 'en-US')).toBe('Title');
    expect(appT('inspector.effectOperationAppend', undefined, 'en-US')).toBe('Append');
    expect(appT('inspector.confirmDeleteNode', { title: 'Start' }, 'en-US')).toBe('Delete node "Start"?');
    expect(appT('sourceDock.save', undefined, 'en-US')).toBe('Save to file');
    expect(appT('sourceDock.savedToDisk', { title: 'Chapter 1' }, 'en-US')).toBe('Saved to file: Chapter 1');
    expect(appT('sourceDock.diagnosticsInSlice', { count: 3 }, 'en-US')).toBe('3 diagnostics in this chapter');
    expect(appT('sourceDock.jumpToLine', { line: 12 }, 'en-US')).toBe('Jump to line 12');
    expect(appT('sourceDock.switchBlockedStale', undefined, 'en-US')).toBe(
      'The source slice changed. Revert or reload it before switching chapters.',
    );
    expect(appT('themeNode.status.error', undefined, 'en-US')).toBe('Needs repair');
    expect(appT('themeNode.nextRoute', undefined, 'en-US')).toBe('Next');
    expect(appT('themeNode.requires', { expression: 'coins >= 1' }, 'en-US')).toBe('Requires coins >= 1');
    expect(appT('themeNode.targetPreview', { target: 'Shop' }, 'en-US')).toBe('→ Shop');
    expect(appT('themeNode.effectPreview', { effects: 'coins -1' }, 'en-US')).toBe('Effect coins -1');
    expect(appT('themeNode.moreRoutes', { count: 2 }, 'en-US')).toBe('+2 routes');
    expect(appT('problemPanel.title', undefined, 'en-US')).toBe('Problems');
    expect(appT('problemPanel.filtersAria', undefined, 'en-US')).toBe('Problem severity filters');
    expect(appT('problemPanel.jumpedToNode', { title: 'Start' }, 'en-US')).toBe('Selected node: Start');
    expect(appT('statusBar.errorCount', { count: 2 }, 'en-US')).toBe('Errors 2');
    expect(appT('statusBar.warningCount', { count: 1 }, 'en-US')).toBe('Warnings 1');
    expect(appT('statusBar.infoCount', { count: 3 }, 'en-US')).toBe('Suggestions 3');
    expect(appT('exportDialog.unsupportedFormat', { format: 'json' }, 'en-US')).toBe(
      'Unsupported export format: json',
    );
  });

  it('does not fall back to raw keys for core UI labels', () => {
    const labels = [
      'home.title',
      'toolbar.export',
      'graphLab.openProblems',
      'graphCanvas.emptyTitle',
      'graphContext.deleteNode',
      'conditionEditor.close',
      'outline.empty',
      'appShell.externalChangeTitle',
      'sourceDock.title',
      'problemPanel.empty',
      'problemPanel.listAria',
      'status.saveOpening',
      'themeCenter.title',
    ];

    for (const key of labels) {
      expect(appT(key, { count: 0 }, 'zh-CN')).not.toBe(key);
      expect(appT(key, { count: 0 }, 'en-US')).not.toBe(key);
    }
  });
});
