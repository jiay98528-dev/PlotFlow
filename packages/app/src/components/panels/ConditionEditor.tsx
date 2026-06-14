/**
 * ConditionEditor — 图形化条件编辑器面板 (M3-01 至 M3-08)
 *
 * @remarks
 * Airtable 风格的条件构建器，支持变量选择、比较运算符、类型感知值输入、
 * AND/OR 逻辑组嵌套（最多 3 层）、实时表达式预览和双向文本同步。
 *
 * 触发入口：选项行右侧 [🔧条件] 图标按钮。
 *
 * 设计依据：
 * - spec/design-brief-editor-ux.md §6.4 条件编辑器状态
 * - TAD.md §2.5 条件编辑器组件结构
 * - CLAUDE.md §6.1 使用 CSS 变量驱动颜色
 *
 * @module components/panels/ConditionEditor
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useStoryStore, useEditorStore, useUIStore } from '../../stores';
import type {
  ConditionNode,
  ComparisonExpression,
  Operand,
  VariableDeclaration,
  VariableType,
  ComparisonOperator,
  LogicalOperator,
} from '@plotflow/core';

// ============================================================================
// 内部 Builder 状态类型
// ============================================================================

/** 单条条件行 */
interface ConditionRow {
  readonly id: string;
  variableName: string;
  operator: ComparisonOperator;
  value: string;
}

/** 条件组（可嵌套） */
interface ConditionGroup {
  readonly id: string;
  operator: 'AND' | 'OR';
  rows: ConditionRow[];
  groups: ConditionGroup[];
}

// ============================================================================
// Props
// ============================================================================

export interface ConditionEditorProps {
  /** 所属节点 ID */
  readonly nodeId?: string;
  /** 当前编辑的选项索引 */
  readonly optionIndex?: number;
  /** 关闭面板回调 */
  readonly onClose: () => void;
  /** 初始条件 AST（从解析器获取，用于初始化面板） */
  readonly initialCondition?: ConditionNode | null;
}

// ============================================================================
// 常量
// ============================================================================

/** 变量类型 → 图标映射 */
const VARIABLE_TYPE_ICONS: Readonly<Record<VariableType, string>> = {
  int: '#',
  float: '0.0',
  bool: '✓',
  string: '“',
  enum: '[]',
  object: '{}',
};

/** 变量类型 → 中文标签 */
const VARIABLE_TYPE_LABELS: Readonly<Record<VariableType, string>> = {
  int: '整数',
  float: '浮点',
  bool: '布尔',
  string: '字符串',
  enum: '枚举',
  object: '对象',
};

/** 比较运算符 → 中文标签 */
const OPERATOR_LABELS: Readonly<Record<ComparisonOperator, string>> = {
  '==': '＝',
  '!=': '≠',
  '>': '＞',
  '<': '＜',
  '>=': '≥',
  '<=': '≤',
};

/** 逻辑运算符颜色映射 */
const LOGIC_GROUP_COLORS: Readonly<Record<'AND' | 'OR', string>> = {
  AND: 'var(--color-syntax-heading, #1A6FB5)',
  OR: 'var(--color-syntax-condition, #C5662A)',
};

/** 最大嵌套深度（不含根组） */
const MAX_NESTING_DEPTH = 3;

/** 计数器用于生成唯一 ID */
let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `cond-${Date.now().toString(36)}-${_idCounter}`;
}

// ============================================================================
// 辅助函数：运算符过滤
// ============================================================================

/**
 * 根据变量类型获取可用的比较运算符。
 *
 * - int/float: == != > < >= <=
 * - bool/string/enum: == !=
 * - object: 不可比较（返回空数组）
 */
function getOperatorsForType(type: VariableType | null): ComparisonOperator[] {
  if (!type) return ['==', '!=', '>', '<', '>=', '<='];
  switch (type) {
    case 'int':
    case 'float':
      return ['==', '!=', '>', '<', '>=', '<='];
    case 'bool':
    case 'string':
    case 'enum':
      return ['==', '!='];
    case 'object':
      return [];
    default:
      return ['==', '!='];
  }
}

/**
 * 在变量列表中按名称查找变量的类型。
 */
function findVariableType(
  name: string,
  variables: readonly VariableDeclaration[],
): VariableType | null {
  if (!name) return null;
  const found = variables.find((v) => v.name === name);
  return found?.type ?? null;
}

// ============================================================================
// 辅助函数：ConditionNode ↔ Builder 状态 互转
// ============================================================================

/**
 * 将 ConditionRow 转换为 Operand。
 */
function rowToOperand(row: ConditionRow): Operand {
  return {
    operandType: 'variable',
    variableName: row.variableName,
  };
}

/**
 * 将 ConditionRow 的字面值解析为 Operation 的右操作数。
 */
function parseRowValue(row: ConditionRow, varType: VariableType | null): Operand {
  const raw = row.value;
  if (varType === 'bool') {
    return { operandType: 'literal', literalValue: raw === 'true' };
  }
  if (varType === 'int') {
    const n = parseInt(raw, 10);
    return { operandType: 'literal', literalValue: Number.isNaN(n) ? 0 : n };
  }
  if (varType === 'float') {
    const n = parseFloat(raw);
    return { operandType: 'literal', literalValue: Number.isNaN(n) ? 0.0 : n };
  }
  // string / enum / unknown → 字符串字面量
  return { operandType: 'literal', literalValue: raw };
}

/**
 * 将单行条件转换为 ComparisonExpression。
 */
