import { useEditorStore } from '../stores/editorStore';
import type { StoryIdentity } from './storySnapshot';

export type SourceDraftFlushReason =
  | 'save'
  | 'replace'
  | 'export'
  | 'graph'
  | 'chapter'
  | 'workspace';

export interface SourceDraftState {
  readonly isDirty: boolean;
  readonly isStale: boolean;
}

export type DraftFlushResult =
  | {
      readonly ok: true;
      readonly disposition: 'clean' | 'committed';
      readonly identity: StoryIdentity;
    }
  | {
      readonly ok: false;
      readonly reason: 'stale' | 'commit-failed' | 'graph-edit-active';
    };

export interface SourceDraftController {
  readonly getState: () => SourceDraftState;
  readonly flushDraft: (reason: SourceDraftFlushReason) => DraftFlushResult | boolean;
}

let activeController: SourceDraftController | null = null;

export function getCurrentStoryIdentity(): StoryIdentity {
  const editor = useEditorStore.getState();
  return {
    storySessionId: editor.storySessionId,
    contentRevision: editor.contentRevision,
    sourceDraftRevision: editor.sourceDraftRevision,
  };
}

function bumpControllerLifecycle(): void {
  useEditorStore.getState().bumpSourceDraftRevision();
}

export function registerSourceDraftController(controller: SourceDraftController): () => void {
  activeController = controller;
  bumpControllerLifecycle();
  return () => {
    if (activeController === controller) {
      activeController = null;
      bumpControllerLifecycle();
    }
  };
}

export function flushSourceDraft(reason: SourceDraftFlushReason): DraftFlushResult {
  if (!activeController) {
    return { ok: true, disposition: 'clean', identity: getCurrentStoryIdentity() };
  }

  const result = activeController.flushDraft(reason);
  if (typeof result !== 'boolean') return result;
  return result
    ? { ok: true, disposition: 'committed', identity: getCurrentStoryIdentity() }
    : { ok: false, reason: activeController.getState().isStale ? 'stale' : 'commit-failed' };
}

/** @deprecated 新代码应消费 flushSourceDraft() 的结构化结果。 */
export function flushSourceDraftBeforeSaveOrReplace(reason: SourceDraftFlushReason): boolean {
  return flushSourceDraft(reason).ok;
}

export function getSourceDraftState(): SourceDraftState {
  return activeController?.getState() ?? { isDirty: false, isStale: false };
}

export function hasSourceDraftRisk(): boolean {
  const state = getSourceDraftState();
  return state.isDirty || state.isStale;
}
