/**
 * AST → React Flow 数据适配器
 *
 * 职责：将 PlotFlowData AST（中间表示）转换为 React Flow 可渲染的
 * 节点（Node）和连线（Edge）数据结构。
 *
 * 映射规则（TAD.md §2.4）：
 * - StoryNode → React Flow Node
 *   - id: node.fullId
 *   - data: { title, body, optionCount, status }
 *   - position: 由 layoutNodes() 计算
 * - Option → React Flow Edge
 *   - id: "{sourceFullId}->{targetFullId}#{optionIndex}"
 *   - source: node.fullId
 *   - target: option.targetFullId
 *   - type: option.condition ? 'conditional' : 'default'
 *
 * 节点状态判定（委托给 adapter-helpers.ts 的 getNodeStatus）：
 * - error:   diagnosticIds 中包含以 'E' 开头的诊断代码
 * - orphan:  diagnostics.isOrphan === true
 * - deadend: diagnostics.isDeadEnd === true
 * - normal:  其他情况（含根节点）
 *
 * 性能优化 (M2-15)：
 * - 使用 Map<string, StoryNode> 进行 O(1) 节点查找，替代 O(n) 的 Array.find
 * - 1000 选项的 AST → Flow 转换目标 < 500ms
 *
 * 对应 TAD.md §2.4.3 Dagre 布局配置 → 调用 layoutNodes()。
 *
 * @module components/branch-graph/adapter
 */

import type { Node, Edge } from '@xyflow/react';
import type { PlotFlowData, StoryNode } from '@plotflow/core';
import type { NodeStatus } from './adapter-helpers';
import { getNodeStatus } from './adapter-helpers';
import { layoutNodes } from './layout';
import { encodeEdgeId } from '../../stores/edgeStore';

// ============================================================================
// 类型定义
// ============================================================================

/** 节点状态 → React Flow Node className 映射（CLAUDE.md §6.3） */
const STATUS_TO_CLASS_MAP: Record<NodeStatus, string> = {
  normal: 'node-status-normal',
  orphan: 'node-status-orphan',
  deadend: 'node-status-deadend',
  error: 'node-status-error',
};

/** React Flow 自定义节点数据类型 */
export type StoryFlowNodeData = Record<string, unknown> & {
  /** 节点完整 ID（章节 ID + 节点 ID，如 `第一章-森林入口`） */
  fullId: string;

  /** 节点标题 */
  title: string;

  /** 节点正文描述（Markdown 原始文本） */
  body: string;

  /** 选项数量 */
  optionCount: number;

  /** 节点状态 */
  status: 'normal' | 'orphan' | 'deadend' | 'error' | 'root';

  /** 在源文件中的行号（1-based），用于编辑器联动跳转 */
  lineNumber: number;
};

// ============================================================================
// 核心转换函数
// ============================================================================

/**
 * 将 PlotFlowData AST 转换为 React Flow 节点和连线。
 *
 * 算法：
 * 1. 展开所有章节的所有节点到一个扁平列表
 * 2. 为每个选项创建一条连线（仅当 targetFullId 有效）
 * 3. 通过 validator diagnostics 判定每个节点的状态（error/orphan/deadend/normal）
 * 4. 调用 layoutNodes() 计算每个节点的画布位置
 *
 * @param ast - 解析后的 PlotFlowData AST
 * @returns 包含 nodes 和 edges 的对象，可直接传入 ReactFlow 组件
 */
export function plotFlowDataToFlow(ast: PlotFlowData): {
  nodes: Node<StoryFlowNodeData>[];
  edges: Edge[];
} {
  // 步骤 1: 扁平化所有节点，同时构建 O(1) 查找 Map (M2-15 性能优化)
  const allNodes: StoryNode[] = [];
  const nodeMap = new Map<string, StoryNode>();
  for (const chapter of ast.chapters) {
    for (const node of chapter.nodes) {
      allNodes.push(node);
      nodeMap.set(node.fullId, node);
    }
  }

  if (allNodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  // 步骤 2: 构建连线列表
  // 使用 nodeMap 进行 O(1) 目标节点存在性检查
  const flowEdges: Edge[] = [];

  for (const node of allNodes) {
    for (let i = 0; i < node.options.length; i++) {
      const option = node.options[i]!;
      if (!option.targetFullId) continue;

      // O(1) 验证目标节点存在（替代 O(n) 的 Array.find）
      if (!nodeMap.has(option.targetFullId)) continue;

      // 使用 encodeEdgeId 确保 Edge ID 可逆解析（V02-008 加固）。
      flowEdges.push({
        id: encodeEdgeId(node.fullId, option.targetFullId!, i),
        source: node.fullId,
        target: option.targetFullId,
        sourceHandle: `option-${i}`,
        type: option.condition ? 'conditional' : 'default',
        data: {
          isConditional: !!option.condition,
          conditionText: option.conditionRaw ?? undefined,
          sourceHandle: `option-${i}`,
        },
      });
    }
  }

  // 步骤 3: 判定节点状态（委托给 adapter-helpers.ts 的 getNodeStatus）
  // 通过 M3 验证器填充的 NodeDiagnostics（isOrphan/isDeadEnd/diagnosticIds）判定。
  // targetedNodeIds/sourceNodeIds 保留仅供后续可能使用，状态判定不再依赖它们。

  // 步骤 4: 构建 React Flow 节点（初始 position 为 {0,0}，由 layoutNodes 计算）
  const flowNodes: Node<StoryFlowNodeData>[] = allNodes.map((node) => {
    const status = getNodeStatus(node);
    return {
      id: node.fullId,
      type: 'storyNode',
      position: { x: 0, y: 0 },
      className: STATUS_TO_CLASS_MAP[status],
      data: {
        fullId: node.fullId,
        title: node.title,
        body: node.body,
        optionCount: node.options.length,
        status,
        lineNumber: node.lineNumber,
      },
    };
  });

  // 步骤 5: 调用 Dagre 布局计算位置
  return layoutNodes(flowNodes, flowEdges);
}
