import type {
  ComparisonExpression,
  ComparisonOperator,
  ConditionNode,
  LogicalOperator,
  Operand,
  VariableDeclaration,
  VariableType,
} from '@plotflow/core';

export interface ConditionRow {
  readonly id: string;
  leftOperandType: 'literal' | 'variable';
  leftLiteralType: 'string' | 'number' | 'boolean';
  variableName: string;
  operator: ComparisonOperator;
  rightOperandType: 'literal' | 'variable';
  rightLiteralType: 'string' | 'number' | 'boolean';
  value: string;
}

export interface ConditionGroup {
  readonly id: string;
  operator: LogicalOperator;
  rows: ConditionRow[];
  groups: ConditionGroup[];
}

export const MAX_NESTING_DEPTH = 3;

let idCounter = 0;
export function createConditionId(): string {
  idCounter += 1;
  return `cond-${Date.now().toString(36)}-${idCounter}`;
}

function findVariableType(
  name: string,
  variables: readonly VariableDeclaration[],
): VariableType | null {
  if (!name) return null;
  const segments = name.split('.');
  let current = variables.find((variable) => variable.name === segments[0]);
  for (const segment of segments.slice(1)) {
    current = current?.fields?.find((field) => field.name === segment);
  }
  return current?.type ?? null;
}

function parseOperandDraft(
  operandType: 'literal' | 'variable',
  raw: string,
  literalType: 'string' | 'number' | 'boolean',
  contextualType: VariableType | null,
): Operand {
  if (operandType === 'variable') {
    return { operandType: 'variable', variableName: raw };
  }
  if (contextualType === 'bool' || literalType === 'boolean') {
    return { operandType: 'literal', literalValue: raw === 'true' };
  }
  if (contextualType === 'int') {
    const value = Number.parseInt(raw, 10);
    return { operandType: 'literal', literalValue: Number.isNaN(value) ? 0 : value };
  }
  if (contextualType === 'float' || literalType === 'number') {
    const value = Number.parseFloat(raw);
    return { operandType: 'literal', literalValue: Number.isNaN(value) ? 0 : value };
  }
  return { operandType: 'literal', literalValue: raw };
}

function rowToComparison(
  row: ConditionRow,
  variables: readonly VariableDeclaration[],
): ComparisonExpression {
  const leftVariableType =
    row.leftOperandType === 'variable' ? findVariableType(row.variableName, variables) : null;
  const rightVariableType =
    row.rightOperandType === 'variable' ? findVariableType(row.value, variables) : null;
  return {
    type: 'comparison',
    left: parseOperandDraft(
      row.leftOperandType,
      row.variableName,
      row.leftLiteralType,
      rightVariableType,
    ),
    operator: row.operator,
    right: parseOperandDraft(
      row.rightOperandType,
      row.value,
      row.rightLiteralType,
      leftVariableType,
    ),
  };
}

export function builderToConditionNode(
  group: ConditionGroup,
  variables: readonly VariableDeclaration[],
): ConditionNode | null {
  const nodes: ConditionNode[] = [];
  for (const row of group.rows) {
    if (row.variableName.length > 0 && row.value.length > 0) {
      nodes.push(rowToComparison(row, variables));
    }
  }
  for (const child of group.groups) {
    const childNode = builderToConditionNode(child, variables);
    if (childNode) nodes.push(childNode);
  }
  if (nodes.length === 0) return null;
  if (group.operator === 'NOT') {
    const operand =
      nodes.length === 1
        ? nodes[0]!
        : { type: 'logical' as const, operator: 'AND' as const, operands: nodes };
    return { type: 'logical', operator: 'NOT', operands: [operand] };
  }
  if (nodes.length === 1) return nodes[0]!;
  return { type: 'logical', operator: group.operator, operands: nodes };
}

function operandToDraft(operand: Operand): {
  readonly value: string;
  readonly literalType: 'string' | 'number' | 'boolean';
} {
  if (operand.operandType === 'variable') {
    return { value: operand.variableName ?? '', literalType: 'string' };
  }
  if (typeof operand.literalValue === 'boolean') {
    return { value: operand.literalValue ? 'true' : 'false', literalType: 'boolean' };
  }
  if (typeof operand.literalValue === 'number') {
    return { value: String(operand.literalValue), literalType: 'number' };
  }
  return {
    value: operand.literalValue != null ? String(operand.literalValue) : '',
    literalType: 'string',
  };
}

function comparisonToRow(node: ComparisonExpression): ConditionRow {
  const left = operandToDraft(node.left);
  const right = operandToDraft(node.right);
  return {
    id: createConditionId(),
    leftOperandType: node.left.operandType,
    leftLiteralType: left.literalType,
    variableName: left.value,
    operator: node.operator,
    rightOperandType: node.right.operandType,
    rightLiteralType: right.literalType,
    value: right.value,
  };
}

export function createEmptyConditionRow(): ConditionRow {
  return {
    id: createConditionId(),
    leftOperandType: 'variable',
    leftLiteralType: 'string',
    variableName: '',
    operator: '==',
    rightOperandType: 'literal',
    rightLiteralType: 'string',
    value: '',
  };
}

export function createEmptyConditionGroup(): ConditionGroup {
  return {
    id: createConditionId(),
    operator: 'AND',
    rows: [createEmptyConditionRow()],
    groups: [],
  };
}

export function conditionNodeToBuilder(node: ConditionNode, depth = 0): ConditionGroup {
  const group: ConditionGroup = {
    id: createConditionId(),
    operator: 'AND',
    rows: [],
    groups: [],
  };
  if (node.type === 'comparison') {
    group.rows.push(comparisonToRow(node));
    return group;
  }

  group.operator = node.operator;
  for (const operand of node.operands) {
    if (operand.type === 'comparison') {
      group.rows.push(comparisonToRow(operand));
    } else {
      group.groups.push(conditionNodeToBuilder(operand, depth + 1));
    }
  }
  return group;
}

function serializeLiteral(value: Operand['literalValue']): string {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `'${JSON.stringify(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")}'`;
}

function serializeOperand(operand: Operand): string {
  return operand.operandType === 'variable'
    ? `$${operand.variableName ?? ''}`
    : serializeLiteral(operand.literalValue);
}

export function serializeConditionExpression(node: ConditionNode | null): string {
  if (!node) return '';
  if (node.type === 'comparison') {
    return `${serializeOperand(node.left)} ${node.operator} ${serializeOperand(node.right)}`;
  }
  if (node.operator === 'NOT') {
    const operand = node.operands[0];
    return operand ? `NOT (${serializeConditionExpression(operand)})` : '';
  }
  return node.operands
    .map((operand) => `(${serializeConditionExpression(operand)})`)
    .join(` ${node.operator} `);
}
