/**
 * 条件表达式解析器 — M1-04
 *
 * @packageDocumentation
 * @remarks
 * 将条件文本 `conditionRaw` 解析为 ConditionNode AST。
 * 采用递归下降解析器，支持比较运算、逻辑运算、字段访问。
 *
 * 对应规范：
 * - spec/syntax-formal.md §5 (条件表达式)
 * - spec/syntax-formal.md §8 (歧义消解规则)
 * - spec/syntax-formal.md §10.2 BC17-BC18 (E002), BC20 (E004), BC24 (E005)
 *
 * 纯函数实现，所有错误通过 ParseResult 模式返回，不抛异常。
 *
 * @version 0.1.0
 */

import type { ParseResult } from '../result.js';
import { success, failure } from '../result.js';
import type {
  ConditionNode,
  ComparisonExpression,
  Operand,
  VariableDeclaration,
  VariableType,
  VariableValue,
  ComparisonOperator,
  LogicalOperator,
} from '../types/ast.js';
import type { Diagnostic, ErrorCode } from '../types/diagnostic.js';
import { createDiagnosticLocalization, DIAGNOSTIC_MESSAGES } from '../types/diagnostic.js';

// ============================================================================
// 常量
// ============================================================================

/** 条件表达式最大长度（Unicode 码点） */
const MAX_CONDITION_LENGTH = 2048;

/** 逻辑运算符最大嵌套深度 */
const MAX_LOGICAL_DEPTH = 3;

/** 逻辑关键字集合 */
const LOGIC_KEYWORDS = new Set(['AND', 'OR', 'NOT']);

/** 比较运算符集合 */
const COMPARISON_OPS = new Set(['==', '!=', '>=', '<=', '>', '<']);

// ============================================================================
// Token 类型定义（内部）
// ============================================================================

type CondTokenKind = 'VARIABLE' | 'LITERAL' | 'OP_COMPARE' | 'OP_LOGIC' | 'LPAREN' | 'RPAREN';

interface CondToken {
  readonly kind: CondTokenKind;
  readonly value: string;
  /** 在原始字符串中的起始位置（0-based 码点索引） */
  readonly position: number;
  /** Token 文本长度（Unicode 码点数） */
  readonly length: number;
}

// ============================================================================
// 解析上下文
// ============================================================================

interface ParseCtx {
  readonly tokens: readonly CondToken[];
  pos: number;
  readonly errors: Diagnostic[];
  readonly variableMap: Map<string, VariableDeclaration>;
  /** 条件表达式所在源文件行号（1-based，0 表示未知） */
  readonly lineNumber: number;
}

// ============================================================================
// 诊断创建辅助
// ============================================================================

let errorSeq = 0;

function resetErrorSeq(): void {
  errorSeq = 0;
}

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
    ...createDiagnosticLocalization(code),
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
// Tokenizer
// ============================================================================

/**
 * 将条件表达式原始文本拆分为 Token 序列。
 *
 * 识别的 Token 类型：
 * - `$变量名` 或 `$变量.字段.子字段` → VARIABLE
 * - 数字、字符串、布尔值、枚举标识符 → LITERAL
 * - `==` `!=` `>=` `<=` `>` `<` → OP_COMPARE
 * - `AND` `OR` `NOT` → OP_LOGIC
 * - `(` → LPAREN
 * - `)` → RPAREN
 *
 * @param raw - 条件表达式原始文本
 * @returns Token 列表和词法错误列表
 */
