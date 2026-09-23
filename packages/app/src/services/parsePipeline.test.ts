import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useStoryStore } from '../stores/storyStore';
import { parsePipelineNow } from './parsePipeline';
import { useUIStore } from '../stores/uiStore';

const STORY = `# 章

## 节点：开始

正文。
`;

describe('parse pipeline state consistency', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
    useStoryStore.getState().clearParseData();
    useGraphStore.getState().syncFromAST(null);
  });

  it('publishes empty source and clears the previous graph', () => {
    useEditorStore.getState().setContent(STORY);
    parsePipelineNow(STORY);
    expect(useGraphStore.getState().nodes.length).toBeGreaterThan(0);

    useEditorStore.getState().setContent('');
    parsePipelineNow('');

    expect(useStoryStore.getState().plotFlowData?.chapters).toEqual([]);
    expect(useGraphStore.getState().nodes).toEqual([]);
    expect(useGraphStore.getState().edges).toEqual([]);
  });

  it('keeps an explicit file-open failure visible when a later parse reports diagnostics', () => {
    const source = `${STORY}\n[选项] 继续 -> 节点：不存在\n`;
    useEditorStore.getState().setContent(source);
    useUIStore.getState().setStatusMessage('file:D:/missing.mdstory ENOENT');
    parsePipelineNow(source);
    expect(useEditorStore.getState().diagnostics.some((item) => item.severity === 'error')).toBe(true);
    expect(useUIStore.getState().statusMessage).toBe('file:D:/missing.mdstory ENOENT');
    useUIStore.getState().setStatusMessage('');
  });
});
