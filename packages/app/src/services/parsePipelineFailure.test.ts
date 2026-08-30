import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlotFlowData } from '@plotflow/core';

const { createStorySnapshotMock } = vi.hoisted(() => ({
  createStorySnapshotMock: vi.fn(),
}));

vi.mock('./storySnapshot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./storySnapshot')>();
  return { ...actual, createStorySnapshot: createStorySnapshotMock };
});

import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useStoryStore } from '../stores/storyStore';
import { parsePipelineNow } from './parsePipeline';

const OLD_DATA: PlotFlowData = {
  sourcePath: null,
  meta: { plotflow: '0.1', title: 'Old', author: 'test' },
  variables: [],
  chapters: [
    {
      id: 'chapter',
      title: 'chapter',
      isAnonymous: false,
      lineNumber: 1,
      nodes: [
        {
          id: 'old',
          fullId: 'chapter/old',
          title: 'old',
          body: 'old',
          chapterId: 'chapter',
          options: [],
          diagnostics: { isRoot: true, isOrphan: false, isDeadEnd: true, diagnosticIds: [] },
          lineNumber: 2,
        },
      ],
    },
  ],
};

describe('parse pipeline unexpected failure', () => {
  beforeEach(() => {
    createStorySnapshotMock.mockReset();
    useEditorStore.getState().reset();
    useStoryStore.getState().clearParseData();
    useGraphStore.getState().syncFromAST(null);
  });

  it('invalidates an older AST and graph while retaining the failed source identity', () => {
    const oldIdentity = {
      storySessionId: useEditorStore.getState().storySessionId,
      contentRevision: useEditorStore.getState().contentRevision,
      sourceDraftRevision: useEditorStore.getState().sourceDraftRevision,
    };
    useStoryStore.getState().setPlotFlowData(OLD_DATA, oldIdentity);
    useGraphStore.getState().syncFromAST(OLD_DATA);
    useEditorStore.getState().setContent('new source');
    const failedIdentity = {
      storySessionId: useEditorStore.getState().storySessionId,
      contentRevision: useEditorStore.getState().contentRevision,
      sourceDraftRevision: useEditorStore.getState().sourceDraftRevision,
    };
    createStorySnapshotMock.mockReturnValue({ ok: false, error: new Error('parser exploded') });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(parsePipelineNow('new source')).toBeNull();

    expect(useStoryStore.getState()).toMatchObject({
      plotFlowData: null,
      snapshotIdentity: failedIdentity,
      parseError: 'parser exploded',
    });
    expect(useGraphStore.getState().nodes).toEqual([]);
    expect(useEditorStore.getState().diagnostics).toEqual([]);
    consoleError.mockRestore();
  });
});