function tokenize(raw: string): { tokens: CondToken[]; errors: Diagnostic[] } {
  const tokens: CondToken[] = [];
  const errors: Diagnostic[] = [];
  const chars = [...raw]; // Unicode 码点数组
  let i = 0;

  while (i < chars.length) {
    const ch = chars[i]!;

    // 空白字符 → 跳过
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    // 括号
    if (ch === '(') {
      tokens.push({ kind: 'LPAREN', value: '(', position: i, length: 1 });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'RPAREN', value: ')', position: i, length: 1 });
      i++;
      continue;
    }

    // 变量引用：$ 开头
    if (ch === '$') {
      const start = i;
      i++; // 跳过 $

      // 解析变量名（标识符）
      if (i >= chars.length || !isIdentifierStart(chars[i]!)) {
        errors.push(
          createDiagnostic(
            'E005',
            0,
            start + 1,
            i + 1,
            `"$" 后缺少有效的变量名`,
            '变量引用格式应为 "$变量名" 或 "$变量名.字段名"',
          ),
        );
        continue;
      }

      // 解析标识符 + 可选 .field 链
      while (i < chars.length && isIdentifierPart(chars[i]!)) {
        i++;
      }
      // 解析字段访问链 .field.subfield
      while (i < chars.length && chars[i] === '.') {
        i++; // 跳过 .
        if (i >= chars.length || !isIdentifierStart(chars[i]!)) {
          errors.push(
            createDiagnostic(
              'E005',
              0,
              start + 1,
              i + 1,
              `"." 后缺少有效的字段名`,
              '字段访问格式应为 "$变量名.字段名"',
            ),
          );
          break;
        }
        while (i < chars.length && isIdentifierPart(chars[i]!)) {
          i++;
        }
      }

      const value = chars.slice(start, i).join('');
      tokens.push({ kind: 'VARIABLE', value, position: start, length: i - start });
      continue;
    }

    // 字符串字面量：'...' 或 "..."
    if (ch === "'" || ch === '"') {
      const quote = ch;
      const start = i;
      i++; // 跳过开始引号
      let escaped = false;
      while (i < chars.length) {
        const c = chars[i]!;
        if (escaped) {
          escaped = false;
          i++;
          continue;
        }
        if (c === '\\') {
          escaped = true;
          i++;
          continue;
        }
        if (c === quote) {
          i++; // 跳过结束引号
          break;
        }
        i++;
      }
      const value = chars.slice(start, i).join('');
      tokens.push({ kind: 'LITERAL', value, position: start, length: i - start });
      continue;
    }

    // 比较运算符：>= <= == != > <
    // 双字符优先于单字符（最长匹配）
    if (i + 1 < chars.length) {
      const twoChar = ch + chars[i + 1]!;
      if (COMPARISON_OPS.has(twoChar)) {
        tokens.push({ kind: 'OP_COMPARE', value: twoChar, position: i, length: 2 });
        i += 2;
        continue;
      }
    }
    if (ch === '>' || ch === '<') {
      tokens.push({ kind: 'OP_COMPARE', value: ch, position: i, length: 1 });
      i++;
      continue;
    }
    // = 单独出现不是有效运算符（== 已在上面处理）
    if (ch === '=') {
      // 检查是否 == (但已经过了双字符检查，这里 = 是单独的)
      // 单独的 = 在条件表达式中无效
      errors.push(
        createDiagnostic(
          'E005',
          0,
          i + 1,
          i + 1,
          `无效的运算符 "="，条件表达式中应使用 "==" 进行比较`,
          '请使用 "==" 替代 "="',
        ),
      );
      i++;
      continue;
    }
    // ! 单独出现（不是 !=）也无效
    if (ch === '!') {
      if (i + 1 < chars.length && chars[i + 1] === '=') {
        // != 已在上面双字符检查中处理
        // 理论上不应到达这里，但作为防御
        tokens.push({ kind: 'OP_COMPARE', value: '!=', position: i, length: 2 });
        i += 2;
        continue;
      }
      errors.push(
        createDiagnostic(
          'E005',
          0,
          i + 1,
          i + 1,
          `无效的运算符 "!"，条件表达式中应使用 "!=" 进行比较`,
          '请使用 "!=" 替代 "!"',
        ),
      );
      i++;
      continue;
    }

    // 数字字面量：整数或浮点数（支持负数）
    if (isDigit(ch) || (ch === '-' && i + 1 < chars.length && isDigit(chars[i + 1]!))) {
      const start = i;
      if (chars[i] === '-') i++;
      while (i < chars.length && isDigit(chars[i]!)) {
        i++;
      }
      // 小数部分
      if (i < chars.length && chars[i] === '.' && i + 1 < chars.length && isDigit(chars[i + 1]!)) {
        i++; // 跳过 .
        while (i < chars.length && isDigit(chars[i]!)) {
          i++;
        }
      }
      const value = chars.slice(start, i).join('');
      tokens.push({ kind: 'LITERAL', value, position: start, length: i - start });
      continue;
    }

    // 标识符（关键字或枚举字面量）
    if (isIdentifierStart(ch)) {
      const start = i;
      while (i < chars.length && isIdentifierPart(chars[i]!)) {
        i++;
      }
      const value = chars.slice(start, i).join('');

      if (LOGIC_KEYWORDS.has(value.toUpperCase())) {
        tokens.push({ kind: 'OP_LOGIC', value: value.toUpperCase(), position: start, length: i - start });
      } else {
        tokens.push({ kind: 'LITERAL', value, position: start, length: i - start });
      }
      continue;
    }

    // 无法识别的字符
    errors.push(
      createDiagnostic(
        'E005',
        0,
        i + 1,
        i + 1,
        `条件表达式中出现无法识别的字符: "${ch}"`,
        '请检查表达式语法',
      ),
    );
    i++;
  }

  return { tokens, errors };
}

