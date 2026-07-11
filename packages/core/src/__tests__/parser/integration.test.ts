/**
 * 集成测试 — 完整解析管道 (M1-01 ~ M1-05)
 *
 * 测试 parseStory 端到端解析，涵盖 Frontmatter + 章节/节点 + 选项 + 条件 + 效果。
 */
import { describe, it, expect } from 'vitest';
import { parseStory } from '../../parser/parser.js';
import { createFullId } from '../../fullId.js';
import type { PlotFlowData } from '../../types/ast.js';

// ==========================================================================
// 1. PRD §4.6 完整示例端到端测试
// ==========================================================================

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

describe('Integration — 完整解析管道', () => {
  it('PRD §4.6 完整示例端到端解析', () => {
    const result = parseStory(PRD_EXAMPLE);
    expect(result.ok).toBe(true);

    if (result.ok) {
      const data: PlotFlowData = result.data;

      // ---- 元信息 ----
      expect(data.meta.title).toBe('暗夜森林·试玩版');
      expect(data.meta.author).toBe('PlotFlow Team');
      expect(data.meta.engine).toBe('godot');
      expect(data.meta.plotflow).toBe('0.1');

      // ---- 变量 ----
      expect(data.variables).toHaveLength(5);
      const varNames = data.variables.map((v) => v.name);
      expect(varNames).toContain('好感度');
      expect(varNames).toContain('金币');
      expect(varNames).toContain('武器');
      expect(varNames).toContain('拥有钥匙');
      expect(varNames).toContain('角色状态');

      // 枚举值
      const weaponVar = data.variables.find((v) => v.name === '武器')!;
      expect(weaponVar.type).toBe('enum');
      expect(weaponVar.enumValues).toEqual(['无', '剑', '弓', '杖']);

      // object 字段
      const roleVar = data.variables.find((v) => v.name === '角色状态')!;
      expect(roleVar.type).toBe('object');
      expect(roleVar.fields).toHaveLength(2);

      // ---- 章节 ----
      expect(data.chapters).toHaveLength(1);
      const chapter = data.chapters[0]!;
      expect(chapter.id).toBe('第一章：村庄');
      expect(chapter.isAnonymous).toBe(false);

      // ---- 节点 ----
      expect(chapter.nodes).toHaveLength(3);
      const nodeNames = chapter.nodes.map((n) => n.id);
      expect(nodeNames).toContain('森林入口');
      expect(nodeNames).toContain('狼穴');
      expect(nodeNames).toContain('古井');

      // ---- fullId ----
      expect(chapter.nodes[0]!.fullId).toBe(createFullId('第一章：村庄', '森林入口'));
      expect(chapter.nodes[1]!.fullId).toBe(createFullId('第一章：村庄', '狼穴'));
      expect(chapter.nodes[2]!.fullId).toBe(createFullId('第一章：村庄', '古井'));

      // ---- 森林入口节点：3 个选项 ----
      const forestEntry = chapter.nodes.find((n) => n.id === '森林入口')!;
      expect(forestEntry.options).toHaveLength(3);

      // 选项 1: 带效果
      const opt1 = forestEntry.options[0]!;
      expect(opt1.description).toBe('走向左边的狼嚎声');
      expect(opt1.targetNodeId).toBe('狼穴');
      expect(opt1.sideEffects).toHaveLength(1);
      expect(opt1.sideEffects[0]!.variableName).toBe('好感度');
      expect(opt1.sideEffects[0]!.operation).toBe('add');
      expect(opt1.sideEffects[0]!.value).toBe(1);

      // 选项 2: 无效果无条件
      const opt2 = forestEntry.options[1]!;
      expect(opt2.description).toBe('探索右边的古井');
      expect(opt2.targetNodeId).toBe('古井');
      expect(opt2.sideEffects).toHaveLength(0);
      expect(opt2.condition).toBeNull();

      // ---- 狼穴节点：3 个选项，含条件和效果 ----
      const wolfLair = chapter.nodes.find((n) => n.id === '狼穴')!;
      expect(wolfLair.options).toHaveLength(3);

      // 投喂食物选项：复合条件 + 多效果
      const feedOpt = wolfLair.options.find((o) => o.description === '投喂食物')!;
      expect(feedOpt.conditionRaw).toBe('($金币>=10) AND ($武器!=\'无\')');
      expect(feedOpt.condition).not.toBeNull();
      expect(feedOpt.condition!.type).toBe('logical');
      expect(feedOpt.sideEffects).toHaveLength(2);

      // ---- 古井节点 ----
      const well = chapter.nodes.find((n) => n.id === '古井')!;
      expect(well.options).toHaveLength(3);

      // 调查符文选项：字段访问条件
      const runeOpt = well.options.find((o) => o.description === '调查符文')!;
      expect(runeOpt.conditionRaw).toBe('($角色状态.魔力>=10)');
      expect(runeOpt.sideEffects[0]!.variableName).toBe('拥有钥匙');
      expect(runeOpt.sideEffects[0]!.value).toBe(true);
    }
  });

  // ==========================================================================
  // 2. 空文件 → 空 PlotFlowData
  // ==========================================================================

  it('空文件 → 空 PlotFlowData', () => {
    const result = parseStory('');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
      expect(result.data.chapters).toEqual([]);
      expect(result.data.meta.title).toBe('Untitled');
    }
  });

  // ==========================================================================
  // 3. 仅 Frontmatter 无节点
  // ==========================================================================

  it('纯 Frontmatter 无节点 → ok', () => {
    const input = `---
title: 测试
vars:
  金币: int
---`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
      expect(result.data.variables).toHaveLength(1);
    }
  });

  // ==========================================================================
  // 4. 多章节多节点完整项目
  // ==========================================================================

  it('多章节多节点 + Frontmatter 完整解析', () => {
    const input = `---
title: 完整冒险
author: 测试者
engine: generic
vars:
  等级: int
  经验: float
  名称: string
---

# 第一章：开始

## 节点：起点

这里是一切开始的地方。

[选项] 出发 -> 节点：道路

---

## 节点：道路

一条蜿蜒的小路。

[选项] 继续向前 -> 节点：终点

# 第二章：结局

## 节点：终点

故事结束了。

[选项] 重新开始 -> 节点：起点
`;

    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 元信息
      expect(result.data.meta.title).toBe('完整冒险');
      expect(result.data.meta.author).toBe('测试者');
      expect(result.data.meta.engine).toBe('generic');

      // 变量
      expect(result.data.variables).toHaveLength(3);

      // 2 个章节
      expect(result.data.chapters).toHaveLength(2);
      const ch1 = result.data.chapters[0]!;
      expect(ch1.title).toBe('第一章：开始');
      expect(ch1.nodes).toHaveLength(2);

      const ch2 = result.data.chapters[1]!;
      expect(ch2.title).toBe('第二章：结局');
      expect(ch2.nodes).toHaveLength(1);

      // 跨章节引用
      const endNode = ch2.nodes[0]!;
      expect(endNode.options[0]!.targetNodeId).toBe('起点');
    }
  });

  // ==========================================================================
  // 5. 错误累积（多错误不中断）
  // ==========================================================================

  it('多错误累积 → 返回所有错误', () => {
    const input = `---
vars:
  重复: int
  重复: int
---

# 章

## 节点：A

## 节点：A
`;
    const result = parseStory(input);
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      // E008 (重复变量) + E007 (节点重名) + W005 (空正文 x2) + I003 (匿名 x2)
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(2);
      const codes = result.diagnostics.map((e) => e.code);
      expect(codes).toContain('E008');
      expect(codes).toContain('E007');
    }
  });

  it('Frontmatter 错误不中断章节解析', () => {
    const input = `---
vars:
  金币: intt
---

# 第一章

## 节点：森林

正文。
`;
    const result = parseStory(input);
    // V02-033: Frontmatter 错误不中断章节解析——AST 中仍包含正常章节和节点
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true); // Frontmatter 错误
      // 章节节点正常解析
      expect(result.data.chapters.length).toBeGreaterThanOrEqual(1);
      expect(result.data.chapters[0]!.nodes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('选项错误不中断后续节点解析', () => {
    const input = `# 章

## 节点：A

[选项]

## 节点：B

正常内容。
`;
    const result = parseStory(input);
    // V02-033: 节点 A 的选项有错误（E005），但节点 A 和 B 都被正常解析
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 检查错误诊断
      const e005Errors = result.diagnostics.filter((e) => e.code === 'E005' && e.severity === 'error');
      expect(e005Errors.length).toBeGreaterThanOrEqual(1);
      // 两个节点都被解析（节点A虽选项报错但节点本身存在）
      expect(result.data.chapters[0]!.nodes.length).toBeGreaterThanOrEqual(2);
    }
  });

  // ==========================================================================
  // 6. 选项 -> 节点目标 + 条件和效果完整链路
  // ==========================================================================

  it('条件和效果在完整解析管道中正确处理', () => {
    const input = `---
vars:
  金币: int
  好感度: int
---

# 章

## 节点：商店

欢迎光临。

[选项] 购买药剂 -> 节点：药剂
  条件: ($金币 >= 50)
  效果: (金币-30, 好感度+5)

## 节点：药剂

你获得了药剂。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const shopNode = result.data.chapters[0]!.nodes[0]!;
      expect(shopNode.options).toHaveLength(1);
      const opt = shopNode.options[0]!;
      expect(opt.targetNodeId).toBe('药剂');
      expect(opt.condition).not.toBeNull();
      expect(opt.sideEffects).toHaveLength(2);
      expect(opt.sideEffects[0]!.operation).toBe('subtract');
      expect(opt.sideEffects[1]!.operation).toBe('add');
    }
  });

  // ==========================================================================
  // 7. 无选项节点（死胡同）
  // ==========================================================================

  it('节点无选项 → 死胡同节点（选项为空数组）', () => {
    const input = `# 章

## 节点：终点

故事结束。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.options).toEqual([]);
    }
  });

  // ==========================================================================
  // 8. 仅变量无元信息
  // ==========================================================================

  it('无元信息仅有 vars → 默认元信息', () => {
    const input = `---
vars:
  等级: int
---
# 章

## 节点：A

正文。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.meta.title).toBe('Untitled');
      expect(result.data.meta.author).toBe('Unknown');
      expect(result.data.variables).toHaveLength(1);
    }
  });
});
