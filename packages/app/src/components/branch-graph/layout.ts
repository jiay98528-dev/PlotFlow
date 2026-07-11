/**
 * Dagre 布局引擎适配器
 *
 * 职责：对 React Flow 节点和连线执行自上而下（TB）的树状布局计算。
 * 使用 @dagrejs/dagre 进行图布局，处理孤立节点的独立放置。
 * 提供同层节点水平折叠功能（M2-15）。
 *
 * 对应 TAD.md §2.4.3 Dagre 布局配置。
 *
 * 配置常量：
 * - rankdir: TB (自上而下)
 * - nodesep: 150px (同层节点水平间距)
 * - ranksep: 120px (父子层垂直间距)
 * - node dimensions: 220x120 (宽x高)
 *
 * @module components/branch-graph/layout
 */

import { graphlib, layout as dagreLayout } from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

// ============================================================================
// 布局配置常量
// ============================================================================

/** 节点尺寸（宽 x 高，像素） */
export const NODE_DIMENSIONS = {
  width: 320,
  height: 228,
} as const;

export const LARGE_GRAPH_LAYOUT_THRESHOLD = 150;

/** Dagre 图布局配置 */
const LAYOUT_CONFIG: dagreGraphLabel = {
  rankdir: 'TB',
  nodesep: 150,
  ranksep: 120,
  marginx: 50,
  marginy: 50,
};

/** 孤立节点列间距 */
const ORPHAN_GAP_X = 200;

/** 孤立节点行间距 */
const ORPHAN_GAP_Y = NODE_DIMENSIONS.height + 100;

// ============================================================================
// 类型别名 (dagre 内部类型)
// ============================================================================

/** Dagre graph label 类型（布局配置） */
interface dagreGraphLabel {
  rankdir: string;
  nodesep: number;
  ranksep: number;
  marginx: number;
  marginy: number;
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 对 React Flow 节点执行 Dagre 自上而下布局。
 *
 * 算法：
 * 1. 创建 Dagre Graph 实例
 * 2. 设置图级别布局配置 (rankdir=TB, nodesep=150, ranksep=120)
 * 3. 将所有节点注册到图中（携带宽高尺寸）
 * 4. 将所有连线注册为图的边
 * 5. 执行 dagre.layout() 计算每个节点的 (x, y)
 * 6. 将计算出的位置映射回 React Flow 节点
 * 7. 识别孤立节点（无任何连线的节点），放置到主图右侧
 *
 * @param nodes - React Flow 节点列表（position 将被覆盖）
 * @param edges - React Flow 连线列表
 * @returns 应用布局后的节点列表和原始连线
 */
export function layoutNodes<TData extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<TData>[],
  edges: Edge[],
): { nodes: Node<TData>[]; edges: Edge[] } {
  if (nodes.length === 0) {
    return { nodes: [], edges };
  }

  const positions = layoutNodePositions(nodes.map((node) => node.id), edges);
  const layoutedNodes = nodes.map((node) => {
    const position = positions[node.id];
    return position ? { ...node, position } : node;
  });

  return { nodes: positionOrphanNodes(layoutedNodes, edges), edges };
}

export function layoutNodePositions(
  nodeIds: readonly string[],
  edges: readonly Pick<Edge, 'source' | 'target'>[],
): Record<string, { x: number; y: number }> {
  if (nodeIds.length === 0) return {};

  const g = new graphlib.Graph({ directed: true, multigraph: false });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph(LAYOUT_CONFIG);

  for (const nodeId of nodeIds) {
    g.setNode(nodeId, {
      width: NODE_DIMENSIONS.width,
      height: NODE_DIMENSIONS.height,
    });
  }

  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagreLayout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  for (const nodeId of nodeIds) {
    const dagreNode = g.node(nodeId);
    if (dagreNode && typeof dagreNode.x === 'number' && typeof dagreNode.y === 'number') {
      positions[nodeId] = {
        x: dagreNode.x - NODE_DIMENSIONS.width / 2,
        y: dagreNode.y - NODE_DIMENSIONS.height / 2,
      };
    }
  }

  return positions;
}

