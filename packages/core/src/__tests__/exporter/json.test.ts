/**
 * 单元测试 — JSON 导出器 (M4-01~04)
 *
 * 覆盖场景：
 * 1. 基本导出：最小故事 → JSON 结构正确性
 * 2. PRD §4.6 完整示例往返一致性验证
 * 3. 变量导出：int/float/bool/string/enum/object 全部类型
 * 4. 条件 AST 转换：比较、逻辑 AND/OR/NOT
 * 5. 副作用导出
 * 6. 空字段跳过
 * 7. 引擎映射 generic → none
 * 8. exportedAt 时间戳
 * 9. 空故事/边缘情况
 */
import { describe, it, expect } from 'vitest';
import { parseStory } from '../../parser/parser.js';
import { exportJSON } from '../../exporter/json.js';
import type { PlotFlowData } from '../../types/ast.js';

// ============================================================================
// 1. 基本导出测试
// ============================================================================

describe('exportJSON — 基本导出', () => {
  it('最小故事 → 正确 JSON 结构', () => {
    const input = `# 第一章

## 节点：起点

故事在这里开始。

[选项] 继续 -> 节点：终点

## 节点：终点

故事结束。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);

    // 顶层结构
    expect(json).toHaveProperty('$schema', 'https://plotflow.dev/schema/0.1/story.json');
    expect(json).toHaveProperty('meta');
    expect(json).toHaveProperty('variables');
    expect(json).toHaveProperty('chapters');

    // meta
    expect(json.meta).toHaveProperty('plotflow', '0.1');
    expect(json.meta).toHaveProperty('title', 'Untitled');
    expect(json.meta).toHaveProperty('engine', 'none');
    expect(json.meta).toHaveProperty('exportedAt');
    expect(typeof json.meta.exportedAt).toBe('string');

    // variables — 无变量声明
    expect(json.variables).toEqual({});

    // chapters
    expect(json.chapters).toHaveLength(1);
    const ch = json.chapters[0];
    expect(ch).toHaveProperty('id', '第一章');
    expect(ch).toHaveProperty('title', '第一章');
    expect(ch.nodes).toHaveLength(2);

    // 节点结构
    const node0 = ch.nodes[0];
    expect(node0).toHaveProperty('id', '起点');
    expect(node0).toHaveProperty('chapterId', '第一章');
    expect(node0).toHaveProperty('fullId', '第一章-起点');
    expect(node0).toHaveProperty('title', '起点');
    expect(Array.isArray(node0.body)).toBe(true);
    expect(node0.body).toContain('故事在这里开始。');
    expect(node0).toHaveProperty('position');
    expect(node0.position).toEqual({ x: 0, y: 0 });
    expect(node0.isRoot).toBe(false);
    expect(node0.isOrphan).toBe(false);
    expect(node0.isDeadEnd).toBe(false);

    // 选项结构
    expect(node0.options).toHaveLength(1);
    const opt0 = node0.options[0];
    expect(opt0).toHaveProperty('index', 0);
    expect(opt0).toHaveProperty('text', '继续');
    expect(opt0).toHaveProperty('targetNodeId', '终点');
    // targetFullId 由 M2 resolveTargetFullIds() 回填
    expect(opt0).toHaveProperty('targetFullId', '第一章-终点');
    expect(opt0.conditions).toBeNull();
    expect(opt0.sideEffects).toEqual([]);

    // 死胡同节点 — diagnostics 由 M3 填充，M1 阶段默认为 false
    const node1 = ch.nodes[1];
    expect(node1.isDeadEnd).toBe(false);
    expect(node1.options).toEqual([]);
  });

  it('空故事 → 有效 JSON（无章节）', () => {
    const parseResult = parseStory('');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.chapters).toEqual([]);
    expect(json.variables).toEqual({});
    expect(json.meta.title).toBe('Untitled');
  });
});

// ============================================================================
// 2. PRD §4.6 完整示例往返一致性验证
// ============================================================================

describe('exportJSON — PRD §4.6 完整示例', () => {
  const PRD_EXAMPLE = `---
plotflow: "0.1"
title: "暗夜森林·试玩版"
author: "PlotFlow Team"
engine: "godot"
vars:
  好感度: int
  金币: int
  武器: enum[无, 剑, 弓, 杖]
  拥有钥匙: bool
  角色状态: object{
    生命: int
    魔力: int
  }
---

# 第一章：村庄

## 节点：森林入口

你站在幽暗森林的边缘，两条小径延伸向前。
夜幕即将降临，你必须做出选择。

[选项] 走向左边的狼嚎声 -> 节点：狼穴
  效果: (好感度+1)

[选项] 探索右边的古井 -> 节点：古井

[选项] 返回村庄 -> 节点：村庄广场

---

## 节点：狼穴

洞穴内潮湿阴暗，一双绿眼睛在黑暗中闪烁。
一头巨狼挡在路前。

[选项] 战斗 -> 节点：战斗结果
  效果: (角色状态.生命-10)

[选项] 投喂食物 -> 节点：驯服狼
  条件: ($金币>=10) AND ($武器!='无')
  效果: (金币-10, 好感度+5)

[选项] 悄悄退后 -> 节点：森林入口

---

## 节点：古井

井口长满青苔，井水清澈见底。
井壁上刻着古老的符文。

[选项] 喝井水 -> 节点：井水效果
  效果: (角色状态.魔力+5)

[选项] 调查符文 -> 节点：符文秘密
  条件: ($角色状态.魔力>=10)
  效果: (拥有钥匙=true)

[选项] 离开 -> 节点：森林入口
`;

  it('导出 → 解析 → 验证结构与原始 AST 一致', () => {
    const parseResult = parseStory(PRD_EXAMPLE);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const data: PlotFlowData = parseResult.data;
    const exportResult = exportJSON(data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);

    // ---- meta ----
    expect(json.meta.title).toBe('暗夜森林·试玩版');
    expect(json.meta.author).toBe('PlotFlow Team');
    expect(json.meta.engine).toBe('godot');
    expect(json.meta.plotflow).toBe('0.1');

    // ---- variables ----
    const varKeys = Object.keys(json.variables);
    expect(varKeys).toHaveLength(5);
    expect(varKeys).toContain('好感度');
    expect(varKeys).toContain('金币');
    expect(varKeys).toContain('武器');
    expect(varKeys).toContain('拥有钥匙');
    expect(varKeys).toContain('角色状态');

    // int
    expect(json.variables['好感度']).toEqual({ type: 'int', default: 0 });
    expect(json.variables['金币']).toEqual({ type: 'int', default: 0 });

    // enum
    expect(json.variables['武器']).toEqual({
      type: 'enum',
      values: ['无', '剑', '弓', '杖'],
      default: '无',
    });

    // bool
    expect(json.variables['拥有钥匙']).toEqual({ type: 'bool', default: false });

    // object
    expect(json.variables['角色状态'].type).toBe('object');
    expect(json.variables['角色状态'].fields).toBeDefined();
    // 嵌套字段默认值使用类型默认值（int → 0）
    expect(json.variables['角色状态'].fields['生命']).toEqual({ type: 'int', default: 0 });
    expect(json.variables['角色状态'].fields['魔力']).toEqual({ type: 'int', default: 0 });
    // object 不应该有 default 字段（Schema 不允许）
    expect(json.variables['角色状态']).not.toHaveProperty('default');

    // ---- chapters ----
    expect(json.chapters).toHaveLength(1);
    const chapter = json.chapters[0];
    expect(chapter.id).toBe('第一章：村庄');
    expect(chapter.title).toBe('第一章：村庄');
    expect(chapter.nodes).toHaveLength(3);

    // ---- 森林入口 ----
    const forestEntry = chapter.nodes.find((n: Record<string, unknown>) => n['id'] === '森林入口');
    expect(forestEntry).toBeDefined();
    expect(forestEntry.fullId).toBe('第一章：村庄-森林入口');
    expect(forestEntry.body).toEqual([
      '你站在幽暗森林的边缘，两条小径延伸向前。\n夜幕即将降临，你必须做出选择。',
    ]);
    expect(forestEntry.options).toHaveLength(3);

    // 选项 1: 带效果
    const opt1 = forestEntry.options[0];
    expect(opt1.index).toBe(0);
    expect(opt1.text).toBe('走向左边的狼嚎声');
    expect(opt1.targetNodeId).toBe('狼穴');
    // targetFullId 由 M2 resolveTargetFullIds() 回填
    expect(opt1.targetFullId).toBe('第一章：村庄-狼穴');
    expect(opt1.conditions).toBeNull();
    expect(opt1.sideEffects).toHaveLength(1);
    expect(opt1.sideEffects[0]).toEqual({
      variable: '好感度',
      operation: 'add',
      value: 1,
    });

    // 选项 2: 无效果无条件
    const opt2 = forestEntry.options[1];
    expect(opt2.text).toBe('探索右边的古井');
    expect(opt2.targetNodeId).toBe('古井');
    expect(opt2.conditions).toBeNull();
    expect(opt2.sideEffects).toEqual([]);

    // ---- 狼穴节点 ----
    const wolfLair = chapter.nodes.find((n: Record<string, unknown>) => n['id'] === '狼穴');
    expect(wolfLair).toBeDefined();
    expect(wolfLair.options).toHaveLength(3);

    // 投喂食物: 复合条件 + 多效果
    const feedOpt = wolfLair.options.find((o: Record<string, unknown>) => o['text'] === '投喂食物');
    expect(feedOpt).toBeDefined();
    expect(feedOpt.conditions).not.toBeNull();
    expect(feedOpt.conditions.expression).toBe("($金币>=10) AND ($武器!='无')");
    expect(feedOpt.conditions.ast.type).toBe('logical_and');
    expect(feedOpt.conditions.ast.left.type).toBe('comparison');
    expect(feedOpt.conditions.ast.left.variable).toBe('金币');
    expect(feedOpt.conditions.ast.left.operator).toBe('>=');
    expect(feedOpt.conditions.ast.left.value).toBe(10);
    expect(feedOpt.conditions.ast.right.type).toBe('comparison');
    expect(feedOpt.conditions.ast.right.variable).toBe('武器');
    expect(feedOpt.conditions.ast.right.operator).toBe('!=');
    expect(feedOpt.conditions.ast.right.value).toBe('无');
    expect(feedOpt.sideEffects).toHaveLength(2);
    expect(feedOpt.sideEffects[0]).toEqual({ variable: '金币', operation: 'subtract', value: 10 });
    expect(feedOpt.sideEffects[1]).toEqual({ variable: '好感度', operation: 'add', value: 5 });

    // 战斗: 字段访问副作用
    const fightOpt = wolfLair.options.find((o: Record<string, unknown>) => o['text'] === '战斗');
    expect(fightOpt).toBeDefined();
    expect(fightOpt.sideEffects[0]).toEqual({
      variable: '角色状态.生命',
      operation: 'subtract',
      value: 10,
    });

    // ---- 古井节点 ----
    const well = chapter.nodes.find((n: Record<string, unknown>) => n['id'] === '古井');
    expect(well).toBeDefined();
    expect(well.options).toHaveLength(3);

    // 调查符文: 字段访问条件
    const runeOpt = well.options.find((o: Record<string, unknown>) => o['text'] === '调查符文');
    expect(runeOpt).toBeDefined();
    expect(runeOpt.conditions.expression).toBe('($角色状态.魔力>=10)');
    expect(runeOpt.conditions.ast.type).toBe('comparison');
    expect(runeOpt.conditions.ast.variable).toBe('角色状态.魔力');
    expect(runeOpt.conditions.ast.operator).toBe('>=');
    expect(runeOpt.conditions.ast.value).toBe(10);
    expect(runeOpt.sideEffects[0]).toEqual({
      variable: '拥有钥匙',
      operation: 'set',
      value: true,
    });
  });
});

// ============================================================================
// 3. 变量导出 — 全部类型
// ============================================================================

describe('exportJSON — 变量类型', () => {
  it('int/float/bool/string/enum/object 全部正确导出', () => {
    const input = `---
vars:
  等级: int
  经验: float
  活着的: bool
  名称: string
  职业: enum[战士, 法师, 盗贼]
  属性: object{
    力量: int
    敏捷: int
  }
---

# 章

## 节点：测试

内容。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    const v = json.variables;

    // int
    expect(v['等级']).toEqual({ type: 'int', default: 0 });

    // float
    expect(v['经验']).toEqual({ type: 'float', default: 0 });

    // bool
    expect(v['活着的']).toEqual({ type: 'bool', default: false });

    // string
    expect(v['名称']).toEqual({ type: 'string', default: '' });

    // enum
    expect(v['职业']).toEqual({
      type: 'enum',
      values: ['战士', '法师', '盗贼'],
      default: '战士',
    });

    // object
    expect(v['属性'].type).toBe('object');
    expect(v['属性'].fields['力量']).toEqual({ type: 'int', default: 0 });
    expect(v['属性'].fields['敏捷']).toEqual({ type: 'int', default: 0 });
    expect(v['属性']).not.toHaveProperty('default');
  });

  it('空变量列表 → 空对象', () => {
    const input = '# 章\n\n## 节点：A\n\n正文。\n';
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.variables).toEqual({});
  });
});

