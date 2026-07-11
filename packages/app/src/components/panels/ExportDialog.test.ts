import { describe, expect, it } from 'vitest';
import { buildExportBaseName, countBlockingExportErrors } from './ExportDialog';

describe('ExportDialog file name fallback', () => {
  it('falls back to the current story file when the title is still a template placeholder', () => {
    expect(buildExportBaseName('{{title}}', 'D:/stories/native-export.mdstory')).toBe('native-export');
  });

  it('sanitizes Windows-invalid characters from metadata titles', () => {
    expect(buildExportBaseName('Act 1: A/B*Test?', null)).toBe('Act 1_ A_B_Test_');
  });

  it('falls back to a safe name for reserved Windows device names', () => {
    expect(buildExportBaseName('CON', null)).toBe('plotflow-story');
  });
});

describe('ExportDialog diagnostic gate', () => {
  it('counts only Error diagnostics as export blockers', () => {
    expect(countBlockingExportErrors([
      { id: 'e', code: 'E001', severity: 'error', message: 'broken target', range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 } },
      { id: 'w', code: 'W001', severity: 'warning', message: 'orphan', range: { startLine: 2, startColumn: 1, endLine: 2, endColumn: 2 } },
      { id: 'i', code: 'I001', severity: 'info', message: 'hint', range: { startLine: 3, startColumn: 1, endLine: 3, endColumn: 2 } },
    ])).toBe(1);
  });
});