export function applyFastGridLayout<TData extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<TData>[],
): Node<TData>[] {
  const positions = createFastGridPositions(nodes.map((node) => node.id));
  return nodes.map((node) => ({
    ...node,
    position: positions[node.id] ?? node.position,
  }));
}

export function createFastGridPositions(
  nodeIds: readonly string[],
): Record<string, { x: number; y: number }> {
  const columns = Math.max(1, Math.ceil(Math.sqrt(nodeIds.length)));
  const gapX = NODE_DIMENSIONS.width + 80;
  const gapY = NODE_DIMENSIONS.height + 80;
  return Object.fromEntries(nodeIds.map((nodeId, index) => [
    nodeId,
    {
      x: (index % columns) * gapX,
      y: Math.floor(index / columns) * gapY,
    },
  ]));
}

function positionOrphanNodes<TData extends Record<string, unknown> = Record<string, unknown>>(
  layoutedNodes: Node<TData>[],
  edges: readonly Pick<Edge, 'source' | 'target'>[],
): Node<TData>[] {
  const connectedIds = new Set<string>();
  for (const edge of edges) {
    connectedIds.add(edge.source);
    connectedIds.add(edge.target);
  }

  const orphanNodes = layoutedNodes.filter((n) => !connectedIds.has(n.id));
  if (orphanNodes.length > 0) {
    const maxX = layoutedNodes.reduce(
      (max, n) => Math.max(max, n.position.x + NODE_DIMENSIONS.width),
      0,
    );
    const orphanX = maxX + ORPHAN_GAP_X;
    let orphanY = 50; // 从顶部开始排列

    for (const node of orphanNodes) {
      // 不修改原节点对象，直接在数组上更新（layoutedNodes 是新数组）
      // eslint-disable-next-line no-param-reassign
      node.position = { x: orphanX, y: orphanY };
      orphanY += ORPHAN_GAP_Y;
    }
  }

  return layoutedNodes;
}

// ============================================================================
// 同层节点水平折叠 (M2-15)
// ============================================================================

/** 同层节点折叠阈值：超过此数量的兄弟节点将自动折叠 */
export const COLLAPSE_THRESHOLD = 20;

/**
 * 同层兄弟节点组信息。
 *
 * 通过分析边的 source→target 关系，将共享同一父节点的子节点归为一组。
 */
export interface SiblingGroupInfo {
  /** 组唯一 ID，格式 "sibling-group-{parentNodeId}" */
  groupId: string;
  /** 父节点 ID */
  parentNodeId: string;
  /** 该组内所有兄弟节点 ID（按原始顺序排列） */
  siblingIds: string[];
}

/**
 * 折叠虚拟节点的自定义数据。
 *
 * 继承 Record<string, unknown> 以满足 React Flow 的 Node data 类型约束。
 */
export interface CollapseNodeData extends Record<string, unknown> {
  /** 折叠组 ID */
  groupId: string;
  /** 折叠的节点数量 */
  collapsedCount: number;
  /** 父节点 ID */
  parentNodeId: string;
}

/**
 * 从已布局的节点和边中识别同层兄弟组。
 *
 * 算法：
 * 1. 遍历所有边，按 source（父节点）分组收集 target（子节点）
 * 2. 仅保留子节点数 > 1 的组（单个子节点无需折叠）
 * 3. 为每个组生成唯一的 groupId
 *
 * @param nodes - 已布局的 React Flow 节点列表
 * @param edges - React Flow 连线列表
 * @returns 兄弟节点组信息列表
 */
