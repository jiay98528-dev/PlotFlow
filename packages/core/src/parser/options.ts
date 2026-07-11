/**
 * 选项语法解析器 — M1-03
 *
 * @packageDocumentation
 * @remarks
 * 从节点正文中提取 [选项] 行及其条件/效果子行，产出 Option[] 列表。
 * 条件表达式和效果操作的 AST 解析由 M1-04 / M1-05 完成——此处仅暂存原始文本。
 *
 * 对应规范：
 * - spec/syntax-formal.md §4 (选项语法)
 * - spec/syntax-formal.md §10.2 BC14-BC15, BC25
 *
 * 所有错误通过 ParseResult 模式返回，不抛异常。
 *
 * @version 0.1.0
 */

import type { ParseResult } from '../result.js';
import { success, failure } from '../result.js';
import type { Option, ConditionNode, SideEffect, VariableDeclaration } from '../types/ast.js';
import type {
  Diagnostic,
  ErrorCode,
  WarningCode,
  SourceRange,
} from '../types/diagnostic.js';
import { createDiagnosticLocalization, DIAGNOSTIC_MESSAGES } from '../types/diagnostic.js';
import { parseCondition } from './conditions.js';
import { parseEffects } from './effects.js';

// ============================================================================
// 正则常量
// ============================================================================

/**
 * 选项行匹配：[选项] 描述文本 [-> 节点：目标]
 *
 * 捕获组：
 *   1: 行首 Tab 前缀（用于 indentLevel 计算）
 *   2: [选项] 之后到 -> 之前（或到行尾）的文本 = 选项描述
 *   3: -> 之后的目标引用（可选，仅当有 -> 时捕获）
 */
const OPTION_LINE_RE = /^(\t*)\[选项\][ \t]+(.+?)(?:\s*->\s*(.+))?$/u;

/**
 * 目标引用匹配：节点:XXX 或 节点：XXX
 * 可选前导：章节名/
 *
 * 捕获组：
 *   1: 章节前缀（可选，不含尾随 /）
 *   2: 节点名
 */
const TARGET_REF_RE = /^(?:(.+)\/)?节点[：:][ \t]*(.+)$/u;

/**
 * 条件子行匹配：以 "条件:" 或 "条件：" 开头，缩进 1 级
 * 捕获组 1: 条件表达式原始文本（可能为空字符串）
 */
const CONDITION_LINE_RE = /^[ \t]+(?:条件)[：:][ \t]*(.*)$/u;

/**
 * 效果子行匹配：以 "效果:" 或 "效果：" 开头，缩进 1 级
 * 捕获组 1: 效果列表原始文本（可能为空字符串，含外围括号）
 */
const EFFECT_LINE_RE = /^[ \t]+(?:效果)[：:][ \t]*(.*)$/u;

// ============================================================================
// 常量
// ============================================================================

/** 选项描述最大长度（Unicode 码点） */
const MAX_DESCRIPTION_LENGTH = 1024;

/** 最大缩进级别 */
const MAX_INDENT_LEVEL = 1;

// ============================================================================
// 诊断创建辅助
// ============================================================================

/** 错误计数器（每次 parseOptions 调用重置） */
let errorSeq = 0;

/** 重置错误计数器 */
function resetErrorSeq(): void {
  errorSeq = 0;
}

/**
 * 剥离字符串外围的一对括号（如果存在）。
 * 例如 "(好感度+3, 金币-10)" → "好感度+3, 金币-10"
 * 仅当首字符为 ( 且末字符为 ) 且两者匹配时才剥离。
 */
function stripOuterParens(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')') && trimmed.length >= 2) {
    // 验证括号正确匹配（简单计数法，避免错误剥离嵌套不匹配的括号）
    let depth = 0;
    const inner = trimmed.slice(1, -1);
    for (const ch of inner) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (depth < 0) return trimmed; // 括号不匹配，返回原值
    }
    // depth === 0 表示所有 "(" 都被对应的 ")" 闭合
    // 但注意：我们只剥离最外层括号，所以在遍历 inner 时 depth 最终应为 0
    return inner;
  }
  return trimmed;
}

/**
 * 创建诊断对象。
 */
