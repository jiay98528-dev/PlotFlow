import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { applyFastGridLayout, layoutNodePositions, layoutNodes, NODE_DIMENSIONS } from './layout';
import { layoutNodesInWorker } from './graphLayoutClient';

function node(id: string): Node<Record<string, unknown>> {
  return {
    id,
    position: { x: 0, y: 0 },
    data: {},
  };
}

describe('branch graph layout', () => {
  it('keeps layout dimensions aligned with the route-summary node card budget', () => {
    expect(NODE_DIMENSIONS).toEqual({ width: 320, height: 228 });
  });

  it('returns deterministic dagre positions for connected nodes', () => {
    const positions = layoutNodePositions(['a', 'b'], [{ source: 'a', target: 'b' }]);

    expect(positions['a']).toBeDefined();
    expect(positions['b']).toBeDefined();
    expect(positions['b']!.y).toBeGreaterThan(positions['a']!.y);
  });

  it('keeps orphan nodes separated from the connected graph', () => {
    const result = layoutNodes(
      [node('a'), node('b'), node('orphan')],
      [{ id: 'a-b', source: 'a', target: 'b' } as Edge],
    );

    const connectedMaxX = Math.max(
      result.nodes.find((item) => item.id === 'a')!.position.x,
      result.nodes.find((item) => item.id === 'b')!.position.x,
    );
    const orphan = result.nodes.find((item) => item.id === 'orphan')!;

    expect(orphan.position.x).toBeGreaterThan(connectedMaxX);
  });

  it('applies a bounded fast grid path for large graphs without dagre', () => {
    const nodes = Array.from({ length: 200 }, (_, index) => node(`n-${index}`));
    const result = applyFastGridLayout(nodes);

    expect(result).toHaveLength(200);
    expect(result[0]!.position).toEqual({ x: 0, y: 0 });
    expect(new Set(result.map((item) => `${item.position.x}:${item.position.y}`)).size).toBe(200);
  });

  it('keeps very large graphs on the fallback path before worker dagre runs', async () => {
    const nodes = Array.from({ length: 1000 }, (_, index) => ({
      ...node(`n-${index}`),
      position: { x: index, y: index * 2 },
    }));

    const result = await layoutNodesInWorker(nodes, []);

    expect(result.layoutMode).toBe('fallback-grid');
    expect(result.stale).toBe(false);
    expect(result.nodes[999]!.position).toEqual({ x: 999, y: 1998 });
  });
});
