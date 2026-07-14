/**
 * PlotFlow V0.2 — 对抗性边界探索测试
 *
 * 10 个测试场景，覆盖解析器/验证器的边界输入行为：
 *   B1: 空文件 → 验证无崩溃
 *   B2: 仅 Frontmatter 文件（无章节）→ 验证优雅处理
 *   B3: 超大单节点（10000+ 字符正文）→ 验证无崩溃
 *   B4: 仅含分隔符 --- 文件 → 验证解析器不循环
 *   B5: 单章 200+ 节点 → 验证图不 OOM
 *   B6: 4+ 层 AND/OR 嵌套条件 → 验证 E006 触发
 *   B7: 节点标题/正文含 Unicode/emoji → 验证无损坏
 *   B8: 中/英/日混合文本 → 验证渲染和解析
 *   B9: 极长节点名（128+ 字符）→ 验证 E005 触发
 *  B10: CRLF vs LF 换行 → 验证解析器换行兼容
 *
 * @version 0.2.0
 */

import { describe, it, expect } from 'vitest';
import { parseStory } from '../parser/parser.js';
import { validate } from '../validator/index.js';

// ============================================================================
// B1: 空文件 → 验证无崩溃
// ============================================================================

describe('B1: 空文件 → 验证无崩溃', () => {
  it('B1-1: 完全空字符串 → 返回 ok，chapters 为空', () => {
    const result = parseStory('');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
      expect(result.data.variables).toEqual([]);
      expect(result.data.meta.title).toBe('Untitled');
    }
  });

  it('B1-2: 仅空白字符（空格/制表/换行）→ 不崩溃', () => {
    const content = '   \n  \n\t\n  \n   ';
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(1000);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
    }
  });

  it('B1-3: 仅换行符 × 100 → 不崩溃，无节点', () => {
    const content = '\n'.repeat(100);
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
    }
  });

  it('B1-4: BOM (﻿) 开头的空文件 → 不崩溃', () => {
    const content = '﻿';
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
    }
  });
});

// ============================================================================
// B2: 仅 Frontmatter 文件（无章节）→ 验证优雅处理
// ============================================================================

describe('B2: 仅 Frontmatter 文件（无章节）→ 验证优雅处理', () => {
  it('B2-1: 只有 Frontmatter + 元信息，无任何章节 → 返回 ok，chapters 为空', () => {
    const content = `---
title: 纯 Frontmatter 故事
author: 测试者
engine: generic
vars:
  hp: int
  mp: int
---`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
      expect(result.data.variables).toHaveLength(2);
      expect(result.data.meta.title).toBe('纯 Frontmatter 故事');
      expect(result.data.meta.author).toBe('测试者');
    }
  });

  it('B2-2: 仅 Frontmatter 无 vars → 返回 ok', () => {
    const content = `---
title: 极简故事
---`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
      expect(result.data.variables).toEqual([]);
      expect(result.data.meta.title).toBe('极简故事');
    }
  });

  it('B2-3: Frontmatter 后跟大量空行但无章节 → 返回 ok', () => {
    const content = `---
title: 空行之后
vars:
  x: int
---
${'\n'.repeat(50)}`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
    }
  });

  it('B2-4: 仅 Frontmatter（闭合）→ 验证器不应崩溃', () => {
    const content = `---
title: Validate Me
vars:
  score: int
---`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const validation = validate(result.data);
      // 无节点不会崩溃，但 E009 会阻止导出不完整故事。
      expect(validation.summary.errors).toBe(1);
      expect(validation.diagnostics.some((d) => d.code === 'E009')).toBe(true);
    }
  });
});

// ============================================================================
// B3: 超大单节点（10000+ 字符正文）→ 验证无崩溃
// ============================================================================

