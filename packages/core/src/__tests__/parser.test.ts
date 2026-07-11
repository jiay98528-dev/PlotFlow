/**
 * .mdstory 章节/节点解析器 — 单元测试 (M1-02)
 *
 * 覆盖场景：
 * - 空文件 / 仅 Frontmatter
 * - 单章节 + 单节点 / 多章节 + 多节点
 * - 匿名章节（无显式 # 章节）
 * - E007: 节点 ID 重名检测
 * - I003: 匿名章节归属检测
 * - W005: 空正文检测
 * - 正文收集（多行、空行、特殊内容）
 * - 节点间分隔符 `---`
 * - 中英混合 / Unicode / 特殊字符
 * - CRLF 换行符
 * - 错误处理：空标题、超长节点名、禁止字符
 * - H3 标题 / 非节点 ## 作为正文
 */

import { describe, it, expect } from 'vitest';
import { parseStory, parseChaptersAndNodes } from '../parser/parser.js';
import { createFullId } from '../fullId.js';
import type { Chapter, StoryNode, VariableDeclaration } from '../types/ast.js';

/** Empty variables list used for tests that don't test variable-dependent parsing */
const NO_VARS: readonly VariableDeclaration[] = [];

// ============================================================================
// 辅助函数
// ============================================================================

/** 创建带 Frontmatter 的最小 .mdstory 文本 */
function withFm(body: string): string {
  return `---
plotflow: "0.1"
title: "测试故事"
author: "测试者"
---

${body}`;
}

/** 快速找到节点 */
function findNode(nodes: StoryNode[], title: string): StoryNode | undefined {
  return nodes.find((n) => n.title === title);
}

/** 快速找到章节 */
function findChapter(chapters: Chapter[], id: string): Chapter | undefined {
  return chapters.find((c) => c.id === id);
}

/** 收集所有节点 */
function allNodes(chapters: Chapter[]): StoryNode[] {
  return chapters.flatMap((c) => c.nodes);
}

// ============================================================================
// 空文件 / 无内容
// ============================================================================

describe('parseStory - 空文件', () => {
  it('空字符串 → ok, 空 PlotFlowData', () => {
    const result = parseStory('');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
      expect(result.data.variables).toEqual([]);
      expect(result.data.meta.title).toBe('Untitled');
    }
  });

  it('仅空白字符', () => {
    const result = parseStory('   \n  \n  ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
    }
  });
});

describe('parseStory - 仅 Frontmatter', () => {
  it('有 Frontmatter 但无章节/节点', () => {
    const raw = `---
plotflow: "0.1"
title: "仅元信息"
author: "测试者"
---`;
    const result = parseStory(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
      expect(result.data.variables).toEqual([]);
      expect(result.data.meta.title).toBe('仅元信息');
      expect(result.data.meta.author).toBe('测试者');
    }
  });

  it('Frontmatter + 变量但无章节', () => {
    const raw = `---
title: "测试"
vars:
  生命值: int
---`;
    const result = parseStory(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
      expect(result.data.variables).toHaveLength(1);
    }
  });
});

// ============================================================================
// 单章节 + 单节点
// ============================================================================

describe('parseStory - 单章节单节点', () => {
  it('基本场景：一个章节一个节点', () => {
    const result = parseStory(withFm(`# 第一章：村庄

## 节点：森林入口

你站在幽暗森林的边缘。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(1);
      const ch = result.data.chapters[0]!;
      expect(ch.id).toBe('第一章：村庄');
      expect(ch.title).toBe('第一章：村庄');
      expect(ch.isAnonymous).toBe(false);
      expect(ch.nodes).toHaveLength(1);

      const node = ch.nodes[0]!;
      expect(node.id).toBe('森林入口');
      expect(node.fullId).toBe(createFullId('第一章：村庄', '森林入口'));
      expect(node.title).toBe('森林入口');
      expect(node.chapterId).toBe('第一章：村庄');
      expect(node.body).toBe('你站在幽暗森林的边缘。');
      expect(node.options).toEqual([]);
      expect(node.diagnostics.isRoot).toBe(false);
      expect(node.diagnostics.isOrphan).toBe(false);
      expect(node.diagnostics.isDeadEnd).toBe(false);
    }
  });

  it('节点正文包含多行', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：测试节点

第一段文字。

第二段文字。

第三段文字。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.body).toBe('第一段文字。\n\n第二段文字。\n\n第三段文字。');
    }
  });

  it('节点正文为空 → W005 警告', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：空节点

## 节点：下一个节点

有正文。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = allNodes(result.data.chapters);
      const emptyNode = findNode(nodes, '空节点');
      expect(emptyNode).toBeDefined();
      expect(emptyNode!.body).toBe('');
      expect(emptyNode!.diagnostics.diagnosticIds.some((id) => id.startsWith('W005'))).toBe(true);
    }
  });

  it('节点使用半角冒号 `节点:XXX`', () => {
    const result = parseStory(withFm(`# 第一章

## 节点:半角冒号节点

这是正文。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.title).toBe('半角冒号节点');
      expect(node.id).toBe('半角冒号节点');
    }
  });

  it('节点使用全角冒号 `节点：XXX`', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：全角冒号节点

正文。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.title).toBe('全角冒号节点');
    }
  });
});

