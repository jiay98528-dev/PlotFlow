import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '../../parser/frontmatter.js';

describe('parseFrontmatter structured YAML variables', () => {
  it('完整解析默认值、作用域、描述、枚举和三层对象字段', () => {
    const result = parseFrontmatter(`---
vars:
  金币:
    type: int
    default: 42
    scope: global
    description: 当前持有金币
  职业:
    type: enum
    values: [战士, 法师, 盗贼]
    default: 法师
    scope: chapter
    chapter: 第一章
    description: 本章职业伪装
  玩家:
    type: object
    description: 玩家状态
    fields:
      名称:
        type: string
        default: 阿月
        description: 显示名称
      属性:
        type: object
        fields:
          战斗:
            type: object
            fields:
              生命:
                type: int
                default: 100
              暴击率:
                type: float
                default: 0.25
          活跃: bool
---`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.variables[0]).toMatchObject({
      name: '金币',
      type: 'int',
      defaultValue: 42,
      scope: 'global',
      description: '当前持有金币',
    });
    expect(result.data.variables[1]).toMatchObject({
      name: '职业',
      type: 'enum',
      defaultValue: '法师',
      enumValues: ['战士', '法师', '盗贼'],
      scope: 'chapter',
      chapterId: '第一章',
      description: '本章职业伪装',
    });
    expect(result.data.variables[2]).toMatchObject({
      name: '玩家',
      type: 'object',
      description: '玩家状态',
      defaultValue: {
        名称: '阿月',
        属性: {
          战斗: { 生命: 100, 暴击率: 0.25 },
          活跃: false,
        },
      },
    });
    expect(result.data.variables[2]!.fields![0]).toMatchObject({
      name: '名称',
      description: '显示名称',
    });
  });

  it('对象 default 可局部覆盖并继承字段默认值', () => {
    const result = parseFrontmatter(`---
vars:
  玩家:
    type: object
    default:
      属性:
        生命: 80
    fields:
      名称:
        type: string
        default: 无名者
      属性:
        type: object
        fields:
          生命:
            type: int
            default: 100
          存活: bool
---`);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables[0]!.defaultValue).toEqual({
        名称: '无名者',
        属性: { 生命: 80, 存活: false },
      });
    }
  });

  it('结构化声明与旧 shorthand 可混用，fields 也可渐进使用 shorthand', () => {
    const result = parseFrontmatter(`---
vars:
  金币: int
  职业: enum[战士, 法师]
  玩家:
    type: object
    fields:
      名称: string
      等级: int
  声望: { type: int, default: 7, scope: global }
---`);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables.map((variable) => variable.name)).toEqual(['金币', '职业', '玩家', '声望']);
      expect(result.data.variables[2]!.defaultValue).toEqual({ 名称: '', 等级: 0 });
      expect(result.data.variables[3]).toMatchObject({ defaultValue: 7, scope: 'global' });
    }
  });

  it.each([
    ['错误 int default', 'type: int\n    default: 1.5', 'E005'],
    ['错误 bool default', 'type: bool\n    default: "true"', 'E005'],
    ['错误 scope', 'type: string\n    scope: session', 'E005'],
    ['空枚举', 'type: enum\n    values: []', 'E003'],
    ['枚举 default 越界', 'type: enum\n    values: [A, B]\n    default: C', 'E003'],
    ['未知属性', 'type: int\n    minimum: 0', 'E005'],
  ])('%s 返回诊断而不抛异常', (_label, declaration, expectedCode) => {
    const input = `---\nvars:\n  测试:\n    ${declaration}\n---`;
    expect(() => parseFrontmatter(input)).not.toThrow();
    const result = parseFrontmatter(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.code === expectedCode)).toBe(true);
  });

  it('结构化 object 第四层触发 E006', () => {
    const result = parseFrontmatter(`---
vars:
  根:
    type: object
    fields:
      二层:
        type: object
        fields:
          三层:
            type: object
            fields:
              四层:
                type: object
                fields:
                  值: int
---`);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.code === 'E006')).toBe(true);
  });

  it('对象 default 不接受未声明字段', () => {
    const result = parseFrontmatter(`---
vars:
  玩家:
    type: object
    default:
      不存在: 1
    fields:
      生命: int
---`);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((error) => error.code === 'E005')).toBe(true);
  });
});
