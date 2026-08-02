import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useStoryStore } from '../stores/storyStore';
import { useUIStore } from '../stores/uiStore';
import { registerSourceDraftController } from './sourceDraftCoordinator';
import { clearPendingSave, resetAutoSaveBaseline } from './autoSaveService';
import {
  prepareStorySnapshot,
  runStoryReplacement,
  type StoryReplacementPayload,
} from './storyTransactionService';

const STORY = '# 第一章\n\n## 节点：开始\n正文。\n';
const OPENED_STORY = '# 第二章\n\n## 节点：打开结果\n新正文。\n';

let unregister: (() => void) | null = null;

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

function savedPayload(content = OPENED_STORY): StoryReplacementPayload {
  return {
    kind: 'saved',
    filePath: 'D:/stories/opened.mdstory',
    content,
    hash: 'hash-opened',
    modifiedAt: 123,
    closeHome: true,
  };
}

describe('storyTransactionService', () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
    clearPendingSave();
    resetAutoSaveBaseline(null);
    useStoryStore.getState().clearParseData();
    useGraphStore.getState().syncFromAST(null);
    useUIStore.getState().setStatusMessage('');
  });

  afterEach(() => {
    unregister?.();
    unregister = null;
    vi.unstubAllGlobals();
  });

  it('publishes an immutable snapshot bound to the exact content revision', () => {
    useEditorStore.getState().setContent(STORY);
    const prepared = prepareStorySnapshot('export');
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    expect(prepared.snapshot.content).toBe(STORY);
    expect(prepared.snapshot.identity.contentRevision).toBe(
      useEditorStore.getState().contentRevision,
    );
    expect(useStoryStore.getState().snapshotIdentity).toEqual(prepared.snapshot.identity);
    expect(useStoryStore.getState().plotFlowData).toBe(prepared.snapshot.data);
  });

  it('flushes a hidden dirty draft before creating the export snapshot', () => {
    useEditorStore.getState().setContent(STORY);
    unregister = registerSourceDraftController({
      getState: () => ({ isDirty: true, isStale: false }),
      flushDraft: () => {
        useEditorStore.getState().setContent(OPENED_STORY);
        useEditorStore.getState().bumpSourceDraftRevision();
        return {
          ok: true,
          disposition: 'committed',
          identity: {
            storySessionId: useEditorStore.getState().storySessionId,
            contentRevision: useEditorStore.getState().contentRevision,
            sourceDraftRevision: useEditorStore.getState().sourceDraftRevision,
          },
        };
      },
    });

    const prepared = prepareStorySnapshot('export');
    expect(prepared.ok && prepared.snapshot.content).toBe(OPENED_STORY);
    expect(prepared.ok && prepared.snapshot.data.chapters[0]?.title).toBe('第二章');
  });

  it('discards a delayed read when canonical content changes during the lease', async () => {
    const load = deferred<StoryReplacementPayload | null>();
    const started = deferred<void>();
    const replacement = runStoryReplacement('workspace', () => {
      started.resolve();
      return load.promise;
    });
    await started.promise;

    useEditorStore.getState().setContent('用户在读取期间的新编辑');
    load.resolve(savedPayload());

    await expect(replacement).resolves.toEqual({ status: 'stale' });
    expect(useEditorStore.getState().content).toBe('用户在读取期间的新编辑');
  });

  it('lets the latest concurrent replacement win even when reads finish out of order', async () => {
    const firstLoad = deferred<StoryReplacementPayload | null>();
    const secondLoad = deferred<StoryReplacementPayload | null>();
    const firstStarted = deferred<void>();
    const secondStarted = deferred<void>();
    const first = runStoryReplacement('open', () => {
      firstStarted.resolve();
      return firstLoad.promise;
    });
    await firstStarted.promise;

    const winnerContent = '# 胜出章节\n\n## 节点：后打开\n新正文。\n';
    const second = runStoryReplacement('open', () => {
      secondStarted.resolve();
      return secondLoad.promise;
    });
    await secondStarted.promise;

    secondLoad.resolve(savedPayload(winnerContent));
    await expect(second).resolves.toEqual({ status: 'committed' });
    firstLoad.resolve(savedPayload('较慢的旧读取'));
    await expect(first).resolves.toEqual({ status: 'stale' });
    expect(useEditorStore.getState().content).toBe(winnerContent);
  });

  it('reports an obsolete loader failure as stale after a newer story commits', async () => {
    const firstLoad = deferred<StoryReplacementPayload | null>();
    const firstStarted = deferred<void>();
    const first = runStoryReplacement('open', async () => {
      firstStarted.resolve();
      await firstLoad.promise;
      throw new Error('obsolete read failed');
    });
    await firstStarted.promise;

    await expect(runStoryReplacement('open', async () => savedPayload())).resolves.toEqual({
      status: 'committed',
    });
    firstLoad.resolve(null);
    await expect(first).resolves.toEqual({ status: 'stale' });
  });

  it.each([
    [
      'cancelled',
      async (): Promise<StoryReplacementPayload | null> => null,
      { status: 'cancelled' },
    ],
    [
      'failed',
      async (): Promise<StoryReplacementPayload | null> => {
        throw new Error('read failed');
      },
      { status: 'failed' },
    ],
  ] as const)(
    'keeps a discarded Source draft when the loader is %s',
    async (_name, loader, expected) => {
      const originalContent = 'canonical story';
      useEditorStore.getState().setContent(originalContent);
      let draftStillPresent = true;
      unregister = registerSourceDraftController({
        getState: () => ({ isDirty: draftStillPresent, isStale: false }),
        flushDraft: () => {
          draftStillPresent = false;
          return { ok: true, disposition: 'committed', identity: useEditorStore.getState() };
        },
      });
      vi.stubGlobal('window', {
        plotflow: { dialog: { confirm: vi.fn(async () => 1) } },
      });

      const result = await runStoryReplacement('open', loader);
      expect(result.status).toBe(expected.status);
      expect(draftStillPresent).toBe(true);
      expect(useEditorStore.getState().content).toBe(originalContent);
    },
  );

  it('does not start or commit a replacement while a graph edit lock is active', async () => {
    useGraphStore.getState().setEditing(true);
    let loaderCalled = false;
    await expect(
      runStoryReplacement('open', async () => {
        loaderCalled = true;
        return savedPayload();
      }),
    ).resolves.toEqual({ status: 'busy' });
    expect(loaderCalled).toBe(false);

    useGraphStore.getState().setEditing(false);
    const load = deferred<StoryReplacementPayload | null>();
    const started = deferred<void>();
    const replacement = runStoryReplacement('open', () => {
      started.resolve();
      return load.promise;
    });
    await started.promise;
    useGraphStore.getState().setEditing(true);
    load.resolve(savedPayload());
    await expect(replacement).resolves.toEqual({ status: 'stale' });
    expect(useEditorStore.getState().content).not.toBe(OPENED_STORY);
  });
});
