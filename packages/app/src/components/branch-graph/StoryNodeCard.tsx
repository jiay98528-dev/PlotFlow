/**
 * StoryNodeCard — 自定义 React Flow 节点卡片组件
 *
 * 职责：渲染 PlotFlow 故事分支图中单个节点的可视化卡片。
 * 显示节点标题、正文预览和选项数量徽章，通过 className 注入状态着色。
 *
 * 对应 M2-04、TAD.md §2.4.1 和 CLAUDE.md §6.3。
 *
 * 约束（CLAUDE.md §6.3）：
 * - 继承 React.FC<NodeProps>
 * - 节点状态着色通过 className 注入，不在组件内硬编码颜色
 * - 所有颜色引用 Design Token CSS 变量
 *
 * @module components/branch-graph/StoryNodeCard
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { StoryFlowNodeData } from './adapter';
import { useEditorStore } from '../../stores/editorStore';
import { useStoryStore } from '../../stores/storyStore';
import { useGraphStore } from '../../stores/graphStore';
import '../../styles/branch-graph.css';

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 从 Markdown 文本中提取纯文本（剥离标记语法）。
 * 仅处理常用行内语法，不引入完整的 Markdown 解析器。
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')           // 标题标记
    .replace(/\*\*(.+?)\*\*/g, '$1')     // 加粗
    .replace(/\*(.+?)\*/g, '$1')         // 斜体
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')  // 链接 [text](url)
    .replace(/`(.+?)`/g, '$1')           // 行内代码
    .replace(/>\s+/g, '')                // 引用
    .replace(/[-*+]\s+/g, '')            // 无序列表
    .replace(/\d+\.\s+/g, '')            // 有序列表
    .replace(/~~(.+?)~~/g, '$1')         // 删除线
    .replace(/---+/g, '')                // 水平线
    .replace(/\n{2,}/g, '\n')            // 压缩连续换行
    .replace(/\n/g, ' ')                 // 换行转空格
    .trim();
}

/**
 * 截断字符串到指定长度，超过时末尾加省略号。
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

// ============================================================================
// 状态映射常量
// ============================================================================

/** 节点状态 → CSS className 映射 */
const STATUS_CLASS_MAP: Record<StoryFlowNodeData['status'], string> = {
  normal: 'node-status-normal',
  orphan: 'node-status-orphan',
  deadend: 'node-status-deadend',
  error: 'node-status-error',
  root: 'node-status-root',
};

/** 节点状态 → 显示标签映射 */
const STATUS_LABEL_MAP: Record<StoryFlowNodeData['status'], string> = {
  normal: '',
  orphan: '孤立',
  deadend: '死胡同',
  error: '错误',
  root: '起点',
};

// ============================================================================
// 类型定义
// ============================================================================

/** StoryNodeCard Props 接口 */
export interface StoryNodeCardProps extends NodeProps<Node<StoryFlowNodeData>> {
  data: StoryFlowNodeData;
}

// ============================================================================
// 组件
// ============================================================================

/**
 * StoryNodeCard — 单节点卡片。
 *
 * 显示内容：
 * - 节点标题（截断到 30 字符）
 * - 前 30 字正文摘要（body 的纯文本提取）
 * - 选项数量徽章 [N]
 *
 * 状态着色通过 className 注入（CLAUDE.md §6.3）：
 * - .node-status-normal   → 绿色边框
 * - .node-status-orphan   → 黄色边框
 * - .node-status-deadend  → 灰色边框
 * - .node-status-error    → 红色边框 + 错误图标
 * - .node-status-selected → 蓝色光晕
 *
 * 使用 Design Token CSS 变量（--color-bg-*、--color-text-*、--shadow-sm 等）。
 */
