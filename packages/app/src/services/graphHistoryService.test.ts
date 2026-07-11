import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canRedo,
  canUndo,
  clearGraphHistory,
  configureGraphHistoryReplay,
  getGraphHistoryState,
  invalidateGraphRedo,
  recordGraphEdit,
  redoGraphEdit,
  subscribeGraphHistory,
  undoGraphEdit,
  type GraphHistoryEntry,
} from './graphHistoryService';

function entry(index: number): GraphHistoryEntry {
  return {
    beforeContent: `content-${index}`,
    afterContent: `content-${index + 1}`,
    beforeSelectedNodeId: `node-${index}`,
    afterSelectedNodeId: `node-${index + 1}`,
    beforeActiveChapterId: `chapter-${index}`,
    afterActiveChapterId: `chapter-${index + 1}`,
    source: `test-${index}`,
  };
}

describe('graphHistoryService', () => {
  beforeEach(() => {
    clearGraphHistory();
    configureGraphHistoryReplay(null);
  });

  it('keeps only the latest 100 graph edits', async () => {
    const replayedContents: string[] = [];
    configureGraphHistoryReplay((target) => {
      replayedContents.push(target.content);
    });

    for (let index = 0; index < 101; index += 1) {
      recordGraphEdit(entry(index));
    }

    expect(getGraphHistoryState()).toMatchObject({ undoDepth: 100, redoDepth: 0 });

    for (let index = 0; index < 100; index += 1) {
      await undoGraphEdit();
    }

    expect(replayedContents).toHaveLength(100);
    expect(replayedContents.at(-1)).toBe('content-1');
    expect(canUndo()).toBe(false);
    expect(getGraphHistoryState()).toMatchObject({ undoDepth: 0, redoDepth: 100 });
  });

  it('invalidates redo after a new edit or an explicit invalidation', async () => {
    configureGraphHistoryReplay(() => undefined);
    recordGraphEdit(entry(0));

    await undoGraphEdit();
    expect(canRedo()).toBe(true);

    recordGraphEdit(entry(10));
    expect(canRedo()).toBe(false);

    await undoGraphEdit();
    expect(canRedo()).toBe(true);

    invalidateGraphRedo();
    expect(canRedo()).toBe(false);
  });

  it('replays content, selection, chapter, direction, and source', async () => {
    const replay = vi.fn();
    configureGraphHistoryReplay(replay);
    recordGraphEdit(entry(4));

    await undoGraphEdit();
    expect(replay).toHaveBeenNthCalledWith(
      1,
      {
        content: 'content-4',
        selectedNodeId: 'node-4',
        activeChapterId: 'chapter-4',
      },
      expect.objectContaining({ direction: 'undo', source: 'test-4' }),
    );

    await redoGraphEdit();
    expect(replay).toHaveBeenNthCalledWith(
      2,
      {
        content: 'content-5',
        selectedNodeId: 'node-5',
        activeChapterId: 'chapter-5',
      },
      expect.objectContaining({ direction: 'redo', source: 'test-4' }),
    );
  });

  it('clears both stacks and notifies subscribers', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeGraphHistory(listener);
    configureGraphHistoryReplay(() => undefined);
    recordGraphEdit(entry(0));
    await undoGraphEdit();

    clearGraphHistory();

    expect(getGraphHistoryState()).toEqual({
      canUndo: false,
      canRedo: false,
      undoDepth: 0,
      redoDepth: 0,
      isReplaying: false,
    });
    expect(listener).toHaveBeenLastCalledWith(getGraphHistoryState());
    unsubscribe();
  });

  it('does not record edits triggered by replay', async () => {
    recordGraphEdit(entry(0));
    configureGraphHistoryReplay(() => {
      expect(recordGraphEdit(entry(20))).toBe(false);
    });

    await undoGraphEdit();

    expect(getGraphHistoryState()).toMatchObject({ undoDepth: 0, redoDepth: 1 });
  });

  it('leaves history intact when replay fails', async () => {
    recordGraphEdit(entry(0));
    configureGraphHistoryReplay(() => {
      throw new Error('replay failed');
    });

    await expect(undoGraphEdit()).rejects.toThrow('replay failed');
    expect(getGraphHistoryState()).toMatchObject({
      canUndo: true,
      canRedo: false,
      undoDepth: 1,
      redoDepth: 0,
      isReplaying: false,
    });
  });
});
