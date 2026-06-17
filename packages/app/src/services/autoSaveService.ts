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
import type { FileSaveResult } from '../types/electron';

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

  switch (type) {
    case 'saving':
      uiStore.setStatusMessage(`${SAVE_STATUS_PREFIX}saving⏳ 保存中...`);
      break;
    case 'success':
      uiStore.setStatusMessage(`${SAVE_STATUS_PREFIX}success✅ 已保存`);
      // 短暂显示后清除
      setTimeout(() => {
        const current = useUIStore.getState().statusMessage;
        if (current === `${SAVE_STATUS_PREFIX}success✅ 已保存`) {
          useUIStore.getState().setStatusMessage('');
        }
      }, STATUS_DISPLAY_MS);
      break;
    case 'failed':
      uiStore.setStatusMessage(`${SAVE_STATUS_PREFIX}failed❌ 保存失败: ${detail ?? '未知错误'}`);
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

/**
 * 执行实际的保存操作
 */
async function performSave(content: string, path: string): Promise<void> {
  if (isSaving) return;

  // 双重脏检测：内容对比（防竞态）+ isDirty 标记
  // 当异步保存过程中用户继续输入时，isDirty 可能被旧保存完成重置为 false，
  // 但 lastSavedContent !== content 能兜住这种情况。
  if (content === lastSavedContent && !useEditorStore.getState().isDirty) return;

  isSaving = true;
  updateStatusMessage('saving');
  let succeeded = false;

  try {
    const result: FileSaveResult = await window.plotflow.file.save(path, content);

    if (result.success) {
      // 标记为已保存，清除脏状态
      lastSavedContent = content;
      useEditorStore.getState().markSaved();
      updateStatusMessage('success');
      succeeded = true;
    } else {
      updateStatusMessage('failed', '文件写入返回异常');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateStatusMessage('failed', message);
  } finally {
    isSaving = false;

    if (succeeded) {
      // P0-2: 保存成功 → 检查期间是否有新内容到达（防竞态数据丢失）
      if (pendingContent !== null && pendingPath !== null && pendingContent !== content) {
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
export async function forceSave(): Promise<void> {
  // 清除防抖定时器
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  // 如果有待保存的内容，立即保存
  if (pendingContent !== null && pendingPath !== null) {
    await performSave(pendingContent, pendingPath);
    return;
  }

  // 没有待保存内容，但可能存储已被 markSaved() 清空
  // 检查编辑器是否有脏内容但未被 debouncedSave 捕获
  const editorState = useEditorStore.getState();
  if (editorState.isDirty && editorState.filePath !== null) {
    await performSave(editorState.content, editorState.filePath);
  }
}

/**
 * 智能保存：已有文件路径则直接保存，新文件则弹出另存为对话框。
 *
 * P0-3: 解决新建文件 Ctrl+S 被静默忽略的问题。
 * 供 Ctrl+S 快捷键和 File > Save 菜单使用。
 */
export async function saveOrSaveAs(): Promise<void> {
  await forceSave();

  const editorState = useEditorStore.getState();
  // forceSave 未处理的情况：新文件（有脏内容但无文件路径）
  if (editorState.isDirty && editorState.filePath === null && editorState.content.length > 0) {
    // 动态导入 FileService 避免循环依赖
    const { FileService } = await import('./fileService');
    const fileService = new FileService();
    try {
      const newPath = await fileService.saveFileAs(editorState.content);
      editorState.setFilePath(newPath);
      editorState.markSaved();
      // 更新模块级缓存，使后续 debouncedSave 能正常工作
      pendingPath = newPath;
      pendingContent = null;
      lastSavedContent = editorState.content;
      useUIStore.getState().setStatusMessage(`已保存至: ${newPath}`);
    } catch {
      // 用户取消另存为对话框 → 正常行为，静默处理
    }
  }
}

/**
 * 清除防抖定时器和待保存状态
 *
 * 在组件卸载、切换文件或应用关闭时调用。
 */
export function clearPendingSave(): void {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingContent = null;
  pendingPath = null;
}