function rowToComparison(
  row: ConditionRow,
  variables: readonly VariableDeclaration[],
): ComparisonExpression {
  const varType = findVariableType(row.variableName, variables);
  return {
    type: 'comparison',
    left: rowToOperand(row),
    operator: row.operator,
    right: parseRowValue(row, varType),
  };
}

/**
 * 将 Builder ConditionGroup 转换为 ConditionNode AST。
 *
 * 导出供外部使用（branch graph edge update、test 等）。
 */
export function builderToConditionNode(
  group: ConditionGroup,
  variables: readonly VariableDeclaration[],
): ConditionNode | null {
  const allNodes: ConditionNode[] = [];

  // 每一行是一个比较表达式
  for (const row of group.rows) {
    if (row.variableName && row.value) {
      allNodes.push(rowToComparison(row, variables));
    }
  }

  // 每个子组递归转换
  for (const subGroup of group.groups) {
    const subNode = builderToConditionNode(subGroup, variables);
    if (subNode) {
      allNodes.push(subNode);
    }
  }

  if (allNodes.length === 0) return null;
  if (allNodes.length === 1) return allNodes[0]!;

  return {
    type: 'logical',
    operator: group.operator as LogicalOperator,
    operands: allNodes,
  };
}

/**
 * 将 ConditionNode AST 转换为 Builder ConditionGroup。
 * 深度限制：最多递归 MAX_NESTING_DEPTH 层。
 */
function conditionNodeToBuilder(
  node: ConditionNode,
  depth: number = 0,
): ConditionGroup {
  const group: ConditionGroup = {
    id: nextId(),
    operator: 'AND',
    rows: [],
    groups: [],
  };

  if (node.type === 'comparison') {
    const row = comparisonToRow(node);
    if (row) {
      group.rows.push(row);
    }
    return group;
  }

  if (node.type === 'logical') {
    const logicalNode = node;

    // NOT 运算符：将操作数作为单个条件处理
    if (logicalNode.operator === 'NOT') {
      group.operator = 'AND';
      for (const operand of logicalNode.operands) {
        if (operand.type === 'comparison') {
          const row = comparisonToRow(operand);
          if (row) {
            // 对 NOT 的简单处理：翻转运算符
            row.operator = negateOperator(row.operator);
            group.rows.push(row);
          }
        } else {
          // 嵌套的逻辑表达式在 NOT 中，递归处理
          const subGroup = conditionNodeToBuilder(operand, depth);
          mergeGroup(group, subGroup);
        }
      }
      return group;
    }

    // AND / OR
    group.operator = logicalNode.operator;

    for (const operand of logicalNode.operands) {
      if (operand.type === 'comparison') {
        const row = comparisonToRow(operand);
        if (row) {
          group.rows.push(row);
        }
      } else if (depth < MAX_NESTING_DEPTH) {
        const subGroup = conditionNodeToBuilder(operand, depth + 1);
        group.groups.push(subGroup);
      } else {
        // 深度超限，摊平为行
        const flattened = flattenNodeToRows(operand);
        group.rows.push(...flattened);
      }
    }
  }

  return group;
}

/**
 * 将 ComparisonExpression 转换为 ConditionRow。
 */
function comparisonToRow(node: ComparisonExpression): ConditionRow | null {
  if (node.left.operandType !== 'variable' || !node.left.variableName) {
    return null;
  }

  let valueStr: string;
  if (node.right.operandType === 'literal') {
    const val = node.right.literalValue;
    if (typeof val === 'boolean') {
      valueStr = val ? 'true' : 'false';
    } else if (typeof val === 'number') {
      valueStr = String(val);
    } else {
      valueStr = val != null ? String(val) : '';
    }
  } else {
    valueStr = '';
  }

  return {
    id: nextId(),
    variableName: node.left.variableName,
    operator: node.operator,
    value: valueStr,
  };
}

/**
 * 翻转比较运算符（用于 NOT 展开）。
 */
function negateOperator(op: ComparisonOperator): ComparisonOperator {
  switch (op) {
    case '==': return '!=';
    case '!=': return '==';
    case '>': return '<=';
    case '<': return '>=';
    case '>=': return '<';
    case '<=': return '>';
    default: return '!=';
  }
}

/**
 * 将 AST 节点摊平为条件行列表（深度超限时用）。
 */
function flattenNodeToRows(node: ConditionNode): ConditionRow[] {
  if (node.type === 'comparison') {
    const row = comparisonToRow(node);
    return row ? [row] : [];
  }
  const rows: ConditionRow[] = [];
  for (const operand of node.operands) {
    rows.push(...flattenNodeToRows(operand));
  }
  return rows;
}

/**
 * 将 source group 的内容合并到 target group。
 */
function mergeGroup(target: ConditionGroup, source: ConditionGroup): void {
  target.rows.push(...source.rows);
  target.groups.push(...source.groups);
}

// ============================================================================
// 辅助函数：表达式预览字符串生成
// ============================================================================

/**
 * 将 ConditionRow 转换为表达式片段字符串。
 */
function rowToExpression(row: ConditionRow): string {
  const varPart = row.variableName ? `$${row.variableName}` : '?';
  const opPart = row.operator || '?';
  const valPart = row.value || '?';
  return `${varPart}${opPart}${valPart}`;
}

/**
 * 递归生成条件组的表达式预览文本。
 * 示例: ($技能>=5) AND ($道具==true)
 */
function builderToExpression(group: ConditionGroup): string {
  const parts: string[] = [];

  for (const row of group.rows) {
    if (row.variableName && row.operator) {
      parts.push(`(${rowToExpression(row)})`);
    }
  }

  for (const subGroup of group.groups) {
    const subExpr = builderToExpression(subGroup);
    if (subExpr) {
      parts.push(`(${subExpr})`);
    }
  }

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  return parts.join(` ${group.operator} `);
}

