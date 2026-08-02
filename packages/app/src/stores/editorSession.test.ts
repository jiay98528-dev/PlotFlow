import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editorStore';

describe('Editor storySessionId', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
    useEditorStore.setState({ storySessionId: 0, contentRevision: 0, sourceDraftRevision: 0 });
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

  it('publishes a replacement session and its canonical content atomically', () => {
    useEditorStore.getState().setContent('old story');
    const observed: Array<{ session: number; content: string }> = [];
    const unsubscribe = useEditorStore.subscribe((state) => {
      observed.push({ session: state.storySessionId, content: state.content });
    });

    useEditorStore.getState().beginStorySession('new story');
    unsubscribe();

    expect(observed).toEqual([{ session: 1, content: 'new story' }]);
    expect(useEditorStore.getState().sourceDraftRevision).toBe(1);
  });

  it('increments contentRevision only when canonical text changes', () => {
    const editor = useEditorStore.getState();
    editor.setContent('same');
    const changedRevision = useEditorStore.getState().contentRevision;
    useEditorStore.getState().setContent('same');
    expect(useEditorStore.getState().contentRevision).toBe(changedRevision);
    useEditorStore.getState().setContent('different');
    expect(useEditorStore.getState().contentRevision).toBe(changedRevision + 1);
  });

  it('tracks Source Drawer lifecycle independently from canonical content', () => {
    const before = useEditorStore.getState();
    before.bumpSourceDraftRevision();
    const after = useEditorStore.getState();
    expect(after.sourceDraftRevision).toBe(before.sourceDraftRevision + 1);
    expect(after.contentRevision).toBe(before.contentRevision);
  });
});
