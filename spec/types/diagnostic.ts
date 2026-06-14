/**
 * PlotFlow 诊断类型合同
 *
 * @packageDocumentation
 * @remarks
 * 定义验证器产出的所有诊断信息结构。
 * 对应 PRD §9.1（17 种诊断类型）和 milestones.md M3。
 *
 * @version 0.1.0
 */

// ============================================================================
// 诊断级别
// ============================================================================

/** 诊断严重级别 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

// ============================================================================
// 诊断代码
// ============================================================================

/** 错误代码（8 种） */
export type ErrorCode =
  | 'E001'  // 未定义目标节点
  | 'E002'  // 未声明变量
  | 'E003'  // 枚举值非法
  | 'E004'  // 类型不匹配
  | 'E005'  // 语法解析失败
  | 'E006'  // 嵌套深度超限
  | 'E007'  // 节点 ID 重名
  | 'E008'; // 变量重复声明

/** 警告代码（6 种） */
export type WarningCode =
  | 'W001'  // 孤立节点
  | 'W002'  // 死胡同节点
  | 'W003'  // 未使用变量
  | 'W004'  // 重复选项描述
  | 'W005'  // 空描述节点
  | 'W006'; // 格式不规范

/** 建议代码（3 种） */
export type InfoCode =
  | 'I001'  // 可能卡关（全部选项有条件）
  | 'I002'  // 描述过短（<10 字符）
  | 'I003'; // 无章节归属

/** 所有诊断代码联合类型 */
export type DiagnosticCode = ErrorCode | WarningCode | InfoCode;

// ============================================================================
// 诊断信息
// ============================================================================

/**
 * 单条诊断信息。
 * Monaco Editor 通过 setModelMarkers() 注入。
 */
export interface Diagnostic {
  /** 唯一标识符 */
  readonly id: string;

  /** 诊断代码 */
  readonly code: DiagnosticCode;

  /** 严重级别 */
  readonly severity: DiagnosticSeverity;

  /** 简短描述（≤1 行） */
  readonly message: string;

  /** 详细信息（含修复建议） */
  readonly detail?: string;

  /** 可操作建议列表 */
  readonly suggestions?: DiagnosticSuggestion[];

  /** 在源文件中的位置 */
  readonly range: SourceRange;

  /** 关联的节点/选项 ID（可选） */
  readonly relatedNodeId?: string;
}

/**
 * 源文件位置范围。
 * 1-based 行号/列号，与 Monaco Position 对应。
 */
export interface SourceRange {
  /** 起始行号（1-based） */
  readonly startLine: number;

  /** 起始列号（1-based） */
  readonly startColumn: number;

  /** 结束行号（1-based） */
  readonly endLine: number;

  /** 结束列号（1-based） */
  readonly endColumn: number;
}

/**
 * 可操作的修复建议。
 * 对应 M3-15 Hover Tooltip 中的可点击操作。
 */
export interface DiagnosticSuggestion {
  /** 建议文本 */
  readonly label: string;

  /** 可选：点击后的操作类型 */
  readonly action?: 'createNode' | 'jumpToLine' | 'quickFix' | 'openPanel';

  /** 可选：操作参数 */
  readonly actionParams?: Record<string, string>;
}

// ============================================================================
// 验证结果
// ============================================================================

/**
 * 验证器返回结果。
 */
export interface ValidationResult {
  /** 诊断列表 */
  readonly diagnostics: Diagnostic[];

  /** 各严重级别计数 */
  readonly summary: DiagnosticSummary;
}

/**
 * 诊断汇总。
 */
export interface DiagnosticSummary {
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly total: number;
}

// ============================================================================
// 常量
// ============================================================================

/** 诊断代码 → 默认消息映射 */
export const DIAGNOSTIC_MESSAGES: Readonly<Record<DiagnosticCode, string>> = {
  E001: '目标节点未定义',
  E002: '变量未在 Frontmatter 中声明',
  E003: '值不在枚举合法值列表中',
  E004: '值的类型与变量声明类型不匹配',
  E005: '语法解析失败',
  E006: 'Object 嵌套深度超过最大限制（3 层）',
  E007: '节点 ID 重复',
  E008: '变量重复声明',
  W001: '节点无入口选项指向（孤立节点）',
  W002: '节点无出口选项（死胡同）',
  W003: '变量在故事中未使用',
  W004: '选项描述文本与同级选项重复',
  W005: '节点正文描述为空',
  W006: '格式不规范',
  I001: '全部选项都有执行条件（可能导致此处卡关）',
  I002: '节点描述过短（少于 10 个字符）',
  I003: '节点未归属于任何章节',
};

/** 诊断代码 → 严重级别映射 */
export const DIAGNOSTIC_SEVERITY: Readonly<Record<DiagnosticCode, DiagnosticSeverity>> = {
  E001: 'error', E002: 'error', E003: 'error', E004: 'error',
  E005: 'error', E006: 'error', E007: 'error', E008: 'error',
  W001: 'warning', W002: 'warning', W003: 'warning',
  W004: 'warning', W005: 'warning', W006: 'warning',
  I001: 'info', I002: 'info', I003: 'info',
};
