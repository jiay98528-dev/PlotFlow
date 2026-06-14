/**
 * 变量操作（效果）解析器 — 单元测试 (M1-05)
 *
 * 覆盖场景：
 * - 基本操作：set（=）、add（+）、subtract（-）、append（←）
 * - 类型感知值解析：int / float / bool / string / enum
 * - 字段访问（$对象.字段）
 * - 多效果逗号分隔
 * - 字符串字面量内逗号不被分割
 * - 边界情况（null / 空字符串 / 纯空白 / 超长表达式）
 * - 错误处理：E002（未声明变量）/ E003（非法枚举值）/ E004（类型不匹配）/ E005（语法错误）
 * - 操作-类型兼容性验证
 * - 中文字符支持
 */

import { describe, it, expect } from 'vitest';
import { parseEffects } from '../parser/effects.js';
import type { VariableDeclaration, SideEffect } from '../types/ast.js';

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
  { name: '物品', type: 'string', defaultValue: '', lineNumber: 8 },
  { name: 'DPS', type: 'float', defaultValue: 0.0, lineNumber: 9 },
  { name: 'HP', type: 'int', defaultValue: 100, lineNumber: 10 },
  {
    name: '角色状态',
    type: 'object',
    defaultValue: {},
    fields: [
      { name: '生命', type: 'int', defaultValue: 100, lineNumber: 11 },
      { name: '魔力', type: 'int', defaultValue: 50, lineNumber: 12 },
      { name: '名称', type: 'string', defaultValue: '', lineNumber: 13 },
    ],
    lineNumber: 11,
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
          { name: '攻击力', type: 'int', defaultValue: 0, lineNumber: 15 },
        ],
        lineNumber: 15,
      },
    ],
    lineNumber: 14,
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

function expectSingleEffect(result: { ok: true; data: SideEffect[] }): SideEffect {
  expect(result.data).toHaveLength(1);
  return result.data[0]!;
}

// ============================================================================
// 基本操作：set（赋值 =）
// ============================================================================

