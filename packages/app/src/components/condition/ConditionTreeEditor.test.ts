import { describe, expect, it } from 'vitest';
import { parseCondition, type ConditionNode, type VariableDeclaration } from '@plotflow/core';
import {
  builderToConditionNode,
  conditionNodeToBuilder,
  serializeConditionExpression,
} from './ConditionTreeEditor';

const variables: VariableDeclaration[] = [
  {
    name: '金币',
    type: 'int',
    defaultValue: 0,
    lineNumber: 1,
  },
  {
    name: '存活',
    type: 'bool',
    defaultValue: true,
    lineNumber: 2,
  },
  {
    name: '职业',
    type: 'enum',
    defaultValue: '战士',
    enumValues: ['战士', '法师'],
    lineNumber: 3,
  },
];

const nestedCondition: ConditionNode = {
  type: 'logical',
  operator: 'AND',
  operands: [
    {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '金币' },
      operator: '>=',
      right: { operandType: 'literal', literalValue: 10 },
    },
    {
      type: 'logical',
      operator: 'NOT',
      operands: [
        {
          type: 'logical',
          operator: 'OR',
          operands: [
            {
              type: 'comparison',
              left: { operandType: 'variable', variableName: '存活' },
              operator: '==',
              right: { operandType: 'literal', literalValue: false },
            },
            {
              type: 'comparison',
              left: { operandType: 'variable', variableName: '职业' },
              operator: '==',
              right: { operandType: 'literal', literalValue: '法师' },
            },
          ],
        },
      ],
    },
  ],
};

describe('ConditionTreeEditor transforms', () => {
  it('round-trips AND/OR/NOT trees without flattening NOT', () => {
    const builder = conditionNodeToBuilder(nestedCondition);
    expect(builderToConditionNode(builder, variables)).toEqual(nestedCondition);
  });

  it('preserves a variable as the right operand', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '金币' },
      operator: '>=',
      right: { operandType: 'variable', variableName: '金币' },
    };

    const builder = conditionNodeToBuilder(condition);
    expect(builder.rows[0]?.rightOperandType).toBe('variable');
    expect(builderToConditionNode(builder, variables)).toEqual(condition);
  });

  it('round-trips a literal on the left without changing operand order', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'literal', literalValue: 5 },
      operator: '<',
      right: { operandType: 'variable', variableName: '金币' },
    };

    const builder = conditionNodeToBuilder(condition);
    expect(builder.rows[0]?.leftOperandType).toBe('literal');
    expect(builder.rows[0]?.rightOperandType).toBe('variable');
    expect(builderToConditionNode(builder, variables)).toEqual(condition);
    expect(serializeConditionExpression(condition)).toBe('5 < $金币');
  });

  it('serializes strings, variables and NOT with reversible precedence', () => {
    const expression = serializeConditionExpression(nestedCondition);
    expect(expression).toBe(
      "($金币 >= 10) AND (NOT (($存活 == false) OR ($职业 == '法师')))",
    );
    const parsed = parseCondition(expression, variables);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data).toEqual(nestedCondition);
    }
  });

  it('escapes string literals for .mdstory', () => {
    const condition: ConditionNode = {
      type: 'comparison',
      left: { operandType: 'variable', variableName: '职业' },
      operator: '==',
      right: { operandType: 'literal', literalValue: "游侠's" },
    };

    expect(serializeConditionExpression(condition)).toBe("$职业 == '游侠\\'s'");
  });
});
