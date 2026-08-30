import { describe, expect, it } from 'vitest';
import { normalizeSourceDraftText, serializeSourceDraftText } from './sourceDraftText';

describe('Source Drawer newline handling', () => {
  it('compares CRLF and textarea LF using the same canonical draft text', () => {
    const diskSlice = '# Chapter\r\n\r\n## Node\r\nBody.\r\n';
    const textareaValue = '# Chapter\n\n## Node\nBody.\n';

    expect(normalizeSourceDraftText(diskSlice)).toBe(textareaValue);
  });

  it.each([
    ['\r\n', '# Chapter\r\nBody.\r\n'],
    ['\r', '# Chapter\rBody.\r'],
    ['\n', '# Chapter\nBody.\n'],
  ] as const)('restores %j only when serializing the committed slice', (newline, expected) => {
    expect(serializeSourceDraftText('# Chapter\nBody.\n', newline)).toBe(expected);
  });
});
