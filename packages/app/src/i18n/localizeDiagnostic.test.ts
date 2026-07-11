import { describe, expect, it } from 'vitest';
import { createDiagnosticLocalization, type Diagnostic } from '@plotflow/core';
import { localizeDiagnostic } from './localizeDiagnostic';

function diagnostic(code: Diagnostic['code'], message: string): Diagnostic {
  return {
    id: `test-${code}`,
    code,
    severity: code.startsWith('E') ? 'error' : code.startsWith('W') ? 'warning' : 'info',
    message,
    ...createDiagnosticLocalization(code),
    range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2 },
  };
}

describe('localizeDiagnostic', () => {
  it('uses the stable diagnostic key in English, including W007', () => {
    expect(localizeDiagnostic(diagnostic('W007', '中文回退'), 'en-US').message).toContain('closed loop');
  });

  it('keeps raw detail text when no detail key is available', () => {
    const input = { ...diagnostic('E005', 'fallback'), detail: 'raw detail' };
    expect(localizeDiagnostic(input, 'en-US').detail).toBe('raw detail');
  });
});
