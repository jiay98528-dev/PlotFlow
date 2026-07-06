import { describe, expect, it, vi } from 'vitest';
import type { PlotFlowData, StoryNode } from '@plotflow/core';

vi.mock('./layout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./layout')>();
  return {
    ...actual,
    layoutNodes: vi.fn(() => {
      throw new Error('sync Dagre layout must not run from adapter');
    }),
  };
});

const {
  plotFlowDataToFlow,
  resolveStoryFullIdForFlowNodeId,
} = await import('./adapter');
const { layoutNodes } = await import('./layout');

function makeNode(
  id: string,
  position?: { x: number; y: number },
  nextTarget?: StoryNode['nextTarget'],
): StoryNode {
  return {
    id,
    fullId: `Chapter-${id}`,
    title: id,
    body: '',
    chapterId: 'Chapter',
    options: [],
    nextTarget,
    diagnostics: {
      isRoot: false,
      isOrphan: false,
      isDeadEnd: false,
      diagnosticIds: [],
    },
    lineNumber: 1,
    position,
  };
}

function makeAst(nodes: StoryNode[]): PlotFlowData {
  return {
    sourcePath: null,
    meta: {
      plotflow: '0.1',
      title: 'Layout Test',
      author: 'QA',
    },
    variables: [],
    chapters: [{
      id: 'Chapter',
      title: 'Chapter',
      isAnonymous: false,
      lineNumber: 1,
      nodes,
    }],
  };
}

describe('plotFlowDataToFlow layout handoff', () => {
  it('keeps fully persisted coordinates without running sync Dagre', () => {
    const result = plotFlowDataToFlow(makeAst([
      makeNode('A', { x: 10, y: 20 }),
      makeNode('B', { x: 120, y: 240 }),
    ]));

    expect(layoutNodes).not.toHaveBeenCalled();
    expect(result.nodes.find((node) => node.id === 'Chapter-A')?.position).toEqual({ x: 10, y: 20 });
    expect(result.nodes.find((node) => node.id === 'Chapter-B')?.position).toEqual({ x: 120, y: 240 });
  });

  it('does not overwrite partial persisted coordinates while provisional-grid placing missing nodes', () => {
    const result = plotFlowDataToFlow(makeAst([
      makeNode('A', { x: 10, y: 20 }),
      makeNode('B'),
    ]));

    expect(layoutNodes).not.toHaveBeenCalled();
    expect(result.nodes.find((node) => node.id === 'Chapter-A')?.position).toEqual({ x: 10, y: 20 });
    expect(result.nodes.find((node) => node.id === 'Chapter-B')?.position).toEqual({ x: 300, y: 0 });
  });

  it('maps React Flow duplicate ids back without stripping user-authored hash suffixes', () => {
    const result = plotFlowDataToFlow(makeAst([
      makeNode('Ending#1'),
      makeNode('Ending#1'),
    ]));

    expect(resolveStoryFullIdForFlowNodeId('Chapter-Ending#1', result.nodes))
      .toBe('Chapter-Ending#1');
    expect(resolveStoryFullIdForFlowNodeId('Chapter-Ending#1#2', result.nodes))
      .toBe('Chapter-Ending#1');
    expect(resolveStoryFullIdForFlowNodeId('Chapter-Unknown#2', result.nodes))
      .toBe('Chapter-Unknown#2');
  });

  it('creates a default next edge from node-level flow exits', () => {
    const result = plotFlowDataToFlow(makeAst([
      makeNode('A', undefined, {
        targetNodeId: 'B',
        targetChapterId: null,
        targetFullId: 'Chapter-B',
        raw: '节点：B',
        sideEffects: [],
        effectsRaw: null,
        lineNumber: 4,
      }),
      makeNode('B'),
    ]));

    expect(layoutNodes).not.toHaveBeenCalled();
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      source: 'Chapter-A',
      target: 'Chapter-B',
      sourceHandle: 'next',
    });
  });
});
