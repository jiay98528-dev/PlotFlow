/**
 * StoryEdge — 自定义 React Flow 连线组件
 *
 * 两种连线类型（由 adapter.ts 中的 edge.type 决定）：
 * - type='default': 无条件连线 → 青色 #4EC9B0 实线 + 贝塞尔曲线
 * - type='conditional': 条件连线 → 橙色 #CE9178 虚线 + 贝塞尔曲线 + 条件标签
 *
 * 对应 TAD.md §2.4 React Flow 集成和 adapter.ts 中 Option → Edge 的映射规则。
 *
 * 约束（CLAUDE.md §6.3）：
 * - 节点状态着色通过 className 注入 — 但连线颜色是数据语义的一部分（无/有条件的可视化区分），
 *   此处直接使用指定的语义色值：#4EC9B0（无条件）、#CE9178（条件）。
 * - 箭头通过 MarkerType.ArrowClosed 渲染，颜色自动继承连线 stroke。
 *
 * @module components/branch-graph/StoryEdge
 */

import React from 'react';
import {
  BaseEdge,
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
  default: '#4EC9B0',    // 青色：无条件连线
  conditional: '#CE9178', // 橙色：条件连线
} as const;

/** 条件标签最长字符数（超出截断加 "..."） */
const MAX_LABEL_LENGTH = 30;

/** 条件标签宽度 */
const LABEL_WIDTH = 160;

/** 条件标签高度 */
const LABEL_HEIGHT = 24;

// ============================================================================
// 子组件：EdgeLabel
// ============================================================================

/**
 * EdgeLabel — 条件标签子组件
 *
 * 在连线中点显示简短的条件表达式文本。
 * 使用纯 SVG 元素（rect + text）渲染，确保在 React Flow SVG 容器内正常工作。
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
    <g>
      {/* 标签背景 — 半透明白底 + 橙色边框 */}
      <rect
        x={labelX - LABEL_WIDTH / 2}
        y={labelY - LABEL_HEIGHT / 2}
        width={LABEL_WIDTH}
        height={LABEL_HEIGHT}
        rx={4}
        fill="rgba(255, 255, 255, 0.92)"
        stroke={EDGE_COLORS.conditional}
        strokeWidth={1}
      />
      {/* 标签文字 — 等宽字体橙色居中 */}
      <text
        x={labelX}
        y={labelY + 4} // 微调垂直居中
        fill={EDGE_COLORS.conditional}
        fontSize={11}
        fontFamily="'Cascadia Code', 'JetBrains Mono', 'Fira Code', monospace"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {displayText}
      </text>
    </g>
  );
};

// ============================================================================
// 主组件：StoryEdge
// ============================================================================

/**
 * StoryEdge — 自定义连线主组件。
 *
 * 根据 edge.type 自动切换样式：
 * - 'default'     → 青色 #4EC9B0 实线贝塞尔曲线 + ArrowClosed 箭头
 * - 'conditional' → 橙色 #CE9178 虚线(strokeDasharray="5,5") + ArrowClosed 箭头 + 条件标签
 *
 * 若 type 非上述值，回退到 'default' 样式（青色实线）。
 *
 * @param props - React Flow EdgeProps（含 sourceX/Y, targetX/Y, source/targetPosition 等）
 */
const StoryEdge: React.FC<EdgeProps<StoryEdgeType>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  type,
}) => {
  const isConditional = type === 'conditional';
  const strokeColor = isConditional
    ? EDGE_COLORS.conditional
    : EDGE_COLORS.default;

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

  return (
    <>
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
          strokeWidth: 2,
          strokeDasharray: isConditional ? '5,5' : undefined,
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
