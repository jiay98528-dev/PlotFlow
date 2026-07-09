/**
 * Unit tests for autoSaveService — 响应式自动保存服务 (M1-12)
 *
 * 测试范围：
 *   TC-1: debouncedSave 存储待保存内容并启动定时器
 *   TC-2: debouncedSave 在 filePath 为 null 时跳过定时器
 *   TC-3: 连续 debouncedSave 调用重置定时器
 *   TC-4: performSave 在 isSaving 时立即返回（不调用 IPC）
 *   TC-5: performSave 级联保存：保存期间新内容到达触发重保存
 *   TC-6: forceSave 清除定时器并立即保存待保存内容
 *   TC-7: forceSave 无待保存内容时回退到 editorStore
 *   TC-8: clearPendingSave 重置所有状态
 *
 * @module __tests__/autoSaveService.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEditorStore } from '../stores/editorStore';
import { useUIStore } from '../stores/uiStore';
import * as autoSaveService from '../services/autoSaveService';
import { registerSourceDraftController } from '../services/sourceDraftCoordinator';

// ============================================================================
// 1. Mocks
// ============================================================================

/** window.plotflow.file.save 的 mock */
const mockFileSave = vi.fn();
const mockFileSaveAs = vi.fn();
const mockDialogConfirm = vi.fn();
const mockRemoveAllRanges = vi.fn();

function successfulSave(hash = 'saved-hash') {
  return { success: true, timestamp: Date.now(), hash, modifiedAt: Date.now() };
}

/** 保存状态消息 mock（用于验证更新状态栏） */
const mockSetStatusMessage = vi.fn();

/** 默认 UIStore 初始状态（不含 action） */
const defaultUIState = {
  theme: 'light' as const,
  language: 'zh-CN' as const,
  accent: 'ocean' as const,
  activeRightPanel: 'graph' as const,
  isOutlinePanelOpen: true,
  statusMessage: '',
  isConditionEditorOpen: false,
  isProblemPanelOpen: false,
  isExportDialogOpen: false,
  isCorpusManagerOpen: false,
  isNewFileDialogOpen: false,
  conditionEditorNodeId: null as string | null,
  conditionEditorOptionIndex: null as number | null,
};

// ============================================================================
// 2. Setup & Teardown
// ============================================================================

