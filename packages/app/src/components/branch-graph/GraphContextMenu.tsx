/**
 * GraphContextMenu — 分支图右键菜单组件 (M2-10)
 *
 * 职责：在分支图上右键单击节点或空白区域时，显示对应的上下文菜单。
 *
 * 节点右键菜单：
 *   - 跳转到编辑器：滚动编辑器到节点所在行
 *   - 重命名：弹出对话框修改节点标题，同步到编辑器文本
 *   - 添加选项：在节点末尾插入新的 [选项] 行
 *   - 删除节点：弹出确认对话框，从编辑器文本中移除节点全部内容
 *
 * 空白区域右键菜单：
 *   - 添加节点：在编辑器末尾插入新节点模板
 *   - 重新布局：重新调用 Dagre 布局引擎计算节点位置
 *
 * 依赖：
 * - 菜单位置由 React Flow 的 onNodeContextMenu / onPaneContextMenu 事件提供
 * - 使用 inline styles + CSS 变量驱动颜色（CLAUDE.md §6.1）
 * - 所有文本修改通过 editorStore.setContent() 触发单向数据流
 *
 * @module components/branch-graph/GraphContextMenu
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useGraphStore } from '../../stores/graphStore';
import { useEditorStore } from '../../stores/editorStore';
import { useStoryStore } from '../../stores/storyStore';
import { useAppText } from '../../i18n/appI18n';
import { useUIStore } from '../../stores/uiStore';
import { NEXT_EDGE_OPTION_INDEX, parseEdgeId } from '../../stores/edgeStore';
import {
  resolveStoryFullIdForFlowNodeId,
  type StoryFlowNodeData,
} from './adapter';
import { graphEditService } from '../../services/graphEditService';

import { layoutNodesInWorker } from './graphLayoutClient';
import type { StoryNode } from '@plotflow/core';

// ============================================================================
// 类型定义
// ============================================================================

/** 右键菜单类型 */
export type ContextMenuType = 'node' | 'pane' | 'edge';

/** 右键菜单位置（屏幕坐标） */
export interface ContextMenuPosition {
  readonly x: number;
  readonly y: number;
}

/** GraphContextMenu 属性 */
export interface GraphContextMenuProps {
  /** 是否打开 */
  readonly isOpen: boolean;
  /** 菜单位置（clientX/clientY 屏幕坐标） */
  readonly position: ContextMenuPosition;
  /** 菜单类型：node = 节点右键，pane = 空白区域右键，edge = 连线右键 */
  readonly type: ContextMenuType;
  /** 右键点击的节点对象（type='node' 时有效，否则为 null） */
  readonly node: Node<StoryFlowNodeData> | null;
  /** 右键点击的连线对象（type='edge' 时有效，否则为 null） */
  readonly edge: Edge | null;
  /** 关闭菜单回调 */
  readonly onClose: (restoreFocus?: boolean) => void;
}

// ============================================================================
// 常量
// ============================================================================

/** 菜单宽度（像素） */
const MENU_WIDTH = 200;

/** 菜单项高度（像素） */
const MENU_ITEM_HEIGHT = 32;

/** 分隔线高度（像素） */
const DIVIDER_HEIGHT = 1;

// ============================================================================
// MenuItem 子组件
// ============================================================================

interface MenuItemProps {
  readonly label: string;
  readonly shortcut?: string;
  readonly danger?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

/**
 * 右键菜单单项。
 *
 * - 悬停时显示背景色
 * - disabled 时显示灰色并禁止点击
 * - danger 时文本为红色（用于删除操作）
 */
const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(function MenuItem({
  label,
  shortcut,
  danger = false,
  disabled = false,
  onClick,
}, ref) {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    if (!disabled) {
      onClick();
    }
  }, [disabled, onClick]);

