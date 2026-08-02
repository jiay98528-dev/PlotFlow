import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import {
  flushSourceDraft,
  getCurrentStoryIdentity,
  registerSourceDraftController,
  type SourceDraftController,
} from './sourceDraftCoordinator';

let unregister: (() => void) | null = null;

describe('sourceDraftCoordinator', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    unregister?.();
    unregister = null;
  });

  it('returns a versioned clean result when no drawer controller is active', () => {
    expect(flushSourceDraft('export')).toEqual({
      ok: true,
      disposition: 'clean',
      identity: getCurrentStoryIdentity(),
    });
  });

  it('preserves structured stale failures from the active controller', () => {
    const controller: SourceDraftController = {
      getState: () => ({ isDirty: true, isStale: true }),
      flushDraft: vi.fn(() => ({ ok: false, reason: 'stale' } as const)),
    };
    unregister = registerSourceDraftController(controller);
    expect(flushSourceDraft('save')).toEqual({ ok: false, reason: 'stale' });
    expect(controller.flushDraft).toHaveBeenCalledWith('save');
  });

  it('increments sourceDraftRevision for controller registration and cleanup', () => {
    const start = useEditorStore.getState().sourceDraftRevision;
    unregister = registerSourceDraftController({
      getState: () => ({ isDirty: false, isStale: false }),
      flushDraft: () => ({
        ok: true,
        disposition: 'clean',
        identity: getCurrentStoryIdentity(),
      }),
    });
    expect(useEditorStore.getState().sourceDraftRevision).toBe(start + 1);
    unregister();
    unregister = null;
    expect(useEditorStore.getState().sourceDraftRevision).toBe(start + 2);
  });
});
