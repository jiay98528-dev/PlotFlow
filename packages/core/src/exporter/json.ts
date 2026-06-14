/**
 * @plotflow/core — JSON 导出器 (M4-01~04)
 *
 * @packageDocumentation
 * @remarks
 * 将 PlotFlowData AST 导出为符合 json-schema.md 的 JSON 字符串。
 *
 * 对应规范：
 * - spec/json-schema.md（完整 JSON Schema 规范）
 * - spec/syntax-formal.md（语法至 AST 映射规则）
 *
 * 导出规则：
 * - meta.exportedAt 自动填充 ISO 8601 时间戳
 * - 变量类型原样保留 (int/float/bool/string/enum/object)
 * - 选项条件导出 AST 结构 (Comparison / LogicalAnd / LogicalOr / LogicalNot)
 * - 空值字段跳过 (undefined/可选字段 不输出)
 * - JSON 美化输出 (2 空格缩进)
 *
 * @version 0.1.0
 */

import type { PlotFlowData } from '../types/ast.js';
import type { ParseResult } from '../result.js';
import { success, failure } from '../result.js';
import type {
  StoryMeta,
  VariableDeclaration,
  Chapter,
  StoryNode,
  Option,
  ConditionNode,
  ComparisonExpression,
  LogicalExpression,
  Operand,
  SideEffect,
} from '../types/ast.js';
import type { Diagnostic, DiagnosticSeverity } from '../types/diagnostic.js';

// ============================================================================
// 主入口
// ============================================================================

/**
 * 将 PlotFlowData AST 导出为符合 json-schema.md 的 JSON 字符串。
 *
 * @param data - 解析后的 PlotFlowData AST
 * @returns ParseResult — ok 携带格式化的 JSON 字符串，fail 携带诊断信息
 */
