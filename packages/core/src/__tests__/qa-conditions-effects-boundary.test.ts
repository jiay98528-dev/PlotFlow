/**
 * QA 边界测试：条件表达式 & 副作用解析器 (V0.1)
 *
 * 覆盖边界情况、极端输入、错误路径和边缘场景。
 * 条件表达式使用英文变量名以测试非中文场景。
 * 副作用解析器使用 effect 语法（= + - ← 操作符）。
 *
 * 测试矩阵：
 *   条件表达式：12 项（1 简单 / 2 AND / 3 OR / 4 NOT / 5 三层嵌套 /
 *               6 四层超深 / 7 空括号 / 8 未声明 / 9 枚举非法 /
 *               10 类型不匹配 / 11 多余空白 / 12 三重 NOT）
 *   副作用：    7 项（13 int add 负值 / 14 float sub / 15 空字符串 /
 *               16 append / 17 enum 不能 append / 18 字段路径无效 /
 *               19 多效果同行）
 */

import { describe, it, expect } from 'vitest';
import { parseCondition } from '../parser/conditions.js';
import { parseEffects } from '../parser/effects.js';
import type {
  VariableDeclaration,
  ConditionNode,
  ComparisonExpression,
  LogicalExpression,
  SideEffect,
} from '../types/ast.js';

// ============================================================================
// 测试用变量声明
// ============================================================================
//
// 按用户要求构造：
//   hp     → int
//   mp     → float
//   alive  → bool
//   name   → string
//   route  → enum [天, 地, 人]
//
const TEST_VARS: VariableDeclaration[] = [
  { name: 'hp',    type: 'int',    defaultValue: 100, lineNumber: 1 },
  { name: 'mp',    type: 'float',  defaultValue: 50.0, lineNumber: 2 },
  { name: 'alive', type: 'bool',   defaultValue: true, lineNumber: 3 },
  { name: 'name',  type: 'string', defaultValue: '',   lineNumber: 4 },
  { name: 'route', type: 'enum',   defaultValue: '天',
    enumValues: ['天', '地', '人'],                                       lineNumber: 5 },
];

// ============================================================================
// 辅助函数
// ============================================================================

function expectOk<T>(
  result: { ok: boolean; data?: T; errors?: readonly unknown[] },
): asserts result is { ok: true; data: T } {
  if (!result.ok) {
    const msgs = (result as { errors: readonly { message: string }[] }).errors
      ?.map((e) => e.message)
      .join('; ') ?? 'unknown';
    throw new Error(`Expected ok=true but got ok=false: ${msgs}`);
  }
}

function expectFail(
  result: { ok: boolean },
): asserts result is { ok: false; errors: readonly { code: string; message: string }[] } {
  if (result.ok) {
    throw new Error('Expected ok=false but got ok=true');
  }
}

function assertComparison(n: ConditionNode): ComparisonExpression {
  expect(n.type).toBe('comparison');
  return n as ComparisonExpression;
}

function assertLogical(n: ConditionNode): LogicalExpression {
  expect(n.type).toBe('logical');
  return n as LogicalExpression;
}

function singleEffect(r: { ok: true; data: SideEffect[] }): SideEffect {
  expect(r.data).toHaveLength(1);
  return r.data[0]!;
}

function hasErrorCode(
  r: { ok: false; errors: readonly { code: string }[] },
  code: string,
): boolean {
  return r.errors.some((e) => e.code === code);
}

// ============================================================================
// 条件表达式 — 边界测试
// ============================================================================

