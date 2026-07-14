import { describe, expect, it } from 'vitest';
import { parseCondition } from '../parser/conditions.js';
import { parseEffects } from '../parser/effects.js';
import { parseFrontmatter } from '../parser/frontmatter.js';
import { parseStory } from '../parser/parser.js';
import type { Diagnostic, DiagnosticCode } from '../types/diagnostic.js';
import {
  createDiagnosticLocalization,
  DIAGNOSTIC_MESSAGE_KEYS,
} from '../types/diagnostic.js';
import { validate } from '../validator/validator.js';

const ALL_CODES = [
  'E001', 'E002', 'E003', 'E004', 'E005', 'E006', 'E007', 'E008', 'E009',
  'W001', 'W002', 'W003', 'W004', 'W005', 'W006', 'W007',
  'I001', 'I002', 'I003',
] as const satisfies readonly DiagnosticCode[];

function diagnosticsOf<T>(
  result:
    | { readonly ok: true; readonly diagnostics: readonly Diagnostic[]; readonly data: T }
    | { readonly ok: false; readonly errors: readonly Diagnostic[] },
): readonly Diagnostic[] {
  return result.ok ? result.diagnostics : result.errors;
}

function expectLocalizationContract(diagnostics: readonly Diagnostic[]): void {
  expect(diagnostics.length).toBeGreaterThan(0);
  for (const diagnostic of diagnostics) {
    expect(diagnostic.messageKey).toBe(`diagnostic.${diagnostic.code}.message`);
    expect(diagnostic.messageParams).toEqual({});
    expect(diagnostic.message.length).toBeGreaterThan(0);
  }
}

describe('diagnostic localization contract', () => {
  it('defines a stable message key for every diagnostic code, including W007', () => {
    expect(Object.keys(DIAGNOSTIC_MESSAGE_KEYS).sort()).toEqual([...ALL_CODES].sort());
    for (const code of ALL_CODES) {
      expect(createDiagnosticLocalization(code)).toEqual({
        messageKey: `diagnostic.${code}.message`,
        messageParams: {},
      });
    }
  });

  it('attaches the contract to parser diagnostics without replacing fallback text', () => {
    const frontmatter = parseFrontmatter(
      '---\ntitle: [invalid yaml\nvars:\n  hp: int\n---\n',
    );
    expectLocalizationContract(diagnosticsOf(frontmatter));

    const condition = parseCondition('$missing == 1', [], 7);
    expectLocalizationContract(diagnosticsOf(condition));

    const effects = parseEffects('$missing+1', [], 8);
    expectLocalizationContract(diagnosticsOf(effects));

    const story = parseStory([
      '# Chapter',
      '',
      '## \u8282\u70b9\uff1aEmpty',
      '',
    ].join('\n'));
    expect(story.ok).toBe(true);
    if (story.ok) expectLocalizationContract(story.diagnostics);
  });

  it('attaches the contract to validator W007 diagnostics', () => {
    const parsed = parseStory([
      '# Chapter',
      '',
      '## \u8282\u70b9\uff1aA',
      '',
      '\u4e0b\u4e00\u6b65: \u8282\u70b9\uff1aB',
      '',
      '## \u8282\u70b9\uff1aB',
      '',
      '\u4e0b\u4e00\u6b65: \u8282\u70b9\uff1aA',
      '',
    ].join('\n'));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const w007 = validate(parsed.data).diagnostics.filter(({ code }) => code === 'W007');
    expectLocalizationContract(w007);
    expect(w007[0]?.severity).toBe('warning');
  });
});
