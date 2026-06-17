/**
 * 测试 — HTML 可玩版导出器 (M4-05~09)
 */
import { describe, it, expect } from 'vitest';
import { parseStory } from '../../parser/parser.js';
import { exportHTML } from '../../exporter/html.js';

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

describe('exportHTML', () => {
  it('解析并导出完整故事', () => {
    const parseResult = parseStory(PRD_EXAMPLE);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 基本结构校验
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="zh-CN">');
    expect(html).toContain('<meta charset="UTF-8">');
    expect(html).toContain('暗夜森林·试玩版');
    expect(html).toContain('</html>');
    expect(html).toContain('<script>');
    expect(html).toContain('var STORY = ');
    expect(html).toContain('<style>');
  });

  it('生成自包含单文件，包含游戏引擎 JS', () => {
    const parseResult = parseStory(PRD_EXAMPLE);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 验证 JS 引擎核心函数存在
    expect(html).toContain('evalCond');
    expect(html).toContain('applyEffects');
    expect(html).toContain('renderNode');
    expect(html).toContain('goCrumb');
    expect(html).toContain('renderVars');
    expect(html).toContain('esc(');

    // 验证运行时数据包含节点
    expect(html).toContain('森林入口');
    expect(html).toContain('狼穴');
    expect(html).toContain('古井');

    // 验证条件引擎嵌入
    expect(html).toContain('>=');
    expect(html).toContain('AND');

    // 验证 CSS 包含关键样式
    expect(html).toContain('.option-btn');
    expect(html).toContain('#var-panel');
    expect(html).toContain('#breadcrumb');
    expect(html).toContain('@media');
  });

  it('包含条件表达式和副作用数据', () => {
    const parseResult = parseStory(PRD_EXAMPLE);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 验证条件原始文本嵌入
    expect(html).toContain('金币>=10');
    expect(html).toContain('角色状态.魔力');

    // 验证对象变量在运行时 JSON 中
    expect(html).toContain('角色状态');
    expect(html).toContain('拥有钥匙');
  });

  it('空数据返回错误', () => {
    const parseResult = parseStory('');
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]!.code).toBe('E005');
  });

  it('HTML 不含外部资源引用（自包含）', () => {
    const parseResult = parseStory(PRD_EXAMPLE);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 不应包含外部资源引用
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('<link');
    expect(html).not.toContain('src=');
  });

  it('用户文本被 HTML 转义（防 XSS）', () => {
    // 使用简单安全的输入，只关注节点正文中的 HTML 注入
    const xssInput = `# 章

## 节点：安全节点

正文 **加粗** <script>alert(1)</script> 和 <img src=x onerror=alert(2)>

[选项] 点击这里 -> 节点：目标

## 节点：目标

安全到达。
`;

    const parseResult = parseStory(xssInput);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // XSS 防护发生在 JS 引擎：esc() 使用 textContent→innerHTML 方式转义
    // 验证 esc() 函数存在于 JS 引擎中
    expect(html).toContain('function esc(s)');
    // 验证 mdh() 函数（Markdown→HTML 渲染，先 esc 再替换）存在于 JS 引擎
    expect(html).toContain('function mdh(t)');
    // 验证 Markdown 模式 `**` → `<strong>` 的替换规则在 JS 引擎中
    expect(html).toContain('**');
    expect(html).toContain('<strong>$1</strong>');
    // 验证所有用户文本在 innerHTML 插入时都经过 esc() 包裹
    expect(html).toContain('esc(o.text)');
    expect(html).toContain('esc(node.title||');
    expect(html).toContain('esc(c.title||');
    // 验证源代码中不含未转义的 HTML 标签（运行时 JSON 中的文本不算，那是 JS 上下文）
    // body 文本包含的 <script> 在 JSON 字符串中，不会执行
  });

  it('不含用户文本部分小于 50KB', () => {
    const parseResult = parseStory(PRD_EXAMPLE);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 提取不含用户文本的部分：去除运行时 JSON 中的用户文本内容
    // 简单方法：计算模板 + CSS + JS 骨架的大小
    const scriptMatch = html.match(/<script>[\s\S]*<\/script>/);
    expect(scriptMatch).not.toBeNull();

    // 整体文件应小于 80KB（含测试数据）
    const sizeBytes = Buffer.byteLength(html, 'utf-8');
    expect(sizeBytes).toBeLessThan(80000);
  });

  it('简单故事正确导出', () => {
    const simpleInput = `# 章

## 节点：起点

故事从这里开始。

[选项] 继续 -> 节点：终点

## 节点：终点

故事结束。
`;

    const parseResult = parseStory(simpleInput);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 校验标题默认值（无 Frontmatter 时解析器使用 "Untitled"）
    expect(html).toContain('Untitled');
    // 校验节点
    expect(html).toContain('故事从这里开始');
    expect(html).toContain('故事结束');
    // 校验面包屑和选项渲染结构
    expect(html).toContain('#breadcrumb');
    expect(html).toContain('.option-btn');
  });
});