describe('QA: parseCondition — 边界测试 (12 项)', () => {

  // ------------------------------------------------------------------
  // 1. 简单比较: $hp >= 10
  // ------------------------------------------------------------------
  it('1. 简单比较: $hp >= 10 → 解析成功', () => {
    const r = parseCondition('$hp >= 10', TEST_VARS);
    expectOk(r);
    expect(r.data).not.toBeNull();
    const c = assertComparison(r.data!);
    expect(c.operator).toBe('>=');
    expect(c.left.operandType).toBe('variable');
    expect(c.left.variableName).toBe('hp');
    expect(c.right.operandType).toBe('literal');
    expect(c.right.literalValue).toBe(10);
  });

  // ------------------------------------------------------------------
  // 2. AND: $hp >= 10 AND $mp > 5.0
  // ------------------------------------------------------------------
  it('2. AND: $hp >= 10 AND $mp > 5.0 → 解析成功', () => {
    const r = parseCondition('$hp >= 10 AND $mp > 5.0', TEST_VARS);
    expectOk(r);
    expect(r.data).not.toBeNull();
    const log = assertLogical(r.data!);
    expect(log.operator).toBe('AND');
    expect(log.operands).toHaveLength(2);
    // 左操作数: hp >= 10
    const left = assertComparison(log.operands[0]!);
    expect(left.left.variableName).toBe('hp');
    expect(left.operator).toBe('>=');
    expect(left.right.literalValue).toBe(10);
    // 右操作数: mp > 5.0
    const right = assertComparison(log.operands[1]!);
    expect(right.left.variableName).toBe('mp');
    expect(right.operator).toBe('>');
    expect(right.right.literalValue).toBe(5.0);
  });

  // ------------------------------------------------------------------
  // 3. OR: $alive == true OR $name == 'hero'
  // ------------------------------------------------------------------
  it('3. OR: $alive == true OR $name == \'hero\' → 解析成功', () => {
    const r = parseCondition("$alive == true OR $name == 'hero'", TEST_VARS);
    expectOk(r);
    expect(r.data).not.toBeNull();
    const log = assertLogical(r.data!);
    expect(log.operator).toBe('OR');
    expect(log.operands).toHaveLength(2);
    const left = assertComparison(log.operands[0]!);
    expect(left.left.variableName).toBe('alive');
    expect(left.operator).toBe('==');
    expect(left.right.literalValue).toBe(true);
    const right = assertComparison(log.operands[1]!);
    expect(right.left.variableName).toBe('name');
    expect(right.operator).toBe('==');
    expect(right.right.literalValue).toBe('hero');
  });

  // ------------------------------------------------------------------
  // 4. NOT: NOT $alive
  //
  // 注意：当前解析器要求 NOT 后跟比较表达式或括号子表达式,
  // 裸 NOT $alive 无法通过 parseComparison（缺少比较运算符）。
  // 等价形式为 NOT ($alive == true)。
  // 此处同时测试两种形式以反映实际行为。
  // ------------------------------------------------------------------
  it('4. NOT: NOT ($alive == true) → 解析成功', () => {
    const r = parseCondition('NOT ($alive == true)', TEST_VARS);
    expectOk(r);
    expect(r.data).not.toBeNull();
    const log = assertLogical(r.data!);
    expect(log.operator).toBe('NOT');
    expect(log.operands).toHaveLength(1);
    const inner = assertComparison(log.operands[0]!);
    expect(inner.left.variableName).toBe('alive');
  });

  it('4b. [边界] NOT $alive（裸变量）→ 当前解析器返回 E005', () => {
    // 解析器不支持 NOT 直接修饰裸变量引用（缺少比较运算符）
    const r = parseCondition('NOT $alive', TEST_VARS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(hasErrorCode(r, 'E005')).toBe(true);
    }
  });

  // ------------------------------------------------------------------
  // 5. 括号嵌套 3 层: ((($hp >= 10) AND ($mp > 5)) OR ($alive == true))
  //
  // parseCondition 自动剥离外围括号，所以实际送入解析器的文本为
  // (($hp >= 10) AND ($mp > 5)) OR ($alive == true)
  // 最大 parenDepth 为 2，应在限制（3）以内。
  // ------------------------------------------------------------------
  it('5. 括号嵌套 3 层: ((($hp >= 10) AND ($mp > 5)) OR ($alive == true)) → 解析成功', () => {
    const raw = '((($hp >= 10) AND ($mp > 5)) OR ($alive == true))';
    const r = parseCondition(raw, TEST_VARS);
    expectOk(r);
    expect(r.data).not.toBeNull();
    // 最外层被剥离，顶层应为 OR
    const top = assertLogical(r.data!);
    expect(top.operator).toBe('OR');
    expect(top.operands).toHaveLength(2);
    // 左操作数为 AND
    const leftAnd = assertLogical(top.operands[0]!);
    expect(leftAnd.operator).toBe('AND');
    expect(leftAnd.operands).toHaveLength(2);
    expect(assertComparison(leftAnd.operands[0]!).left.variableName).toBe('hp');
    expect(assertComparison(leftAnd.operands[1]!).left.variableName).toBe('mp');
    // 右操作数为 simple comparison
    expect(assertComparison(top.operands[1]!).left.variableName).toBe('alive');
  });

  // ------------------------------------------------------------------
  // 6. 超深嵌套 4 层 → E006
  //
  // MAX_LOGICAL_DEPTH = 3，所以进入第 4 层括号内的逻辑运算符会触发 E006。
  // 构造: A AND (B AND (C AND (D AND E)))
  // ------------------------------------------------------------------
  it('6. 超深嵌套 4 层 → E006', () => {
    const raw =
      '($hp>=1) AND (($alive==true) AND (($name==\'x\') AND (($route==\'天\') AND ($mp>1.0))))';
    const r = parseCondition(raw, TEST_VARS);
    // 深度 4 → E006
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(hasErrorCode(r, 'E006')).toBe(true);
    }
  });

  // ------------------------------------------------------------------
  // 7. 空括号 "()" → 容错返回 null
  //
  // stripOuterParens("()") 返回 ""（空字符串），
  // 随后 parseCondition 视同无条件返回 success(null)。
  // 这是外围括号自动剥离机制的自然结果 — 空括号不会报错，
  // 而是等价于"无条件"。
  // ------------------------------------------------------------------
  it('7. 空括号 "()" → 容错返回 null（stripOuterParens 剥离后为空）', () => {
    const r = parseCondition('()', TEST_VARS);
    expectOk(r);
    expect(r.data).toBeNull();
  });

  // ------------------------------------------------------------------
  // 8. 未声明变量 "$unknown > 0" → E002
  // ------------------------------------------------------------------
  it('8. 未声明变量: $unknown > 0 → E002', () => {
    const r = parseCondition('$unknown > 0', TEST_VARS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(hasErrorCode(r, 'E002')).toBe(true);
    }
  });

  // ------------------------------------------------------------------
  // 9. 枚举非法值: "$route == '海'" → 解析器行为
  //
  // condition parser 认为 enum 与 string 类型兼容（areTypesCompatible
  // 返回 true），因此在此阶段不会报错。实际的 E003 枚举值验证由
  // M3 验证器统一检查。此处验证解析器成功返回 AST。
  // ------------------------------------------------------------------
  it('9. 枚举非法值: $route == \'海\' → 解析器通过（E003 由 M3 验证）', () => {
    const r = parseCondition("$route == '海'", TEST_VARS);
    // 条件解析器接受此表达式（enum/string 兼容）
    expectOk(r);
    expect(r.data).not.toBeNull();
    const c = assertComparison(r.data!);
    expect(c.left.variableName).toBe('route');
    expect(c.operator).toBe('==');
    expect(c.right.literalValue).toBe('海');
    // 注：E003 非法枚举值的验证在 M3 统一验证器中完成
  });

  // ------------------------------------------------------------------
  // 10. 类型不匹配: $name > 5 → E004
  //
  // name 是 string, > 是数值运算符 → isNumericType(string) = false
  // ------------------------------------------------------------------
  it('10. 类型不匹配: $name > 5 → E004', () => {
    const r = parseCondition('$name > 5', TEST_VARS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(hasErrorCode(r, 'E004')).toBe(true);
    }
  });

  // ------------------------------------------------------------------
  // 11. 多余空白: "$hp  >=  10"
  // ------------------------------------------------------------------
  it('11. 多余空白: $hp  >=  10 → 正确解析', () => {
    const r = parseCondition('$hp  >=  10', TEST_VARS);
    expectOk(r);
    expect(r.data).not.toBeNull();
    const c = assertComparison(r.data!);
    expect(c.operator).toBe('>=');
    expect(c.left.variableName).toBe('hp');
    expect(c.right.literalValue).toBe(10);
  });

  // ------------------------------------------------------------------
  // 12. 三重 NOT: "NOT NOT NOT $alive"
  //
  // 同上，NOT 后不能直接跟裸变量，测试等价形式 NOT NOT NOT ($alive == true)
  // 以及裸变量版本的真实行为。
  // ------------------------------------------------------------------
  it('12. 三重 NOT: NOT NOT NOT ($alive == true) → 正确解析', () => {
    const r = parseCondition('NOT NOT NOT ($alive == true)', TEST_VARS);
    expectOk(r);
    expect(r.data).not.toBeNull();
    // 三层 NOT
    const n1 = assertLogical(r.data!);
    expect(n1.operator).toBe('NOT');
    const n2 = assertLogical(n1.operands[0]!);
    expect(n2.operator).toBe('NOT');
    const n3 = assertLogical(n2.operands[0]!);
    expect(n3.operator).toBe('NOT');
    const inner = assertComparison(n3.operands[0]!);
    expect(inner.left.variableName).toBe('alive');
    expect(inner.operator).toBe('==');
    expect(inner.right.literalValue).toBe(true);
  });

  it('12b. [边界] NOT NOT NOT $alive（裸变量）→ 当前解析器返回 E005', () => {
    const r = parseCondition('NOT NOT NOT $alive', TEST_VARS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(hasErrorCode(r, 'E005')).toBe(true);
    }
  });

});

