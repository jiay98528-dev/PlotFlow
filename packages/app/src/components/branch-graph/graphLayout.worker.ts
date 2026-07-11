import type { Edge } from '@xyflow/react';
import { createFastGridPositions, LARGE_GRAPH_LAYOUT_THRESHOLD, layoutNodePositions } from './layout';

interface LayoutRequest {
  readonly requestId: number;
  readonly nodeIds: readonly string[];
  readonly edges: readonly Pick<Edge, 'source' | 'target'>[];
}

interface LayoutResponse {
  readonly requestId: number;
  readonly positions: Record<string, { x: number; y: number }>;
  readonly elapsedMs: number;
  readonly layoutMode: 'dagre' | 'fallback-grid';
  readonly errorMessage?: string;
}

self.onmessage = (event: MessageEvent<LayoutRequest>): void => {
  const startedAt = performance.now();
  const { requestId, nodeIds, edges } = event.data;
  try {
    const useFallback = nodeIds.length > LARGE_GRAPH_LAYOUT_THRESHOLD;
    const positions = useFallback
      ? createFastGridPositions(nodeIds)
      : layoutNodePositions(nodeIds, edges);
    const response: LayoutResponse = {
      requestId,
      positions,
      elapsedMs: performance.now() - startedAt,
      layoutMode: useFallback ? 'fallback-grid' : 'dagre',
    };
    self.postMessage(response);
  } catch (error) {
    const response: LayoutResponse = {
      requestId,
      positions: createFastGridPositions(nodeIds),
      elapsedMs: performance.now() - startedAt,
      layoutMode: 'fallback-grid',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
    self.postMessage(response);
  }
};