// ============================================================================
// 字符分类辅助
// ============================================================================

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isLetter(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z');
}

function isChineseChar(ch: string): boolean {
  const cp = ch.codePointAt(0);
  if (cp === undefined) return false;
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x3000 && cp <= 0x303f)
  );
}

function isIdentifierStart(ch: string): boolean {
  return isLetter(ch) || isChineseChar(ch) || ch === '_';
}

function isIdentifierPart(ch: string): boolean {
  return isLetter(ch) || isChineseChar(ch) || isDigit(ch) || ch === '_';
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 从变量声明列表中构建名称→声明的快速查找映射。
 * 仅映射顶层变量（非嵌套字段），嵌套字段通过 resolveFieldPath 查找。
 */
function buildVariableMap(variables: readonly VariableDeclaration[]): Map<string, VariableDeclaration> {
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
    const next: VariableDeclaration | undefined = current.fields.find((f: VariableDeclaration) => f.name === fieldName);
    if (!next) return null;
    current = next;
  }

  return current;
}

/**
 * 将字面量 Token 的原始值解析为 VariableValue。
 */
function parseLiteralValue(raw: string): VariableValue {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    const inner = raw.slice(1, -1);
    // 处理转义
    return inner.replace(/\\(['"\\ntr0])/g, (_m, c) => {
      switch (c) {
        case 'n': return '\n';
        case 't': return '\t';
        case 'r': return '\r';
        case '0': return '\0';
        default: return c;
      }
    });
  }
  if (raw.includes('.')) return parseFloat(raw);
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  return raw; // 标识符 → 原样返回
}

/**
 * 剥离外围匹配的括号。
 *
 * 仅当首字符为 `(` 且末字符为 `)` 且两者正确匹配时剥离。
 * 使用括号计数法验证匹配。
 */
function stripOuterParens(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')') || trimmed.length < 2) {
    return trimmed;
  }

  const inner = trimmed.slice(1, -1);
  let depth = 0;
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) return trimmed; // 内部有未匹配的 )，说明最外层括号不配对
  }
  // depth === 0 表示所有内层括号正确匹配，最外层确实是一对
  if (depth === 0) return inner;
  return trimmed;
}

/**
 * 检查两个类型是否兼容（可用于 == 或 != 比较）。
 */
function areTypesCompatible(a: VariableType, b: VariableType): boolean {
  if (a === b) return true;
  // int 和 float 可以互相比较
  if ((a === 'int' || a === 'float') && (b === 'int' || b === 'float')) return true;
  // enum 值与 string 比较是合法的（enum 值本质上就是字符串）
  if ((a === 'enum' && b === 'string') || (a === 'string' && b === 'enum')) return true;
  return false;
}

/**
 * 检查类型是否可用于数值比较（>= <= > <）。
 */
function isNumericType(t: VariableType): boolean {
  return t === 'int' || t === 'float';
}

// ============================================================================
// 递归下降解析器
// ============================================================================

/**
 * 获取当前 Token，若已到达末尾返回 null。
 */