  return (
    <button
      ref={ref}
      type="button"
      role="menuitem"
      aria-disabled={disabled}
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 12px`,
        border: 0,
        height: MENU_ITEM_HEIGHT,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background:
          hovered && !disabled
            ? 'var(--color-accent-subtle)'
            : 'transparent',
        color: disabled
          ? 'var(--color-text-muted)'
          : danger
            ? 'var(--color-error)'
            : 'var(--color-text-primary)',
        fontSize: 'var(--text-sm, 13px)',
        fontFamily: 'var(--font-ui, system-ui, sans-serif)',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        lineHeight: `${MENU_ITEM_HEIGHT}px`,
        transition: 'background 0.08s ease',
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      {shortcut && (
        <span
          style={{
            marginLeft: 16,
            fontSize: 'var(--text-2xs, 11px)',
            color: 'var(--color-text-muted)',
            flexShrink: 0,
          }}
        >
          {shortcut}
        </span>
      )}
    </button>
  );
});

// ============================================================================
// RenameDialog 子组件
// ============================================================================

interface RenameDialogProps {
  readonly currentTitle: string;
  readonly onConfirm: (newTitle: string) => void;
  readonly onCancel: () => void;
}

/**
 * 重命名对话框。
 *
 * 居中覆盖在画布上方，包含文本输入框预填当前节点标题。
 * 支持 Enter 确认 / ESC 取消。
 */
const RenameDialog: React.FC<RenameDialogProps> = ({
  currentTitle,
  onConfirm,
  onCancel,
}) => {
  const text = useAppText();
  const [value, setValue] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦并选中全部文本
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm(value.trim() || currentTitle);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [value, currentTitle, onConfirm, onCancel],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel],
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-overlay-modal)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
          width: 320,
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-md, 8px)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <label
          style={{
            fontSize: 'var(--text-sm, 13px)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          }}
        >
          {text('graphContext.renameNode')}
        </label>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm, 4px)',
            border: '1px solid var(--color-border-default)',
            background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--text-sm, 13px)',
            fontFamily: 'var(--font-editor, Consolas, monospace)',
            outline: 'none',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            data-testid="graph-confirm-cancel"
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm, 4px)',
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-xs, 12px)',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              cursor: 'pointer',
              lineHeight: '18px',
            }}
          >
            {text('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(value.trim() || currentTitle)}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm, 4px)',
              border: 'none',
              background: 'var(--color-accent)',
              color: 'var(--color-text-on-accent)',
              fontSize: 'var(--text-xs, 12px)',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              cursor: 'pointer',
              fontWeight: 600,
              lineHeight: '18px',
            }}
          >
            {text('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ConfirmDialog 子组件
// ============================================================================

interface ConfirmDialogProps {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * 确认对话框。
 *
 * 用于危险操作（如删除节点）前的二次确认。
 * 支持 ESC 快捷键关闭。
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const text = useAppText();
  const resolvedConfirmLabel = confirmLabel ?? text('common.confirm');
  const resolvedCancelLabel = cancelLabel ?? text('common.cancel');
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onCancel();
      }
    },
    [onCancel],
  );

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-overlay-modal)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
          width: 340,
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-md, 8px)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border-default)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--text-sm, 13px)',
            fontWeight: 600,
            color: danger
              ? 'var(--color-error)'
              : 'var(--color-text-primary)',
            fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 'var(--text-sm, 13px)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-ui, system-ui, sans-serif)',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
          }}
        >
          {message}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm, 4px)',
              border: '1px solid var(--color-border-default)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--text-xs, 12px)',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              cursor: 'pointer',
              lineHeight: '18px',
            }}
          >
          {resolvedCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            data-testid="graph-confirm-primary"
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm, 4px)',
              border: 'none',
              background: danger
                ? 'var(--color-error)'
                : 'var(--color-accent)',
              color: 'var(--color-text-on-accent)',
              fontSize: 'var(--text-xs, 12px)',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              cursor: 'pointer',
              fontWeight: 600,
              lineHeight: '18px',
            }}
          >
          {resolvedConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// GraphContextMenu 主组件
// ============================================================================

/**
 * GraphContextMenu — 分支图右键菜单。
 *
 * 特性：
 * - 节点右键菜单：跳转到编辑器、重命名、添加选项、删除节点（含确认）
 * - 空白区域右键菜单：添加节点、重新布局
 * - 菜单跟随鼠标位置，自动避开视口边缘
 * - 点击菜单外部或按 ESC 关闭
 * - 在菜单关闭后，重命名/删除会弹出独立对话框
 */
export function GraphContextMenu({
  isOpen,
  position,
  type,
  node,
  edge,
  onClose,
}: GraphContextMenuProps): React.ReactElement | null {
  // ==========================================================================
  // Store 订阅
  // ==========================================================================

  const editorInstance = useEditorStore((s) => s.editorInstance);
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);
  const plotFlowData = useStoryStore((s) => s.plotFlowData);
  const getNodeByFullId = useStoryStore((s) => s.getNodeByFullId);
  const graphNodes = useGraphStore((s) => s.nodes);
  const graphEdges = useGraphStore((s) => s.edges);
  const setNodes = useGraphStore((s) => s.setNodes);
  const setStatusMessage = useUIStore((s) => s.setStatusMessage);
  const openConditionEditor = useUIStore((s) => s.openConditionEditor);
  const text = useAppText();

  // ==========================================================================
  // 内部状态
  // ==========================================================================

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!isOpen || showRenameDialog || showDeleteDialog) return;
    const frame = requestAnimationFrame(() => {
      itemRefs.current.find((item) => item && !item.disabled)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen, showDeleteDialog, showRenameDialog, type]);

  // ==========================================================================
  // 副作用：点击菜单外部关闭
  // ==========================================================================

  useEffect(() => {
    if (!isOpen) return;

    let cleanupListener: (() => void) | null = null;

    const timerId = setTimeout(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          menuRef.current &&
          target &&
          !menuRef.current.contains(target)
        ) {
          onClose(true);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      cleanupListener = () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timerId);
      cleanupListener?.();
    };
  }, [isOpen, onClose]);

  // ==========================================================================
  // 副作用：ESC 关闭（仅在无对话框时生效）
  // ==========================================================================

  useEffect(() => {
    if (!isOpen || showRenameDialog || showDeleteDialog) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(true);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, showRenameDialog, showDeleteDialog]);

  // ==========================================================================
  // 节点上下文解析
  // ==========================================================================

  const storyNode = useMemo<StoryNode | undefined>(() => {
    if (type !== 'node' || !node || !plotFlowData) return undefined;
    const nodeData = node.data as StoryFlowNodeData | undefined;
    return getNodeByFullId(nodeData?.fullId ?? resolveStoryFullIdForFlowNodeId(node.id, graphNodes));
  }, [type, node, plotFlowData, graphNodes, getNodeByFullId]);

  const isNodeActionDisabled = !storyNode || !plotFlowData;

  const handleMenuKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const enabledItems = itemRefs.current.filter((item): item is HTMLButtonElement => Boolean(item && !item.disabled));
    if (enabledItems.length === 0) return;
    const currentIndex = Math.max(0, enabledItems.indexOf(document.activeElement as HTMLButtonElement));
    let nextIndex: number | null = null;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % enabledItems.length;
    if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = enabledItems.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    enabledItems[nextIndex]?.focus();
  }, []);

  // ==========================================================================
  // 事件处理器：节点菜单
  // ==========================================================================

  /** 跳转到编辑器并定位到节点行 */
  const handleJumpToEditor = useCallback(() => {
    if (!storyNode || !editorInstance) {
      onClose();
      return;
    }
    editorInstance.revealLineInCenter(storyNode.lineNumber);
    editorInstance.setPosition({ lineNumber: storyNode.lineNumber, column: 1 });
    editorInstance.focus();
    setCursorPosition(storyNode.lineNumber, 1);
    setStatusMessage(text('graphContext.jumpedToNode', { title: storyNode.title }));
    onClose();
  }, [storyNode, editorInstance, setCursorPosition, setStatusMessage, onClose, text]);

  /** 打开重命名对话框 */
  const handleOpenRename = useCallback(() => {
    if (!storyNode) return;
    onClose();
    // 微延迟确保上下文菜单 DOM 已清理后再显示对话框
    setTimeout(() => setShowRenameDialog(true), 50);
  }, [storyNode, onClose]);

  /** 执行重命名：替换编辑器文本中的标题行 */
  const handleRenameConfirm = useCallback(
    (newTitle: string) => {
      if (!storyNode) return;

      if (graphEditService.updateNode(storyNode, { title: newTitle })) {
        setStatusMessage(text('graphContext.renamedNode', { title: newTitle }));
      }
      setShowRenameDialog(false);
    },
    [storyNode, setStatusMessage, text],
  );

  /** 关闭重命名对话框 */
  const handleRenameCancel = useCallback(() => {
    setShowRenameDialog(false);
  }, []);

  /** 在节点末尾添加新选项行 */
  const handleAddOption = useCallback(() => {
    if (!storyNode) {
      onClose();
      return;
    }

    if (graphEditService.addOption(storyNode, {
      description: text('graphContext.newOption'),
      targetNodeId: text('graphContext.chooseTarget'),
    })) {
      setStatusMessage(text('graphContext.addedOption', { title: storyNode.title }));
    }
    onClose();
  }, [storyNode, setStatusMessage, onClose, text]);

  /** 打开删除确认对话框 */
  const handleOpenDelete = useCallback(() => {
    if (!storyNode) return;
    onClose();
    setTimeout(() => setShowDeleteDialog(true), 50);
  }, [storyNode, onClose]);

  /** 执行删除：从编辑器文本中移除节点全部行 */
  const handleDeleteConfirm = useCallback(() => {
    if (!storyNode) {
      setStatusMessage(text('graphContext.deleteMissingNode'));
      setShowDeleteDialog(false);
      return;
    }

    try {
      if (graphEditService.deleteNode(storyNode)) {
        setStatusMessage(text('graphContext.deletedNode', { title: storyNode.title }));
      } else {
        setStatusMessage(text('graphContext.deleteUnchanged', { title: storyNode.title }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatusMessage(text('graphContext.deleteFailed', { detail: message }));
    }
    setShowDeleteDialog(false);
  }, [storyNode, setStatusMessage, text]);

  /** 关闭删除对话框 */
  const handleDeleteCancel = useCallback(() => {
    setShowDeleteDialog(false);
  }, []);

  // ==========================================================================
  // 事件处理器：空白区域菜单
  // ==========================================================================

  /** 在编辑器末尾插入新节点模板 */
  const handleAddNode = useCallback(() => {
    if (graphEditService.createNode({
      title: text('graphContext.newNodeTitle'),
      body: text('graphContext.newNodeBody'),
    })) {
      setStatusMessage(text('graphContext.addedNode'));
    }
    onClose();
  }, [setStatusMessage, onClose, text]);

  /** 重新调用 Dagre 布局 */
  const handleRelayout = useCallback(() => {
    if (graphNodes.length === 0) {
      setStatusMessage(text('graphContext.noLayoutNodes'));
      onClose();
      return;
    }
    void layoutNodesInWorker(graphNodes, graphEdges)
      .then((result) => {
        if (result.stale) return;
        setNodes(result.nodes);
        setStatusMessage(text('graphContext.layoutComplete'));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatusMessage(message);
      });
    onClose();
  }, [graphNodes, graphEdges, setNodes, setStatusMessage, onClose, text]);

  // ==========================================================================
  // 事件处理器：连线右键菜单 (V02-015)
  // ==========================================================================

  /** 解析 edge prop 为 sourceFullId + targetFullId + optionIndex */
  const edgeParsed = useMemo(() => {
    if (type !== 'edge' || !edge) return null;
    try {
      return parseEdgeId(edge.id);
    } catch {
      return null;
    }
  }, [type, edge]);

  const edgeStoryIds = useMemo(() => {
    if (!edgeParsed) return null;
    return {
      sourceFullId: resolveStoryFullIdForFlowNodeId(edgeParsed.sourceFullId, graphNodes),
      targetFullId: resolveStoryFullIdForFlowNodeId(edgeParsed.targetFullId, graphNodes),
      optionIndex: edgeParsed.optionIndex,
    };
  }, [edgeParsed, graphNodes]);

  /** 连线 → 编辑条件：打开 ConditionEditor 面板 (Fix 8) */
  const handleEdgeEditCondition = useCallback(() => {
    if (!edgeStoryIds) { onClose(); return; }
    if (edgeStoryIds.optionIndex === NEXT_EDGE_OPTION_INDEX) { onClose(); return; }
    openConditionEditor(edgeStoryIds.sourceFullId, edgeStoryIds.optionIndex);
    onClose();
  }, [edgeStoryIds, openConditionEditor, onClose]);

  /** 连线 → 删除连线：移除 -> 节点：XXX 文本 */
  const handleEdgeDelete = useCallback(() => {
    if (!edgeStoryIds || !plotFlowData) { onClose(); return; }
    const sourceNode = getNodeByFullId(edgeStoryIds.sourceFullId);
    if (!sourceNode) { onClose(); return; }

    if (edgeStoryIds.optionIndex === NEXT_EDGE_OPTION_INDEX) {
      if (graphEditService.connectNextTarget(sourceNode, null)) {
        setStatusMessage(text('graphContext.deletedNextEdge', { title: sourceNode.title }));
      }
      onClose();
      return;
    }

    const option = sourceNode.options[edgeStoryIds.optionIndex];
    if (!option) { onClose(); return; }

    if (graphEditService.connectOption(option, null)) {
      setStatusMessage(text('graphContext.deletedOptionEdge', {
        title: sourceNode.title,
        index: edgeStoryIds.optionIndex + 1,
      }));
    }
    onClose();
  }, [edgeStoryIds, plotFlowData, getNodeByFullId, setStatusMessage, onClose, text]);

  /** 连线 → 跳转到源节点 */
  const handleEdgeJumpToSource = useCallback(() => {
    if (!edgeStoryIds || !editorInstance) { onClose(); return; }
    const sourceNode = getNodeByFullId(edgeStoryIds.sourceFullId);
    if (sourceNode) {
      editorInstance.revealLineInCenter(sourceNode.lineNumber);
      editorInstance.setPosition({ lineNumber: sourceNode.lineNumber, column: 1 });
      editorInstance.focus();
      setCursorPosition(sourceNode.lineNumber, 1);
      setStatusMessage(text('graphContext.jumpedToSource', { title: sourceNode.title }));
    }
    onClose();
  }, [edgeStoryIds, editorInstance, getNodeByFullId, setCursorPosition, setStatusMessage, onClose, text]);

  /** 连线 → 跳转到目标节点 */
  const handleEdgeJumpToTarget = useCallback(() => {
    if (!edgeStoryIds || !editorInstance) { onClose(); return; }
    const targetNode = getNodeByFullId(edgeStoryIds.targetFullId);
    if (targetNode) {
      editorInstance.revealLineInCenter(targetNode.lineNumber);
      editorInstance.setPosition({ lineNumber: targetNode.lineNumber, column: 1 });
      editorInstance.focus();
      setCursorPosition(targetNode.lineNumber, 1);
      setStatusMessage(text('graphContext.jumpedToTarget', { title: targetNode.title }));
    }
    onClose();
  }, [edgeStoryIds, editorInstance, getNodeByFullId, setCursorPosition, setStatusMessage, onClose, text]);

  // ==========================================================================
  // 菜单位置微调：防止溢出视口边缘
  // ==========================================================================

  const adjustedPosition = useMemo(() => {
    const nodeMenuItemsCount = 4; // 跳转、重命名、添加选项、删除 + 2 分隔线
    const paneMenuItemsCount = 3; // 添加、布局、导出
    const edgeMenuItemsCount = 4; // 编辑条件、删除连线、跳转源节点、跳转目标节点
    let itemsCount: number;
    if (type === 'node') itemsCount = nodeMenuItemsCount;
    else if (type === 'edge') itemsCount = edgeMenuItemsCount;
    else itemsCount = paneMenuItemsCount;
    const menuHeight = itemsCount * MENU_ITEM_HEIGHT + 2 * DIVIDER_HEIGHT + 8; // ±4px padding

    return {
      x:
        position.x + MENU_WIDTH > window.innerWidth
          ? window.innerWidth - MENU_WIDTH - 8
          : position.x,
      y:
        position.y + menuHeight > window.innerHeight
          ? window.innerHeight - menuHeight - 8
          : position.y,
    };
  }, [position, type]);

  // ==========================================================================
  // 条件渲染：菜单关闭且无对话框时返回 null
  // ==========================================================================

  if (!isOpen) {
    if (!showRenameDialog && !showDeleteDialog) return null;
  }

  // ==========================================================================
  // 菜单项配置
  // ==========================================================================

  const menuItems: Array<{
    key: string;
    label: string;
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    onClick: () => void;
    showDividerBefore?: boolean;
  }> =
    type === 'node'
      ? [
          {
            key: 'jump',
            label: text('graphContext.jumpToEditor'),
            shortcut: 'Enter',
            disabled: isNodeActionDisabled,
            onClick: handleJumpToEditor,
          },
          {
            key: 'rename',
            label: text('graphContext.rename'),
            disabled: isNodeActionDisabled,
            onClick: handleOpenRename,
          },
          {
            key: 'addOption',
            label: text('graphContext.addOption'),
            disabled: isNodeActionDisabled,
            onClick: handleAddOption,
          },
          {
            key: 'delete',
            label: text('graphContext.deleteNode'),
            danger: true,
            disabled: isNodeActionDisabled,
            onClick: handleOpenDelete,
            showDividerBefore: true, // 在删除前加分隔线
          },
        ]
      : type === 'edge'
        ? [
            {
              key: 'editCondition',
              label: text('graphContext.editCondition'),
              shortcut: text('graphContext.doubleClick'),
              disabled: !edgeStoryIds || !edgeStoryIds.sourceFullId || edgeStoryIds.optionIndex === NEXT_EDGE_OPTION_INDEX,
              onClick: handleEdgeEditCondition,
            },
            {
              key: 'deleteEdge',
              label: text('graphContext.deleteEdge'),
              shortcut: text('graphContext.altClick'),
              danger: true,
              disabled: !edgeStoryIds,
              onClick: handleEdgeDelete,
            },
            {
              key: 'jumpToSource',
              label: text('graphContext.jumpToSource'),
              disabled: !edgeStoryIds || !editorInstance,
              onClick: handleEdgeJumpToSource,
            },
            {
              key: 'jumpToTarget',
              label: text('graphContext.jumpToTarget'),
              disabled: !edgeStoryIds || !editorInstance,
              onClick: handleEdgeJumpToTarget,
            },
          ]
        : [
            {
              key: 'addNode',
              label: text('graphContext.addNode'),
              onClick: handleAddNode,
            },
            {
              key: 'relayout',
              label: text('graphContext.relayout'),
              disabled: graphNodes.length === 0,
              onClick: handleRelayout,
            },
          ];

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <>
      {/* 右键菜单面板 */}
      <div
        ref={menuRef}
        role="menu"
        onKeyDown={handleMenuKeyDown}
        style={{
          position: 'fixed',
          zIndex: 'var(--z-dropdown)',
          top: adjustedPosition.y,
          left: adjustedPosition.x,
          width: MENU_WIDTH,
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-md, 8px)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--color-border-default)',
          padding: '4px 0',
          overflow: 'hidden',
        }}
      >
        {menuItems.map((item, index) => (
          <React.Fragment key={item.key}>
            {item.showDividerBefore && (
              <div
                style={{
                  height: DIVIDER_HEIGHT,
                  margin: '4px 0',
                  background: 'var(--color-border-light)',
                }}
              />
            )}
            <MenuItem
              ref={(element) => { itemRefs.current[index] = element; }}
              label={item.label}
              shortcut={item.shortcut}
              danger={item.danger}
              disabled={item.disabled}
              onClick={item.onClick}
            />
          </React.Fragment>
        ))}
      </div>

      {/* 重命名对话框 */}
      {showRenameDialog && storyNode && (
        <RenameDialog
          currentTitle={storyNode.title}
          onConfirm={handleRenameConfirm}
          onCancel={handleRenameCancel}
        />
      )}

      {/* 删除确认对话框 */}
      {showDeleteDialog && storyNode && (
        <ConfirmDialog
          title={text('graphContext.deleteNode')}
          message={text('graphContext.deleteNodeMessage', { title: storyNode.title })}
          confirmLabel={text('graphContext.delete')}
          cancelLabel={text('common.cancel')}
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </>
  );
}
