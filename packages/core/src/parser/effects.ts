/**
 * 变量操作（效果）解析器 — M1-05
 *
 * @packageDocumentation
 * @remarks
 * 将效果文本 `effectsRaw` 解析为 SideEffect[] 列表。
 * 支持赋值（=）、增加（+）、减少（-）、追加（←）四种操作。
 * 采用类型感知的值解析，根据变量声明类型解析字面量值。
 *
 * 对应规范：
 * - spec/syntax-formal.md §6 (变量操作/效果)
 * - spec/syntax-formal.md §6.4 (类型检查)
 * - spec/syntax-formal.md §6.5 (完整效果示例)
 *
 * 纯函数实现，所有错误通过 ParseResult 模式返回，不抛异常。
 *
 * @version 0.1.0
 */

import type { ParseResult } from '../result.js';
import { success, failure } from '../result.js';
import type {
  SideEffect,
  SideEffectOperation,
  VariableDeclaration,
  VariableType,
  VariableValue,
} from '../types/ast.js';
import type { Diagnostic, ErrorCode } from '../types/diagnostic.js';
import { DIAGNOSTIC_MESSAGES } from '../types/diagnostic.js';

// ============================================================================
// 常量
// ============================================================================

/** 效果表达式最大长度（Unicode 码点） */
const MAX_EFFECT_LENGTH = 2048;

/** 操作符字符 → 操作类型映射 */
const OPERATOR_TO_OPERATION: Readonly<Record<string, SideEffectOperation>> = {
  '=': 'set',
  '+': 'add',
  '-': 'subtract',
  '←': 'append',
};

// ============================================================================
// 正则常量
// ============================================================================

/**
 * 单个效果操作匹配正则。
 *
 * 匹配格式：`[$]变量名.可选字段 操作符 值`
 *
 * 捕获组：
 *   1: 变量引用（含可选的 $ 前缀和可选的 .field 路径链）
 *   2: 操作符（= / + / - / ←）
 *   3: 值原始文本
 *
 * 变量名段：不含操作符、分隔符、空白、点的非空字符序列。
 * $ 前缀可选（对应 syntax-formal.md §6.2 LValue = VarName）。
 */
const EFFECT_OP_RE =
  /^(\$?[^.=+\-,\s←]+(?:\.[^.=+\-,\s←]+)*)\s*([=+\-←])\s*(.+)$/u;

// ============================================================================
// 诊断创建辅助
// ============================================================================

/** 错误计数器（每次 parseEffects 调用重置） */
let errorSeq = 0;

function resetErrorSeq(): void {
  errorSeq = 0;
}

/**
 * 创建诊断对象。
 *
 * lineNumber 为 0 表示行号未知（词法分析阶段）。
 */
function createDiagnostic(
  code: ErrorCode,
  line: number,
  startColumn: number,
  endColumn: number,
  message?: string,
  detail?: string,
): Diagnostic {
  errorSeq++;
  const seqStr = String(errorSeq).padStart(3, '0');
  return {
    id: `${code}-${seqStr}`,
    code,
    severity: 'error',
    message: message ?? DIAGNOSTIC_MESSAGES[code],
    detail,
    range: {
      startLine: line,
      startColumn,
      endLine: line,
      endColumn,
    },
  };
}

// ============================================================================
// 辅助函数 — 变量解析
// ============================================================================

/**
 * 从变量声明列表中构建名称→声明的快速查找映射。
 */
function buildVariableMap(
  variables: readonly VariableDeclaration[],
): Map<string, VariableDeclaration> {
  const map = new Map<string, VariableDeclaration>();
  for (const v of variables) {
    map.set(v.name, v);
  }
  return map;
}

/**
 * 解析字段访问路径，返回最终字段的类型声明。
 *
 * @param path - 点分隔的变量路径（不含 $ 前缀），如 "角色状态.魔力"
 * @param variableMap - 顶层变量映射
 * @returns 最终字段的 VariableDeclaration，或 null（未找到）
 */
