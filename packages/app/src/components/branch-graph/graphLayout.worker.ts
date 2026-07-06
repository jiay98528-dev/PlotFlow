import type { Edge } from '@xyflow/react';
import { layoutNodePositions } from './layout';

interface LayoutRequest {
  readonly requestId: number;
  readonly nodeIds: readonly string[];
  readonly edges: readonly Pick<Edge, 'source' | 'target'>[];
}

interface LayoutResponse {
  readonly requestId: number;
  readonly positions: Record<string, { x: number; y: number }>;
  readonly elapsedMs: number;
}

self.onmessage = (event: MessageEvent<LayoutRequest>): void => {
  const startedAt = performance.now();
  const { requestId, nodeIds, edges } = event.data;
  const positions = layoutNodePositions(nodeIds, edges);
  const response: LayoutResponse = {
    requestId,
    positions,
    elapsedMs: performance.now() - startedAt,
  };
  self.postMessage(response);
};
