/**
 * Monaco Editor 统一初始化入口 (M1)
 *
 * 功能：
 * 1. 注册 'plotflow' 语言 ID
 * 2. 注册 Monarch Tokenizer 语法高亮 (M1-08)
 * 3. 注册 FoldingRangeProvider 折叠范围 (M1-09)
 * 4. 注册暗色/亮色双主题
 * 5. 导出 initMonacoEditor(container) 工厂函数
 *
 * 使用方式：
 *   import { initMonacoEditor } from '@/editor/setupEditor';
 *   const editor = initMonacoEditor(editorRef.current);
 *
 * @see spec/milestones.md — M1 里程碑
 * @see spec/design-brief-editor-ux.md — Monaco 编辑器交互设计
 */

import * as monaco from 'monaco-editor';

import { registerPlotFlowTokenizer, PLOTFLOW_LANGUAGE_ID } from './monaco-tokenizer';
import { registerFoldingProvider } from './foldingProvider';
import { NGramEngine, InvertedIndex, CorpusLoader } from '@plotflow/core';
import { registerGhostTextProvider } from './GhostTextPlugin';

// M3-13/M3-14: 诊断装饰器集成连接点
// 完整集成（在 App.tsx 中订阅 storyStore diagnostics 并调用 applyDiagnostics）将在 M3 阶段完成
// 当前仅在此处 re-export 模块接口，使外部可从 '@plotflow/app' 单一入口引用
export { applyDiagnostics, clearDiagnostics } from './diagnosticsDecorator';

// 主题 JSON — resolveJsonModule: true 已启用
import darkThemeData from './monaco-theme-dark.json';
import lightThemeData from './monaco-theme-light.json';

// ============================================================================
// 主题常量
// ============================================================================

export const THEME_DARK = 'plotflow-dark';
export const THEME_LIGHT = 'plotflow-light';
export const THEME_DEFAULT = THEME_LIGHT; // 默认亮色主题（per Design Brief §6.1）

// ============================================================================
// Monaco Environment 配置（Worker 加载）
// ============================================================================

/**
 * 配置 Monaco Editor 的 Web Worker 环境。
 *
 * 在 Electron + Vite 渲染进程中，Monaco 需要知道如何加载
 * editor / json / css / html 等语言的 Worker。
 *
 * 此函数使用 Vite 的 `?worker` 后缀动态导入 Worker，
 * 若 Worker 文件不存在则优雅降级（Monaco 在无 Worker 时仍可运行）。 */
async function configureMonacoEnvironment(): Promise<void> {
  // 仅配置一次
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  if ((self as unknown as Record<string, unknown>)['MonacoEnvironment']) {
    return;
  }

  // M1: Worker 延迟加载 — monaco-editor 0.45 的 worker 文件在 Vite/Electron
  // 环境下路径解析不稳定。Monaco 在无 Worker 时仍可运行，仅语法验证不可用。
  // M6 升级 Monaco 0.50+ 后恢复 Worker 配置。
  // 参考: memory/bug_log.md BUG-001
}

// ============================================================================
// 主题注册
// ============================================================================

/**
 * 注册 PlotFlow 暗色/亮色主题。
 *
 * 色值分别来自 monaco-theme-dark.json 和 monaco-theme-light.json，
 * 与 doc/standards-css.md §2.2 的 --color-syntax-* Token 表一致。
 */
function registerThemes(): void {
  monaco.editor.defineTheme(THEME_DARK, darkThemeData as monaco.editor.IStandaloneThemeData);
  monaco.editor.defineTheme(THEME_LIGHT, lightThemeData as monaco.editor.IStandaloneThemeData);
}

// ============================================================================
// 全量环境安装（幂等）
// ============================================================================

/** 跟踪是否已完成初始化 */
let setupComplete = false;
let setupPromise: Promise<void> | null = null;

/**
 * 执行 PlotFlow Monaco 环境的全量安装。
 *
 * 幂等 — 重复调用不会重复注册语言/主题。
 * 应在创建编辑器实例之前调用一次。
 *
 * 执行顺序：
 * 1. 配置 Monaco Worker 环境
 * 2. 注册 PlotFlow 语言 + Monarch Tokenizer
 * 3. 注册折叠范围提供者
 * 4. 注册暗色/亮色主题
 */
