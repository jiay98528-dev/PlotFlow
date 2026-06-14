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
 *   - 导出 PNG：占位实现（待 html2canvas 集成）
 *
 * 依赖：
 * - 菜单位置由 React Flow 的 onNodeContextMenu / onPaneContextMenu 事件提供
 * - 使用 inline styles + CSS 变量驱动颜色（CLAUDE.md §6.1）
 * - 所有文本修改通过 editorStore.setContent() 触发单向数据流
 *
 * @module components/branch-graph/GraphContextMenu
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import { useGraphStore } from '../../stores/graphStore';
import { useEditorStore } from '../../stores/editorStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import type { StoryFlowNodeData } from './adapter';
import { layoutNodes } from './layout';
import type { StoryNode } from '@plotflow/core';

// ============================================================================
// 类型定义
// ============================================================================

/** 右键菜单类型 */
export type ContextMenuType = 'node' | 'pane';

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
  /** 菜单类型：node = 节点右键，pane = 空白区域右键 */
  readonly type: ContextMenuType;
  /** 右键点击的节点对象（type='node' 时有效，否则为 null） */
  readonly node: Node<StoryFlowNodeData> | null;
  /** 关闭菜单回调 */
  readonly onClose: () => void;
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

/** 新节点模板文本 */
const TEMPLATE_NEW_NODE =
  '## 节点：新节点\n\n新节点的描述内容\n\n[选项] 继续 → ';

/** 新选项行模板文本 */
const TEMPLATE_NEW_OPTION = '[选项] 新选项 → ';

// ============================================================================
// 辅助函数：编辑器文本操作
// ============================================================================

/**
 * 在编辑器文本中查找节点内容的结束行索引（0-based，exclusive）。
 *
 * 从节点标题行的下一行开始扫描，直到遇到下一个「## 节点：」或「# 」章节标题，
 * 或文件末尾。返回的值可直接用于 splice 的 deleteCount 或插入位置。
 *
 * @param lines - 编辑器文本按行分割后的数组
 * @param titleLineIndex - 节点标题行的 0-based 索引
 * @returns 节点内容结束位置的 0-based 索引（不含该行本身）
 */
function findNodeEndLineIndex(lines: string[], titleLineIndex: number): number {
  let i = titleLineIndex + 1;
  while (i < lines.length) {
    const line = lines[i]!;
    if (/^##\s+节点：/.test(line) || /^#\s+/.test(line)) {
      break;
    }
    i++;
  }
  return i;
}

/**
 * 获取节点在编辑器文本中的行范围（0-based，endLine exclusive）。
 *
 * @param content - 编辑器完整文本
 * @param storyNode - AST 中的节点对象
 * @returns 行范围对象
 */
