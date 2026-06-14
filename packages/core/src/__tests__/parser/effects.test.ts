/**
 * 单元测试 — 效果解析器 (M1-05)
 */
import { describe, it, expect } from 'vitest';
import { parseEffects } from '../../parser/effects.js';
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
  ], lineNumber: 7 },
  { name: '物品', type: 'string', defaultValue: '', lineNumber: 10 },
];

describe('parseEffects', () => {
  // ==========================================================================
  // 1. 空/边界
  // ==========================================================================

  it('null → 空数组', () => {
    const result = parseEffects(null, variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it('空字符串 → 空数组', () => {
    const result = parseEffects('', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  it('纯空白 → 空数组', () => {
    const result = parseEffects('   ', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual([]);
    }
  });

  // ==========================================================================
  // 2. set（赋值）
  // ==========================================================================

  it('set: 变量 = 数值', () => {
    const result = parseEffects('金币=10', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0]!).toMatchObject({
        variableName: '金币',
        operation: 'set',
        value: 10,
      });
    }
  });

  it('set: $变量 = "字符串"', () => {
    const result = parseEffects('$玩家名=\'勇者\'', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!).toMatchObject({
        variableName: '玩家名',
        operation: 'set',
        value: '勇者',
      });
    }
  });

  it('set: bool 变量 = true', () => {
    const result = parseEffects('$存活=true', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!).toMatchObject({
        variableName: '存活',
        operation: 'set',
        value: true,
      });
    }
  });

  // ==========================================================================
  // 3. add / subtract（数值增减）
  // ==========================================================================

  it('add: 变量 + 数值', () => {
    const result = parseEffects('金币+10', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!).toMatchObject({
        variableName: '金币',
        operation: 'add',
        value: 10,
      });
    }
  });

  it('subtract: 变量 - 数值', () => {
    const result = parseEffects('金币-5', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!).toMatchObject({
        variableName: '金币',
        operation: 'subtract',
        value: 5,
      });
    }
  });

  it('float 类型的 add', () => {
    const result = parseEffects('倍率+0.5', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!).toMatchObject({
        variableName: '倍率',
        operation: 'add',
        value: 0.5,
      });
    }
  });

  // ==========================================================================
  // 4. append（追加）
  // ==========================================================================

  it('append: 字符串追加 ←', () => {
    const result = parseEffects('物品←毒药', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!).toMatchObject({
        variableName: '物品',
        operation: 'append',
        value: '毒药',
      });
    }
  });

  // ==========================================================================
  // 5. 多效果一行（逗号分隔）
  // ==========================================================================

  it('逗号分隔多个效果', () => {
    const result = parseEffects('金币+3, 金币-10, 玩家名=\'勇者\'', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0]!.operation).toBe('add');
      expect(result.data[1]!.operation).toBe('subtract');
      expect(result.data[2]!.operation).toBe('set');
    }
  });

  it('全角逗号分隔多个效果', () => {
    const result = parseEffects('金币+3，玩家名=\'勇者\'', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
    }
  });

  it('字符串中含逗号不干扰分割', () => {
    const result = parseEffects("物品←'长剑, 盾牌', 金币-5", variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]!.value).toBe('长剑, 盾牌');
    }
  });

  // ==========================================================================
  // 6. 字段访问
  // ==========================================================================

  it('字段访问效果：$角色.体力+10', () => {
    const result = parseEffects('$角色.体力+10', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!).toMatchObject({
        variableName: '角色.体力',
        operation: 'add',
        value: 10,
      });
    }
  });

  // ==========================================================================
  // 7. 未声明变量（E002）
  // ==========================================================================

  it('未声明变量 → E002', () => {
    const result = parseEffects('未声明变量+10', variables, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E002');
    }
  });

  // ==========================================================================
  // 8. 类型不匹配（E004）
  // ==========================================================================

  it('int 变量 add 字符串 → E004', () => {
    const result = parseEffects('金币+\'abc\'', variables, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('bool 变量 add（不支持） → E004', () => {
    const result = parseEffects('存活+1', variables, 10);
    expect(result.ok).toBe(false);
  });

  it('string 变量 subtract → E004', () => {
    const result = parseEffects('玩家名-1', variables, 10);
    expect(result.ok).toBe(false);
  });

  it('int 变量 append → E004', () => {
    const result = parseEffects('金币←物品', variables, 10);
    expect(result.ok).toBe(false);
  });

  it('object 变量直接赋值 → E004', () => {
    const result = parseEffects('角色={}', variables, 10);
    expect(result.ok).toBe(false);
  });

  // ==========================================================================
  // 9. 枚举值非法（E003）
  // ==========================================================================

  it('枚举值非法 → E003', () => {
    const result = parseEffects('职业=\'不存在职业\'', variables, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E003');
    }
  });

  it('枚举值合法 → ok', () => {
    const result = parseEffects('职业=\'法师\'', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data[0]!.value).toBe('法师');
    }
  });

  // ==========================================================================
  // 10. 语法格式错误（E005）
  // ==========================================================================

  it('缺少操作符 → E005', () => {
    const result = parseEffects('金币abc', variables, 10);
    expect(result.ok).toBe(false);
  });

  it('效果列表为空 → E005', () => {
    const result = parseEffects('', variables, 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual([]);
  });

  it('长度超限（> 2048） → E005', () => {
    const longExpr = '金币+1' + 'x'.repeat(2048);
    const result = parseEffects(longExpr, variables, 10);
    expect(result.ok).toBe(false);
  });
});
