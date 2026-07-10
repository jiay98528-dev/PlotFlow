/**
 * StoryEdge — 自定义 React Flow 连线组件（V0.2 交互升级）
 *
 * 两种连线类型（由 adapter.ts 中的 edge.type 决定）：
 * - type='default': 无条件连线 → 主题 token 实线 + 贝塞尔曲线
 * - type='conditional': 条件连线 → 主题 token 虚线 + 贝塞尔曲线 + 条件标签
 *
 * 对应 TAD.md §2.4 React Flow 集成和 adapter.ts 中 Option → Edge 的映射规则。
 *
 * 约束（CLAUDE.md §6.3）：
 * - 节点状态着色通过 className 注入 — 但连线颜色是数据语义的一部分（无/有条件的可视化区分），
 *   Edge colors are provided by semantic theme tokens.
 * - 箭头通过 MarkerType.ArrowClosed 渲染，颜色自动继承连线 stroke。
 *
 * V0.2 新增交互能力（DG-1~5, FR-1）：
 * - onClick: 连线点击 → 视觉选中态 / Alt+点击删除
 * - onDoubleClick: 双击 → 打开条件编辑器
 * - onContextMenu: 右键 → EdgeContextMenu
 * - hover: 光标悬停 → 加粗 + 高亮
 *
 * @module components/branch-graph/StoryEdge
 */

import React, { useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';

// ============================================================================
// 类型定义
// ============================================================================

/** 连线自定义数据类型 — 与 adapter.ts 中创建的 edge.data 一致 */
export type StoryEdgeData = Record<string, unknown> & {
  /** 是否为条件连线 */
  isConditional?: boolean;
  /** 条件表达式原文（用于标签显示；adapter.ts 中来自 option.conditionRaw） */
  conditionText?: string;
};

/** StoryEdge 的完整 Edge 类型 */
export type StoryEdgeType = Edge<StoryEdgeData>;

// ============================================================================
// 常量
// ============================================================================

/** 连线类型 → 颜色映射 */
const EDGE_COLORS = {
  default: 'var(--theme-graph-cable-default, var(--color-syntax-target))',
  conditional: 'var(--theme-graph-cable-conditional, var(--color-syntax-condition))',
} as const;

/** 条件标签最长字符数（超出截断加 "..."） */
const MAX_LABEL_LENGTH = 30;

/** 连线默认线宽 */
const DEFAULT_STROKE_WIDTH = 2;

/** hover 时线宽 */
const HOVER_STROKE_WIDTH = 3;

/** 交互点击区域宽度（比视觉线宽更宽，便于点击） */
const INTERACTION_WIDTH = 18;

// ============================================================================
// 子组件：EdgeLabel
// ============================================================================

/**
 * EdgeLabel — 条件标签子组件
 *
 * 在连线中点显示简短的条件表达式文本。
 * 使用 EdgeLabelRenderer + HTML 元素渲染，确保在 React Flow 画布内
 * 正确显示且不受 SVG 限制。
 *
 * @param props.labelX - 标签中心 X 坐标（由 getBezierPath 返回）
 * @param props.labelY - 标签中心 Y 坐标（由 getBezierPath 返回）
 * @param props.text - 条件表达式原文
 */
const EdgeLabel: React.FC<{
  labelX: number;
  labelY: number;
  text: string;
}> = ({ labelX, labelY, text }) => {
  const displayText = text.length > MAX_LABEL_LENGTH
    ? `${text.slice(0, MAX_LABEL_LENGTH)}...`
    : text;

  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          background: 'var(--color-bg-elevated)',
          border: `1px solid ${EDGE_COLORS.conditional}`,
          borderRadius: 4,
          padding: '1px 6px',
          fontSize: 11,
          fontFamily: "'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace",
          color: EDGE_COLORS.conditional,
          whiteSpace: 'nowrap',
          pointerEvents: 'all',
        }}
        className="nodrag nopan"
      >
        {displayText}
      </div>
    </EdgeLabelRenderer>
  );
};

// ============================================================================
// 主组件：StoryEdge
// ============================================================================

/**
 * StoryEdge — 自定义连线主组件（V0.2 交互升级）。
 *
 * 根据 edge.type 自动切换样式：
 * - 'default'     → 青色实线贝塞尔曲线 + ArrowClosed 箭头
 * - 'conditional' → 橙色虚线(strokeDasharray="5,5") + ArrowClosed 箭头 + 条件标签
 *
 * 交互能力（V02-012 / V02-013 / FR-1）：
 * - hover: 线宽从 2→3，光标变为 pointer
 * - selected: 线宽加粗，颜色变亮
 * - onClick: 若按住了 Alt 键 → 触发 Alt+click 删除（通过 data 属性传播）
 * - onDoubleClick: 触发条件编辑器打开
 * - onContextMenu: 触发 EdgeContextMenu
 *
 * 所有交互事件通过 React Flow 的 EdgeProps 透传至 GraphCanvas 层处理。
 */
export const StoryEdge: React.FC<EdgeProps<StoryEdgeType>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  type,
  selected,
}) => {
  const [hovered, setHovered] = useState(false);

  const isConditional = type === 'conditional';
  const strokeColor = isConditional
    ? EDGE_COLORS.conditional
    : EDGE_COLORS.default;

  // 选中或悬停时加粗线宽
  const strokeWidth = (selected || hovered) ? HOVER_STROKE_WIDTH : DEFAULT_STROKE_WIDTH;

  // 计算贝塞尔曲线路径，同时获取路径中点坐标（用于标签定位）
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const conditionText = data?.conditionText;

  // --- 事件处理器 ---

  const handleMouseEnter = useCallback(() => {
    setHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  return (
    <>
      {/*
       * 不可见宽交互路径 — 比视觉线宽更宽的点击区域，
       * 降低用户精确定位连线的难度。使用透明填充。
       */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={INTERACTION_WIDTH}
        style={{ cursor: hovered ? 'grab' : 'pointer' }}
        className="edge-interaction-path"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />

      {/*
       * BaseEdge — React Flow 内置基础连线渲染器。
       * 通过 style 注入颜色、线宽和虚线阵列。
       * markerEnd 自动使用 strokeColor 同色箭头。
       */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isConditional ? '5,5' : undefined,
          cursor: 'pointer',
          pointerEvents: 'none',
        }}
        markerEnd={MarkerType.ArrowClosed}
      />

      {/* 条件连线在路径中点显示条件表达式标签 */}
      {isConditional && conditionText && (
        <EdgeLabel
          labelX={labelX}
          labelY={labelY}
          text={conditionText}
        />
      )}
    </>
  );
};

// ============================================================================
// 边缘类型注册表
// ============================================================================

/**
 * edgeTypes — 供 ReactFlow 组件使用的边缘类型注册表。
 *
 * 注意：'default' 是 React Flow 内置的默认连线类型名称，
 * 此处显式注册为 StoryEdge 以应用自定义渲染。
 * 两个类型（'default' 和 'conditional'）均指向同一个 StoryEdge 组件，
 * 组件内部通过 `props.type` 区分线型和标签。
 *
 * 使用方式 (在 GraphCanvas.tsx 中)：
 * ```tsx
 * import { edgeTypes } from './StoryEdge';
 *
 * <ReactFlow
 *   nodeTypes={nodeTypes}
 *   edgeTypes={edgeTypes}
 *   ...
 * />
 * ```
 */
export const edgeTypes = {
  default: StoryEdge,
  conditional: StoryEdge,
};