function currentToken(ctx: ParseCtx): CondToken | null {
  if (ctx.pos >= ctx.tokens.length) return null;
  return ctx.tokens[ctx.pos]!;
}

/**
 * 消耗当前 Token 并前进。
 */
function advance(ctx: ParseCtx): CondToken | null {
  const tok = currentToken(ctx);
  if (tok) ctx.pos++;
  return tok;
}

/**
 * 期望当前 Token 为指定类型，返回该 Token 否则报错。
 */
function expect(ctx: ParseCtx, kind: CondTokenKind, errorMsg?: string): CondToken | null {
  const tok = currentToken(ctx);
  if (!tok) {
    ctx.errors.push(
      createDiagnostic(
        'E005',
        ctx.lineNumber,
        1,
        1,
        errorMsg ?? `表达式不完整：缺少 ${kind} token`,
      ),
    );
    return null;
  }
  if (tok.kind !== kind) {
    ctx.errors.push(
      createDiagnostic(
        'E005',
        ctx.lineNumber,
        tok.position + 1,
        tok.position + tok.length,
        errorMsg ?? `语法错误：期望 "${kind}"，实际是 "${tok.value}"`,
      ),
    );
    return null;
  }
  return advance(ctx)!;
}

// --------------------------------------------------------------------------
// parseOperand — 解析单个操作数
// --------------------------------------------------------------------------

/**
 * 解析操作数：变量引用或字面量。
 *
 * @returns Operand 或 null（解析失败时）
 */
function parseOperand(ctx: ParseCtx): Operand | null {
  const tok = currentToken(ctx);
  if (!tok) {
    ctx.errors.push(
      createDiagnostic('E005', ctx.lineNumber, 1, 1, '表达式不完整：缺少操作数'),
    );
    return null;
  }

  if (tok.kind === 'VARIABLE') {
    advance(ctx);
    // value 形如 "$角色状态.魔力" → variableName = "角色状态.魔力"
    const variableName = tok.value.slice(1); // 去掉 $ 前缀
    return { operandType: 'variable', variableName };
  }

  if (tok.kind === 'LITERAL') {
    advance(ctx);
    const literalValue = parseLiteralValue(tok.value);
    return { operandType: 'literal', literalValue };
  }

  ctx.errors.push(
    createDiagnostic(
      'E005',
      ctx.lineNumber,
      tok.position + 1,
      tok.position + tok.length,
      `语法错误：期望变量引用或字面量，实际是 "${tok.value}"`,
    ),
  );
  advance(ctx); // 跳过错误 Token 继续解析
  return null;
}

// --------------------------------------------------------------------------
// parseComparison — 解析比较表达式
// --------------------------------------------------------------------------

/**
 * 解析比较表达式：`Operand CompOp Operand`
 *
 * @returns ComparisonExpression 或 null（解析失败时）
 */
function parseComparison(ctx: ParseCtx): ComparisonExpression | null {
  const startPos = ctx.pos;

  const left = parseOperand(ctx);
  if (!left) return null;

  const opTok = currentToken(ctx);
  if (!opTok || opTok.kind !== 'OP_COMPARE') {
    // 回退：这不是比较表达式，可能是在逻辑表达式中
    ctx.pos = startPos;
    return null;
  }
  advance(ctx);
  const operator = opTok.value as ComparisonOperator;

  const right = parseOperand(ctx);
  if (!right) {
    ctx.errors.push(
      createDiagnostic(
        'E005',
        ctx.lineNumber,
        opTok.position + 1,
        opTok.position + opTok.length,
        `比较运算符 "${operator}" 后缺少右操作数`,
      ),
    );
    return null;
  }

  return { type: 'comparison', left, operator, right };
}

// --------------------------------------------------------------------------
// parsePrimary — 解析基本表达式
// --------------------------------------------------------------------------

/**
 * 解析基本表达式：括号子表达式 或 比较表达式。
 *
 * @param parenDepth - 当前括号嵌套深度（用于 E006 检测）
 */
