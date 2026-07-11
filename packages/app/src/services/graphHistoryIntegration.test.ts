import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useStoryStore } from '../stores/storyStore';
import { useUIStore } from '../stores/uiStore';
import { clearPendingSave } from './autoSaveService';
import { graphEditService } from './graphEditService';
import {
  canRedo,
  canUndo,
  clearGraphHistory,
  getGraphHistoryState,
  redoGraphEdit,
  undoGraphEdit,
} from './graphHistoryService';
import { parsePipelineNow } from './parsePipeline';

const STORY = `---
plotflow: 0.1
title: History
---

# Chapter

## 节点：Start

Body.
`;

describe('Graph Lab history integration', () => {
  beforeEach(() => {
    clearGraphHistory();
    clearPendingSave();
    useEditorStore.getState().reset();
    useUIStore.setState({ workspaceMode: 'graphLab', activeChapterId: 'Chapter' });
    useEditorStore.getState().setContent(STORY);
    parsePipelineNow(STORY);
    useGraphStore.getState().selectNode('Chapter/Start');
    useEditorStore.getState().setActiveNodeId('Chapter/Start');
  });

  afterEach(() => {
    clearPendingSave();
    clearGraphHistory();
  });

  it('undoes and redoes a Graph command without a Monaco instance', async () => {
    expect(useEditorStore.getState().editorInstance).toBeNull();

    expect(graphEditService.createNode({ chapterTitle: 'Chapter', title: 'Created' })).toBe(true);
    expect(useEditorStore.getState().content).toContain('## 节点：Created');
    expect(canUndo()).toBe(true);

    await expect(undoGraphEdit()).resolves.toBe(true);
    expect(useEditorStore.getState().content).not.toContain('## 节点：Created');
    expect(canRedo()).toBe(true);

    await expect(redoGraphEdit()).resolves.toBe(true);
    expect(useEditorStore.getState().content).toContain('## 节点：Created');
  });

  it('restores the selected node across rename undo and redo', async () => {
    const start = useStoryStore.getState().getNodeByFullId('Chapter/Start')!;
    expect(graphEditService.updateNode(start, { title: 'Renamed' })).toBe(true);
    expect(useGraphStore.getState().selectedNodeId).toBe('Chapter/Renamed');

    await undoGraphEdit();
    expect(useEditorStore.getState().content).toContain('## 节点：Start');
    expect(useGraphStore.getState().selectedNodeId).toBe('Chapter/Start');

    await redoGraphEdit();
    expect(useEditorStore.getState().content).toContain('## 节点：Renamed');
    expect(useGraphStore.getState().selectedNodeId).toBe('Chapter/Renamed');
  });

  it('restores a deleted selected node across undo and redo', async () => {
    const start = useStoryStore.getState().getNodeByFullId('Chapter/Start')!;
    expect(graphEditService.deleteNode(start)).toBe(true);
    expect(useGraphStore.getState().selectedNodeId).toBeNull();

    await undoGraphEdit();
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Start')).toBeDefined();
    expect(useGraphStore.getState().selectedNodeId).toBe('Chapter/Start');

    await redoGraphEdit();
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Start')).toBeUndefined();
    expect(useGraphStore.getState().selectedNodeId).toBeNull();
  });

  it('undoes and redoes an option connection', async () => {
    const start = useStoryStore.getState().getNodeByFullId('Chapter/Start')!;
    expect(graphEditService.addOption(start, { description: 'Continue' })).toBe(true);
    expect(graphEditService.createNode({ chapterTitle: 'Chapter', title: 'Target' })).toBe(true);
    clearGraphHistory();

    const updatedStart = useStoryStore.getState().getNodeByFullId('Chapter/Start')!;
    const option = updatedStart.options[0]!;
    expect(graphEditService.connectOption(option, 'Chapter/Target')).toBe(true);
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Start')?.options[0]?.targetFullId)
      .toBe('Chapter/Target');

    await undoGraphEdit();
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Start')?.options[0]?.targetFullId)
      .toBeNull();

    await redoGraphEdit();
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Start')?.options[0]?.targetFullId)
      .toBe('Chapter/Target');
  });

  it('records a bulk position commit as one undoable graph edit', async () => {
    expect(graphEditService.createNode({ chapterTitle: 'Chapter', title: 'Target' })).toBe(true);
    clearGraphHistory();
    useGraphStore.getState().selectNode('Chapter/Start');

    expect(graphEditService.updateNodePositions([
      { fullId: 'Chapter/Start', position: { x: 120, y: 240 } },
      { fullId: 'Chapter/Target', position: { x: 360, y: 480 } },
    ])).toBe(true);
    expect(getGraphHistoryState().undoDepth).toBe(1);
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Start')?.position).toEqual({ x: 120, y: 240 });
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Target')?.position).toEqual({ x: 360, y: 480 });

    await undoGraphEdit();
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Start')?.position).toBeUndefined();
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Target')?.position).toBeUndefined();
    expect(useGraphStore.getState().selectedNodeId).toBe('Chapter/Start');
    expect(useUIStore.getState().activeChapterId).toBe('Chapter');
    expect(canUndo()).toBe(false);

    await redoGraphEdit();
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Start')?.position).toEqual({ x: 120, y: 240 });
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Target')?.position).toEqual({ x: 360, y: 480 });
    expect(useGraphStore.getState().selectedNodeId).toBe('Chapter/Start');
    expect(useUIStore.getState().activeChapterId).toBe('Chapter');
  });

  it('keeps 100 transient drag positions out of history and commits only drag stop', async () => {
    const originalNodes = [{
      id: 'Chapter/Start',
      position: { x: 0, y: 0 },
      data: { fullId: 'Chapter/Start' },
    }];
    useGraphStore.getState().setNodes(originalNodes);

    for (let index = 1; index <= 100; index++) {
      useGraphStore.getState().setNodes(originalNodes.map((node) => ({
        ...node,
        position: { x: index, y: index * 2 },
      })));
    }
    expect(getGraphHistoryState()).toMatchObject({ undoDepth: 0, redoDepth: 0 });

    expect(graphEditService.updateNodePositions([
      { fullId: 'Chapter/Start', position: { x: 100, y: 200 } },
    ])).toBe(true);
    expect(getGraphHistoryState()).toMatchObject({ undoDepth: 1, redoDepth: 0 });

    await undoGraphEdit();
    expect(useStoryStore.getState().getNodeByFullId('Chapter/Start')?.position).toBeUndefined();
  });
});