export async function setupPlotFlowEditor(): Promise<void> {
  if (setupComplete) {
    return;
  }

  if (setupPromise !== null) {
    await setupPromise;
    return;
  }

  setupPromise = (async () => {
    await configureMonacoEnvironment();

    // 语言 ID + Monarch Tokenizer（monaco-tokenizer.ts）
    registerPlotFlowTokenizer();

    // 折叠范围提供者（foldingProvider.ts）
    registerFoldingProvider();

    // M5: 幽灵补全提供者（GhostTextPlugin.ts）
    // 初始化 NGramEngine，通过 CorpusLoader 单例加载英文预置语料，
    // 注册 InlineCompletionProvider + CompletionItemProvider。
    // 语料加载失败不影响编辑器启动 — 补全仅无预置语料，学习器仍可从用户输入学习。
    try {
      const engine = new NGramEngine();
      const index = new InvertedIndex();
      const loader = CorpusLoader.getInstance();

      // 两种内置语言都离线打包，确保中英文输入均有基础建议。
      await Promise.all([
        loader.loadToEngine(engine, 'zh'),
        loader.loadToEngine(engine, 'en'),
      ]);

      registerGhostTextProvider(engine, index);
    } catch (err) {
      // 语料加载或补全注册失败是非致命的 — 编辑器仍可正常使用
      // eslint-disable-next-line no-console
      console.warn('[PlotFlow] GhostTextPlugin 初始化失败，补全不可用:', err);
    }

    // 主题
    registerThemes();

    setupComplete = true;
  })();

  try {
    await setupPromise;
  } finally {
    setupPromise = null;
  }
}

// ============================================================================
// 编辑器工厂函数
// ============================================================================

/**
 * 创建一个配置完成的 PlotFlow Monaco 编辑器实例。
 *
 * 在调用此函数前，setupPlotFlowEditor() 必须已完成（或由本函数自动等待）。
 *
 * @param container - 承载编辑器 DOM 元素
 * @param initialValue - 编辑器初始文本内容（可选）
 * @returns Monaco 独立代码编辑器实例
 *
 * @example
 *   const editor = await initMonacoEditor(containerRef.current, storyText);
 *   editor.onDidChangeModelContent((e) => { ... });
 */
export async function initMonacoEditor(
  container: HTMLElement,
  initialValue?: string,
  theme?: string,
): Promise<monaco.editor.IStandaloneCodeEditor> {
  // 确保环境已就绪
  await setupPlotFlowEditor();

  const editor = monaco.editor.create(container, {
    value: initialValue ?? '',
    language: PLOTFLOW_LANGUAGE_ID,
    theme: theme ?? THEME_DEFAULT,

    // ── 编辑器行为 ──
    automaticLayout: true,        // 容器尺寸变化时自动重排
    wordWrap: 'on',               // 长文本换行（叙事文本较长）
    minimap: { enabled: false },  // 关闭默认 minimap（分支图替代）
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    autoClosingBrackets: 'beforeWhitespace',
    autoClosingQuotes: 'beforeWhitespace',

    // ── 字体 ──
    fontFamily:
      "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
    fontSize: 14,
    lineHeight: 22,

    // ── 光标 / 缩进 ──
    cursorBlinking: 'smooth',
    cursorSmoothCaretAnimation: 'on',
    smoothScrolling: true,
    // 不允许编辑器末尾虚拟空间，确保 Backspace 可删除尾随空行
    scrollBeyondLastLine: false,
    tabSize: 2,
    insertSpaces: true,

    // ── 补全 ──
    suggest: {
      showWords: true,
      showSnippets: false,
    },
    // V02-032: 使用细粒度关闭而非全局 false，确保 IME composition 期间
    // Monaco 仍能正确处理方向键导航（IME 候选窗交互依赖 suggest 机制）。
    quickSuggestions: {
      other: false,
      comments: false,
      strings: false,
    },

    // ── 空白渲染 ──
    renderLineHighlight: 'line',

    // ── 侧边栏标记 — M3-14 ──
    glyphMargin: true,
  });

  return editor;
}
