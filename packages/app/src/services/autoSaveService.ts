/**
 * AutoSaveService — 响应式自动保存服务 (M1-12)
 *
 * 职责：
 * - 500ms debounce：编辑器 onChange → 等待 500ms 无新输入 → 触发保存
 * - 脏状态检测：只有内容变化时才保存（通过 useEditorStore.isDirty）
 * - IPC 通信：渲染进程 → invoke('file:save') → 主进程写文件
 * - 保存状态反馈：保存中 → ⏳，保存成功 → ✅，保存失败 → ❌
 * - Ctrl+S 强制保存：不经 debounce 立即执行
 *
 * 对应 TAD.md §4.2 AutoSaveManager 的渲染进程实现。
 * 使用模块级变量而非 class，避免 React 组件生命周期管理问题。
 *
 * @module services/autoSaveService
 */

import { useEditorStore } from '../stores/editorStore';
import { useUIStore } from '../stores/uiStore';
import type { FileExternalChangeEvent, FileSaveResult } from '../types/electron';
import { appT } from '../i18n/appI18n';
import { parsePipelineNow } from './parsePipeline';
import { rememberRecentStory } from './recentFileService';
import { flushSourceDraftBeforeSaveOrReplace, hasSourceDraftRisk } from './sourceDraftCoordinator';

// ============================================================================
// 模块级状态
// ============================================================================

/** 防抖定时器句柄 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** 待保存的文本内容 */
let pendingContent: string | null = null;

/** 待保存的文件路径 */
let pendingPath: string | null = null;

/** 最近一次成功保存的内容（用于双重脏检测） */
let lastSavedContent: string | null = null;

/** 是否正在执行保存操作（防止并发） */
let isSaving = false;

/** 是否已有原生另存为对话框处于打开流程中 */
let isSaveAsDialogOpen = false;

// ============================================================================
// 常量
// ============================================================================

/** 防抖延迟（毫秒） */
const DEBOUNCE_MS = 500;

/** 状态栏消息显示时长（毫秒） */
const STATUS_DISPLAY_MS = 3000;

/** 状态栏消息前缀，用于区分保存状态和其他消息 */
const SAVE_STATUS_PREFIX = 'save:';

// ============================================================================
// 内部函数
// ============================================================================

/**
 * 更新状态栏的保存状态消息
 */
function updateStatusMessage(type: 'saving' | 'success' | 'failed', detail?: string): void {
  const uiStore = useUIStore.getState();
  const language = uiStore.language;

  switch (type) {
    case 'saving':
      uiStore.setStatusMessage(`${SAVE_STATUS_PREFIX}saving⏳ ${appT('status.saving', undefined, language)}`);
      break;
    case 'success':
      uiStore.setStatusMessage(`${SAVE_STATUS_PREFIX}success✅ ${appT('status.saved', undefined, language)}`);
      // 短暂显示后清除
      setTimeout(() => {
        const current = useUIStore.getState().statusMessage;
        if (current === `${SAVE_STATUS_PREFIX}success✅ ${appT('status.saved', undefined, language)}`) {
          useUIStore.getState().setStatusMessage('');
        }
      }, STATUS_DISPLAY_MS);
      break;
    case 'failed':
      uiStore.setStatusMessage(`${SAVE_STATUS_PREFIX}failed❌ ${appT('status.saveFailed', { detail: detail ?? 'unknown error' }, language)}`);
      // 失败消息保留更久
      setTimeout(() => {
        const current = useUIStore.getState().statusMessage;
        if (current.startsWith(`${SAVE_STATUS_PREFIX}failed`)) {
          useUIStore.getState().setStatusMessage('');
        }
      }, STATUS_DISPLAY_MS * 2);
      break;
  }
}

function updateSaveDialogStatus(type: 'opening' | 'cancelled' | 'success' | 'failed', detail?: string): void {
  const uiStore = useUIStore.getState();
  const language = uiStore.language;
  switch (type) {
    case 'opening':
      uiStore.setStatusMessage(`${SAVE_STATUS_PREFIX}saving⏳ ${appT('status.saveOpening', undefined, language)}`);
      break;
    case 'cancelled':
      uiStore.setStatusMessage(`${SAVE_STATUS_PREFIX}cancelled ${appT('status.saveCancelled', undefined, language)}`);
      setTimeout(() => {
        const current = useUIStore.getState().statusMessage;
        if (current === `${SAVE_STATUS_PREFIX}cancelled ${appT('status.saveCancelled', undefined, language)}`) {
          useUIStore.getState().setStatusMessage('');
        }
      }, STATUS_DISPLAY_MS);
      break;
    case 'success':
      uiStore.setStatusMessage(`${SAVE_STATUS_PREFIX}success✅ ${appT('status.savedTo', { path: detail ?? '' }, language)}`);
      break;
    case 'failed':
      updateStatusMessage('failed', detail);
      break;
  }

}