function resolveFieldPath(
  path: string,
  variableMap: Map<string, VariableDeclaration>,
): VariableDeclaration | null {
  const segments = path.split('.');
  const rootName = segments[0]!;

  let current: VariableDeclaration | undefined = variableMap.get(rootName);
  if (!current) return null;

  for (let i = 1; i < segments.length; i++) {
    const fieldName = segments[i]!;
    if (current.type !== 'object' || !current.fields) return null;
    const next: VariableDeclaration | undefined = current.fields.find(
      (f: VariableDeclaration) => f.name === fieldName,
    );
    if (!next) return null;
    current = next;
  }

  return current;
}

// ============================================================================
// 辅助函数 — 效果列表分割
// ============================================================================

/**
 * 将效果列表原始文本按逗号分割为单个效果表达式。
 *
 * 尊重字符串字面量边界：仅分割不在引号内的逗号。
 * 支持半角逗号 `,`（U+002C）和全角逗号 `，`（U+FF0C）。
 *
 * @param raw - 效果列表原始文本（不含外围括号）
 * @returns 单个效果表达式数组（已 trim）
 */
function splitEffects(raw: string): string[] {
  const results: string[] = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;
  const chars = [...raw];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }

    if (inString) {
      current += ch;
      if (ch === stringChar) {
        inString = false;
        stringChar = '';
      }
    } else {
      if (ch === "'" || ch === '"') {
        inString = true;
        stringChar = ch;
        current += ch;
      } else if (ch === ',' || ch === '，') {
        if (current.trim().length > 0) {
          results.push(current.trim());
        }
        current = '';
      } else {
        current += ch;
      }
    }
  }

  // 处理末尾残留（最后一个效果可能无尾随逗号）
  if (current.trim().length > 0) {
    results.push(current.trim());
  }

  return results;
}

// ============================================================================
// 辅助函数 — 值解析（类型感知）
// ============================================================================

/**
 * 值解析结果：成功则含 parsed 值，失败则含 diagnostic。
 */
type ValueParseResult =
  | { ok: true; value: VariableValue }
  | { ok: false; diagnostic: Diagnostic };

/**
 * 根据变量类型，将值原始文本解析为 VariableValue。
 *
 * 类型感知规则：
 * - int → parseInt，失败则 E004
 * - float → parseFloat，失败则 E004
 * - bool → 'true'/'false'（不含引号），否则 E004
 * - string → 去除外围引号（单引号或双引号）
 * - enum → 去除外围引号（如有），保留原值（枚举验证在外部进行）
 * - object → 不允许直接赋值，报 E004
 *
 * @param raw - 值原始文本
 * @param type - 预期变量类型
 * @param lineNumber - 源文件行号
 * @returns 解析结果
 */
function parseValueByType(
  raw: string,
  type: VariableType,
  lineNumber: number,
): ValueParseResult {
  switch (type) {
    case 'int': {
      const num = parseInt(raw, 10);
      if (isNaN(num)) {
        return {
          ok: false,
          diagnostic: createDiagnostic(
            'E004',
            lineNumber,
            1,
            raw.length,
            `无法将 "${raw}" 解析为 int 类型`,
            '整数值应为数字（如 10），不含引号或非数字字符。',
          ),
        };
      }
      return { ok: true, value: num };
    }

    case 'float': {
      const num = parseFloat(raw);
      if (isNaN(num)) {
        return {
          ok: false,
          diagnostic: createDiagnostic(
            'E004',
            lineNumber,
            1,
            raw.length,
            `无法将 "${raw}" 解析为 float 类型`,
            '浮点数值应为数字（如 0.5 或 3.14），不含引号或非数字字符。',
          ),
        };
      }
      return { ok: true, value: num };
    }

    case 'bool': {
      if (raw === 'true') return { ok: true, value: true };
      if (raw === 'false') return { ok: true, value: false };
      return {
        ok: false,
        diagnostic: createDiagnostic(
          'E004',
          lineNumber,
          1,
          raw.length,
          `无法将 "${raw}" 解析为 bool 类型`,
          '布尔值必须为 true 或 false（不含引号）。',
        ),
      };
    }

    case 'string': {
      // 去除外围引号
      const unquoted = stripStringQuotes(raw);
      return { ok: true, value: unquoted };
    }

    case 'enum': {
      // 去除外围引号（如有），保留值用于后续 E003 验证
      const unquoted = stripStringQuotes(raw);
      if (unquoted.length === 0) {
        return {
          ok: false,
          diagnostic: createDiagnostic(
            'E004',
            lineNumber,
            1,
            raw.length,
            `枚举值不能为空`,
            '请提供合法的枚举值。',
          ),
        };
      }
      return { ok: true, value: unquoted };
    }

    case 'object': {
      // object 类型不允许直接在效果中整体赋值
      return {
        ok: false,
        diagnostic: createDiagnostic(
          'E004',
          lineNumber,
          1,
          raw.length,
          `不能直接对 object 类型变量赋值，请使用字段访问（如 "$对象.字段=值"）`,
          'object 类型的操作必须通过字段路径访问。',
        ),
      };
    }

    default:
      return {
        ok: false,
        diagnostic: createDiagnostic(
          'E005',
          lineNumber,
          1,
          raw.length,
          `未知的变量类型: "${type}"`,
        ),
      };
  }
}