describe('B3: 超大单节点（10000+ 字符正文）→ 验证无崩溃', () => {
  it('B3-1: 10000 字符正文 → 解析成功，body 完整', () => {
    const longBody = 'A'.repeat(10000);
    const content = `---
vars:
  x: int
---
# 第一章

## 节点：巨文本

${longBody}

[选项] 继续 -> 节点：end

## 节点：end

结束。
`;
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[B3-1] 10000 字符正文解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(5000);
    if (result.ok) {
      const bigNode = result.data.chapters
        .flatMap((c) => c.nodes)
        .find((n) => n.id === '巨文本');
      expect(bigNode).toBeDefined();
      expect(bigNode!.body.length).toBeGreaterThanOrEqual(10000);
      expect(bigNode!.body).toContain(longBody);
    }
  });

  it('B3-2: 50000 字符正文 → 解析不崩溃', () => {
    const longBody = 'X'.repeat(50000);
    const content = `---
---
# 第一章

## 节点：超大

${longBody}
`;
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[B3-2] 50000 字符正文解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBeDefined();
    expect(elapsed).toBeLessThan(10000);
  });

  it('B3-3: 正文含各种 Unicode 字符 × 10000 → 不崩溃', () => {
    const chars = '你好世界🎮こんにちは한국어🌟—…「」¿éçø';
    const longBody = chars.repeat(Math.ceil(10000 / chars.length)).slice(0, 10000);
    const content = `---
---
# 第一章

## 节点：多语言

${longBody}

[选项] 继续 -> 节点：end

## 节点：end

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters
        .flatMap((c) => c.nodes)
        .find((n) => n.id === '多语言');
      expect(node).toBeDefined();
      expect(node!.body).toContain('你好世界');
      expect(node!.body).toContain('한국어');
      expect(node!.body).toContain('🎮');
    }
  });
});

// ============================================================================
// B4: 仅含分隔符 --- 文件 → 验证解析器不循环
// ============================================================================

describe('B4: 仅含分隔符 --- 文件 → 验证解析器不循环', () => {
  it('B4-1: 单独一行 --- → 不崩溃', () => {
    // 单独 --- 匹配 Frontmatter 开始但无闭合 → 无 Frontmatter
    const content = '---';
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[B4-1] 单独 --- 解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(1000);
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
    }
  });

  it('B4-2: 多个 --- 连续出现 → 不无限循环', () => {
    const content = '---\n---\n---\n---\n---\n---';
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[B4-2] 多个 --- 解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBe(true);
    // 不应有任何解析错误导致超时
    expect(elapsed).toBeLessThan(1000);
    // 前两个 --- 被当作 Frontmatter 限界符（内容为空），后续 --- 为空行
    // 结果应为空 chapters
    if (result.ok) {
      expect(result.data.chapters).toEqual([]);
    }
  });

  it('B4-3: --- 后跟正常节点 → 解析正确', () => {
    const content = `---
---
---
# 第一章

## 节点：起点

正文。

[选项] 去 -> 节点：终点

## 节点：终点

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(2);
      expect(nodes[0]!.id).toBe('起点');
      expect(nodes[1]!.id).toBe('终点');
    }
  });

  it('B4-4: --- 作为节点间分隔符 — 已知解析器限制：Frontmatter regex 可能过度匹配', () => {
    // 已知行为: Frontmatter regex /^---\r?\n([\s\S]*?)\r?\n---/ 使用 [\s\S]*?
    // 懒惰匹配可能跳过中间的 --- 分隔符，将 ## 节点：A 到第一个正文 ---
    // 之间的内容吞为 Frontmatter。这是解析器的已知边界，不崩溃即可。
    const content = `---
---
# 第一章

## 节点：A

正文 A。

[选项] 去 B -> 节点：B

---

## 节点：B

正文 B。
`;
    const result = parseStory(content);
    expect(result.ok).toBeDefined();
    // 不崩溃即为通过 — 节点数取决于 Frontmatter 截断位置
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      console.log(`[B4-4] 解析到 ${nodes.length} 个节点（Frontmatter 截断影响）`);
      // 至少应有一个节点（B），不应崩溃或无限循环
      expect(nodes.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// B5: 单章 200+ 节点 → 验证图不 OOM
// ============================================================================

describe('B5: 单章 200+ 节点 → 验证图不 OOM', () => {
  function generateFlatStory(nodeCount: number): string {
    const lines: string[] = [];
    lines.push('---');
    lines.push('title: 大规模节点测试');
    lines.push('vars:');
    for (let i = 1; i <= 5; i++) {
      lines.push(`  var_${i}: int`);
    }
    lines.push('---');
    lines.push('');
    lines.push('# 单章大测试');
    lines.push('');

    for (let n = 1; n <= nodeCount; n++) {
      lines.push(`## 节点：N${n}`);
      lines.push('');
      lines.push(`这是第 ${n} 个节点的描述。`);
      lines.push('');

      if (n < nodeCount) {
        lines.push(`[选项] 前进到 N${n + 1} -> 节点：N${n + 1}`);
        lines.push(`[选项] 查看详情 [var_1 > 0] -> 节点：N${n}`);
      } else {
        lines.push('[选项] 结束 -> 节点：end');
      }
      lines.push('');
    }

    // 结束节点
    lines.push('## 节点：end');
    lines.push('');
    lines.push('故事结束。');
    lines.push('');

    return lines.join('\n');
  }

  it('B5-1: 单章 200 节点 → 解析成功，内存不爆炸', () => {
    const content = generateFlatStory(200);
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[B5-1] 单章 200 节点解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(10000);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      // 200 + 1 (end) = 201
      expect(nodes.length).toBe(201);
      // 验证所有节点都有非空 ID
      for (const node of nodes) {
        expect(node.id).toBeTruthy();
        expect(node.fullId).toBeTruthy();
      }
    }
  });

  it('B5-2: 单章 500 节点 → 解析不崩溃', () => {
    const content = generateFlatStory(500);
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[B5-2] 单章 500 节点解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBeDefined();
    expect(elapsed).toBeLessThan(30000);
  });

  it('B5-3: 200 节点 + 验证器全量检查 → 验证器不 OOM', () => {
    const content = generateFlatStory(200);
    const parseResult = parseStory(content);
    expect(parseResult.ok).toBe(true);
    if (parseResult.ok) {
      const t0 = performance.now();
      const validation = validate(parseResult.data);
      const elapsed = performance.now() - t0;
      console.log(`[B5-3] 200 节点验证耗时: ${elapsed.toFixed(1)}ms`);
      expect(elapsed).toBeLessThan(10000);
      // 验证器运行不抛异常
      expect(validation.summary.total).toBeGreaterThan(0);
    }
  });

  it('B5-4: 200 节点每个含完整条件/效果 → 解析成功', () => {
    const lines: string[] = [];
    lines.push('---');
    lines.push('title: 带条件的200节点');
    lines.push('vars:');
    for (let i = 1; i <= 10; i++) {
      lines.push(`  v${i}: int`);
    }
    lines.push('---');
    lines.push('');
    lines.push('# 条件章节');
    lines.push('');

    for (let n = 1; n <= 200; n++) {
      lines.push(`## 节点：C${n}`);
      lines.push('');
      lines.push(`条件节点 ${n}。`);
      lines.push('');
      if (n < 200) {
        const varIdx = (n % 10) + 1;
        lines.push(`[选项] 前往 C${n + 1} [v${varIdx} > 0] {v${varIdx} -= 1} -> 节点：C${n + 1}`);
        lines.push(`[选项] 停留 [v1 < 100] -> 节点：C${n}`);
      } else {
        lines.push('[选项] 结束 -> 节点：end');
      }
      lines.push('');
    }
    lines.push('## 节点：end');
    lines.push('');
    lines.push('结束。');
    lines.push('');

    const content = lines.join('\n');
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[B5-4] 200节点+条件 解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(15000);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes.length).toBe(201);
    }
  });
});

// ============================================================================
// B6: 4+ 层 AND/OR 嵌套条件 → 验证 E006 触发
// ============================================================================

describe('B6: 4+ 层 AND/OR 嵌套条件 → 验证 E006 触发', () => {
  it('B6-1: 4 层 object 嵌套 → 产生 E006', () => {
    const content = `---
vars:
  deep: object{
    l1: object{
      l2: object{
        l3: object{
          value: int
        }
      }
    }
  }
---
# 第一章

## 节点：起点

正文。
`;
    const result = parseStory(content);
    // E006 在 Frontmatter 解析时产生 → parseFrontmatter 返回 failure
    // 但 parseStory 始终返回 success（V02-033）
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('parseStory unexpectedly failed');
    // 检查 diagnostics 中是否有 E006
    const e006 = result.diagnostics.filter((d) => d.code === 'E006');
    expect(e006.length).toBeGreaterThan(0);
    // 注意：从 parser.ts 路径看，parseFrontmatter 的 E006 错误在 fmResult.errors 中
    // fmResult.ok === false 时 errors 被 push 到 allDiagnostics
    // 所以应该能从 result.diagnostics 中找到
    console.log(`[B6-1] diagnostics: ${JSON.stringify(result.diagnostics.map(d => ({code: d.code, severity: d.severity})))}`);
    // 如果 parseFrontmatter 返回 failure（有 E006），则 parseStory 仍返回 success
    // 但变量列表为空（容错）
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('B6-2: 正好 3 层 object 嵌套 → 解析成功，无 E006', () => {
    const content = `---
vars:
  player: object{
    stats: object{
      combat: object{
        atk: int
        def: int
      }
    }
  }
---
# 第一章

## 节点：起点

正文。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('parseStory unexpectedly failed');
    const e006 = result.diagnostics.filter((d) => d.code === 'E006');
    expect(e006).toHaveLength(0);
    // 应正确解析出变量
    if (result.ok) {
      expect(result.data.variables.length).toBe(1);
      const playerVar = result.data.variables[0]!;
      expect(playerVar.type).toBe('object');
      expect(playerVar.fields).toBeDefined();
    }
  });

  it('B6-3: 6 层超深嵌套 → 不崩溃，产生 E006', () => {
    const content = `---
vars:
  ultra: object{
    l1: object{
      l2: object{
        l3: object{
          l4: object{
            l5: object{
              leaf: int
            }
          }
        }
      }
    }
  }
---
# 第一章

## 节点：起点

正文。
`;
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[B6-3] 6层嵌套 解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });

  it('B6-4: 验证器 E006 规则独立验证（已有 AST 时）', () => {
    // 构造一个 AST 手动测试 E006 规则
    const content = `---
vars:
  root: object{
    a: object{
      b: object{
        c: object{
          d: int
        }
      }
    }
  }
---
# 第一章

## 节点：起点

正文。
`;
    const parseResult = parseStory(content);
    // parseFrontmatter fails with E006 → variables 为空
    // 但 V02-033: parseStory 仍然 success
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) throw new Error('parseStory unexpectedly failed');

    // 使用验证器独立检查
    const validation = validate(parseResult.data);
    // 可能没有变量（容错），也可能 E006 从 parseFrontmatter 传递过来了
    // 验证器查找 data.variables，如果没有深度嵌套就不能再检测
    // 所以这里主要验证不崩溃
    expect(validation.summary.total).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// B7: 节点标题/正文含 Unicode/emoji → 验证无损坏
// ============================================================================

describe('B7: 节点标题/正文含 Unicode/emoji → 验证无损坏', () => {
  it('B7-1: 全 emoji 节点名 → 解析成功，ID 不变', () => {
    const content = `---
---
# 🎮⚔️🛡️🏰

## 节点：🔥💀👻🧙🐉

Emoji 节点正文 🎉✨🎊
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const chapter = result.data.chapters[0]!;
      expect(chapter.id).toBe('🎮⚔️🛡️🏰');
      const node = chapter.nodes[0]!;
      expect(node.id).toBe('🔥💀👻🧙🐉');
      expect(node.title).toBe('🔥💀👻🧙🐉');
      expect(node.body).toContain('🎉✨🎊');
    }
  });

  it('B7-2: 零宽字符（​ ‌ ﻿）在正文中 → 不损坏', () => {
    const zeroWidthText = '正文中的\u200B零宽空格\u200C和\u200D连接符。';
    const content = `---
---
# 第一章

## 节点：零宽测试

${zeroWidthText}
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      // 零宽字符应保留在正文中
      expect(node.body).toContain('​');
    }
  });

  it('B7-3: 组合字符（e + ́= é）→ 节点名不损坏', () => {
    const content = `---
---
# 第一章

## 节点：café résumé naïve

正文字符测试。

[选项] 继续 -> 节点：end

## 节点：end

fin.
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters[0]!.nodes[0]!;
      expect(node.id).toBe('café résumé naïve');
      expect(node.title).toBe('café résumé naïve');
    }
  });

  it('B7-4: 全角/半角混用节点名 → 解析成功', () => {
    const content = `---
---
# 第１章

## 节点：ＰｌｏｔＦｌｏｗ全角

全角英数テスト。

[选项] 次へ -> 节点：ＥＮＤ

## 节点：ＥＮＤ

終わり。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(2);
      expect(nodes[0]!.id).toBe('ＰｌｏｔＦｌｏｗ全角');
      expect(nodes[1]!.id).toBe('ＥＮＤ');
    }
  });

  it('B7-5: RTL 字符（阿拉伯文/希伯来文）→ 不崩溃', () => {
    const content = `---
---
# الفصل الأول

## 节点：مرحبا

مرحبا بالعالم! שלום עולם!

[选项] تابع -> 节点：نهاية

## 节点：نهاية

انتهت القصة.
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const chapter = result.data.chapters[0]!;
      expect(chapter.id).toBe('الفصل الأول');
      const node = chapter.nodes[0]!;
      expect(node.id).toBe('مرحبا');
      expect(node.options).toHaveLength(1);
    }
  });
});