// ============================================================================
// 辅助函数：编辑器文本同步
// ============================================================================

/**
 * 在编辑器文本中查找选项行的索引（0-based）。
 */
function findOptionLineIndex(
  lines: string[],
  nodeTitle: string,
  optionDescription: string,
): number {
  let inTargetNode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // 检测节点标题
    if (new RegExp(`^##\\s+节点：\\s*${escapeRegex(nodeTitle)}\\s*$`).test(line)) {
      inTargetNode = true;
      continue;
    }

    // 离开节点
    if (inTargetNode && /^##\s+节点：/.test(line)) {
      inTargetNode = false;
      continue;
    }

    // 在目标节点内查找选项行
    if (inTargetNode && line.includes(`[选项]`) && line.includes(optionDescription)) {
      return i;
    }
  }

  return -1;
}

/**
 * 在编辑器文本中查找条件子行的索引（从 optionLineIndex 之后开始扫描）。
 * 返回 -1 表示不存在。
 */
function findConditionSubLineIndex(
  lines: string[],
  optionLineIndex: number,
): number {
  for (let i = optionLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]!;

    // 遇到下一个 [选项] 或节点标题则停止
    if (/^\[选项\]/.test(line) || /^##\s+节点：/.test(line) || /^#\s+/.test(line)) {
      break;
    }

    if (/^\s+条件:/.test(line)) {
      return i;
    }
  }
  return -1;
}

/**
 * 更新编辑器文本中的条件子行。
 */
function updateEditorConditionText(
  content: string,
  nodeTitle: string,
  optionDescription: string,
  newExpression: string,
): string {
  const lines = content.split('\n');
  const optionLineIdx = findOptionLineIndex(lines, nodeTitle, optionDescription);

  if (optionLineIdx === -1) return content;

  const condLineIdx = findConditionSubLineIndex(lines, optionLineIdx);

  if (newExpression) {
    const newLine = `  条件: ${newExpression}`;
    if (condLineIdx !== -1) {
      // 替换现有条件行
      lines[condLineIdx] = newLine;
    } else {
      // 在选项行之后插入
      lines.splice(optionLineIdx + 1, 0, newLine);
    }
  } else {
    // 空表达式 → 删除条件行
    if (condLineIdx !== -1) {
      lines.splice(condLineIdx, 1);
    }
  }

  return lines.join('\n');
}