beforeEach(() => {
  // 使用假定时器控制 setTimeout/clearTimeout
  vi.useFakeTimers();

  // 重置 IPC mock
  mockFileSave.mockReset();
  mockFileSave.mockResolvedValue(successfulSave());
  mockFileSaveAs.mockReset();
  mockFileSaveAs.mockResolvedValue(null);
  mockDialogConfirm.mockReset();
  mockDialogConfirm.mockResolvedValue(3);
  mockRemoveAllRanges.mockReset();

  mockSetStatusMessage.mockReset();

  // 挂载 window.plotflow API mock
  Object.defineProperty(globalThis, 'window', {
    value: {
      getSelection: () => ({ removeAllRanges: mockRemoveAllRanges }),
      plotflow: {
        file: {
          save: mockFileSave,
          saveAs: mockFileSaveAs,
        },
        dialog: {
          confirm: mockDialogConfirm,
        },
      },
    },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'document', {
    value: {
      body: {
        style: {
          userSelect: '',
        },
      },
    },
    writable: true,
    configurable: true,
  });

  // 重置编辑器 Store
  useEditorStore.getState().reset();

  // 重置 UI Store
  useUIStore.setState(defaultUIState);

  // 替换 setStatusMessage 为 spy
  useUIStore.getState().setStatusMessage = mockSetStatusMessage;

  // 重置模块级状态（saveTimer / pendingContent / pendingPath）
  autoSaveService.clearPendingSave();
});

afterEach(() => {
  // 清理模块状态
  autoSaveService.clearPendingSave();
  vi.useRealTimers();
});

// ============================================================================
// 3. Test Suites
// ============================================================================

describe('autoSaveService — 自动保存服务 (TC-1~TC-8)', () => {
  // --------------------------------------------------------------------------
  // TC-1: debouncedSave stores pendingContent and starts timer
  // --------------------------------------------------------------------------
  it('[TC-1] debouncedSave 存储待保存内容并启动定时器', async () => {
    // Act: 调用 debouncedSave 带文件路径
    autoSaveService.debouncedSave('故事内容', '/project/story.mdstory');

    // Assert: 有未完成的定时器
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Act: 推进定时器 500ms（触发实际保存）
    await vi.advanceTimersByTimeAsync(500);

    // Assert: IPC 被调用，参数正确
    expect(mockFileSave).toHaveBeenCalledTimes(1);
    expect(mockFileSave).toHaveBeenCalledWith({
      path: '/project/story.mdstory',
      content: '故事内容',
      expectedHash: null,
      overwriteConflict: undefined,
    });
  });

  // --------------------------------------------------------------------------
  // TC-2: debouncedSave skips timer when filePath is null
  // --------------------------------------------------------------------------
  it('[TC-2] debouncedSave 在 filePath 为 null 时跳过定时器', async () => {
    // Act: 调用 debouncedSave 不带文件路径（新建未保存文件）
    autoSaveService.debouncedSave('新文件内容', null);

    // Assert: 无定时器被创建
    expect(vi.getTimerCount()).toBe(0);

    // Act: 推进时间（即使有定时器也不会触发）
    await vi.advanceTimersByTimeAsync(500);

    // Assert: IPC 未被调用（因为没有路径无法保存）
    expect(mockFileSave).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  // TC-3: Subsequent debouncedSave calls reset timer
  // --------------------------------------------------------------------------
  it('[TC-3] 连续 debouncedSave 调用重置定时器', async () => {
    // Act: 第一次调用
    autoSaveService.debouncedSave('第一次内容', '/project/story.mdstory');

    // Act: 在 500ms 结束前再次调用（新内容）
    autoSaveService.debouncedSave('第二次内容', '/project/story.mdstory');

    // Act: 推进时间 500ms（从第二次调用开始计时）
    await vi.advanceTimersByTimeAsync(500);

    // Assert: 仅触发一次保存，且保存的是最新的内容
    expect(mockFileSave).toHaveBeenCalledTimes(1);
    expect(mockFileSave).toHaveBeenCalledWith({
      path: '/project/story.mdstory',
      content: '第二次内容',
      expectedHash: null,
      overwriteConflict: undefined,
    });
  });

  // --------------------------------------------------------------------------
  // TC-4: performSave returns immediately when isSaving (no IPC)
  // --------------------------------------------------------------------------
  it('[TC-4] performSave 在 isSaving 时立即返回（不调用 IPC）', async () => {
    // Arrange: 使用 deferred promise 让第一次保存"进行中"
    let resolveFirstSave: (value: unknown) => void;
    mockFileSave.mockImplementation(() => new Promise((resolve) => {
      resolveFirstSave = resolve;
    }));

    // Act: 启动第一次保存
    autoSaveService.debouncedSave('内容', '/project/story.mdstory');
    await vi.advanceTimersByTimeAsync(500);
    // 此时 isSaving = true，performSave 在等待 IPC 返回

    // Act: 保存进行中再次触发 debouncedSave
    autoSaveService.debouncedSave('内容', '/project/story.mdstory');
    // 新的定时器被创建
    await vi.advanceTimersByTimeAsync(500);
    // 新定时器触发 performSave → isSaving = true → 立即返回

    // Act: 让第一次保存完成
    resolveFirstSave!(successfulSave());
    await vi.advanceTimersByTimeAsync(100);

    // Assert: IPC 仅被调用一次（isSaving 成功阻止了第二次调用）
    expect(mockFileSave).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // TC-5: performSave cascade: new content during save triggers re-save
  // --------------------------------------------------------------------------
  it('[TC-5] performSave 级联保存：保存期间新内容到达触发重保存', async () => {
    // Arrange: 第一次调用返回 deferred promise，后续立即 resolve
    let resolveFirstSave: (value: unknown) => void;
    let callIndex = 0;
    mockFileSave.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return new Promise((resolve) => {
          resolveFirstSave = resolve;
        });
      }
      return Promise.resolve(successfulSave(`saved-hash-${callIndex}`));
    });

    // Act: 第一次 debouncedSave（初始内容）
    autoSaveService.debouncedSave('初始内容', '/project/story.mdstory');
    await vi.advanceTimersByTimeAsync(500);
    // performSave 已启动，正在等待 deferred IPC

    // Act: 保存进行中，新内容到达（级联触发条件）
    autoSaveService.debouncedSave('新内容', '/project/story.mdstory');

    // Act: 让第一次保存完成
    resolveFirstSave!(successfulSave('saved-hash-1'));
    await vi.advanceTimersByTimeAsync(100);

    // Assert: IPC 被调用两次
    // 第1次: 初始内容的保存
    // 第2次: 级联触发的重保存（新内容）
    expect(mockFileSave).toHaveBeenCalledTimes(2);
    expect(mockFileSave).toHaveBeenNthCalledWith(1, {
      path: '/project/story.mdstory',
      content: '初始内容',
      expectedHash: null,
      overwriteConflict: undefined,
    });
    expect(mockFileSave).toHaveBeenNthCalledWith(2, {
      path: '/project/story.mdstory',
      content: '新内容',
      expectedHash: 'saved-hash-1',
      overwriteConflict: undefined,
    });
  });

  // --------------------------------------------------------------------------
  // TC-6: forceSave clears timer and saves pending content
  // --------------------------------------------------------------------------
  it('[TC-6] forceSave 清除定时器并立即保存待保存内容', async () => {
    // Arrange: 先调用 debouncedSave 准备待保存内容（但不等到定时器触发）
    autoSaveService.debouncedSave('待保存内容', '/project/story.mdstory');

    // 验证定时器已创建
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // 清除之前的 IPC 调用记录（debouncedSave 不会触发 IPC，仅启动定时器）
    mockFileSave.mockClear();

    // Act: forceSave 立即保存
    await autoSaveService.forceSave();

    // Assert: IPC 被立即调用（无需等待 500ms debounce）
    expect(mockFileSave).toHaveBeenCalledTimes(1);
    expect(mockFileSave).toHaveBeenCalledWith({
      path: '/project/story.mdstory',
      content: '待保存内容',
      expectedHash: null,
      overwriteConflict: undefined,
    });

    // Assert: 无残留定时器会再次触发保存
    // （forceSave 已清除 debounce 定时器；updateStatusMessage 内部状态清除定时器不触发保存）
    await vi.advanceTimersByTimeAsync(500);
    expect(mockFileSave).toHaveBeenCalledTimes(1);
  });

  // --------------------------------------------------------------------------
  // TC-7: forceSave falls back to editorStore when no pending
  // --------------------------------------------------------------------------
  it('[TC-7] forceSave 无待保存内容时回退到 editorStore', async () => {
    // Arrange: 先通过 debouncedSave 设置待保存内容并完成保存（清空 pending）
    autoSaveService.debouncedSave('已保存内容', '/project/story.mdstory');
    await vi.advanceTimersByTimeAsync(500);
    expect(mockFileSave).toHaveBeenCalledTimes(1);
    // pendingContent 和 pendingPath 在保存完成后被清空

    // Arrange: 设置编辑器为脏状态（用户继续编辑后未自动保存前按 Ctrl+S）
    useEditorStore.getState().setContent('编辑器里的新内容');
    useEditorStore.getState().setFilePath('/project/story.mdstory');
    expect(useEditorStore.getState().isDirty).toBe(true);

    // 清除之前的 IPC 调用记录
    mockFileSave.mockClear();

    // Act: forceSave → pending 为空 → 回退到 editorStore
    await autoSaveService.forceSave();

    // Assert: IPC 被调用，参数来自 editorStore
    expect(mockFileSave).toHaveBeenCalledTimes(1);
    expect(mockFileSave).toHaveBeenCalledWith({
      path: '/project/story.mdstory',
      content: '编辑器里的新内容',
      expectedHash: 'saved-hash',
      overwriteConflict: undefined,
    });
  });

  // --------------------------------------------------------------------------
  // TC-8: clearPendingSave resets all state
  // --------------------------------------------------------------------------
  it('[TC-8] clearPendingSave 重置所有状态', async () => {
    // Arrange: 设置待保存内容（创建定时器）
    autoSaveService.debouncedSave('待保存内容', '/project/story.mdstory');
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // Act: 清除所有待保存状态
    autoSaveService.clearPendingSave();

    // Assert: 定时器被清除
    expect(vi.getTimerCount()).toBe(0);

    // Assert: 推进时间不会触发任何保存
    await vi.advanceTimersByTimeAsync(500);
    expect(mockFileSave).not.toHaveBeenCalled();
  });

  it('[TC-9] saveAsCurrentFile clears selection after cancellation', async () => {
    useEditorStore.getState().setContent('unsaved story');
    document.body.style.userSelect = 'none';
    mockFileSaveAs.mockResolvedValueOnce(null);

    const result = await autoSaveService.saveAsCurrentFile();

    expect(result).toBe(false);
    expect(mockFileSaveAs).toHaveBeenCalledTimes(1);
    expect(mockRemoveAllRanges).toHaveBeenCalledTimes(1);
    expect(document.body.style.userSelect).toBe('');
    expect(mockSetStatusMessage).toHaveBeenCalledWith(expect.stringContaining('cancelled'));
  });

  it('[TC-10] saveAsCurrentFile clears selection after failure', async () => {
    useEditorStore.getState().setContent('unsaved story');
    document.body.style.userSelect = 'none';
    mockFileSaveAs.mockRejectedValueOnce(new Error('dialog failed'));

    const result = await autoSaveService.saveAsCurrentFile();

    expect(result).toBe(false);
    expect(mockFileSaveAs).toHaveBeenCalledTimes(1);
    expect(mockRemoveAllRanges).toHaveBeenCalledTimes(1);
    expect(document.body.style.userSelect).toBe('');
    expect(mockSetStatusMessage).toHaveBeenCalledWith(expect.stringContaining('dialog failed'));
  });

  it('[TC-11] autosave timer does not write an old snapshot while a source slice is stale', async () => {
    const flushDraft = vi.fn(() => false);
    const unregister = registerSourceDraftController({
      getState: () => ({ isDirty: true, isStale: true }),
      flushDraft,
    });

    try {
      autoSaveService.debouncedSave('old snapshot', '/project/story.mdstory');
      await vi.advanceTimersByTimeAsync(500);

      expect(flushDraft).toHaveBeenCalledTimes(1);
      expect(mockFileSave).not.toHaveBeenCalled();
    } finally {
      unregister();
    }
  });

  it('[TC-12] overwrite conflict still performs disk hash preflight when content is already clean', async () => {
    const editor = useEditorStore.getState();
    editor.setContent('current content');
    editor.setFilePath('/project/story.mdstory');
    editor.setFileBaseline('base-hash', 100);
    editor.markSaved();
    autoSaveService.resetAutoSaveBaseline('current content');
    editor.setPendingExternalChange({
      filePath: '/project/story.mdstory',
      content: 'disk content',
      hash: 'disk-hash',
      modifiedAt: 200,
    });
    mockDialogConfirm.mockResolvedValueOnce(2);
    mockFileSave.mockResolvedValueOnce(successfulSave('overwrite-hash'));

    const result = await autoSaveService.forceSave();

    expect(result).toBe(true);
    expect(mockFileSave).toHaveBeenCalledTimes(1);
    expect(mockFileSave).toHaveBeenCalledWith({
      path: '/project/story.mdstory',
      content: 'current content',
      expectedHash: 'disk-hash',
      overwriteConflict: true,
    });
    expect(useEditorStore.getState().pendingExternalChange).toBeNull();
    expect(useEditorStore.getState().isSaveBlockedByConflict).toBe(false);
  });
});