function updateConflictStatus(detail: string): void {
  useUIStore.getState().setStatusMessage(`${SAVE_STATUS_PREFIX}conflict ${detail}`);
}

function clearSaveTimer(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

function clearTransientSelectionState(): void {
  if (typeof window !== 'undefined') {
    window.getSelection?.()?.removeAllRanges();
  }
  if (typeof document !== 'undefined') {
    document.body.style.userSelect = '';
  }
}

function normalizeExternalEvent(event: FileExternalChangeEvent): FileExternalChangeEvent {
  return {
    ...event,
    filePath: event.filePath.replace(/\\/g, '/'),
  };
}

function syncLatestEditorContent(): string {
  const editorState = useEditorStore.getState();
  const modelContent = editorState.editorInstance?.getValue();
  if (typeof modelContent === 'string' && modelContent !== editorState.content) {
    editorState.setContent(modelContent);
    parsePipelineNow(modelContent);
    pendingContent = modelContent;
    pendingPath = editorState.filePath;
    return modelContent;
  }
  return editorState.content;
}

export function resetAutoSaveBaseline(content: string | null): void {
  clearPendingSave();
  lastSavedContent = content;
}

export function hasPendingSaveWork(): boolean {
  return pendingContent !== null || saveTimer !== null || isSaving || isSaveAsDialogOpen;
}

export function hasCurrentStoryUnsavedChanges(): boolean {
  const editorState = useEditorStore.getState();
  const currentContent = editorState.editorInstance?.getValue() ?? editorState.content;
  return (
    hasSourceDraftRisk()
    || editorState.isDirty
    || editorState.pendingExternalChange !== null
    || hasPendingSaveWork()
    || (editorState.filePath === null && currentContent.trim().length > 0)
    || (lastSavedContent !== null && currentContent !== lastSavedContent)
  );
}

export function applyExternalFileContent(event: FileExternalChangeEvent): void {
  const normalizedEvent = normalizeExternalEvent(event);
  clearPendingSave();
  const editorState = useEditorStore.getState();
  editorState.setFilePath(normalizedEvent.filePath);
  editorState.setFileBaseline(normalizedEvent.hash, normalizedEvent.modifiedAt);
  editorState.clearPendingExternalChange();
  editorState.setDiagnostics([]);
  editorState.setActiveNodeId(null);
  editorState.setContent(normalizedEvent.content);
  editorState.markSaved();
  lastSavedContent = normalizedEvent.content;
  rememberRecentStory(normalizedEvent.filePath, normalizedEvent.hash, normalizedEvent.modifiedAt);
  parsePipelineNow(normalizedEvent.content);
}

/**
 * 执行实际的保存操作
 */
async function performSave(
  content: string,
  path: string,
  options: { readonly overwriteConflict?: boolean; readonly expectedHash?: string | null } = {},
): Promise<boolean> {
  if (isSaving) return false;
  const pendingBeforeFlush = pendingContent;
  if (!flushSourceDraftBeforeSaveOrReplace('save')) {
    return false;
  }

  const editorStateBeforeSync = useEditorStore.getState();
  const modelContent = editorStateBeforeSync.editorInstance?.getValue();
  let saveContent = content;
  if (pendingContent !== null && pendingPath === path && pendingContent !== pendingBeforeFlush) {
    saveContent = pendingContent;
  } else if (typeof modelContent === 'string' && modelContent !== editorStateBeforeSync.content) {
    saveContent = syncLatestEditorContent();
  }
  if (saveContent !== content) {
    pendingContent = saveContent;
    pendingPath = path;
    clearSaveTimer();
  }
  const earlyReturnState = useEditorStore.getState();
  const hasConflictContext = Boolean(
    options.overwriteConflict
    || earlyReturnState.pendingExternalChange
    || earlyReturnState.isSaveBlockedByConflict,
  );

  // 双重脏检测：内容对比（防竞态）+ isDirty 标记
  // 当异步保存过程中用户继续输入时，isDirty 可能被旧保存完成重置为 false，
  // 但 lastSavedContent !== saveContent 能兜住这种情况。
  if (!hasConflictContext && saveContent === lastSavedContent && !earlyReturnState.isDirty) return true;

  isSaving = true;
  updateStatusMessage('saving');
  let succeeded = false;

  try {
    const editorState = useEditorStore.getState();
    const result: FileSaveResult = await window.plotflow.file.save({
      path,
      content: saveContent,
      expectedHash: options.expectedHash !== undefined ? options.expectedHash : editorState.baseFileHash,
      overwriteConflict: options.overwriteConflict,
    });

    if (result.success) {
      // 标记为已保存，清除脏状态
      lastSavedContent = saveContent;
      const freshEditorState = useEditorStore.getState();
      freshEditorState.setFileBaseline(result.hash, result.modifiedAt);
      freshEditorState.clearPendingExternalChange();
      freshEditorState.markSaved();
      rememberRecentStory(path, result.hash, result.modifiedAt);
      updateStatusMessage('success');
      succeeded = true;
    } else if (result.conflict) {
      useEditorStore.getState().setPendingExternalChange(normalizeExternalEvent({
        filePath: result.filePath,
        content: result.content,
        hash: result.hash,
        modifiedAt: result.modifiedAt,
      }));
      updateConflictStatus('File changed on disk; autosave paused.');
    } else {
      updateStatusMessage('failed', '文件写入返回异常');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateStatusMessage('failed', message);
  } finally {
    isSaving = false;
    clearTransientSelectionState();

    if (succeeded) {
      // P0-2: 保存成功 → 检查期间是否有新内容到达（防竞态数据丢失）
      if (pendingContent !== null && pendingPath !== null && pendingContent !== saveContent) {
        // 级联保存新内容（不丢弃保存期间到达的用户输入）
        const nextContent = pendingContent;
        const nextPath = pendingPath;
        pendingContent = null;
        pendingPath = null;
        performSave(nextContent, nextPath).catch(() => {
          // performSave 内部已处理错误
        });
      } else {
        pendingContent = null;
        pendingPath = null;
      }
    }
    // 保存失败 → 保留 pendingContent/pendingPath，等待下次触发重试
  }
  return succeeded;
}

// ============================================================================
// 导出 API
// ============================================================================

/**
 * 500ms 防抖保存
 *
 * 每次编辑器内容变化时调用此函数。
 * 函数会等待 500ms 无新输入后才实际执行保存操作。
 * 如果连续输入，每次调用都会重置定时器。
 *
 * @param content - 当前编辑器完整文本内容
 * @param path    - 当前文件的绝对路径
 */
export function debouncedSave(content: string, path: string | null): void {
  // P0-3: 始终缓存最新内容（即使无文件路径，供 saveOrSaveAs 回退使用）
  pendingContent = content;
  pendingPath = path;

  // 新建未保存文件时无法自动保存，但内容已缓存
  if (!path) return;

  if (useEditorStore.getState().isSaveBlockedByConflict) {
    updateConflictStatus('File changed on disk; autosave paused.');
    return;
  }

  // 清除上一次的定时器，重新计时
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (pendingContent !== null && pendingPath !== null) {
      performSave(pendingContent, pendingPath).catch(() => {
        // performSave 内部已处理错误，此处无需额外处理
      });
    }
  }, DEBOUNCE_MS);
}