/**
 * 转义正则表达式特殊字符。
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================================================
// 子组件：变量下拉框 (M3-02)
// ============================================================================

interface VariableDropdownProps {
  readonly variables: readonly VariableDeclaration[];
  readonly selectedName: string;
  readonly onSelect: (name: string) => void;
}

function VariableDropdown({
  variables,
  selectedName,
  onSelect,
}: VariableDropdownProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchText('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!searchText) return variables;
    const lower = searchText.toLowerCase();
    return variables.filter(
      (v) =>
        v.name.toLowerCase().includes(lower) ||
        VARIABLE_TYPE_LABELS[v.type].includes(searchText),
    );
  }, [variables, searchText]);

  const selectedVar = variables.find((v) => v.name === selectedName);
  const selectedIcon = selectedVar ? VARIABLE_TYPE_ICONS[selectedVar.type] : '';

  return (
    <div ref={dropdownRef} style={dropdownContainerStyle}>
      <button
        type="button"
        style={dropdownButtonStyle}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
      >
        {selectedVar ? (
          <>
            <span style={typeIconStyle}>{selectedIcon}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedName}
            </span>
            <span style={typeLabelStyle}>
              {VARIABLE_TYPE_LABELS[selectedVar.type]}
            </span>
          </>
        ) : (
          <span style={placeholderStyle}>选择变量...</span>
        )}
        <span style={chevronStyle}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={dropdownMenuStyle}>
          {/* 搜索框 */}
          <div style={searchContainerStyle}>
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="搜索变量..."
              style={searchInputStyle}
            />
          </div>

          {/* 变量列表 */}
          <div style={dropdownListStyle}>
            {filtered.length === 0 ? (
              <div style={emptyOptionStyle}>无匹配变量</div>
            ) : (
              filtered.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  style={{
                    ...dropdownItemStyle,
                    ...(v.name === selectedName ? dropdownItemActiveStyle : {}),
                  }}
                  onClick={() => {
                    onSelect(v.name);
                    setIsOpen(false);
                    setSearchText('');
                  }}
                >
                  <span style={typeIconStyle}>{VARIABLE_TYPE_ICONS[v.type]}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {v.name}
                  </span>
                  <span style={typeLabelStyle}>{VARIABLE_TYPE_LABELS[v.type]}</span>
                </button>
              ))
            )}
          </div>

          {/* 提示：无变量时 */}
          {variables.length === 0 && (
            <div style={noVarsHintStyle}>
              请先在 Frontmatter 中声明变量
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 子组件：运算符下拉框 (M3-03)
// ============================================================================

interface OperatorDropdownProps {
  readonly operators: readonly ComparisonOperator[];
  readonly selected: ComparisonOperator;
  readonly onSelect: (op: ComparisonOperator) => void;
}

function OperatorDropdown({
  operators,
  selected,
  onSelect,
}: OperatorDropdownProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  if (operators.length === 0) {
    return (
      <div style={{ ...dropdownButtonStyle, color: 'var(--color-text-muted, #8A8A8A)', cursor: 'not-allowed' }}>
        不可比较
      </div>
    );
  }

  return (
    <div ref={dropdownRef} style={{ ...dropdownContainerStyle, minWidth: 56 }}>
      <button
        type="button"
        style={dropdownButtonStyle}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ fontWeight: 600 }}>
          {OPERATOR_LABELS[selected] || selected}
        </span>
        <span style={chevronStyle}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div style={dropdownMenuStyle}>
          {operators.map((op) => (
            <button
              key={op}
              type="button"
              style={{
                ...dropdownItemStyle,
                ...(op === selected ? dropdownItemActiveStyle : {}),
              }}
              onClick={() => {
                onSelect(op);
                setIsOpen(false);
              }}
            >
              <span style={{ fontWeight: 600 }}>{OPERATOR_LABELS[op]}</span>
              <span style={{ marginLeft: 8, fontSize: '10px', color: 'var(--color-text-muted, #8A8A8A)' }}>
                {op}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 子组件：值输入框 (M3-04)
// ============================================================================

interface ValueInputProps {
  readonly variableType: VariableType | null;
  readonly enumValues: readonly string[] | undefined;
  readonly value: string;
  readonly onChange: (value: string) => void;
}

function ValueInput({
  variableType,
  enumValues,
  value,
  onChange,
}: ValueInputProps): React.ReactElement {
  // bool → true/false 下拉
  if (variableType === 'bool') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">--</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  // enum → 枚举值下拉
  if (variableType === 'enum' && enumValues && enumValues.length > 0) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
      >
        <option value="">--</option>
        {enumValues.map((ev) => (
          <option key={ev} value={ev}>
            {ev}
          </option>
        ))}
      </select>
    );
  }

  // int → 数字输入
  if (variableType === 'int') {
    return (
      <input
        type="number"
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        style={numberInputStyle}
      />
    );
  }

  // float → 数字输入 (step=0.1)
  if (variableType === 'float') {
    return (
      <input
        type="number"
        step={0.1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.0"
        style={numberInputStyle}
      />
    );
  }

  // object → 不可编辑
  if (variableType === 'object') {
    return (
      <div style={{ ...disabledInputStyle }}>不可比较</div>
    );
  }

  // string / 未知 → 文本输入
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="值..."
      style={textInputStyle}
    />
  );
}

// ============================================================================
// 子组件：单条条件行
// ============================================================================

interface ConditionRowViewProps {
  readonly row: ConditionRow;
  readonly variables: readonly VariableDeclaration[];
  readonly onUpdate: (row: ConditionRow) => void;
  readonly onRemove: () => void;
  readonly canRemove: boolean;
}

function ConditionRowView({
  row,
  variables,
  onUpdate,
  onRemove,
  canRemove,
}: ConditionRowViewProps): React.ReactElement {
  const variableType = findVariableType(row.variableName, variables);
  const availableOps = useMemo(
    () => getOperatorsForType(variableType),
    [variableType],
  );

  // 如果变量类型变了且当前运算符不可用，自动切换到第一个可用运算符
  const effectiveOp = useMemo(() => {
    if (availableOps.length > 0 && !availableOps.includes(row.operator)) {
      return availableOps[0]!;
    }
    if (availableOps.length === 0 && row.operator) {
      return '==' as ComparisonOperator; // fallback
    }
    return row.operator;
  }, [availableOps, row.operator]);

  // 同步运算符变化
  useEffect(() => {
    if (effectiveOp !== row.operator) {
      onUpdate({ ...row, operator: effectiveOp });
    }
  }, [effectiveOp, row.operator, row, onUpdate]);

  const selectedVar = variables.find((v) => v.name === row.variableName);
  const enumValues = selectedVar?.enumValues;

  return (
    <div style={conditionRowStyle}>
      {/* 拖拽把手（装饰） */}
      <span style={dragHandleStyle}>&#x2630;</span>

      {/* 变量下拉 */}
      <VariableDropdown
        variables={variables}
        selectedName={row.variableName}
        onSelect={(name) => onUpdate({ ...row, variableName: name, value: '' })}
      />

      {/* 运算符下拉 */}
      <OperatorDropdown
        operators={availableOps}
        selected={effectiveOp}
        onSelect={(op) => onUpdate({ ...row, operator: op })}
      />

      {/* 值输入 */}
      <div style={{ flex: 1, minWidth: 80 }}>
        <ValueInput
          variableType={variableType}
          enumValues={enumValues}
          value={row.value}
          onChange={(val) => onUpdate({ ...row, value: val })}
        />
      </div>

      {/* 删除按钮 */}
      {canRemove && (
        <button
          type="button"
          style={removeRowButtonStyle}
          onClick={onRemove}
          title="删除条件"
        >
          &#x2715;
        </button>
      )}
    </div>
  );
}

// ============================================================================
// 子组件：条件组
// ============================================================================

interface ConditionGroupViewProps {
  readonly group: ConditionGroup;
  readonly variables: readonly VariableDeclaration[];
  readonly depth: number;
  readonly onUpdate: (group: ConditionGroup) => void;
  readonly onRemove?: () => void;
}

function ConditionGroupView({
  group,
  variables,
  depth,
  onUpdate,
  onRemove,
}: ConditionGroupViewProps): React.ReactElement {
  const borderColor = LOGIC_GROUP_COLORS[group.operator];

  const handleRowUpdate = useCallback(
    (index: number, updated: ConditionRow) => {
      const newRows = [...group.rows];
      newRows[index] = updated;
      onUpdate({ ...group, rows: newRows });
    },
    [group, onUpdate],
  );

  const handleRowRemove = useCallback(
    (index: number) => {
      const newRows = group.rows.filter((_, i) => i !== index);
      onUpdate({ ...group, rows: newRows });
    },
    [group, onUpdate],
  );

  const handleAddRow = useCallback(() => {
    const newRow: ConditionRow = {
      id: nextId(),
      variableName: '',
      operator: '==',
      value: '',
    };
    onUpdate({ ...group, rows: [...group.rows, newRow] });
  }, [group, onUpdate]);

  const handleSubGroupUpdate = useCallback(
    (index: number, updated: ConditionGroup) => {
      const newGroups = [...group.groups];
      newGroups[index] = updated;
      onUpdate({ ...group, groups: newGroups });
    },
    [group, onUpdate],
  );

  const handleSubGroupRemove = useCallback(
    (index: number) => {
      const newGroups = group.groups.filter((_, i) => i !== index);
      onUpdate({ ...group, groups: newGroups });
    },
    [group, onUpdate],
  );

  const handleAddAndGroup = useCallback(() => {
    if (depth >= MAX_NESTING_DEPTH) return;
    const newGroup: ConditionGroup = {
      id: nextId(),
      operator: 'AND',
      rows: [{ id: nextId(), variableName: '', operator: '==', value: '' }],
      groups: [],
    };
    onUpdate({ ...group, groups: [...group.groups, newGroup] });
  }, [group, onUpdate, depth]);

  const handleAddOrGroup = useCallback(() => {
    if (depth >= MAX_NESTING_DEPTH) return;
    const newGroup: ConditionGroup = {
      id: nextId(),
      operator: 'OR',
      rows: [{ id: nextId(), variableName: '', operator: '==', value: '' }],
      groups: [],
    };
    onUpdate({ ...group, groups: [...group.groups, newGroup] });
  }, [group, onUpdate, depth]);

  const canNest = depth < MAX_NESTING_DEPTH;

  return (
    <div
      style={{
        ...groupContainerStyle,
        borderColor,
      }}
    >
      {/* 组头 */}
      <div style={groupHeaderStyle}>
        {/* AND/OR 切换 */}
        <div style={operatorToggleStyle}>
          <button
            type="button"
            style={{
              ...operatorToggleBtnStyle,
              ...(group.operator === 'AND'
                ? { ...operatorToggleActiveStyle, background: LOGIC_GROUP_COLORS.AND, color: '#FFFFFF' }
                : {}),
            }}
            onClick={() => onUpdate({ ...group, operator: 'AND' })}
          >
            AND
          </button>
          <button
            type="button"
            style={{
              ...operatorToggleBtnStyle,
              ...(group.operator === 'OR'
                ? { ...operatorToggleActiveStyle, background: LOGIC_GROUP_COLORS.OR, color: '#FFFFFF' }
                : {}),
            }}
            onClick={() => onUpdate({ ...group, operator: 'OR' })}
          >
            OR
          </button>
        </div>

        {/* 删除组按钮 */}
        {onRemove && (
          <button
            type="button"
            style={removeGroupButtonStyle}
            onClick={onRemove}
            title="删除条件组"
          >
            &#x2715;
          </button>
        )}
      </div>

      {/* 条件行列表 */}
      <div style={groupBodyStyle}>
        {group.rows.map((row, idx) => (
          <ConditionRowView
            key={row.id}
            row={row}
            variables={variables}
            onUpdate={(updated) => handleRowUpdate(idx, updated)}
            onRemove={() => handleRowRemove(idx)}
            canRemove={group.rows.length > 1 || group.groups.length > 0 || !!onRemove}
          />
        ))}

        {/* 嵌套子组 */}
        {group.groups.map((subGroup, idx) => (
          <ConditionGroupView
            key={subGroup.id}
            group={subGroup}
            variables={variables}
            depth={depth + 1}
            onUpdate={(updated) => handleSubGroupUpdate(idx, updated)}
            onRemove={() => handleSubGroupRemove(idx)}
          />
        ))}
      </div>

      {/* 操作按钮 */}
      <div style={groupActionsStyle}>
        <button type="button" style={addRowButtonStyle} onClick={handleAddRow}>
          + 添加条件
        </button>
        {canNest && (
          <>
            <button
              type="button"
              style={{ ...addGroupButtonStyle, color: LOGIC_GROUP_COLORS.AND }}
              onClick={handleAddAndGroup}
            >
              + AND 组
            </button>
            <button
              type="button"
              style={{ ...addGroupButtonStyle, color: LOGIC_GROUP_COLORS.OR }}
              onClick={handleAddOrGroup}
            >
              + OR 组
            </button>
          </>
        )}
        {!canNest && (
          <span style={maxDepthHintStyle}>
            已达最大嵌套深度 ({MAX_NESTING_DEPTH} 层)
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 主组件：ConditionEditor
// ============================================================================

export function ConditionEditor({
  nodeId,
  optionIndex,
  onClose,
  initialCondition,
}: ConditionEditorProps): React.ReactElement | null {
  // ==========================================================================
  // Store 订阅
  // ==========================================================================

  const plotFlowData = useStoryStore((s) => s.plotFlowData);
  const editorContent = useEditorStore((s) => s.content);
  const setEditorContent = useEditorStore((s) => s.setContent);
  const isOpen = useUIStore((s) => s.isConditionEditorOpen);

  const variables = useMemo<readonly VariableDeclaration[]>(
    () => plotFlowData?.variables ?? [],
    [plotFlowData],
  );

  // ==========================================================================
  // Builder 内部状态
  // ==========================================================================

  const [rootGroup, setRootGroup] = useState<ConditionGroup>(() => {
    if (initialCondition) {
      return conditionNodeToBuilder(initialCondition, 0);
    }
    return {
      id: nextId(),
      operator: 'AND',
      rows: [{ id: nextId(), variableName: '', operator: '==', value: '' }],
      groups: [],
    };
  });

  // 当 initialCondition prop 变化时重新初始化（editor text → panel 同步）
  const prevConditionRef = useRef(initialCondition);
  useEffect(() => {
    // 仅当 initialCondition 引用变化且面板打开时更新
    if (initialCondition !== prevConditionRef.current && isOpen) {
      prevConditionRef.current = initialCondition;
      if (initialCondition) {
        setRootGroup(conditionNodeToBuilder(initialCondition, 0));
      } else {
        setRootGroup({
          id: nextId(),
          operator: 'AND',
          rows: [{ id: nextId(), variableName: '', operator: '==', value: '' }],
          groups: [],
        });
      }
    }
  }, [initialCondition, isOpen]);

  // ==========================================================================
  // 表达式预览 (M3-06)
  // ==========================================================================

  const previewExpression = useMemo(
    () => builderToExpression(rootGroup),
    [rootGroup],
  );

  const hasValidCondition = useMemo(() => {
    // 检查是否至少有一行填写完整
    const checkGroup = (g: ConditionGroup): boolean => {
      for (const row of g.rows) {
        if (row.variableName && row.operator && row.value) return true;
      }
      for (const sg of g.groups) {
        if (checkGroup(sg)) return true;
      }
      return false;
    };
    return checkGroup(rootGroup);
  }, [rootGroup]);

  // ==========================================================================
  // 操作处理
  // ==========================================================================

  const handleApply = useCallback(() => {
    // 生成条件表达式字符串用于文本同步
    const expression = hasValidCondition ? builderToExpression(rootGroup) : '';

    // M3-07: 面板 → 编辑器文本同步
    if (nodeId && optionIndex !== undefined && plotFlowData) {
      // 查找目标节点和选项
      let targetNodeTitle = '';
      let targetOptionDesc = '';

      for (const chapter of plotFlowData.chapters) {
        const node = chapter.nodes.find((n) => n.fullId === nodeId || n.id === nodeId);
        if (node) {
          targetNodeTitle = node.title;
          const option = node.options[optionIndex];
          if (option) {
            targetOptionDesc = option.description;
          }
          break;
        }
      }

      if (targetNodeTitle && targetOptionDesc) {
        const newContent = updateEditorConditionText(
          editorContent,
          targetNodeTitle,
          targetOptionDesc,
          expression,
        );
        if (newContent !== editorContent) {
          setEditorContent(newContent);
        }
      }
    }

    onClose();
  }, [
    rootGroup,
    variables,
    hasValidCondition,
    nodeId,
    optionIndex,
    plotFlowData,
    editorContent,
    setEditorContent,
    onClose,
  ]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // ==========================================================================
  // 面板关闭时不渲染
  // ==========================================================================

  if (!isOpen) return null;

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <>
      {/* 半透明遮罩层 (M3-01) */}
      <div style={backdropStyle} onClick={handleBackdropClick} />

      {/* 弹出面板 */}
      <div style={panelStyle}>
        {/* ================================================================
        标题栏 (M3-01)
        ================================================================ */}
        <div style={headerStyle}>
          <h2 style={titleStyle}>条件编辑器</h2>
          <div style={headerActionsStyle}>
            {nodeId && optionIndex !== undefined && (
              <span style={contextBadgeStyle}>
                {nodeId} / 选项 {optionIndex + 1}
              </span>
            )}
            <button
              type="button"
              style={closeButtonStyle}
              onClick={handleCancel}
              title="关闭 (Esc)"
            >
              &#x2715;
            </button>
          </div>
        </div>

        {/* ================================================================
        条件构建区
        ================================================================ */}
        <div style={bodyStyle}>
          {variables.length === 0 ? (
            /* ---- 无变量时显示提示 ---- */
            <div style={emptyVarsStyle}>
              <span style={{ fontSize: '24px', marginBottom: '8px' }}>&#x1F4CB;</span>
              <span>尚未在 Frontmatter 中声明变量</span>
              <span style={emptyVarsHintStyle}>
                请在文件的 YAML Frontmatter 中添加 vars: 块来声明变量
              </span>
            </div>
          ) : (
            <ConditionGroupView
              group={rootGroup}
              variables={variables}
              depth={0}
              onUpdate={setRootGroup}
            />
          )}
        </div>

        {/* ================================================================
        表达式预览 (M3-06)
        ================================================================ */}
        <div style={previewStyle}>
          <span style={previewLabelStyle}>预览:</span>
          <code style={previewCodeStyle}>
            {previewExpression || (
              <span style={previewPlaceholderStyle}>在下方构建条件...</span>
            )}
          </code>
        </div>

        {/* ================================================================
        操作按钮
        ================================================================ */}
        <div style={footerStyle}>
          <button
            type="button"
            style={cancelButtonStyle}
            onClick={handleCancel}
          >
            取消
          </button>
          <button
            type="button"
            style={{
              ...applyButtonStyle,
              ...(!hasValidCondition ? applyButtonDisabledStyle : {}),
            }}
            onClick={handleApply}
            disabled={!hasValidCondition && !initialCondition}
          >
            应用
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// 触发器图标组件 (M3-08)
// ============================================================================

export interface ConditionTriggerProps {
  /** 点击回调（用于打开条件编辑器） */
  readonly onClick: () => void;
  /** 是否已有条件（有则显示实心图标） */
  readonly hasCondition?: boolean;
  /** 自定义样式 */
  readonly style?: React.CSSProperties;
}

/**
 * 条件编辑器触发图标按钮 (M3-08)。
 *
 * 渲染在选项行右侧的 [🔧条件] 图标。
 * - 无条件时显示灰色扳手图标
 * - 有已存在条件时显示琥珀色高亮图标
 */
export function ConditionTrigger({
  onClick,
  hasCondition = false,
  style,
}: ConditionTriggerProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hasCondition ? '编辑条件' : '添加条件'}
      style={{
        ...triggerButtonStyle,
        ...(hasCondition ? triggerActiveStyle : {}),
        ...style,
      }}
    >
      <span style={{ fontSize: '13px', lineHeight: 1 }}>
        {hasCondition ? '🔧' : '🔧'}
      </span>
      <span style={triggerLabelStyle}>条件</span>
    </button>
  );
}

// ============================================================================
// Styles — 所有颜色通过 CSS 变量 Design Token 驱动 (CLAUDE.md §6.1)
// ============================================================================

// -------- Backdrop --------

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 'var(--z-modal, 1000)',
  background: 'rgba(0, 0, 0, 0.35)',
};

// -------- Panel --------

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 'calc(var(--z-modal, 1000) + 1)',
  width: '640px',
  maxWidth: 'calc(100vw - 48px)',
  maxHeight: 'calc(100vh - 80px)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--color-bg-primary, #FFFFFF)',
  borderRadius: 'var(--radius-lg, 8px)',
  boxShadow: 'var(--shadow-xl, 0 8px 32px rgba(0,0,0,0.16))',
  border: '1px solid var(--color-border-default, #E0E0E0)',
  overflow: 'hidden',
};

// -------- Header --------

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  background: 'var(--color-bg-secondary, #F5F5F6)',
  borderBottom: '1px solid var(--color-border-default, #E0E0E0)',
  flexShrink: 0,
  userSelect: 'none',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-sm, 14px)',
  fontWeight: 600,
  color: 'var(--color-text-primary, #333333)',
};

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2, 8px)',
};

const contextBadgeStyle: React.CSSProperties = {
  fontSize: '11px',
  padding: '1px 8px',
  borderRadius: 'var(--radius-full, 9999px)',
  background: 'var(--color-bg-tertiary, #EDEDEF)',
  color: 'var(--color-text-muted, #8A8A8A)',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
};

const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'var(--color-text-muted, #8A8A8A)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  lineHeight: 1,
};