function parsePrimary(ctx: ParseCtx, parenDepth: number): ConditionNode | null {
  const tok = currentToken(ctx);
  if (!tok) {
    ctx.errors.push(
      createDiagnostic('E005', ctx.lineNumber, 1, 1, '表达式不完整'),
    );
    return null;
  }

  // 括号子表达式
  if (tok.kind === 'LPAREN') {
    advance(ctx); // 跳过 (
    const inner = parseOr(ctx, parenDepth + 1);
    if (!inner) return null;

    const closeParen = expect(ctx, 'RPAREN', '缺少右括号 ")"');
    if (!closeParen) {
      // 即使缺少 ) 也返回已解析的内容（容错）
      return inner;
    }
    return inner;
  }

  // 比较表达式
  const comp = parseComparison(ctx);
  if (!comp) {
    // parseComparison 失败，尝试吃掉一个 token 继续向前
    const badTok = currentToken(ctx);
    if (badTok) {
      ctx.errors.push(
        createDiagnostic(
          'E005',
          ctx.lineNumber,
          badTok.position + 1,
          badTok.position + badTok.length,
          `语法错误：期望表达式，实际是 "${badTok.value}"`,
        ),
      );
      advance(ctx);
    }
    return null;
  }
  return comp;
}

// --------------------------------------------------------------------------
// parseNot — 解析 NOT 表达式
// --------------------------------------------------------------------------

/**
 * 解析 NOT 表达式：`NOT` 后跟基本表达式。
 *
 * @param parenDepth - 当前括号嵌套深度
 */
function parseNot(ctx: ParseCtx, parenDepth: number): ConditionNode | null {
  const tok = currentToken(ctx);
  if (tok && tok.kind === 'OP_LOGIC' && tok.value === 'NOT') {
    advance(ctx); // 跳过 NOT
    const operand = parseNot(ctx, parenDepth);
    if (!operand) {
      ctx.errors.push(
        createDiagnostic(
          'E005',
          ctx.lineNumber,
          tok.position + 1,
          tok.position + tok.length,
          '"NOT" 后缺少表达式',
        ),
      );
      return null;
    }
    return {
      type: 'logical',
      operator: 'NOT' as LogicalOperator,
      operands: [operand],
    };
  }

  return parsePrimary(ctx, parenDepth);
}

// --------------------------------------------------------------------------
// parseAnd — 解析 AND 表达式
// --------------------------------------------------------------------------

/**
 * 解析 AND 表达式：`NotExpression { "AND" NotExpression }`
 *
 * AND 优先级高于 OR，左结合。
 *
 * @param parenDepth - 当前括号嵌套深度
 */
function parseAnd(ctx: ParseCtx, parenDepth: number): ConditionNode | null {
  const left = parseNot(ctx, parenDepth);
  if (!left) return null;

  const operands: ConditionNode[] = [left];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tok = currentToken(ctx);
    if (!tok || tok.kind !== 'OP_LOGIC' || tok.value !== 'AND') break;

    // E006 检测：逻辑运算符嵌套深度
    const logicalDepth = parenDepth + 1;
    if (logicalDepth > MAX_LOGICAL_DEPTH) {
      ctx.errors.push(
        createDiagnostic(
          'E006',
          ctx.lineNumber,
          tok.position + 1,
          tok.position + tok.length,
          `逻辑运算符 "AND" 嵌套深度 ${logicalDepth} 超过最大限制 ${MAX_LOGICAL_DEPTH} 层`,
          `请简化条件表达式，将部分逻辑拆分到多个选项中。`,
        ),
      );
    }

    advance(ctx); // 跳过 AND
    const right = parseNot(ctx, parenDepth);
    if (!right) {
      ctx.errors.push(
        createDiagnostic(
          'E005',
          ctx.lineNumber,
          tok.position + 1,
          tok.position + tok.length,
          '"AND" 后缺少表达式',
        ),
      );
      break;
    }
    operands.push(right);
  }

  if (operands.length === 1) return operands[0]!;

  return {
    type: 'logical',
    operator: 'AND' as LogicalOperator,
    operands,
  };
}

// --------------------------------------------------------------------------
// parseOr — 解析 OR 表达式（入口）
// --------------------------------------------------------------------------

