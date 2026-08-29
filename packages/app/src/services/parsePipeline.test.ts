import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useStoryStore } from '../stores/storyStore';
import { parsePipelineNow } from './parsePipeline';

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
});