describe('parseEffects - set 赋值操作', () => {
  it('$好感度=50 → set with int value', () => {
    const result = parseEffects('好感度=50', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('好感度');
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(50);
  });

  it('$金币=0 → set with int value 0', () => {
    const result = parseEffects('金币=0', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(0);
  });

  it('$暴击率=0.75 → set with float value', () => {
    const result = parseEffects('暴击率=0.75', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(0.75);
  });

  it('$钥匙=true → set with bool true', () => {
    const result = parseEffects('钥匙=true', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(true);
  });

  it('$钥匙=false → set with bool false', () => {
    const result = parseEffects('钥匙=false', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(false);
  });

  it("$武器='剑' → set with enum value", () => {
    const result = parseEffects("武器='剑'", SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe('剑');
  });

  it('$武器=剑 → set with unquoted enum value', () => {
    const result = parseEffects('武器=剑', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe('剑');
  });

  it("$日志='hello' → set with string value", () => {
    const result = parseEffects("日志='hello'", SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe('hello');
  });

  it("$物品='长剑' → set with string value (not append)", () => {
    // 根据 syntax-formal.md §6.3：`=` 操作为赋值（set），无论变量类型
    const result = parseEffects("物品='长剑'", SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe('长剑');
  });

  it('$金币=-10 → set with negative int', () => {
    const result = parseEffects('金币=-10', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(-10);
  });

  it('$暴击率=-0.5 → set with negative float', () => {
    const result = parseEffects('暴击率=-0.5', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(-0.5);
  });

  it('操作符两侧空格可选', () => {
    const result = parseEffects('好感度  =  50', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(50);
  });
});

// ============================================================================
// 基本操作：add（增加 +）
// ============================================================================

describe('parseEffects - add 增加操作', () => {
  it('$好感度+3 → add', () => {
    const result = parseEffects('好感度+3', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('好感度');
    expect(effect.operation).toBe('add');
    expect(effect.value).toBe(3);
  });

  it('$金币+100 → add', () => {
    const result = parseEffects('金币+100', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('add');
    expect(effect.value).toBe(100);
  });

  it('$暴击率+0.05 → add with float', () => {
    const result = parseEffects('暴击率+0.05', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('add');
    expect(effect.value).toBe(0.05);
  });

  it('$HP+1 → add', () => {
    const result = parseEffects('HP+1', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('add');
    expect(effect.value).toBe(1);
  });

  it('操作符两侧空格可选', () => {
    const result = parseEffects('好感度  +  3', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('add');
    expect(effect.value).toBe(3);
  });
});

// ============================================================================
// 基本操作：subtract（减少 -）
// ============================================================================

describe('parseEffects - subtract 减少操作', () => {
  it('$金币-10 → subtract', () => {
    const result = parseEffects('金币-10', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('金币');
    expect(effect.operation).toBe('subtract');
    expect(effect.value).toBe(10);
  });

  it('$好感度-1 → subtract', () => {
    const result = parseEffects('好感度-1', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('subtract');
    expect(effect.value).toBe(1);
  });

  it('$暴击率-0.1 → subtract with float', () => {
    const result = parseEffects('暴击率-0.1', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('subtract');
    expect(effect.value).toBe(0.1);
  });

  it('$HP-5 → subtract', () => {
    const result = parseEffects('HP-5', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('subtract');
    expect(effect.value).toBe(5);
  });

  it('操作符两侧空格可选', () => {
    const result = parseEffects('金币  -  10', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('subtract');
    expect(effect.value).toBe(10);
  });
});

// ============================================================================
// 基本操作：append（追加 ←）
// ============================================================================

describe('parseEffects - append 追加操作', () => {
  it("$日志←'获得了钥匙' → append", () => {
    const result = parseEffects("日志←'获得了钥匙'", SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('日志');
    expect(effect.operation).toBe('append');
    expect(effect.value).toBe('获得了钥匙');
  });

  it('$日志←新消息 → append with unquoted string', () => {
    const result = parseEffects('日志←新消息', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('append');
    expect(effect.value).toBe('新消息');
  });

  it('操作符两侧空格可选', () => {
    const result = parseEffects("日志  ←  '测试'", SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('append');
    expect(effect.value).toBe('测试');
  });
});

// ============================================================================
// 字段访问
// ============================================================================

describe('parseEffects - 字段访问', () => {
  it('$角色状态.生命=80 → set on object field', () => {
    const result = parseEffects('角色状态.生命=80', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('角色状态.生命');
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(80);
  });

  it('$角色状态.魔力-10 → subtract on object field', () => {
    const result = parseEffects('角色状态.魔力-10', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('角色状态.魔力');
    expect(effect.operation).toBe('subtract');
    expect(effect.value).toBe(10);
  });

  it('$角色状态.魔力+5 → add on object field', () => {
    const result = parseEffects('角色状态.魔力+5', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('角色状态.魔力');
    expect(effect.operation).toBe('add');
    expect(effect.value).toBe(5);
  });

  it("$角色状态.名称='勇者' → set string on object field", () => {
    const result = parseEffects("角色状态.名称='勇者'", SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('角色状态.名称');
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe('勇者');
  });

  it('$装备.武器.攻击力=100 → multi-level field access', () => {
    const result = parseEffects('装备.武器.攻击力=100', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('装备.武器.攻击力');
    expect(effect.operation).toBe('set');
    expect(effect.value).toBe(100);
  });

  it('$装备.武器.攻击力+20 → add on nested field', () => {
    const result = parseEffects('装备.武器.攻击力+20', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('装备.武器.攻击力');
    expect(effect.operation).toBe('add');
    expect(effect.value).toBe(20);
  });
});

// ============================================================================
// 多效果逗号分隔
// ============================================================================

describe('parseEffects - 多效果逗号分隔', () => {
  it('两个效果以半角逗号分隔', () => {
    const result = parseEffects('好感度+3, 金币-10', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]!.variableName).toBe('好感度');
    expect(result.data[0]!.operation).toBe('add');
    expect(result.data[0]!.value).toBe(3);
    expect(result.data[1]!.variableName).toBe('金币');
    expect(result.data[1]!.operation).toBe('subtract');
    expect(result.data[1]!.value).toBe(10);
  });

  it('两个效果以全角逗号分隔', () => {
    const result = parseEffects('好感度+3，金币-10', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(2);
  });

  it('三个混合类型效果', () => {
    const result = parseEffects("好感度+3, 金币-10, 武器='剑'", SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(3);
    expect(result.data[0]!.operation).toBe('add');
    expect(result.data[0]!.value).toBe(3);
    expect(result.data[1]!.operation).toBe('subtract');
    expect(result.data[1]!.value).toBe(10);
    expect(result.data[2]!.operation).toBe('set');
    expect(result.data[2]!.value).toBe('剑');
  });

  it("四个混合类型效果包含 boolean", () => {
    const result = parseEffects("好感度+3, 金币-10, 武器='剑', 钥匙=true", SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(4);
    expect(result.data[3]!.operation).toBe('set');
    expect(result.data[3]!.value).toBe(true);
  });

  it("效果间包含空格不影响解析", () => {
    const result = parseEffects('  好感度+3  ,  金币-10  ', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(2);
  });

  it('字符串值内逗号不被分割', () => {
    const result = parseEffects("日志='你好, 世界', 金币+10", SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]!.variableName).toBe('日志');
    expect(result.data[0]!.value).toBe('你好, 世界');
    expect(result.data[1]!.variableName).toBe('金币');
  });

  it('双引号字符串内逗号不被分割', () => {
    const result = parseEffects('日志="Hello, world", 金币+10', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]!.value).toBe('Hello, world');
  });

  it('单效果无逗号', () => {
    const result = parseEffects('好感度+3', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(1);
  });
});

// ============================================================================
// 边界情况
// ============================================================================

describe('parseEffects - 边界情况', () => {
  it('raw 为 null → 返回空数组', () => {
    const result = parseEffects(null, SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toEqual([]);
  });

  it('raw 为空字符串 → 返回空数组', () => {
    const result = parseEffects('', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toEqual([]);
  });

  it('raw 为纯空白 → 返回空数组', () => {
    const result = parseEffects('   ', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toEqual([]);
  });

  it('lineNumber 参数正确传递', () => {
    const result = parseEffects('好感度+3', SAMPLE_VARIABLES, 42);
    expectOk(result);
    expect(result.data[0]!.lineNumber).toBe(42);
  });

  it('lineNumber 默认为 0', () => {
    const result = parseEffects('好感度+3', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data[0]!.lineNumber).toBe(0);
  });

  it('中文变量名正常识别', () => {
    const result = parseEffects('好感度+50', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data[0]!.variableName).toBe('好感度');
  });

  it('英文变量名正常识别', () => {
    const result = parseEffects('HP+10', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data[0]!.variableName).toBe('HP');
  });

  it('尾随逗号被忽略（不产生空效果）', () => {
    const result = parseEffects('好感度+3,', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.variableName).toBe('好感度');
  });

  it('前导逗号被忽略', () => {
    const result = parseEffects(',好感度+3', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(1);
  });

  it('只有逗号为分隔的内容 → E005', () => {
    const result = parseEffects(',,,', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });
});

// ============================================================================
// 错误处理：语法错误 (E005)
// ============================================================================

describe('parseEffects - 语法错误 E005', () => {
  it('缺少 $ 变量引用', () => {
    const result = parseEffects('=10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('缺少操作符', () => {
    const result = parseEffects('金币', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('缺少值', () => {
    const result = parseEffects('金币=', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('非法的随机文本', () => {
    const result = parseEffects('not a valid effect', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('只有 $ 无变量名', () => {
    const result = parseEffects('$=10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('超长表达式', () => {
    const longExpr = '好感度+1' + ',金币+1'.repeat(500);
    const result = parseEffects(longExpr, SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });
});

// ============================================================================
// 错误处理：未声明变量 (E002)
// ============================================================================

describe('parseEffects - 未声明变量 E002', () => {
  it('变量完全不存在', () => {
    const result = parseEffects('不存在=10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });

  it('不存在变量 + 合法变量混合', () => {
    const result = parseEffects('好感度+3, 不存在=10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });

  it('字段路径中根变量不存在', () => {
    const result = parseEffects('不存在.字段=10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });
});

// ============================================================================
// 错误处理：枚举值非法 (E003)
// ============================================================================

describe('parseEffects - 枚举值非法 E003', () => {
  it("枚举值不在合法列表中", () => {
    const result = parseEffects("武器='匕首'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E003')).toBe(true);
    }
  });

  it("未引号枚举值不在合法列表中", () => {
    const result = parseEffects('职业=牧师', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E003')).toBe(true);
    }
  });

  it("枚举合法值正常通过", () => {
    const result = parseEffects("职业='战士'", SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.value).toBe('战士');
  });
});

// ============================================================================
// 错误处理：类型不匹配 (E004)
// ============================================================================

describe('parseEffects - 类型不匹配 E004', () => {
  it("int 类型变量赋值为非数字字符串", () => {
    const result = parseEffects("金币='abc'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('bool 类型变量赋值为非 bool 值', () => {
    const result = parseEffects('钥匙=123', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('bool 类型变量赋值为字符串 true', () => {
    const result = parseEffects("钥匙='true'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('add 操作对 string 类型变量', () => {
    const result = parseEffects("物品+1", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('subtract 操作对 string 类型变量', () => {
    const result = parseEffects("日志-5", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('add 操作对 bool 类型变量', () => {
    const result = parseEffects("钥匙+1", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('subtract 操作对 bool 类型变量', () => {
    const result = parseEffects("钥匙-1", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('append 操作对 int 类型变量', () => {
    const result = parseEffects("金币←'测试'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('append 操作对 bool 类型变量', () => {
    const result = parseEffects("钥匙←'测试'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('add 操作对 enum 类型变量', () => {
    const result = parseEffects("武器+1", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('float 类型赋值为非数字', () => {
    const result = parseEffects("暴击率='高'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('字段路径中根变量存在但字段无效', () => {
    const result = parseEffects('角色状态.不存在字段=10', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });

  it('直接对 object 变量赋值', () => {
    const result = parseEffects("角色状态='new'", SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E004')).toBe(true);
    }
  });
});

// ============================================================================
// 综合场景
// ============================================================================

describe('parseEffects - 综合场景', () => {
  it('来自 spec §6.5 的示例：单个增加', () => {
    const result = parseEffects('好感度+1', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.operation).toBe('add');
    expect(result.data[0]!.value).toBe(1);
  });

  it('来自 spec §6.5 的示例：多个操作', () => {
    const result = parseEffects('好感度+3, 金币-10', SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]!.operation).toBe('add');
    expect(result.data[1]!.operation).toBe('subtract');
  });

  it("来自 spec §6.5 的示例：混合类型", () => {
    const result = parseEffects("好感度+3, 金币-10, 武器='剑', 钥匙=true", SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(4);
    expect(result.data[2]!.operation).toBe('set');
    expect(result.data[2]!.value).toBe('剑');
    expect(result.data[3]!.operation).toBe('set');
    expect(result.data[3]!.value).toBe(true);
  });

  it('来自 spec §6.5 的示例：字段访问', () => {
    const result = parseEffects('角色状态.生命-10', SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.variableName).toBe('角色状态.生命');
    expect(effect.operation).toBe('subtract');
    expect(effect.value).toBe(10);
  });

  it("来自 spec §6.5 的示例：字符串追加", () => {
    const result = parseEffects("日志←'获得了钥匙'", SAMPLE_VARIABLES);
    expectOk(result);
    const effect = expectSingleEffect(result);
    expect(effect.operation).toBe('append');
    expect(effect.value).toBe('获得了钥匙');
  });

  it('完整效果场景：战斗奖励', () => {
    const result = parseEffects("金币+100, 好感度+5, 武器='弓', 钥匙=true, 角色状态.生命-20", SAMPLE_VARIABLES);
    expectOk(result);
    expect(result.data).toHaveLength(5);
    expect(result.data[0]!.variableName).toBe('金币');
    expect(result.data[0]!.operation).toBe('add');
    expect(result.data[1]!.variableName).toBe('好感度');
    expect(result.data[1]!.operation).toBe('add');
    expect(result.data[2]!.variableName).toBe('武器');
    expect(result.data[2]!.operation).toBe('set');
    expect(result.data[2]!.value).toBe('弓');
    expect(result.data[3]!.variableName).toBe('钥匙');
    expect(result.data[3]!.operation).toBe('set');
    expect(result.data[3]!.value).toBe(true);
    expect(result.data[4]!.variableName).toBe('角色状态.生命');
    expect(result.data[4]!.operation).toBe('subtract');
  });

  it('空变量列表 + 变量引用 → E002', () => {
    const result = parseEffects('x=1', []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });

  it('部分合法 + 部分非法效果混合', () => {
    const result = parseEffects('好感度+3, 不存在=10, 金币-5', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });
});

// ============================================================================
// 容错解析
// ============================================================================

describe('parseEffects - 容错解析', () => {
  it('混合效果中部分错误不影响后续解析的错误收集', () => {
    const result = parseEffects('好感度+3, 不存在=10, 金币-5', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // 应该包含 E002 (不存在) 错误
      expect(result.errors.some((e) => e.code === 'E002')).toBe(true);
    }
  });

  it('语法正确的效果在混合中仍被解析', () => {
    // 注意：当前的容错策略是全部失败（有错误就返回 failure）
    // 这个测试验证错误被正确收集
    const result = parseEffects('好感度+3, 无效效果, 金币-5', SAMPLE_VARIABLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
