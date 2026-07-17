/**
 * Monaco 编辑器诊断装饰器 — M3-13/M3-14/M3-15
 *
 * 功能：
 * 1. `setModelMarkers()` — 红色/黄色/蓝色波浪线标记（供问题面板与滚动条概览使用）
 * 2. `IEditorDecorationsCollection.set()` — 内联文本装饰（波浪线 + hover tooltip）
 *    + 侧边栏标记点（glyph margin icons + hover）
 *    使用 createDecorationsCollection API（Monaco 0.31+），自动追踪/替换旧装饰，
 *    彻底杜绝 deltaDecorations([], ...) 导致的 DOM 累积泄漏。
 * 3. Hover Tooltip（M3-15）：鼠标悬停波浪线/标记点时显示
 *    诊断编号 + 描述 + 可操作建议（格式化的 Markdown）
 *
 * 架构要点 (2026-06-20 根因修复):
 * - 严禁使用 `editor.deltaDecorations([], newDecos)` — 空数组表示"不删除旧装饰"
 * - 使用 `editor.createDecorationsCollection()` 替代，内部自动追踪装饰 ID
 * - setModelMarkers 天然防泄漏（基于 owner 替换，非追加）
 *
 * 使用方式：
 *   import { applyDiagnostics, clearDiagnostics } from '@/editor/diagnosticsDecorator';
 *   applyDiagnostics(editor, diagnostics);
 *   clearDiagnostics(editor);
 *
 * @see spec/milestones.md — M3-13/M3-14/M3-15
 * @see packages/core/src/types/diagnostic.ts — Diagnostic 类型定义
 * @see src/styles/diagnostics.css — 波浪线/下划线 + 侧边栏标记样式
 */

import * as monaco from 'monaco-editor';
import type { Diagnostic, SourceRange, DiagnosticSeverity } from '@plotflow/core';

// ============================================================================
// 常量
// ============================================================================

/** Marker 所有者标识（setModelMarkers owner，确保按来源分组隔离） */
const MARKER_OWNER = 'plotflow-diagnostics';

/**
 * 装饰器集合缓存（按编辑器实例隔离）。
 *
 * 使用 Monaco 0.31+ 的 `createDecorationsCollection()` API 替代手动的
 * `deltaDecorations(oldIds, newDecos)`。该 API 内部自动追踪装饰 ID，
 * `collection.set()` 自动替换旧装饰，从架构层面杜绝 DOM 累积泄漏。
 *
 * 每个编辑器实例独立一个 IEditorDecorationsCollection，
 * 编辑器 dispose 后 Monaco 自动清理其装饰，WeakMap 随之 GC。
 */
const decorationCollections = new WeakMap<
  monaco.editor.IStandaloneCodeEditor,
  monaco.editor.IEditorDecorationsCollection
>();

/**
 * 获取或创建编辑器实例对应的装饰器集合。
 *
 * 惰性创建（首次调用时），后续调用复用同一集合实例。
 */
function getDecorationCollection(
  editor: monaco.editor.IStandaloneCodeEditor,
): monaco.editor.IEditorDecorationsCollection {
  let collection = decorationCollections.get(editor);
  if (!collection) {
    collection = editor.createDecorationsCollection();
    decorationCollections.set(editor, collection);
  }
  return collection;
}

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
      description: `Fablevia: ${diagnostic.code}`,
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
      description: `Fablevia Glyph: ${diagnostic.code}`,
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
 * 执行两个操作：
 * 1. `editor.setModelMarkers()` — 注入模型标记（owner-based 替换，天然防泄漏）
 * 2. `collection.set()` — 注入内联+侧边栏装饰，自动替换旧装饰，杜绝 DOM 累积
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

  // ── 1. 注入模型标记（owner-based 替换 → 天然无泄漏） ──
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

  // ── 2. 注入装饰（createDecorationsCollection 自动替换旧装饰） ──
  const inlineDecos = createInlineDecorations(diagnostics);
  const glyphDecos = createGlyphDecorations(diagnostics);

  getDecorationCollection(editor).set([...inlineDecos, ...glyphDecos]);
}

/**
 * 清除所有由本模块注入的标记和装饰。
 *
 * `collection.clear()` 内部自动清除追踪的旧装饰 ID，确保 DOM 完全清理。
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

  // createDecorationsCollection 内部追踪旧 ID，clear() 确保全部移除
  getDecorationCollection(editor).clear();
}
