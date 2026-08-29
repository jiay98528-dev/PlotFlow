import { describe, expect, it, vi } from 'vitest';
import type { FileExternalChangeEvent } from '../types/electron';
import { createLatestOnlyExternalChangeCoordinator } from './externalChangeCoordinator';

function event(hash: string, content = hash): FileExternalChangeEvent {
  return {
    filePath: 'C:/stories/test.mdstory',
    content,
    hash,
    modifiedAt: hash.charCodeAt(0),
  };
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('latest-only external change coordinator', () => {
  it('uses one confirmation and reloads the latest event in a burst', async () => {
    const choice = deferred<number>();
    const reload = vi.fn(async () => undefined);
    const confirm = vi.fn(() => choice.promise);
    const setPending = vi.fn();
    const coordinator = createLatestOnlyExternalChangeCoordinator({
      getLease: () => ({ storySessionId: 1, filePath: 'C:/stories/test.mdstory' }),
      hasUnsavedChanges: () => true,
      isCurrentFile: () => true,
      setPending,
      confirm,
      reload,
      overwrite: vi.fn(async () => undefined),
      saveCopy: vi.fn(async () => undefined),
      showPending: vi.fn(),
    });

    const first = coordinator.enqueue(event('A'));
    await vi.waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    const second = coordinator.enqueue(event('B'));
    expect(setPending).toHaveBeenLastCalledWith(event('B'));
    choice.resolve(1);
    await Promise.all([first, second]);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith(event('B'));
  });

  it('does not execute an overwrite whose confirmed hash became stale', async () => {
    const choice = deferred<number>();
    const overwrite = vi.fn(async () => undefined);
    const showPending = vi.fn();
    const coordinator = createLatestOnlyExternalChangeCoordinator({
      getLease: () => ({ storySessionId: 1, filePath: 'C:/stories/test.mdstory' }),
      hasUnsavedChanges: () => true,
      isCurrentFile: () => true,
      setPending: vi.fn(),
      confirm: vi.fn(() => choice.promise),
      reload: vi.fn(async () => undefined),
      overwrite,
      saveCopy: vi.fn(async () => undefined),
      showPending,
    });

    const first = coordinator.enqueue(event('A'));
    await Promise.resolve();
    const second = coordinator.enqueue(event('B'));
    choice.resolve(2);
    await Promise.all([first, second]);

    expect(overwrite).not.toHaveBeenCalled();
    expect(showPending).toHaveBeenCalledTimes(1);
  });

  it('passes the exact confirmed event to overwrite when it is still current', async () => {
    const overwrite = vi.fn(async () => undefined);
    const coordinator = createLatestOnlyExternalChangeCoordinator({
      getLease: () => ({ storySessionId: 1, filePath: 'C:/stories/test.mdstory' }),
      hasUnsavedChanges: () => true,
      isCurrentFile: () => true,
      setPending: vi.fn(),
      confirm: vi.fn(async () => 2),
      reload: vi.fn(async () => undefined),
      overwrite,
      saveCopy: vi.fn(async () => undefined),
      showPending: vi.fn(),
    });

    await coordinator.enqueue(event('A'));
    expect(overwrite).toHaveBeenCalledWith(event('A'));
  });

  it('does not save a copy after the story session or path lease changed', async () => {
    const choice = deferred<number>();
    const saveCopy = vi.fn(async () => undefined);
    let lease = { storySessionId: 1, filePath: 'C:/stories/test.mdstory' as string | null };
    const coordinator = createLatestOnlyExternalChangeCoordinator({
      getLease: () => lease,
      hasUnsavedChanges: () => true,
      isCurrentFile: () => true,
      setPending: vi.fn(),
      confirm: vi.fn(() => choice.promise),
      reload: vi.fn(async () => undefined),
      overwrite: vi.fn(async () => undefined),
      saveCopy,
      showPending: vi.fn(),
    });

    const pending = coordinator.enqueue(event('A'));
    await Promise.resolve();
    lease = { storySessionId: 2, filePath: 'C:/stories/other.mdstory' };
    choice.resolve(0);
    await pending;

    expect(saveCopy).not.toHaveBeenCalled();
  });

  it('reloads immediately when there are no unsaved changes', async () => {
    const reload = vi.fn(async () => undefined);
    const confirm = vi.fn(async () => 1);
    const coordinator = createLatestOnlyExternalChangeCoordinator({
      getLease: () => ({ storySessionId: 1, filePath: 'C:/stories/test.mdstory' }),
      hasUnsavedChanges: () => false,
      isCurrentFile: () => true,
      setPending: vi.fn(),
      confirm,
      reload,
      overwrite: vi.fn(async () => undefined),
      saveCopy: vi.fn(async () => undefined),
      showPending: vi.fn(),
    });

    await coordinator.enqueue(event('A'));
    expect(confirm).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledWith(event('A'));
  });
});
