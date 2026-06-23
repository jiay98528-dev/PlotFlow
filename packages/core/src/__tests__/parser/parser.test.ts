/**
 * 单元测试 — 主解析器 (M1-01)
 *
 * 测试 parseStory 和 parseChaptersAndNodes。
 */
import { describe, it, expect } from 'vitest';
import { parseStory } from '../../parser/parser.js';

describe('parseStory', () => {
  // ==========================================================================
  // 1. 空/边缘
  // ==========================================================================

  it('空文件 → ok，空 PlotFlowData', () => {
    const result = parseStory('');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
      expect(result.data.variables).toEqual([]);
      expect(result.data.sourcePath).toBeNull();
      expect(result.data.meta).toMatchObject({ plotflow: '0.1', title: 'Untitled' });
    }
  });

  it('纯空白字符 → ok', () => {
    const result = parseStory('   \n  \n  ');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
    }
  });

  it('仅有分隔符 --- → ok', () => {
    const result = parseStory('---\n---');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.variables).toEqual([]);
    }
  });

  // ==========================================================================
  // 2. 纯 Frontmatter 无节点
  // ==========================================================================

  it('纯 Frontmatter 无节点 → ok', () => {
    const input = `---
title: 无节点故事
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
  // 3. 单章节单节点
  // ==========================================================================

  it('单章节单节点基本解析', () => {
    const input = `# 第一章

## 节点：森林入口

你来到一片古老的森林。

[选项] 向前走 -> 节点：林中小路
[选项] 回头 -> 节点：村庄出口
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(1);
      const ch = result.data.chapters[0]!;
      expect(ch.id).toBe('第一章');
      expect(ch.isAnonymous).toBe(false);
      expect(ch.nodes).toHaveLength(1);
      const node = ch.nodes[0]!;
      expect(node.id).toBe('森林入口');
      expect(node.fullId).toBe('第一章-森林入口');
      expect(node.chapterId).toBe('第一章');
      expect(node.options).toHaveLength(2);
    }
  });

  it('节点正文为空 → W005 警告', () => {
    const input = `# 章节

## 节点：空节点
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters[0]!.nodes[0]!.body).toBe('');
      // W005 应在 diagnostics 中
      const hasW005 = result.diagnostics.some((d) => d.code === 'W005');
      expect(hasW005).toBe(true);
    }
  });

  // ==========================================================================
  // 4. 多章节多节点
  // ==========================================================================

  it('多章节多节点解析', () => {
    const input = `# 第一章

## 节点：森林入口

森林入口描述。

[选项] 向左 -> 节点：密道

## 节点：密道

密道描述。

# 第二章

## 节点：城堡大门

城堡大门描述。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(2);
      expect(result.data.chapters[0]!.nodes).toHaveLength(2);
      expect(result.data.chapters[1]!.nodes).toHaveLength(1);
      expect(result.data.chapters[1]!.id).toBe('第二章');
    }
  });

  it('节点顺序与输入一致', () => {
    const input = `# 章

## 节点：A

正文A

## 节点：B

正文B

## 节点：C

正文C
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters[0]!.nodes;
      expect(nodes[0]!.id).toBe('A');
      expect(nodes[1]!.id).toBe('B');
      expect(nodes[2]!.id).toBe('C');
    }
  });

  // ==========================================================================
  // 5. 匿名章节
  // ==========================================================================

  it('无章节标题的节点 → 匿名章节', () => {
    const input = `## 节点：孤魂野鬼

我是一个没有章节的节点。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toHaveLength(1);
      expect(result.data.chapters[0]!.isAnonymous).toBe(true);
      expect(result.data.chapters[0]!.id).toBe('_anonymous');
    }
  });

  it('匿名章节节点 fullId 无前缀', () => {
    const input = `## 节点：孤魂

正文。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters[0]!.nodes[0]!.fullId).toBe('孤魂');
    }
  });

  it('匿名章节 → I003 信息', () => {
    const input = `## 节点：无家可归

正文。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const hasI003 = result.diagnostics.some((d) => d.code === 'I003');
      expect(hasI003).toBe(true);
    }
  });

  // ==========================================================================
  // 6. 节点 ID 重名（E007）
  // ==========================================================================

  it('同一章节节点 ID 重名 → E007', () => {
    const input = `# 章

## 节点：入口

正文A

## 节点：入口

正文B
`;
    const result = parseStory(input);
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors[0]!.code).toBe('E007');
    }
  });

  it('不同章节节点 ID 重名 → E007（因 fullId 相同）', () => {
    const input = `# 第一章

## 节点：起始

正文A

# 第一章

## 节点：起始

正文B
`;
    const result = parseStory(input);
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 两个 chapter ID 相同（"第一章"），所以 fullId 重复
      const e007Errors = result.diagnostics.filter((e) => e.code === 'E007' && e.severity === 'error');
      expect(e007Errors.length).toBeGreaterThanOrEqual(1);
    }
  });

  // ==========================================================================
  // 7. fullId 生成正确性
  // ==========================================================================

  it('匿名章节 fullId = 节点 ID', () => {
    const input = `## 节点：测试节点

内容。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters[0]!.nodes[0]!.fullId).toBe('测试节点');
    }
  });

  it('命名章节 fullId = "章节ID-节点ID"', () => {
    const input = `# 冒险开始

## 节点：出发

内容。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters[0]!.nodes[0]!.fullId).toBe('冒险开始-出发');
    }
  });

  // ==========================================================================
  // 8. 正文 body
  // ==========================================================================

  it('多行正文 body 保留换行', () => {
    const input = `# 章

## 节点：说明

第一行描述。
第二行描述。

第三段描述。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const body = result.data.chapters[0]!.nodes[0]!.body;
      expect(body).toContain('第一行描述');
      expect(body).toContain('第二行描述');
      expect(body).toContain('第三段描述');
    }
  });

  it('节点间用 --- 分隔', () => {
    const input = `# 章

## 节点：A

正文A

---

## 节点：B

正文B
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters[0]!.nodes).toHaveLength(2);
    }
  });

  // ==========================================================================
  // 9. 章节标题错误
  // ==========================================================================

  it('畸形章节标题（缺少空格） → E005', () => {
    const input = `#章节

## 节点：A

正文
`;
    const result = parseStory(input);
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('章节标题为空 → E005', () => {
    const input = `#

## 节点：A

正文
`;
    const result = parseStory(input);
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('章节标题过长（超 256 码点） → W006', () => {
    const longTitle = '长'.repeat(257);
    const input = `# ${longTitle}

## 节点：A

正文
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const hasW006 = result.diagnostics.some((d) => d.code === 'W006');
      expect(hasW006).toBe(true);
    }
  });

  // ==========================================================================
  // 10. 节点标题错误
  // ==========================================================================

  it('节点标题为空 → E005', () => {
    const input = `# 章

## 节点：
`;
    const result = parseStory(input);
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('节点标题含 / → E005（自动替换）', () => {
    const input = `# 章

## 节点：a/b

正文。
`;
    const result = parseStory(input);
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递。
    // 注意：节点仍会被创建（禁止字符自动替换为 _），AST 中包含该节点。
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  it('节点标题过长（超 128 码点） → E005', () => {
    const longName = 'n'.repeat(129);
    const input = `# 章

## 节点：${longName}
`;
    const result = parseStory(input);
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((e) => e.code === 'E005')).toBe(true);
    }
  });

  // ==========================================================================
  // 11. 特殊字符正文
  // ==========================================================================

  it('正文含 Emoji 和特殊符号', () => {
    const input = `# 特殊测试

## 节点：含Emoji正文

你看到了一只 🐉 龙！
价格是 $99.99，使用 @ 符号。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const body = result.data.chapters[0]!.nodes[0]!.body;
      expect(body).toContain('🐉');
      expect(body).toContain('$99.99');
    }
  });

  it('正文含中文全角符号', () => {
    const input = `# 章

## 节点：全角测试

【重要提示】：使用「道具」可以恢复体力。
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const body = result.data.chapters[0]!.nodes[0]!.body;
      expect(body).toContain('【重要提示】');
    }
  });

  it('正文含 HTML 注释不干扰解析', () => {
    const input = `# 章

## 节点：注释

这是一段正文。
<!-- HTML 注释 -->
更多正文。

[选项] 继续 -> 节点：下一步
`;
    const result = parseStory(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters[0]!.nodes[0]!.body).toContain('HTML 注释');
    }
  });
});
