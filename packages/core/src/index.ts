/**
 * @plotflow/core — PlotFlow 核心解析、验证、导出引擎
 *
 * @packageDocumentation
 * @remarks
 * 本包是 PlotFlow 的核心引擎，提供：
 * - PlotFlowData 中间表示（AST 类型合同）
 * - ParseResult 错误处理模式
 * - 解析器（.mdstory → PlotFlowData）
 * - 验证器（PlotFlowData → 诊断信息）
 * - 导出器（PlotFlowData → JSON/HTML/TXT）
 *
 * 所有操作使用 ParseResult 模式，不抛异常。
 *
 * @version 0.1.0
 */

// ============================================================================
// 类型导出（统一入口）
// ============================================================================

export type {
  // AST 类型
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
  // 诊断类型
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
} from './types/index.js';

// ============================================================================
// 诊断常量导出
// ============================================================================

export {
  DIAGNOSTIC_MESSAGES,
  DIAGNOSTIC_SEVERITY,
} from './types/index.js';

// ============================================================================
// ParseResult 错误处理模式
// ============================================================================

export type {
  ParseResult,
} from './result.js';

export {
  success,
  failure,
} from './result.js';

// ============================================================================
// 解析器（M1）
// ============================================================================

export {
  parseFrontmatter,
} from './parser/frontmatter.js';

export type {
  FrontmatterResult,
} from './parser/frontmatter.js';

export {
  parseStory,
  parseChaptersAndNodes,
} from './parser/parser.js';

export {
  parseOptions,
} from './parser/options.js';

export {
  parseCondition,
} from './parser/conditions.js';

export {
  parseEffects,
} from './parser/effects.js';

// ============================================================================
// 验证器（M3）
// ============================================================================

import type { PlotFlowData } from './types/ast.js';
import type { ParseResult } from './result.js';
import type { ValidationResult } from './types/diagnostic.js';
import { success, failure } from './result.js';
import { validate as runAllRules } from './validator/index.js';

/**
 * 验证 PlotFlowData 中间表示，返回诊断信息。
 *
 * 运行全部 17 条检测规则（E001-E008 + W001-W006 + I001-I003）。
 * 返回 ParseResult 模式：ok 携带通过验证的 AST，fail 携带错误诊断。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns ParseResult — ok 携带验证通过的 AST 及诊断，fail 携带错误诊断
 * @throws 不抛异常，所有错误通过返回值的 ok: false 表示
 */
export function validate(data: PlotFlowData): ParseResult<PlotFlowData> {
  const { diagnostics } = runAllRules(data);

  // 检查是否包含错误级别的诊断
  const errors = diagnostics.filter((d) => d.severity === 'error');

  if (errors.length > 0) {
    return failure(errors);
  }

  return success(data, diagnostics);
}

/**
 * 运行完整的 17 条验证规则，返回 ValidationResult（不包装 ParseResult）。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns ValidationResult 结构
 */
export function validateAll(data: PlotFlowData): ValidationResult {
  return runAllRules(data);
}

// ============================================================================
// 验证器个体规则导出（可按需调用）
// ============================================================================

/**
 * 验证器个体检测规则导出。
 * 便于单元测试和按需调用。
 */
export {
  checkOrphanNodes,
  checkDeadEndNodes,
  checkUnusedVariables,
  checkDuplicateOptionDescriptions,
  checkEmptyBodyNodes,
  checkFormatIrregularities,
  checkPotentialSoftlock,
  checkShortBody,
  checkMissingChapter,
  checkUndefinedTargetNode,
  checkUndeclaredVariable,
  checkInvalidEnumValue,
  checkTypeMismatch,
  checkE005,
  checkE006,
  checkE007,
  checkE008,
  computeSummary,
} from './validator/index.js';

export {
  exportJSON,
  exportHTML,
  exportTXT,
} from './exporter/index.js';

// ============================================================================
// 补全引擎（M5）
// ============================================================================

export { NGramEngine } from './completion/NGramEngine.js';
export { InvertedIndex } from './completion/InvertedIndex.js';
export { CorpusLoader } from './completion/CorpusLoader.js';
export { CorpusImporter } from './completion/CorpusImporter.js';
export { PreprocessingPipeline } from './completion/PreprocessingPipeline.js';

export type {
  CorpusSource,
  CorpusEntry,
  CorpusData,
  Candidate,
  CompletionResult,
  CompletionContext,
  CompletionDimension,
  NGramModel,
  NGramStore,
} from './completion/types.js';

export type {
  CorpusLoadStats,
} from './completion/CorpusLoader.js';

export type {
  ImportFileInfo,
  ImportResult,
  ImporterStats,
} from './completion/CorpusImporter.js';

export type {
  ClassificationResult,
} from './completion/PreprocessingPipeline.js';

// ============================================================================
// 模板与本地化（M6）
// ============================================================================

export {
  applyTemplate,
} from './template/TemplateEngine.js';

export {
  changeLanguage,
  getLanguage,
  getTranslations,
  subscribeLanguage,
  t,
} from './i18n/i18n.js';

export type {
  Locale,
  TranslationKey,
} from './i18n/i18n.js';