function createDiagnostic(
  code: ErrorCode | WarningCode,
  severity: 'error' | 'warning',
  line: number,
  startColumn: number = 1,
  endColumn: number = 1,
  message?: string,
  detail?: string,
): Diagnostic {
  errorSeq++;
  const seqStr = String(errorSeq).padStart(3, '0');
  const range: SourceRange = {
    startLine: line,
    startColumn,
    endLine: line,
    endColumn,
  };
  return {
    id: `${code}-${seqStr}`,
    code,
    severity,
    message: message ?? DIAGNOSTIC_MESSAGES[code],
    ...createDiagnosticLocalization(code),
    detail,
    range,
  };
}

// ============================================================================
// 内部 — 单选项解析结果
// ============================================================================

interface ParseOneOptionResult {
  option: Option | null;
  nextIndex: number;
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 从节点正文中解析选项列表。
 *
 * 扫描 nodeBody 中的所有 `[选项]` 行，提取描述文本、跳转目标、
 * 条件/效果子行，构建 Option 对象。同时调用 parseCondition 和 parseEffects
 * 将条件表达式和效果列表解析为 AST。
 *
 * @param nodeBody - 节点正文文本（包含叙述文本、[选项] 行及其子行）
 * @param baseLineNumber - nodeBody 第一行在源文件中的绝对行号（1-based）
 * @param variables - Frontmatter 中声明的变量列表（用于条件/效果的类型检查）
 * @returns ParseResult\<Option[]\>
 *   - ok: true 时携带解析出的选项列表（可能为空数组），diagnostics 携带非致命的子解析错误
 *   - ok: false 时携带所有诊断错误（仅当无任何选项被成功解析时）
 *
 * @remarks
 * - 条件表达式和效果操作的解析错误不阻止选项生成（解析不中断原则）
 * - 缩进不正确的子行会被忽略并发出 E005
 * - 空 nodeBody 返回空数组（不报错）
 */
export function parseOptions(
  nodeBody: string,
  baseLineNumber: number,
  variables: readonly VariableDeclaration[],
): ParseResult<Option[]> {
  resetErrorSeq();
  const errors: Diagnostic[] = [];
  const options: Option[] = [];

  if (nodeBody.trim().length === 0) {
    return success([]);
  }

  const lines = nodeBody.split(/\r?\n|\r/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const trimmed = line.trimStart();

    // 检测 [选项] 行
    if (trimmed.startsWith('[选项]')) {
      const result = parseOneOption(lines, i, baseLineNumber, variables, errors);
      if (result.option) {
        options.push(result.option);
      }
      i = result.nextIndex;
    } else {
      i++;
    }
  }

  // 如果有至少一个选项被成功解析，返回 success 并携带所有诊断
  // 这样 condition/effects 子解析的错误不会导致整个节点丢失选项
  if (options.length > 0) {
    return success(options, errors);
  }

  // 无选项被解析 — 如果有错误则失败，否则返回空数组
  if (errors.length > 0) {
    return failure(errors as readonly Diagnostic[]);
  }

  return success([]);
}

// ============================================================================
// 内部 — 解析单个选项
// ============================================================================

/**
 * 从指定行开始解析一个完整的 Option（含子行）。
 *
 * @param lines - 节点正文的所有行
 * @param startIndex - [选项] 行在 lines 中的索引
 * @param baseLineNumber - nodeBody 第一行的绝对行号
 * @param errors - 累积诊断错误列表
 * @returns 解析结果（Option + 下一行索引）
 */
function parseOneOption(
  lines: readonly string[],
  startIndex: number,
  baseLineNumber: number,
  variables: readonly VariableDeclaration[],
  errors: Diagnostic[],
): ParseOneOptionResult {
  const optionLine = lines[startIndex]!;
  const absoluteLine = baseLineNumber + startIndex;

  // ------------------------------------------------------------------
  // 步骤 1: 解析选项行 — 提取 [选项] 前缀缩进
  // ------------------------------------------------------------------

  // 计算行首 Tab 数量作为 indentLevel
  const leadingTabMatch = optionLine.match(/^(\t*)/);
  const leadingTabs = leadingTabMatch?.[1]?.length ?? 0;

  // indentLevel = 缩进 Tab 数，限制在 0-1
  const rawIndentLevel = leadingTabs;
  let indentLevel = rawIndentLevel;
  if (rawIndentLevel > MAX_INDENT_LEVEL) {
    // 超过最大缩进级别，发出警告并钳制
    indentLevel = MAX_INDENT_LEVEL;
    errors.push(
      createDiagnostic(
        'W006',
        'warning',
        absoluteLine,
        1,
        leadingTabs + 1,
        `选项缩进级别 ${rawIndentLevel} 超过最大限制 ${MAX_INDENT_LEVEL}，已钳制为 ${MAX_INDENT_LEVEL}`,
      ),
    );
  }

  // ------------------------------------------------------------------
  // 步骤 2: 解析选项行内容 — 描述 + 目标
  // ------------------------------------------------------------------

  const trimmed = optionLine.trimStart();
  const optMatch = OPTION_LINE_RE.exec(trimmed);
  if (!optMatch) {
    // 正则不匹配 → 格式问题（如只有 [选项] 无描述，或特殊字符）
    errors.push(
      createDiagnostic(
        'E005',
        'error',
        absoluteLine,
        1,
        trimmed.length,
        `选项行格式错误: "${trimmed}"`,
        '选项格式应为 "[选项] 描述文本 -> 节点：目标" 或 "[选项] 描述文本"',
      ),
    );
    return { option: null, nextIndex: startIndex + 1 };
  }

  let description = (optMatch[2] ?? '').trim();
  const arrowPart = optMatch[3] ?? undefined; // -> 之后的内容

  // 描述不能为空
  if (description.length === 0) {
    errors.push(
      createDiagnostic(
        'E005',
        'error',
        absoluteLine,
        1,
        trimmed.length,
        '选项描述不能为空',
      ),
    );
    return { option: null, nextIndex: startIndex + 1 };
  }

  // 描述长度检查
  if ([...description].length > MAX_DESCRIPTION_LENGTH) {
    errors.push(
      createDiagnostic(
        'W006',
        'warning',
        absoluteLine,
        leadingTabs + '[选项] '.length + 1,
        leadingTabs + '[选项] '.length + 1 + [...description].length,
        `选项描述过长（${[...description].length} > ${MAX_DESCRIPTION_LENGTH} 个 Unicode 码点），将被截断`,
      ),
    );
    // 截断到最大长度
    const chars = [...description];
    description = chars.slice(0, MAX_DESCRIPTION_LENGTH).join('');
  }

  // ------------------------------------------------------------------
  // 步骤 3: 解析目标引用
  // ------------------------------------------------------------------

  let targetNodeId: string | null = null;
  let targetChapterId: string | null = null;

  if (arrowPart !== undefined) {
    // 有 -> 部分
    const arrowTrimmed = arrowPart.trim();

    if (arrowTrimmed.length === 0) {
      // -> 之后无内容
      const arrowCol = trimmed.indexOf('->');
      errors.push(
        createDiagnostic(
          'E005',
          'error',
          absoluteLine,
          arrowCol >= 0 ? arrowCol + 1 : 1,
          trimmed.length,
          '"->" 之后缺少目标节点引用',
          '格式应为 "-> 节点：目标节点名"',
        ),
      );
    } else {
      // 尝试匹配 "节点：XXX" 或 "节点:XXX"（可选章节前缀/）
      const targetMatch = TARGET_REF_RE.exec(arrowTrimmed);
      if (!targetMatch || !targetMatch[2] || targetMatch[2].trim().length === 0) {
        // 目标引用格式错误
        const arrowCol = trimmed.indexOf('->');
        errors.push(
          createDiagnostic(
            'E005',
            'error',
            absoluteLine,
            arrowCol >= 0 ? arrowCol + 1 : 1,
            trimmed.length,
            `目标引用格式错误: "${arrowTrimmed}"`,
            '格式应为 "节点：目标节点名" 或 "章节名/节点：目标节点名"',
          ),
        );
      } else {
        targetNodeId = targetMatch[2].trim();
        targetChapterId = targetMatch[1]?.trim() || null;
      }
    }
  } else {
    // 无 -> → 死胡同选项，发出 E005
    errors.push(
      createDiagnostic(
        'E005',
        'error',
        absoluteLine,
        1,
        trimmed.length,
        `选项 "${description}" 缺少跳转目标（"->"）`,
        '请添加 "-> 节点：目标节点名"，或若确为终点节点则不添加任何选项。',
      ),
    );
  }

  // ------------------------------------------------------------------
  // 步骤 4: 收集条件/效果子行
  // ------------------------------------------------------------------

  let conditionRaw: string | null = null;
  let effectsRaw: string | null = null;

  // 子行缩进要求：至少 1 个缩进级别（2 空格或 1 Tab）
  // 从 startIndex + 1 开始扫描，直到下一个 [选项] 或文件结束
  let j = startIndex + 1;
  while (j < lines.length) {
    const subLine = lines[j]!;
    const subTrimmed = subLine.trimStart();

    // 遇到下一个 [选项] → 当前选项结束
    if (subTrimmed.startsWith('[选项]')) {
      break;
    }

    // 检查是否为条件子行
    const condMatch = CONDITION_LINE_RE.exec(subLine);
    if (condMatch) {
      const rawText = (condMatch[1] ?? '').trim();
      if (rawText.length > 0) {
        // 仅当第一条条件被记录；后续重复条件子行忽略
        if (conditionRaw === null) {
          conditionRaw = rawText;
        } else {
          // 重复的条件子行发出警告
          errors.push(
            createDiagnostic(
              'W006',
              'warning',
              baseLineNumber + j,
              1,
              subLine.length,
              '重复的条件子行，将被忽略',
            ),
          );
        }
      } else {
        // 条件子行无表达式内容
        errors.push(
          createDiagnostic(
            'E005',
            'error',
            baseLineNumber + j,
            1,
            subLine.length,
            '条件子行缺少表达式',
          ),
        );
      }
      j++;
      continue;
    }

    // 检查是否为效果子行
    const effectMatch = EFFECT_LINE_RE.exec(subLine);
    if (effectMatch) {
      const rawText = (effectMatch[1] ?? '').trim();
      if (rawText.length > 0) {
        if (effectsRaw === null) {
          // 剥离外围括号（效果语法的 "(" EffectList ")" 是结构标记）
          effectsRaw = stripOuterParens(rawText);
        } else {
          errors.push(
            createDiagnostic(
              'W006',
              'warning',
              baseLineNumber + j,
              1,
              subLine.length,
              '重复的效果子行，将被忽略',
            ),
          );
        }
      } else {
        errors.push(
          createDiagnostic(
            'E005',
            'error',
            baseLineNumber + j,
            1,
            subLine.length,
            '效果子行缺少表达式',
          ),
        );
      }
      j++;
      continue;
    }

    // 非 [选项]、非条件子行、非效果子行 → 当前选项结束
    // （可能是正文、空行、或其他内容）
    break;
  }

  // ------------------------------------------------------------------
  // 步骤 5: 解析条件表达式 (M1-04)
  // ------------------------------------------------------------------

  let condition: ConditionNode | null = null;
  if (conditionRaw !== null) {
    const condResult = parseCondition(conditionRaw, variables, absoluteLine);
    if (condResult.ok) {
      condition = condResult.data;
    } else {
      // 累积条件解析错误，但不阻止本选项生成（解析不中断原则）
      errors.push(...condResult.errors);
    }
  }

  // ------------------------------------------------------------------
  // 步骤 6: 解析副作用列表 (M1-05)
  // ------------------------------------------------------------------

  let sideEffects: SideEffect[] = [];
  if (effectsRaw !== null) {
    const effectsResult = parseEffects(effectsRaw, variables, absoluteLine);
    if (effectsResult.ok) {
      sideEffects = effectsResult.data;
    } else {
      // 累积效果解析错误，但不阻止本选项生成（解析不中断原则）
      errors.push(...effectsResult.errors);
    }
  }

  // ------------------------------------------------------------------
  // 步骤 7: 组装 Option 对象
  // ------------------------------------------------------------------

  const option: Option = {
    description,
    indentLevel,
    targetNodeId,
    targetChapterId,
    targetFullId: null,       // M2 填充（跨章节引用解析）
    condition,
    sideEffects,
    conditionRaw,
    effectsRaw,
    lineNumber: absoluteLine,
  };

  return { option, nextIndex: j };
}
