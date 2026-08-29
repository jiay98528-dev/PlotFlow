import type { PlotFlowData } from '../types/ast.js';
import { buildStoryAdjacency } from './adjacency.js';

export interface DerivedNodeStatus {
  readonly isRoot: boolean;
  readonly isOrphan: boolean;
  readonly isDeadEnd: boolean;
}

/** Derive graph status without reading or mutating node diagnostic metadata. */
export function deriveNodeStatuses(data: PlotFlowData): ReadonlyMap<string, DerivedNodeStatus> {
  const adjacency = buildStoryAdjacency(data);
  const statuses = new Map<string, DerivedNodeStatus>();
  let isFirstStoryNode = true;

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      const hasEntry = adjacency.incomingByTargetFullId.has(node.fullId);
      const isRoot = isFirstStoryNode;
      isFirstStoryNode = false;
      statuses.set(node.fullId, {
        isRoot,
        isOrphan: !isRoot && !hasEntry,
        isDeadEnd: !adjacency.outgoingBySourceFullId.has(node.fullId),
      });
    }
  }

  return statuses;
}
