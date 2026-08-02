import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useUIStore } from '../stores/uiStore';
import { appT } from '../i18n/appI18n';
import {
  flushSourceDraft,
  getCurrentStoryIdentity,
  type DraftFlushResult,
  type SourceDraftFlushReason,
} from './sourceDraftCoordinator';
import {
  createStorySnapshot,
  sameStoryIdentity,
  type PreparedStorySnapshot,
  type StoryIdentity,
} from './storySnapshot';
import { publishStorySnapshot } from './parsePipeline';
import { confirmBeforeReplacingCurrentStory, type StoryReplaceReason } from './storyReplaceGuard';
import { loadSavedStorySession, startUnsavedStorySession } from './storySessionService';

export type StorySnapshotIntent = 'save' | 'export' | 'graph' | 'chapter' | 'workspace';
type DraftFlushFailureReason = Extract<DraftFlushResult, { readonly ok: false }>['reason'];

export type PrepareStorySnapshotResult =
  | { readonly ok: true; readonly snapshot: PreparedStorySnapshot }
  | {
      readonly ok: false;
      readonly reason: DraftFlushFailureReason | 'parse-failed';
    };

export type StoryReplacementPayload =
  | {
      readonly kind: 'saved';
      readonly filePath: string;
      readonly content: string;
      readonly hash: string;
      readonly modifiedAt: number;
      readonly closeHome?: boolean;
      readonly rememberRecent?: boolean;
    }
  | {
      readonly kind: 'unsaved';
      readonly content: string;
      readonly closeHome?: boolean;
    };

export type StoryReplacementResult =
  | { readonly status: 'committed' }
  | { readonly status: 'cancelled' | 'busy' | 'stale' }
  | { readonly status: 'failed'; readonly error: unknown };

let activeReplacement: symbol | null = null;

function text(key: string): string {
  const ui = useUIStore.getState();
  return appT(key, undefined, ui.language);
}

function revealDraftFailure(reason: DraftFlushFailureReason): void {
  const ui = useUIStore.getState();
  if (reason === 'stale' || reason === 'commit-failed') {
    ui.setSourceDrawerOpen(true);
    ui.setStatusMessage(
      text(
        reason === 'stale'
          ? 'sourceDock.switchBlockedStale'
          : 'sourceDock.workspaceSwitchBlockedDraft',
      ),
    );
  }
}

function flushReasonForIntent(intent: StorySnapshotIntent): SourceDraftFlushReason {
  return intent;
}

function syncMonacoContent(): void {
  const editor = useEditorStore.getState();
  const modelContent = editor.editorInstance?.getValue();
  if (typeof modelContent === 'string' && modelContent !== editor.content) {
    editor.setContent(modelContent);
  }
}

export function prepareStorySnapshot(intent: StorySnapshotIntent): PrepareStorySnapshotResult {
  if (useGraphStore.getState().isEditing) {
    return { ok: false, reason: 'graph-edit-active' };
  }

  const flushed = flushSourceDraft(flushReasonForIntent(intent));
  if (!flushed.ok) {
    revealDraftFailure(flushed.reason);
    return flushed;
  }

  syncMonacoContent();
  const identity = getCurrentStoryIdentity();
  const content = useEditorStore.getState().content;
  const built = createStorySnapshot(content, identity);
  if (!built.ok) return { ok: false, reason: 'parse-failed' };

  const currentIdentity = getCurrentStoryIdentity();
  if (
    !sameStoryIdentity(identity, currentIdentity) ||
    useEditorStore.getState().content !== content
  ) {
    revealDraftFailure('stale');
    return { ok: false, reason: 'stale' };
  }

  publishStorySnapshot(built.snapshot);
  return { ok: true, snapshot: built.snapshot };
}

function commitReplacement(payload: StoryReplacementPayload): void {
  if (payload.kind === 'saved') {
    loadSavedStorySession({
      filePath: payload.filePath,
      content: payload.content,
      hash: payload.hash,
      modifiedAt: payload.modifiedAt,
      closeHome: payload.closeHome,
      rememberRecent: payload.rememberRecent,
    });
    return;
  }
  startUnsavedStorySession({ content: payload.content, closeHome: payload.closeHome });
}

export async function runStoryReplacement(
  reason: StoryReplaceReason,
  loader: () => Promise<StoryReplacementPayload | null>,
): Promise<StoryReplacementResult> {
  if (useGraphStore.getState().isEditing) {
    useUIStore.getState().setStatusMessage(text('storyReplacement.busy'));
    return { status: 'busy' };
  }

  const operationId = Symbol(`story-replacement:${reason}`);
  // A later user open/new intent supersedes an earlier slow read. Both loaders
  // may finish, but only the operation that still owns this lease may commit.
  activeReplacement = operationId;
  try {
    if (!(await confirmBeforeReplacingCurrentStory(reason))) {
      return { status: 'cancelled' };
    }
    if (activeReplacement !== operationId) return { status: 'stale' };
    if (useGraphStore.getState().isEditing) {
      useUIStore.getState().setStatusMessage(text('storyReplacement.busy'));
      return { status: 'busy' };
    }

    const leaseIdentity: StoryIdentity = getCurrentStoryIdentity();
    let payload: StoryReplacementPayload | null;
    try {
      payload = await loader();
    } catch (error) {
      if (
        activeReplacement !== operationId ||
        !sameStoryIdentity(leaseIdentity, getCurrentStoryIdentity())
      ) {
        return { status: 'stale' };
      }
      return { status: 'failed', error };
    }

    if (
      activeReplacement !== operationId ||
      !sameStoryIdentity(leaseIdentity, getCurrentStoryIdentity()) ||
      useGraphStore.getState().isEditing
    ) {
      useUIStore.getState().setStatusMessage(text('storyReplacement.changedDuringRead'));
      return { status: 'stale' };
    }
    if (!payload) return { status: 'cancelled' };

    commitReplacement(payload);
    return { status: 'committed' };
  } finally {
    if (activeReplacement === operationId) activeReplacement = null;
  }
}

export function requestActiveChapter(chapterId: string): boolean {
  const ui = useUIStore.getState();
  if (ui.activeChapterId === chapterId) return true;
  const result = flushSourceDraft('chapter');
  if (!result.ok) {
    revealDraftFailure(result.reason);
    return false;
  }
  ui.setActiveChapterId(chapterId);
  return true;
}

export function isStoryReplacementActive(): boolean {
  return activeReplacement !== null;
}