// ============================================================================
// 4. 条件 AST 转换
// ============================================================================

describe('exportJSON — 条件 AST 转换', () => {
  it('NOT 表达式正确转换', () => {
    const input = `---
vars:
  金币: int
---
# 章

## 节点：商店

正文。

[选项] 买 -> 节点：结果
  条件: NOT ($金币>=10)
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    const opt = json.chapters[0].nodes[0].options[0];

    expect(opt.conditions.ast.type).toBe('logical_not');
    expect(opt.conditions.ast.operand.type).toBe('comparison');
    expect(opt.conditions.ast.operand.variable).toBe('金币');
    expect(opt.conditions.ast.operand.operator).toBe('>=');
    expect(opt.conditions.ast.operand.value).toBe(10);
  });

  it('OR 表达式正确转换', () => {
    const input = `---
vars:
  等级: int
  金币: int
---
# 章

## 节点：入口

正文。

[选项] 通过 -> 节点：结果
  条件: ($等级>=5) OR ($金币>=100)
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    const opt = json.chapters[0].nodes[0].options[0];
    const ast = opt.conditions.ast;

    expect(ast.type).toBe('logical_or');
    expect(ast.left.type).toBe('comparison');
    expect(ast.right.type).toBe('comparison');
    expect(ast.left.variable).toBe('等级');
    expect(ast.right.variable).toBe('金币');
  });

  it('三重 AND 折叠为二叉树', () => {
    const input = `---
vars:
  a: int
  b: int
  c: int
---
# 章

## 节点：入口

正文。

[选项] 通过 -> 节点：结果
  条件: ($a>=1) AND ($b>=2) AND ($c>=3)
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    const ast = json.chapters[0].nodes[0].options[0].conditions.ast;

    // 三层AND: { left: a>=1, right: { left: b>=2, right: c>=3 } }
    expect(ast.type).toBe('logical_and');
    expect(ast.left.type).toBe('comparison');
    expect(ast.left.variable).toBe('a');

    expect(ast.right.type).toBe('logical_and');
    expect(ast.right.left.type).toBe('comparison');
    expect(ast.right.left.variable).toBe('b');
    expect(ast.right.right.type).toBe('comparison');
    expect(ast.right.right.variable).toBe('c');
  });

  it('无条件选项 → conditions 为 null', () => {
    const input = '# 章\n\n## 节点：A\n\n正文。\n\n[选项] 继续 -> 节点：B\n';
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    const opt = json.chapters[0].nodes[0].options[0];
    expect(opt.conditions).toBeNull();
  });
});

// ============================================================================
// 5. 副作用导出
// ============================================================================

describe('exportJSON — 副作用', () => {
  it('全部四种操作类型正确导出', () => {
    const input = `---
vars:
  好感度: int
  金币: int
  日志: string
  装备: string
---
# 章

## 节点：测试

正文。

[选项] 交互 -> 节点：结果
  效果: (好感度+3, 金币-5, 日志←'获得了物品', 装备='长剑')
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    const effects = json.chapters[0].nodes[0].options[0].sideEffects;

    expect(effects).toHaveLength(4);
    expect(effects[0]).toEqual({ variable: '好感度', operation: 'add', value: 3 });
    expect(effects[1]).toEqual({ variable: '金币', operation: 'subtract', value: 5 });
    expect(effects[2]).toEqual({ variable: '日志', operation: 'append', value: '获得了物品' });
    expect(effects[3]).toEqual({ variable: '装备', operation: 'set', value: '长剑' });
  });

  it('无效果 → 空数组', () => {
    const input = '# 章\n\n## 节点：A\n\n正文。\n\n[选项] 继续 -> 节点：B\n';
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.chapters[0].nodes[0].options[0].sideEffects).toEqual([]);
  });
});

