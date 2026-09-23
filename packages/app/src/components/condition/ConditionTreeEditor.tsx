import { useEditorStore } from '../../stores/editorStore';
/**
 * Shared condition-tree editor used by Graph Lab and the modal condition panel.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ComparisonOperator,
  ConditionNode,
  VariableDeclaration,
  VariableType,
} from '@plotflow/core';
import { useAppText } from '../../i18n/appI18n';
import { parseCondition } from '@plotflow/core';
import { useInspectorDraft } from '../../hooks/useInspectorDraft';
import {
  LOGIC_GROUP_COLORS,
  OperatorDropdown,
  ValueInput,
  VariableDropdown,
  findVariableDeclaration,
  getOperatorsForType,
} from './ConditionEditorControls';
import {
  addGroupButtonStyle,
  addRowButtonStyle,
  clearConditionButtonStyle,
  conditionRowStyle,
  conditionTreeCompactStyle,
  conditionTreeStyle,
  emptyVarsHintStyle,
  emptyVarsStyle,
  groupActionsStyle,
  groupBodyStyle,
  groupContainerStyle,
  groupHeaderStyle,
  maxDepthHintStyle,
  operandTypeSelectStyle,
  operatorToggleActiveStyle,
  operatorToggleBtnStyle,
  operatorToggleStyle,
  removeGroupButtonStyle,
  removeRowButtonStyle,
  rightOperandStyle,
} from './conditionEditorStyles';
import {
  MAX_NESTING_DEPTH,
  isConditionDraftComplete,
  builderToConditionNode,
  conditionNodeToBuilder,
  createConditionId,
  createEmptyConditionGroup,
  createEmptyConditionRow,
  serializeConditionExpression,
  type ConditionGroup,
  type ConditionRow,
} from './conditionEditorModel';

export {
  builderToConditionNode,
  conditionNodeToBuilder,
  serializeConditionExpression,
  type ConditionGroup,
  type ConditionRow,
} from './conditionEditorModel';

interface ConditionRowViewProps {
  readonly row: ConditionRow;
  readonly variables: readonly VariableDeclaration[];
  readonly onUpdate: (row: ConditionRow) => void;
  readonly onRemove: () => void;
  readonly canRemove: boolean;
  readonly advanced?: boolean;
}

function ConditionRowView({
  row,
  variables,
  onUpdate,
  onRemove,
  canRemove,
  advanced = true,
}: ConditionRowViewProps): React.ReactElement {
  const text = useAppText();
  const leftVariable =
    row.leftOperandType === 'variable'
      ? findVariableDeclaration(row.variableName, variables)
      : null;
  const rightVariable =
    row.rightOperandType === 'variable' ? findVariableDeclaration(row.value, variables) : null;
  const variableType = leftVariable?.type ?? rightVariable?.type ?? null;
  const availableOps = useMemo(() => getOperatorsForType(variableType), [variableType]);

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
      {/* 左操作数：变量或类型化字面值 */}
      <div
        style={
          advanced ? rightOperandStyle : { ...rightOperandStyle, flex: '1 1 70px', minWidth: 64 }
        }
      >
        <select
          hidden={!advanced}
          aria-label={text('conditionEditor.leftOperandType')}
          value={row.leftOperandType}
          onChange={(event) =>
            onUpdate({
              ...row,
              leftOperandType: event.target.value as ConditionRow['leftOperandType'],
              variableName: '',
            })
          }
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
                onChange={(event) =>
                  onUpdate({
                    ...row,
                    leftLiteralType: event.target.value as ConditionRow['leftLiteralType'],
                    variableName: '',
                  })
                }
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
      <div
        style={
          advanced ? rightOperandStyle : { ...rightOperandStyle, flex: '1 1 70px', minWidth: 64 }
        }
      >
        <select
          hidden={!advanced}
          aria-label={text('conditionEditor.rightOperandType')}
          value={row.rightOperandType}
          onChange={(event) =>
            onUpdate({
              ...row,
              rightOperandType: event.target.value as ConditionRow['rightOperandType'],
              value: '',
            })
          }
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
                onChange={(event) =>
                  onUpdate({
                    ...row,
                    rightLiteralType: event.target.value as ConditionRow['rightLiteralType'],
                    value: '',
                  })
                }
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
  readonly advanced?: boolean;
}

