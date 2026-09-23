import type { VariableDeclaration } from '@plotflow/core';

/** Object declarations are containers; only leaves can receive a story change. */
export function variableLeaves(variables: readonly VariableDeclaration[], prefix = ''): VariableDeclaration[] {
  return variables.flatMap((variable) => {
    const name = prefix ? `${prefix}.${variable.name}` : variable.name;
    return variable.type === 'object'
      ? variableLeaves(variable.fields ?? [], name)
      : [{ ...variable, name }];
  });
}

export type EffectOperation = 'set' | 'add' | 'subtract' | 'append';

export function effectOperations(variable?: VariableDeclaration): readonly EffectOperation[] {
  if (variable?.type === 'int' || variable?.type === 'float') return ['set', 'add', 'subtract'];
  if (variable?.type === 'string') return ['set', 'append'];
  return ['set'];
}

export function validEffectValue(variable: VariableDeclaration | undefined, value: string): boolean {
  if (!variable) return false;
  if (variable.type === 'int') return /^[+-]?\d+$/u.test(value.trim()) && Number.isSafeInteger(Number(value));
  if (variable.type === 'float') return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/u.test(value.trim()) && Number.isFinite(Number(value));
  if (variable.type === 'bool') return value === 'true' || value === 'false';
  if (variable.type === 'enum') return variable.enumValues?.includes(value) ?? false;
  return variable.type === 'string';
}
