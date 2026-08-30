/**
 * ConditionEditor modal wrapper and inline trigger.
 *
 * The reusable tree and dropdown controls live in components/condition so
 * Graph Lab and Split continue to share one interaction implementation.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ConditionNode, VariableDeclaration } from '@plotflow/core';
import { graphEditService } from '../../services/graphEditService';
import { useAppText } from '../../i18n/appI18n';
import { useStoryStore, useUIStore } from '../../stores';
import { DropdownPortalHostContext } from '../condition/ConditionEditorControls';
import {
  ConditionTreeEditor,
  serializeConditionExpression,
} from '../condition/ConditionTreeEditor';
import {
  applyButtonDisabledStyle,
  applyButtonStyle,
  backdropStyle,
  bodyStyle,
  cancelButtonStyle,
  closeButtonStyle,
  contextBadgeStyle,
  footerStyle,
  headerActionsStyle,
  headerStyle,
  panelStyle,
  previewCodeStyle,
  previewLabelStyle,
  previewPlaceholderStyle,
  previewStyle,
  titleStyle,
  triggerActiveStyle,
  triggerButtonStyle,
  triggerLabelStyle,
} from '../condition/conditionEditorStyles';

export {
  ConditionTreeEditor,
  builderToConditionNode,
  conditionNodeToBuilder,
  serializeConditionExpression,
  type ConditionGroup,
  type ConditionRow,
  type ConditionTreeEditorProps,
} from '../condition/ConditionTreeEditor';

export interface ConditionEditorProps {
  readonly nodeId?: string;
  readonly optionIndex?: number;
  readonly onClose: () => void;
}

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
    () =>
      (plotFlowData?.variables ?? []).filter(
        (variable) =>
          variable.scope !== 'chapter' || variable.chapterId === selectedNode?.chapterId,
      ),
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
    const expression = hasValidCondition ? serializeConditionExpression(draftCondition) : '';

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
  }, [draftCondition, hasValidCondition, selectedOption, onClose, setStatusMessage, text]);

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
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => {
      const activeElement = document.activeElement;
      const focusIsAlreadyOwned =
        activeElement instanceof HTMLElement &&
        (dialogRef.current?.contains(activeElement) ||
          dropdownPortalHostRef.current?.contains(activeElement));
      if (!focusIsAlreadyOwned) (closeButtonRef.current ?? dialogRef.current)?.focus();
    }, 0);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusSelector =
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
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
        ? currentIndex <= 0
          ? focusable.length - 1
          : currentIndex - 1
        : currentIndex < 0 || currentIndex === focusable.length - 1
          ? 0
          : currentIndex + 1;
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
        data-condition-editor="true"
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
          <h2 id="condition-editor-title" style={titleStyle}>
            {text('conditionEditor.title')}
          </h2>
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
            onChange={(next) => {
              setDraftCondition(next);
              return true;
            }}
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
              <span style={previewPlaceholderStyle}>
                {text('conditionEditor.previewPlaceholder')}
              </span>
            )}
          </code>
        </div>

        {/* ================================================================
        操作按钮
        ================================================================ */}
        <div style={footerStyle}>
          <button type="button" style={cancelButtonStyle} onClick={handleCancel}>
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
      title={text(
        hasCondition ? 'conditionEditor.editCondition' : 'conditionEditor.addConditionTitle',
      )}
      style={{
        ...triggerButtonStyle,
        ...(hasCondition ? triggerActiveStyle : {}),
        ...style,
      }}
    >
      <span style={{ fontSize: '13px', lineHeight: 1 }}>{hasCondition ? '🔧' : '🔧'}</span>
      <span style={triggerLabelStyle}>{text('conditionEditor.condition')}</span>
    </button>
  );
}
