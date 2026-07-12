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

import React, {
  useState,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useId,
} from 'react';
import { createPortal } from 'react-dom';
import { useStoryStore, useUIStore } from '../../stores';
import { graphEditService } from '../../services/graphEditService';
import { useAppText } from '../../i18n/appI18n';
import {
  type ConditionNode,
  type ComparisonExpression,
  type Operand,
  type VariableDeclaration,
  type VariableType,
  type ComparisonOperator,
  type LogicalOperator,
} from '@plotflow/core';

// ============================================================================
// 内部 Builder 状态类型
// ============================================================================

/** 单条条件行 */
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

/** 条件组（可嵌套） */
export interface ConditionGroup {
  readonly id: string;
  operator: LogicalOperator;
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
const LOGIC_GROUP_COLORS: Readonly<Record<LogicalOperator, string>> = {
  AND: 'var(--color-syntax-heading)',
  OR: 'var(--color-syntax-condition)',
  NOT: 'var(--color-status-warning)',
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
  const segments = name.split('.');
  let current = variables.find((variable) => variable.name === segments[0]);

  for (const segment of segments.slice(1)) {
    current = current?.fields?.find((field) => field.name === segment);
  }

  return current?.type ?? null;
}

function findVariableDeclaration(
  name: string,
  variables: readonly VariableDeclaration[],
): VariableDeclaration | null {
  const segments = name.split('.');
  let current = variables.find((variable) => variable.name === segments[0]);

  for (const segment of segments.slice(1)) {
    current = current?.fields?.find((field) => field.name === segment);
  }

  return current ?? null;
}

interface VariableOption {
  readonly name: string;
  readonly declaration: VariableDeclaration;
}

/** 将 object 字段展开为条件表达式可引用的点路径。 */
function flattenVariableOptions(
  variables: readonly VariableDeclaration[],
  prefix = '',
): VariableOption[] {
  return variables.flatMap((variable) => {
    const name = prefix ? `${prefix}.${variable.name}` : variable.name;
    const current = variable.type === 'object'
      ? []
      : [{ name, declaration: variable }];
    const children = variable.fields
      ? flattenVariableOptions(variable.fields, name)
      : [];
    return [...current, ...children];
  });
}

// ============================================================================
// 辅助函数：ConditionNode ↔ Builder 状态 互转
// ============================================================================

/**
 * 将 ConditionRow 转换为 Operand。
 */
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
    const n = parseInt(raw, 10);
    return { operandType: 'literal', literalValue: Number.isNaN(n) ? 0 : n };
  }
  if (contextualType === 'float' || literalType === 'number') {
    const n = parseFloat(raw);
    return { operandType: 'literal', literalValue: Number.isNaN(n) ? 0.0 : n };
  }
  return { operandType: 'literal', literalValue: raw };
}

/**
 * 将单行条件转换为 ComparisonExpression。
 */
function rowToComparison(
  row: ConditionRow,
  variables: readonly VariableDeclaration[],
): ComparisonExpression {
  const leftVariableType = row.leftOperandType === 'variable'
    ? findVariableType(row.variableName, variables)
    : null;
  const rightVariableType = row.rightOperandType === 'variable'
    ? findVariableType(row.value, variables)
    : null;
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
    if (row.variableName.length > 0 && row.value.length > 0) {
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

  if (group.operator === 'NOT') {
    const operand = allNodes.length === 1
      ? allNodes[0]!
      : {
          type: 'logical' as const,
          operator: 'AND' as const,
          operands: allNodes,
        };
    return {
      type: 'logical',
      operator: 'NOT',
      operands: [operand],
    };
  }

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
export function conditionNodeToBuilder(
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

    // AND / OR / NOT。NOT 保留为独立组，不再通过反转比较符进行有损展开。
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
        // 合法 .mdstory 最多三层。若收到更深的外部 AST，仍保留结构，
        // 但 UI 不再允许继续新增嵌套层级。
        group.groups.push(conditionNodeToBuilder(operand, depth + 1));
      }
    }
  }

  return group;
}

/**
 * 将 ComparisonExpression 转换为 ConditionRow。
 */
function operandToDraft(operand: Operand): {
  readonly value: string;
  readonly literalType: 'string' | 'number' | 'boolean';
} {
  if (operand.operandType === 'variable') {
    return { value: operand.variableName ?? '', literalType: 'string' };
  }
  const val = operand.literalValue;
  if (typeof val === 'boolean') {
    return { value: val ? 'true' : 'false', literalType: 'boolean' };
  }
  if (typeof val === 'number') {
    return { value: String(val), literalType: 'number' };
  }
  return { value: val != null ? String(val) : '', literalType: 'string' };
}

function comparisonToRow(node: ComparisonExpression): ConditionRow {
  const left = operandToDraft(node.left);
  const right = operandToDraft(node.right);
  return {
    id: nextId(),
    leftOperandType: node.left.operandType,
    leftLiteralType: left.literalType,
    variableName: left.value,
    operator: node.operator,
    rightOperandType: node.right.operandType,
    rightLiteralType: right.literalType,
    value: right.value,
  };
}

function createEmptyConditionRow(): ConditionRow {
  return {
    id: nextId(),
    leftOperandType: 'variable',
    leftLiteralType: 'string',
    variableName: '',
    operator: '==',
    rightOperandType: 'literal',
    rightLiteralType: 'string',
    value: '',
  };
}

function createEmptyConditionGroup(): ConditionGroup {
  return {
    id: nextId(),
    operator: 'AND',
    rows: [createEmptyConditionRow()],
    groups: [],
  };
}