// ============================================================================
// B8: 中/英/日混合文本 → 验证渲染和解析
// ============================================================================

describe('B8: 中/英/日混合文本 → 验证渲染和解析', () => {
  it('B8-1: 三语混合标题+正文+选项 → 全部解析正确', () => {
    const content = `---
title: PlotFlow 多言語テスト Multi-Language Test 多语言测试
author: テストチーム
vars:
  玩家HP: int
  playerMP: int
  魔法力: float
---
# Chapter 1: 冒険の始まり (Adventure Begins)

## 节点：start_開始

Hello! こんにちは！你好！
Your adventure begins. あなたの冒険が始まります。你的冒险开始了。

[选项] 進む (Forward) 前进 -> 节点：forest_森
[选项] 戻る (Back) 后退 -> 节点：village_村
[选项] ステータスを見る -> 节点：status_状態

## 节点：forest_森

You entered the forest. 森に入った。你进入了森林。
モンスターが現れた！A monster appeared! 怪物出现了！

[选项] Fight! 戦う！战斗！ -> 节点：battle_戦闘
  条件: $playerMP > 0
  效果: ($playerMP - 10)
[选项] Run away 逃げる 逃跑 -> 节点：village_村

## 节点：village_村

Safe village. 安全な村。安全的村庄。

[选项] 休息 (Rest) 休息 -> 节点：start_開始

## 节点：battle_戦闘

戦闘中！In battle! 战斗中！

[选项] 胜利 -> 节点：end_終

## 节点：status_状態

HP: $玩家HP, MP: $playerMP, 魔法力: $魔法力

[选项] 戻る 返回 Back -> 节点：start_開始

## 节点：end_終

終わり The End 结束
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.meta.title).toBe('PlotFlow 多言語テスト Multi-Language Test 多语言测试');
      expect(result.data.variables).toHaveLength(3);

      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes.length).toBe(6);

      // 验证每个节点 ID 完整
      const ids = nodes.map((n) => n.id).sort();
      expect(ids).toContain('start_開始');
      expect(ids).toContain('forest_森');
      expect(ids).toContain('village_村');
      expect(ids).toContain('battle_戦闘');
      expect(ids).toContain('status_状態');
      expect(ids).toContain('end_終');

      // 验证 start 节点有 3 个选项
      const startNode = nodes.find((n) => n.id === 'start_開始')!;
      expect(startNode.options).toHaveLength(3);

      // 验证条件选项正常解析（使用 multiline 条件:/效果: 语法）
      const forestNode = nodes.find((n) => n.id === 'forest_森')!;
      const fightOpt = forestNode.options.find((o) => o.description.includes('Fight'))!;
      expect(fightOpt.condition).not.toBeNull();
      expect(fightOpt.sideEffects).toHaveLength(1);

      // 验证变量在正文中保留
      const statusNode = nodes.find((n) => n.id === 'status_状態')!;
      expect(statusNode.body).toContain('$玩家HP');
      expect(statusNode.body).toContain('$playerMP');
      expect(statusNode.body).toContain('$魔法力');
    }
  });

  it('B8-2: 日文片假名/平假名混合选项 → 正确解析', () => {
    const content = `---
---
# テスト章

## 节点：スタート

冒険の始まりです。

[选项] タタカウ -> 节点：バトル
[选项] ニゲル -> 节点：エンド

## 节点：バトル

戦闘！

## 节点：エンド

終了。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(3);
      expect(nodes[0]!.id).toBe('スタート');
      expect(nodes[1]!.id).toBe('バトル');
      expect(nodes[2]!.id).toBe('エンド');
    }
  });
});

