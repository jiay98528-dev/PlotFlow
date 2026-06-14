/**
 * PlotFlow AST 类型合同 — 中间表示 (Intermediate Representation)
 *
 * @packageDocumentation
 * @remarks
 * 本文件是解析器、编辑器、导出器、分支图之间的唯一类型合同。
 * 所有模块必须遵守此合同，不得使用私有类型绕过。
 *
 * 对应规范：
 * - spec/syntax-formal.md（语法 → AST 映射规则）
 * - spec/json-schema.md（AST → JSON 导出映射规则）
 * - doc/TAD.md §6 类型系统
 *
 * @version 0.1.0
 * @see {@link ../spec/syntax-formal.md}
 * @see {@link ../spec/json-schema.md}
 */

// ============================================================================
// 顶层结构
// ============================================================================

/**
 * .mdstory 文件解析后的完整中间表示。
 * 对应 syntax-formal.md §1.1 产生式 `Story`。
 */
export interface PlotFlowData {
  /** 来源文件绝对路径（如有） */
  readonly sourcePath: string | null;

  /** 元信息 */
  readonly meta: StoryMeta;

  /** 变量声明列表（来自 YAML Frontmatter） */
  readonly variables: VariableDeclaration[];

  /** 章节列表 */
  readonly chapters: Chapter[];
}

/**
 * 故事元信息。
 * 对应 json-schema.md §3 Meta 对象。
 */
export interface StoryMeta {
  /** PlotFlow 格式版本 */
  readonly plotflow: '0.1';

  /** 故事标题 */
  readonly title: string;

  /** 作者 */
  readonly author: string;

  /** 目标引擎（可选） */
  readonly engine?: EngineTarget;

  /** 导出时间戳（导出时填充） */
  readonly exportedAt?: string;
}

/** 目标游戏引擎 */
export type EngineTarget = 'godot' | 'unity' | 'unreal' | 'generic';

// ============================================================================
// 变量声明
// ============================================================================

/**
 * YAML Frontmatter 中的变量声明。
 * 对应 syntax-formal.md §2。
 */
export interface VariableDeclaration {
  /** 变量名（不含 $ 前缀） */
  readonly name: string;

  /** 变量类型 */
  readonly type: VariableType;

  /** 默认值 */
  readonly defaultValue: VariableValue;

  /** 描述（可选） */
  readonly description?: string;

  /** enum 类型的合法值列表 */
  readonly enumValues?: string[];

  /** object 类型的子字段（最多 3 层嵌套） */
  readonly fields?: VariableDeclaration[];

  /** 在 Frontmatter 中的行号（1-based） */
  readonly lineNumber: number;
}

/** 变量类型枚举 */
export type VariableType = 'int' | 'float' | 'bool' | 'string' | 'enum' | 'object';

/** 变量值联合类型 */
export type VariableValue = number | boolean | string | Record<string, unknown>;

// ============================================================================
// 章节
// ============================================================================

/**
 * 章节。
 * 对应 syntax-formal.md §3 `Chapter`。
 */
export interface Chapter {
  /** 章节 ID（来自 `# 章节：XXX`） */
  readonly id: string;

  /** 章节标题 */
  readonly title: string;

  /** 是否匿名章节（无显式 `# 章节：` 声明） */
  readonly isAnonymous: boolean;

  /** 章节内的节点列表 */
  readonly nodes: StoryNode[];

  /** 在源文件中的行号（1-based） */
  readonly lineNumber: number;
}

// ============================================================================
// 节点
// ============================================================================

/**
 * 故事节点。
 * 对应 syntax-formal.md §3 `Node`。
 */
export interface StoryNode {
  /** 节点 ID（来自 `## 节点：XXX`，不含章节前缀） */
  readonly id: string;

  /** 完整 ID（章节 ID + 节点 ID，如 `第一章-森林入口`） */
  readonly fullId: string;

  /** 节点标题 */
  readonly title: string;

  /** 节点正文描述（Markdown 原始文本） */
  readonly body: string;

  /** 所属章节 ID */
  readonly chapterId: string;

  /** 选项列表 */
  readonly options: Option[];

  /** 诊断元数据（验证器填充） */
  readonly diagnostics: NodeDiagnostics;

  /** 在源文件中的行号（1-based） */
  readonly lineNumber: number;
}

/**
 * 节点诊断元数据。
 * 验证器在解析后填充。
 */
export interface NodeDiagnostics {
  /** 是否为根节点（无入口选项指向它） */
  readonly isRoot: boolean;

  /** 是否为孤立节点（无入口，非根节点） */
  readonly isOrphan: boolean;

  /** 是否为死胡同节点（无出口选项） */
  readonly isDeadEnd: boolean;

  /** 关联的验证诊断 ID 列表 */
  readonly diagnosticIds: string[];
}

// ============================================================================
// 选项
// ============================================================================

/**
 * 选项（跳转指令）。
 * 对应 syntax-formal.md §4 `Option`。
 */
export interface Option {
  /** 选项描述文本 */
  readonly description: string;

  /** 缩进级别（0 = 无缩进，1 = 一个 Tab） */
  readonly indentLevel: number;

  /** 跳转目标节点 ID */
  readonly targetNodeId: string | null;

  /** 跳转目标完整 ID（解析后填充） */
  readonly targetFullId: string | null;

  /** 执行条件（可选） */
  readonly condition: ConditionNode | null;

  /** 副作用列表（效果） */
  readonly sideEffects: SideEffect[];

  /** 条件原始文本（用于双向同步） */
  readonly conditionRaw: string | null;

  /** 效果原始文本（用于双向同步） */
  readonly effectsRaw: string | null;

  /** 在源文件中的行号（1-based） */
  readonly lineNumber: number;
}

// ============================================================================
// 条件表达式
// ============================================================================

/**
 * 条件表达式 AST 节点。
 * 对应 syntax-formal.md §5。
 */
export type ConditionNode =
  | ComparisonExpression
  | LogicalExpression;

/** 比较表达式 */
export interface ComparisonExpression {
  readonly type: 'comparison';

  /** 左操作数（变量引用或字面量） */
  readonly left: Operand;

  /** 比较运算符 */
  readonly operator: ComparisonOperator;

  /** 右操作数 */
  readonly right: Operand;
}

/** 逻辑表达式 */
export interface LogicalExpression {
  readonly type: 'logical';

  /** 逻辑运算符 */
  readonly operator: LogicalOperator;

  /** 子表达式列表（≥2） */
  readonly operands: ConditionNode[];
}

/** 操作数 */
export interface Operand {
  /** 操作数类型 */
  readonly operandType: 'variable' | 'literal';

  /** 变量名（operandType === 'variable' 时有效） */
  readonly variableName?: string;

  /** 字面值（operandType === 'literal' 时有效） */
  readonly literalValue?: VariableValue;
}

/** 比较运算符 */
export type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

/** 逻辑运算符 */
export type LogicalOperator = 'AND' | 'OR' | 'NOT';

// ============================================================================
// 副作用（效果）
// ============================================================================

/**
 * 副作用（变量操作）。
 * 对应 syntax-formal.md §6。
 */
export interface SideEffect {
  /** 目标变量名 */
  readonly variableName: string;

  /** 操作类型 */
  readonly operation: SideEffectOperation;

  /** 操作值 */
  readonly value: VariableValue;

  /** 在源文件中的行号（1-based） */
  readonly lineNumber: number;
}

/** 副作用操作类型 */
export type SideEffectOperation = 'set' | 'add' | 'subtract' | 'append';