/**
 * 解析 OR 表达式：`AndExpression { "OR" AndExpression }`
 *
 * OR 优先级最低，左结合。这是条件表达式的顶层入口。
 *
 * @param parenDepth - 当前括号嵌套深度
 */
function parseOr(ctx: ParseCtx, parenDepth: number): ConditionNode | null {
  const left = parseAnd(ctx, parenDepth);
  if (!left) return null;

  const operands: ConditionNode[] = [left];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const tok = currentToken(ctx);
    if (!tok || tok.kind !== 'OP_LOGIC' || tok.value !== 'OR') break;

    // E006 检测
    const logicalDepth = parenDepth + 1;
    if (logicalDepth > MAX_LOGICAL_DEPTH) {
      ctx.errors.push(
        createDiagnostic(
          'E006',
          ctx.lineNumber,
          tok.position + 1,
          tok.position + tok.length,
          `逻辑运算符 "OR" 嵌套深度 ${logicalDepth} 超过最大限制 ${MAX_LOGICAL_DEPTH} 层`,
          `请简化条件表达式，将部分逻辑拆分到多个选项中。`,
        ),
      );
    }

    advance(ctx); // 跳过 OR
    const right = parseAnd(ctx, parenDepth);
    if (!right) {
      ctx.errors.push(
        createDiagnostic(
          'E005',
          ctx.lineNumber,
          tok.position + 1,
          tok.position + tok.length,
          '"OR" 后缺少表达式',
        ),
      );
      break;
    }
    operands.push(right);
  }

  if (operands.length === 1) return operands[0]!;

  return {
    type: 'logical',
    operator: 'OR' as LogicalOperator,
    operands,
  };
}

// ============================================================================
// 验证器 — AST 后序遍历类型检查
// ============================================================================

/**
 * 遍历 ConditionNode AST 并收集类型/引用错误。
 *
 * 检查项：
 * - E002：变量未在 Frontmatter 中声明
 * - E004：比较运算符两侧类型不匹配
 *
 * @param node - 条件 AST 根节点
 * @param variableMap - 变量名→声明映射
 * @param lineNumber - 源文件行号
 * @returns 诊断错误列表
 */
function validateAST(
  node: ConditionNode,
  variableMap: Map<string, VariableDeclaration>,
  lineNumber: number,
): Diagnostic[] {
  const errors: Diagnostic[] = [];

  function walk(n: ConditionNode): void {
    if (n.type === 'comparison') {
      validateComparisonOperand(n.left, n, errors, variableMap, lineNumber);
      validateComparisonOperand(n.right, n, errors, variableMap, lineNumber);
      validateComparisonTypes(n, errors, variableMap, lineNumber);
    } else if (n.type === 'logical') {
      for (const operand of n.operands) {
        walk(operand);
      }
    }
  }

  walk(node);
  return errors;
}

/**
 * 验证操作数中引用的变量是否已声明。
 */
function validateComparisonOperand(
  operand: Operand,
  _parent: ComparisonExpression,
  errors: Diagnostic[],
  variableMap: Map<string, VariableDeclaration>,
  lineNumber: number,
): void {
  if (operand.operandType !== 'variable' || !operand.variableName) return;

  const resolved = resolveFieldPath(operand.variableName, variableMap);
  if (!resolved) {
    // 检查根变量是否存在
    const rootName = operand.variableName.split('.')[0]!;
    const rootVar = variableMap.get(rootName);
    if (!rootVar) {
      errors.push(
        createDiagnostic(
          'E002',
          lineNumber,
          1,
          operand.variableName.length + 1,
          `变量 "${rootName}" 未在 Frontmatter 中声明`,
          `请在 Frontmatter 的 vars: 块中声明此变量。`,
        ),
      );
    } else {
      // 根变量存在但字段路径无效
      errors.push(
        createDiagnostic(
          'E004',
          lineNumber,
          1,
          operand.variableName.length + 1,
          `字段路径 "${operand.variableName}" 无效：变量 "${rootName}" 不包含指定字段`,
          `请检查对象类型 "${rootName}" 的字段声明。`,
        ),
      );
    }
  }
}

/**
 * 验证比较运算符两侧类型是否兼容。
 */
