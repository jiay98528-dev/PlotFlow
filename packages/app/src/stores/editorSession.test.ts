import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editorStore';

describe('Editor storySessionId', () => {
  beforeEach(() => {
    useEditorStore.setState({ storySessionId: 0 });
  });

  it('increments monotonically when a new story session begins', () => {
    useEditorStore.getState().beginStorySession();
    useEditorStore.getState().beginStorySession();
    expect(useEditorStore.getState().storySessionId).toBe(2);
  });

  it('invalidates session-scoped drafts when the editor store resets', () => {
    useEditorStore.getState().setContent('draft');
    useEditorStore.getState().reset();
    expect(useEditorStore.getState().storySessionId).toBe(1);
    expect(useEditorStore.getState().content).toBe('');
  });
});
