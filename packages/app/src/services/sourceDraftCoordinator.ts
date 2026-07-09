export type SourceDraftFlushReason = 'save' | 'replace';

export interface SourceDraftState {
  readonly isDirty: boolean;
  readonly isStale: boolean;
}

export interface SourceDraftController {
  readonly getState: () => SourceDraftState;
  readonly flushDraft: (reason: SourceDraftFlushReason) => boolean;
}

let activeController: SourceDraftController | null = null;

export function registerSourceDraftController(controller: SourceDraftController): () => void {
  activeController = controller;
  return () => {
    if (activeController === controller) {
      activeController = null;
    }
  };
}

export function flushSourceDraftBeforeSaveOrReplace(reason: SourceDraftFlushReason): boolean {
  return activeController?.flushDraft(reason) ?? true;
}

export function getSourceDraftState(): SourceDraftState {
  return activeController?.getState() ?? { isDirty: false, isStale: false };
}

export function hasSourceDraftRisk(): boolean {
  const state = getSourceDraftState();
  return state.isDirty || state.isStale;
}