/**
 * 剥离字符串外围的一对引号（单引号或双引号）。
 *
 * 仅当首尾引号匹配时才剥离。不处理转义。
 *
 * @param raw - 原始文本
 * @returns 剥离引号后的文本，或原文本（如无匹配引号）
 */
function stripStringQuotes(raw: string): string {
  if (raw.length < 2) return raw;

  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    return raw.slice(1, -1);
  }

  return raw;
}

// ============================================================================
// 辅助函数 — 操作-类型兼容性验证
// ============================================================================

/**
 * 验证操作类型与变量类型是否兼容。
 *
 * 规则（对应 syntax-formal.md §6.4）：
 * - set (=)：所有类型均合法
 * - add (+)：仅 int / float
 * - subtract (-)：仅 int / float
 * - append (←)：仅 string
 *
 * @param operation - 副作用操作类型
 * @param varType - 变量声明类型
 * @param lineNumber - 源文件行号
 * @returns 错误诊断，或 null（兼容）
 */
function validateOperationType(
  operation: SideEffectOperation,
  varType: VariableType,
  lineNumber: number,
): Diagnostic | null {
  if (operation === 'add' || operation === 'subtract') {
    if (varType !== 'int' && varType !== 'float') {
      return createDiagnostic(
        'E004',
        lineNumber,
        1,
        1,
        `"${operation}" 操作只能用于 int 或 float 类型，但变量类型为 "${varType}"`,
        `请将数值操作用于数值类型变量。对于 "${varType}" 类型，请使用 "=" (赋值)。`,
      );
    }
  }

  if (operation === 'append') {
    if (varType !== 'string') {
      return createDiagnostic(
        'E004',
        lineNumber,
        1,
        1,
        `"append" 操作只能用于 string 类型，但变量类型为 "${varType}"`,
        `请将 "←" (追加) 操作用于 string 类型变量，或使用 "=" (赋值)。`,
      );
    }
  }

  // set 操作对所有类型合法
  return null;
}

// ============================================================================
// 内部 — 单效果解析
// ============================================================================

/**
 * 解析单个效果表达式，产出 SideEffect 或诊断错误。
 *
 * @param raw - 单个效果表达式原始文本（如 "$金币+10"）
 * @param variableMap - 变量名→声明映射
 * @param lineNumber - 效果子行在源文件中的行号（1-based）
 * @param errors - 累积诊断错误列表（追加到此处）
 * @returns SideEffect 或 null（解析失败）
 */