/**
 * 强制立即保存（Ctrl+S）
 *
 * 跳过防抖等待，立即执行保存。
 * 如果没有待保存的内容，不做任何操作。
 */
export async function forceSave(): Promise<boolean> {
  // 清除防抖定时器
  clearSaveTimer();

  // 轮询等待正在进行的保存完成，防止 Ctrl+S 被静默丢弃
  const MAX_WAIT_MS = 5000;
  const POLL_INTERVAL_MS = 50;
  let waited = 0;
  while (isSaving && waited < MAX_WAIT_MS) {
    await new Promise(function(r) { setTimeout(r, POLL_INTERVAL_MS); });
    waited += POLL_INTERVAL_MS;
  }

  if (!flushSourceDraftBeforeSaveOrReplace('save')) {
    return false;
  }
  clearSaveTimer();
  const latestContent = syncLatestEditorContent();

  const blockedState = useEditorStore.getState();
  if (blockedState.filePath !== null && blockedState.pendingExternalChange) {
    return resolveExternalConflictBeforeSave();
  }

  // 如果有待保存的内容，立即保存
  if (pendingContent !== null && pendingPath !== null) {
    return performSave(pendingContent, pendingPath);
  }

  // 没有待保存内容，但可能存储已被 markSaved() 清空
  // 检查编辑器是否有脏内容但未被 debouncedSave 捕获
  const editorState = useEditorStore.getState();
  if (
    editorState.filePath !== null
    && (editorState.isDirty || latestContent !== lastSavedContent)
  ) {
    return performSave(latestContent, editorState.filePath);
  }

  return true;
}

/**
 * 智能保存：已有文件路径则直接保存，新文件则弹出另存为对话框。
 *
 * P0-3: 解决新建文件 Ctrl+S 被静默忽略的问题。
 * 供 Ctrl+S 快捷键和 File > Save 菜单使用。
 */
