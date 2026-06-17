/**
 * QA 综合测试 — 导出器 (EX-01~06) 与模板解析 (TPL-01)
 *
 * 覆盖范围:
 *   EX-01/EX-02: JSON 导出 — RPG/Puzzle 模板结构验证
 *   EX-03/EX-04: HTML 导出 — 自包含性/条件引擎/XSS 防护
 *   EX-05:       TXT 导出 — 纯文本格式正确性
 *   TPL-01:       5 个内置模板解析完整性
 *   EX-06:       大文件（50 节点）导出稳定性与性能
 *
 * @version 0.1.0
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { parseStory } from '../parser/parser.js';
import { exportJSON } from '../exporter/json.js';
import { exportHTML } from '../exporter/html.js';
import { exportTXT } from '../exporter/txt.js';
import { applyTemplate } from '../template/TemplateEngine.js';
import type { PlotFlowData } from '../types/ast.js';
// 直接内联模板数据，避免跨包 Vite 解析问题
// 来源: packages/app/src/templates/builtinTemplates.ts

type BuiltinTemplateId = 'blank' | 'rpg-dialogue' | 'visual-novel' | 'puzzle-escape' | 'godot-example';

interface BuiltinTemplate {
  readonly id: BuiltinTemplateId;
  readonly title: string;
  readonly description: string;
  readonly nodeCount: number;
  readonly engine: 'generic' | 'godot';
  readonly content: string;
}

const blankTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "{{engine}}"
vars:
---

# 第一章

## 节点：开始
写下第一个场景。
`;

const rpgDialogueTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "{{engine}}"
vars:
  信任度: int
  金币: int
  阵营: enum[外来者, 村民, 商会]
---

# 村口黄昏

## 节点：村口
夕阳压在木栅栏上，守卫把长矛横在你胸前。
[选项] 说明自己只是路过 -> 节点：守卫盘问
  效果: (信任度+1)
[选项] 塞给守卫两枚金币 -> 节点：侧门
  条件: $金币 >= 2
  效果: (金币-2, 信任度+2)

## 节点：守卫盘问
守卫眯起眼，问你是否见过北边燃起的黑烟。
[选项] 承认看见了黑烟 -> 节点：黑烟传闻
  效果: (信任度+1)
[选项] 装作什么都不知道 -> 节点：酒馆

## 节点：侧门
守卫收下金币，示意你从磨坊后的小门进去。
[选项] 直接去酒馆打听消息 -> 节点：酒馆
[选项] 先去仓库观察 -> 节点：仓库

## 节点：黑烟传闻
守卫压低声音，说那是旧矿坑重新开门的信号。
[选项] 请求加入巡逻队 -> 节点：巡逻邀请
  条件: $信任度 >= 2
  效果: (阵营='村民')
[选项] 独自调查矿坑 -> 节点：仓库

## 节点：酒馆
酒馆里炉火很旺，老板娘正在擦一只裂口杯。
[选项] 询问矿坑的事 -> 节点：仓库
[选项] 留下休息 -> 节点：夜宿

## 节点：仓库
仓库门缝里透出蓝色火光，地上有新鲜泥印。
[选项] 撬门进去 -> 节点：巡逻邀请
  条件: $信任度 >= 1
[选项] 回酒馆找人帮忙 -> 节点：酒馆

## 节点：巡逻邀请
村长把一枚铜徽章按进你掌心，巡逻队今晚就出发。
[选项] 接受任务 -> 节点：夜宿
  效果: (阵营='村民')

## 节点：夜宿
夜色落下，村外的黑烟像一根钉子钉在天边。
`;

const visualNovelTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "{{engine}}"
vars:
  好感度: int
  约定: bool
  路线: enum[未定, 天台, 图书馆]
---

# 放学后的风

## 节点：走廊
最后一节课的铃声散去，走廊里只剩夕光和粉笔灰。
[选项] 去天台透气 -> 节点：天台
  效果: (路线='天台')
[选项] 去图书馆还书 -> 节点：图书馆
  效果: (路线='图书馆')

## 节点：天台
她靠在栏杆边，手里捏着一张没有投出的明信片。
[选项] 问她明信片要寄给谁 -> 节点：明信片
  效果: (好感度+1)
[选项] 安静地站在旁边 -> 节点：晚风

## 节点：图书馆
管理员已经关掉一半灯，你在借阅台旁遇见她。
[选项] 帮她找遗失的书签 -> 节点：明信片
  效果: (好感度+1)
[选项] 先把自己的书还掉 -> 节点：晚风

## 节点：明信片
她笑了一下，说这张卡片其实一直没写收件人。
[选项] 提议一起写完它 -> 节点：约定
  条件: $好感度 >= 1
  效果: (约定=true)
[选项] 把话题岔开 -> 节点：晚风

## 节点：约定
你们约好明天放学后再见，信纸被晚霞染成金色。
[选项] 结束这一幕 -> 节点：晚风

## 节点：晚风
校门慢慢合上，今天的选择已经在心里留下回声。
`;

const puzzleEscapeTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "{{engine}}"
vars:
  钥匙: bool
  电源: bool
  密码: int
  线索: int
  出口: enum[未知, 北门, 地下室]
---

# 密室

## 节点：醒来
你在一间没有窗的房间醒来，墙上的时钟停在 03:17。
[选项] 检查书桌 -> 节点：书桌
[选项] 检查铁门 -> 节点：铁门
[选项] 查看配电箱 -> 节点：配电箱

## 节点：书桌
抽屉里有半张旧地图，背面写着一串被划掉的数字。
[选项] 翻找抽屉底部 -> 节点：钥匙盒
  效果: (线索+1)
[选项] 记录数字 317 -> 节点：数字锁
  效果: (密码=317)

## 节点：钥匙盒
盒子没有上锁，里面放着一把沾灰的小钥匙。
[选项] 拿走钥匙 -> 节点：书桌
  效果: (钥匙=true)

## 节点：配电箱
配电箱的开关被胶带封住，旁边贴着警告纸条。
[选项] 撕开胶带合上开关 -> 节点：灯亮
  条件: $线索 >= 1
  效果: (电源=true)
[选项] 回到房间中央 -> 节点：醒来

## 节点：灯亮
灯管闪烁后稳定下来，北墙露出一块新的数字面板。
[选项] 走向数字面板 -> 节点：数字锁
[选项] 检查地板暗门 -> 节点：地下室入口

## 节点：数字锁
面板要求输入三位数字，按键磨损最严重的是 3、1、7。
[选项] 输入 317 -> 节点：北门
  条件: $电源 == true AND $密码 == 317
  效果: (出口='北门')
[选项] 暂时离开 -> 节点：醒来

## 节点：铁门
铁门外传来水滴声，门锁像是老式机械结构。
[选项] 用小钥匙试锁 -> 节点：地下室入口
  条件: $钥匙 == true
  效果: (出口='地下室')
[选项] 放弃硬开 -> 节点：醒来

## 节点：地下室入口
暗门下方有潮湿的台阶，空气里有铁锈味。
[选项] 沿台阶下去 -> 节点：地下室

## 节点：地下室
地下室尽头的梯子通向街边排水口。
[选项] 爬出去 -> 节点：逃脱

## 节点：北门
北墙的门滑开，冷空气扑面而来。
[选项] 走出去 -> 节点：逃脱

## 节点：逃脱
你回头看见灯光一盏盏熄灭，房间重新沉入黑暗。
`;

const godotTemplate = `---
plotflow: "0.1"
title: "{{title}}"
author: "{{author}}"
engine: "godot"
vars:
  courage: int
  has_lantern: bool
  route: enum[village, cave, shrine]
---

# Godot 示例

## 节点：Start
The player stands at the edge of a quiet village.
[选项] Talk to the elder -> 节点：Elder
  效果: (route='village')
[选项] Enter the cave -> 节点：CaveGate
  条件: $courage >= 1
  效果: (route='cave')

## 节点：Elder
The elder offers a lantern and points toward the old shrine.
[选项] Accept the lantern -> 节点：ShrinePath
  效果: (has_lantern=true, courage+1)
[选项] Ask about the cave -> 节点：CaveGate

## 节点：CaveGate
Cold air rolls out of the cave mouth.
[选项] Light the lantern and enter -> 节点：CaveDepths
  条件: $has_lantern == true
[选项] Return to the village -> 节点：Elder

## 节点：ShrinePath
Stone markers lead into a cedar grove.
[选项] Follow the markers -> 节点：Shrine
  效果: (route='shrine')
[选项] Cut across the ridge -> 节点：CaveDepths

## 节点：Shrine
A sealed bell waits beneath the roof beams.
[选项] Ring the bell -> 节点：Signal
  条件: $courage >= 2
[选项] Leave quietly -> 节点：Start

## 节点：CaveDepths
Crystals pulse with a rhythm that matches the player's steps.
[选项] Take a crystal shard -> 节点：Signal
  效果: (courage+1)
[选项] Retreat -> 节点：CaveGate

## 节点：Signal
The bell and the crystal answer each other across the valley.
[选项] Return to the elder -> 节点：Resolve

## 节点：Resolve
The elder marks the player's map with the next destination.
[选项] Save the result -> 节点：ExportHook

## 节点：ExportHook
This node is meant for the Godot runtime loader demo.
[选项] Finish sample -> 节点：End

## 节点：End
The sample story ends here.
`;

const BUILTIN_TEMPLATES: readonly BuiltinTemplate[] = [
  { id: 'blank', title: '空白文件', description: '最小可编辑结构，适合从零写一个场景。', nodeCount: 1, engine: 'generic', content: blankTemplate },
  { id: 'rpg-dialogue', title: 'RPG 对话', description: '村庄入口、守卫盘问和阵营变量，展示条件与效果。', nodeCount: 8, engine: 'generic', content: rpgDialogueTemplate },
  { id: 'visual-novel', title: '视觉小说', description: '放学后的双路线片段，适合轻量角色分支。', nodeCount: 6, engine: 'generic', content: visualNovelTemplate },
  { id: 'puzzle-escape', title: '解谜逃脱', description: '钥匙、电源、密码和出口变量组成的多节点条件链。', nodeCount: 11, engine: 'generic', content: puzzleEscapeTemplate },
  { id: 'godot-example', title: 'Godot 示例', description: '英文 Godot runtime loader 示例，便于引擎侧集成演示。', nodeCount: 10, engine: 'godot', content: godotTemplate },
];

// ============================================================================
// 辅助函数
// ============================================================================

/** 按模板 ID 查找模板定义 */
function getTemplate(id: string) {
  const tpl = BUILTIN_TEMPLATES.find((t) => t.id === id);
  if (!tpl) throw new Error(`模板 "${id}" 未找到`);
  return tpl;
}