function parseOneEffect(
  raw: string,
  variableMap: Map<string, VariableDeclaration>,
  lineNumber: number,
  errors: Diagnostic[],
): SideEffect | null {
  // ------------------------------------------------------------------
  // 步骤 1: 正则匹配 — 提取变量、操作符、值
  // ------------------------------------------------------------------

  const match = EFFECT_OP_RE.exec(raw);

  if (!match) {
    // 尝试提供更具体的错误信息
    const hasVarRef = raw.includes('$');
    const hasOperator = /[=+\-←]/.test(raw);

    let detail = '格式应为 "$变量名操作符值"，如 "$金币+10" 或 "$武器=\'长剑\'"。';
    if (!hasVarRef) {
      detail = '效果表达式缺少变量引用（以 "$" 开头）。';
    } else if (!hasOperator) {
      detail = `缺少操作符（支持: = + - ←）。`;
    }

    errors.push(
      createDiagnostic(
        'E005',
        lineNumber,
        1,
        raw.length,
        `效果表达式语法错误: "${raw}"`,
        detail,
      ),
    );
    return null;
  }

  const varRef = match[1]!; // 如 "$角色状态.魔力" 或 "好感度"
  const operatorChar = match[2]!; // 如 "+"
  const rawValue = match[3]!.trim(); // 如 "10" 或 "'长剑'"

  const variableName = varRef.startsWith('$') ? varRef.slice(1) : varRef;

  // $ 后无有效变量名 → 语法错误
  if (variableName.length === 0) {
    errors.push(
      createDiagnostic(
        'E005',
        lineNumber,
        1,
        raw.length,
        `效果表达式中 "$" 后缺少有效的变量名`,
        '变量引用格式应为 "$变量名" 或直接使用变量名。',
      ),
    );
    return null;
  }

  // ------------------------------------------------------------------
  // 步骤 2: 解析变量声明
  // ------------------------------------------------------------------

  const rootName = variableName.split('.')[0]!;
  const rootVar = variableMap.get(rootName);

  if (!rootVar) {
    // 根变量未声明
    errors.push(
      createDiagnostic(
        'E002',
        lineNumber,
        1,
        variableName.length + 1,
        `变量 "${rootName}" 未在 Frontmatter 中声明`,
        `请在 Frontmatter 的 vars: 块中声明此变量后再使用。`,
      ),
    );
    return null;
  }

  // 解析字段路径（如有）
  const resolved = resolveFieldPath(variableName, variableMap);
  if (!resolved) {
    if (variableName.includes('.')) {
      // 根变量存在但字段路径无效
      errors.push(
        createDiagnostic(
          'E004',
          lineNumber,
          1,
          variableName.length + 1,
          `字段路径 "${variableName}" 无效：变量 "${rootName}" 不包含指定的字段`,
          `请检查对象类型 "${rootName}" 的字段声明。字段路径使用 "." 分隔。`,
        ),
      );
    } else {
      // 不应到达此处（rootVar 已通过检查）
      errors.push(
        createDiagnostic(
          'E002',
          lineNumber,
          1,
          variableName.length + 1,
          `变量 "${variableName}" 未在 Frontmatter 中声明`,
        ),
      );
    }
    return null;
  }

  const varType = resolved.type;
  const enumValues = resolved.enumValues;

  // ------------------------------------------------------------------
  // 步骤 3: 验证操作-类型兼容性
  // ------------------------------------------------------------------

  const operation = OPERATOR_TO_OPERATION[operatorChar]!;

  const typeCompatibilityError = validateOperationType(
    operation,
    varType,
    lineNumber,
  );
  if (typeCompatibilityError) {
    errors.push(typeCompatibilityError);
    return null;
  }

  // ------------------------------------------------------------------
  // 步骤 4: 类型感知的值解析
  // ------------------------------------------------------------------

  const valueResult = parseValueByType(rawValue, varType, lineNumber);
  if (!valueResult.ok) {
    errors.push(valueResult.diagnostic);
    return null;
  }

  // ------------------------------------------------------------------
  // 步骤 5: 枚举值验证（E003）
  // ------------------------------------------------------------------

  if (varType === 'enum' && enumValues) {
    const strValue = String(valueResult.value);
    if (!enumValues.includes(strValue)) {
      errors.push(
        createDiagnostic(
          'E003',
          lineNumber,
          1,
          raw.length,
          `枚举值 "${strValue}" 不在合法值列表中: [${enumValues.join(', ')}]`,
          `请使用以下合法值之一: ${enumValues.join(', ')}。`,
        ),
      );
      return null;
    }
  }

  // ------------------------------------------------------------------
  // 步骤 6: 值类型二次校验
  // ------------------------------------------------------------------

  // 确保解析出的 JS 值类型与变量声明类型一致
  const actualJsType = typeof valueResult.value;
  const expectedJsType = varTypeToJsType(varType);
  if (actualJsType !== expectedJsType) {
    errors.push(
      createDiagnostic(
        'E004',
        lineNumber,
        1,
        rawValue.length,
        `类型不匹配：变量 "${variableName}" 声明为 ${varType} 类型，但值为 ${actualJsType} 类型`,
        `期望 ${expectedJsType}，实际为 ${actualJsType}。`,
      ),
    );
    return null;
  }

  // ------------------------------------------------------------------
  // 步骤 7: 组装 SideEffect
  // ------------------------------------------------------------------

  return {
    variableName,
    operation,
    value: valueResult.value,
    lineNumber,
  };
}

