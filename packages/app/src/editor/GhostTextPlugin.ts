/**
 * GhostTextPlugin — Monaco 幽灵文本补全插件 (M5-08~13)
 *
 * ## 功能概述
 * - **M5-08**: 注册 InlineCompletionItemProvider (幽灵字符) + CompletionItemProvider (Ctrl+Space)
 * - **M5-09**: 四维触发检测（节点标题 / 选项句式 / 正文描述 / 变量名）
 * - **M5-10**: 灰色半透明幽灵字符渲染，使用 Monaco InlineCompletionItem
 * - **M5-11**: Tab 接受 / Esc 移除 / 继续输入不一致自动消失（Monaco 原生行为）
 * - **M5-12**: Ctrl+Space 多候选下拉列表，方向键+Enter 选择
 * - **M5-13**: 频率控制，输入间隔 <100ms 不触发补全
 *
 * ## 触发维度
 * | 触发前缀            | 补全维度     | 候选来源                  |
 * |---------------------|-------------|--------------------------|
 * | `# 节点：`/`## 节点：` | node-title  | NGramEngine (语料+学习)   |
 * | `[选项]` 后文字       | option-text | NGramEngine (语料+上下文) |
 * | 正文任意输入          | body-text   | NGramEngine (N-gram)      |
 * | `$` 后文字            | variable-name | InvertedIndex + Frontmatter |
 *
 * ## 使用方式
 * ```typescript
 * import { registerGhostTextProvider } from './GhostTextPlugin';
 * const { inlineDisposable, completionDisposable } = registerGhostTextProvider(ngramEngine, invertedIndex);
 * ```
 *
 * @module editor/GhostTextPlugin
 * @see CLAUDE.md §6.4 补全引擎触发规则
 * @see TAD.md §3.4 补全引擎架构
 * @see spec/milestones.md M5-08~M5-13
 */

import * as monaco from 'monaco-editor';
import type { CompletionDimension } from '@plotflow/core';
import { NGramEngine, InvertedIndex } from '@plotflow/core';
import { PLOTFLOW_LANGUAGE_ID } from './monaco-tokenizer';
import { useStoryStore } from '../stores/storyStore';

// ============================================================================
// 常量
// ============================================================================

/** 补全触发最小间隔 (ms)，低于此值不触发 (M5-13) */
const MIN_TRIGGER_INTERVAL_MS = 100;

/** 幽灵文本多 token 扩展上限（节点标题/选项句式） */
const GHOST_MULTI_TOKEN_MAX_TITLE = 3;

/** 幽灵文本多 token 扩展上限（正文描述） */
const GHOST_MULTI_TOKEN_MAX_BODY = 2;

/** Ctrl+Space 下拉候选数量上限 */
const CTRL_SPACE_CANDIDATE_LIMITS: Record<string, number> = {
  'node-title': 5,
  'option-text': 3,
  'body-text': 1,
  'variable-name': 10,
};

// ============================================================================
// 模块级状态
// ============================================================================

/** 上次触发时间戳 (ms) */
let lastTriggerTime = 0;

/** N-gram 引擎引用 */
let ngramEngine: NGramEngine | null = null;

/** 倒排索引引用 */
let invertedIndex: InvertedIndex | null = null;

/** 注册的 disposable 句柄 */
let inlineDisposable: monaco.IDisposable | null = null;
let completionDisposable: monaco.IDisposable | null = null;

// ============================================================================
// 触发检测 (M5-09)
// ============================================================================

/**
 * 检测该行是否为 '特殊行'（非正文段落）。
 *
 * 特殊行包括：空行、Frontmatter 分隔符、HTML 注释、标题、
 * 选项行、条件行、列表项。
 */
function isSpecialLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) return true;
  if (/^---/.test(trimmed)) return true;
  if (/^<!--/.test(trimmed)) return true;
  if (/^(#{1,6})\s/.test(trimmed)) return true;
  if (/^\[选项\]/.test(trimmed)) return true;
  if (/^\[条件\]/.test(trimmed)) return true;
  if (/^[*-]\s/.test(trimmed)) return true;
  return false;
}

/**
 * 根据当前行内容和光标位置检测触发维度。
 *
 * 检查顺序与优先级一致（节点标题 > 选项句式 > 变量名 > 正文描述）。
 */
function detectTriggerDimension(
  model: monaco.editor.ITextModel,
  position: monaco.Position,
): { dimension: CompletionDimension; prefix: string; contextBefore: string } | null {
  const lineContent = model.getLineContent(position.lineNumber);
  const textBeforeCursor = lineContent.substring(0, position.column - 1);

  // 1. 节点标题触发: 该行以 '# 节点：' / '## 节点：' 开头
  if (/^(#{1,2})\s+节点：/.test(lineContent)) {
    const prefix = textBeforeCursor.replace(/^(#{1,2})\s+节点：\s*/, '');
    return { dimension: 'node-title', prefix, contextBefore: prefix };
  }

  // 2. 选项句式触发: 该行以 '[选项]' 开头
  if (/^\[选项\]\s/.test(lineContent)) {
    const prefix = textBeforeCursor.replace(/^\[选项\]\s*/, '');
    return { dimension: 'option-text', prefix, contextBefore: prefix };
  }

  // 3. 变量名触发: 光标前最近的非空白字符序列以 '$' 开头
  const dollarMatch = textBeforeCursor.match(/\$(\w*)$/);
  if (dollarMatch) {
    return {
      dimension: 'variable-name',
      prefix: dollarMatch[1]!,
      contextBefore: textBeforeCursor,
    };
  }

  // 4. 正文描述触发: 在正文段落中（非特殊行），且光标前有非空内容
  if (!isSpecialLine(lineContent) && textBeforeCursor.trim().length > 0) {
    return {
      dimension: 'body-text',
      prefix: textBeforeCursor,
      contextBefore: textBeforeCursor.slice(-50),
    };
  }

  return null;
}

// ============================================================================
// 建议生成
// ============================================================================

/**
 * 为变量名前缀生成单个幽灵文本建议。
 *
 * 使用 InvertedIndex 查找前缀匹配，返回未键入的后缀部分。
 */
function generateVariableSuggestion(prefix: string): string | null {
  if (!invertedIndex || prefix.length === 0) return null;
  const matches = invertedIndex.search(prefix, 1);
  if (matches.length === 0) return null;
  // 返回用户尚未键入的后缀
  return matches[0]!.slice(prefix.length);
}

/**
 * 使用 NGramEngine 预测并链接多个 token，生成更长的幽灵文本。
 *
 * 贪婪策略：每次预测下一个 token，追加到输入，重复直到达上限或无预测。
 *
 * @param text - 上下文文本
 * @param maxTokens - 最大链接 token 数
 * @returns 链接后的预测文本（空字符串表示无预测）
 */
function generateMultiTokenSuggestion(text: string, maxTokens: number): string {
  if (!ngramEngine || text.trim().length === 0) return '';

  let result = '';
  let current = text;

  for (let i = 0; i < maxTokens; i++) {
    const predictions = ngramEngine.predict(current, 1);
    if (predictions.length === 0) break;
    const next = predictions[0]!;
    result += next;
    current += next;
  }

  return result;
}

// ============================================================================
// InlineCompletionItemProvider — 幽灵文本 (M5-08, M5-09, M5-10, M5-13)
// ============================================================================

/**
 * Ghost Text 内联补全提供者。
 *
 * 负责在光标后方渲染灰色半透明幽灵字符。
 * Monaco 原生处理 Tab（接受）/ Esc（移除）/ 输入覆盖（不一致自动消失）交互 (M5-11)。
 */
const inlineProvider: monaco.languages.InlineCompletionsProvider = {
  provideInlineCompletions: async (
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    _context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken,
  ): Promise<monaco.languages.InlineCompletions> => {
    // --- M5-13: 频率控制 ---
    const now = Date.now();
    if (now - lastTriggerTime < MIN_TRIGGER_INTERVAL_MS) {
      return { items: [] };
    }
    if (token.isCancellationRequested) return { items: [] };

    // --- 触发检测 ---
    const trigger = detectTriggerDimension(model, position);
    if (!trigger) return { items: [] };
    lastTriggerTime = now;

    if (token.isCancellationRequested) return { items: [] };

    // --- 生成建议 ---
    let suggestion: string | null = null;

    if (trigger.dimension === 'variable-name') {
      suggestion = generateVariableSuggestion(trigger.prefix);
    } else if (trigger.dimension === 'node-title' || trigger.dimension === 'option-text') {
      suggestion = generateMultiTokenSuggestion(trigger.contextBefore, GHOST_MULTI_TOKEN_MAX_TITLE);
    } else {
      suggestion = generateMultiTokenSuggestion(trigger.contextBefore, GHOST_MULTI_TOKEN_MAX_BODY);
    }

    if (!suggestion || suggestion.length === 0) return { items: [] };

    if (token.isCancellationRequested) return { items: [] };

    // --- 构建 InlineCompletionItem (M5-10) ---
    // range 为零宽度（起始 = 结束 = 光标位置），表示在光标后方插入
    const item: monaco.languages.InlineCompletion = {
      insertText: suggestion,
      filterText: suggestion,
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
    };

    return { items: [item] };
  },

  freeInlineCompletions: () => {
    // 无外部资源需要释放
  },
};

// ============================================================================
// CompletionItemProvider — Ctrl+Space 下拉列表 (M5-12)
// ============================================================================

/**
 * Ctrl+Space 显式补全提供者。
 *
 * 在用户按 Ctrl+Space 时打开下拉列表，显示所有匹配候选。
 * 支持方向键 + Enter 选择。
 */
const completionProvider: monaco.languages.CompletionItemProvider = {
  // 不设置 triggerCharacters，仅响应显式调用（Ctrl+Space）
  triggerCharacters: [],

  provideCompletionItems: (
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.CompletionContext,
    token: monaco.CancellationToken,
  ): monaco.languages.ProviderResult<monaco.languages.CompletionList> => {
    // 仅响应 Ctrl+Space 显式调用
    if (context.triggerKind !== monaco.languages.CompletionTriggerKind.Invoke) {
      return { suggestions: [] };
    }

    if (token.isCancellationRequested) return { suggestions: [] };

    const trigger = detectTriggerDimension(model, position);
    if (!trigger) return { suggestions: [] };

    if (token.isCancellationRequested) return { suggestions: [] };

    const suggestions: monaco.languages.CompletionItem[] = [];
    const limit = CTRL_SPACE_CANDIDATE_LIMITS[trigger.dimension] ?? 5;

    switch (trigger.dimension) {
      // ── 变量名 ──
      case 'variable-name': {
        // 来自 InvertedIndex
        if (invertedIndex && trigger.prefix.length > 0) {
          const matches = invertedIndex.search(trigger.prefix, limit);
          for (const match of matches) {
            const suffix = match.slice(trigger.prefix.length);
            suggestions.push({
              label: `$${match}`,
              insertText: suffix,
              kind: monaco.languages.CompletionItemKind.Variable,
              detail: 'InvertedIndex 匹配',
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column - trigger.prefix.length,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            });
          }
        }

        // 来自 Frontmatter 变量声明
        const plotFlowData = useStoryStore.getState().plotFlowData;
        if (plotFlowData?.variables) {
          for (const v of plotFlowData.variables) {
            if (v.name.startsWith(trigger.prefix) || trigger.prefix.length === 0) {
              // 避免与 InvertedIndex 结果重复
              const alreadyAdded = suggestions.some(
                (s) => s.label === `$${v.name}`,
              );
              if (!alreadyAdded) {
                suggestions.push({
                  label: `$${v.name}`,
                  insertText: v.name.slice(trigger.prefix.length),
                  kind: monaco.languages.CompletionItemKind.Variable,
                  detail: `类型: ${v.type}${v.description ? ` — ${v.description}` : ''}`,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column - trigger.prefix.length,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                });
              }
            }
          }
        }
        break;
      }

      // ── 节点标题 ──
      case 'node-title': {
        if (ngramEngine) {
          const predictions = ngramEngine.predictScored(trigger.contextBefore, limit);
          for (const p of predictions) {
            suggestions.push({
              label: p.text,
              insertText: p.text,
              kind: monaco.languages.CompletionItemKind.Text,
              detail: `节点标题 (评分: ${p.score.toFixed(2)})`,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            });
          }
        }
        break;
      }

      // ── 选项句式 ──
      case 'option-text': {
        if (ngramEngine) {
          const predictions = ngramEngine.predictScored(trigger.contextBefore, limit);
          for (const p of predictions) {
            suggestions.push({
              label: p.text,
              insertText: p.text,
              kind: monaco.languages.CompletionItemKind.Text,
              detail: `选项句式 (评分: ${p.score.toFixed(2)})`,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            });
          }
        }
        break;
      }

      // ── 正文描述 ──
      case 'body-text': {
        if (ngramEngine) {
          const predictions = ngramEngine.predictScored(trigger.contextBefore, limit);
          for (const p of predictions) {
            suggestions.push({
              label: p.text,
              insertText: p.text,
              kind: monaco.languages.CompletionItemKind.Text,
              detail: `正文补全 (评分: ${p.score.toFixed(2)})`,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            });
          }
        }
        break;
      }
    }

    return { suggestions };
  },
};

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 注册 PlotFlow 幽灵文本补全提供者 (M5-08)。
 *
 * 同时注册两层提供者：
 * 1. **InlineCompletionItemProvider** — 幽灵字符（灰色半透明，Tab/Esc 交互）
 * 2. **CompletionItemProvider** — Ctrl+Space 显式下拉列表
 *
 * 调用方应在应用启动时调用一次，并负责在应用退出时调用 `unregisterGhostTextProvider()`
 * 或自行 dispose 返回的 disposable。
 *
 * @param engine - 已训练的 NGramEngine 实例
 * @param index  - 已填充的 InvertedIndex 实例（变量名索引）
 * @returns 两个 disposable 句柄，用于取消注册
 *
 * @example
 * ```typescript
 * // 在 App.tsx 初始化时
 * const engine = new NGramEngine();
 * const index = new InvertedIndex();
 * // ... 训练引擎 / 填充索引 ...
 * const { inlineDisposable, completionDisposable } = registerGhostTextProvider(engine, index);
 * ```
 */
export function registerGhostTextProvider(
  engine: NGramEngine,
  index: InvertedIndex,
): {
  inlineDisposable: monaco.IDisposable;
  completionDisposable: monaco.IDisposable;
} {
  ngramEngine = engine;
  invertedIndex = index;

  // 注册幽灵文本内联补全 (M5-08, M5-10)
  inlineDisposable = monaco.languages.registerInlineCompletionsProvider(
    PLOTFLOW_LANGUAGE_ID,
    inlineProvider,
  );

  // 注册 Ctrl+Space 显式补全 (M5-12)
  completionDisposable = monaco.languages.registerCompletionItemProvider(
    PLOTFLOW_LANGUAGE_ID,
    completionProvider,
  );

  return { inlineDisposable, completionDisposable };
}

/**
 * 取消注册所有 PlotFlow 补全提供者，释放引擎引用。
 *
 * 应在编辑器销毁或应用退出时调用。
 *
 * @example
 * ```typescript
 * // 在 cleanup 中
 * unregisterGhostTextProvider();
 * ```
 */
export function unregisterGhostTextProvider(): void {
  if (inlineDisposable) {
    inlineDisposable.dispose();
    inlineDisposable = null;
  }
  if (completionDisposable) {
    completionDisposable.dispose();
    completionDisposable = null;
  }
  ngramEngine = null;
  invertedIndex = null;
}

/**
 * 检查 GhostTextPlugin 是否已注册。
 *
 * @returns 若所有提供者均已注册并持有引擎引用则返回 true
 */
export function isGhostTextProviderRegistered(): boolean {
  return (
    inlineDisposable !== null &&
    completionDisposable !== null &&
    ngramEngine !== null &&
    invertedIndex !== null
  );
}