// ============================================================================
// 副作用 — 边界测试
// ============================================================================

describe('QA: parseEffects — 边界测试 (7 项)', () => {

  // ------------------------------------------------------------------
  // 13. int add 负数: $hp + -5
  //
  // add 操作符是 +，值 -5 是合法的 int 字面量。
  // ------------------------------------------------------------------
  it('13. int add 负数: hp + -5 → 解析成功', () => {
    const r = parseEffects('hp + -5', TEST_VARS);
    expectOk(r);
    const eff = singleEffect(r);
    expect(eff.variableName).toBe('hp');
    expect(eff.operation).toBe('add');
    expect(eff.value).toBe(-5);
  });

  // ------------------------------------------------------------------
  // 14. float sub: $mp - 3.5
  //
  // subtract 操作符是 -，值 3.5 是合法的 float 字面量。
  // ------------------------------------------------------------------
  it('14. float sub: mp - 3.5 → 解析成功', () => {
    const r = parseEffects('mp - 3.5', TEST_VARS);
    expectOk(r);
    const eff = singleEffect(r);
    expect(eff.variableName).toBe('mp');
    expect(eff.operation).toBe('subtract');
    expect(eff.value).toBe(3.5);
  });

  // ------------------------------------------------------------------
  // 15. set 空字符串: $name set ''
  //
  // set 操作符是 =，值 '' 是空字符串字面量。
  // string 类型的变量可以赋值为空字符串。
  // ------------------------------------------------------------------
  it('15. set 空字符串: name = \'\' → 解析成功', () => {
    const r = parseEffects("name = ''", TEST_VARS);
    expectOk(r);
    const eff = singleEffect(r);
    expect(eff.variableName).toBe('name');
    expect(eff.operation).toBe('set');
    expect(eff.value).toBe('');
  });

  // ------------------------------------------------------------------
  // 16. append: $name append '后缀'
  //
  // append 操作符是 ←，值 '后缀' 是合法的 string 字面量。
  // ------------------------------------------------------------------
  it('16. append: name ← \'后缀\' → 解析成功', () => {
    const r = parseEffects("name ← '后缀'", TEST_VARS);
    expectOk(r);
    const eff = singleEffect(r);
    expect(eff.variableName).toBe('name');
    expect(eff.operation).toBe('append');
    expect(eff.value).toBe('后缀');
  });

  // ------------------------------------------------------------------
  // 17. enum 变量 append → E004
  //
  // route 是 enum 类型，append 只能用于 string 类型。
  // validateOperationType('append', 'enum') → E004
  // ------------------------------------------------------------------
  it('17. enum 变量 append: route ← \'天\' → E004', () => {
    const r = parseEffects("route ← '天'", TEST_VARS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(hasErrorCode(r, 'E004')).toBe(true);
    }
  });

  // ------------------------------------------------------------------
  // 18. 不存在字段路径 "$hp.nonexistent set 5" → 妥善处理
  //
  // hp 是 int 类型，非 object，因此 hp.nonexistent 字段路径无效。
  // resolveFieldPath 返回 null → 报 E004。
  // ------------------------------------------------------------------
  it('18. 不存在字段路径: hp.nonexistent = 5 → E004', () => {
    const r = parseEffects('hp.nonexistent = 5', TEST_VARS);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(hasErrorCode(r, 'E004')).toBe(true);
    }
  });

  // ------------------------------------------------------------------
  // 19. 多个效果同一行（逗号分隔）
  // ------------------------------------------------------------------
  it('19. 多个效果同一行: hp+1, mp-2.0, name=\'hero\' → 解析成功', () => {
    const r = parseEffects("hp+1, mp-2.0, name='hero'", TEST_VARS);
    expectOk(r);
    expect(r.data).toHaveLength(3);

    // 效果 1: hp add 1
    expect(r.data[0]!.variableName).toBe('hp');
    expect(r.data[0]!.operation).toBe('add');
    expect(r.data[0]!.value).toBe(1);

    // 效果 2: mp subtract 2.0
    expect(r.data[1]!.variableName).toBe('mp');
    expect(r.data[1]!.operation).toBe('subtract');
    expect(r.data[1]!.value).toBe(2.0);

    // 效果 3: name set 'hero'
    expect(r.data[2]!.variableName).toBe('name');
    expect(r.data[2]!.operation).toBe('set');
    expect(r.data[2]!.value).toBe('hero');
  });

  it('19b. 多个效果含全角逗号: hp+1，mp-2.0 → 解析成功', () => {
    const r = parseEffects('hp+1，mp-2.0', TEST_VARS);
    expectOk(r);
    expect(r.data).toHaveLength(2);
  });

  it('19c. 多个效果含尾随逗号: hp+1, → 解析成功（忽略尾逗号）', () => {
    const r = parseEffects('hp+1,', TEST_VARS);
    expectOk(r);
    expect(r.data).toHaveLength(1);
  });

});