// -------- Body --------

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: 'var(--space-4, 16px)',
};

// -------- Empty Variables State --------

const emptyVarsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 16px',
  color: 'var(--color-text-muted, #8A8A8A)',
  fontSize: 'var(--text-sm, 14px)',
  gap: '4px',
};

const emptyVarsHintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-text-muted, #8A8A8A)',
  marginTop: '4px',
};

// -------- Group --------

const groupContainerStyle: React.CSSProperties = {
  border: '2px solid',
  borderRadius: 'var(--radius-md, 4px)',
  marginBottom: 'var(--space-3, 12px)',
  overflow: 'hidden',
};

const groupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 10px',
  background: 'var(--color-bg-tertiary, #EDEDEF)',
  borderBottom: '1px solid var(--color-border-default, #E0E0E0)',
};

const groupBodyStyle: React.CSSProperties = {
  padding: 'var(--space-2, 8px) var(--space-2, 8px) 0',
};

const groupActionsStyle: React.CSSProperties = {
  padding: 'var(--space-2, 8px)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2, 8px)',
  flexWrap: 'wrap',
};

// -------- AND/OR Toggle --------

const operatorToggleStyle: React.CSSProperties = {
  display: 'flex',
  gap: 0,
  borderRadius: 'var(--radius-sm, 2px)',
  overflow: 'hidden',
  border: '1px solid var(--color-border-default, #E0E0E0)',
};