/**
 * 将 VariableType 映射为对应的 JavaScript typeof 结果。
 */
function varTypeToJsType(t: VariableType): string {
  switch (t) {
    case 'int':
    case 'float':
      return 'number';
    case 'bool':
      return 'boolean';
    case 'string':
    case 'enum':
      return 'string';
    case 'object':
      return 'object';
    default:
      return 'string';
  }
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 将效果文本解析为 SideEffect 数组。
 *
 * 支持语法：
 * - 赋值：`$变量=值` → { operation: 'set', value: ... }
 * - 增加：`$变量+值` → { operation: 'add', value: ... }
 * - 减少：`$变量-值` → { operation: 'subtract', value: ... }
 * - 追加：`$变量←值` → { operation: 'append', value: ... }
 *
 * 多个效果以逗号（`,` 或 `，`）分隔。
 * 字段访问：`$对象.字段=值`（支持点分隔的嵌套字段路径）。
 *
 * 验证规则：
 * - 未声明变量 → E002
 * - 枚举值不在合法列表中 → E003
 * - 类型不匹配 → E004
 * - 语法格式错误 → E005
 *
 * @param raw - 效果列表原始文本（来自 Option.effectsRaw，已剥离外围括号）
 * @param variables - Frontmatter 中声明的变量列表
 * @param lineNumber - 效果子行在源文件中的行号（1-based，默认 0 表示未知）
 * @returns ParseResult\<SideEffect[]\>
 *   - ok: true 时携带解析出的副作用列表（可能为空数组）
 *   - ok: false 时携带所有诊断错误
 *
 * @remarks
 * - raw 为 null 或空字符串 → 返回空数组（不报错）
 * - 效果间分隔逗号在字符串字面量内不会被当作分隔符
 * - 纯函数实现，不抛异常
 *
 * @example
 * ```typescript
 * // 单个效果
 * parseEffects('好感度+3', variables)
 * // → [{ variableName: '好感度', operation: 'add', value: 3 }]
 *
 * // 多个混合效果
 * parseEffects("好感度+3, 金币-10, 武器='长剑'", variables)
 * // → [
 * //   { variableName: '好感度', operation: 'add', value: 3 },
 * //   { variableName: '金币', operation: 'subtract', value: 10 },
 * //   { variableName: '武器', operation: 'set', value: '长剑' },
 * // ]
 * ```
 */
export function parseEffects(
  raw: string | null,
  variables: readonly VariableDeclaration[],
  lineNumber: number = 0,
): ParseResult<SideEffect[]> {
  resetErrorSeq();

  // raw 为 null 或空字符串 → 返回空数组
  if (raw === null || raw.trim().length === 0) {
    return success([]);
  }

  // 长度检查
  if ([...raw].length > MAX_EFFECT_LENGTH) {
    return failure([
      createDiagnostic(
        'E005',
        lineNumber,
        1,
        [...raw].length,
        `效果表达式过长（${[...raw].length} > ${MAX_EFFECT_LENGTH} 个 Unicode 码点）`,
        `请将过长效果拆分为多个效果子行。`,
      ),
    ] as readonly Diagnostic[]);
  }

  // 构建变量查找映射
  const variableMap = buildVariableMap(variables);

  // 分割为单个效果表达式
  const effectExprs = splitEffects(raw);

  const errors: Diagnostic[] = [];

  if (effectExprs.length === 0) {
    // 分割后无有效表达式（如仅为空白或逗号）
    errors.push(
      createDiagnostic(
        'E005',
        lineNumber,
        1,
        raw.length,
        '效果列表为空或格式无效',
        '格式应为 "$变量名操作符值"（多个效果以逗号分隔）。',
      ),
    );
    return failure(errors as readonly Diagnostic[]);
  }

  // 解析每个效果表达式
  const sideEffects: SideEffect[] = [];

  for (const expr of effectExprs) {
    const effect = parseOneEffect(expr, variableMap, lineNumber, errors);
    if (effect) {
      sideEffects.push(effect);
    }
  }

  // 结果判断：有错误则失败
  if (errors.length > 0) {
    return failure(errors as readonly Diagnostic[]);
  }

  return success(sideEffects);
}
