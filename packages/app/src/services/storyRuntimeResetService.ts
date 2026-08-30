import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useStoryStore } from '../stores/storyStore';
import { useUIStore } from '../stores/uiStore';
import { clearGraphHistory } from './graphHistoryService';

interface ResetStoryRuntimeOptions {
  readonly nextContent: string;
  readonly closeHome?: boolean;
}

/**
 * Clears all story-bound renderer state without touching auto-save module state.
 * Keeping this helper independent from autoSaveService lets external reloads use
 * the same reset path without introducing a circular dependency.
 */
export function resetStoryRuntimeState(options: ResetStoryRuntimeOptions): void {
  clearGraphHistory();

  const editor = useEditorStore.getState();
  // Session identity and canonical content must change in one Zustand update.
  // Otherwise mounted Source Drawer controllers can observe a new session with
  // the old chapter slice and later splice that stale slice into the new story.
  editor.beginStorySession(options.nextContent);
  editor.setDiagnostics([]);
  editor.setActiveNodeId(null);
  editor.setCursorPosition(1, 1);
  editor.clearPendingExternalChange();

  useStoryStore.getState().clearParseData();
  useGraphStore.getState().syncFromAST(null);

  const ui = useUIStore.getState();
  ui.setActiveChapterId(null);
  ui.setCompactGraphPanel(null);
  ui.setSourceDrawerOpen(false);
  ui.setProblemPanelOpen(false);
  ui.closeExportDialog();
  ui.closeThemeCenter();
  if (ui.isConditionEditorOpen) {
    ui.toggleConditionEditor();
  }
  if (options.closeHome ?? true) {
    ui.setHomeSurfaceOpen(false);
  }
}

export function isCurrentStorySession(sessionId: number): boolean {
  return useEditorStore.getState().storySessionId === sessionId;
}