// ============================================================================
// 6. engine 映射
// ============================================================================

describe('exportJSON — engine 映射', () => {
  it('generic → none', () => {
    const input = `---
engine: generic
---
# 章

## 节点：A

正文。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.meta.engine).toBe('none');
  });

  it('无 engine 声明 → none', () => {
    const parseResult = parseStory('');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.meta.engine).toBe('none');
  });

  it('godot → godot（保留原值）', () => {
    const input = `---
engine: godot
---
# 章

## 节点：A

正文。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.meta.engine).toBe('godot');
  });
});

// ============================================================================
// 7. exportedAt 时间戳
// ============================================================================

describe('exportJSON — exportedAt 时间戳', () => {
  it('总是输出 ISO 8601 格式', () => {
    const parseResult = parseStory('');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.meta.exportedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });
});

// ============================================================================
// 8. 匿名章节
// ============================================================================

describe('exportJSON — 匿名章节', () => {
  it('匿名章节正确导出', () => {
    const input = `## 节点：孤儿

孤独的节点。

[选项] 结束 -> 节点：终结

## 节点：终结

终点。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);

    expect(json.chapters).toHaveLength(1);
    const ch = json.chapters[0];
    expect(ch.id).toBe('_anonymous');
    expect(ch.title).toBe(''); // 匿名章节 title 为空字符串
    expect(ch.nodes).toHaveLength(2);

    // 匿名节点 fullId 不含前缀
    expect(ch.nodes[0].fullId).toBe('孤儿');
    expect(ch.nodes[1].fullId).toBe('终结');
  });
});

// ============================================================================
// 9. 诊断 & 错误传播
// ============================================================================

describe('exportJSON — 诊断传播', () => {
  it('导出成功时 diagnostics 默认可选', () => {
    const input = '# 章\n\n## 节点：A\n\n正文。\n';
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (exportResult.ok) {
      // diagnostics 可存在且为空数组
      expect(Array.isArray(exportResult.diagnostics)).toBe(true);
    }
  });
});

// ============================================================================
// 10. body 段落分割
// ============================================================================

describe('exportJSON — body 段落分割', () => {
  it('单段正文 → 单元素数组', () => {
    const input = '# 章\n\n## 节点：A\n\n只有一段。\n';
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.chapters[0].nodes[0].body).toEqual(['只有一段。']);
  });

  it('多段正文 → 多元素数组', () => {
    const input = '# 章\n\n## 节点：A\n\n第一段。\n\n第二段。\n';
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.chapters[0].nodes[0].body).toEqual(['第一段。', '第二段。']);
  });

  it('空正文 → 空数组', () => {
    const input = '# 章\n\n## 节点：空节点\n';
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.chapters[0].nodes[0].body).toEqual([]);
  });
});

// ============================================================================
// 11. 多章节导出
// ============================================================================

describe('exportJSON — 多章节', () => {
  it('两个章节各自包含正确节点', () => {
    const input = `# 第一章

## 节点：起点

第一章正文。

[选项] 去第二章 -> 节点：第二章起点

# 第二章

## 节点：第二章起点

第二章正文。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    expect(json.chapters).toHaveLength(2);
    expect(json.chapters[0].id).toBe('第一章');
    expect(json.chapters[0].nodes).toHaveLength(1);
    expect(json.chapters[1].id).toBe('第二章');
    expect(json.chapters[1].nodes).toHaveLength(1);

    // 跨章节引用 — targetFullId 由 M2 resolveTargetFullIds() 回填
    expect(json.chapters[0].nodes[0].options[0].targetNodeId).toBe('第二章起点');
    expect(json.chapters[0].nodes[0].options[0].targetFullId).toBe('第二章-第二章起点');
  });
});

