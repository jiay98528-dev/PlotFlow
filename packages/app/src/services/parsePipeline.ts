/**
 * 解析管线 — 连接 parse → validate → store (M1+M2+M3 胶水代码)
 *
 * 编辑器内容变更 → 500ms debounce → parseStory → validate →
 *   → useStoryStore.setPlotFlowData → useGraphStore.syncFromAST →
 *   → useEditorStore.setDiagnostics
 *
 * 操作锁 (M2-09): 分支图连线拖拽期间跳过解析同步。
 */

import { parseStory, validate, type ParseResult, type PlotFlowData, type Diagnostic } from '@plotflow/core';
import { useStoryStore } from '../stores/storyStore';
import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import { useUIStore } from '../stores/uiStore';
import { appT } from '../i18n/appI18n';

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
export function parsePipelineNow(raw: string): void {
  if (parseTimer) {
    clearTimeout(parseTimer);
    parseTimer = null;
  }
  executePipeline(raw);
}

// ============================================================================
// 内部实现
// ============================================================================

function executePipeline(raw: string): void {
  // M2-09: 操作锁 — 连线拖拽期间跳过解析同步
  const graphStore = useGraphStore.getState();
  if (graphStore.isEditing) return;

  // 1. Parse (V02-033: parseStory 始终返回 AST，错误在 diagnostics 中)
  let parseResult: ParseResult<PlotFlowData>;
  try {
    parseResult = parseStory(raw);
  } catch (err) {
    // 意外崩溃 — 极其罕见但必须兜底
    // eslint-disable-next-line no-console
    console.error('[ParsePipeline] parseStory threw unexpectedly:', err);
    const ui = useUIStore.getState();
    if (!ui.statusMessage.startsWith(SAVE_STATUS_PREFIX)) {
      ui.setStatusMessage(`${PARSE_STATUS_PREFIX}${pipelineText('parse.exception')}`);
    }
    return;
  }

  if (!parseResult.ok) return; // unreachable: parseStory always returns ok

  const ast = parseResult.data;

  // 2. 验证 (M3: 17 种诊断规则)
  const validationResult = validate(ast);

  // 3. 汇总诊断（parse 中的全部诊断 + validate 中的全部诊断）
  const parseDiags: Diagnostic[] = [...parseResult.diagnostics];
  const validDiags: Diagnostic[] = validationResult.ok
    ? [...validationResult.diagnostics]
    : [...validationResult.errors];
  const allDiagnostics = [...parseDiags, ...validDiags];

  // BUG2 修复：按 code + 行/列去重（parser 与 validator 可能产出同一问题的不同 ID 格式）
  const seen = new Map<string, Diagnostic>();
  for (const d of allDiagnostics) {
    const key = `${d.code}:${d.range.startLine}:${d.range.startColumn}`;
    if (!seen.has(key)) seen.set(key, d);
  }
  const dedupedDiags = [...seen.values()];

  // 4. 更新 AST (M1) — 触发 App.tsx 中的 subscription 自动调用 graphStore.syncFromAST
  useStoryStore.getState().setPlotFlowData(ast);

  // 5. 更新诊断 (M3: 波浪线 + 侧标 + Tooltip + 节点着色)
  useEditorStore.getState().setDiagnostics(dedupedDiags);

  // 6. 状态栏消息：有错误时提示用户分支图可能不完整 (V02-033)
  const errorCount = allDiagnostics.filter((d) => d.severity === 'error').length;
  const ui = useUIStore.getState();
  if (ui.statusMessage.startsWith(SAVE_STATUS_PREFIX)) {
    return;
  }

  if (errorCount > 0) {
    ui.setStatusMessage(`${PARSE_STATUS_PREFIX}${pipelineText('parse.syntaxErrors', { count: errorCount })}`);
  } else {
    // 无错误时清除之前可能残留的错误消息
    const current = ui.statusMessage;
    if (current.startsWith(PARSE_STATUS_PREFIX)) {
      ui.setStatusMessage('');
    }
  }
}