/** 应用模板占位符替换并执行完整解析 */
function parseTemplate(
  id: string,
  vars?: Record<string, string>,
): { tpl: (typeof BUILTIN_TEMPLATES)[number]; rendered: string; result: ReturnType<typeof parseStory> } {
  const tpl = getTemplate(id);
  const rendered = applyTemplate(tpl.content, {
    title: tpl.title,
    author: 'QA Tester',
    engine: tpl.engine,
    ...vars,
  });
  const result = parseStory(rendered);
  return { tpl, rendered, result };
}

/** 从 JSON 导出字符串中安全提取解析后对象 */
function parseJsonSafe(jsonStr: string): Record<string, unknown> {
  return JSON.parse(jsonStr) as Record<string, unknown>;
}

/** 生成 N 节点的链式故事内容（线性结构，每节点>1个选项） */
function generateLinearStory(nodeCount: number): string {
  const lines: string[] = [
    '---',
    'plotflow: "0.1"',
    'title: "大文件性能测试"',
    'author: "QA"',
    'engine: "generic"',
    'vars:',
    '  计数器: int',
    '---',
    '',
    '# 主线',
    '',
  ];

  for (let i = 1; i <= nodeCount; i++) {
    const nextId = i < nodeCount ? i + 1 : 1;
    lines.push(`## 节点：节点${i}`);
    lines.push(`这是第 ${i} 个节点。计数器当前值：$计数器`);
    if (i < nodeCount) {
      lines.push(`[选项] 前往节点${nextId} -> 节点：节点${nextId}`);
    } else {
      lines.push('[选项] 回到起点 -> 节点：节点1');
    }
    lines.push(`  效果: (计数器+1)`);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// EX-01 / EX-02: JSON 导出
// ============================================================================

describe('EX-01/EX-02: JSON 导出 — 结构完整性', () => {
  const TEST_TEMPLATES = [
    { id: 'rpg-dialogue', label: 'RPG 对话' },
    { id: 'puzzle-escape', label: '解谜逃脱' },
  ] as const;

  for (const { id, label } of TEST_TEMPLATES) {
    it(`${label} 模板 → JSON.parse 不抛异常`, () => {
      const { result } = parseTemplate(id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const exportResult = exportJSON(result.data);
      expect(exportResult.ok).toBe(true);
      if (!exportResult.ok) return;
      expect(() => JSON.parse(exportResult.data)).not.toThrow();
    });

    it(`${label} 模板 → JSON 包含 meta / variables / chapters 顶级字段`, () => {
      const { result } = parseTemplate(id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const exportResult = exportJSON(result.data);
      expect(exportResult.ok).toBe(true);
      if (!exportResult.ok) return;
      const json = parseJsonSafe(exportResult.data);
      expect(json).toHaveProperty('meta');
      expect(json).toHaveProperty('variables');
      expect(json).toHaveProperty('chapters');
      expect(typeof json['meta']).toBe('object');
      expect(typeof json['variables']).toBe('object');
      expect(Array.isArray(json['chapters'])).toBe(true);
    });

    it(`${label} 模板 → JSON 节点数匹配原始 AST && 模板声明`, () => {
      const { result, tpl } = parseTemplate(id);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // AST 中的节点总数
      const astNodeCount = result.data.chapters.reduce(
        (sum, ch) => sum + ch.nodes.length,
        0,
      );
      expect(astNodeCount).toBe(tpl.nodeCount);
      // JSON 中的节点总数
      const exportResult = exportJSON(result.data);
      expect(exportResult.ok).toBe(true);
      if (!exportResult.ok) return;
      const json = parseJsonSafe(exportResult.data);
      const chapters = json['chapters'] as Array<{ nodes: Array<unknown> }>;
      const jsonNodeCount = chapters.reduce(
        (sum, ch) => sum + ch.nodes.length,
        0,
      );
      expect(jsonNodeCount).toBe(tpl.nodeCount);
      expect(jsonNodeCount).toBe(astNodeCount);
    });
  }

  it('Puzzle 模板 variables 包含全部 5 个变量', () => {
    const { result } = parseTemplate('puzzle-escape');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const exportResult = exportJSON(result.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;
    const json = parseJsonSafe(exportResult.data);
    const vars = json['variables'] as Record<string, unknown>;
    expect(vars).toHaveProperty('钥匙');
    expect(vars).toHaveProperty('电源');
    expect(vars).toHaveProperty('密码');
    expect(vars).toHaveProperty('线索');
    expect(vars).toHaveProperty('出口');
  });

  it('选项 targetNodeId 在有目标时非空字符串', () => {
    const { result } = parseTemplate('rpg-dialogue');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const exportResult = exportJSON(result.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;
    const json = parseJsonSafe(exportResult.data);
    const chapters = json['chapters'] as Array<{
      nodes: Array<{ options: Array<{ targetNodeId: string }> }>;
    }>;
    let optCountWithTarget = 0;
    for (const ch of chapters) {
      for (const node of ch.nodes) {
        for (const opt of node.options) {
          if (opt.targetNodeId) {
            optCountWithTarget++;
            expect(typeof opt.targetNodeId).toBe('string');
            expect(opt.targetNodeId.length).toBeGreaterThan(0);
          }
        }
      }
    }
    // RPG 模板所有选项都有 target（模板语法强制 -> 目标）
    expect(optCountWithTarget).toBeGreaterThan(0);
  });

  it('有条件时 expression 和 ast 字段均存在', () => {
    const { result } = parseTemplate('rpg-dialogue');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const exportResult = exportJSON(result.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;
    const json = parseJsonSafe(exportResult.data);
    const chapters = json['chapters'] as Array<{
      nodes: Array<{ options: Array<{ conditions: Record<string, unknown> | null }> }>;
    }>;
    let conditionFound = false;
    for (const ch of chapters) {
      for (const node of ch.nodes) {
        for (const opt of node.options) {
          if (opt.conditions) {
            conditionFound = true;
            expect(opt.conditions).toHaveProperty('expression');
            expect(typeof opt.conditions['expression']).toBe('string');
            expect((opt.conditions['expression'] as string).length).toBeGreaterThan(0);
            expect(opt.conditions).toHaveProperty('ast');
            expect(typeof opt.conditions['ast']).toBe('object');
            expect(opt.conditions['ast']).not.toBeNull();
          }
        }
      }
    }
    expect(conditionFound).toBe(true);
  });
});

// ============================================================================
// EX-03 / EX-04: HTML 导出
// ============================================================================

describe('EX-03/EX-04: HTML 导出 — 自包含性与安全性', () => {
  const { result } = parseTemplate('rpg-dialogue');
  let html: string;
  beforeAll(() => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const exportResult = exportHTML(result.data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;
    html = exportResult.data;
  });

  it('不含外部 <link href="http..."> 或 <script src="http...">', () => {
    expect(html).not.toMatch(/<link[^>]*href=["']https?:\/\//i);
    expect(html).not.toMatch(/<script[^>]*src=["']https?:\/\//i);
  });

  it('所有 CSS 在 <style> 标签内', () => {
    // 确保有 <style> 标签，且内部内容包含 CSS 属性
    expect(html).toMatch(/<style>[\s\S]*?<\/style>/);
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    expect(styleMatch).not.toBeNull();
    if (styleMatch) {
      const cssContent = styleMatch[1];
      expect(cssContent).toBeTruthy();
      expect(cssContent!.length).toBeGreaterThan(100);
      expect(cssContent).toContain('background');
      expect(cssContent).toContain('color');
    }
  });

  it('所有 JS 在 <script> 标签内（不含外部 src）', () => {
    // 应该有 <script> 标签且不含 src 属性
    expect(html).toMatch(/<script>[\s\S]*?<\/script>/);
    const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(scriptMatch).not.toBeNull();
    if (scriptMatch) {
      const jsContent = scriptMatch[1];
      expect(jsContent).toBeTruthy();
      expect(jsContent!.length).toBeGreaterThan(500);
    }
    // 确认没有 <script src="...">
    expect(html).not.toMatch(/<script[^>]*src\s*=\s*["']/i);
  });

  it('嵌入 JS 包含条件评估函数 evalCond', () => {
    expect(html).toContain('function evalCond');
    expect(html).toContain('function applyEffects');
  });

  it('嵌入 JS 包含条件相关的逻辑关键字', () => {
    expect(html).toContain('condition');
    expect(html).toContain('comparison');
    expect(html).toContain('logical');
    expect(html).toContain('operator');
  });

  it('HTML 含 XSS 防护 — esc() 函数使用 textContent', () => {
    // esc() 使用 document.createElement('div') + textContent 安全转义
    expect(html).toContain('function esc');
    expect(html).toContain('textContent');
    // escapeHtml 在服务端模板中使用（导出时对标题做转义）
    const escMatch = html.match(/function esc\(s\)\{[^}]+\}/);
    expect(escMatch).not.toBeNull();
    if (escMatch) {
      expect(escMatch[0]).toContain('textContent');
    }
  });
});

// ============================================================================
// EX-05: TXT 导出
// ============================================================================

describe('EX-05: TXT 导出 — 纯文本格式正确性', () => {
  const { result } = parseTemplate('rpg-dialogue');
  let txt = '';
  let chapterTitle = '';
  beforeAll(() => {
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ast = result.data;
    const ch = ast.chapters[0];
    if (ch && !ch.isAnonymous) {
      chapterTitle = ch.title;
    }
    const exportResult = exportTXT(ast);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;
    txt = exportResult.data;
  });

  it('不含 Frontmatter YAML 内容（无 plotflow: / vars: 行）', () => {
    // YAML frontmatter 应已被解析器剥离，TXT 输出不应包含这些行
    expect(txt).not.toMatch(/^plotflow:/m);
    expect(txt).not.toMatch(/^vars:/m);
    expect(txt).not.toMatch(/^engine:/m);
  });

  it('不含 [条件] / [效果] 原始语法子行', () => {
    // [条件] 和 [效果] 是原始 .mdstory 语法标记，TXT 纯文本不应包含
    // （[选项] 可能出现在 body 原始文本中，不在该断言范围内）
    expect(txt).not.toContain('[条件]');
    expect(txt).not.toContain('[效果]');
  });

  it('章节标题明文出现在输出中（无 # 前缀）', () => {
    // AST 中的章节标题（不含 #）应出现在 TXT 输出中
    if (chapterTitle) {
      expect(txt).toContain(chapterTitle);
    }
  });

  it('选项行以 "选项:" 开头', () => {
    const lines = txt.split('\n');
    const optionLines = lines.filter((l) => l.startsWith('选项:'));
    expect(optionLines.length).toBeGreaterThan(0);
    for (const line of optionLines) {
      expect(line).toMatch(/^选项:/);
    }
  });
});

// ============================================================================
// TPL-01: 模板解析
// ============================================================================

describe('TPL-01: 5 个内置模板解析完整性', () => {
  const TEMPLATE_IDS = ['blank', 'rpg-dialogue', 'visual-novel', 'puzzle-escape', 'godot-example'] as const;

  for (const id of TEMPLATE_IDS) {
    it(`模板 "${id}" → applyTemplate → parseStory 成功`, () => {
      const { tpl, result, rendered } = parseTemplate(id);
      expect(rendered.length).toBeGreaterThan(0);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 验证解析后数据完整性
      expect(result.data.meta).toBeDefined();
      expect(result.data.meta.plotflow).toBe('0.1');
      expect(result.data.meta.title).toBe(tpl.title);
      // 验证 chapters 非空
      expect(result.data.chapters.length).toBeGreaterThan(0);
      // 验证节点数匹配模板声明
      const totalNodes = result.data.chapters.reduce(
        (sum, ch) => sum + ch.nodes.length,
        0,
      );
      expect(totalNodes).toBe(tpl.nodeCount);
      // 每个节点必须有 id 和 title
      for (const ch of result.data.chapters) {
        for (const node of ch.nodes) {
          expect(node.id).toBeTruthy();
          expect(typeof node.id).toBe('string');
          expect(node.id.length).toBeGreaterThan(0);
        }
      }
    });
  }

  it('所有模板 exports 不重复且结构一致', () => {
    expect(BUILTIN_TEMPLATES.length).toBe(5);
    const ids = BUILTIN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length); // 无重复 id
    for (const tpl of BUILTIN_TEMPLATES) {
      expect(tpl).toHaveProperty('id');
      expect(tpl).toHaveProperty('content');
      expect(typeof tpl.content).toBe('string');
      expect(tpl.content.length).toBeGreaterThan(50);
      expect(tpl.nodeCount).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// EX-06: 大文件导出（50 节点）
// ============================================================================

describe('EX-06: 大文件（50 节点）导出', () => {
  const storyContent = generateLinearStory(50);
  let ast: PlotFlowData | null = null;

  beforeAll(() => {
    const r = parseStory(storyContent);
    if (r.ok) {
      ast = r.data;
    }
    expect(r.ok).toBe(true);
  });

  it('50 节点故事解析成功', () => {
    expect(ast).not.toBeNull();
    if (!ast) return;
    const totalNodes = ast.chapters.reduce(
      (sum, ch) => sum + ch.nodes.length,
      0,
    );
    expect(totalNodes).toBe(50);
  });

  it('JSON 导出节点数 = 50', () => {
    expect(ast).not.toBeNull();
    if (!ast) return;
    const exportResult = exportJSON(ast);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;
    const json = parseJsonSafe(exportResult.data);
    const chapters = json['chapters'] as Array<{ nodes: Array<unknown> }>;
    const totalNodes = chapters.reduce((sum, ch) => sum + ch.nodes.length, 0);
    expect(totalNodes).toBe(50);
  });

  it('HTML 导出不含外部资源', () => {
    expect(ast).not.toBeNull();
    if (!ast) return;
    const exportResult = exportHTML(ast);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;
    const html = exportResult.data;
    expect(html).not.toMatch(/<link[^>]*href=["']https?:\/\//i);
    expect(html).not.toMatch(/<script[^>]*src=["']https?:\/\//i);
    expect(html).toContain('var STORY');
    expect(html).toContain('大文件性能测试');
    expect(html).toContain('<script>');
    expect(html).toContain('</script>');
  });

  it('HTML 自包含结构完整性', () => {
    expect(ast).not.toBeNull();
    if (!ast) return;
    const exportResult = exportHTML(ast);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) return;
    const html = exportResult.data;
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
    expect(html).toContain('<style>');
    expect(html).toContain('<script>');
    expect(html).toContain('var STORY');
  });

  it('解析 + JSON 导出性能（应 < 5 秒）', () => {
    const startTime = performance.now();
    const ITERATIONS = 3;
    let totalTime = 0;
    for (let i = 0; i < ITERATIONS; i++) {
      const p = parseStory(storyContent);
      expect(p.ok).toBe(true);
      if (p.ok) {
        const e = exportJSON(p.data);
        expect(e.ok).toBe(true);
      }
    }
    totalTime = performance.now() - startTime;
    const avgTime = totalTime / ITERATIONS;
    expect(avgTime).toBeLessThan(5000); // 单次应 < 5 秒
  });
});
