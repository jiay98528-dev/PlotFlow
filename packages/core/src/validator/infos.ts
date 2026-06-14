/**
 * 建议检测规则 I001 — I003
 *
 * @packageDocumentation
 * @remarks
 * 每个函数接收 PlotFlowData，返回该规则检测到的 Diagnostic[]。
 * 对应 PRD §9.1 中定义的 3 种建议类型。
 *
 * @version 0.1.0
 */

import type { PlotFlowData } from '../types/ast.js';
import type { Diagnostic } from '../types/diagnostic.js';
import { createDiagnostic, rangeAtLine } from './helpers.js';

// ============================================================================
// I001 — 可能卡关
// ============================================================================

/**
 * I001: 检测可能卡关的节点。
 *
 * 定义：节点的所有选项都有执行条件（全部选项的 condition 均不为 null），
 * 意味着所有路径都可能因为条件不满足而不可达。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkPotentialSoftlock(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      // 跳过无选项的节点（由 W002 处理）
      if (node.options.length === 0) {
        continue;
      }

      // 检查是否所有选项都有条件
      const allConditional = node.options.every((opt) => opt.condition !== null);

      if (allConditional) {
        const totalOptions = node.options.length;
        const conditionalCount = node.options.filter((opt) => opt.condition !== null).length;

        diagnostics.push(
          createDiagnostic(
            'I001',
            rangeAtLine(node.lineNumber),
            `节点「${node.title}」全部 ${totalOptions} 个选项均有执行条件（${conditionalCount}/${totalOptions}），` +
              `当条件全部不满足时读者将无法推进剧情`,
            node.fullId,
          ),
        );
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// I002 — 描述过短
// ============================================================================

/**
 * I002: 检测正文描述过短的节点。
 *
 * 定义：节点 body 的有效字符数（trim 后）少于 10 个字符，
 * 叙事信息不足。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkShortBody(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      // 跳过空描述节点（由 W005 处理）
      if (node.body.trim() === '') {
        continue;
      }

      if (node.body.trim().length < 10) {
        diagnostics.push(
          createDiagnostic(
            'I002',
            rangeAtLine(node.lineNumber),
            `节点「${node.title}」正文描述仅 ${node.body.trim().length} 个字符，建议扩充以增强叙事沉浸感`,
            node.fullId,
          ),
        );
      }
    }
  }

  return diagnostics;
}

// ============================================================================
// I003 — 无章节归属
// ============================================================================

/**
 * I003: 检测位于匿名章节中的节点。
 *
 * 定义：节点所在的 chapter 的 isAnonymous 标志为 true，
 * 建议为节点划分到有命名的章节中以提升可读性。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns 诊断列表
 */
export function checkMissingChapter(data: PlotFlowData): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const chapter of data.chapters) {
    if (!chapter.isAnonymous) {
      continue;
    }

    for (const node of chapter.nodes) {
      diagnostics.push(
        createDiagnostic(
          'I003',
          rangeAtLine(node.lineNumber),
          `节点「${node.title}」处于匿名章节中，建议使用「# 章节：名称」为其划分章节`,
          node.fullId,
        ),
      );
    }
  }

  return diagnostics;
}
