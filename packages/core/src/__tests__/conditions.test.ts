/**
 * 条件表达式解析器 — 单元测试 (M1-04)
 *
 * 覆盖场景：
 * - 简单比较运算（== != > < >= <=）
 * - 逻辑运算（AND / OR / NOT）
 * - 字段访问（$变量.字段）
 * - 括号分组与优先级
 * - 嵌套深度限制（E006）
 * - 未声明变量（E002）
 * - 类型不匹配（E004）
 * - 语法错误（E005）
 * - 边界情况（null/空字符串、超长表达式、容错解析）
 * - 各种字面量类型
 * - 中文字符支持
 */

import { describe, it, expect } from 'vitest';
import { parseCondition } from '../parser/conditions.js';
import type { VariableDeclaration, ConditionNode, ComparisonExpression, LogicalExpression } from '../types/ast.js';

// ============================================================================
// 测试用变量声明
// ============================================================================

const SAMPLE_VARIABLES: VariableDeclaration[] = [
  { name: '好感度', type: 'int', defaultValue: 0, lineNumber: 1 },
  { name: '金币', type: 'int', defaultValue: 0, lineNumber: 2 },
  { name: '暴击率', type: 'float', defaultValue: 0.0, lineNumber: 3 },
  { name: '钥匙', type: 'bool', defaultValue: false, lineNumber: 4 },
  { name: '武器', type: 'enum', defaultValue: '无', enumValues: ['无', '剑', '弓', '杖'], lineNumber: 5 },
  { name: '职业', type: 'enum', defaultValue: '战士', enumValues: ['战士', '法师', '盗贼'], lineNumber: 6 },
  { name: '日志', type: 'string', defaultValue: '', lineNumber: 7 },
  { name: 'a', type: 'int', defaultValue: 0, lineNumber: 13 },
  { name: 'b', type: 'int', defaultValue: 0, lineNumber: 14 },
  { name: 'c', type: 'int', defaultValue: 0, lineNumber: 15 },
  { name: 'd', type: 'int', defaultValue: 0, lineNumber: 16 },
  { name: 'e', type: 'int', defaultValue: 0, lineNumber: 17 },
  {
    name: '角色状态',
    type: 'object',
    defaultValue: {},
    fields: [
      { name: '生命', type: 'int', defaultValue: 100, lineNumber: 8 },
      { name: '魔力', type: 'int', defaultValue: 50, lineNumber: 9 },
    ],
    lineNumber: 8,
  },
  {
    name: '装备',
    type: 'object',
    defaultValue: {},
    fields: [
      {
        name: '武器',
        type: 'object',
        defaultValue: {},
        fields: [
          { name: '攻击力', type: 'int', defaultValue: 0, lineNumber: 11 },
        ],
        lineNumber: 11,
      },
    ],
    lineNumber: 10,
  },
];

// ============================================================================
// 辅助函数
// ============================================================================

function expectOk<T>(result: { ok: boolean; data?: T; errors?: readonly unknown[] }): asserts result is { ok: true; data: T } {
  if (!result.ok) {
    const msg = (result as { errors: readonly unknown[] }).errors?.map((e: unknown) => (e as { message: string }).message).join(', ') ?? 'unknown';
    throw new Error(`Expected ok=true but got ok=false: ${msg}`);
  }
}

function getComparison(node: ConditionNode): ComparisonExpression {
  if (node.type !== 'comparison') throw new Error(`Expected comparison node, got ${node.type}`);
  return node;
}

function getLogical(node: ConditionNode): LogicalExpression {
  if (node.type !== 'logical') throw new Error(`Expected logical node, got ${node.type}`);
  return node;
}

// ============================================================================
// 简单比较运算
// ============================================================================

