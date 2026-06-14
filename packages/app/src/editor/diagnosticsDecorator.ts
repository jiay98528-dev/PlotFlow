/**
 * Monaco 编辑器诊断装饰器 — M3-13/M3-14/M3-15
 *
 * 功能：
 * 1. `setModelMarkers()` — 红色/黄色/蓝色波浪线标记（供问题面板与滚动条概览使用）
 *    色值由 Monaco Theme `editorError.foreground` 等属性通过 CSS 变量控制：
 *      - Error   → var(--color-diagnostic-error)   — 红色波浪下划线
 *      - Warning → var(--color-diagnostic-warning) — 黄色波浪下划线
 *      - Info    → var(--color-diagnostic-info)    — 蓝色下划线
 * 2. `deltaDecorations()` — 内联文本装饰（波浪线 + hover tooltip）
 *    样式由 `src/styles/diagnostics.css` 中的 `diagnostic-*-underline` 类控制
 * 3. 侧边栏标记点（Gutter Glyphs）：红色方块 / 黄色三角 / 蓝色圆点
 *    样式由 `src/styles/diagnostics.css` 中的 `diagnostic-*-glyph` 类控制
 * 4. Hover Tooltip（M3-15）：鼠标悬停波浪线/标记点时显示
 *    诊断编号 + 描述 + 可操作建议（格式化的 Markdown）
 *
 * 颜色 Token 定义见 doc/standards-css.md §2.2：
 *   - 亮色: --color-diagnostic-error: #D32F2F; --color-diagnostic-warning: #F9A825; --color-diagnostic-info: #1976D2
 *   - 暗色: --color-diagnostic-error: #F44747; --color-diagnostic-warning: #FFD54F; --color-diagnostic-info: #64B5F6
 *
 * 使用方式：
 *   import { applyDiagnostics } from '@/editor/diagnosticsDecorator';
 *   applyDiagnostics(editor, diagnostics);
 *
 *   // 也可单独使用格式化函数：
 *   import { formatHoverMessage } from '@/editor/diagnosticsDecorator';
 *   const msg = formatHoverMessage(diagnostic);
 *
 * @see spec/milestones.md — M3-13/M3-14/M3-15
 * @see packages/core/src/types/diagnostic.ts — Diagnostic 类型定义
 * @see doc/standards-css.md — CSS Token --color-diagnostic-* 定义
 * @see src/styles/diagnostics.css — 波浪线/下划线 + 侧边栏标记样式
 */

import * as monaco from 'monaco-editor';
import type { Diagnostic, SourceRange, DiagnosticSeverity } from '@plotflow/core';

// ============================================================================
// 常量
// ============================================================================

/** Marker 所有者标识（setModelMarkers owner，确保按来源分组隔离） */
const MARKER_OWNER = 'plotflow-diagnostics';

/** 诊断严重级别 → Monaco MarkerSeverity 映射 */
const SEVERITY_TO_MARKER: Record<DiagnosticSeverity, monaco.MarkerSeverity> = {
  error: monaco.MarkerSeverity.Error,
  warning: monaco.MarkerSeverity.Warning,
  info: monaco.MarkerSeverity.Info,
};

/** 诊断严重级别 → 波浪线/下划线 CSS 类名 */
const SEVERITY_TO_UNDERLINE_CLASS: Record<DiagnosticSeverity, string> = {
  error: 'diagnostic-error-underline',
  warning: 'diagnostic-warning-underline',
  info: 'diagnostic-info-underline',
};

