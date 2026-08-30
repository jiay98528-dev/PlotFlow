import { beforeEach, describe, expect, it } from 'vitest';
import type { PlotFlowData, StoryNode } from '@plotflow/core';
import { useStoryStore } from './storyStore';

function node(index: number): StoryNode {
  return {
    id: `node-${index}`,
    fullId: `chapter/node-${index}`,
    title: `Node ${index}`,
    body: '',
    chapterId: 'chapter',
    options: [],
    diagnostics: { isRoot: index === 0, isOrphan: index > 0, isDeadEnd: true, diagnosticIds: [] },
    lineNumber: 10 + index * 3,
  };
}

describe('storyStore line index', () => {
  beforeEach(() => useStoryStore.getState().clearParseData());

  it('finds predecessors correctly in a large AST', () => {
    const nodes = Array.from({ length: 1_000 }, (_, index) => node(index));
    const data: PlotFlowData = {
      sourcePath: null,
      meta: { plotflow: '0.1', title: 'Large', author: 'test' },
      variables: [],
      chapters: [{ id: 'chapter', title: 'chapter', isAnonymous: false, nodes, lineNumber: 1 }],
    };
    useStoryStore.getState().setPlotFlowData(data);

    expect(useStoryStore.getState().getNodeByLine(9)).toBeNull();
    expect(useStoryStore.getState().getNodeByLine(10)).toBe('chapter/node-0');
    expect(useStoryStore.getState().getNodeByLine(1_510)).toBe('chapter/node-500');
    expect(useStoryStore.getState().getNodeByLine(100_000)).toBe('chapter/node-999');
  });
});
