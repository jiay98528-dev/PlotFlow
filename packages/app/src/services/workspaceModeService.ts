import { appT } from '../i18n/appI18n';
import { useUIStore, type WorkspaceMode } from '../stores/uiStore';
import {
  flushSourceDraftBeforeSaveOrReplace,
  getSourceDraftState,
} from './sourceDraftCoordinator';

function text(key: string): string {
  const ui = useUIStore.getState();
  return appT(key, undefined, ui.language);
}

/**
 * 唯一的工作区切换入口。
 *
 * Graph Lab 会在卸载时销毁 Source Drawer，因此进入 Split 前必须先把
 * 有效草稿提交到当前故事；stale 草稿没有安全的自动合并策略，必须留在
 * Graph Lab 由用户还原或重新载入。
 */
export function requestWorkspaceMode(mode: WorkspaceMode): boolean {
  const ui = useUIStore.getState();
  if (ui.workspaceMode === mode) return true;

  if (ui.workspaceMode === 'graphLab' && mode === 'split') {
    const draft = getSourceDraftState();
    if (draft.isStale) {
      ui.setStatusMessage(text('sourceDock.workspaceSwitchBlockedStale'));
      return false;
    }
    if (draft.isDirty && !flushSourceDraftBeforeSaveOrReplace('replace')) {
      ui.setStatusMessage(text('sourceDock.workspaceSwitchBlockedDraft'));
      return false;
    }
  }

  ui.setWorkspaceMode(mode);
  return true;
}

export function toggleRequestedWorkspaceMode(): boolean {
  const current = useUIStore.getState().workspaceMode;
  return requestWorkspaceMode(current === 'graphLab' ? 'split' : 'graphLab');
}
