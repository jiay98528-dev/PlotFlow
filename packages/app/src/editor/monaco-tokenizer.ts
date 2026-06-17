/**
 * PlotFlow Monarch Tokenizer — 语法高亮 (M1-08)
 *
 * @remarks
 * 使用 Monaco Monarch tokenizer（非 TextMate），实现 7 色语法标记。
 * 色值引用主题 JSON 文件（monaco-theme-dark.json / monaco-theme-light.json），不在此硬编码。
 *
 * 状态机：
 *   root ── ^---$ ──→ frontmatter ── ^---$ ──→ @pop → root
 *   root ── <!-- ────→ commentBlock ── --> ───→ @pop → root
 *
 * 对应规范：
 * - spec/syntax-formal.md §7 (Token 定义)
 * - doc/standards-css.md §2.2 (--color-syntax-* Token 表)
 */

import { languages } from 'monaco-editor';

// ============================================================================
// 常量
// ============================================================================

/** PlotFlow 语言 ID */
export const PLOTFLOW_LANGUAGE_ID = 'plotflow';

/** PlotFlow 语言的 7 种语法 Token 类型（与主题 JSON 中的 token 名对应） */
export const PLOTFLOW_TOKENS = {
  heading: 'heading',       // # 章节：/ ## 节点：— 蓝
  option: 'option',        // [选项] — 绿
  condition: 'condition',  // 条件: — 橙
  effect: 'effect',        // 效果: — 黄褐
  variable: 'variable',    // $变量 — 紫
  target: 'target',        // -> 节点：— 青
  comment: 'comment',      // <!-- --> / Frontmatter — 灰
} as const;

// ============================================================================
// Partitioned Monarch 定义：将规则集声明为立即调用函数，
// 以便在组件函数中使用多行注释来解释规则。
// ============================================================================

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const PLOTFLOW_MONARCH = {
  // 默认 Token — 未匹配到的文本使用此 Token
  defaultToken: 'source',

  // 大小写敏感 — PlotFlow 关键字区分大小写
  ignoreCase: false,

  // 括号匹配（对中文 "[选项]" 不生效，用于普通括号高亮）
  brackets: [
    { open: '[', close: ']', token: 'delimiter.square' },
    { open: '(', close: ')', token: 'delimiter.parenthesis' },
  ],

  tokenizer: {
    // ========================================================================
    // root — 主状态
    // ========================================================================
    root: [
      // ── Frontmatter 块：以行首 "---" 开始，进入 frontmatter 状态 ──
      [
        /^---$/,
        { token: 'comment', next: '@frontmatter' },
      ],

      // ── Chapter 标题：# 标题文本（蓝色 + 粗体） ──
      [
        /^#\s+.+$/,
        { token: 'heading', fontStyle: 'bold' },
      ],

      // ── Node 标题：## 节点：XXX（蓝色，非粗体） ──
      [
        /^##\s*节点[：:].*$/,
        'heading',
      ],

      // ── Option 行：[选项] 描述文本 → 绿色 ──
      [
        /^\[选项\].*$/,
        'option',
      ],

      // ── Condition 子行：条件: (expr) → 橙色 ──
      // 允许行首空白（缩进），支持半角/全角冒号
      [
        /^\s*条件[:：].*$/,
        'condition',
      ],

      // ── Effect 子行：效果: (expr) → 黄褐 ──
      // 允许行首空白（缩进），支持半角/全角冒号
      [
        /^\s*效果[:：].*$/,
        'effect',
      ],

      // ── Variable 引用：$变量名.$嵌套字段 → 紫色 ──
      // 支持：$金币, $角色状态.生命, $好感度
      [
        /\$[一-鿿\w]+(\.[一-鿿\w]+)*/,
        'variable',
      ],

      // ── Jump target：-> 节点：XXX → 青色 ──
      // 匹配行中的跳转目标（支持半角/全角冒号，允许空白）
      [
        /->\s*节点[：:].*$/,
        'target',
      ],

      // ── HTML/XML 注释：<!-- ... --> → 灰色 ──
      [
        /<!--/,
        { token: 'comment', next: '@commentBlock' },
      ],
    ],

    // ========================================================================
    // frontmatter — Frontmatter 块内部（YAML 区域）
    // ========================================================================
    frontmatter: [
      // 遇到 "---" 行：结束 Frontmatter，回到 root
      [
        /^---$/,
        { token: 'comment', next: '@pop' },
      ],
      // 内部所有行使用 comment 颜色
      [/[^]/, 'comment'],
    ],

    // ========================================================================
    // commentBlock — HTML 注释块内部
    // ========================================================================
    commentBlock: [
      // 遇到 "-->": 结束注释，回到 root
      [
        /-->/,
        { token: 'comment', next: '@pop' },
      ],
      // 注释内容
      [/[^]/, 'comment'],
    ],
  },
};

// ============================================================================
// 注册函数
// ============================================================================

/**
 * 注册 PlotFlow 语言 ID 和 Monarch Tokenizer。
 *
 * 调用时机：Monaco Editor 已通过 loader 加载后，创建编辑器实例之前。
 * 此函数是幂等的 — Monaco 内部处理重复注册。
 *
 * 除 tokenizer 外，还同时配置：
 * - 括号自动闭合 (autoClosingPairs)
 * - 括号包裹 (surroundingPairs)
 * - 注释定义 (blockComment)
 * - 括号匹配 (brackets)
 */
export function registerPlotFlowTokenizer(): void {
  // 1. 注册语言 ID（幂等）
  languages.register({ id: PLOTFLOW_LANGUAGE_ID });

  // 2. 注册 Monarch Tokenizer
  languages.setMonarchTokensProvider(PLOTFLOW_LANGUAGE_ID, PLOTFLOW_MONARCH as languages.IMonarchLanguage);

  // 3. 语言配置 — 括号、注释、自动闭合
  languages.setLanguageConfiguration(PLOTFLOW_LANGUAGE_ID, {
    // 输入开括号时自动插入对应的闭括号
    autoClosingPairs: [
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '"', close: '"' },
    ],
    // 选中文本后按开括号，将选中文本用括号包裹
    surroundingPairs: [
      { open: '[', close: ']' },
    ],
    // 注释块定义
    comments: {
      blockComment: ['<!--', '-->'],
    },
    // 括号匹配（跳转、高亮对应括号）
    brackets: [
      ['[', ']'],
      ['(', ')'],
    ],
  });
}