async function resolveExternalConflictBeforeSave(): Promise<boolean> {
  if (!flushSourceDraftBeforeSaveOrReplace('save')) return false;
  const currentContent = syncLatestEditorContent();
  const editorState = useEditorStore.getState();
  const pending = editorState.pendingExternalChange;
  if (!pending || editorState.filePath === null) return false;

  const choice = await window.plotflow.dialog.confirm({
    type: 'warning',
    message: 'File changed on disk',
    detail: `${pending.filePath}\n\nThe file was modified outside PlotFlow. Save a copy, reload the disk version, overwrite the disk version, or keep editing without saving.`,
    buttons: ['Save Copy', 'Reload Disk', 'Overwrite Disk', 'Keep Editing'],
  });

  if (choice === 0) {
    const saved = await saveAsCurrentFile();
    if (!saved) {
      updateConflictStatus('External file change kept pending.');
    }
    return saved;
  }

  if (choice === 1) {
    applyExternalFileContent(pending);
    updateConflictStatus('Reloaded external changes.');
    return true;
  }

  if (choice === 2) {
    return performSave(currentContent, editorState.filePath, {
      overwriteConflict: true,
      expectedHash: pending.hash,
    });
  }

  updateConflictStatus('External file change kept pending.');
  return false;
}

export async function saveOrSaveAs(): Promise<boolean> {
  const directSaveSucceeded = await forceSave();
  const editorState = useEditorStore.getState();
  const currentContent = syncLatestEditorContent();

  if (!directSaveSucceeded && (editorState.filePath !== null || hasSourceDraftRisk())) {
    return false;
  }

  if (editorState.filePath === null && currentContent.length > 0 && useEditorStore.getState().isDirty) {
    if (isSaveAsDialogOpen) {
      updateSaveDialogStatus('opening');
      return false;
    }

    isSaveAsDialogOpen = true;
    updateSaveDialogStatus('opening');
    try {
      const result = await window.plotflow.file.saveAs(currentContent);
      if (!result) {
        updateSaveDialogStatus('cancelled');
        return false;
      }
      const newPath = result.filePath.replace(/\\/g, '/');
      editorState.setFilePath(newPath);
      editorState.setFileBaseline(result.hash, result.modifiedAt);
      editorState.clearPendingExternalChange();
      editorState.markSaved();
      rememberRecentStory(newPath, result.hash, result.modifiedAt);
      pendingPath = newPath;
      pendingContent = null;
      lastSavedContent = currentContent;
      updateSaveDialogStatus('success', newPath);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateSaveDialogStatus('failed', message);
      return false;
    } finally {
      isSaveAsDialogOpen = false;
      clearTransientSelectionState();
    }
  }

  return !useEditorStore.getState().isDirty;
}

export async function saveAsCurrentFile(): Promise<boolean> {
  if (isSaveAsDialogOpen) {
    updateSaveDialogStatus('opening');
    return false;
  }

  if (!flushSourceDraftBeforeSaveOrReplace('save')) {
    return false;
  }
  const currentContent = syncLatestEditorContent();
  const editorState = useEditorStore.getState();
  isSaveAsDialogOpen = true;
  updateSaveDialogStatus('opening');
  try {
    const result = await window.plotflow.file.saveAs(currentContent);
    if (!result) {
      updateSaveDialogStatus('cancelled');
      return false;
    }
    const newPath = result.filePath.replace(/\\/g, '/');
    editorState.setFilePath(newPath);
    editorState.setFileBaseline(result.hash, result.modifiedAt);
    editorState.clearPendingExternalChange();
    editorState.markSaved();
    rememberRecentStory(newPath, result.hash, result.modifiedAt);
    pendingPath = newPath;
    pendingContent = null;
    lastSavedContent = currentContent;
    updateSaveDialogStatus('success', newPath);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateSaveDialogStatus('failed', message);
    return false;
  } finally {
    isSaveAsDialogOpen = false;
    clearTransientSelectionState();
  }
}

export async function overwritePendingExternalChange(): Promise<boolean> {
  if (!flushSourceDraftBeforeSaveOrReplace('save')) return false;
  const currentContent = syncLatestEditorContent();
  const editorState = useEditorStore.getState();
  const pending = editorState.pendingExternalChange;
  if (!pending || editorState.filePath === null) {
    return false;
  }

  return performSave(currentContent, editorState.filePath, {
    overwriteConflict: true,
    expectedHash: pending.hash,
  });
}

export function clearPendingSave(): void {
  clearSaveTimer();
  pendingContent = null;
  pendingPath = null;
}