export const StoryNodeCard: React.FC<StoryNodeCardProps> = ({ data, selected }) => {
  // --- 数据提取 ---
  const statusClass = STATUS_CLASS_MAP[data.status] ?? 'node-status-normal';
  const statusLabel = STATUS_LABEL_MAP[data.status] ?? '';

  // 标题截断到 30 字符
  const title = truncate(data.title || '未命名节点', 30);

  // 正文：剥离 Markdown → 截断到 30 字符
  const bodyPlain = stripMarkdown(data.body);
  const bodyPreview = truncate(bodyPlain, 30);
  const hasPreview = bodyPreview.length > 0;

  // 错误状态额外图标
  const isError = data.status === 'error';

  // ==========================================================================
  // 内联重命名状态 (M2-08)
  // ==========================================================================

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isCommitting = useRef(false);

  // Store access for rename
  const editorInstance = useEditorStore((s) => s.editorInstance);
  const getNodeByFullId = useStoryStore((s) => s.getNodeByFullId);
  const setRenamingNodeId = useGraphStore((s) => s.setRenamingNodeId);

  /** 确认重命名：通过 Monaco Editor API 替换标题行 */
  const confirmRename = useCallback(() => {
    if (isCommitting.current) return;
    isCommitting.current = true;

    const newTitle = editValue.trim();
    if (!newTitle || newTitle === data.title) {
      setIsEditing(false);
      setEditValue('');
      setRenamingNodeId(null);
      isCommitting.current = false;
      return;
    }

    const node = getNodeByFullId(data.fullId);
    if (!node || !editorInstance) {
      setIsEditing(false);
      setEditValue('');
      setRenamingNodeId(null);
      isCommitting.current = false;
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      setIsEditing(false);
      setEditValue('');
      setRenamingNodeId(null);
      isCommitting.current = false;
      return;
    }

    const lineNumber = node.lineNumber; // 1-based
    const lineContent = model.getLineContent(lineNumber);

    // 匹配 "## 节点：XXX" 或 "# 节点：XXX" 前缀
    const prefixMatch = lineContent.match(/^(#{1,6}\s*节点[：:]\s*)/);
    if (!prefixMatch) {
      setIsEditing(false);
      setEditValue('');
      setRenamingNodeId(null);
      isCommitting.current = false;
      return;
    }

    const prefix = prefixMatch[1];
    const newLine = prefix + newTitle;

    editorInstance.executeEdits('plotflow-rename-node', [
      {
        range: {
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber,
          endColumn: lineContent.length + 1,
        },
        text: newLine,
      },
    ]);

    setIsEditing(false);
    setEditValue('');
    setRenamingNodeId(null);
    isCommitting.current = false;
  }, [editValue, data.title, data.fullId, getNodeByFullId, editorInstance, setRenamingNodeId]);

  /** 取消编辑（Escape 键触发） */
  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
    setRenamingNodeId(null);
  }, [setRenamingNodeId]);

  /** 双击进入编辑模式 */
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsEditing(true);
      setEditValue(data.title || '');
      setRenamingNodeId(data.fullId);
    },
    [data.title, data.fullId, setRenamingNodeId],
  );

  /** 自动聚焦并选中全部文本 */
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
      isCommitting.current = false;
    }
  }, [isEditing]);

  /** 编辑中键盘事件：Enter 确认 / Escape 取消 */
  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        confirmRename();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelEdit();
      }
    },
    [confirmRename, cancelEdit],
  );

  /** 输入框失焦 → 确认修改 */
  const handleEditBlur = useCallback(() => {
    confirmRename();
  }, [confirmRename]);

  /** 阻止输入框上的鼠标事件冒泡到 React Flow（防止拖拽/选中干扰） */
  const handleInputMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // ==========================================================================

  // --- 构建 className ---
  const classes = [
    'story-node-card',
    statusClass,
    selected ? 'node-status-selected' : '',
    isEditing ? 'node-status-editing' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // --- 渲染 ---
  return (
    <div className={classes} onDoubleClick={handleDoubleClick}>
      {/* 头部：状态标签 + 标题（可编辑）/ 内联编辑输入框 + 选项徽章 */}
      <div className="story-node-header">
        {statusLabel && (
          <span className="story-node-status-label">{statusLabel}</span>
        )}
        {isError && <span className="story-node-error-icon" />}

        {isEditing ? (
          <input
            ref={inputRef}
            className="story-node-rename-input"
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={handleEditBlur}
            onMouseDown={handleInputMouseDown}
          />
        ) : (
          <span className="story-node-title" title={data.title}>
            {title}
          </span>
        )}

        {data.optionCount > 0 && (
          <span className="story-node-badge">{data.optionCount}</span>
        )}
      </div>

      {/* 正文预览 */}
      {hasPreview && (
        <div className="story-node-preview" title={stripMarkdown(data.body)}>
          {bodyPreview}
        </div>
      )}

      {/* 空内容占位 */}
      {!hasPreview && !data.optionCount && (
        <div className="story-node-empty-hint">
          （空节点 — 暂无内容）
        </div>
      )}

      {/* React Flow 连线端口 — 目标端口（顶部，接收连线） */}
      <Handle
        type="target"
        position={Position.Top}
        className="story-node-handle story-node-handle-target"
      />

      {/* React Flow 连线端口 — 每个选项一个源端口（底部，可拖拽修改跳转目标） */}
      {data.optionCount > 0 && (
        <div className="story-node-connectors">
          {Array.from({ length: data.optionCount }, (_, i) => (
            <Handle
              key={`option-${i}`}
              id={`option-${i}`}
              type="source"
              position={Position.Bottom}
              className="story-node-connect-handle"
              style={{
                left: `${((i + 1) / (data.optionCount + 1)) * 100}%`,
              }}
              title={`选项 ${i + 1}: 拖拽到目标节点以修改跳转目标`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 默认导出便于 React Flow nodeTypes 注册
export default StoryNodeCard;
