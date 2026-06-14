/**
 * 验证器共享工具函数
 *
 * @packageDocumentation
 * @remarks
 * 提供创建 Diagnostic 对象的工厂函数，确保所有诊断信息格式一致。
 *
 * @version 0.1.0
 */

import type {
  Diagnostic,
  DiagnosticCode,
  SourceRange,
} from '../types/diagnostic.js';

import {
  DIAGNOSTIC_MESSAGES,
  DIAGNOSTIC_SEVERITY,
} from '../types/diagnostic.js';

// ============================================================================
// Diagnostic 工厂
// ============================================================================

/**
 * 创建一条诊断信息。
 *
 * @param code        - 诊断代码
 * @param range       - 在源文件中的位置
 * @param detail      - 详细信息（可选）
 * @param relatedNodeId - 关联节点/选项 ID（可选）
 * @returns 格式化的 Diagnostic 对象
 */
export function createDiagnostic(
  code: DiagnosticCode,
  range: SourceRange,
  detail?: string,
  relatedNodeId?: string,
): Diagnostic {
  return {
    id: `${code}@L${range.startLine}:${range.startColumn}`,
    code,
    severity: DIAGNOSTIC_SEVERITY[code],
    message: DIAGNOSTIC_MESSAGES[code],
    ...(detail !== undefined ? { detail } : {}),
    ...(relatedNodeId !== undefined ? { relatedNodeId } : {}),
    range,
  };
}

/**
 * 根据行号创建 SourceRange（默认列范围 1-2）。
 *
 * @param lineNumber - 1-based 行号
 * @returns 覆盖该行开始位置的 SourceRange
 */
export function rangeAtLine(lineNumber: number): SourceRange {
  return {
    startLine: lineNumber,
    startColumn: 1,
    endLine: lineNumber,
    endColumn: 2,
  };
}

/**
 * 在匿名章节中收集所有节点的列表。
 *
 * @param chapters - 所有章节
 * @returns 匿名章节中的节点数组
 */
export function collectAnonymousNodes(
  chapters: { isAnonymous: boolean; nodes: { lineNumber: number; id: string }[] }[],
): { lineNumber: number; id: string }[] {
  const result: { lineNumber: number; id: string }[] = [];
  for (const chapter of chapters) {
    if (chapter.isAnonymous) {
      result.push(...chapter.nodes);
    }
  }
  return result;
}
