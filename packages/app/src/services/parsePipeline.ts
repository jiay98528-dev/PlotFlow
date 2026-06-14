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

// ============================================================================
// 模块级状态
// ============================================================================

let parseTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

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

  // 1. 解析
  const parseResult: ParseResult<PlotFlowData> = parseStory(raw);

  if (!parseResult.ok) {
    // 解析失败 — 设置错误诊断但不更新 AST
    useEditorStore.getState().setDiagnostics([...parseResult.errors]);
    return;
  }

  const ast = parseResult.data;

  // 2. 验证 (M3: 17 种诊断规则)
  const validationResult = validate(ast);

  // 3. 汇总诊断（parse 中的 warn/info + validate 中的全部诊断）
  const parseDiags: Diagnostic[] = 'diagnostics' in parseResult ? [...parseResult.diagnostics] : [];
  const validDiags: Diagnostic[] = validationResult.ok
    ? [...validationResult.diagnostics]
    : [...validationResult.errors];
  const allDiagnostics = [...parseDiags, ...validDiags];

  // 4. 更新 AST (M1)
  useStoryStore.getState().setPlotFlowData(ast);

  // 5. 更新分支图 (M2: AST → Nodes + Edges)
  useGraphStore.getState().syncFromAST(ast);

  // 6. 更新诊断 (M3: 波浪线 + 侧标 + Tooltip + 节点着色)
  useEditorStore.getState().setDiagnostics(allDiagnostics);
}
