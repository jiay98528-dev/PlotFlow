/**
 * 单元测试 — Frontmatter 解析器 (M1-01)
 */
import { describe, it, expect } from 'vitest';
import { parseFrontmatter } from '../../parser/frontmatter.js';

describe('parseFrontmatter', () => {
  // ==========================================================================
  // 1. 空/无 Frontmatter
  // ==========================================================================

  it('空文件 → 空 variables 无错误', () => {
    const result = parseFrontmatter('');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
    }
  });

  it('纯 Markdown 无 --- 块 → 空 variables', () => {
    const result = parseFrontmatter('# 普通 Markdown\n\n一些文字\n');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
    }
  });

  it('仅 --- 包围无内容 → 空 variables', () => {
    const result = parseFrontmatter('---\n---\n\n# 后续内容');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
    }
  });

  // ==========================================================================
  // 2. 元信息
  // ==========================================================================

  it('解析元信息字段 (title/author/engine/plotflow)', () => {
    const input = `---
title: 暗夜传说
author: 风行者
engine: godot
plotflow: 0.1
---
# 第一章：森林入口`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('暗夜传说');
      expect(result.data.author).toBe('风行者');
      expect(result.data.engine).toBe('godot');
      expect(result.data.plotflow).toBe('0.1');
      expect(result.data.variables).toEqual([]);
    }
  });

  it('元信息仅 title → 其他字段 undefined', () => {
    const result = parseFrontmatter('---\ntitle: My Story\n---\n# Content');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('My Story');
      expect(result.data.author).toBeUndefined();
      expect(result.data.engine).toBeUndefined();
      expect(result.data.plotflow).toBeUndefined();
    }
  });

  it('元信息中 plotflow 为数字 → 转为字符串', () => {
    const input = '---\nplotflow: 0.1\n---\n';
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.plotflow).toBe('0.1');
    }
  });

  // ==========================================================================
  // 3. 基本类型变量
  // ==========================================================================

  it('声明 int 类型变量', () => {
    const input = `---
vars:
  金币: int
  等级: int
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(2);
      expect(result.data.variables[0]).toMatchObject({ name: '金币', type: 'int', defaultValue: 0 });
      expect(result.data.variables[1]).toMatchObject({ name: '等级', type: 'int', defaultValue: 0 });
    }
  });

  it('声明 float 类型变量', () => {
    const input = `---
vars:
  好感度: float
  攻击倍率: float
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({ name: '好感度', type: 'float', defaultValue: 0.0 });
      expect(result.data.variables[1]).toMatchObject({ name: '攻击倍率', type: 'float', defaultValue: 0.0 });
    }
  });

  it('声明 bool 类型变量', () => {
    const input = `---
vars:
  是否存活: bool
  已解锁: bool
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({ name: '是否存活', type: 'bool', defaultValue: false });
      expect(result.data.variables[1]).toMatchObject({ name: '已解锁', type: 'bool', defaultValue: false });
    }
  });

  it('声明 string 类型变量', () => {
    const input = `---
vars:
  玩家名: string
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]).toMatchObject({ name: '玩家名', type: 'string', defaultValue: '' });
    }
  });

  // ==========================================================================
  // 4. 枚举类型
  // ==========================================================================

  it('声明 enum 类型变量（半角逗号）', () => {
    const input = `---
vars:
  职业: enum[战士, 法师, 盗贼]
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const v = result.data.variables[0]!;
      expect(v).toMatchObject({ name: '职业', type: 'enum', defaultValue: '战士' });
      expect(v.enumValues).toEqual(['战士', '法师', '盗贼']);
    }
  });

  it('声明 enum 类型变量（全角逗号）', () => {
    const input = `---
vars:
  属性: enum[火，水，风，土]
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]!.enumValues).toEqual(['火', '水', '风', '土']);
    }
  });

  it('枚举值带引号', () => {
    const input = `---
vars:
  武器: enum["长剑", '短剑', '魔杖']
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]!.enumValues).toEqual(['长剑', '短剑', '魔杖']);
    }
  });

  it('枚举值列表为空 → E003', () => {
    const input = `---
vars:
  职业: enum[]
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E003');
    }
  });

  it('枚举值重复 → E003', () => {
    const input = `---
vars:
  职业: enum[战士, 法师, 战士]
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E003');
    }
  });

  // ==========================================================================
  // 5. Object 类型
  // ==========================================================================

  it('声明 object 类型变量（单层字段）', () => {
    const input = `---
vars:
  角色状态: object{
    生命值: int
    魔力值: int
  }
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const v = result.data.variables[0]!;
      expect(v).toMatchObject({ name: '角色状态', type: 'object' });
      expect(v.fields).toHaveLength(2);
      expect(v.fields![0]).toMatchObject({ name: '生命值', type: 'int', defaultValue: 0 });
      expect(v.fields![1]).toMatchObject({ name: '魔力值', type: 'int', defaultValue: 0 });
    }
  });

  it('object 嵌套 3 层 → 成功', () => {
    const input = `---
vars:
  装备: object{
    武器: object{
      基础攻击: int
      属性加成: object{
        火焰: int
        冰霜: int
      }
    }
  }
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const v = result.data.variables[0]!;
      expect(v.type).toBe('object');
      expect(v.fields![0]!.fields![1]!.fields).toHaveLength(2);
    }
  });

  it('object 嵌套超限（4 层 → E006）', () => {
    const input = `---
vars:
  深度测试: object{
    L1: object{
      L2: object{
        L3: object{
          L4: int
        }
      }
    }
  }
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const e006Errors = result.errors.filter((e) => e.code === 'E006');
      expect(e006Errors.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('object 结束标记 } 缩进匹配父级', () => {
    const input = `---
vars:
  人物: object{
    姓名: string
    年龄: int
  }
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(1);
      expect(result.data.variables[0]!.fields).toHaveLength(2);
    }
  });

  // ==========================================================================
  // 6. 变量重复声明
  // ==========================================================================

  it('变量重复声明 → E008', () => {
    const input = `---
vars:
  金币: int
  金币: float
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E008');
    }
  });

  it('object 字段重复声明 → E008', () => {
    const input = `---
vars:
  人物: object{
    姓名: string
    姓名: int
  }
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const e008Errors = result.errors.filter((e) => e.code === 'E008');
      expect(e008Errors.length).toBeGreaterThanOrEqual(1);
    }
  });

  // ==========================================================================
  // 7. 特殊字符
  // ==========================================================================

  it('变量名含 Unicode 字符（中文）', () => {
    const input = `---
vars:
  角色名称: string
  等级: int
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]!.name).toBe('角色名称');
    }
  });

  it('变量名含 Unicode 字符（Emoji） → 报错', () => {
    const input = `---
vars:
  😊: string
---`;
    const result = parseFrontmatter(input);
    // Emoji 不是 \p{L}（不是字母），所以不通过变量名验证
    expect(result.ok).toBe(false);
  });

  it('变量默认值合理（struct 类型）', () => {
    const input = `---
vars:
  人物: object{
    姓名: string
    等级: int
  }
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const dv = result.data.variables[0]!.defaultValue;
      expect(dv).toEqual({ 姓名: '', 等级: 0 });
    }
  });

  // ==========================================================================
  // 8. YAML 语法错误 & 缺少字段
  // ==========================================================================

  it('YAML 语法错误 → E005', () => {
    const input = '---\ntitle: "不匹配的引号\n---\n';
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E005');
    }
  });

  it('变量声明缺少类型 → E005', () => {
    const input = `---
vars:
  金币:
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E005');
    }
  });

  it('保留字作为变量名 → E005', () => {
    const input = `---
vars:
  int: string
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E005');
    }
  });

  it('变量名过长（超过 64 码点） → E005', () => {
    const longName = 'a'.repeat(65);
    const input = `---
vars:
  ${longName}: int
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E005');
    }
  });

  it('变量名以数字开头 → E005', () => {
    const input = `---
vars:
  123abc: int
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
  });

  it('无法识别的变量类型 → E005', () => {
    const input = `---
vars:
  金币: bigint
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]!.code).toBe('E005');
    }
  });

  it('CRLF 换行符兼容', () => {
    const input = '---\r\ntitle: CRLF测试\r\nvars:\r\n  金币: int\r\n---\r\n';
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('CRLF测试');
      expect(result.data.variables).toHaveLength(1);
    }
  });

  it('变量名含下划线', () => {
    const input = `---
vars:
  player_name: string
  max_hp: int
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(2);
      expect(result.data.variables[0]!.name).toBe('player_name');
    }
  });

  it('元信息中以 # 注释行', () => {
    const input = `---
title: 注释测试
# 这是一条 YAML 注释
author: 测试者
---
# 内容`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe('注释测试');
      expect(result.data.author).toBe('测试者');
    }
  });

  it('vars: 后有注释行', () => {
    const input = `---
vars:
  金币: int
  等级: int
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(2);
    }
  });

  it('混合所有变量类型', () => {
    const input = `---
title: 完整测试
vars:
  HP: int
  倍率: float
  存活: bool
  名字: string
  职业: enum[战士,法师]
  状态: object{
    体力: int
    魔力: int
  }
---`;
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toHaveLength(6);
      const types = result.data.variables.map((v) => v.type);
      expect(types).toContain('int');
      expect(types).toContain('float');
      expect(types).toContain('bool');
      expect(types).toContain('string');
      expect(types).toContain('enum');
      expect(types).toContain('object');
    }
  });
});