function validateComparisonTypes(
  node: ComparisonExpression,
  errors: Diagnostic[],
  variableMap: Map<string, VariableDeclaration>,
  lineNumber: number,
): void {
  const leftType = resolveOperandType(node.left, variableMap);
  const rightType = resolveOperandType(node.right, variableMap);

  if (!leftType || !rightType) return; // E002 已在 validateComparisonOperand 中报告

  const op = node.operator;

  // 数值比较运算符只能用于 int/float
  if (op === '>=' || op === '<=' || op === '>' || op === '<') {
    if (!isNumericType(leftType)) {
      errors.push(
        createDiagnostic(
          'E004',
          lineNumber,
          1,
          1,
          `比较运算符 "${op}" 要求数值类型，但左操作数类型为 "${leftType}"`,
          `"${op}" 只能用于 int 或 float 类型。`,
        ),
      );
      return;
    }
    if (!isNumericType(rightType)) {
      // 如果右侧是 enum 字面量，提供更具体的错误信息
      const rightOperand = node.right;
      const detail =
        rightOperand.operandType === 'literal' && typeof rightOperand.literalValue === 'string'
          ? `"${op}" 只能用于 int 或 float 类型，但右侧是字符串/枚举值。`
          : `"${op}" 只能用于 int 或 float 类型，但右操作数类型为 "${rightType}"。`;
      errors.push(
        createDiagnostic('E004', lineNumber, 1, 1, detail),
      );
      return;
    }
    return;
  }

  // == 和 !=：两侧类型必须兼容
  if (op === '==' || op === '!=') {
    if (!areTypesCompatible(leftType, rightType)) {
      // enum vs non-enum 的特殊情况
      if (leftType === 'enum' || rightType === 'enum') {
        // 尝试在 enum 值列表中查找
        const enumSide = leftType === 'enum' ? node.left : node.right;
        const otherSide = leftType === 'enum' ? node.right : node.left;

        if (enumSide.operandType === 'variable' && enumSide.variableName) {
          const resolved = resolveFieldPath(enumSide.variableName, variableMap);
          if (resolved && resolved.enumValues && otherSide.operandType === 'literal') {
            const literalVal = otherSide.literalValue;
            if (typeof literalVal === 'string' && !resolved.enumValues.includes(literalVal)) {
              // 这是 E003 非法枚举值的范畴，但条件解析器中只报 E004
              // 实际的 E003 由 M3 验证器统一检查
            }
          }
        }
      }

      errors.push(
        createDiagnostic(
          'E004',
          lineNumber,
          1,
          1,
          `比较运算符 "${op}" 两侧类型不兼容：左侧类型 "${leftType}"，右侧类型 "${rightType}"`,
          `${leftType} 类型与 ${rightType} 类型无法进行比较。`,
        ),
      );
    }
  }
}

/**
 * 解析操作数的类型。
 *
 * 对于变量引用：通过变量声明查找
 * 对于字面量：通过字面量值推断
 * 对于 enum 字面量：需要与另一侧变量声明的 enum 值进行交叉验证
 */
function resolveOperandType(
  operand: Operand,
  variableMap: Map<string, VariableDeclaration>,
): VariableType | null {
  if (operand.operandType === 'variable' && operand.variableName) {
    const resolved = resolveFieldPath(operand.variableName, variableMap);
    return resolved?.type ?? null;
  }

  if (operand.operandType === 'literal') {
    const val = operand.literalValue;
    if (val === undefined || val === null) return null;
    if (typeof val === 'boolean') return 'bool';
    if (typeof val === 'number') {
      return Number.isInteger(val) ? 'int' : 'float';
    }
    if (typeof val === 'string') {
      // 字面量字符串 → string 类型（即使在 enum 上下文中也可能合法，由 E003 单独检查）
      return 'string';
    }
    return null; // object 字面量不出现在条件中
  }

  return null;
}

// ============================================================================
// 公共 API
// ============================================================================

