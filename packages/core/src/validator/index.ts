/**
 * @plotflow/core 验证器 — 统一入口
 *
 * @packageDocumentation
 * @remarks
 * 提供针对 PlotFlowData 中间表示的完整验证流程，包括：
 * - 8 种错误检测（E001-E008）
 * - 6 种警告检测（W001-W006）
 * - 3 种建议检测（I001-I003）
 *
 * 每个检测规则为独立函数，可单独调用也可通过 `validate` 一站式运行。
 *
 * 与 Monaco Editor 的集成方式：
 * - 验证器产出的 Diagnostic 通过 `monaco.editor.setModelMarkers()` 注入
 * - 波浪线样式通过 `renderOverviewRuler` 控制颜色
 *
 * @version 0.1.0
 */

import type { PlotFlowData } from '../types/ast.js';
import type { Diagnostic, ValidationResult, DiagnosticSummary } from '../types/diagnostic.js';

// 规则导入
import { checkOrphanNodes } from './warnings.js';
import { checkDeadEndNodes } from './warnings.js';
import { checkUnusedVariables } from './warnings.js';
import { checkDuplicateOptionDescriptions } from './warnings.js';
import { checkEmptyBodyNodes } from './warnings.js';
import { checkFormatIrregularities } from './warnings.js';

import { checkPotentialSoftlock } from './infos.js';
import { checkShortBody } from './infos.js';
import { checkMissingChapter } from './infos.js';

import {
  checkUndefinedTargetNode,
  checkUndeclaredVariable,
  checkInvalidEnumValue,
  checkTypeMismatch,
  checkE005,
  checkE006,
  checkE007,
  checkE008,
  validateErrors,
  runValidations,
  checkAllErrors,
} from './validator.js';

// 主验证函数（17 条规则一站式验证）
import { validate } from './validator.js';

// ============================================================================
// 导出：主验证函数
// ============================================================================

export { validate };
export type { ValidationResult } from '../types/diagnostic.js';

// ============================================================================
// 导出：个体检测函数（可按需调用，便于单元测试）
// ============================================================================

export {
  // 错误（E001-E008）
  checkUndefinedTargetNode,
  checkUndeclaredVariable,
  checkInvalidEnumValue,
  checkTypeMismatch,
  checkE005,
  checkE006,
  checkE007,
  checkE008,
  validateErrors,
  runValidations,
  checkAllErrors,
  // 警告（W001-W006）
  checkOrphanNodes,
  checkDeadEndNodes,
  checkUnusedVariables,
  checkDuplicateOptionDescriptions,
  checkEmptyBodyNodes,
  checkFormatIrregularities,
  // 建议（I001-I003）
  checkPotentialSoftlock,
  checkShortBody,
  checkMissingChapter,
};

// ============================================================================
// 向后兼容别名
// ============================================================================

/**
 * 对 PlotFlowData 执行完整的错误 + 警告 + 建议检测。
 *
 * @deprecated 请使用 `validate` 替代，此别名仅为向后兼容保留。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns ValidationResult — 包含所有诊断和汇总统计
 */
export function validateAll(data: PlotFlowData): ValidationResult {
  return validate(data);
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 计算诊断汇总统计。
 *
 * @param diagnostics - 诊断列表
 * @returns 按严重级别分类的计数
 */
export function computeSummary(diagnostics: readonly Diagnostic[]): DiagnosticSummary {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const d of diagnostics) {
    if (d.severity === 'error') errors++;
    else if (d.severity === 'warning') warnings++;
    else infos++;
  }

  return {
    errors,
    warnings,
    infos,
    total: diagnostics.length,
  };
}
