import type { Edge, Node } from '@xyflow/react';
import { layoutNodes } from './layout';

interface LayoutResponse {
  readonly requestId: number;
  readonly positions: Record<string, { x: number; y: number }>;
  readonly elapsedMs: number;
}

let worker: Worker | null = null;
let nextRequestId = 1;
let latestRequestId = 0;

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    worker = new Worker(new URL('./graphLayout.worker.ts', import.meta.url), { type: 'module' });
  }
  return worker;
}

export async function layoutNodesInWorker<TData extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<TData>[],
  edges: Edge[],
): Promise<{ nodes: Node<TData>[]; edges: Edge[]; elapsedMs: number; stale: boolean }> {
  const requestId = nextRequestId++;
  latestRequestId = requestId;
  const activeWorker = getWorker();
  if (!activeWorker) {
    const startedAt = performance.now();
    const result = layoutNodes(nodes, edges);
    return { ...result, elapsedMs: performance.now() - startedAt, stale: false };
  }

  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent<LayoutResponse>): void => {
      if (event.data.requestId !== requestId) return;
      activeWorker.removeEventListener('message', handleMessage);
      activeWorker.removeEventListener('error', handleError);
      const stale = requestId !== latestRequestId;
      const layoutedNodes = nodes.map((node) => {
        const position = event.data.positions[node.id];
        return position ? { ...node, position } : node;
      });
      resolve({ nodes: layoutedNodes, edges, elapsedMs: event.data.elapsedMs, stale });
    };
    const handleError = (event: ErrorEvent): void => {
      activeWorker.removeEventListener('message', handleMessage);
      activeWorker.removeEventListener('error', handleError);
      reject(event.error instanceof Error ? event.error : new Error(event.message));
    };
    activeWorker.addEventListener('message', handleMessage);
    activeWorker.addEventListener('error', handleError);
    activeWorker.postMessage({
      requestId,
      nodeIds: nodes.map((node) => node.id),
      edges: edges.map((edge) => ({ source: edge.source, target: edge.target })),
    });
  });
}
