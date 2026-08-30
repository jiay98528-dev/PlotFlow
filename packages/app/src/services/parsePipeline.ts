/**
 * 解析管线 — 连接 parse → validate → store (M1+M2+M3 胶水代码)
 *
 * 编辑器内容变更 → 500ms debounce → parseStory → validate →
 *   → useStoryStore.setPlotFlowData → useGraphStore.syncFromAST →
 *   → useEditorStore.setDiagnostics
 *
 * 操作锁 (M2-09): 分支图连线拖拽期间跳过解析同步。
 */

import { useStoryStore } from '../stores/storyStore';
import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useUIStore } from '../stores/uiStore';
import { appT } from '../i18n/appI18n';
import {
  createStorySnapshot,
  type PreparedStorySnapshot,
  type StoryIdentity,
} from './storySnapshot';

// ============================================================================
// 模块级状态
// ============================================================================

let parseTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;
const PARSE_STATUS_PREFIX = 'parse:';
const SAVE_STATUS_PREFIX = 'save:';

function pipelineText(key: string, params?: Readonly<Record<string, string | number>>): string {
  return appT(key, params, useUIStore.getState().language);
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 500ms 防抖解析管线。
 *
 * 在编辑器每次内容变更时调用。等待 500ms 无新输入后执行完整解析管线。
 *
 * @param raw - 编辑器完整文本内容
 */
export function debouncedParsePipeline(raw: string): void {
  if (parseTimer) clearTimeout(parseTimer);

  parseTimer = setTimeout(() => {
    executePipeline(raw);
    parseTimer = null;
  }, DEBOUNCE_MS);
}

/**
 * 立即执行完整解析管线（不使用 debounce）。
 * 用于文件打开、切换等需要立即同步的场景。
 */
export function parsePipelineNow(raw: string): PreparedStorySnapshot | null {
  if (parseTimer) {
    clearTimeout(parseTimer);
    parseTimer = null;
  }
  return executePipeline(raw);
}

// ============================================================================
// 内部实现
// ============================================================================

function currentIdentity(): StoryIdentity {
  const editor = useEditorStore.getState();
  return {
    storySessionId: editor.storySessionId,
    contentRevision: editor.contentRevision,
    sourceDraftRevision: editor.sourceDraftRevision,
  };
}

export function publishStorySnapshot(snapshot: PreparedStorySnapshot): boolean {
  useStoryStore.getState().setPlotFlowData(snapshot.data, snapshot.identity);
  const projection = useGraphStore.getState().syncFromAST(snapshot.data);
  if (!projection.ok) {
    useUIStore
      .getState()
      .setStatusMessage(`${PARSE_STATUS_PREFIX}${pipelineText('parse.graphRenderFailed')}`);
  }
  useEditorStore.getState().setDiagnostics([...snapshot.diagnostics]);
  return projection.ok;
}

function executePipeline(raw: string): PreparedStorySnapshot | null {
  // M2-09: 操作锁 — 连线拖拽期间跳过解析同步
  const graphStore = useGraphStore.getState();
  if (graphStore.isEditing) return null;

  const identity = currentIdentity();
  const result = createStorySnapshot(raw, identity);
  if (!result.ok) {
    // 意外崩溃 — 极其罕见但必须兜底
    // eslint-disable-next-line no-console
    console.error('[ParsePipeline] parseStory threw unexpectedly:', result.error);
    const message = result.error instanceof Error ? result.error.message : String(result.error);
    useStoryStore.getState().setParseFailure(message, identity);
    useEditorStore.getState().setDiagnostics([]);
    if (useStoryStore.getState().plotFlowData === null) {
      useGraphStore.getState().syncFromAST(null);
    }
    const ui = useUIStore.getState();
    if (!ui.statusMessage.startsWith(SAVE_STATUS_PREFIX)) {
      ui.setStatusMessage(`${PARSE_STATUS_PREFIX}${pipelineText('parse.exception')}`);
    }
    return null;
  }

  const graphProjectionSucceeded = publishStorySnapshot(result.snapshot);

  // 6. 状态栏消息：有错误时提示用户分支图可能不完整 (V02-033)
  const errorCount = result.snapshot.diagnostics.filter((d) => d.severity === 'error').length;
  const ui = useUIStore.getState();
  if (ui.statusMessage.startsWith(SAVE_STATUS_PREFIX)) {
    return result.snapshot;
  }
  if (!graphProjectionSucceeded) return result.snapshot;

  if (errorCount > 0) {
    ui.setStatusMessage(
      `${PARSE_STATUS_PREFIX}${pipelineText('parse.syntaxErrors', { count: errorCount })}`,
    );
  } else {
    // 无错误时清除之前可能残留的错误消息
    const current = ui.statusMessage;
    if (current.startsWith(PARSE_STATUS_PREFIX)) {
      ui.setStatusMessage('');
    }
  }
  return result.snapshot;
}