const operatorToggleBtnStyle: React.CSSProperties = {
  border: 'none',
  cursor: 'pointer',
  padding: '3px 12px',
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  background: 'var(--color-bg-primary, #FFFFFF)',
  color: 'var(--color-text-secondary, #5A5A5A)',
  transition: 'background 0.1s ease, color 0.1s ease',
};

const operatorToggleActiveStyle: React.CSSProperties = {
  color: '#FFFFFF',
};

const removeGroupButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--color-text-muted, #8A8A8A)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  lineHeight: 1,
};

// -------- Condition Row --------

const conditionRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2, 8px)',
  marginBottom: 'var(--space-2, 8px)',
};

const dragHandleStyle: React.CSSProperties = {
  flexShrink: 0,
  color: 'var(--color-text-muted, #8A8A8A)',
  cursor: 'grab',
  fontSize: '12px',
  padding: '2px',
  userSelect: 'none',
};

const removeRowButtonStyle: React.CSSProperties = {
  flexShrink: 0,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--color-text-muted, #8A8A8A)',
  padding: '2px 4px',
  borderRadius: 'var(--radius-sm, 2px)',
  lineHeight: 1,
};

// -------- Dropdown (shared) --------

const dropdownContainerStyle: React.CSSProperties = {
  position: 'relative',
  minWidth: 120,
  flexShrink: 0,
};

const dropdownButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-primary, #FFFFFF)',
  color: 'var(--color-text-primary, #333333)',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  cursor: 'pointer',
  textAlign: 'left',
  lineHeight: '20px',
};

const dropdownMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  marginTop: '2px',
  minWidth: '100%',
  maxHeight: '220px',
  overflowY: 'auto',
  background: 'var(--color-bg-primary, #FFFFFF)',
  border: '1px solid var(--color-border-default, #E0E0E0)',
  borderRadius: 'var(--radius-md, 4px)',
  boxShadow: 'var(--shadow-md, 0 2px 8px rgba(0,0,0,0.10))',
  zIndex: 10,
};

const dropdownListStyle: React.CSSProperties = {
  maxHeight: '160px',
  overflowY: 'auto',
};

const dropdownItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  width: '100%',
  padding: '5px 10px',
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-primary, #333333)',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  cursor: 'pointer',
  textAlign: 'left',
  lineHeight: '18px',
};

const dropdownItemActiveStyle: React.CSSProperties = {
  background: 'var(--color-accent-subtle, rgba(160,112,58,0.08))',
};

const emptyOptionStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '11px',
  color: 'var(--color-text-muted, #8A8A8A)',
  textAlign: 'center',
};

const chevronStyle: React.CSSProperties = {
  fontSize: '8px',
  color: 'var(--color-text-muted, #8A8A8A)',
  marginLeft: 'auto',
  lineHeight: 1,
};

