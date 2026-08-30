import { describe, expect, it } from 'vitest';
import type { Option, VariableDeclaration } from '@plotflow/core';
import { createOptionDraftIdentity, parseEffectsForEditor } from './GraphInspector';

const variables: readonly VariableDeclaration[] = [
  {
    name: '日志',
    type: 'string',
    defaultValue: '',
    scope: 'global',
    lineNumber: 1,
  },
  {
    name: '金币',
    type: 'int',
    defaultValue: 0,
    scope: 'global',
    lineNumber: 2,
  },
];

describe('GraphInspector effects parser', () => {
  it('preserves commas and escapes inside quoted string values', () => {
    expect(parseEffectsForEditor('日志="hello, \\"world\\"", 金币+2', variables)).toEqual([
      { variableName: '日志', operation: 'set', value: 'hello, "world"' },
      { variableName: '金币', operation: 'add', value: '2' },
    ]);
  });
});

function option(description: string, lineNumber: number): Option {
  return {
    description,
    targetNodeId: null,
    targetChapterId: null,
    targetFullId: null,
    condition: null,
    conditionRaw: null,
    effectsRaw: null,
    sideEffects: [],
    lineNumber,
    indentLevel: 0,
  };
}

describe('GraphInspector option draft identity', () => {
  it('survives line shifts and unrelated option insertion', () => {
    const before = [option('A', 10), option('B', 11)];
    const after = [option('new', 10), option('A', 11), option('B', 12)];

    expect(createOptionDraftIdentity('chapter/node', before, 1))
      .toBe(createOptionDraftIdentity('chapter/node', after, 2));
  });

  it('keeps duplicate occurrences distinct', () => {
    const options = [option('same', 10), option('same', 11)];
    expect(createOptionDraftIdentity('chapter/node', options, 0))
      .not.toBe(createOptionDraftIdentity('chapter/node', options, 1));
  });
});
