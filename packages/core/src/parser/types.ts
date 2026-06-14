/**
 * 解析器内部类型定义
 *
 * @packageDocumentation
 * @remarks
 * 此文件定义解析器实现所需的内部类型。ParserState 为解析器内部专用，
 * Token 类型枚举可供 Monaco tokenizer 复用（通过深度导入）。
 *
 * 这些类型不通过 @plotflow/core 主入口导出。
 *
 * @version 0.1.0
 */

import type { StoryMeta, VariableDeclaration, Chapter, StoryNode } from '../types/ast.js';
import type { Diagnostic } from '../types/diagnostic.js';

// ============================================================================
// ParserState — 解析上下文
// ============================================================================

/**
 * 解析器状态机上下文。
 *
 * 解析器逐行扫描 .mdstory 源文件，维护此状态对象以跟踪：
 * - 当前解析位置（行号）
 * - 章节/节点嵌套栈（用于歧义消解和 ID 计算）
 * - 已累积的诊断信息
 * - Frontmatter 解析标志
 *
 * 此类型为内部实现细节，不对外导出。
 */
export interface ParserState {
  /** 源文件绝对路径（如有） */
  readonly sourcePath: string | null;

  /** 源文件所有行（已按行分割、行尾空白已 trim） */
  readonly lines: readonly string[];

  /** 当前正在处理的行索引（0-based） */
  currentLine: number;

  /** 已解析的元信息（Frontmatter 解析完成后填充） */
  meta: StoryMeta | null;

  /** 已解析的变量声明列表（Frontmatter 解析完成后填充） */
  variables: VariableDeclaration[];

  /** 已解析的章节列表 */
  chapters: Chapter[];

  /** 当前正在解析的章节（null 表示不在任何章节内） */
  currentChapter: Chapter | null;

  /** 当前正在解析的节点（null 表示不在任何节点内） */
  currentNode: StoryNode | null;

  /** 章节标题栈 — 用于处理跨章节引用歧义 */
  chapterStack: ChapterStackEntry[];

  /** 节点栈 — 用于跟踪节点嵌套和 FullID 计算 */
  nodeStack: NodeStackEntry[];

  /** 是否正在解析 Frontmatter 块 */
  inFrontmatter: boolean;

  /** Frontmatter 是否已成功解析完成 */
  frontmatterParsed: boolean;

  /** 累积的诊断信息 */
  diagnostics: Diagnostic[];
}

/**
 * 章节栈条目 — 跟踪章节上下文。
 */
export interface ChapterStackEntry {
  /** 章节 ID */
  readonly id: string;

  /** 章节标题 */
  readonly title: string;

  /** 章节在源文件中的起始行号（1-based） */
  readonly lineNumber: number;

  /** 是否为匿名章节（无显式 `# 章节：` 声明） */
  readonly isAnonymous: boolean;
}

/**
 * 节点栈条目 — 跟踪节点上下文。
 */
export interface NodeStackEntry {
  /** 节点 ID（不含章节前缀） */
  readonly id: string;

  /** 节点完整 ID（章节ID/节点ID） */
  readonly fullId: string;

  /** 节点标题 */
  readonly title: string;

  /** 所属章节 ID */
  readonly chapterId: string;

  /** 节点在源文件中的起始行号（1-based） */
  readonly lineNumber: number;
}

// ============================================================================
// Token 类型 — 供 Monaco tokenizer 复用
// ============================================================================

/**
 * Token 种类常量映射。
 *
 * 每种 Token 对应一种语法元素，Monaco Monarch tokenizer
 * 可将这些值映射为 CSS 类名以实现语法高亮。
 *
 * 命名规范：`分类.子类` 格式，与 Monarch tokenizer 的 token 命名兼容。
 */
export const TOKEN_KIND = {
  /** H1 章节标题 (`# 标题`) */
  HEADING_H1: 'heading.h1',

  /** H2 节点标题 (`## 节点：名称`) */
  HEADING_H2: 'heading.h2',

  /** `节点` 关键字 */
  KEYWORD_NODE: 'keyword.node',

  /** `[选项]` 关键字 */
  KEYWORD_OPTION: 'keyword.option',

  /** `条件` 关键字 */
  KEYWORD_CONDITION: 'keyword.condition',

  /** `效果` 关键字 */
  KEYWORD_EFFECT: 'keyword.effect',

  /** `AND` 逻辑关键字 */
  KEYWORD_AND: 'keyword.logic',

  /** `OR` 逻辑关键字 */
  KEYWORD_OR: 'keyword.logic',

  /** `NOT` 逻辑关键字 */
  KEYWORD_NOT: 'keyword.logic',

  /** `true` / `false` 布尔字面量 */
  KEYWORD_BOOL: 'keyword.bool',

  /** `->` 箭头操作符 */
  ARROW: 'operator.arrow',

  /** `---` 分隔符 / Frontmatter 边界 */
  SEPARATOR: 'delimiter.separator',

  /** `$` 变量引用前缀（$变量名） */
  VARIABLE_PREFIX: 'variable.prefix',

  /** 变量名 */
  VARIABLE: 'variable',

  /** `.` 字段访问操作符 */
  FIELD_ACCESS: 'operator.accessor',

  /** 比较运算符 (`==` `!=` `>=` `<=` `>` `<`) */
  OPERATOR_COMPARISON: 'operator.comparison',

  /** 赋值操作符 (`=`) */
  OPERATOR_ASSIGN: 'operator.assign',

  /** 算术操作符 (`+` `-`) */
  OPERATOR_ARITHMETIC: 'operator.arithmetic',

  /** 追加操作符 (`←`) */
  OPERATOR_APPEND: 'operator.append',

  /** 字符串字面量 (`'...'` 或 `"..."`) */
  STRING_LITERAL: 'string',

  /** 数字字面量（int / float） */
  NUMBER_LITERAL: 'number',

  /** 类型关键字 (`int` `float` `bool` `string` `enum` `object`) */
  KEYWORD_TYPE: 'keyword.type',

  /** 冒号 (`:` / `：`) */
  COLON: 'punctuation.colon',

  /** 通用标点 (`(`, `)`, `[`, `]`, `{`, `}`, `,`, `，`) */
  PUNCTUATION: 'punctuation',

  /** 节点正文 */
  BODY_TEXT: 'text',

  /** HTML 注释 (`<!-- ... -->`) */
  COMMENT: 'comment',

  /** 空白字符（空格 / Tab） */
  WHITESPACE: '',

  /** 换行符 */
  NEWLINE: '',

  /** 无法识别的 Token */
  UNKNOWN: 'invalid',

  /** Frontmatter YAML 键 */
  YAML_KEY: 'key',

  /** YAML 标量值 */
  YAML_VALUE: 'string.yaml',

  /** 通用标识符 */
  IDENTIFIER: 'identifier',
} as const;

/**
 * Token 种类联合类型。
 */
export type TokenKind = (typeof TOKEN_KIND)[keyof typeof TOKEN_KIND];

// ============================================================================
// Token 结构
// ============================================================================

/**
 * 词法分析产出的单个 Token。
 *
 * Monaco Monarch tokenizer 的 `tokenize` 方法产出类似结构。
 */
export interface Token {
  /** Token 种类 */
  readonly kind: TokenKind;

  /** Token 原始文本 */
  readonly value: string;

  /** 在源文件中的行号（1-based） */
  readonly line: number;

  /** 在源文件中的列号（1-based） */
  readonly column: number;

  /** Token 文本长度（Unicode 码点数） */
  readonly length: number;
}