// ============================================================================
// 辅助函数：表达式预览字符串生成
// ============================================================================

function serializeLiteral(value: Operand['literalValue']): string {
  if (typeof value === 'string') {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return `'${JSON.stringify(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function serializeOperand(operand: Operand): string {
  if (operand.operandType === 'variable') {
    return `$${operand.variableName ?? ''}`;
  }
  return serializeLiteral(operand.literalValue);
}

/**
 * 将条件 AST 序列化为可写回 `.mdstory` 的表达式。
 *
 * 字符串与 enum 统一使用单引号并转义，变量引用保留 `$` 前缀；
 * 逻辑节点始终显式加括号，从而保证优先级可逆。
 */
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

// ============================================================================
// Portal 下拉基础设施
// ============================================================================

interface DropdownPosition {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
  readonly opensUpward: boolean;
}

interface AnchoredDropdownOptions {
  readonly isOpen: boolean;
  readonly onDismiss: () => void;
}

const DROPDOWN_VIEWPORT_GUTTER = 8;
const DROPDOWN_OFFSET = 4;
const DROPDOWN_MAX_HEIGHT = 220;
const DROPDOWN_MIN_HEIGHT = 48;

/**
 * 模态编辑器提供 body 直系的专属浮层宿主，并通过 aria-owns 与焦点陷阱
 * 合并其可访问性边界；Graph Inspector 等内联场景则继续回退到 body。
 */
const DropdownPortalHostContext = React.createContext<HTMLElement | null>(null);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 将条件编辑器下拉菜单挂到 body，避免 Inspector 与条件树的 overflow 裁切。
 * 所有关闭事件和位置观察都在菜单关闭时清理，避免长时间编辑时遗留监听器。
 */
function useAnchoredDropdown({
  isOpen,
  onDismiss,
}: AnchoredDropdownOptions): {
  readonly triggerRef: React.RefObject<HTMLButtonElement>;
  readonly menuRef: React.RefObject<HTMLDivElement>;
  readonly position: DropdownPosition | null;
} {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const maxWidth = Math.max(0, viewportWidth - (DROPDOWN_VIEWPORT_GUTTER * 2));
    const width = Math.min(Math.max(triggerRect.width, menuRect.width), maxWidth);
    const availableBelow = viewportHeight - triggerRect.bottom - DROPDOWN_OFFSET - DROPDOWN_VIEWPORT_GUTTER;
    const availableAbove = triggerRect.top - DROPDOWN_OFFSET - DROPDOWN_VIEWPORT_GUTTER;
    const measuredHeight = Math.min(Math.max(menuRect.height, DROPDOWN_MIN_HEIGHT), DROPDOWN_MAX_HEIGHT);
    const opensUpward = availableBelow < measuredHeight && availableAbove > availableBelow;
    const availableHeight = opensUpward ? availableAbove : availableBelow;
    const maxHeight = Math.max(
      DROPDOWN_MIN_HEIGHT,
      Math.min(DROPDOWN_MAX_HEIGHT, availableHeight),
    );
    const renderedHeight = Math.min(measuredHeight, maxHeight);
    const top = opensUpward
      ? Math.max(DROPDOWN_VIEWPORT_GUTTER, triggerRect.top - DROPDOWN_OFFSET - renderedHeight)
      : Math.min(
        viewportHeight - DROPDOWN_VIEWPORT_GUTTER - renderedHeight,
        triggerRect.bottom + DROPDOWN_OFFSET,
      );
    const left = clamp(
      triggerRect.left,
      DROPDOWN_VIEWPORT_GUTTER,
      Math.max(DROPDOWN_VIEWPORT_GUTTER, viewportWidth - DROPDOWN_VIEWPORT_GUTTER - width),
    );

    setPosition({ top, left, width, maxHeight, opensUpward });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }

    let animationFrame = window.requestAnimationFrame(updatePosition);
    const schedulePositionUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updatePosition);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (
        target
        && (triggerRef.current?.contains(target) || menuRef.current?.contains(target))
      ) {
        return;
      }
      onDismiss();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(schedulePositionUpdate);

    if (triggerRef.current) resizeObserver?.observe(triggerRef.current);
    if (menuRef.current) resizeObserver?.observe(menuRef.current);
    window.addEventListener('resize', schedulePositionUpdate);
    document.addEventListener('scroll', schedulePositionUpdate, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', schedulePositionUpdate);
      document.removeEventListener('scroll', schedulePositionUpdate, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onDismiss, updatePosition]);

  return { triggerRef, menuRef, position };
}

function getDropdownPortalStyle(position: DropdownPosition | null): React.CSSProperties {
  return {
    ...dropdownMenuStyle,
    top: position?.top ?? -10000,
    left: position?.left ?? -10000,
    width: position?.width,
    maxHeight: position?.maxHeight ?? DROPDOWN_MAX_HEIGHT,
    visibility: position ? 'visible' : 'hidden',
    transformOrigin: position?.opensUpward ? 'bottom left' : 'top left',
  };
}

// ============================================================================
// 子组件：变量下拉框 (M3-02)
// ============================================================================

interface VariableDropdownProps {
  readonly variables: readonly VariableDeclaration[];
  readonly selectedName: string;
  readonly onSelect: (name: string) => void;
  readonly ariaLabel: string;
}

function VariableDropdown({
  variables,
  selectedName,
  onSelect,
  ariaLabel,
}: VariableDropdownProps): React.ReactElement {
  const text = useAppText();
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const didFocusMenuRef = useRef(false);
  const portalHost = useContext(DropdownPortalHostContext);
  const menuId = useId();
  const options = useMemo(() => flattenVariableOptions(variables), [variables]);
  const dismissDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchText('');
  }, []);
  const { triggerRef, menuRef, position } = useAnchoredDropdown({
    isOpen,
    onDismiss: dismissDropdown,
  });

  useEffect(() => {
    if (!isOpen) {
      didFocusMenuRef.current = false;
      return;
    }
    if (!position || didFocusMenuRef.current) return;
    didFocusMenuRef.current = true;
    inputRef.current?.focus();
  }, [isOpen, position]);

  const filtered = useMemo(() => {
    if (!searchText) return options;
    const lower = searchText.toLowerCase();
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(lower) ||
        text(`conditionEditor.variableType.${option.declaration.type}`).includes(searchText),
    );
  }, [options, searchText, text]);

  const selectedVar = options.find((option) => option.name === selectedName);
  const selectedIcon = selectedVar ? VARIABLE_TYPE_ICONS[selectedVar.declaration.type] : '';

  return (
    <div style={dropdownContainerStyle}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        data-testid="condition-variable-dropdown-trigger"
        data-condition-dropdown="variable"
        style={dropdownButtonStyle}
        onClick={() => {
          if (isOpen) {
            dismissDropdown();
            return;
          }
          setIsOpen(true);
        }}
      >
        {selectedVar ? (
          <>
            <span style={typeIconStyle}>{selectedIcon}</span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {selectedName}
            </span>
            <span style={typeLabelStyle}>
              {text(`conditionEditor.variableType.${selectedVar.declaration.type}`)}
            </span>
          </>
        ) : (
          <span style={placeholderStyle}>{text('conditionEditor.selectVariable')}</span>
        )}
        <span style={chevronStyle}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          data-testid="condition-variable-dropdown-menu"
          data-condition-dropdown="variable"
          style={getDropdownPortalStyle(position)}
        >
          {/* 搜索框 */}
          <div style={searchContainerStyle}>
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={text('conditionEditor.searchVariable')}
              aria-label={text('conditionEditor.searchVariable')}
              aria-controls={menuId}
              style={searchInputStyle}
            />
          </div>

          {/* 变量列表 */}
          <div
            id={menuId}
            role="listbox"
            aria-label={ariaLabel}
            data-testid="condition-variable-dropdown-options"
            style={dropdownListStyle}
          >
            {filtered.length === 0 ? (
              <div style={emptyOptionStyle}>{text('conditionEditor.noMatchingVariable')}</div>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  role="option"
                  aria-selected={option.name === selectedName}
                  style={{
                    ...dropdownItemStyle,
                    ...(option.name === selectedName ? dropdownItemActiveStyle : {}),
                  }}
                  onClick={() => {
                    onSelect(option.name);
                    dismissDropdown();
                    window.requestAnimationFrame(() => triggerRef.current?.focus());
                  }}
                >
                  <span style={typeIconStyle}>{VARIABLE_TYPE_ICONS[option.declaration.type]}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {option.name}
                  </span>
                  <span style={typeLabelStyle}>{text(`conditionEditor.variableType.${option.declaration.type}`)}</span>
                </button>
              ))
            )}
          </div>

          {/* 提示：无变量时 */}
          {variables.length === 0 && (
            <div style={noVarsHintStyle}>
              {text('conditionEditor.declareVariableFirst')}
            </div>
          )}
        </div>,
        portalHost ?? document.body,
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
  readonly ariaLabel: string;
}

function OperatorDropdown({
  operators,
  selected,
  onSelect,
  ariaLabel,
}: OperatorDropdownProps): React.ReactElement {
  const text = useAppText();
  const [isOpen, setIsOpen] = useState(false);
  const didFocusMenuRef = useRef(false);
  const portalHost = useContext(DropdownPortalHostContext);
  const menuId = useId();
  const dismissDropdown = useCallback(() => setIsOpen(false), []);
  const { triggerRef, menuRef, position } = useAnchoredDropdown({
    isOpen,
    onDismiss: dismissDropdown,
  });

  useEffect(() => {
    if (operators.length === 0 && isOpen) dismissDropdown();
  }, [dismissDropdown, isOpen, operators.length]);

  useEffect(() => {
    if (!isOpen) {
      didFocusMenuRef.current = false;
      return;
    }
    if (!position || didFocusMenuRef.current) return;
    didFocusMenuRef.current = true;
    const selectedOption = menuRef.current?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
    const firstOption = menuRef.current?.querySelector<HTMLElement>('[role="option"]');
    (selectedOption ?? firstOption)?.focus();
  }, [isOpen, menuRef, position]);

  if (operators.length === 0) {
    return (
      <div style={{ ...dropdownButtonStyle, color: 'var(--color-text-muted)', cursor: 'not-allowed' }}>
        {text('conditionEditor.notComparable')}
      </div>
    );
  }

  return (
    <div style={{ ...dropdownContainerStyle, minWidth: 56 }}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        data-testid="condition-operator-dropdown-trigger"
        data-condition-dropdown="operator"
        style={dropdownButtonStyle}
        onClick={() => {
          if (isOpen) {
            dismissDropdown();
            return;
          }
          setIsOpen(true);
        }}
      >
        <span style={{ fontWeight: 600 }}>
          {OPERATOR_LABELS[selected] || selected}
        </span>
        <span style={chevronStyle}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          data-testid="condition-operator-dropdown-menu"
          data-condition-dropdown="operator"
          style={getDropdownPortalStyle(position)}
        >
          {operators.map((op) => (
            <button
              key={op}
              type="button"
              role="option"
              aria-selected={op === selected}
              style={{
                ...dropdownItemStyle,
                ...(op === selected ? dropdownItemActiveStyle : {}),
              }}
              onClick={() => {
                onSelect(op);
                dismissDropdown();
                window.requestAnimationFrame(() => triggerRef.current?.focus());
              }}
            >
              <span style={{ fontWeight: 600 }}>{OPERATOR_LABELS[op]}</span>
              <span style={{ marginLeft: 8, fontSize: '10px', color: 'var(--color-text-muted)' }}>
                {op}
              </span>
            </button>
          ))}
        </div>,
        portalHost ?? document.body,
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
  readonly ariaLabel: string;
}

function ValueInput({
  variableType,
  enumValues,
  value,
  onChange,
  ariaLabel,
}: ValueInputProps): React.ReactElement {
  const text = useAppText();
  // bool → true/false 下拉
  if (variableType === 'bool') {
    return (
      <select
        aria-label={ariaLabel}
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
        aria-label={ariaLabel}
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
        aria-label={ariaLabel}
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
        aria-label={ariaLabel}
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
      <div style={{ ...disabledInputStyle }}>{text('conditionEditor.notComparable')}</div>
    );
  }

  // string / 未知 → 文本输入
  return (
    <input
      aria-label={ariaLabel}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={text('conditionEditor.valuePlaceholder')}
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
  const text = useAppText();
  const leftVariable = row.leftOperandType === 'variable'
    ? findVariableDeclaration(row.variableName, variables)
    : null;
  const rightVariable = row.rightOperandType === 'variable'
    ? findVariableDeclaration(row.value, variables)
    : null;
  const variableType = leftVariable?.type ?? rightVariable?.type ?? null;
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

  const leftLiteralContext = rightVariable;
  const rightLiteralContext = leftVariable;
  const literalInputType = (
    literalType: ConditionRow['leftLiteralType'],
    context: VariableDeclaration | null,
  ): VariableType => {
    if (context) return context.type;
    if (literalType === 'boolean') return 'bool';
    if (literalType === 'number') return 'float';
    return 'string';
  };

  return (
    <div style={conditionRowStyle}>
      {/* 拖拽把手（装饰） */}
      <span style={dragHandleStyle}>&#x2630;</span>

      {/* 左操作数：变量或类型化字面值 */}
      <div style={rightOperandStyle}>
        <select
          aria-label={text('conditionEditor.leftOperandType')}
          value={row.leftOperandType}
          onChange={(event) => onUpdate({
            ...row,
            leftOperandType: event.target.value as ConditionRow['leftOperandType'],
            variableName: '',
          })}
          style={operandTypeSelectStyle}
        >
          <option value="variable">{text('conditionEditor.variable')}</option>
          <option value="literal">{text('conditionEditor.value')}</option>
        </select>
        {row.leftOperandType === 'variable' ? (
          <VariableDropdown
            variables={variables}
            selectedName={row.variableName}
            onSelect={(name) => onUpdate({ ...row, variableName: name })}
            ariaLabel={text('conditionEditor.leftVariable')}
          />
        ) : (
          <>
            {!leftLiteralContext && (
              <select
                aria-label={text('conditionEditor.leftLiteralType')}
                value={row.leftLiteralType}
                onChange={(event) => onUpdate({
                  ...row,
                  leftLiteralType: event.target.value as ConditionRow['leftLiteralType'],
                  variableName: '',
                })}
                style={operandTypeSelectStyle}
              >
                <option value="string">{text('conditionEditor.text')}</option>
                <option value="number">{text('conditionEditor.number')}</option>
                <option value="boolean">{text('conditionEditor.boolean')}</option>
              </select>
            )}
            <div style={{ flex: 1, minWidth: 80 }}>
              <ValueInput
                variableType={literalInputType(row.leftLiteralType, leftLiteralContext)}
                enumValues={leftLiteralContext?.enumValues}
                value={row.variableName}
                onChange={(value) => onUpdate({ ...row, variableName: value })}
                ariaLabel={text('conditionEditor.leftValue')}
              />
            </div>
          </>
        )}
      </div>

      {/* 运算符下拉 */}
      <OperatorDropdown
        operators={availableOps}
        selected={effectiveOp}
        onSelect={(op) => onUpdate({ ...row, operator: op })}
        ariaLabel={text('conditionEditor.comparisonOperator')}
      />

      {/* 右操作数：类型化字面值或另一个变量 */}
      <div style={rightOperandStyle}>
        <select
          aria-label={text('conditionEditor.rightOperandType')}
          value={row.rightOperandType}
          onChange={(event) => onUpdate({
            ...row,
            rightOperandType: event.target.value as ConditionRow['rightOperandType'],
            value: '',
          })}
          style={operandTypeSelectStyle}
        >
          <option value="literal">{text('conditionEditor.value')}</option>
          <option value="variable">{text('conditionEditor.variable')}</option>
        </select>
        {row.rightOperandType === 'variable' ? (
          <VariableDropdown
            variables={variables}
            selectedName={row.value}
            onSelect={(name) => onUpdate({ ...row, value: name })}
            ariaLabel={text('conditionEditor.rightVariable')}
          />
        ) : (
          <>
            {!rightLiteralContext && (
              <select
                aria-label={text('conditionEditor.rightLiteralType')}
                value={row.rightLiteralType}
                onChange={(event) => onUpdate({
                  ...row,
                  rightLiteralType: event.target.value as ConditionRow['rightLiteralType'],
                  value: '',
                })}
                style={operandTypeSelectStyle}
              >
                <option value="string">{text('conditionEditor.text')}</option>
                <option value="number">{text('conditionEditor.number')}</option>
                <option value="boolean">{text('conditionEditor.boolean')}</option>
              </select>
            )}
            <div style={{ flex: 1, minWidth: 80 }}>
              <ValueInput
                variableType={literalInputType(row.rightLiteralType, rightLiteralContext)}
                enumValues={rightLiteralContext?.enumValues}
                value={row.value}
                onChange={(val) => onUpdate({ ...row, value: val })}
                ariaLabel={text('conditionEditor.rightValue')}
              />
            </div>
          </>
        )}
      </div>

      {/* 删除按钮 */}
      {canRemove && (
        <button
          type="button"
          style={removeRowButtonStyle}
          onClick={onRemove}
          title={text('conditionEditor.deleteCondition')}
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
  const text = useAppText();
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
    const newRow = createEmptyConditionRow();
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
      rows: [createEmptyConditionRow()],
      groups: [],
    };
    onUpdate({ ...group, groups: [...group.groups, newGroup] });
  }, [group, onUpdate, depth]);

  const handleAddOrGroup = useCallback(() => {
    if (depth >= MAX_NESTING_DEPTH) return;
    const newGroup: ConditionGroup = {
      id: nextId(),
      operator: 'OR',
      rows: [createEmptyConditionRow()],
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
        <div style={operatorToggleStyle} role="group" aria-label={text('conditionEditor.groupOperator')}>
          <button
            type="button"
            style={{
              ...operatorToggleBtnStyle,
              ...(group.operator === 'AND'
                ? { ...operatorToggleActiveStyle, background: LOGIC_GROUP_COLORS.AND, color: 'var(--color-text-on-accent)' }
                : {}),
            }}
            onClick={() => onUpdate({ ...group, operator: 'AND' })}
            aria-pressed={group.operator === 'AND'}
          >
            AND
          </button>
          <button
            type="button"
            style={{
              ...operatorToggleBtnStyle,
              ...(group.operator === 'OR'
                ? { ...operatorToggleActiveStyle, background: LOGIC_GROUP_COLORS.OR, color: 'var(--color-text-on-accent)' }
                : {}),
            }}
            onClick={() => onUpdate({ ...group, operator: 'OR' })}
            aria-pressed={group.operator === 'OR'}
          >
            OR
          </button>
          <button
            type="button"
            style={{
              ...operatorToggleBtnStyle,
              ...(group.operator === 'NOT'
                ? { ...operatorToggleActiveStyle, background: LOGIC_GROUP_COLORS.NOT, color: 'var(--color-text-on-accent)' }
                : {}),
            }}
            onClick={() => onUpdate({ ...group, operator: 'NOT' })}
            aria-pressed={group.operator === 'NOT'}
            title={text('conditionEditor.negateGroup')}
          >
            NOT
          </button>
        </div>

        {/* 删除组按钮 */}
        {onRemove && (
          <button
            type="button"
            style={removeGroupButtonStyle}
            onClick={onRemove}
            title={text('conditionEditor.deleteGroup')}
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
          {text('conditionEditor.addCondition')}
        </button>
        {canNest && (
          <>
            <button
              type="button"
              style={{ ...addGroupButtonStyle, color: LOGIC_GROUP_COLORS.AND }}
              onClick={handleAddAndGroup}
            >
              {text('conditionEditor.addAndGroup')}
            </button>
            <button
              type="button"
              style={{ ...addGroupButtonStyle, color: LOGIC_GROUP_COLORS.OR }}
              onClick={handleAddOrGroup}
            >
              {text('conditionEditor.addOrGroup')}
            </button>
          </>
        )}
        {!canNest && (
          <span style={maxDepthHintStyle}>
            {text('conditionEditor.maxDepth', { depth: MAX_NESTING_DEPTH })}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 共享组件：可嵌入任意 Inspector 的条件树编辑器
// ============================================================================

export interface ConditionTreeEditorProps {
  readonly value: ConditionNode | null;
  readonly variables: readonly VariableDeclaration[];
  readonly onChange: (value: ConditionNode | null) => void;
  readonly compact?: boolean;
  readonly allowClear?: boolean;
  readonly testId?: string;
}

/**
 * 受控的条件树编辑器。
 *
 * 内部保留未填写完整的 Builder 草稿；只有可序列化为合法 AST 的部分才通过
 * `onChange` 发给上层。这让 Inspector 可以即时提交，同时不会在用户选择变量
 * 和输入值之间丢失半成品。
 */
export function ConditionTreeEditor({
  value,
  variables,
  onChange,
  compact = false,
  allowClear = true,
  testId = 'condition-tree-editor',
}: ConditionTreeEditorProps): React.ReactElement {
  const text = useAppText();
  const [rootGroup, setRootGroup] = useState<ConditionGroup>(() => (
    value ? conditionNodeToBuilder(value) : createEmptyConditionGroup()
  ));
  const lastEmittedSignatureRef = useRef<string | null>(null);
  const externalSignature = useMemo(() => serializeConditionExpression(value), [value]);

  useEffect(() => {
    if (lastEmittedSignatureRef.current === externalSignature) {
      lastEmittedSignatureRef.current = null;
      return;
    }
    setRootGroup(value ? conditionNodeToBuilder(value) : createEmptyConditionGroup());
  }, [externalSignature, value]);

  const handleUpdate = useCallback((nextGroup: ConditionGroup) => {
    setRootGroup(nextGroup);
    const nextValue = builderToConditionNode(nextGroup, variables);
    // 半成品不是“清除条件”。只有明确点击清除时才向上层发送 null，
    // 避免 Inspector 在用户切换变量、尚未输入值的瞬间删除现有条件。
    if (!nextValue) return;
    lastEmittedSignatureRef.current = serializeConditionExpression(nextValue);
    onChange(nextValue);
  }, [onChange, variables]);

  const handleClear = useCallback(() => {
    setRootGroup(createEmptyConditionGroup());
    lastEmittedSignatureRef.current = '';
    onChange(null);
  }, [onChange]);

  return (
    <div
      data-testid={testId}
      style={{
        ...conditionTreeStyle,
        ...(compact ? conditionTreeCompactStyle : {}),
      }}
    >
      {variables.length === 0 ? (
        <div style={emptyVarsStyle} role="status">
          <span aria-hidden="true" style={{ fontSize: '24px', marginBottom: '8px' }}>&#x1F4CB;</span>
          <span>{text('conditionEditor.noVariables')}</span>
          <span style={emptyVarsHintStyle}>
            {text('conditionEditor.noVariablesHint')}
          </span>
        </div>
      ) : (
        <>
          <ConditionGroupView
            group={rootGroup}
            variables={variables}
            depth={0}
            onUpdate={handleUpdate}
          />
          {allowClear && (
            <button
              type="button"
              onClick={handleClear}
              style={clearConditionButtonStyle}
              disabled={!builderToConditionNode(rootGroup, variables)}
            >
              {text('conditionEditor.clear')}
            </button>
          )}
        </>
      )}
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
}: ConditionEditorProps): React.ReactElement | null {
  const text = useAppText();
  // ==========================================================================
  // Store 订阅
  // ==========================================================================

  const plotFlowData = useStoryStore((s) => s.plotFlowData);
  const isOpen = useUIStore((s) => s.isConditionEditorOpen);
  const setStatusMessage = useUIStore((s) => s.setStatusMessage);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const dropdownPortalHostId = useId();
  const dropdownPortalHostRef = useRef<HTMLDivElement | null>(null);
  const [dropdownPortalHost, setDropdownPortalHost] = useState<HTMLDivElement | null>(null);

  const selectedNode = useMemo(() => {
    if (nodeId === undefined || optionIndex === undefined || !plotFlowData) {
      return null;
    }

    for (const chapter of plotFlowData.chapters) {
      for (const node of chapter.nodes) {
        if (node.fullId === nodeId) return node;
      }
    }
    return null;
  }, [nodeId, optionIndex, plotFlowData]);

  const variables = useMemo<readonly VariableDeclaration[]>(
    () => (plotFlowData?.variables ?? []).filter((variable) => (
      variable.scope !== 'chapter' || variable.chapterId === selectedNode?.chapterId
    )),
    [plotFlowData, selectedNode?.chapterId],
  );

  const selectedOption = useMemo(
    () => selectedNode?.options[optionIndex ?? -1] ?? null,
    [optionIndex, selectedNode],
  );

  // ==========================================================================
  // 从 AST 中解析当前选项的已有条件（text → panel 同步）
  // ==========================================================================

  /** 当 nodeId + optionIndex 提供时，从 AST 查找已有条件 */
  const resolvedCondition = useMemo<ConditionNode | null>(() => {
    return selectedOption?.condition ?? null;
  }, [selectedOption]);

  // ==========================================================================
  // 可提交的条件草稿
  // ==========================================================================

  const [draftCondition, setDraftCondition] = useState<ConditionNode | null>(resolvedCondition);

  useEffect(() => {
    if (!isOpen) return;

    if (resolvedCondition) {
      setDraftCondition(resolvedCondition);
      return;
    }

    setDraftCondition(null);
  }, [isOpen, resolvedCondition, nodeId, optionIndex]);

  // initialCondition 的动态监听已在 V0.2 重构中移除（改用 resolvedCondition 一次初始化）

  // ==========================================================================
  // 表达式预览 (M3-06)
  // ==========================================================================

  const previewExpression = useMemo(
    () => serializeConditionExpression(draftCondition),
    [draftCondition],
  );

  const hasValidCondition = draftCondition !== null;

  // ==========================================================================
  // 操作处理
  // ==========================================================================

  const handleApply = useCallback(() => {
    // 生成条件表达式字符串用于文本同步
    const expression = hasValidCondition
      ? serializeConditionExpression(draftCondition)
      : '';

    if (selectedOption) {
      const committed = graphEditService.updateOption(selectedOption, {
        conditionRaw: expression || null,
      });
      if (!committed) {
        setStatusMessage(text('conditionEditor.draftBlocked'));
        return;
      }
    }

    onClose();
  }, [
    draftCondition,
    hasValidCondition,
    selectedOption,
    onClose,
    setStatusMessage,
    text,
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

  // 下拉浮层需要逃离 panel 的 transform + overflow 裁切，因此专属宿主必须是 body
  // 直系子节点；dialog 通过 aria-owns 建立可访问性所有权，焦点陷阱则显式合并两棵 DOM。
  useEffect(() => {
    if (!isOpen) return undefined;
    const host = document.createElement('div');
    host.id = dropdownPortalHostId;
    host.dataset['testid'] = 'condition-editor-dropdown-portal';
    document.body.append(host);
    dropdownPortalHostRef.current = host;
    setDropdownPortalHost(host);

    return () => {
      dropdownPortalHostRef.current = null;
      host.remove();
      setDropdownPortalHost((current) => (current === host ? null : current));
    };
  }, [dropdownPortalHostId, isOpen]);

  // 对话框键盘语义、焦点陷阱与关闭后焦点恢复。
  useEffect(() => {
    if (!isOpen) return;
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const focusTimer = window.setTimeout(() => {
      const activeElement = document.activeElement;
      const focusIsAlreadyOwned = activeElement instanceof HTMLElement && (
        dialogRef.current?.contains(activeElement)
        || dropdownPortalHostRef.current?.contains(activeElement)
      );
      if (!focusIsAlreadyOwned) (closeButtonRef.current ?? dialogRef.current)?.focus();
    }, 0);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusSelector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusable = [dialogRef.current, dropdownPortalHostRef.current]
        .filter((root): root is HTMLDivElement => root !== null)
        .flatMap((root) => [...root.querySelectorAll<HTMLElement>(focusSelector)])
        .filter((element) => !element.hasAttribute('hidden'));
      if (focusable.length === 0) {
        e.preventDefault();
        dialogRef.current.focus();
        return;
      }
      e.preventDefault();
      const currentIndex = focusable.findIndex((element) => element === document.activeElement);
      const nextIndex = e.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      focusable[nextIndex]?.focus();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKey);
      const opener = openerRef.current;
      if (opener?.isConnected) window.setTimeout(() => opener.focus(), 0);
    };
  }, [isOpen, onClose]);

  // ==========================================================================
  // 面板关闭时不渲染
  // ==========================================================================

  if (!isOpen) return null;

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <DropdownPortalHostContext.Provider value={dropdownPortalHost}>
      {/* 半透明遮罩层 (M3-01) */}
      <div style={backdropStyle} onClick={handleBackdropClick} aria-hidden="true" />

      {/* 弹出面板 */}
      <div
        ref={dialogRef}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="condition-editor-title"
        aria-owns={dropdownPortalHostId}
        tabIndex={-1}
      >
        {/* ================================================================
        标题栏 (M3-01)
        ================================================================ */}
        <div style={headerStyle}>
          <h2 id="condition-editor-title" style={titleStyle}>{text('conditionEditor.title')}</h2>
          <div style={headerActionsStyle}>
            {nodeId && optionIndex !== undefined && (
              <span style={contextBadgeStyle}>
                {text('conditionEditor.optionContext', { nodeId, index: optionIndex + 1 })}
              </span>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              style={closeButtonStyle}
              onClick={handleCancel}
              title={text('conditionEditor.closeShortcut')}
              aria-label={text('conditionEditor.close')}
            >
              &#x2715;
            </button>
          </div>
        </div>

        {/* ================================================================
        条件构建区
        ================================================================ */}
        <div style={bodyStyle}>
          <ConditionTreeEditor
            value={draftCondition}
            variables={variables}
            onChange={setDraftCondition}
            allowClear={false}
            testId="condition-editor-tree"
          />
        </div>

        {/* ================================================================
        表达式预览 (M3-06)
        ================================================================ */}
        <div style={previewStyle}>
          <span style={previewLabelStyle}>{text('conditionEditor.preview')}</span>
          <code style={previewCodeStyle}>
            {previewExpression || (
              <span style={previewPlaceholderStyle}>{text('conditionEditor.previewPlaceholder')}</span>
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
            {text('common.cancel')}
          </button>
          <button
            type="button"
            style={{
              ...applyButtonStyle,
              ...(!hasValidCondition ? applyButtonDisabledStyle : {}),
            }}
            onClick={handleApply}
            disabled={!hasValidCondition}
          >
            {text('conditionEditor.apply')}
          </button>
        </div>

      </div>
    </DropdownPortalHostContext.Provider>
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
  const text = useAppText();
  return (
    <button
      type="button"
      onClick={onClick}
      title={text(hasCondition ? 'conditionEditor.editCondition' : 'conditionEditor.addConditionTitle')}
      style={{
        ...triggerButtonStyle,
        ...(hasCondition ? triggerActiveStyle : {}),
        ...style,
      }}
    >
      <span style={{ fontSize: '13px', lineHeight: 1 }}>
        {hasCondition ? '🔧' : '🔧'}
      </span>
      <span style={triggerLabelStyle}>{text('conditionEditor.condition')}</span>
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
  zIndex: 'var(--z-modal)',
  background: 'var(--color-overlay-modal)',
};

// -------- Panel --------

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 'calc(var(--z-modal) + 1)',
  width: '640px',
  maxWidth: 'calc(100vw - 48px)',
  maxHeight: 'calc(100vh - 80px)',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--color-bg-primary)',
  borderRadius: 'var(--radius-lg, 8px)',
  boxShadow: 'var(--shadow-xl)',
  border: '1px solid var(--color-border-default)',
  overflow: 'hidden',
};

// -------- Header --------

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  background: 'var(--color-bg-secondary)',
  borderBottom: '1px solid var(--color-border-default)',
  flexShrink: 0,
  userSelect: 'none',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-sm, 14px)',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
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
  background: 'var(--color-bg-tertiary)',
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
};

const closeButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '14px',
  color: 'var(--color-text-muted)',
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
  color: 'var(--color-text-muted)',
  fontSize: 'var(--text-sm, 14px)',
  gap: '4px',
};

const emptyVarsHintStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-text-muted)',
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
  background: 'var(--color-bg-tertiary)',
  borderBottom: '1px solid var(--color-border-default)',
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
  border: '1px solid var(--color-border-default)',
};

const operatorToggleBtnStyle: React.CSSProperties = {
  border: 'none',
  cursor: 'pointer',
  padding: '3px 12px',
  fontSize: '11px',
  fontWeight: 600,
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-secondary)',
  transition: 'background 0.1s ease, color 0.1s ease',
};

const operatorToggleActiveStyle: React.CSSProperties = {
  color: 'var(--color-text-on-accent)',
};

const removeGroupButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '12px',
  color: 'var(--color-text-muted)',
  padding: '2px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  lineHeight: 1,
};

// -------- Condition Row --------

const conditionRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 'var(--space-2, 8px)',
  marginBottom: 'var(--space-2, 8px)',
};

const rightOperandStyle: React.CSSProperties = {
  flex: '1 1 180px',
  minWidth: 150,
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1, 4px)',
};

const operandTypeSelectStyle: React.CSSProperties = {
  width: 54,
  flexShrink: 0,
  height: '28px',
  padding: '4px 2px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

const conditionTreeStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
};

const conditionTreeCompactStyle: React.CSSProperties = {
  fontSize: '11px',
};

const clearConditionButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  cursor: 'pointer',
  padding: '4px 2px',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

const dragHandleStyle: React.CSSProperties = {
  flexShrink: 0,
  color: 'var(--color-text-muted)',
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
  color: 'var(--color-text-muted)',
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
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  cursor: 'pointer',
  textAlign: 'left',
  lineHeight: '20px',
};

const dropdownMenuStyle: React.CSSProperties = {
  position: 'fixed',
  margin: 0,
  minWidth: 0,
  maxHeight: '220px',
  overflowY: 'auto',
  background: 'var(--color-bg-primary)',
  border: '1px solid var(--color-border-default)',
  borderRadius: 'var(--radius-md, 4px)',
  boxShadow: 'var(--shadow-md)',
  // Portaled menus must remain above the Condition Editor modal panel while
  // retaining the shared dropdown layer as the semantic baseline.
  zIndex: 'max(var(--z-dropdown), calc(var(--z-modal) + 2))',
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
  color: 'var(--color-text-primary)',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  cursor: 'pointer',
  textAlign: 'left',
  lineHeight: '18px',
};

const dropdownItemActiveStyle: React.CSSProperties = {
  background: 'var(--color-accent-subtle)',
};

const emptyOptionStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '11px',
  color: 'var(--color-text-muted)',
  textAlign: 'center',
};

const chevronStyle: React.CSSProperties = {
  fontSize: '8px',
  color: 'var(--color-text-muted)',
  marginLeft: 'auto',
  lineHeight: 1,
};

const placeholderStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
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
  color: 'var(--color-accent)',
  background: 'var(--color-accent-subtle)',
  borderRadius: 'var(--radius-sm, 2px)',
};

const typeLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-text-muted)',
  flexShrink: 0,
};

const noVarsHintStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: '11px',
  color: 'var(--color-text-muted)',
  textAlign: 'center',
  borderTop: '1px solid var(--color-border-default)',
};

// -------- Search --------

const searchContainerStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--color-border-default)',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm, 2px)',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
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
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
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
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
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
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-tertiary)',
  color: 'var(--color-text-muted)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
};

// -------- Add Buttons --------

const addRowButtonStyle: React.CSSProperties = {
  border: '1px dashed var(--color-border-default)',
  background: 'transparent',
  cursor: 'pointer',
  padding: '3px 10px',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  color: 'var(--color-text-secondary)',
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
  color: 'var(--color-text-muted)',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

// -------- Preview --------

const previewStyle: React.CSSProperties = {
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  borderTop: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-secondary)',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-2, 8px)',
  flexShrink: 0,
};

const previewLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  flexShrink: 0,
  lineHeight: '20px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

const previewCodeStyle: React.CSSProperties = {
  flex: 1,
  fontSize: '12px',
  fontFamily: 'var(--font-editor, Consolas, monospace)',
  color: 'var(--color-syntax-condition)',
  wordBreak: 'break-all',
  lineHeight: '20px',
};

const previewPlaceholderStyle: React.CSSProperties = {
  color: 'var(--color-text-muted)',
  fontStyle: 'italic',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
};

// -------- Footer --------

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--space-2, 8px)',
  padding: 'var(--space-3, 12px) var(--space-4, 16px)',
  borderTop: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-secondary)',
  flexShrink: 0,
};

const cancelButtonStyle: React.CSSProperties = {
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  cursor: 'pointer',
  padding: '6px 16px',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  fontWeight: 500,
  color: 'var(--color-text-primary)',
  borderRadius: 'var(--radius-md, 4px)',
  lineHeight: '18px',
};

const applyButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'var(--color-accent)',
  cursor: 'pointer',
  padding: '6px 20px',
  fontSize: '12px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  fontWeight: 600,
  color: 'var(--color-text-on-accent)',
  borderRadius: 'var(--radius-md, 4px)',
  lineHeight: '18px',
};

const applyButtonDisabledStyle: React.CSSProperties = {
  background: 'var(--color-bg-tertiary)',
  color: 'var(--color-text-muted)',
  cursor: 'not-allowed',
};

// -------- Trigger Button (M3-08) --------

const triggerButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  border: '1px solid var(--color-border-default)',
  background: 'var(--color-bg-primary)',
  cursor: 'pointer',
  padding: '1px 6px',
  borderRadius: 'var(--radius-sm, 2px)',
  fontSize: '11px',
  fontFamily: 'var(--font-ui, system-ui, sans-serif)',
  color: 'var(--color-text-muted)',
  lineHeight: '18px',
  transition: 'background 0.1s ease, color 0.1s ease, border-color 0.1s ease',
  userSelect: 'none',
};

const triggerActiveStyle: React.CSSProperties = {
  color: 'var(--color-syntax-condition)',
  borderColor: 'var(--color-syntax-condition)',
  background: 'var(--color-accent-subtle)',
};

const triggerLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 500,
};
