/**
 * CollapseNode — 同层节点折叠虚拟节点组件 (M2-15)
 *
 * 当同层兄弟节点超过阈值（默认20）时，多余的节点被折叠为此虚拟节点。
 * 点击可展开全部隐藏节点。
 *
 * 约束（CLAUDE.md §6.1）：
 * - 所有颜色引用 Design Token CSS 变量
 * - 节点状态着色通过 className 注入
 *
 * @module components/branch-graph/CollapseNode
 */

import React, { useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { CollapseNodeData } from './layout';
import { useGraphStore } from '../../stores/graphStore';
import { useAppText } from '../../i18n/appI18n';

// ============================================================================
// 类型定义
// ============================================================================

/** CollapseNode 的 Props 接口 */
export interface CollapseNodeProps extends NodeProps<Node<CollapseNodeData>> {
  data: CollapseNodeData;
}

// ============================================================================
// 组件
// ============================================================================

/**
 * CollapseNode — 折叠指示器节点。
 *
 * 显示内容：
 * - "···" 图标（视觉提示此处有折叠内容）
 * - "N 个节点已折叠" 文字
 *
 * 交互：
 * - 单击 → 展开所有隐藏节点（调用 toggleGroupCollapse）
 */
export const CollapseNode: React.FC<CollapseNodeProps> = ({ data }) => {
  const toggleGroupCollapse = useGraphStore((s) => s.toggleGroupCollapse);
  const text = useAppText();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleGroupCollapse(data.groupId);
    },
    [data.groupId, toggleGroupCollapse],
  );

  return (
    <div
      className="collapse-node-card"
      onClick={handleClick}
      title={text('themeNode.expandCollapsedNodes', { count: data.collapsedCount })}
    >
      {/* 目标端口（顶部，接收来自父节点的连线） */}
      <Handle
        type="target"
        position={Position.Top}
        className="story-node-handle story-node-handle-target"
      />

      {/* 图标 */}
      <div className="collapse-node-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="18" cy="12" r="2" fill="currentColor" />
        </svg>
      </div>

      {/* 计数文字 */}
      <span className="collapse-node-label">
        {text('themeNode.collapsedNodes', { count: data.collapsedCount })}
      </span>

      {/* 底部端口（用于连线到后续节点） */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="story-node-handle"
      />
    </div>
  );
};

export default CollapseNode;