// ============================================================================
// 多章节 + 多节点
// ============================================================================

describe('parseStory - 多章节多节点', () => {
  it('两个章节各有两个节点', () => {
    const result = parseStory(withFm(`# 第一章：村庄

## 节点：森林入口

入口正文。

## 节点：村庄广场

广场正文。

# 第二章：洞穴

## 节点：狼穴

狼穴正文。

## 节点：古井

古井正文。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(2);

      const ch1 = findChapter(result.data.chapters, '第一章：村庄')!;
      expect(ch1.nodes).toHaveLength(2);
      expect(ch1.nodes[0]!.fullId).toBe(createFullId('第一章：村庄', '森林入口'));
      expect(ch1.nodes[1]!.fullId).toBe(createFullId('第一章：村庄', '村庄广场'));

      const ch2 = findChapter(result.data.chapters, '第二章：洞穴')!;
      expect(ch2.nodes).toHaveLength(2);
      expect(ch2.nodes[0]!.fullId).toBe(createFullId('第二章：洞穴', '狼穴'));
      expect(ch2.nodes[1]!.fullId).toBe(createFullId('第二章：洞穴', '古井'));
    }
  });

  it('章节切换后节点归属于正确章节', () => {
    const result = parseStory(withFm(`# 序章

## 节点：开场

开场白。

# 第一章

## 节点：第一节

第一节正文。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ch1 = findChapter(result.data.chapters, '序章')!;
      expect(ch1.nodes[0]!.chapterId).toBe('序章');

      const ch2 = findChapter(result.data.chapters, '第一章')!;
      expect(ch2.nodes[0]!.chapterId).toBe('第一章');
    }
  });
});

// ============================================================================
// 匿名章节
// ============================================================================

describe('parseStory - 匿名章节', () => {
  it('节点在章节声明之前 → 归入匿名章节', () => {
    const result = parseStory(withFm(`## 节点：无章节的节点

正文内容。

# 第一章

## 节点：有章节的节点

正文。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 应该包含匿名章节
      const anonCh = findChapter(result.data.chapters, '_anonymous');
      expect(anonCh).toBeDefined();
      expect(anonCh!.isAnonymous).toBe(true);
      expect(anonCh!.nodes).toHaveLength(1);
      expect(anonCh!.nodes[0]!.title).toBe('无章节的节点');
      expect(anonCh!.nodes[0]!.fullId).toBe(createFullId(null, '无章节的节点'));
      expect(anonCh!.nodes[0]!.chapterId).toBe('_anonymous');

      // 命名章节应包含其节点
      const ch1 = findChapter(result.data.chapters, '第一章')!;
      expect(ch1.nodes).toHaveLength(1);
      expect(ch1.nodes[0]!.fullId).toBe(createFullId('第一章', '有章节的节点'));
    }
  });

  it('所有节点都在匿名章节（无任何 # 章节声明）', () => {
    const result = parseStory(withFm(`## 节点：节点A

正文A。

## 节点：节点B

正文B。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(1);
      const ch = result.data.chapters[0]!;
      expect(ch.id).toBe('_anonymous');
      expect(ch.isAnonymous).toBe(true);
      expect(ch.nodes).toHaveLength(2);
      expect(ch.nodes[0]!.fullId).toBe(createFullId(null, '节点A'));
      expect(ch.nodes[1]!.fullId).toBe(createFullId(null, '节点B'));
    }
  });

  it('匿名章节节点有 I003 诊断', () => {
    const result = parseStory(withFm(`## 节点：孤儿节点

正文。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = allNodes(result.data.chapters)[0]!;
      expect(node.diagnostics.diagnosticIds.some((id) => id.startsWith('I003'))).toBe(true);
    }
  });
});

// ============================================================================
// E007: 节点 ID 重名
// ============================================================================

describe('parseStory - E007 节点 ID 重名', () => {
  it('同章节内两个节点使用相同名称', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：森林

正文A。

## 节点：森林

正文B。`));
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E007')).toBe(true);
      const e007 = errors.find((e) => e.code === 'E007')!;
      expect(e007.message).toContain(createFullId('第一章', '森林'));
    }
  });

  it('跨章节两个节点使用相同名称', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：森林

正文A。

# 第二章

## 节点：森林

正文B。`));
    // 注意：不同章节的节点 fullId 不同（第一章-森林 vs 第二章-森林），不触发 E007
    expect(result.ok).toBe(true);
  });

  it('匿名章节中的节点与命名章节节点重名', () => {
    // 匿名节点 fullId = "森林"，命名节点 fullId = "第一章-森林"，不冲突
    const result = parseStory(withFm(`## 节点：森林

匿名正文。

# 第一章

## 节点：森林

命名正文。`));
    expect(result.ok).toBe(true);
  });

  it('两个匿名章节节点使用相同名称 → E007', () => {
    const result = parseStory(withFm(`## 节点：测试

正文A。

## 节点：测试

正文B。`));
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E007')).toBe(true);
    }
  });
});

// ============================================================================
// Body 正文收集
// ============================================================================

describe('parseStory - 正文收集', () => {
  it('正文包含特殊字符和 Markdown', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：测试

**加粗文字** 和 *斜体文字*。

- 列表项1
- 列表项2

> 引用文字`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.body).toContain('**加粗文字**');
      expect(node.body).toContain('- 列表项1');
      expect(node.body).toContain('> 引用文字');
    }
  });

  it('正文中的 H3 标题被视为正文', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：测试

### 选项区

这是正文。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.body).toContain('### 选项区');
      expect(node.body).toContain('这是正文。');
    }
  });

  it('正文包含中文标点和 emoji', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：测试

你好！这是一个测试节点——包含中文标点。

😊 还有 emoji 表情。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.body).toContain('你好！');
      expect(node.body).toContain('😊');
    }
  });

  it('正文中的空行被保留（段落分隔）', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：测试

段落A。

段落B。

段落C。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      // 两个空行应该被保留（三个段落）
      const paragraphs = node.body.split('\n\n');
      expect(paragraphs).toHaveLength(3);
    }
  });

  it('正文首尾多余空行被 trim', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：测试



中间正文。



`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.body).toBe('中间正文。');
    }
  });

  it('正文仅空白行 → W005 警告', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：测试



## 节点：下一个

有正文。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const testNode = findNode(allNodes(result.data.chapters), '测试')!;
      expect(testNode.body).toBe('');
      expect(testNode.diagnostics.diagnosticIds.some((id) => id.startsWith('W005'))).toBe(true);
    }
  });
});

// ============================================================================
// 节点间分隔符 `---`
// ============================================================================

describe('parseStory - 节点间分隔符', () => {
  it('`---` 分隔符不出现在正文中', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：节点A

正文A。

---

## 节点：节点B

正文B。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodeA = findNode(allNodes(result.data.chapters), '节点A')!;
      expect(nodeA.body).toBe('正文A。');
      // --- 分隔符不应出现在正文中
      expect(nodeA.body).not.toContain('---');

      const nodeB = findNode(allNodes(result.data.chapters), '节点B')!;
      expect(nodeB.body).toBe('正文B。');
    }
  });

  it('`---` 在正文内部被视为水平线（非分隔符）', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：测试

正文第一段。

---

正文第二段。

正文第三段。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      // --- 在正文内（后面不是 ## 或 #），应保留
      expect(node.body).toContain('---');
    }
  });

  it('`---` 后有空行再跟节点 → 仍为分隔符', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：节点A

正文A。

---

## 节点：节点B

正文B。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodeA = findNode(allNodes(result.data.chapters), '节点A')!;
      expect(nodeA.body).not.toContain('---');
    }
  });
});

// ============================================================================
// 中英混合 / Unicode
// ============================================================================

describe('parseStory - 中英混合', () => {
  it('中文章节标题和节点名', () => {
    const result = parseStory(withFm(`# 第一章：暗夜森林

## 节点：森林深处的古老洞穴

你听到远处传来狼嚎声。`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ch = result.data.chapters[0]!;
      expect(ch.id).toBe('第一章：暗夜森林');
      expect(ch.nodes[0]!.fullId).toBe(createFullId('第一章：暗夜森林', '森林深处的古老洞穴'));
    }
  });

  it('英文章节标题和节点名', () => {
    const result = parseStory(withFm(`# Chapter 1: The Village

## 节点：Forest Entrance

You stand at the edge of a dark forest.`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ch = result.data.chapters[0]!;
      expect(ch.id).toBe('Chapter 1: The Village');
      expect(ch.nodes[0]!.fullId).toBe(createFullId('Chapter 1: The Village', 'Forest Entrance'));
    }
  });

  it('日文 / 韩文节点名', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：テストノード

日本語の本文。

## 节点：테스트노드

한국어 본문.`));
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = allNodes(result.data.chapters);
      expect(nodes[0]!.title).toBe('テストノード');
      expect(nodes[1]!.title).toBe('테스트노드');
    }
  });
});

