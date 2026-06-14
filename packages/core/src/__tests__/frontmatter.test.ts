/**
 * YAML Frontmatter 解析器 — 单元测试
 *
 * 覆盖场景：
 * - 空 Frontmatter / 无变量
 * - 基本类型（int/float/bool/string）
 * - 枚举类型（enum[...]）
 * - 对象类型（object{...}）
 * - 嵌套对象（深度检查）
 * - 变量重复声明检测
 * - 保留字检测
 * - 变量名格式验证
 * - YAML 语法错误
 * - 特殊字符（Unicode/emoji/中英混排）
 * - CRLF 换行符
 * - 元信息解析（title/author/engine/plotflow）
 */

import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../parser/frontmatter.js';

// ============================================================================
// 辅助：快速构建完整的 .mdstory 文本（包含 --- 边界）
// ============================================================================

function fm(content: string): string {
  return `---\n${content}\n---\n\n# 第一章\n`;
}

// ============================================================================
// 空 Frontmatter
// ============================================================================

describe('parseFrontmatter - 空 Frontmatter', () => {
  it('无 --- 块时返回空 variables（不报错）', () => {
    const result = parseFrontmatter('# 第一章\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
      expect(result.data.title).toBeUndefined();
    }
  });

  it('空字符串输入', () => {
    const result = parseFrontmatter('');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
    }
  });

  it('只有空白字符', () => {
    const result = parseFrontmatter('\n\n\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
    }
  });
});

// ============================================================================
// 基本类型
// ============================================================================

describe('parseFrontmatter - 基本类型', () => {
  it('int 类型', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  生命值: int`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(1);
      expect(result.data.variables[0]).toMatchObject({
        name: '生命值',
        type: 'int',
        defaultValue: 0,
      });
    }
  });

  it('float 类型', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  暴击率: float`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({
        name: '暴击率',
        type: 'float',
        defaultValue: 0.0,
      });
    }
  });

  it('bool 类型', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  钥匙: bool`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({
        name: '钥匙',
        type: 'bool',
        defaultValue: false,
      });
    }
  });

  it('string 类型', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  日志: string`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({
        name: '日志',
        type: 'string',
        defaultValue: '',
      });
    }
  });

  it('多个变量混合声明', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  生命值: int
  暴击率: float
  钥匙: bool
  日志: string`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(4);
      expect(result.data.variables.map((v) => v.name)).toEqual([
        '生命值', '暴击率', '钥匙', '日志',
      ]);
    }
  });
});

// ============================================================================
// 枚举类型
// ============================================================================

describe('parseFrontmatter - 枚举类型', () => {
  it('基本枚举（英文逗号）', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  职业: enum[战士, 法师, 盗贼]`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({
        name: '职业',
        type: 'enum',
        defaultValue: '战士',
        enumValues: ['战士', '法师', '盗贼'],
      });
    }
  });

  it('枚举（中文逗号）', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  职业: enum[战士，法师，盗贼]`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({
        name: '职业',
        type: 'enum',
        defaultValue: '战士',
        enumValues: ['战士', '法师', '盗贼'],
      });
    }
  });

  it('枚举值包含英文逗号和中文逗号混合', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  种族: enum[人类, 精灵，兽人]`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({
        name: '种族',
        type: 'enum',
        defaultValue: '人类',
        enumValues: ['人类', '精灵', '兽人'],
      });
    }
  });

  it('枚举值包含引号', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  阵营: enum["光明", "黑暗"]`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({
        name: '阵营',
        type: 'enum',
        defaultValue: '光明',
        enumValues: ['光明', '黑暗'],
      });
    }
  });

  it('枚举值为空 → E003', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  职业: enum[]`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E003')).toBe(true);
    }
  });

  it('枚举值有重复 → E003', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  职业: enum[战士, 战士, 法师]`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E003')).toBe(true);
    }
  });
});

// ============================================================================
// 对象类型
// ============================================================================

describe('parseFrontmatter - 对象类型', () => {
  it('单层对象（基本字段）', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  装备: object{
    武器: string
    等级: int
  }`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const eq = result.data.variables[0]!;
      expect(eq).toMatchObject({
        name: '装备',
        type: 'object',
      });
      expect(eq.defaultValue).toEqual({
        武器: '',
        等级: 0,
      });
      expect(eq.fields).toHaveLength(2);
    }
  });

  it('对象包含枚举字段', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  装备: object{
    武器: enum[剑, 弓, 杖]
    耐久度: int
  }`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const eq = result.data.variables[0]!;
      expect(eq).toMatchObject({ type: 'object' });
      expect(eq.defaultValue).toEqual({
        武器: '剑',
        耐久度: 0,
      });
    }
  });

  it('两层嵌套对象', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  角色: object{
    属性: object{
      力量: int
      敏捷: int
    }
    名字: string
  }`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({ type: 'object' });
      const v = result.data.variables[0]!;
      const defaultValue = v.defaultValue as Record<string, unknown>;
      expect(defaultValue['名字']).toBe('');
      expect(defaultValue['属性']).toMatchObject({ 力量: 0, 敏捷: 0 });
      expect(v.fields).toHaveLength(2);
    }
  });

  it('三层嵌套对象（合法上限）', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  数据: object{
    层1: object{
      层2: object{
        字段: int
      }
    }
  }`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const d = result.data.variables[0]!.defaultValue as Record<string, unknown>;
      const l1 = d['层1'] as Record<string, unknown>;
      const l2 = l1['层2'] as Record<string, unknown>;
      expect(l2['字段']).toBe(0);
    }
  });

  it('四层嵌套 → E006', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  数据: object{
    层1: object{
      层2: object{
        层3: object{
          字段: int
        }
      }
    }
  }`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E006')).toBe(true);
    }
  });
});

