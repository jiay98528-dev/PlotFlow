import type { PlotFlowData } from '../types/ast.js';

export type StoryGraphEdgeKind = 'option' | 'nextTarget';

export interface StoryGraphEdge {
  readonly kind: StoryGraphEdgeKind;
  readonly sourceFullId: string;
  readonly targetNodeId: string | null;
  readonly targetFullId: string | null;
  readonly lineNumber: number;
  readonly label: string;
  readonly conditional: boolean;
}

export interface StoryAdjacency {
  readonly edges: readonly StoryGraphEdge[];
  readonly incomingByTargetFullId: ReadonlyMap<string, readonly StoryGraphEdge[]>;
  readonly outgoingBySourceFullId: ReadonlyMap<string, readonly StoryGraphEdge[]>;
  readonly nodeFullIds: ReadonlySet<string>;
}

function pushMap(map: Map<string, StoryGraphEdge[]>, key: string, edge: StoryGraphEdge): void {
  const list = map.get(key);
  if (list) {
    list.push(edge);
  } else {
    map.set(key, [edge]);
  }
}

export function buildStoryAdjacency(data: PlotFlowData): StoryAdjacency {
  const edges: StoryGraphEdge[] = [];
  const incomingByTargetFullId = new Map<string, StoryGraphEdge[]>();
  const outgoingBySourceFullId = new Map<string, StoryGraphEdge[]>();
  const nodeFullIds = new Set<string>();

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      nodeFullIds.add(node.fullId);
    }
  }

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        if (!option.targetNodeId && !option.targetFullId) continue;
        const edge: StoryGraphEdge = {
          kind: 'option',
          sourceFullId: node.fullId,
          targetNodeId: option.targetNodeId,
          targetFullId: option.targetFullId,
          lineNumber: option.lineNumber,
          label: option.description,
          conditional: option.condition !== null,
        };
        edges.push(edge);
        pushMap(outgoingBySourceFullId, edge.sourceFullId, edge);
        if (edge.targetFullId) pushMap(incomingByTargetFullId, edge.targetFullId, edge);
      }

      const nextTarget = node.nextTarget;
      if (nextTarget?.targetNodeId || nextTarget?.targetFullId) {
        const edge: StoryGraphEdge = {
          kind: 'nextTarget',
          sourceFullId: node.fullId,
          targetNodeId: nextTarget.targetNodeId,
          targetFullId: nextTarget.targetFullId,
          lineNumber: nextTarget.lineNumber,
          label: '下一步',
          conditional: false,
        };
        edges.push(edge);
        pushMap(outgoingBySourceFullId, edge.sourceFullId, edge);
        if (edge.targetFullId) pushMap(incomingByTargetFullId, edge.targetFullId, edge);
      }
    }
  }

  return {
    edges,
    incomingByTargetFullId,
    outgoingBySourceFullId,
    nodeFullIds,
  };
}