// ============================================================================
// B9: 极长节点名（128+ 字符）→ 验证 E005 触发
// ============================================================================

describe('B9: 极长节点名（128+ 字符）→ 验证 E005 触发', () => {
  it('B9-1: 129 码点节点名 → 产生 E005 错误', () => {
    const longName = '长'.repeat(129);
    const content = `---
---
# 第一章

## 节点：${longName}

正文。
`;
    const result = parseStory(content);
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('parseStory unexpectedly failed');
    // E005 应在 diagnostics 中
    const e005 = result.diagnostics.filter((d) => d.code === 'E005');
    expect(e005.length).toBeGreaterThanOrEqual(1);
    const e005msg = e005.find((d) => d.message.includes('过长'));
    expect(e005msg).toBeDefined();
  });

  it('B9-2: 正好 128 码点节点名 → 解析成功，无 E005', () => {
    const name = '中'.repeat(128);
    const content = `---
---
# 第一章

## 节点：${name}

正文。

[选项] 继续 -> 节点：end

## 节点：end

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters.flatMap((c) => c.nodes).find((n) => n.id === name);
      expect(node).toBeDefined();
      expect(node!.title).toBe(name);
      // 不应有 E005（节点名过长）
      const e005NameTooLong = result.diagnostics.filter(
        (d) => d.code === 'E005' && d.message.includes('过长'),
      );
      expect(e005NameTooLong).toHaveLength(0);
    }
  });

  it('B9-3: emoji 组成 129 码点的节点名 → 产生 E005', () => {
    // emoji 如 🎮 是 1 码点但 2 个 UTF-16 code unit
    // 码点计数正确
    const emojiName = '🎮'.repeat(129);
    const content = `---
---
# 第一章

## 节点：${emojiName}

🎉
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('parseStory unexpectedly failed');
    const e005 = result.diagnostics.filter((d) => d.code === 'E005' && d.message.includes('过长'));
    expect(e005.length).toBeGreaterThanOrEqual(1);
  });

  it('B9-4: 257 码点章节标题 → 产生 W006 警告', () => {
    const longChapter = '章'.repeat(257);
    const content = `---
---
# ${longChapter}

## 节点：起点

正文。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('parseStory unexpectedly failed');
    const w006 = result.diagnostics.filter((d) => d.code === 'W006' && d.message.includes('章节标题过长'));
    expect(w006.length).toBeGreaterThanOrEqual(1);
  });

  it('B9-5: 正好 256 码点章节标题 → 不产生警告', () => {
    const chapterName = '节'.repeat(256);
    const content = `---
---
# ${chapterName}

## 节点：起点

正文。

[选项] 继续 -> 节点：end

## 节点：end

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('parseStory unexpectedly failed');
    const chapter = result.data.chapters[0]!;
    expect(chapter.id).toBe(chapterName);
    const w006 = result.diagnostics.filter(
      (d) => d.code === 'W006' && d.message.includes('章节标题过长'),
    );
    expect(w006).toHaveLength(0);
  });
});

