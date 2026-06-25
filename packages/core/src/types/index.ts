/**
 * PlotFlow 类型系统 — 统一导出入口
 *
 * @packageDocumentation
 * @remarks
 * 此文件统一导出 AST 类型合同和诊断类型合同的所有类型与常量。
 * 所有 @plotflow/core 的消费者应从此入口导入类型。
 *
 * @version 0.1.0
 */

// ============================================================================
// AST 类型（中间表示）
// ============================================================================

export type {
  PlotFlowData,
  StoryMeta,
  EngineTarget,
  GraphPosition,
  GraphLayoutNode,
  GraphLayout,
  StoryLayout,
  VariableDeclaration,
  VariableType,
  VariableValue,
  Chapter,
  StoryNode,
  NodeDiagnostics,
  Option,
  ConditionNode,
  ComparisonExpression,
  LogicalExpression,
  Operand,
  ComparisonOperator,
  LogicalOperator,
  SideEffect,
  SideEffectOperation,
} from './ast.js';

// ============================================================================
// 诊断类型
// ============================================================================

export type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
  DiagnosticSuggestion,
  DiagnosticSummary,
  SourceRange,
  ValidationResult,
  ErrorCode,
  WarningCode,
  InfoCode,
} from './diagnostic.js';

// ============================================================================
// 诊断常量
// ============================================================================

export {
  DIAGNOSTIC_MESSAGES,
  DIAGNOSTIC_SEVERITY,
} from './diagnostic.js';