// ============================================================================
// 重复声明检测
// ============================================================================

describe('parseFrontmatter - 重复声明', () => {
  it('顶层变量重复 → E008', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  生命值: int
  生命值: float`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E008')).toBe(true);
    }
  });

  it('对象内字段重复 → E008', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  装备: object{
    武器: int
    武器: string
  }`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E008')).toBe(true);
    }
  });
});

// ============================================================================
// 保留字检测
// ============================================================================

describe('parseFrontmatter - 保留字', () => {
  it('使用保留字 int 作为变量名 → E005', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  int: string`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('使用保留字 AND 作为变量名 → E005', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  AND: int`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('使用保留字 vars 作为变量名 → E005', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  vars: bool`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });
});

// ============================================================================
// 变量名格式验证
// ============================================================================

describe('parseFrontmatter - 变量名格式', () => {
  it('中文字符变量名', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  生命值: int`));
    expect(result.ok).toBe(true);
  });

  it('中英混合变量名', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  HP生命值: int`));
    expect(result.ok).toBe(true);
  });

  it('下划线变量名', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  player_hp: int`));
    expect(result.ok).toBe(true);
  });

  it('以数字开头 → E005', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  1life: int`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('以下划线开头 → E005（非法首字符）', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  _hidden: int`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('超长变量名（>64 码点）→ E005', () => {
    const longName = 'a'.repeat(65);
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  ${longName}: int`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('恰好 64 码点 → 合法', () => {
    const name64 = 'a'.repeat(64);
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  ${name64}: int`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]!.name).toHaveLength(64);
    }
  });
});

// ============================================================================
// 特殊字符
// ============================================================================

