/**
 * edgeStore — Edge ID 编码/解码工具函数
 *
 * 职责：提供 Edge ID 的安全编码和确定性解析，确保从 edge.id
 * 能够可靠地逆向提取 sourceFullId、targetFullId 和 optionIndex。
 *
 * Edge ID 格式（V02-008 加固后）：
 *   {encodeURIComponent(sourceFullId)}->{encodeURIComponent(targetFullId)}#{optionIndex}
 *
 * 使用 encodeURIComponent 处理 fullId 中可能包含的 '#', '->', '-' 等
 * 与分隔符冲突的字符，确保解析的确定性。
 *
 * 对应 TAD.md §2.4 中引用的 parseEdgeId() 函数。
 *
 * @module stores/edgeStore
 */

// ============================================================================
// 类型定义
// ============================================================================

/** 解析后的 Edge ID 组件 */
export interface ParsedEdgeId {
  /** 源节点完整 ID（解码后） */
  readonly sourceFullId: string;
  /** 目标节点完整 ID（解码后） */
  readonly targetFullId: string;
  /** 源节点中选项的从 0 开始索引 */
  readonly optionIndex: number;
}

// ============================================================================
// Edge ID 分隔符常量
// ============================================================================

/** 源和目标之间的分隔符 */
const ARROW_SEPARATOR = '->';

/** 目标和选项索引之间的分隔符 */
const HASH_SEPARATOR = '#';

export const NEXT_EDGE_OPTION_INDEX = -1;

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 编码 Edge ID。
 *
 * 对 sourceFullId 和 targetFullId 进行 encodeURIComponent 编码，
 * 使用 '->' 和 '#' 作为分隔符，确保任意字符的 fullId 都可安全编码。
 *
 * @param sourceFullId - 源节点的 fullId（未编码）
 * @param targetFullId - 目标节点的 fullId（未编码）
 * @param optionIndex  - 源节点中选项的索引
 * @returns 编码后的 Edge ID 字符串
 */
export function encodeEdgeId(
  sourceFullId: string,
  targetFullId: string,
  optionIndex: number,
): string {
  return `${encodeURIComponent(sourceFullId)}${ARROW_SEPARATOR}${encodeURIComponent(targetFullId)}${HASH_SEPARATOR}${optionIndex}`;
}

/**
 * 解析 Edge ID — 从编码后的 edge.id 逆向提取源/目标节点 ID 和选项索引。
 *
 * 解析算法：
 * 1. 从末尾找到最后一个 '#'，提取 optionIndex（# 后的数字）
 * 2. 剩余部分在 '->' 处分割为 source 和 target
 * 3. 对 source 和 target 进行 decodeURIComponent 解码
 *
 * 由于 sourceFullId 和 targetFullId 均经过 encodeURIComponent 编码，
 * '#' 和 '->' 在编码后的字符串中不会出现（分别编码为 %23 和 %2D%3E），
 * 因此 lastIndexOf('#') 和分割 '->' 是确定性操作。
 *
 * @param edgeId - 编码后的 Edge ID 字符串
 * @returns 解析后的 sourceFullId、targetFullId 和 optionIndex
 * @throws {Error} 如果 edgeId 格式无效（缺少分隔符或 optionIndex 非数字）
 */
export function parseEdgeId(edgeId: string): ParsedEdgeId {
  // 步骤 1: 从末尾提取 optionIndex
  const hashIdx = edgeId.lastIndexOf(HASH_SEPARATOR);
  if (hashIdx === -1) {
    throw new Error(
      `Invalid edgeId: missing '${HASH_SEPARATOR}' separator — "${edgeId}"`,
    );
  }

  const optionIndexStr = edgeId.slice(hashIdx + 1);
  const optionIndex = parseInt(optionIndexStr, 10);
  if (isNaN(optionIndex) || optionIndex < NEXT_EDGE_OPTION_INDEX) {
    throw new Error(
      `Invalid edgeId: invalid optionIndex "${optionIndexStr}" — "${edgeId}"`,
    );
  }

  // 步骤 2: 在 '->' 处分割剩余部分
  const remaining = edgeId.slice(0, hashIdx);
  const arrowIdx = remaining.indexOf(ARROW_SEPARATOR);
  if (arrowIdx === -1) {
    throw new Error(
      `Invalid edgeId: missing '${ARROW_SEPARATOR}' separator — "${edgeId}"`,
    );
  }

  const encodedSource = remaining.slice(0, arrowIdx);
  const encodedTarget = remaining.slice(arrowIdx + ARROW_SEPARATOR.length);

  // 步骤 3: decodeURIComponent 解码
  try {
    const sourceFullId = decodeURIComponent(encodedSource);
    const targetFullId = decodeURIComponent(encodedTarget);

    return { sourceFullId, targetFullId, optionIndex };
  } catch (err) {
    throw new Error(
      `Invalid edgeId: decodeURIComponent failed — "${edgeId}": ${(err as Error).message}`,
    );
  }
}