function ConditionGroupView({
  group,
  variables,
  depth,
  onUpdate,
  onRemove,
  advanced = true,
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
      id: createConditionId(),
      operator: 'AND',
      rows: [createEmptyConditionRow()],
      groups: [],
    };
    onUpdate({ ...group, groups: [...group.groups, newGroup] });
  }, [group, onUpdate, depth]);

  const handleAddOrGroup = useCallback(() => {
    if (depth >= MAX_NESTING_DEPTH) return;
    const newGroup: ConditionGroup = {
      id: createConditionId(),
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
        ...(!advanced ? { border: 0, marginBottom: 0 } : {}),
      }}
    >
      {/* 组头 */}
      <div
        style={{
          ...groupHeaderStyle,
          display: !advanced && group.rows.length < 2 ? 'none' : 'flex',
        }}
      >
        {/* AND/OR 切换 */}
        <div
          style={operatorToggleStyle}
          role="group"
          aria-label={text('conditionEditor.groupOperator')}
        >
          <button
            type="button"
            style={{
              ...operatorToggleBtnStyle,
              ...(group.operator === 'AND'
                ? {
                    ...operatorToggleActiveStyle,
                    background: LOGIC_GROUP_COLORS.AND,
                    color: 'var(--color-text-on-accent)',
                  }
                : {}),
            }}
            onClick={() => onUpdate({ ...group, operator: 'AND' })}
            aria-pressed={group.operator === 'AND'}
          >
            {text('ux.all')}
          </button>
          <button
            type="button"
            style={{
              ...operatorToggleBtnStyle,
              ...(group.operator === 'OR'
                ? {
                    ...operatorToggleActiveStyle,
                    background: LOGIC_GROUP_COLORS.OR,
                    color: 'var(--color-text-on-accent)',
                  }
                : {}),
            }}
            onClick={() => onUpdate({ ...group, operator: 'OR' })}
            aria-pressed={group.operator === 'OR'}
          >
            {text('ux.any')}
          </button>
          <button
            type="button"
            style={{
              ...operatorToggleBtnStyle,
              ...(group.operator === 'NOT'
                ? {
                    ...operatorToggleActiveStyle,
                    background: LOGIC_GROUP_COLORS.NOT,
                    color: 'var(--color-text-on-accent)',
                  }
                : {}),
            }}
            onClick={() => onUpdate({ ...group, operator: 'NOT' })}
            aria-pressed={group.operator === 'NOT'}
            title={text('conditionEditor.negateGroup')}
          >
            {text('ux.not')}
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
            advanced={advanced}
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
        {canNest && advanced && (
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
  readonly onChange: (value: ConditionNode | null) => boolean;
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
  const [rootGroup, setRootGroup] = useState<ConditionGroup>(() =>
    value ? conditionNodeToBuilder(value) : createEmptyConditionGroup(),
  );
  const [commitRejected, setCommitRejected] = useState(false);
  const [advanced, setAdvanced] = useState(!compact);
  const requiresAdvanced =
    rootGroup.operator === 'NOT' ||
    rootGroup.groups.length > 0 ||
    rootGroup.rows.some(
      (row) => row.leftOperandType === 'literal' || row.rightOperandType === 'variable',
    );
  const lastEmittedSignatureRef = useRef<string | null>(null);
  const hasUncommittedDraft = useRef(false);
  const composing = useRef(false);
  const currentGroup = useRef(rootGroup);
  const externalSignature = useMemo(() => serializeConditionExpression(value), [value]);

  useEffect(() => {
    if (lastEmittedSignatureRef.current === externalSignature) {
      lastEmittedSignatureRef.current = null;
      return;
    }
    setCommitRejected(false);
    hasUncommittedDraft.current = false;
    setRootGroup(value ? conditionNodeToBuilder(value) : createEmptyConditionGroup());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSignature]);

  const handleUpdate = useCallback(
    (nextGroup: ConditionGroup) => {
      useEditorStore.getState().bumpSourceDraftRevision();
      currentGroup.current = nextGroup;
      if (composing.current) {
        setRootGroup(nextGroup);
        hasUncommittedDraft.current = true;
        return;
      }
      const nextValue = builderToConditionNode(nextGroup, variables);
      // 半成品不是“清除条件”。只有明确点击清除时才向上层发送 null，
      // 避免 Inspector 在用户切换变量、尚未输入值的瞬间删除现有条件。
      hasUncommittedDraft.current = true;
      if (!nextValue || !isConditionDraftComplete(nextGroup, variables)) {
        setCommitRejected(false);
        setRootGroup(nextGroup);
        return;
      }
      setRootGroup(nextGroup);
      if (!parseCondition(serializeConditionExpression(nextValue), variables).ok) {
        setCommitRejected(true);
        return;
      }
      if (!onChange(nextValue)) {
        setCommitRejected(true);
        return;
      }
      setCommitRejected(false);
      hasUncommittedDraft.current = false;
      lastEmittedSignatureRef.current = serializeConditionExpression(nextValue);
    },
    [onChange, variables],
  );

  useInspectorDraft(
    () => {
      if (!hasUncommittedDraft.current) return true;
      setCommitRejected(true);
      return false;
    },
    () => hasUncommittedDraft.current,
  );

  const handleClear = useCallback(() => {
    if (!onChange(null)) {
      setCommitRejected(true);
      return;
    }
    setCommitRejected(false);
    hasUncommittedDraft.current = false;
    lastEmittedSignatureRef.current = '';
    setRootGroup(createEmptyConditionGroup());
  }, [onChange]);

  return (
    <div
      data-testid={testId}
      onCompositionStartCapture={() => {
        composing.current = true;
      }}
      onCompositionEndCapture={() => {
        composing.current = false;
        queueMicrotask(() => handleUpdate(currentGroup.current));
      }}
      style={{
        ...conditionTreeStyle,
        ...(compact ? conditionTreeCompactStyle : {}),
      }}
    >
      {variables.length === 0 ? (
        <div style={emptyVarsStyle} role="status">
          <span aria-hidden="true" style={{ fontSize: '24px', marginBottom: '8px' }}>
            &#x1F4CB;
          </span>
          <span>{text('conditionEditor.noVariables')}</span>
          <span style={emptyVarsHintStyle}>{text('conditionEditor.noVariablesHint')}</span>
        </div>
      ) : (
        <>
          <ConditionGroupView
            group={rootGroup}
            advanced={advanced || requiresAdvanced}
            variables={variables}
            depth={0}
            onUpdate={handleUpdate}
          />
          {compact && (
            <button
              type="button"
              className="ux-text-button"
              aria-expanded={advanced || requiresAdvanced}
              disabled={requiresAdvanced}
              onClick={() => setAdvanced(!advanced)}
            >
              {text(advanced || requiresAdvanced ? 'ux.simpleConditions' : 'ux.advancedConditions')}
            </button>
          )}
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
          {commitRejected && (
            <div role="alert" className="ux-error">
              {text('ux.invalidValue')}
              <button
                type="button"
                className="ux-text-button"
                onClick={() => {
                  setRootGroup(value ? conditionNodeToBuilder(value) : createEmptyConditionGroup());
                  hasUncommittedDraft.current = false;
                  setCommitRejected(false);
                }}
              >
                {text('ux.discardDraft')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// 主组件：ConditionEditor
// ============================================================================
