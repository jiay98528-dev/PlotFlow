import { useEditorStore } from '../stores/editorStore';
import { useStoryStore } from '../stores/storyStore';
import { useUIStore } from '../stores/uiStore';
import { clearPendingSave, resetAutoSaveBaseline } from './autoSaveService';
import { parsePipelineNow } from './parsePipeline';
import { rememberRecentStory } from './recentFileService';
import { resetStoryRuntimeState } from './storyRuntimeResetService';

interface ResetStorySessionOptions {
  readonly closeHome?: boolean;
}

interface LoadSavedStorySessionOptions extends ResetStorySessionOptions {
  readonly filePath: string;
  readonly content: string;
  readonly hash: string;
  readonly modifiedAt: number;
  readonly rememberRecent?: boolean;
}

interface StartUnsavedStorySessionOptions extends ResetStorySessionOptions {
  readonly content: string;
}

export function resetStorySession(options: ResetStorySessionOptions = {}): void {
  clearPendingSave();
  resetAutoSaveBaseline(null);
  resetStoryRuntimeState(options);
}

function selectFirstParsedChapter(): void {
  const firstChapterId = useStoryStore.getState().plotFlowData?.chapters[0]?.id ?? null;
  useUIStore.getState().setActiveChapterId(firstChapterId);
}

export function loadSavedStorySession(options: LoadSavedStorySessionOptions): void {
  const normalizedPath = options.filePath.replace(/\\/g, '/');
  resetStorySession({ closeHome: options.closeHome });
  const editor = useEditorStore.getState();
  editor.setFilePath(normalizedPath);
  editor.setFileBaseline(options.hash, options.modifiedAt);
  editor.setContent(options.content);
  editor.markSaved();
  resetAutoSaveBaseline(options.content);
  if (options.rememberRecent ?? true) {
    rememberRecentStory(normalizedPath, options.hash, options.modifiedAt);
  }
  parsePipelineNow(options.content);
  selectFirstParsedChapter();
}

export function startUnsavedStorySession(options: StartUnsavedStorySessionOptions): void {
  resetStorySession({ closeHome: options.closeHome });
  const editor = useEditorStore.getState();
  editor.setFilePath(null);
  editor.setFileBaseline(null, null);
  editor.setContent(options.content);
  resetAutoSaveBaseline(null);
  parsePipelineNow(options.content);
  selectFirstParsedChapter();
}
