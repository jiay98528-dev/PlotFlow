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
import { getNodeStatus, STATUS_TO_CLASS_MAP } from './adapter-helpers';
import { layoutNodes, NODE_DIMENSIONS } from './layout';
import { encodeEdgeId } from '../../stores/edgeStore';

// ============================================================================
// 结构缓存（避免 Dagre 布局重复计算）
// ============================================================================

interface LayoutCache {
  hash: string;
  positions: Record<string, { x: number; y: number }>;
}

let layoutCache: LayoutCache | null = null;

/**
 * 计算结构哈希值，用于判断图谱拓扑是否发生变化。
 * 基于节点数、边数、排过序的节点 ID 列表和边（source→target）列表生成，
 * 确保相同结构产生相同哈希，而节点插入顺序不影响结果。
 */
function computeStructuralHash(nodes: Node<StoryFlowNodeData>[], edges: Edge[]): string {
  const sortedNodeIds = nodes.map((n) => n.id).sort();
  const sortedEdgePairs = edges.map((e) => `${e.source}:${e.target}`).sort();
  return JSON.stringify([nodes.length, edges.length, sortedNodeIds, sortedEdgePairs]);
}

// ============================================================================
// 类型定义
// ============================================================================

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

  // 步骤 2: 计算唯一 Node ID（防止 E007 重复 fullId 损坏 React Flow 内部状态）
  // React Flow 内部使用 Map<string, Node> 存储节点，重复 id 会导致状态不一致。
  // 当检测到重复 fullId 时，首节点保持原名，后续节点追加 #2、#3… 后缀。
  const uniqueIds: string[] = [];
  const fullIdCount = new Map<string, number>();
  const firstUniqueId = new Map<string, string>();
  for (const node of allNodes) {
    const count = fullIdCount.get(node.fullId) ?? 0;
    fullIdCount.set(node.fullId, count + 1);
    const uid = count === 0 ? node.fullId : `${node.fullId}#${count + 1}`;
    uniqueIds.push(uid);
    if (count === 0) firstUniqueId.set(node.fullId, uid);
  }

  // 步骤 3: 构建连线列表
  // 使用 nodeMap 进行 O(1) 目标节点存在性检查
  const flowEdges: Edge[] = [];

  for (let nodeIdx = 0; nodeIdx < allNodes.length; nodeIdx++) {
    const node = allNodes[nodeIdx]!;
    const srcId = uniqueIds[nodeIdx]!;
    for (let i = 0; i < node.options.length; i++) {
      const option = node.options[i]!;
      if (!option.targetFullId) continue;

      // O(1) 验证目标节点存在（替代 O(n) 的 Array.find）
      if (!nodeMap.has(option.targetFullId)) continue;

      const tgtId = firstUniqueId.get(option.targetFullId) ?? option.targetFullId;

      // 使用 encodeEdgeId 确保 Edge ID 可逆解析（V02-008 加固）。
      flowEdges.push({
        id: encodeEdgeId(srcId, tgtId, i),
        source: srcId,
        target: tgtId,
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

  // 步骤 4: 判定节点状态（委托给 adapter-helpers.ts 的 getNodeStatus）
  // 通过 M3 验证器填充的 NodeDiagnostics（isOrphan/isDeadEnd/diagnosticIds）判定。
  // targetedNodeIds/sourceNodeIds 保留仅供后续可能使用，状态判定不再依赖它们。

  // 步骤 5: 构建 React Flow 节点（初始 position 为 {0,0}，由 layoutNodes 计算）
  const flowNodes: Node<StoryFlowNodeData>[] = allNodes.map((node, idx) => {
    const status = getNodeStatus(node);
    return {
      id: uniqueIds[idx]!,
      type: 'storyNode',
      position: { x: 0, y: 0 },
      width: NODE_DIMENSIONS.width,
      height: NODE_DIMENSIONS.height,
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

  // 步骤 6: 结构缓存检查 —— 若拓扑未变则复用上次 Dagre 位置，跳过重布局
  const structuralHash = computeStructuralHash(flowNodes, flowEdges);
  if (layoutCache && layoutCache.hash === structuralHash) {
    for (const node of flowNodes) {
      const pos = layoutCache.positions[node.id];
      if (pos) {
        node.position = { ...pos };
      }
    }
    return { nodes: flowNodes, edges: flowEdges };
  }

  // 步骤 7: 调用 Dagre 布局计算位置并缓存结果
  const result = layoutNodes(flowNodes, flowEdges);
  layoutCache = {
    hash: structuralHash,
    positions: Object.fromEntries(result.nodes.map((n) => [n.id, { ...n.position }])),
  };
  return result;
}
