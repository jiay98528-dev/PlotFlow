import { useEditorStore } from '../stores/editorStore';
import { useUIStore } from '../stores/uiStore';
import { appT } from '../i18n/appI18n';
import {
  hasCurrentStoryUnsavedChanges,
  prepareCurrentStoryForDestructiveExit,
  saveOrSaveAs,
} from './autoSaveService';
import { getSourceDraftState } from './sourceDraftCoordinator';

export type StoryReplaceReason = 'open' | 'new' | 'workspace';

function text(key: string, params?: Readonly<Record<string, string | number>>): string {
  return appT(key, params, useUIStore.getState().language);
}

export async function confirmBeforeReplacingCurrentStory(reason: StoryReplaceReason): Promise<boolean> {
  if (!hasCurrentStoryUnsavedChanges()) return true;
  if (getSourceDraftState().isStale) {
    useUIStore.getState().setStatusMessage(text('sourceDock.switchBlockedStale'));
    return false;
  }

  const editor = useEditorStore.getState();
  const isNew = reason === 'new';
  const choice = await window.plotflow.dialog.confirm({
    type: 'warning',
    message: isNew ? text('file.unsavedTitle') : text('home.unsavedConfirmTitle'),
    detail: isNew
      ? editor.filePath
        ? text('file.newDirtyNamed', { path: editor.filePath })
        : text('file.newDirtyUnnamed')
      : editor.filePath
        ? text('file.openDirtyNamed', { path: editor.filePath })
        : text('file.openDirtyUnnamed'),
    buttons: isNew
      ? [text('file.saveAndNew'), text('file.discardAndNew'), text('common.cancel')]
      : [text('home.saveAndOpen'), text('home.discardAndOpen'), text('common.cancel')],
  });

  if (choice === 0) {
    return saveOrSaveAs();
  }
  if (choice === 1) {
    return prepareCurrentStoryForDestructiveExit();
  }
  return false;
}