describe('parseFrontmatter - 特殊字符', () => {
  it('emoji 在变量名中（非法首字符）→ E005', () => {
    // emoji 不是 \p{L} 字母，应该报错
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  😊生命值: int`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('emoji 在元信息字符串值中 → 不崩溃', () => {
    const result = parseFrontmatter(fm(`title: "冒险😊日记"\nvars:\n  生命值: int`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('冒险😊日记');
    }
  });

  it('日文字符变量名', () => {
    const result = parseFrontmatter(fm(`title: "テスト"\nvars:\n  体力: int`));
    expect(result.ok).toBe(true);
  });

  it('韩文字符变量名', () => {
    const result = parseFrontmatter(fm(`title: "테스트"\nvars:\n  체력: int`));
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// 元信息解析
// ============================================================================

describe('parseFrontmatter - 元信息', () => {
  it('完整元信息', () => {
    const result = parseFrontmatter(`---
plotflow: "0.1"
title: "勇者传说"
author: "张三"
engine: godot
vars:
  生命值: int
---`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.plotflow).toBe('0.1');
      expect(result.data.title).toBe('勇者传说');
      expect(result.data.author).toBe('张三');
      expect(result.data.engine).toBe('godot');
    }
  });

  it('只有标题无变量', () => {
    const result = parseFrontmatter(`---
title: "极简故事"
---`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('极简故事');
      expect(result.data.variables).toEqual([]);
    }
  });

  it('无 vars 区段', () => {
    const result = parseFrontmatter(`---
title: "只有元信息"
author: "作家A"
---`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('只有元信息');
      expect(result.data.author).toBe('作家A');
      expect(result.data.variables).toEqual([]);
    }
  });
});

// ============================================================================
// CRLF 换行符
// ============================================================================

describe('parseFrontmatter - CRLF 换行符', () => {
  it('Windows 风格 CRLF 换行符', () => {
    const raw = '---\r\ntitle: "测试"\r\nvars:\r\n  生命值: int\r\n---\r\n';
    const result = parseFrontmatter(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(1);
      expect(result.data.variables[0]).toMatchObject({
        name: '生命值',
        type: 'int',
        defaultValue: 0,
      });
    }
  });

  it('混合 LF 和 CRLF', () => {
    const raw = '---\r\ntitle: "测试"\nvars:\r\n  生命值: int\n---\r\n';
    const result = parseFrontmatter(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(1);
    }
  });
});

// ============================================================================
// YAML 语法错误
// ============================================================================

describe('parseFrontmatter - YAML 语法错误', () => {
  it('元信息 YAML 语法错误 → E005', () => {
    const raw = '---\ntitle: [非法YAML\nvars:\n  生命值: int\n---\n';
    const result = parseFrontmatter(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('Frontmatter 缺少闭合 --- → 视为无 Frontmatter', () => {
    const raw = '---\ntitle: "测试"\nvars:\n  生命值: int\n';
    // 没有闭合的 ---，正则会匹配失败，返回空 variables
    const result = parseFrontmatter(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
    }
  });
});

// ============================================================================
// 行号追踪
// ============================================================================

describe('parseFrontmatter - 行号追踪', () => {
  it('每个变量的 lineNumber 正确（1-based，绝对行号）', () => {
    const raw = [
      '---',
      'title: "测试"',
      'vars:',
      '  生命值: int',
      '---',
      '',
    ].join('\n');
    const result = parseFrontmatter(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Frontmatter 内容从第 2 行开始（第 1 行是 ---）
      // vars: 在第 3 行，变量在第 4 行
      expect(result.data.variables[0]!.lineNumber).toBe(4);
    }
  });

  it('多个变量行号递增', () => {
    const raw = [
      '---',
      'title: "测试"',
      'vars:',
      '  生命值: int',
      '  魔力值: int',
      '  暴击率: float',
      '---',
    ].join('\n');
    const result = parseFrontmatter(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]!.lineNumber).toBe(4);
      expect(result.data.variables[1]!.lineNumber).toBe(5);
      expect(result.data.variables[2]!.lineNumber).toBe(6);
    }
  });

  it('对象字段行号正确', () => {
    const raw = [
      '---',
      'title: "测试"',
      'vars:',
      '  装备: object{',
      '    武器: string',
      '    等级: int',
      '  }',
      '---',
    ].join('\n');
    const result = parseFrontmatter(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const eq = result.data.variables[0]!;
      expect(eq.lineNumber).toBe(4); // 装备
      expect(eq.fields![0]!.lineNumber).toBe(5); // 武器
      expect(eq.fields![1]!.lineNumber).toBe(6); // 等级
    }
  });
});

// ============================================================================
// 格式变体
// ============================================================================

describe('parseFrontmatter - 格式变体', () => {
  it('Frontmatter 后紧跟文本内容', () => {
    const raw = '---\ntitle: "测试"\nvars:\n  生命值: int\n---\n# 第一章\n正文内容开始\n';
    const result = parseFrontmatter(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(1);
    }
  });

  it('vars: 后有注释行', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  # 这是一个注释
  生命值: int
  # 另一个注释
  魔力值: int`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(2);
      expect(result.data.variables[0]!.name).toBe('生命值');
      expect(result.data.variables[1]!.name).toBe('魔力值');
    }
  });

  it('空行在变量之间', () => {
    const result = parseFrontmatter(fm(`title: "测试"
vars:
  生命值: int

  魔力值: int`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(2);
    }
  });

  it('使用中文冒号（U+FF1A）变量行', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  生命值： int`));
    // 中文冒号应该被解析器接受
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({
        name: '生命值',
        type: 'int',
      });
    }
  });

  it('Frontmatter 在文件开头有空白行', () => {
    // 文件以空白行开头，但 --- 不在第一行 — 正则要求 ^---
    // 这种情况下不匹配 Frontmatter
    const raw = '\n---\ntitle: "测试"\n---\n';
    const result = parseFrontmatter(raw);
    // 因为 --- 不在行首（前面有 \n），正则不会匹配
    // 但正则 /^---[ \t]*\r?\n/ 在 ^ 之前有 \n... hmm
    // ^ 匹配字符串开头，不是行首。需要用 /m 标志
    // 当前实现不处理这种情况。这是预期行为——Frontmatter 必须是文件最开头。
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
    }
  });
});

// ============================================================================
// 未知类型
// ============================================================================

describe('parseFrontmatter - 未知类型', () => {
  it('无法识别的类型 → E005', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  生命值: custom`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('类型声明为空 → E005', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  生命值:`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('变量名为空 → E005', () => {
    const result = parseFrontmatter(fm(`title: "测试"\nvars:\n  : int`));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });
});

// ============================================================================
// 回归测试
// ============================================================================

describe('parseFrontmatter - 综合场景', () => {
  it('完整的复杂 Frontmatter', () => {
    const raw = `---
plotflow: "0.1"
title: "勇者传说"
author: "张三"
engine: godot
vars:
  生命值: int
  魔力值: int
  暴击率: float
  拥有钥匙: bool
  对话记录: string
  职业: enum[战士, 法师, 盗贼, 牧师]
  装备栏: object{
    主武器: object{
      名称: string
      攻击力: int
      类型: enum[剑, 弓, 杖]
    }
    副手: enum[盾牌, 无]
    耐久度: int
  }
---
`;
    const result = parseFrontmatter(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.plotflow).toBe('0.1');
      expect(result.data.title).toBe('勇者传说');
      expect(result.data.author).toBe('张三');
      expect(result.data.engine).toBe('godot');
      expect(result.data.variables).toHaveLength(7);

      // 检查枚举变量
      const profession = result.data.variables.find((v) => v.name === '职业');
      expect(profession).toBeDefined();
      expect(profession!.enumValues).toEqual(['战士', '法师', '盗贼', '牧师']);
      expect(profession!.defaultValue).toBe('战士');

      // 检查对象变量
      const equipment = result.data.variables.find((v) => v.name === '装备栏');
      expect(equipment).toBeDefined();
      expect(equipment!.type).toBe('object');
      expect(equipment!.fields).toHaveLength(3);
      const dv = equipment!.defaultValue as Record<string, unknown>;
      expect(dv['耐久度']).toBe(0);
      expect(dv['副手']).toBe('盾牌');
      expect(dv['主武器']).toMatchObject({ 名称: '', 攻击力: 0, 类型: '剑' });
    }
  });
});
