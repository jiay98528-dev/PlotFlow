import { describe, expect, it } from 'vitest';
import { buildExportBaseName } from './ExportDialog';

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
