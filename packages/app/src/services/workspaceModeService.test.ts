import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSourceDraftController } from './sourceDraftCoordinator';
import { requestWorkspaceMode } from './workspaceModeService';
import { useUIStore } from '../stores/uiStore';

let unregister: (() => void) | null = null;

describe('requestWorkspaceMode', () => {
  beforeEach(() => {
    useUIStore.getState().setWorkspaceMode('graphLab');
    useUIStore.getState().setStatusMessage('');
  });

  afterEach(() => {
    unregister?.();
    unregister = null;
  });

  it('flushes a dirty Source Drawer draft before entering Split', () => {
    const flushDraft = vi.fn(() => true);
    unregister = registerSourceDraftController({
      getState: () => ({ isDirty: true, isStale: false }),
      flushDraft,
    });

    expect(requestWorkspaceMode('split')).toBe(true);
    expect(flushDraft).toHaveBeenCalledWith('replace');
    expect(useUIStore.getState().workspaceMode).toBe('split');
  });

  it('blocks Split when the source draft is stale', () => {
    const flushDraft = vi.fn(() => true);
    unregister = registerSourceDraftController({
      getState: () => ({ isDirty: true, isStale: true }),
      flushDraft,
    });

    expect(requestWorkspaceMode('split')).toBe(false);
    expect(flushDraft).not.toHaveBeenCalled();
    expect(useUIStore.getState().workspaceMode).toBe('graphLab');
    expect(useUIStore.getState().statusMessage).not.toBe('');
  });

  it('keeps Graph Lab active when a dirty draft cannot be committed', () => {
    unregister = registerSourceDraftController({
      getState: () => ({ isDirty: true, isStale: false }),
      flushDraft: () => false,
    });

    expect(requestWorkspaceMode('split')).toBe(false);
    expect(useUIStore.getState().workspaceMode).toBe('graphLab');
  });
});