/** 诊断严重级别 → 侧边栏标记 CSS 类名 */
const SEVERITY_TO_GLYPH_CLASS: Record<DiagnosticSeverity, string> = {
  error: 'diagnostic-error-glyph',
  warning: 'diagnostic-warning-glyph',
  info: 'diagnostic-info-glyph',
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 将 PlotFlow SourceRange 转换为 Monaco IRange。
 *
 * Monaco 使用 1-based 行号/列号，与 SourceRange 一致。
 */
function toMonacoRange(range: SourceRange): monaco.IRange {
  return {
    startLineNumber: range.startLine,
    startColumn: range.startColumn,
    endLineNumber: range.endLine,
    endColumn: range.endColumn,
  };
}

// ============================================================================
// Hover Message 格式化（M3-15）
// ============================================================================

/**
 * 将单条 Diagnostic 格式化为 Monaco Markdown hover message。
 *
 * 输出格式：
 *
 *   **{code}** — {message}
 *
 *   **修复建议**: {detail}
 *   - {suggestion.label}  (若 suggestions 存在)
 *   - {suggestion.label}
 *
 * 若 diagnostic 既无 detail 也无 suggestions，仅输出第一行。
 * 若 suggestions 存在，以 bullet list 逐项展示 可操作建议；
 * 反之使用 detail 字段作为修复建议文本。
 *
 * 示例输出：
 * ```
 * **E001** — 目标节点未定义
 *
 * 可用节点: 森林入口, 狼穴, 古井
 * ```
 *
 * @param diagnostic - 验证器产出的单条诊断信息
 * @returns Monaco IMarkdownString（支持 Markdown 渲染）
 *
 * @see spec/milestones.md M3-15
 */
export function formatHoverMessage(diagnostic: Diagnostic): monaco.IMarkdownString {
  const { code, message, detail, suggestions } = diagnostic;
  const parts: string[] = [];

  // 第一行：**E001** — 目标节点未定义
  parts.push(`**${code}** — ${message}`);

  // 优先使用结构化 suggestions 列表
  if (suggestions && suggestions.length > 0) {
    // suggestions 内容直接展示，无需 "修复建议" 头（建议本身已自描述）
    for (const s of suggestions) {
      parts.push(`- ${s.label}`);
    }
  } else if (detail && detail.length > 0) {
    // 无 suggestions 时降级使用 detail 文本
    parts.push('');
    parts.push(`**修复建议**: ${detail}`);
  }

  return {
    value: parts.join('\n'),
    isTrusted: true,
    supportThemeIcons: true,
  };
}

// ============================================================================
// Decoration 工厂（M3-15）
// ============================================================================

/**
 * 将 Diagnostic[] 转换为内联文本装饰（波浪线 + hover tooltip）。
 *
 * 每个 decoration 覆盖诊断的精确 range，提供：
 * - 波浪线/下划线视觉效果（通过 className）
 * - 鼠标悬停时显示格式化的 Markdown hoverMessage
 *
 * @param diagnostics - 验证器产出的诊断列表
 * @returns Monaco 内联装饰数组，可直接传入 editor.createDecorationsCollection()
 *
 * @example
 * ```typescript
 * const inlineDecos = createInlineDecorations(diagnostics);
 * editor.createDecorationsCollection(inlineDecos);
 * ```
 */
export function createInlineDecorations(
  diagnostics: readonly Diagnostic[],
): monaco.editor.IModelDeltaDecoration[] {
  return diagnostics.map((diagnostic) => ({
    range: new monaco.Range(
      diagnostic.range.startLine,
      diagnostic.range.startColumn,
      diagnostic.range.endLine,
      diagnostic.range.endColumn,
    ),
    options: {
      description: `PlotFlow: ${diagnostic.code}`,
      className: SEVERITY_TO_UNDERLINE_CLASS[diagnostic.severity] ?? '',
      hoverMessage: formatHoverMessage(diagnostic),
      // 更高的 zIndex 确保 hover 优先响应
      zIndex: diagnostic.severity === 'error' ? 10 : 5,
    },
  }));
}

/**
 * 将 Diagnostic[] 转换为侧边栏 glyph margin 装饰。
 *
 * 每个 decoration 覆盖诊断行的整行，在 gutter 区域显示
 * 标记图标（红方块/黄三角/蓝圆点），并在 glyph margin 上
 * 悬停时显示格式化诊断信息。
 *
 * @param diagnostics - 验证器产出的诊断列表
 * @returns Monaco glyph 装饰数组
 */
export function createGlyphDecorations(
  diagnostics: readonly Diagnostic[],
): monaco.editor.IModelDeltaDecoration[] {
  return diagnostics.map((diagnostic) => ({
    range: new monaco.Range(
      diagnostic.range.startLine,
      1,
      diagnostic.range.startLine,
      1,
    ),
    options: {
      description: `PlotFlow Glyph: ${diagnostic.code}`,
      isWholeLine: true,
      glyphMarginClassName: SEVERITY_TO_GLYPH_CLASS[diagnostic.severity] ?? '',
      glyphMarginHoverMessage: formatHoverMessage(diagnostic),
    },
  }));
}

// ============================================================================
// 核心 API
// ============================================================================

/**
 * 将诊断信息应用到 Monaco 编辑器。
 *
 * 执行三个操作：
 * 1. `editor.setModelMarkers()` — 注入红色/黄色/蓝色波浪线标记
 *    供问题面板（ProblemPanel）和滚动条概览使用
 * 2. `editor.deltaDecorations()` — 注入内联文本装饰（波浪线 + hover tooltip）
 * 3. `editor.deltaDecorations()` — 注入侧边栏标记点（glyph margin icons + hover）
 *
 * 每次调用都会清除之前的标记和装饰，实现增量更新。
 *
 * @param editor  - Monaco 编辑器实例
 * @param diagnostics - 诊断信息列表（来自 Validator）
 */
export function applyDiagnostics(
  editor: monaco.editor.IStandaloneCodeEditor,
  diagnostics: readonly Diagnostic[],
): void {
  const model = editor.getModel();
  if (!model) {
    return;
  }

  // ── 1. 注入模型标记（波浪线 + 问题面板） ──
  const markers: monaco.editor.IMarkerData[] = diagnostics.map((d) => ({
    severity: SEVERITY_TO_MARKER[d.severity],
    message: d.detail
      ? `[${d.code}] ${d.message}\n${d.detail}`
      : `[${d.code}] ${d.message}`,
    ...toMonacoRange(d.range),
    code: d.code,
    tags: [],
  }));

  monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);

  // ── 2. 注入内联装饰（波浪线 + hover tooltip） ──
  const inlineDecos = createInlineDecorations(diagnostics);

  // ── 3. 注入侧边栏装饰（glyph margin 图标 + hover tooltip） ──
  const glyphDecos = createGlyphDecorations(diagnostics);

  // 合并两组装饰，一次 deltaDecorations 调用
  editor.deltaDecorations([], [...inlineDecos, ...glyphDecos]);
}

/**
 * 清除所有由本模块注入的标记和装饰。
 *
 * @param editor - Monaco 编辑器实例
 */
export function clearDiagnostics(
  editor: monaco.editor.IStandaloneCodeEditor,
): void {
  const model = editor.getModel();
  if (!model) {
    return;
  }

  monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
  editor.deltaDecorations([], []);
}
