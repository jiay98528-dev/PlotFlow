import { describe, expect, it } from 'vitest';
import type { VariableDeclaration } from '@plotflow/core';
import { effectOperations, validEffectValue, variableLeaves } from './variableEditorModel';

const declaration = (type: VariableDeclaration['type']): VariableDeclaration => ({ name: 'value', type, defaultValue: 0, lineNumber: 1 });

describe('writer-facing variable changes', () => {
  it('offers only operations accepted by each variable type', () => {
    expect(effectOperations(declaration('bool'))).toEqual(['set']);
    expect(effectOperations(declaration('enum'))).toEqual(['set']);
    expect(effectOperations(declaration('string'))).toEqual(['set', 'append']);
    expect(effectOperations(declaration('int'))).toEqual(['set', 'add', 'subtract']);
  });
  it('keeps partial and invalid numeric drafts out of story text', () => {
    for (const value of ['', '-', '+', '1.', '1x', '1.5', 'Infinity']) expect(validEffectValue(declaration('int'), value)).toBe(false);
    expect(validEffectValue(declaration('int'), '-10')).toBe(true);
    expect(validEffectValue(declaration('float'), '-.5')).toBe(true);
    expect(validEffectValue(declaration('float'), '1.')).toBe(false);
  });
  it('returns nested leaf paths without assigning an entire object', () => {
    const leaves = variableLeaves([{ ...declaration('object'), name: '角色', fields: [{ ...declaration('object'), name: '状态', fields: [{ ...declaration('bool'), name: '中毒' }] }] }]);
    expect(leaves.map((item) => [item.name, item.type])).toEqual([['角色.状态.中毒', 'bool']]);
  });
});