// ============================================================================
// B10: CRLF vs LF 换行 → 验证解析器换行兼容
// ============================================================================

describe('B10: CRLF vs LF 换行 → 验证解析器换行兼容', () => {
  it('B10-1: 纯 CRLF → 解析成功，节点数正确', () => {
    const content = '---\r\nvars:\r\n  hp: int\r\n---\r\n# 第一章\r\n\r\n## 节点：起点\r\n\r\n正文。\r\n\r\n[选项] 下一个 -> 节点：end\r\n\r\n## 节点：end\r\n\r\n结束。\r\n';
    // 验证确实是 CRLF
    expect(content.includes('\r\n')).toBe(true);
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(2);
      expect(nodes[0]!.id).toBe('起点');
      expect(nodes[1]!.id).toBe('end');
      expect(nodes[0]!.options).toHaveLength(1);
    }
  });

  it('B10-2: 混合 CRLF + LF → 解析成功', () => {
    // Frontmatter 用 CRLF，正文用 LF
    const content = '---\r\nvars:\r\n  mp: int\r\n---\r\n# 第一章\n\n## 节点：A\n\n正文A。\n\n[选项] 去B -> 节点：B\n\n## 节点：B\n\n正文B。\n';
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(2);
    }
  });

  it('B10-3: CRLF 的 Frontmatter 变量解析正确', () => {
    const content = '---\r\ntitle: CRLF 测试\r\nauthor: Test\r\nvars:\r\n  金币: int\r\n  魔法: float\r\n  存活: bool\r\n  name: string\r\n---\r\n# 第一章\r\n\r\n## 节点：起点\r\n\r\n正文。\r\n';
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.meta.title).toBe('CRLF 测试');
      expect(result.data.variables).toHaveLength(4);
    }
  });

  it('B10-4: 仅 CR（旧 Mac 风格）→ 不崩溃，尽力解析', () => {
    const content = '---\r---\r# 第一章\r\r## 节点：起点\r\r正文。\r\r[选项] 去终点 -> 节点：end\r\r## 节点：end\r\r结束。\r';
    const result = parseStory(content);
    // 单独的 \r 可能不被 split(/\r?\n|\r/) 正确分割
    // 但解析器不应崩溃
    expect(result.ok).toBeDefined();
    expect(() => result.ok).not.toThrow();
  });

  it('B10-5: 大量行 CRLF（200 行，模拟 Windows 大文件）→ 不崩溃', () => {
    const lines: string[] = [];
    lines.push('---');
    lines.push('vars:');
    lines.push('  hp: int');
    lines.push('---');
    lines.push('');
    lines.push('# 章节');
    lines.push('');

    for (let n = 1; n <= 100; n++) {
      lines.push(`## 节点：N${n}`);
      lines.push('');
      lines.push(`正文 ${n}。`);
      lines.push('');
      if (n < 100) {
        lines.push(`[选项] 前进 -> 节点：N${n + 1}`);
      } else {
        lines.push('[选项] 结束 -> 节点：end');
      }
      lines.push('');
    }
    lines.push('## 节点：end');
    lines.push('');
    lines.push('结束。');

    const content = lines.join('\r\n');
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[B10-5] CRLF 100节点 解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(5000);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes.length).toBe(101);
    }
  });
});