function getNodeLineRange(
  content: string,
  storyNode: StoryNode,
): { startLine: number; endLine: number } {
  const lines = content.split('\n');
  const startLine = storyNode.lineNumber - 1; // StoryNode.lineNumber 是 1-based
  const endLine = findNodeEndLineIndex(lines, startLine);
  return { startLine, endLine };
}

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
const MenuItem: React.FC<MenuItemProps> = ({
  label,
  shortcut,
  danger = false,
  disabled = false,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    if (!disabled) {
      onClick();
    }
  }, [disabled, onClick]);

  return (
    <div
      role="menuitem"
      aria-disabled={disabled}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 12px`,
        height: MENU_ITEM_HEIGHT,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background:
          hovered && !disabled
            ? 'var(--color-accent-subtle, rgba(160,112,58,0.08))'
            : 'transparent',
        color: disabled
          ? 'var(--color-text-muted, #BDBDBD)'
          : danger
            ? 'var(--color-error, #C62828)'
            : 'var(--color-text-primary, #333333)',
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
            color: 'var(--color-text-muted, #BDBDBD)',
            flexShrink: 0,
          }}
        >
          {shortcut}
        </span>
      )}
    </div>
  );
};

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
        zIndex: 'var(--z-modal, 1000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.25)',
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
          background: 'var(--color-bg-primary, #FFFFFF)',
          borderRadius: 'var(--radius-md, 8px)',
          boxShadow: 'var(--shadow-lg, 0 4px 16px rgba(0,0,0,0.12))',
          border: '1px solid var(--color-border-default, #E0E0E0)',
        }}
      >
        <label
          style={{
            fontSize: 'var(--text-sm, 13px)',
            fontWeight: 600,
            color: 'var(--color-text-primary, #333333)',
            fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          }}
        >
          重命名节点
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
            border: '1px solid var(--color-border-default, #E0E0E0)',
            background: 'var(--color-bg-primary, #FFFFFF)',
            color: 'var(--color-text-primary, #333333)',
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
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm, 4px)',
              border: '1px solid var(--color-border-default, #E0E0E0)',
              background: 'var(--color-bg-primary, #FFFFFF)',
              color: 'var(--color-text-primary, #333333)',
              fontSize: 'var(--text-xs, 12px)',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              cursor: 'pointer',
              lineHeight: '18px',
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(value.trim() || currentTitle)}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm, 4px)',
              border: 'none',
              background: 'var(--color-accent, #A0703A)',
              color: 'var(--color-text-on-accent, #FFFFFF)',
              fontSize: 'var(--text-xs, 12px)',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              cursor: 'pointer',
              fontWeight: 600,
              lineHeight: '18px',
            }}
          >
            确定
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
  confirmLabel = '确定',
  cancelLabel = '取消',
  danger = false,
  onConfirm,
  onCancel,
}) => {
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
        zIndex: 'var(--z-modal, 1000)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.25)',
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
          background: 'var(--color-bg-primary, #FFFFFF)',
          borderRadius: 'var(--radius-md, 8px)',
          boxShadow: 'var(--shadow-lg, 0 4px 16px rgba(0,0,0,0.12))',
          border: '1px solid var(--color-border-default, #E0E0E0)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--text-sm, 13px)',
            fontWeight: 600,
            color: danger
              ? 'var(--color-error, #C62828)'
              : 'var(--color-text-primary, #333333)',
            fontFamily: 'var(--font-ui, system-ui, sans-serif)',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 'var(--text-sm, 13px)',
            color: 'var(--color-text-primary, #333333)',
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
              border: '1px solid var(--color-border-default, #E0E0E0)',
              background: 'var(--color-bg-primary, #FFFFFF)',
              color: 'var(--color-text-primary, #333333)',
              fontSize: 'var(--text-xs, 12px)',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              cursor: 'pointer',
              lineHeight: '18px',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '5px 14px',
              borderRadius: 'var(--radius-sm, 4px)',
              border: 'none',
              background: danger
                ? 'var(--color-error, #C62828)'
                : 'var(--color-accent, #A0703A)',
              color: '#FFFFFF',
              fontSize: 'var(--text-xs, 12px)',
              fontFamily: 'var(--font-ui, system-ui, sans-serif)',
              cursor: 'pointer',
              fontWeight: 600,
              lineHeight: '18px',
            }}
          >
            {confirmLabel}
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
 * - 空白区域右键菜单：添加节点、重新布局、导出 PNG（占位）
 * - 菜单跟随鼠标位置，自动避开视口边缘
 * - 点击菜单外部或按 ESC 关闭
 * - 在菜单关闭后，重命名/删除会弹出独立对话框
 */
export function GraphContextMenu({
  isOpen,
  position,
  type,
  node,
  onClose,
}: GraphContextMenuProps): React.ReactElement | null {
  // ==========================================================================
  // Store 订阅
  // ==========================================================================

  const editorContent = useEditorStore((s) => s.content);
  const setEditorContent = useEditorStore((s) => s.setContent);
  const editorInstance = useEditorStore((s) => s.editorInstance);
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);
  const plotFlowData = useStoryStore((s) => s.plotFlowData);
  const getNodeByFullId = useStoryStore((s) => s.getNodeByFullId);
  const graphNodes = useGraphStore((s) => s.nodes);
  const graphEdges = useGraphStore((s) => s.edges);
  const setNodes = useGraphStore((s) => s.setNodes);
  const setStatusMessage = useUIStore((s) => s.setStatusMessage);

  // ==========================================================================
  // 内部状态
  // ==========================================================================

  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

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
          onClose();
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
        onClose();
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
    return getNodeByFullId(node.id);
  }, [type, node, plotFlowData, getNodeByFullId]);

  const isNodeActionDisabled = !storyNode || !plotFlowData;

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
    setStatusMessage(`已跳转到: ${storyNode.title}`);
    onClose();
  }, [storyNode, editorInstance, setCursorPosition, setStatusMessage, onClose]);

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

      const lines = editorContent.split('\n');
      const titleIndex = storyNode.lineNumber - 1;
      if (titleIndex >= 0 && titleIndex < lines.length) {
        lines[titleIndex] = `## 节点：${newTitle}`;
        setEditorContent(lines.join('\n'));
        setStatusMessage(`节点已重命名为: ${newTitle}`);
      }
      setShowRenameDialog(false);
    },
    [storyNode, editorContent, setEditorContent, setStatusMessage],
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

    const lines = editorContent.split('\n');
    const endIndex = findNodeEndLineIndex(lines, storyNode.lineNumber - 1);

    // 在节点内容末尾插入新选项行
    lines.splice(endIndex, 0, TEMPLATE_NEW_OPTION);
    setEditorContent(lines.join('\n'));
    setStatusMessage(`已为「${storyNode.title}」添加新选项`);
    onClose();
  }, [storyNode, editorContent, setEditorContent, setStatusMessage, onClose]);

  /** 打开删除确认对话框 */
  const handleOpenDelete = useCallback(() => {
    if (!storyNode) return;
    onClose();
    setTimeout(() => setShowDeleteDialog(true), 50);
  }, [storyNode, onClose]);

  /** 执行删除：从编辑器文本中移除节点全部行 */
  const handleDeleteConfirm = useCallback(() => {
    if (!storyNode) return;

    const { startLine, endLine } = getNodeLineRange(editorContent, storyNode);
    const lines = editorContent.split('\n');
    lines.splice(startLine, endLine - startLine);
    setEditorContent(lines.join('\n'));
    setStatusMessage(`节点「${storyNode.title}」已删除`);
    setShowDeleteDialog(false);
  }, [storyNode, editorContent, setEditorContent, setStatusMessage]);

  /** 关闭删除对话框 */
  const handleDeleteCancel = useCallback(() => {
    setShowDeleteDialog(false);
  }, []);

  // ==========================================================================
  // 事件处理器：空白区域菜单
  // ==========================================================================

  /** 在编辑器末尾插入新节点模板 */
  const handleAddNode = useCallback(() => {
    const newContent = editorContent
      ? `${editorContent}\n\n${TEMPLATE_NEW_NODE}`
      : TEMPLATE_NEW_NODE;
    setEditorContent(newContent);
    setStatusMessage('已添加新节点');
    onClose();
  }, [editorContent, setEditorContent, setStatusMessage, onClose]);

  /** 重新调用 Dagre 布局 */
  const handleRelayout = useCallback(() => {
    if (graphNodes.length === 0) {
      setStatusMessage('没有需要布局的节点');
      onClose();
      return;
    }
    const { nodes: layoutedNodes } = layoutNodes(graphNodes, graphEdges);
    setNodes(layoutedNodes);
    setStatusMessage('分支图已重新布局');
    onClose();
  }, [graphNodes, graphEdges, setNodes, setStatusMessage, onClose]);

  /** 导出 PNG（占位实现 — 待 html2canvas 集成） */
  const handleExportPNG = useCallback(() => {
    setStatusMessage('导出 PNG — 待 html2canvas 集成后实现');
    onClose();
  }, [setStatusMessage, onClose]);

  // ==========================================================================
  // 菜单位置微调：防止溢出视口边缘
  // ==========================================================================

  const adjustedPosition = useMemo(() => {
    const nodeMenuItemsCount = 4; // 跳转、重命名、添加选项、删除 + 2 分隔线
    const paneMenuItemsCount = 3; // 添加、布局、导出
    const itemsCount =
      type === 'node' ? nodeMenuItemsCount : paneMenuItemsCount;
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
            label: '跳转到编辑器',
            shortcut: 'Enter',
            disabled: isNodeActionDisabled,
            onClick: handleJumpToEditor,
          },
          {
            key: 'rename',
            label: '重命名',
            disabled: isNodeActionDisabled,
            onClick: handleOpenRename,
          },
          {
            key: 'addOption',
            label: '添加选项',
            disabled: isNodeActionDisabled,
            onClick: handleAddOption,
          },
          {
            key: 'delete',
            label: '删除节点',
            danger: true,
            disabled: isNodeActionDisabled,
            onClick: handleOpenDelete,
            showDividerBefore: true, // 在删除前加分隔线
          },
        ]
      : [
          {
            key: 'addNode',
            label: '添加节点',
            onClick: handleAddNode,
          },
          {
            key: 'relayout',
            label: '重新布局',
            disabled: graphNodes.length === 0,
            onClick: handleRelayout,
          },
          {
            key: 'exportPng',
            label: '导出 PNG',
            onClick: handleExportPNG,
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
        style={{
          position: 'fixed',
          zIndex: 'var(--z-dropdown, 900)',
          top: adjustedPosition.y,
          left: adjustedPosition.x,
          width: MENU_WIDTH,
          background: 'var(--color-bg-primary, #FFFFFF)',
          borderRadius: 'var(--radius-md, 8px)',
          boxShadow: 'var(--shadow-lg, 0 4px 16px rgba(0,0,0,0.12))',
          border: '1px solid var(--color-border-default, #E0E0E0)',
          padding: '4px 0',
          overflow: 'hidden',
        }}
      >
        {menuItems.map((item) => (
          <React.Fragment key={item.key}>
            {item.showDividerBefore && (
              <div
                style={{
                  height: DIVIDER_HEIGHT,
                  margin: '4px 0',
                  background: 'var(--color-border-light, #E8E8E8)',
                }}
              />
            )}
            <MenuItem
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
          title="删除节点"
          message={`确定要删除节点「${storyNode.title}」吗？\n此操作将通过编辑器文本删除节点所有内容，不可直接撤销。`}
          confirmLabel="删除"
          cancelLabel="取消"
          danger
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </>
  );
}