const placeholderStyle: React.CSSProperties = {
  color: 'var(--color-text-muted, #8A8A8A)',
  flex: 1,
};

const typeIconStyle: React.CSSProperties = {
  flexShrink: 0,
  width: 18,
  height: 18,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  color: 'var(--color-accent, #A0703A)',
  background: 'var(--color-accent-subtle, rgba(160,112,58,0.08))',
  borderRadius: 'var(--radius-sm, 2px)',
};

const typeLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-text-muted, #8A8A8A)',
  flexShrink: 0,
};

const noVarsHintStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '11px',
  color: 'var(--color-text-muted, #8A8A8A)',
  textAlign: 'center',
  borderTop: '1px solid var(--color-border-default, #E0E0E0)',
};

// -------- Search --------

const searchContainerStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--color-border-default, #E0E0E0)',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-primary, #FFFFFF)',
  color: 'var(--color-text-primary, #333333)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  outline: 'none',
  boxSizing: 'border-box',
};

// -------- Value Inputs --------

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-primary, #FFFFFF)',
  color: 'var(--color-text-primary, #333333)',
  fontSize: '12px',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  outline: 'none',
  cursor: 'pointer',
  height: '28px',
  boxSizing: 'border-box',
};

const numberInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-primary, #FFFFFF)',
  color: 'var(--color-text-primary, #333333)',
  fontSize: '12px',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  outline: 'none',
  height: '28px',
  boxSizing: 'border-box',
};

const textInputStyle: React.CSSProperties = {
  ...numberInputStyle,
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

const disabledInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-tertiary, #EDEDEF)',
  color: 'var(--color-text-muted, #8A8A8A)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
};

// -------- Add Buttons --------

const addRowButtonStyle: React.CSSProperties = {
  border: '1px dashed var(--color-border-default, #E0E0E0)',
  background: 'transparent',
  cursor: 'pointer',
  padding: '3px 10px',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  color: 'var(--color-text-secondary, #5A5A5A)',
  borderRadius: 'var(--radius-sm, 2px)',
  lineHeight: '18px',
};

const addGroupButtonStyle: React.CSSProperties = {
  border: '1px dashed',
  background: 'transparent',
  cursor: 'pointer',
  padding: '3px 10px',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  fontWeight: 600,
  borderRadius: 'var(--radius-sm, 2px)',
  lineHeight: '18px',
};

const maxDepthHintStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-text-muted, #8A8A8A)',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

// -------- Preview --------

const previewStyle: React.CSSProperties = {
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  borderTop: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-secondary, #F5F5F6)',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-2, 8px)',
  flexShrink: 0,
};

const previewLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-secondary, #5A5A5A)',
  flexShrink: 0,
  lineHeight: '20px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

const previewCodeStyle: React.CSSProperties = {
  flex: 1,
  fontSize: '12px',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  color: 'var(--color-syntax-condition, #C5662A)',
  wordBreak: 'break-all',
  lineHeight: '20px',
};

const previewPlaceholderStyle: React.CSSProperties = {
  color: 'var(--color-text-muted, #8A8A8A)',
  fontStyle: 'italic',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

// -------- Footer --------

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-2, 8px)',
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  borderTop: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-secondary, #F5F5F6)',
  flexShrink: 0,
};

const cancelButtonStyle: React.CSSProperties = {
  border: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-primary, #FFFFFF)',
  cursor: 'pointer',
  padding: '6px 16px',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  fontWeight: 500,
  color: 'var(--color-text-primary, #333333)',
  borderRadius: 'var(--radius-md, 4px)',
  lineHeight: '18px',
};

const applyButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'var(--color-accent, #A0703A)',
  cursor: 'pointer',
  padding: '6px 20px',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  fontWeight: 600,
  color: 'var(--color-text-on-accent, #FFFFFF)',
  borderRadius: 'var(--radius-md, 4px)',
  lineHeight: '18px',
};

const applyButtonDisabledStyle: React.CSSProperties = {
  background: 'var(--color-bg-tertiary, #EDEDEF)',
  color: 'var(--color-text-muted, #8A8A8A)',
  cursor: 'not-allowed',
};

// -------- Trigger Button (M3-08) --------

const triggerButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  border: '1px solid var(--color-border-default, #E0E0E0)',
  background: 'var(--color-bg-primary, #FFFFFF)',
  cursor: 'pointer',
  padding: '1px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  color: 'var(--color-text-muted, #8A8A8A)',
  lineHeight: '18px',
  transition: 'background 0.1s ease, color 0.1s ease, border-color 0.1s ease',
  userSelect: 'none',
};

const triggerActiveStyle: React.CSSProperties = {
  color: 'var(--color-syntax-condition, #C5662A)',
  borderColor: 'var(--color-syntax-condition, #C5662A)',
  background: 'var(--color-accent-subtle, rgba(160,112,58,0.08))',
};

const triggerLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
};