/**
 * 将条件表达式原始文本解析为 ConditionNode AST。
 *
 * 支持语法：
 * - 比较运算：`$变量 == 值`, `$变量 != 值`, `$变量 > 值`, `$变量 < 值`, `$变量 >= 值`, `$变量 <= 值`
 * - 逻辑运算：`(A) AND (B)`, `(A) OR (B)`, `NOT (A)`
 * - 字段访问：`$角色.属性.子属性`（支持 object 嵌套）
 * - 嵌套 AND/OR：最大深度 3 层（超限报 E006）
 *
 * 验证规则：
 * - 未声明变量 → E002
 * - 类型不匹配 → E004
 * - 语法错误 → E005
 * - 嵌套深度超限 → E006
 *
 * @param raw - 条件表达式原始文本（来自 Option.conditionRaw）
 * @param variables - Frontmatter 中声明的变量列表
 * @param lineNumber - 条件子行在源文件中的行号（1-based，默认 0 表示未知）
 * @returns ParseResult\<ConditionNode | null\>
 *   - ok: true 时携带解析出的条件 AST（raw 为空时返回 null）
 *   - ok: false 时携带所有诊断错误
 *
 * @remarks
 * - raw 为 null 或空字符串 → 返回 null（无条件）
 * - 表达式外围 `(...)` 会被自动剥离再解析
 * - 采用递归下降解析器，纯函数实现，不抛异常
 */
export function parseCondition(
  raw: string | null,
  variables: readonly VariableDeclaration[],
  lineNumber: number = 0,
): ParseResult<ConditionNode | null> {
  resetErrorSeq();

  // raw 为 null 或空字符串 → 无条件
  if (raw === null || raw.trim().length === 0) {
    return success(null);
  }

  // 长度检查
  if ([...raw].length > MAX_CONDITION_LENGTH) {
    return failure([
      createDiagnostic(
        'E005',
        lineNumber,
        1,
        [...raw].length,
        `条件表达式过长（${[...raw].length} > ${MAX_CONDITION_LENGTH} 个 Unicode 码点）`,
      ),
    ] as readonly Diagnostic[]);
  }

  // 剥离外围括号
  const expr = stripOuterParens(raw.trim());

  // Tokenize
  const { tokens, errors: tokenErrors } = tokenize(expr);

  // 合并词法错误
  const allErrors: Diagnostic[] = [...tokenErrors];

  if (tokens.length === 0) {
    if (allErrors.length > 0) {
      return failure(allErrors as readonly Diagnostic[]);
    }
    // 空 token 列表但无词法错误 → 表达式仅含空白（已在上面处理，此处防御）
    return success(null);
  }

  // 构建变量查找映射
  const variableMap = buildVariableMap(variables);

  // 递归下降解析
  const ctx: ParseCtx = {
    tokens,
    pos: 0,
    errors: allErrors,
    variableMap,
    lineNumber,
  };

  const ast = parseOr(ctx, 0);

  // 解析后仍有未消耗的 Token
  if (ast && ctx.pos < tokens.length) {
    const leftover = tokens[ctx.pos]!;
    ctx.errors.push(
      createDiagnostic(
        'E005',
        lineNumber,
        leftover.position + 1,
        leftover.position + leftover.length,
        `表达式末尾存在意外内容: "${leftover.value}"`,
      ),
    );
  }

  // AST 验证（E002/E004）
  if (ast) {
    const validationErrors = validateAST(ast, variableMap, lineNumber);
    ctx.errors.push(...validationErrors);
  }

  // 结果判断
  if (ctx.errors.length > 0) {
    // 如果解析出了 AST 但存在错误，根据容错策略仍返回成功（但带警告）
    // 根据 spec §10.5：条件表达式解析失败时，该条件被记为 parse_error
    // M1-04 阶段：如果有 AST 则容错返回，纯错误不返回 AST
    if (ast) {
      // 容错：有 AST 但存在验证错误
      // 返回成功但携带 AST——调用方可以根据 ValidationResult 检查
      // 这里我们遵循 ParseResult 模式：有 error 级别诊断就 failure
      const hasErrors = ctx.errors.some((d) => d.severity === 'error');
      if (hasErrors) {
        return failure(ctx.errors as readonly Diagnostic[]);
      }
      return success(ast);
    }
    return failure(ctx.errors as readonly Diagnostic[]);
  }

  return success(ast);
}