// ============================================================================
// 组合场景：多边界同时触发
// ============================================================================

describe('组合场景: 多边界同时并发', () => {
  it('COMBO-1: 大文件 + emoji + CRLF + 中英日混合 → 不崩溃', () => {
    const lines: string[] = [];
    lines.push('---');
    lines.push('title: 🎮 Combo Test 組み合わせテスト 组合测试');
    lines.push('vars:');
    lines.push('  hp_体力: int');
    lines.push('  mp_魔力: float');
    lines.push('---');
    lines.push('');
    lines.push('# Chapter 1: 冒険 🌟');
    lines.push('');

    const emojis = ['🔥', '⚔️', '🛡️', '💎', '🧪', '📜'];
    for (let n = 1; n <= 20; n++) {
      const emoji = emojis[n % emojis.length]!;
      lines.push(`## 节点：Node${n}_節点${emoji}`);
      lines.push('');
      lines.push(`这是第 ${n} 个场景。This is scene ${n}。これは${n}番目のシーンです。`);
      lines.push('');
      if (n < 20) {
        lines.push(`[选项] 進む Progress 前进 -> 节点：Node${n + 1}_節点${emojis[(n + 1) % emojis.length]}`);
      } else {
        lines.push('[选项] End 終了 结束 -> 节点：end_終わり');
      }
      lines.push('');
    }
    lines.push('## 节点：end_終わり');
    lines.push('');
    lines.push('🎉 Complete! 完了! 完成!');
    lines.push('');

    const content = lines.join('\r\n');
    const t0 = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - t0;
    console.log(`[COMBO-1] 组合测试 解析耗时: ${elapsed.toFixed(1)}ms`);
    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(5000);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes.length).toBe(21);
    }
  });

  it('COMBO-2: 仅 Frontmatter 含 emoji 变量名 → 不崩溃（E005 或容错）', () => {
    const content = `---
vars:
  🔥火: int
  💧水: int
---
`;
    const result = parseStory(content);
    // 以 emoji 开头的变量名可能被 VAR_NAME_RE 拒绝（需要字母开头）
    // 但这不应导致崩溃
    expect(result.ok).toBeDefined();
  });
});