// ============================================================================
// 交叉场景 — 条件 + 效果组合边界
// ============================================================================

describe('QA: 交叉场景 — 条件与效果组合边界', () => {

  it('条件中用到的变量也可在效果中操作', () => {
    // 条件: hp > 0 AND alive == true
    const cond = parseCondition('$hp > 0 AND $alive == true', TEST_VARS);
    expectOk(cond);
    const log = assertLogical(cond.data!);
    expect(log.operator).toBe('AND');

    // 效果: hp - 10 (subtract)
    const eff = parseEffects('hp - 10', TEST_VARS);
    expectOk(eff);
    expect(singleEffect(eff).value).toBe(10);
  });

  it('enum 变量在条件中允许, 在效果中受 append 限制', () => {
    // 条件: route == '人' → OK (enum/string 兼容)
    const cond = parseCondition("$route == '人'", TEST_VARS);
    expectOk(cond);

    // 效果: route = '天' → OK (set 对所有类型合法)
    const effSet = parseEffects("route = '天'", TEST_VARS);
    expectOk(effSet);

    // 效果: route ← '天' → E004 (enum 不能 append)
    const effAppend = parseEffects("route ← '天'", TEST_VARS);
    expect(effAppend.ok).toBe(false);
  });

  it('条件解析器 vs 效果解析器对未声明变量的错误码一致', () => {
    const cond = parseCondition('$不存在 >= 1', TEST_VARS);
    expectFail(cond);
    expect(hasErrorCode(cond, 'E002')).toBe(true);

    const eff = parseEffects('不存在 = 1', TEST_VARS);
    expectFail(eff);
    expect(hasErrorCode(eff, 'E002')).toBe(true);
  });

});
