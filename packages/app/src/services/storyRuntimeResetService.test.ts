import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useStoryStore } from '../stores/storyStore';
import { useUIStore } from '../stores/uiStore';
import { applyExternalFileContent, hasPendingSaveWork } from './autoSaveService';
import { canUndo, recordGraphEdit } from './graphHistoryService';
import { isCurrentStorySession } from './storyRuntimeResetService';

const reloadedStory = `---
plotflow: 0.1
title: Reloaded
---

# Chapter
## 节点：Start
Reloaded body.
`;

describe('story runtime reset', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
    useStoryStore.getState().clearParseData();
    useGraphStore.getState().syncFromAST(null);
    useUIStore.getState().setActiveChapterId(null);
  });

  it('invalidates a drag token when an external reload begins a new session', async () => {
    const dragSessionId = useEditorStore.getState().storySessionId;
    useGraphStore.getState().setEditing(true);
    recordGraphEdit({
      beforeContent: 'before',
      afterContent: 'after',
      beforeSelectedNodeId: null,
      afterSelectedNodeId: 'old-node',
      beforeActiveChapterId: null,
      afterActiveChapterId: 'old-chapter',
      source: 'test-drag',
    });

    const reloadEvent = {
      filePath: 'D:/stories/reloaded.mdstory',
      content: reloadedStory,
      hash: 'reload-hash',
      modifiedAt: 42,
    };
    useEditorStore.getState().setFilePath(reloadEvent.filePath);
    useEditorStore.getState().setPendingExternalChange(reloadEvent);
    await applyExternalFileContent(reloadEvent);

    expect(isCurrentStorySession(dragSessionId)).toBe(false);
    expect(useGraphStore.getState().isEditing).toBe(false);
    expect(useStoryStore.getState().plotFlowData?.meta.title).toBe('Reloaded');
    expect(canUndo()).toBe(false);
    expect(hasPendingSaveWork()).toBe(false);
  });
});
