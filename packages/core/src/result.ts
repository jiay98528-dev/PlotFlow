/**
 * ParseResult — 不抛异常的 Result 模式
 *
 * @packageDocumentation
 * @remarks
 * 所有解析、验证、导出操作均通过 ParseResult 返回结果，
 * 永不抛异常。调用方通过判别 `ok` 字段处理成功/失败路径。
 *
 * 符合 standards-ts-react.md §1.5 错误处理规范：
 * "Result 模式（不抛异常，返回可联合类型）"
 *
 * @version 0.1.0
 */

import type { Diagnostic } from './types/diagnostic.js';

// ============================================================================
// ParseResult 类型
// ============================================================================

/**
 * 解析结果联合类型。
 *
 * @typeParam T - 成功时的数据类型
 *
 * @example
 * ```typescript
 * const result = parseStory(raw);
 * if (result.ok) {
 *   console.log(result.data.chapters.length);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export type ParseResult<T> =
  | { readonly ok: true; readonly data: T; readonly diagnostics: readonly Diagnostic[] }
  | { readonly ok: false; readonly errors: readonly Diagnostic[] };

// ============================================================================
// 工厂函数
// ============================================================================

/**
 * 创建成功的 ParseResult。
 *
 * @param data - 解析/验证/导出的结果数据
 * @returns 成功的 ParseResult，ok = true
 */
export function success<T>(data: T, diagnostics: readonly Diagnostic[] = []): ParseResult<T> {
  return { ok: true, data, diagnostics };
}

/**
 * 创建失败的 ParseResult。
 *
 * @param errors - 诊断信息列表（至少包含一条错误）
 * @returns 失败的 ParseResult，ok = false
 */
export function failure<T>(errors: readonly Diagnostic[]): ParseResult<T> {
  return { ok: false, errors };
}