export function identifySiblingGroups(
  nodes: Node[],
  edges: Edge[],
): SiblingGroupInfo[] {
  // 构建节点 ID 集合以快速判断节点是否存在
  const nodeIdSet = new Set(nodes.map((n) => n.id));

  // 按父节点（edge.source）分组收集子节点（edge.target）
  const parentToChildren = new Map<string, string[]>();
  for (const edge of edges) {
    // 仅当 source 和 target 都是有效节点时才处理
    if (!nodeIdSet.has(edge.source) || !nodeIdSet.has(edge.target)) continue;

    const children = parentToChildren.get(edge.source);
    if (children) {
      children.push(edge.target);
    } else {
      parentToChildren.set(edge.source, [edge.target]);
    }
  }

  // 过滤出有多个子节点的组
  const groups: SiblingGroupInfo[] = [];
  for (const [parentId, childIds] of parentToChildren) {
    if (childIds.length > 1) {
      groups.push({
        groupId: `sibling-group-${parentId}`,
        parentNodeId: parentId,
        siblingIds: childIds,
      });
    }
  }

  return groups;
}

/**
 * 对节点列表应用同层折叠。
 *
 * 对于超过 maxPerRow 个子节点的兄弟组：
 * - 默认行为：超过阈值的组自动折叠（保留前 maxPerRow 个，其余替代为 "..." 虚拟节点）
 * - 若 collapsedGroups 中包含该 groupId（用户已点击展开），则保留全部节点
 *
 * collapsedGroups 语义：
 * - key 不存在 → 默认折叠（自动行为）
 * - key 存在且值为 true → 用户已展开，不折叠
 *
 * 折叠虚拟节点放置在最后一个可见兄弟节点右侧。
 * 同时过滤掉指向已折叠节点的连线。
 *
 * @param nodes - 已布局的 React Flow 节点列表
 * @param edges - React Flow 连线列表
 * @param maxPerRow - 每行最多显示的节点数（默认 COLLAPSE_THRESHOLD=20）
 * @param collapsedGroups - 用户已展开的组 ID 集合（true=已展开，不折叠）
 * @returns 应用折叠后的节点和连线
 */
export function collapseSiblingNodes(
  nodes: Node[],
  edges: Edge[],
  maxPerRow: number = COLLAPSE_THRESHOLD,
  collapsedGroups: Record<string, boolean> = {},
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes: [], edges: [] };

  const groups = identifySiblingGroups(nodes, edges);
  if (groups.length === 0) return { nodes, edges };

  // 构建节点快速查找 Map
  const nodeMap = new Map<string, Node>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // 收集需要移除的节点 ID 和需要添加的折叠节点
  const removedNodeIds = new Set<string>();
  const collapseNodes: Node<CollapseNodeData>[] = [];

  for (const group of groups) {
    if (group.siblingIds.length <= maxPerRow) continue;

    // 若该组已被用户展开（在 collapsedGroups 中有记录），则跳过折叠
    if (collapsedGroups[group.groupId]) continue;

    // 可见部分：前 maxPerRow 个
    const visibleIds = group.siblingIds.slice(0, maxPerRow);
    // 折叠部分：剩余的节点
    const collapsedIds = group.siblingIds.slice(maxPerRow);

    // 标记折叠节点为待移除
    for (const id of collapsedIds) {
      removedNodeIds.add(id);
    }

    // 计算折叠节点的位置：放在最后一个可见兄弟节点右侧
    const lastVisible = nodeMap.get(visibleIds[visibleIds.length - 1]!);
    const collapseX = lastVisible
      ? lastVisible.position.x + NODE_DIMENSIONS.width + 50
      : 0;
    const collapseY = lastVisible ? lastVisible.position.y : 0;

    collapseNodes.push({
      id: `collapse-${group.groupId}`,
      type: 'collapseNode',
      position: { x: collapseX, y: collapseY },
      data: {
        groupId: group.groupId,
        collapsedCount: collapsedIds.length,
        parentNodeId: group.parentNodeId,
      },
    });
  }

  // 过滤节点和边
  // 使用类型断言：collapseNodes 与原始 nodes 的数据类型不同，但 React Flow
  // 在运行时通过 nodeTypes 注册表按 type 字段分发到正确的组件，因此类型混合是安全的。
  const filteredNodes: Node[] = [
    ...nodes.filter((n) => !removedNodeIds.has(n.id)),
    ...collapseNodes,
  ];

  const filteredEdges = edges.filter(
    (e) => !removedNodeIds.has(e.source) && !removedNodeIds.has(e.target),
  );

  return { nodes: filteredNodes, edges: filteredEdges };
}