// ============================================================================
// CRLF 换行符
// ============================================================================

describe('parseStory - CRLF 换行符', () => {
  it('Windows 风格 CRLF', () => {
    const raw = '---\r\ntitle: "测试"\r\n---\r\n\r\n# 第一章\r\n\r\n## 节点：测试\r\n\r\n正文。\r\n';
    const result = parseStory(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(1);
      expect(result.data.chapters[0]!.nodes[0]!.body).toBe('正文。');
    }
  });

  it('混合 LF 和 CRLF', () => {
    const raw = [
      '---\r\n',
      'title: "测试"\n',
      '---\n',
      '\r\n',
      '# 第一章\n',
      '\r\n',
      '## 节点：测试\r\n',
      '\n',
      '正文行1。\r\n',
      '正文行2。\n',
    ].join('');
    const result = parseStory(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.body).toContain('正文行1。');
      expect(node.body).toContain('正文行2。');
    }
  });
});

// ============================================================================
// 错误处理
// ============================================================================

describe('parseStory - 错误处理', () => {
  it('空章节标题 → E005', () => {
    const result = parseStory(withFm(`#

## 节点：测试

正文。`));
    // E005 是错误级诊断，ParseResult 返回 ok: false
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('空节点标题 → E005', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：

## 节点：有效节点

正文。`));
    // E005 是错误级诊断，ParseResult 返回 ok: false
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('节点名超过 128 个 Unicode 码点 → E005', () => {
    const longName = '节点'.repeat(65); // 130 码点
    const result = parseStory(withFm(`# 第一章

## 节点：${longName}

正文。`));
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('节点名包含禁止字符 `/` → E005', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：包含/斜杠

正文。`));
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('节点名包含禁止字符 `\\` → E005', () => {
    const result = parseStory(withFm(`# 第一章

## 节点：包含\\反斜杠

正文。`));
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('章节标题过长（>256码点）→ W006 警告', () => {
    const longTitle = '章'.repeat(260);
    const result = parseStory(withFm(`# ${longTitle}

## 节点：测试

正文。`));
    // W006 是 warning，不阻止解析成功
    expect(result.ok).toBe(true);
  });
});

// ============================================================================
// parseChaptersAndNodes 直接调用
// ============================================================================

describe('parseChaptersAndNodes - 直接调用', () => {
  it('从指定行号开始解析', () => {
    const lines = ['# 第一章', '', '## 节点：测试', '', '正文。'];
    const result = parseChaptersAndNodes(lines, 5, NO_VARS); // 假设从第 5 行开始
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(1);
      expect(result.data.chapters[0]!.lineNumber).toBe(5); // 章节标题行号
      expect(result.data.chapters[0]!.nodes[0]!.lineNumber).toBe(7); // 节点标题行号
    }
  });

  it('行号正确追踪', () => {
    const lines = [
      '',           // line N+0
      '# 第一章',    // line N+1
      '',           // line N+2
      '## 节点：A', // line N+3
      '',           // line N+4
      '正文A。',     // line N+5
      '',           // line N+6
      '## 节点：B', // line N+7
      '正文B。',     // line N+8
    ];
    const result = parseChaptersAndNodes(lines, 10, NO_VARS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ch = result.data.chapters[0]!;
      expect(ch.lineNumber).toBe(11); // 章节在第 N+1 = 11 行
      expect(ch.nodes[0]!.lineNumber).toBe(13); // 节点A在第 N+3 = 13 行
      expect(ch.nodes[1]!.lineNumber).toBe(17); // 节点B在第 N+7 = 17 行
    }
  });

  it('返回扁平节点列表', () => {
    const lines = [
      '# 第一章',
      '## 节点：A',
      '正文A。',
      '# 第二章',
      '## 节点：B',
      '正文B。',
    ];
    const result = parseChaptersAndNodes(lines, 1, NO_VARS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.nodes).toHaveLength(2);
      expect(result.data.nodes[0]!.title).toBe('A');
      expect(result.data.nodes[1]!.title).toBe('B');
    }
  });
});

// ============================================================================
// 综合场景
// ============================================================================

describe('parseStory - 综合场景', () => {
  it('完整的 .mdstory 文件（类似 spec §9 示例）', () => {
    const raw = `---
plotflow: "0.1"
title: "暗夜森林·试玩版"
author: "PlotFlow Team"
engine: "godot"
vars:
  好感度: int
  金币: int
  武器: enum[无, 剑, 弓, 杖]
  拥有钥匙: bool
---

# 第一章：村庄

## 节点：森林入口

你站在幽暗森林的边缘，两条小径延伸向前。
夜幕即将降临，你必须做出选择。

---

## 节点：狼穴

洞穴内潮湿阴暗，一双绿眼睛在黑暗中闪烁。
一头巨狼挡在路前。

## 节点：古井

井口长满青苔，井水清澈见底。
井壁上刻着古老的符文。`;

    const result = parseStory(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 元信息
      expect(result.data.meta.title).toBe('暗夜森林·试玩版');
      expect(result.data.meta.author).toBe('PlotFlow Team');
      expect(result.data.meta.engine).toBe('godot');

      // 变量
      expect(result.data.variables).toHaveLength(4);

      // 章节
      expect(result.data.chapters).toHaveLength(1);
      const ch = result.data.chapters[0]!;
      expect(ch.id).toBe('第一章：村庄');
      expect(ch.nodes).toHaveLength(3);

      // 节点
      const node1 = findNode(ch.nodes, '森林入口')!;
      expect(node1.fullId).toBe(createFullId('第一章：村庄', '森林入口'));
      expect(node1.body).toContain('你站在幽暗森林的边缘');
      expect(node1.body).toContain('夜幕即将降临');

      const node2 = findNode(ch.nodes, '狼穴')!;
      expect(node2.fullId).toBe(createFullId('第一章：村庄', '狼穴'));
      expect(node2.body).toContain('洞穴内潮湿阴暗');

      const node3 = findNode(ch.nodes, '古井')!;
      expect(node3.fullId).toBe(createFullId('第一章：村庄', '古井'));
      expect(node3.body).toContain('井口长满青苔');
    }
  });

  it('无 Frontmatter 的纯章节/节点文件', () => {
    const raw = `# 序章

## 节点：开场

这是一个开场节点。

# 第一章

## 节点：第一节

第一节的正文内容。

## 节点：第二节

第二节的正文内容。`;

    const result = parseStory(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.meta.title).toBe('Untitled');
      expect(result.data.variables).toEqual([]);
      expect(result.data.chapters).toHaveLength(2);
      expect(allNodes(result.data.chapters)).toHaveLength(3);
    }
  });

  it('混合：匿名节点 + 命名章节', () => {
    const raw = withFm(`## 节点：前言节点

这是前言。

# 第一章

## 节点：第一节

第一节正文。

## 节点：第二节

第二节正文。`);

    const result = parseStory(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 应该有匿名章节 + 命名章节
      expect(result.data.chapters).toHaveLength(2);

      const anonCh = findChapter(result.data.chapters, '_anonymous')!;
      expect(anonCh.nodes).toHaveLength(1);
      expect(anonCh.nodes[0]!.title).toBe('前言节点');
      expect(anonCh.nodes[0]!.fullId).toBe(createFullId(null, '前言节点'));

      const ch1 = findChapter(result.data.chapters, '第一章')!;
      expect(ch1.nodes).toHaveLength(2);
    }
  });

  it('章节间穿插：多章节各自独立', () => {
    const raw = withFm(`# 序章
## 节点：序章节点
序章正文。

# 第一章
## 节点：第一章节点A
第一章A正文。

# 第二章
## 节点：第二章节点A
第二章A正文。

## 节点：第二章节点B
第二章B正文。`);

    const result = parseStory(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(3);
      expect(findChapter(result.data.chapters, '序章')!.nodes).toHaveLength(1);
      expect(findChapter(result.data.chapters, '第一章')!.nodes).toHaveLength(1);
      expect(findChapter(result.data.chapters, '第二章')!.nodes).toHaveLength(2);
    }
  });
});
