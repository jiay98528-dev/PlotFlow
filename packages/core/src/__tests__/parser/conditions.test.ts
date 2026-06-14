/**
 * 单元测试 — 条件表达式解析器 (M1-04)
 */
import { describe, it, expect } from 'vitest';
import { parseCondition } from '../../parser/conditions.js';
import type { VariableDeclaration } from '../../types/ast.js';

const variables: VariableDeclaration[] = [
  { name: '金币', type: 'int', defaultValue: 0, lineNumber: 2 },
  { name: '倍率', type: 'float', defaultValue: 1.0, lineNumber: 3 },
  { name: '存活', type: 'bool', defaultValue: false, lineNumber: 4 },
  { name: '玩家名', type: 'string', defaultValue: '', lineNumber: 5 },
  { name: '职业', type: 'enum', defaultValue: '战士', enumValues: ['战士', '法师', '盗贼'], lineNumber: 6 },
  { name: '角色', type: 'object', defaultValue: {}, fields: [
    { name: '体力', type: 'int', defaultValue: 100, lineNumber: 8 },
    { name: '魔力', type: 'int', defaultValue: 50, lineNumber: 9 },
    { name: '状态', type: 'object', defaultValue: {}, fields: [
      { name: '中毒', type: 'bool', defaultValue: false, lineNumber: 11 },
    ], lineNumber: 10 },
  ], lineNumber: 7 },
];

describe('parseCondition', () => {
  // ==========================================================================
  // 1. 空/边界
  // ==========================================================================

  it('null → ok, null', () => {
    const result = parseCondition(null, variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  it('空字符串 → ok, null', () => {
    const result = parseCondition('', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  it('纯空白 → ok, null', () => {
    const result = parseCondition('   ', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  // ==========================================================================
  // 2. 简单比较
  // ==========================================================================

  it('int >= 数值', () => {
    const result = parseCondition('$金币 >= 5', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      expect(node.type).toBe('comparison');
      if (node.type === 'comparison') {
        expect(node.left).toMatchObject({ operandType: 'variable', variableName: '金币' });
        expect(node.operator).toBe('>=');
        expect(node.right).toMatchObject({ operandType: 'literal', literalValue: 5 });
      }
    }
  });

  it('int == 数值', () => {
    const result = parseCondition('$金币 == 10', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      expect(node.type).toBe('comparison');
    }
  });

  it('float < 数值', () => {
    const result = parseCondition('$倍率 < 2.5', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      if (node.type === 'comparison') {
        expect(node.right.literalValue).toBe(2.5);
      }
    }
  });

  it('bool == true', () => {
    const result = parseCondition('$存活 == true', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      if (node.type === 'comparison') {
        expect(node.right.literalValue).toBe(true);
      }
    }
  });

  it('string != 值', () => {
    const result = parseCondition("$玩家名 != '匿名'", variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      if (node.type === 'comparison') {
        expect(node.right.literalValue).toBe('匿名');
      }
    }
  });

  // ==========================================================================
  // 3. 复合逻辑
  // ==========================================================================

  it('(A) AND (B) 复合逻辑', () => {
    const result = parseCondition('($金币 >= 10) AND ($存活 == true)', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      expect(node.type).toBe('logical');
      if (node.type === 'logical') {
        expect(node.operator).toBe('AND');
        expect(node.operands).toHaveLength(2);
      }
    }
  });

  it('(A) OR (B) 复合逻辑', () => {
    const result = parseCondition('($金币 == 0) OR ($存活 == false)', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      expect(node.type).toBe('logical');
      if (node.type === 'logical') {
        expect(node.operator).toBe('OR');
      }
    }
  });

  it('NOT 取反', () => {
    const result = parseCondition('NOT ($存活 == true)', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      expect(node.type).toBe('logical');
      if (node.type === 'logical') {
        expect(node.operator).toBe('NOT');
        expect(node.operands).toHaveLength(1);
      }
    }
  });

  // ==========================================================================
  // 4. 嵌套逻辑
  // ==========================================================================

  it('(A AND B) OR C 嵌套', () => {
    const result = parseCondition(
      '($金币 >= 10 AND $存活 == true) OR $职业 == "战士"',
      variables, 10,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      expect(node.type).toBe('logical');
      if (node.type === 'logical') {
        expect(node.operator).toBe('OR');
      }
    }
  });

  it('AND 链式组合：A AND B AND C', () => {
    const result = parseCondition(
      '$金币 >= 10 AND $倍率 > 1.0 AND $存活 == true',
      variables, 10,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      expect(node.type).toBe('logical');
      if (node.type === 'logical') {
        expect(node.operator).toBe('AND');
        expect(node.operands).toHaveLength(3);
      }
    }
  });

  // ==========================================================================
  // 5. 字段访问
  // ==========================================================================

  it('字段访问：$角色.体力 >= 数值', () => {
    const result = parseCondition('$角色.体力 >= 30', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      if (node.type === 'comparison') {
        expect(node.left.variableName).toBe('角色.体力');
      }
    }
  });

  it('两层嵌套字段访问：$角色.状态.中毒 == true', () => {
    const result = parseCondition('$角色.状态.中毒 == true', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data!;
      if (node.type === 'comparison') {
        expect(node.left.variableName).toBe('角色.状态.中毒');
        expect(node.right.literalValue).toBe(true);
      }
    }
  });

  it('未声明的字段路径 → E002', () => {
    const result = parseCondition('$角色.不存在字段 == 1', variables, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E004');
    }
  });

  // ==========================================================================
  // 6. 未声明变量
  // ==========================================================================

  it('变量未在 Frontmatter 中声明 → E002', () => {
    const result = parseCondition('$未声明变量 > 0', variables, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });

  // ==========================================================================
  // 7. 类型不匹配
  // ==========================================================================

  it('数值比较但变量为字符串 → E004', () => {
    const result = parseCondition('$玩家名 > 0', variables, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('bool 与 int 比较（==） → E004', () => {
    const result = parseCondition('$存活 == 1', variables, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('int 与 string 比较（==） → E004', () => {
    const result = parseCondition('$金币 == "很多"', variables, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  // ==========================================================================
  // 8. 语法错误
  // ==========================================================================

  it('不完整的表达式 → E005', () => {
    const result = parseCondition('$金币 >=', variables, 10);
    expect(result.ok).toBe(false);
  });

  it('孤立的括号 → E005', () => {
    const result = parseCondition('($金币 == 1', variables, 10);
    expect(result.ok).toBe(false);
  });

  it('无效运算符 = 单独出现 → E005', () => {
    const result = parseCondition('$金币 = 5', variables, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('长度超限（> 2048） → E005', () => {
    const longExpr = '$金币 > 0 AND ' + 'x'.repeat(2048);
    const result = parseCondition(longExpr, variables, 10);
    expect(result.ok).toBe(false);
  });

  // ==========================================================================
  // 9. 枚举值比较
  // ==========================================================================

  it('enum 与合法字面量 == 比较 → ok', () => {
    const result = parseCondition("$职业 == '战士'", variables, 10);
    expect(result.ok).toBe(true);
  });

  it('enum 与非法字面量 == 比较 → ok（类型兼容，E003 由 M3 验证）', () => {
    // enum 与 string 是兼容类型，所以不会报 E004
    const result = parseCondition("$职业 == '不存在职业'", variables, 10);
    expect(result.ok).toBe(true);
  });

  it('int 与 float 比较兼容（>=）', () => {
    const result = parseCondition('$金币 >= $倍率', variables, 10);
    expect(result.ok).toBe(true);
  });
});