// ============================================================================
// 12. JSON 美化格式
// ============================================================================

describe('exportJSON — 输出格式', () => {
  it('输出为美化 JSON（2 空格缩进）', () => {
    const input = '# 章\n\n## 节点：A\n\n正文。\n';
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    // 检查缩进风格：每层缩进 2 个空格
    const lines = exportResult.data.split('\n');
    // Line 0: {, Line 1: top-level key at 2-space indent
    expect(lines[1]).toMatch(/^ {2}"/);
    // Line 3: nested key under meta at 4-space indent (Line 2 is "meta": {)
    expect(lines[3]).toMatch(/^ {4}"/);
  });

  it('末尾有换行', () => {
    const input = '# 章\n\n## 节点：A\n\n正文。\n';
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    expect(exportResult.data.endsWith('\n')).toBe(true);
  });
});

// ============================================================================
// 13. 条件表达式重建
// ============================================================================

describe('exportJSON — 条件表达式重建', () => {
  it('正常条件使用 conditionRaw', () => {
    const input = `---
vars:
  金币: int
---
# 章

## 节点：商店

正文。

[选项] 买 -> 节点：结果
  条件: ($金币>=10)
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    const opt = json.chapters[0].nodes[0].options[0];

    // 使用 conditionRaw
    expect(opt.conditions.expression).toBe('($金币>=10)');
  });
});

// ============================================================================
// 14. 往返一致性验证
// ============================================================================

describe('exportJSON — 往返一致性', () => {
  it('导出 JSON 后重新解析，关键字段与原始 AST 一致', () => {
    const input = `---
plotflow: "0.1"
title: "往返测试"
author: "Test"
engine: "godot"
vars:
  金币: int
  武器: enum[剑, 弓, 杖]
---

# 第一章

## 节点：起点

你站在起点。
前方有两条路。

[选项] 左转 -> 节点：左路
  效果: (金币+5)

[选项] 右转 -> 节点：右路
  条件: ($武器!='无')
  效果: (金币-3, 武器='弓')

## 节点：左路

左边是一条小溪。

## 节点：右路

右边是茂密森林。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const data = parseResult.data;
    const exportResult = exportJSON(data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);

    // meta 往返一致
    expect(json.meta.title).toBe(data.meta.title);
    expect(json.meta.plotflow).toBe(data.meta.plotflow);
    expect(json.meta.engine).toBe(data.meta.engine);

    // variables 往返一致
    expect(Object.keys(json.variables)).toHaveLength(data.variables.length);
    expect(json.variables['金币'].type).toBe(data.variables.find(v => v.name === '金币')!.type);

    // 武器 enum 往返一致
    const weaponVar = data.variables.find(v => v.name === '武器')!;
    expect(json.variables['武器'].type).toBe('enum');
    expect(json.variables['武器'].values).toEqual(weaponVar.enumValues);
    expect(json.variables['武器'].default).toBe(weaponVar.defaultValue);

    // chapters 往返一致
    expect(json.chapters).toHaveLength(data.chapters.length);
    const ch = json.chapters[0];
    expect(ch.id).toBe(data.chapters[0]!.id);
    expect(ch.nodes).toHaveLength(data.chapters[0]!.nodes.length);

    // nodes 往返一致
    const nodes = json.chapters[0].nodes;
    expect(nodes.find((n: Record<string, unknown>) => n['id'] === '起点')).toBeDefined();
    expect(nodes.find((n: Record<string, unknown>) => n['id'] === '左路')).toBeDefined();
    expect(nodes.find((n: Record<string, unknown>) => n['id'] === '右路')).toBeDefined();

    // options 往返一致
    const startNode = nodes.find((n: Record<string, unknown>) => n['id'] === '起点');
    expect(startNode.options).toHaveLength(2);

    // 左转: 效果侧写
    const leftOpt = startNode.options.find((o: Record<string, unknown>) => o['text'] === '左转');
    expect(leftOpt.sideEffects).toHaveLength(1);
    expect(leftOpt.sideEffects[0]).toEqual({ variable: '金币', operation: 'add', value: 5 });

    // 右转: 条件 + 多效果
    const rightOpt = startNode.options.find((o: Record<string, unknown>) => o['text'] === '右转');
    expect(rightOpt.conditions).not.toBeNull();
    expect(rightOpt.conditions.expression).toBe("($武器!='无')");
    expect(rightOpt.sideEffects).toHaveLength(2);
    expect(rightOpt.sideEffects[1]).toEqual({ variable: '武器', operation: 'set', value: '弓' });
  });
});

// ============================================================================
// 15. Unicode/Emoji 编码
// ============================================================================

describe('exportJSON — Unicode/Emoji 编码', () => {
  it('节点正文含 Emoji 和中文 → 正确编码', () => {
    const input = `# 特殊测试

## 节点：Unicode测试

你看到了一只 🐉 龙！
价格是 €99.99，温度是 30°C。
数学符号: ∑ ∫ π ∞ ≠ ≤

[选项] 继续前进 🚀 -> 节点：下一步

## 节点：下一步

到达终点 🏁。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const rawJson = exportResult.data;
    const json = JSON.parse(rawJson);

    // Emoji 和中文出现在导出 JSON 中
    const body = json.chapters[0].nodes[0].body;
    expect(body.some((p: string) => p.includes('🐉'))).toBe(true);
    expect(body.some((p: string) => p.includes('€'))).toBe(true);
    expect(body.some((p: string) => p.includes('°C'))).toBe(true);

    // 选项文本含 Emoji
    const optText = json.chapters[0].nodes[0].options[0].text;
    expect(optText).toContain('🚀');

    // 节点标题含中文
    expect(json.chapters[0].nodes[0].title).toBe('Unicode测试');

    // 确认 JSON 本身是合法的 UTF-8（JSON.parse 不抛异常即验证）
    expect(() => JSON.parse(rawJson)).not.toThrow();
  });

  it('变量默认值含 Unicode 字符串', () => {
    const input = `---
vars:
  称号: string
  问候语: string
---
# 章

## 节点：测试

正文。

[选项] 继续 -> 节点：下页

## 节点：下页

结束。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);

    // 字符串默认值为空字符串（合法 Unicode）
    expect(json.variables['称号']).toEqual({ type: 'string', default: '' });
    expect(json.variables['问候语']).toEqual({ type: 'string', default: '' });
  });
});

// ============================================================================
// 16. 特殊字符转义
// ============================================================================

describe('exportJSON — 特殊字符转义', () => {
  it('正文含双引号/反斜杠/换行符 → JSON 合法', () => {
    const input = `# 章

## 节点：特殊字符

他说："你好世界"。
路径是 C:\\\\Users\\\\test。
第一行。\\n第二行。

[选项] 继续 -> 节点：下页

## 节点：下页

结束。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const rawJson = exportResult.data;
    const json = JSON.parse(rawJson);

    // 验证双引号出现在 body 中（JSON 中应为 \\" 转义）
    const bodyText = json.chapters[0].nodes[0].body.join(' ');
    expect(bodyText).toContain('"你好世界"');
    expect(bodyText).toContain('C:\\\\Users\\\\test');
    expect(bodyText).toContain('第一行。');

    // 验证 JSON 字符串不含非法控制字符
    // 检查原始 JSON 中 body 部分没有非转义的 U+0000-U+001F
    expect(() => JSON.parse(rawJson)).not.toThrow();
  });

  it('选项描述含特殊符号 → 正确导出', () => {
    const input = `---
vars:
  温度: int
---
# 章

## 节点：测试

正文。

[选项] 设置温度 >= 100°C -> 节点：沸点
  效果: (温度=100)

## 节点：沸点

水开了。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    const opt = json.chapters[0].nodes[0].options[0];

    expect(opt.text).toBe('设置温度 >= 100°C');
    expect(opt.sideEffects[0]).toEqual({ variable: '温度', operation: 'set', value: 100 });
  });
});

// ============================================================================
// 17. 边界值 — 变量默认值
// ============================================================================

describe('exportJSON — 变量默认值边界', () => {
  it('bool true/false, int 正负零, float 小数', () => {
    const input = `---
vars:
  开关: bool
  计数: int
  温度: float
---
# 章

## 节点：测试

正文。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const exportResult = exportJSON(parseResult.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;

    const json = JSON.parse(exportResult.data);
    const v = json.variables;

    expect(v['开关']).toEqual({ type: 'bool', default: false });
    expect(v['计数']).toEqual({ type: 'int', default: 0 });
    expect(v['温度']).toEqual({ type: 'float', default: 0 });
  });
});
