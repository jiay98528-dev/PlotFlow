/**
 * 分支图适配器 — 节点状态判定工具函数
 *
 * @module components/branch-graph/adapter-helpers
 *
 * 职责：根据 M3 验证器填充的 NodeDiagnostics 元数据
 * （isOrphan / isDeadEnd / diagnosticIds）判定节点在分支图中的视觉状态。
 *
 * 判定规则（按优先级降序）：
 * 1. error:   diagnosticIds 中包含以 'E' 开头的诊断代码（E001-E008）
 * 2. orphan:  diagnostics.isOrphan === true
 * 3. deadend: diagnostics.isDeadEnd === true
 * 4. normal:  其他情况（含根节点）
 *
 * 对应 TAD.md §2.4.1 STATUS_CLASS_MAP 和 CLAUDE.md §6.3 节点状态着色规范。
 */

import type { StoryNode } from '@plotflow/core';

// ============================================================================
// 节点状态类型
// ============================================================================

/**
 * 节点状态枚举。
 *
 * 由验证器填充的 {@link import('@plotflow/core').NodeDiagnostics} 判定。
 * 不含 'root' 状态——根节点在视觉上被归为 'normal'，通过 CSS 数据属性区分。
 */
export type NodeStatus = 'normal' | 'orphan' | 'deadend' | 'error';

// ============================================================================
// 核心判定函数
// ============================================================================

/**
 * 根据验证器填充的 diagnostics 元数据判定节点状态。
 *
 * 优先级：error > orphan > deadend > normal
 *
 * @param node - 故事节点，其 `diagnostics` 字段由 M3 验证器填充
 *   （`validate()` → `updateNodeDiagnostics()`）
 * @returns 节点状态（4 种之一）
 *
 * @remarks
 * - 诊断 ID 格式为 `{CODE}@L{line}:{col}`，如 `E001@L5:1`
 * - 所有错误代码以 'E' 开头（E001-E008），与警告 (W) 和建议 (I) 区分
 * - isOrphan/isDeadEnd 由验证器的 `updateNodeDiagnostics()` 在运行 validate() 时填充
 * - 此函数假设验证器已执行完毕，不对缺失字段做容错
 *
 * @example
 * ```typescript
 * const status = getNodeStatus(node);
 * if (status === 'error') {
 *   // 高亮红色边框
 * }
 * ```
 */
export function getNodeStatus(node: StoryNode): NodeStatus {
  const { diagnostics } = node;

  // 1. 错误状态：diagnosticIds 中有以 'E' 开头的错误诊断代码（E001-E008）
  //    诊断 ID 格式为 "E001@L5:1"，通过 startsWith('E') 即可判定
  if (diagnostics.diagnosticIds.some((id) => id.startsWith('E'))) {
    return 'error';
  }

  // 2. 孤立节点：非根节点且无入口选项指向
  if (diagnostics.isOrphan) {
    return 'orphan';
  }

  // 3. 死胡同节点：无出口选项（options.length === 0）
  if (diagnostics.isDeadEnd) {
    return 'deadend';
  }

  // 4. 正常节点（含根节点）
  return 'normal';
}