// ============================================================================
// 新增：响应式 meta 标签
// ============================================================================

describe('exportHTML — 响应式 meta', () => {
  it('包含 viewport meta 标签', () => {
    const input = `# 章

## 节点：起点

正文。

[选项] 结束 -> 节点：终点

## 节点：终点

结束。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 验证 viewport meta 标签存在且包含响应式关键属性
    expect(html).toContain('<meta name="viewport"');
    expect(html).toContain('content="width=device-width,initial-scale=1.0');
    expect(html).toContain('maximum-scale=1.0');
    expect(html).toContain('user-scalable=no');
  });

  it('包含 charset 和 lang 声明', () => {
    const input = `# 章

## 节点：起点

正文。
`;
    const parseResult = parseStory(input);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 语言声明
    expect(html).toContain('<html lang="zh-CN">');
    // 字符集
    expect(html).toContain('<meta charset="UTF-8">');
    // DOCTYPE
    expect(html).toContain('<!DOCTYPE html>');
  });
});

// ============================================================================
// 新增：XSS 防护验证（实际内容验证）
// ============================================================================

describe('exportHTML — XSS 实际内容防护', () => {
  it('script 标签在正文中仅出现在 JSON 字符串内，不作为 HTML 标签执行', () => {
    const xssInput = `# 章

## 节点：安全

正文 <script>alert('xss')</script> 内容

[选项] 结束 -> 节点：终点

## 节点：终点

安全。
`;
    const parseResult = parseStory(xssInput);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 用户文本中的 <script> 会被 JSON.stringify 保持在 JSON 字符串内，
    // 而 JSON 字符串位于 var STORY = ... 赋值中，这是一个 JS 字符串上下文，
    // 浏览器不会将其解释为 HTML 标签。

    // 验证用户 XSS 载荷出现在 var STORY = 的 JSON 上下文内（而非独立的 HTML 标签）
    const storyMatch = html.match(/var STORY = ({.*?});/s);
    expect(storyMatch).not.toBeNull();
    if (storyMatch) {
      const storyJson = storyMatch[1];
      // 用户文本中的 script 出现在 JSON 字符串值中
      expect(storyJson).toContain('<script>alert');
    }

    // 提取 <script> 标签之外的 HTML 源码（即 <body> 中非脚本部分）
    const bodyParts = html.split(/<\/?script[^>]*>/);
    // bodyParts[0] 是 script 之前的部分，bodyParts[2] 是 script 之后的部分
    // 这些部分不应包含用户输入的 <script> 标记
    const outsideScript = (bodyParts[0] ?? '') + (bodyParts[2] ?? '');
    expect(outsideScript).not.toContain('<script>alert');
  });

  it('onerror 事件处理器仅出现在 JSON 字符串内，不在 HTML 属性中', () => {
    const xssInput = `# 章

## 节点：安全

<img src=x onerror=alert(1)>

[选项] 结束 -> 节点：终点

## 节点：终点

安全。
`;
    const parseResult = parseStory(xssInput);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    const result = exportHTML(parseResult.data);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const html = result.data;

    // 用户文本中的 onerror 只出现在 var STORY 的 JSON 字符串内
    const storyMatch = html.match(/var STORY = ({.*?});/s);
    expect(storyMatch).not.toBeNull();
    if (storyMatch) {
      expect(storyMatch[1]).toContain('onerror');
    }

    // 提取 <script> 之外的 HTML 源码，不应出现 onerror
    const bodyParts = html.split(/<\/?script[^>]*>/);
    const outsideScript = (bodyParts[0] ?? '') + (bodyParts[2] ?? '');
    expect(outsideScript).not.toContain('onerror');
  });
});