export function exportJSON(data: PlotFlowData): ParseResult<string> {
  try {
    const exported = serializeStory(data);
    const json = JSON.stringify(exported, null, 2) + '\n';
    return success(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const diagnostic: Diagnostic = {
      id: 'E005-EXPORT',
      code: 'E005',
      severity: 'error' as DiagnosticSeverity,
      message: `JSON 导出失败: ${message}`,
      range: { startLine: 0, startColumn: 0, endLine: 0, endColumn: 0 },
    };
    return failure([diagnostic]);
  }
}

// ============================================================================
// 顶层序列化
// ============================================================================

/**
 * 将完整的 PlotFlowData 序列化为 JSON 可序列化对象。
 */
function serializeStory(data: PlotFlowData): Record<string, unknown> {
  return {
    $schema: 'https://plotflow.dev/schema/0.1/story.json',
    meta: serializeMeta(data.meta),
    variables: serializeVariables(data.variables),
    chapters: data.chapters.map(serializeChapter),
  };
}

// ============================================================================
// Meta 序列化
// ============================================================================

/**
 * 序列化故事元信息。
 *
 * 规则：
 * - engine: 'generic' 映射为 'none'
 * - exportedAt: 优先使用 AST 中已有值，否则自动生成 ISO 8601
 * - author: 可选字段，仅在非空时输出
 */
function serializeMeta(meta: StoryMeta): Record<string, unknown> {
  const result: Record<string, unknown> = {
    plotflow: meta.plotflow,
    title: meta.title,
    engine: normalizeEngine(meta.engine),
    exportedAt: meta.exportedAt ?? new Date().toISOString(),
  };

  // author 是 Schema 中的可选字段，仅在有值时输出
  if (meta.author && meta.author !== 'Unknown') {
    result['author'] = meta.author;
  }

  return result;
}

/**
 * 统一引擎值：将内部 'generic' 映射为 Schema 定义的 'none'。
 */
function normalizeEngine(engine?: string): string {
  if (!engine) return 'none';
  if (engine === 'generic') return 'none';
  return engine;
}

// ============================================================================
// 变量序列化
// ============================================================================

/**
 * 将变量声明数组序列化为 Schema 要求的键值对象。
 *
 * 输入: [{ name: '金币', type: 'int', defaultValue: 0 }, ...]
 * 输出: { 金币: { type: 'int', default: 0 }, ... }
 */
function serializeVariables(variables: readonly VariableDeclaration[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const v of variables) {
    result[v.name] = serializeVariableDef(v);
  }
  return result;
}

/**
 * 序列化单条变量定义。
 *
 * 类型规则：
 * - int/float/bool/string: 输出 type + default
 * - enum: 输出 type + values + default
 * - object: 输出 type + fields（无 default，Schema 不允许）
 * - 所有类型均不输出 description（Schema 的 additionalProperties: false 禁止）
 */
function serializeVariableDef(v: VariableDeclaration): Record<string, unknown> {
  const result: Record<string, unknown> = {
    type: v.type,
  };

  // default 值：所有类型除 object 外都支持 default 字段
  if (v.type !== 'object') {
    result['default'] = v.defaultValue;
  }

  // enum 类型的合法值列表
  if (v.type === 'enum' && v.enumValues && v.enumValues.length > 0) {
    result['values'] = v.enumValues;
  }

  // object 类型的子字段（递归）
  if (v.type === 'object' && v.fields && v.fields.length > 0) {
    const fields: Record<string, unknown> = {};
    for (const field of v.fields) {
      fields[field.name] = serializeVariableDef(field);
    }
    result['fields'] = fields;
  }

  return result;
}

// ============================================================================
// 章节序列化
// ============================================================================

/**
 * 序列化章节。
 * 仅输出 Schema 要求的字段：id, title, nodes。
 */
function serializeChapter(chapter: Chapter): Record<string, unknown> {
  return {
    id: chapter.id,
    title: chapter.title,
    nodes: chapter.nodes.map(serializeNode),
  };
}

// ============================================================================
// 节点序列化
// ============================================================================

/**
 * 序列化故事节点。
 *
 * 映射说明：
 * - body: AST 中为单字符串 → Schema 中为段落数组（按双换行分割）
 * - position: AST 中不存在 → Schema 要求，默认 { x: 0, y: 0 }
 * - diagnostics.isRoot/isOrphan/isDeadEnd → 直接映射
 */
function serializeNode(node: StoryNode, _index: number): Record<string, unknown> {
  return {
    id: node.id,
    chapterId: node.chapterId,
    fullId: node.fullId,
    title: node.title,
    body: splitBodyToParagraphs(node.body),
    options: node.options.map((opt, i) => serializeOption(opt, i)),
    position: { x: 0, y: 0 },
    isRoot: node.diagnostics.isRoot,
    isOrphan: node.diagnostics.isOrphan,
    isDeadEnd: node.diagnostics.isDeadEnd,
  };
}

/**
 * 将正文文本分割为纯叙述段落数组。
 *
 * 处理步骤：
 * 1. 剥离选项相关行（`[选项]` 及后续的条件/效果子行），仅保留纯叙述文本
 * 2. 按双换行（段落边界）分割
 * 3. 返回过滤后的段落数组
 *
 * @param body - AST 中的原始 body 字符串（含选项语法）
 * @returns 纯叙述段落字符串数组（空正文返回空数组）
 */
function splitBodyToParagraphs(body: string): string[] {
  if (!body || body.trim().length === 0) return [];

  // 统一换行符
  const normalized = body.replace(/\r\n/g, '\n');

  // 找到第一个 [选项] 并截断，只保留纯叙述文本
  const firstOption = normalized.search(/\n\[选项\]/);
  const narrativeOnly = firstOption >= 0
    ? normalized.slice(0, firstOption).trim()
    : normalized.trim();

  if (narrativeOnly.length === 0) return [];

  // 按双换行分割为段落
  const paragraphs = narrativeOnly
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  return paragraphs;
}

// ============================================================================
// 选项序列化
// ============================================================================

/**
 * 序列化选项。
 *
 * 映射说明：
 * - description → text
 * - condition + conditionRaw → conditions（含 expression + ast）
 * - targetNodeId/targetFullId 为 null 时输出空字符串（防御性）
 */
function serializeOption(opt: Option, index: number): Record<string, unknown> {
  return {
    index,
    text: opt.description,
    targetNodeId: opt.targetNodeId ?? '',
    targetFullId: opt.targetFullId ?? '',
    conditions: serializeCondition(opt.condition, opt.conditionRaw),
    sideEffects: opt.sideEffects.map(serializeSideEffect),
  };
}

// ============================================================================
// 条件表达式序列化
// ============================================================================

/**
 * 序列化条件表达式。
 *
 * @param condition - 条件 AST 节点（null 表示无条件）
 * @param conditionRaw - 条件原始文本（优先作为 expression 输出）
 * @returns Schema 要求的 conditions 对象，或 null（无条件）
 */
function serializeCondition(
  condition: ConditionNode | null,
  conditionRaw: string | null,
): Record<string, unknown> | null {
  if (condition === null) return null;

  // 优先使用原始文本，否则从 AST 重建
  const expression =
    conditionRaw !== null && conditionRaw.trim().length > 0
      ? conditionRaw.trim()
      : reconstructExpression(condition);

  return {
    expression,
    ast: convertConditionNode(condition),
  };
}

/**
 * 将内部 ConditionNode AST 转换为 Schema 要求的 AST 格式。
 */
function convertConditionNode(node: ConditionNode): Record<string, unknown> {
  if (node.type === 'comparison') {
    return convertComparison(node);
  }
  // node.type === 'logical'
  return convertLogical(node);
}

/**
 * 将内部 ComparisonExpression 转换为 Schema Comparison 节点。
 *
 * 映射规则：
 * - left operand (variable) → variable 字段
 * - operator → operator 字段
 * - right operand (literal) → value 字段
 */
function convertComparison(expr: ComparisonExpression): Record<string, unknown> {
  return {
    type: 'comparison',
    variable: extractVariableName(expr.left),
    operator: expr.operator,
    value: extractLiteralValue(expr.right),
  };
}

/**
 * 从操作数中提取变量名。
 */
function extractVariableName(operand: Operand): string {
  if (operand.operandType === 'variable' && operand.variableName) {
    return operand.variableName;
  }
  // 防御：如果左操作数不是变量（异常情况），返回字符串化字面量
  return String(operand.literalValue ?? '');
}

/**
 * 从操作数中提取字面量值。
 */
function extractLiteralValue(operand: Operand): unknown {
  if (operand.operandType === 'literal') {
    return operand.literalValue;
  }
  // 防御：如果右操作数不是字面量（异常情况），返回变量名
  return operand.variableName ?? '';
}

/**
 * 将内部 LogicalExpression 转换为 Schema 逻辑表达式节点。
 *
 * 映射规则：
 * - AND: 转换为 LogicalAnd（N 元 → 左折叠二叉树）
 * - OR: 转换为 LogicalOr（N 元 → 左折叠二叉树）
 * - NOT: 转换为 LogicalNot（单子）
 */
function convertLogical(expr: LogicalExpression): Record<string, unknown> {
  const op = expr.operator;
  const operands = expr.operands;

  if (op === 'NOT') {
    // NOT 只有一个操作数
    const operand = operands.length > 0 ? convertConditionNode(operands[0]!) : null;
    return {
      type: 'logical_not',
      operand: operand ?? {},
    };
  }

  if (op === 'AND' || op === 'OR') {
    const targetType = op === 'AND' ? 'logical_and' : 'logical_or';
    return buildNAryLogical(targetType, operands);
  }

  // 防御：不应到达
  const left = operands.length > 0 ? convertConditionNode(operands[0]!) : {};
  const right = operands.length > 1 ? convertConditionNode(operands[1]!) : {};
  return { type: 'logical_and' as const, left, right };
}

/**
 * 将 N 元 AND/OR 折叠为左结合二叉树。
 *
 * 例如 [a, b, c] → { type, left: a, right: { type, left: b, right: c } }
 */
function buildNAryLogical(
  type: 'logical_and' | 'logical_or',
  operands: readonly ConditionNode[],
): Record<string, unknown> {
  if (operands.length === 0) {
    // 防御：空操作数列表
    return { type, left: {}, right: {} };
  }

  if (operands.length === 1) {
    // 单操作数 → 直接返回（不包装）
    return convertConditionNode(operands[0]!);
  }

  // 左折叠：从右向左构建二叉树
  // [a, b, c] → (a ∧ (b ∧ c))
  let result = convertConditionNode(operands[operands.length - 1]!);
  for (let i = operands.length - 2; i >= 0; i--) {
    result = {
      type,
      left: convertConditionNode(operands[i]!),
      right: result,
    };
  }
  return result;
}

/**
 * 从 ConditionNode AST 重建人类可读的表达式字符串。
 *
 * 用于 conditionRaw 不可用时的回退。
 * 输出格式：($变量 运算符 值)
 * 例如：($金币>=10) AND ($武器!='无')
 */
function reconstructExpression(node: ConditionNode): string {
  if (node.type === 'comparison') {
    return reconstructComparison(node);
  }

  // Logical expression
  const op = node.operator;
  const parts = node.operands.map((o) => reconstructConditionExpr(o));

  if (op === 'NOT') {
    return `(NOT ${parts[0]})`;
  }

  const joiner = op === 'AND' ? ' AND ' : ' OR ';
  return `(${parts.join(joiner)})`;
}

/**
 * 重建比较表达式字符串（无外层括号）。
 */
function reconstructComparison(expr: ComparisonExpression): string {
  const variable =
    expr.left.operandType === 'variable' && expr.left.variableName
      ? `$${expr.left.variableName}`
      : String(expr.left.literalValue ?? '');

  const value =
    expr.right.operandType === 'literal'
      ? formatLiteralForExpr(expr.right.literalValue)
      : `$${expr.right.variableName ?? ''}`;

  return `${variable}${expr.operator}${value}`;
}

/**
 * 重建子条件表达式字符串（递归）。
 * 如果子节点是比较表达式，不加外层括号；否则加括号。
 */
function reconstructConditionExpr(node: ConditionNode): string {
  if (node.type === 'comparison') {
    return reconstructComparison(node);
  }
  return reconstructExpression(node);
}

/**
 * 格式化字面量值为表达式文本。
 * 字符串加单引号，其他类型直接 toString。
 */
function formatLiteralForExpr(value: unknown): string {
  if (typeof value === 'string') {
    return `'${value}'`;
  }
  return String(value);
}

// ============================================================================
// 副作用序列化
// ============================================================================

/**
 * 序列化副作用。
 *
 * 映射规则：
 * - variableName → variable
 * - operation → operation
 * - value → value
 * - lineNumber 不输出
 */
function serializeSideEffect(effect: SideEffect): Record<string, unknown> {
  return {
    variable: effect.variableName,
    operation: effect.operation,
    value: effect.value,
  };
}