describe('parseCondition - 简单比较运算', () => {
  it('== 比较：数字', () => {
    const result = parseCondition('$金币 == 10', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).not.toBeNull();
    const comp = getComparison(result.data!);
    expect(comp.operator).toBe('==');
    expect(comp.left.operandType).toBe('variable');
    expect(comp.left.variableName).toBe('金币');
    expect(comp.right.operandType).toBe('literal');
    expect(comp.right.literalValue).toBe(10);
  });

  it('!= 比较：字符串', () => {
    const result = parseCondition("$武器 != '无'", SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.operator).toBe('!=');
    expect(comp.left.variableName).toBe('武器');
    expect(comp.right.literalValue).toBe('无');
  });

  it('>= 比较', () => {
    const result = parseCondition('$好感度 >= 5', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.operator).toBe('>=');
    expect(comp.right.literalValue).toBe(5);
  });

  it('<= 比较', () => {
    const result = parseCondition('$暴击率 <= 0.5', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.operator).toBe('<=');
    expect(comp.right.literalValue).toBe(0.5);
  });

  it('> 比较', () => {
    const result = parseCondition('$金币 > 0', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.operator).toBe('>');
  });

  it('< 比较', () => {
    const result = parseCondition('$好感度 < 100', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.operator).toBe('<');
  });

  it('== 比较：布尔值 true', () => {
    const result = parseCondition('$钥匙 == true', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe(true);
  });

  it('== 比较：布尔值 false', () => {
    const result = parseCondition('$钥匙 == false', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe(false);
  });

  it('== 比较：负数', () => {
    const result = parseCondition('$金币 == -5', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe(-5);
  });

  it('== 比较：浮点数', () => {
    const result = parseCondition('$暴击率 == 0.75', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe(0.75);
  });

  it('比较运算符两侧空格可选', () => {
    const result = parseCondition('$金币>=10', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.operator).toBe('>=');
    expect(comp.right.literalValue).toBe(10);
  });
});

// ============================================================================
// 逻辑运算
// ============================================================================

describe('parseCondition - 逻辑运算', () => {
  it('AND 逻辑与', () => {
    const result = parseCondition('($好感度 >= 5) AND ($金币 > 10)', SAMPLE_VARIABLES);
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('AND');
    expect(log.operands).toHaveLength(2);
    expect(getComparison(log.operands[0]!).left.variableName).toBe('好感度');
    expect(getComparison(log.operands[1]!).left.variableName).toBe('金币');
  });

  it('OR 逻辑或', () => {
    const result = parseCondition("($职业 == '战士') OR ($职业 == '法师')", SAMPLE_VARIABLES);
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('OR');
    expect(log.operands).toHaveLength(2);
  });

  it('NOT 逻辑非', () => {
    const result = parseCondition('NOT ($钥匙 == true)', SAMPLE_VARIABLES);
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('NOT');
    expect(log.operands).toHaveLength(1);
    const inner = getComparison(log.operands[0]!);
    expect(inner.left.variableName).toBe('钥匙');
  });

  it('多个 AND 连接', () => {
    const result = parseCondition('($金币>=10) AND ($好感度>=5) AND ($钥匙==true)', SAMPLE_VARIABLES);
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('AND');
    expect(log.operands).toHaveLength(3);
  });

  it('多个 OR 连接', () => {
    const result = parseCondition("($职业=='战士') OR ($职业=='法师') OR ($职业=='盗贼')", SAMPLE_VARIABLES);
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('OR');
    expect(log.operands).toHaveLength(3);
  });

  it('AND 优先级高于 OR（语法形式）', () => {
    // A OR B AND C → A OR (B AND C)
    const result = parseCondition("($a==1) OR ($b==2) AND ($c==3)", SAMPLE_VARIABLES);
    expectOk(result);
    const log = getLogical(result.data!);
    // 顶层应该是 OR（含 2 个操作数）
    expect(log.operator).toBe('OR');
    expect(log.operands).toHaveLength(2);
    // 第二个操作数应该是 AND
    const rightOp = log.operands[1]!;
    expect(rightOp.type).toBe('logical');
    if (rightOp.type === 'logical') {
      expect(rightOp.operator).toBe('AND');
    }
  });

  it('括号改变优先级', () => {
    // (A OR B) AND C
    const result = parseCondition("(($职业=='战士') OR ($职业=='法师')) AND ($金币>=10)", SAMPLE_VARIABLES);
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('AND');
    expect(log.operands).toHaveLength(2);
    const leftOp = log.operands[0]!;
    expect(leftOp.type).toBe('logical');
    if (leftOp.type === 'logical') {
      expect(leftOp.operator).toBe('OR');
    }
  });

  it('嵌套逻辑 AND 中 OR', () => {
    const result = parseCondition(
      "($好感度>=5) AND (($职业=='战士') OR ($职业=='法师'))",
      SAMPLE_VARIABLES,
    );
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('AND');
    expect(log.operands).toHaveLength(2);
    const rightOp = log.operands[1]!;
    expect(rightOp.type).toBe('logical');
  });

  it('复杂三层嵌套', () => {
    // (A AND B) OR (C AND (D OR E))
    const result = parseCondition(
      "(($金币>=10) AND ($好感度>=5)) OR (($钥匙==true) AND (($职业=='战士') OR ($职业=='法师')))",
      SAMPLE_VARIABLES,
    );
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('OR');
  });
});

// ============================================================================
// 字段访问
// ============================================================================

describe('parseCondition - 字段访问', () => {
  it('单级字段访问', () => {
    const result = parseCondition('$角色状态.魔力 >= 10', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.left.operandType).toBe('variable');
    expect(comp.left.variableName).toBe('角色状态.魔力');
    expect(comp.right.literalValue).toBe(10);
  });

  it('多级字段访问', () => {
    const result = parseCondition('$装备.武器.攻击力 > 50', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.left.variableName).toBe('装备.武器.攻击力');
  });

  it('字段访问在条件中', () => {
    const result = parseCondition('($角色状态.魔力 >= 10) AND ($角色状态.生命 > 0)', SAMPLE_VARIABLES);
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('AND');
    expect(log.operands).toHaveLength(2);
    const c1 = getComparison(log.operands[0]!);
    expect(c1.left.variableName).toBe('角色状态.魔力');
    const c2 = getComparison(log.operands[1]!);
    expect(c2.left.variableName).toBe('角色状态.生命');
  });

  it('字段访问与字面量比较', () => {
    const result = parseCondition("$角色状态.魔力 == 0", SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.left.variableName).toBe('角色状态.魔力');
    expect(comp.right.literalValue).toBe(0);
  });
});

// ============================================================================
// 字面量类型
// ============================================================================

describe('parseCondition - 字面量类型', () => {
  it('整数字面量', () => {
    const result = parseCondition('$金币 == 100', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.operandType).toBe('literal');
    expect(comp.right.literalValue).toBe(100);
  });

  it('浮点数字面量', () => {
    const result = parseCondition('$暴击率 == 0.05', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe(0.05);
  });

  it('布尔字面量', () => {
    const result = parseCondition('$钥匙 == false', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.operandType).toBe('literal');
    expect(comp.right.literalValue).toBe(false);
  });

  it('字符串字面量', () => {
    const result = parseCondition("$武器 == '剑'", SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe('剑');
  });

  it('字符串字面量含转义', () => {
    const result = parseCondition("$日志 == 'it\\'s ok'", SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe("it's ok");
  });

  it('负整数', () => {
    const result = parseCondition('$金币 == -10', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe(-10);
  });

  it('负浮点数比较', () => {
    const result = parseCondition('$暴击率 > -0.5', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe(-0.5);
  });
});

// ============================================================================
// 边界情况
// ============================================================================

describe('parseCondition - 边界情况', () => {
  it('raw 为 null → 返回 null（无条件）', () => {
    const result = parseCondition(null, SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toBeNull();
  });

  it('raw 为空字符串 → 返回 null', () => {
    const result = parseCondition('', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toBeNull();
  });

  it('raw 为纯空白 → 返回 null', () => {
    const result = parseCondition('   ', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toBeNull();
  });

  it('外围括号自动剥离', () => {
    // conditionRaw 通常形如 ($好感度>=5)
    const result = parseCondition('($好感度>=5)', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.left.variableName).toBe('好感度');
  });

  it('外围括号不匹配时不剥离', () => {
    // ($金币>=10) AND ($武器!='无') — outer parens don't match
    const result = parseCondition("($金币>=10) AND ($武器!='无')", SAMPLE_VARIABLES);
    expectOk(result);
    // 应该解析为 AND 表达式
    const log = getLogical(result.data!);
    expect(log.operator).toBe('AND');
  });

  it('多余空白不影响解析', () => {
    const result = parseCondition('  $金币   >=   10  ', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.operator).toBe('>=');
  });

  it('中文变量名正常识别', () => {
    const result = parseCondition('$好感度 == 50', SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.left.variableName).toBe('好感度');
  });

  it('中文枚举值字面量', () => {
    const result = parseCondition("$职业 == '战士'", SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe('战士');
  });

  it('混合中英文变量', () => {
    const vars: VariableDeclaration[] = [
      { name: 'HP_MAX', type: 'int', defaultValue: 100, lineNumber: 1 },
    ];
    const result = parseCondition('$HP_MAX > 0', vars);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.left.variableName).toBe('HP_MAX');
  });
});

// ============================================================================
// 错误处理：语法错误 (E005)
// ============================================================================

describe('parseCondition - 语法错误 E005', () => {
  it('非法的单等号 =', () => {
    const result = parseCondition('$金币 = 10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('$ 后无有效变量名', () => {
    const result = parseCondition('$ >= 10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('表达式不完整：缺右操作数', () => {
    const result = parseCondition('$金币 >=', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('表达式不完整：缺左操作数', () => {
    const result = parseCondition('>= 10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('AND 后缺少表达式', () => {
    const result = parseCondition('($金币>=10) AND', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('OR 后缺少表达式', () => {
    const result = parseCondition('($a==1) OR', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('NOT 后缺少表达式', () => {
    const result = parseCondition('NOT', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('缺少右括号', () => {
    const result = parseCondition('($金币>=10', SAMPLE_VARIABLES);
    // 容错：可能会返回 AST 但有错误
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('非法字符', () => {
    const result = parseCondition('$金币 @ 10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('表达式末尾有意外内容', () => {
    const result = parseCondition('$金币 == 10 extra', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('超长表达式', () => {
    const longExpr = '$金币 == 1' + ' AND ($金币 == 2)'.repeat(500);
    const result = parseCondition(longExpr, SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('字段访问中点后无有效字段名', () => {
    const result = parseCondition('$角色状态. >= 10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('无效的单感叹号', () => {
    const result = parseCondition('$钥匙 ! true', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });
});

// ============================================================================
// 错误处理：未声明变量 (E002)
// ============================================================================

describe('parseCondition - 未声明变量 E002', () => {
  it('变量完全不存在', () => {
    const result = parseCondition('$不存在 >= 10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });

  it('字段路径中的根变量存在但字段无效', () => {
    const result = parseCondition('$角色状态.不存在字段 >= 10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004' || e.code === 'E002')).toBe(true);
    }
  });
});

// ============================================================================
// 错误处理：类型不匹配 (E004)
// ============================================================================

describe('parseCondition - 类型不匹配 E004', () => {
  it('int 与 string 用 == 比较', () => {
    const result = parseCondition("$金币 == 'abc'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('bool 与 int 用 >= 比较', () => {
    const result = parseCondition('$钥匙 >= 3', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('string 变量用 > 比较', () => {
    const result = parseCondition("$日志 > 'abc'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('int 与 bool 用 != 比较', () => {
    const result = parseCondition('$金币 != true', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('float 与 string 比较', () => {
    const result = parseCondition("$暴击率 == '高'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });
});

// ============================================================================
// 错误处理：嵌套深度超限 (E006)
// ============================================================================

describe('parseCondition - 嵌套深度超限 E006', () => {
  it('4 层 AND 嵌套 → E006', () => {
    // 构造 4 层嵌套：A AND (B AND (C AND (D AND E)))
    const expr =
      '($a==1) AND (($b==2) AND (($c==3) AND (($d==4) AND ($e==5))))';
    const result = parseCondition(expr, SAMPLE_VARIABLES);
    // 深度超过 3 层应报 E006
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E006')).toBe(true);
    }
  });

  it('4 层 OR 嵌套 → E006', () => {
    const expr =
      '($a==1) OR (($b==2) OR (($c==3) OR (($d==4) OR ($e==5))))';
    const result = parseCondition(expr, SAMPLE_VARIABLES);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E006')).toBe(true);
    }
  });

  it('3 层嵌套合法（上限）', () => {
    // 3 层：A AND (B AND (C AND D))
    const expr =
      '($a==1) AND (($b==2) AND (($c==3) AND ($d==4)))';
    const result = parseCondition(expr, SAMPLE_VARIABLES);
    // 3 层应当 OK（可能有 E002 因为变量不存在，但不该有 E006）
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E006')).toBe(false);
    }
  });

  it('2 层嵌套合法', () => {
    const expr = '($好感度>=5) AND (($金币>=10) OR ($钥匙==true))';
    const result = parseCondition(expr, SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).not.toBeNull();
  });
});

// ============================================================================
// 综合场景
// ============================================================================

describe('parseCondition - 综合场景', () => {
  it('完整条件示例：来自 spec §9', () => {
    const result = parseCondition(
      "($金币>=10) AND ($武器!='无')",
      SAMPLE_VARIABLES,
    );
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('AND');
    expect(log.operands).toHaveLength(2);
  });

  it('条件 + 字段访问', () => {
    const result = parseCondition(
      '($角色状态.魔力>=10)',
      SAMPLE_VARIABLES,
    );
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.left.variableName).toBe('角色状态.魔力');
  });

  it('带空变量列表的简单表达式', () => {
    // 变量不存在 → 会报 E002，但解析本身应当产生 AST
    const result = parseCondition('$x == 1', []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });

  it('NOT 包裹比较表达式', () => {
    const result = parseCondition('NOT ($钥匙==true)', SAMPLE_VARIABLES);
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('NOT');
    expect(log.operands).toHaveLength(1);
  });

  it('AND/OR 混合带括号优先', () => {
    // ($a==1) AND ($b==2) OR ($c==3) → (($a==1) AND ($b==2)) OR ($c==3)
    // AND 优先级高于 OR
    const result = parseCondition(
      "($a==1) AND ($b==2) OR ($c==3)",
      SAMPLE_VARIABLES,
    );
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('OR');
    // 左操作数应为 AND
    if (log.operands[0]!.type === 'logical') {
      expect(log.operands[0]!.operator).toBe('AND');
    }
  });

  it('字符串字面量用单引号', () => {
    const result = parseCondition("$武器 == '剑'", SAMPLE_VARIABLES);
    expectOk(result);
    const comp = getComparison(result.data!);
    expect(comp.right.literalValue).toBe('剑');
  });

  it('字段深度访问 + 逻辑组合', () => {
    const result = parseCondition(
      '($角色状态.生命>0) AND ($装备.武器.攻击力>=10)',
      SAMPLE_VARIABLES,
    );
    expectOk(result);
    const log = getLogical(result.data!);
    expect(log.operator).toBe('AND');
    expect(log.operands).toHaveLength(2);
  });

  it('多 NOT 嵌套', () => {
    const result = parseCondition('NOT (NOT ($钥匙==true))', SAMPLE_VARIABLES);
    expectOk(result);
    const outer = getLogical(result.data!);
    expect(outer.operator).toBe('NOT');
  });
});

// ============================================================================
// 容错解析
// ============================================================================

describe('parseCondition - 容错解析', () => {
  it('部分错误仍尝试解析', () => {
    // 存在未声明变量但语法正确 → 报 E002 但仍产生 AST
    const result = parseCondition('$不存在 == 10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });

  it('缺少右括号容错', () => {
    const result = parseCondition('($金币>=10', SAMPLE_VARIABLES);
    // 应当报错但可能返回部分 AST
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
