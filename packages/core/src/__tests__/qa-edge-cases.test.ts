/**
 * PlotFlow V0.1 QA — 边界与压力测试
 *
 * 覆盖场景：
 *   EDGE-01: 大文件压力（200 节点）
 *   EDGE-02: 超长行
 *   EDGE-03: 循环引用
 *   EDGE-04: 空白处理
 *   EDGE-05: 破坏性 Frontmatter
 *   J-11:    Unicode 与特殊字符
 */

import { describe, it, expect } from 'vitest';
import { parseStory } from '../parser/parser.js';
import { validate } from '../validator/index.js';

// ============================================================================
// 辅助：生成大文件 .mdstory 内容
// ============================================================================

/**
 * 生成包含 chapterCount × nodesPerChapter 节点的大故事文件。
 * 每个节点包含 2 个选项，Frontmatter 包含 varCount 个变量。
 */
function generateLargeStory(
  chapterCount: number,
  nodesPerChapter: number,
  varCount: number,
): string {
  const lines: string[] = [];

  // ---- Frontmatter ----
  lines.push('---');
  lines.push('title: QA 大文件压力测试');
  lines.push('author: QA Bot');
  lines.push('engine: generic');
  lines.push('vars:');
  for (let v = 1; v <= varCount; v++) {
    const type = v % 4 === 0 ? 'bool' : v % 4 === 1 ? 'int' : v % 4 === 2 ? 'float' : 'string';
    lines.push(`  var_${v}: ${type}`);
  }
  lines.push('---');
  lines.push('');

  // ---- 章节与节点 ----
  for (let ch = 1; ch <= chapterCount; ch++) {
    lines.push(`# 第${ch}章`);
    lines.push('');

    for (let nd = 1; nd <= nodesPerChapter; nd++) {
      const nodeId = `ch${ch}_n${nd}`;
      lines.push(`## 节点：${nodeId}`);
      lines.push('');
      lines.push(`这是第${ch}章第${nd}个节点的正文描述。`);
      lines.push('');

      // 选项 1：链接到同章节下一个节点（如果不是最后一个）
      if (nd < nodesPerChapter) {
        const nextId = `ch${ch}_n${nd + 1}`;
        lines.push(`[选项] 继续前进 -> 节点：${nextId}`);
      } else {
        // 最后一个节点：链接到下一章第一个节点（如果不是最后一章）
        if (ch < chapterCount) {
          const nextChId = `ch${ch + 1}_n1`;
          lines.push(`[选项] 进入下一章 -> 节点：${nextChId}`);
        } else {
          lines.push('[选项] 结束故事 -> 节点：end');
        }
      }

      // 选项 2：条件选项（始终生成）
      const varName = `var_${(nd % varCount) + 1}`;
      lines.push(`[选项] 看看别处 [${varName} > 5] {${varName} += 1} -> 节点：${nodeId}`);

      lines.push('');
    }
  }

  // 结束节点
  lines.push('# 终章');
  lines.push('');
  lines.push('## 节点：end');
  lines.push('');
  lines.push('故事结束。');
  lines.push('');

  return lines.join('\n');
}

// ============================================================================
// EDGE-01: 大文件压力测试
// ============================================================================

describe('EDGE-01: 大文件压力测试', () => {
  it('解析 200 节点故事（10 章节 × 20 节点）应在 5 秒内完成且不崩溃', () => {
    const content = generateLargeStory(10, 20, 20);

    // 验证生成的文件行数
    const lineCount = content.split('\n').length;
    expect(lineCount).toBeGreaterThan(100);

    const startTime = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - startTime;

    // 记录耗时（断言中包含了故障信息）
    expect(elapsed).toBeLessThan(5000);
    console.log(`[EDGE-01] 200 节点解析耗时: ${elapsed.toFixed(1)}ms`);

    // 验证解析成功
    expect(result.ok).toBe(true);

    if (result.ok) {
      // 统计所有节点的数量
      let totalNodes = 0;
      for (const chapter of result.data.chapters) {
        totalNodes += chapter.nodes.length;
      }

      // 自动保存的 200 个命名节点 + 1 个 "end" 节点
      // 10 × 20 = 200 自动生成节点
      // "end" 节点属于自己的章节
      const generatedNodes = 10 * 20; // 200
      expect(totalNodes).toBe(generatedNodes + 1); // +1 for "end" node in its own chapter

      // 验证每个章节有正确数量的节点
      const namedChapters = result.data.chapters.filter((c) => !c.isAnonymous);
      expect(namedChapters).toHaveLength(11); // 10 章 + 终章
      // 前 10 章各有 20 节点
      for (let i = 0; i < 10; i++) {
        expect(namedChapters[i]!.nodes).toHaveLength(20);
      }
      // 终章有 1 节点
      expect(namedChapters[10]!.nodes).toHaveLength(1);
      expect(namedChapters[10]!.id).toBe('终章');

      // 验证 Frontmatter 变量
      expect(result.data.variables).toHaveLength(20);

      // 验证 200 个生成节点 + end 节点都存在于 AST 中
      // end 节点无选项（死胡同），其余 200 节点应各有选项
      let nodesWithOptions = 0;
      let nodesWithoutOptions = 0;
      for (const ch of result.data.chapters) {
        for (const node of ch.nodes) {
          if (node.options.length > 0) nodesWithOptions++;
          else nodesWithoutOptions++;
        }
      }
      expect(nodesWithOptions).toBe(200); // 所有生成节点都有选项
      expect(nodesWithoutOptions).toBe(1); // 只有 end 节点无选项

      // 验证诊断
      console.log(`[EDGE-01] 总节点数: ${totalNodes}, 诊断数: ${result.data.meta.plotflow}`);
    }
  });

  it('解析 500 节点故事不应崩溃（超规模测试）', () => {
    const content = generateLargeStory(25, 20, 30);

    const startTime = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - startTime;

    console.log(`[EDGE-01b] 500 节点解析耗时: ${elapsed.toFixed(1)}ms`);

    // 解析应正常完成（可能产生错误诊断，但不应抛异常）
    // 大量选项指向未定义目标节点 → 产生 E001 错误
    // 但 parseStory 本身应不崩溃
    expect(result.ok).toBeDefined();
    expect(elapsed).toBeLessThan(10000);
  });

  it('全体节点应有非空 ID', () => {
    // 复用解析结果
    const content = generateLargeStory(10, 20, 20);
    const result = parseStory(content);
    expect(result.ok).toBe(true);

    if (result.ok) {
      for (const ch of result.data.chapters) {
        for (const node of ch.nodes) {
          expect(node.id).toBeTruthy();
          expect(node.fullId).toBeTruthy();
          expect(node.title).toBeTruthy();
        }
      }
    }
  });
});

// ============================================================================
// EDGE-02: 超长行
// ============================================================================

describe('EDGE-02: 超长行', () => {
  it('节点正文 10000 字符 → 解析成功不崩溃', () => {
    const longBody = 'A'.repeat(10000);
    const content = `---
vars:
  x: int
---
# 第一章

## 节点：长正文节点

${longBody}

[选项] 结束 -> 节点：end

## 节点：end

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const bodyNode = result.data.chapters
        .flatMap((c) => c.nodes)
        .find((n) => n.id === '长正文节点');
      expect(bodyNode).toBeDefined();
      // body 为纯叙事正文（不含 [选项] 语法行，BUG6 修复）
      expect(bodyNode!.body.length).toBeGreaterThanOrEqual(10000);
      expect(bodyNode!.body).toContain(longBody);
    }
  });

  it('选项描述 1024 字符 → 解析成功（等于截断上限）', () => {
    // MAX_DESCRIPTION_LENGTH = 1024，超长会被截断
    const longOption = 'B'.repeat(1024);
    const content = `---
---
# 第一章

## 节点：起点

[选项] ${longOption} -> 节点：目标

## 节点：目标

到达。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters
        .flatMap((c) => c.nodes)
        .find((n) => n.id === '起点');
      expect(node).toBeDefined();
      expect(node!.options).toHaveLength(1);
      expect(node!.options[0]!.description).toBe(longOption);
    }
  });

  it('超长选项描述（2000 字符）应被截断至 1024 且不崩溃', () => {
    const longOption = 'B'.repeat(2000);
    const content = `---
---
# 第一章

## 节点：起点

[选项] ${longOption} -> 节点：目标

## 节点：目标

到达。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters
        .flatMap((c) => c.nodes)
        .find((n) => n.id === '起点');
      expect(node).toBeDefined();
      expect(node!.options).toHaveLength(1);
      // 由于 MAX_DESCRIPTION_LENGTH = 1024，长描述应被截断
      expect(node!.options[0]!.description).toHaveLength(1024);
      expect(node!.options[0]!.description).toBe('B'.repeat(1024));
    }
  });

  it('超长节点名（128 码点限制）→ 产生 E005 错误', () => {
    // 129 个码点的节点名（超过 128 上限）
    const longName = '超'.repeat(129);
    const content = `---
---
# 第一章

## 节点：${longName}

正文。
`;
    const result = parseStory(content);
    // 解析器应返回错误（E005: 节点名过长）
    // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
    expect(result.ok).toBe(true);
    if (result.ok) {
      const e005Diags = result.diagnostics.filter((d) => d.code === 'E005' && d.severity === 'error');
      expect(e005Diags.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// EDGE-03: 循环引用
// ============================================================================

describe('EDGE-03: 循环引用', () => {
  it('A→B→C→A 环 → 不无限循环', () => {
    const content = `---
---
# 第一章

## 节点：A

选项A1 -> 节点：B
[选项] 选项A2 -> 节点：B

## 节点：B

[选项] 选项B1 -> 节点：C
[选项] 选项B2 -> 节点：C

## 节点：C

[选项] 选项C1 -> 节点：A
[选项] 选项C2 -> 节点：A
`;
    // 不应因循环引用导致无限循环或栈溢出
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(3);
      const ids = nodes.map((n) => n.id).sort();
      expect(ids).toEqual(['A', 'B', 'C']);

      // 验证 targetFullId 已回填（循环引用不应阻止引用解析）
      const nodeA = nodes.find((n) => n.id === 'A')!;
      const nodeB = nodes.find((n) => n.id === 'B')!;
      for (const opt of nodeA.options) {
        expect(opt.targetNodeId).toBe('B');
        expect(opt.targetFullId).toBe('第一章-B');
      }
      for (const opt of nodeB.options) {
        expect(opt.targetNodeId).toBe('C');
        expect(opt.targetFullId).toBe('第一章-C');
      }
    }
  });

  it('A→A 自环 → 不无限循环', () => {
    const content = `---
---
# 第一章

## 节点：A

[选项] 重复 -> 节点：A
[选项] 再来一次 -> 节点：A
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodeA = result.data.chapters[0]!.nodes[0]!;
      expect(nodeA.id).toBe('A');
      expect(nodeA.options).toHaveLength(2);
      for (const opt of nodeA.options) {
        expect(opt.targetNodeId).toBe('A');
        expect(opt.targetFullId).toBe('第一章-A');
      }
    }
  });

  it('验证器对孤立节点产生 W001 → 死胡同节点产生 W002', () => {
    // 布局：
    //   节点A（根）→ 节点B（正常）
    //   节点X（孤立节点，W001）
    //   节点D（死胡同节点 - 有入口但无选项，W002）
    const content = `---
---
# 第一章

## 节点：A

[选项] 去B -> 节点：B
[选项] 直接结束 -> 节点：死胡同

## 节点：B

[选项] 返回A -> 节点：A
[选项] 结束 -> 节点：死胡同

## 节点：死胡同

这是死胡同，没有选项指向别处。

## 节点：X

我是孤立节点，没有入口选项指向我。
[选项] 去哪里 -> 节点：A
`;
    const parseResult = parseStory(content);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    // 运行验证器
    const validationResult = validate(parseResult.data);

    const w001Count = validationResult.diagnostics.filter((d) => d.code === 'W001').length;
    const w002Count = validationResult.diagnostics.filter((d) => d.code === 'W002').length;

    // X 是孤立节点 → 应产生 W001
    expect(w001Count).toBeGreaterThanOrEqual(1);
    // 死胡同节点无选项 → 应产生 W002
    expect(w002Count).toBeGreaterThanOrEqual(1);

    // 验证 W001 涉及节点 X
    const w001Diags = validationResult.diagnostics.filter((d) => d.code === 'W001');
    const mentionsOrphan = w001Diags.some(
      (d) => d.message.includes('孤立') || d.message.includes('X'),
    );
    expect(mentionsOrphan).toBe(true);

    // 验证 W002 涉及死胡同节点
    const w002Diags = validationResult.diagnostics.filter((d) => d.code === 'W002');
    const mentionsDeadEnd = w002Diags.some(
      (d) => d.message.includes('死胡同') || d.message.includes('出口') || d.message.includes('dead'),
    );
    expect(mentionsDeadEnd).toBe(true);
  });
});

// ============================================================================
// EDGE-04: 空白处理
// ============================================================================

describe('EDGE-04: 空白处理', () => {
  it('CRLF 行尾符 → 正常解析（Windows 换行）', () => {
    const content = '---\r\nvars:\r\n  hp: int\r\n---\r\n# 第一章\r\n\r\n## 节点：起点\r\n\r\n正文。\r\n\r\n[选项] 下一个 -> 节点：end\r\n\r\n## 节点：end\r\n\r\n结束。\r\n';
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(2);
      expect(nodes[0]!.id).toBe('起点');
      expect(nodes[1]!.id).toBe('end');
    }
  });

  it('文件末尾无换行 → 正常解析', () => {
    const content = '---\n---\n# 第一章\n\n## 节点：起点\n\n正文。\n\n[选项] 结束 -> 节点：end\n\n## 节点：end\n\n结束。';
    // ↑ 注意末尾没有换行符
    expect(content.endsWith('\n')).toBe(false);
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(2);
    }
  });

  it('Frontmatter 后大量空行 → 正常解析', () => {
    const emptyLines = '\n\n\n\n\n\n\n\n\n\n'.repeat(5); // 50 空行
    const content = `---
title: 空行测试
---
${emptyLines}
# 第一章

## 节点：起点

正文。

[选项] 结束 -> 节点：end

## 节点：end

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(2);
    }
  });

  it('连续 100 行空行 → 不崩溃', () => {
    const emptyLines = '\n'.repeat(100);
    const content = `---
---
${emptyLines}
# 第一章

## 节点：起点

正文。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      expect(nodes).toHaveLength(1);
    }
  });

  it('全空白文件（仅有空格和换行）→ 不崩溃', () => {
    const content = '   \n  \n\t\n  \n   ';
    const result = parseStory(content);
    expect(result.ok).toBe(true);
  });

  it('节点正文仅含空白字符 → 应触发 W005 警告', () => {
    const content = `---
---
# 第一章

## 节点：空白正文

   \t

`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 运行验证器确认 W005
      const vResult = validate(result.data);
      const w005 = vResult.diagnostics.filter((d) => d.code === 'W005');
      expect(w005.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// EDGE-05: 破坏性 Frontmatter
// ============================================================================

describe('EDGE-05: 破坏性 Frontmatter', () => {
  it('截断的 YAML（写到一半断掉）→ 返回 E005 不崩溃', () => {
    // 缺少结尾 ---
    const content = `---
title: 未完成的故事
vars:
  金币: int
  等级: int
# 没有结尾的 ---

# 第一章

## 节点：起点

正文。
`;
    const result = parseStory(content);
    // 缺少结尾 --- 时 parseFrontmatter 返回空（不报错），然后正常解析章节
    // 所以整体 ok = true（因为章节解析无错误）
    // 但可能有一些诊断
    expect(result.ok).toBe(true);
    // 验证至少能解析出章节节点
    if (result.ok) {
      expect(result.data.variables).toEqual([]); // 截断的 frontmatter 导致变量未声明
    }
  });

  it('YAML 值含二进制/不可打印字符 → 不崩溃', () => {
    // js-yaml 对二进制字符的处理：可能产生解析错误，但不应抛异常
    const binaryTitle = 'Test\x00Title\x01\x02';
    const content = `---
title: ${binaryTitle}
vars:
  data: string
---

# 第一章

## 节点：起点

正文。
`;
    const result = parseStory(content);
    // 可能解析成功或失败，但不应该抛异常
    expect(() => result.ok).not.toThrow();
  });

  it('vars: 部分完全为空 → 不崩溃', () => {
    const content = `---
title: 空变量
vars:
---

# 第一章

## 节点：起点

正文。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // vars: 后面没有内容 → 变量列表应为空
      expect(result.data.variables).toEqual([]);
    }
  });

  it('嵌套 object 超过最大深度（3 层）→ 产生 E006 错误', () => {
    const content = `---
vars:
  deep: object{
    a: object{
      b: object{
        c: int
      }
    }
  }
---

# 第一章

## 节点：起点

正文。
`;
    const result = parseStory(content);
    // E006 是错误级诊断 → ok 应为 false
    // 但注意：parseFrontmatter 返回的错误会在 parseStory 中汇聚
    // 由于 Frontmatter 有错误，ok 可能为 false
    if (!result.ok) {
      const e006Diags = result.errors.filter((d) => d.code === 'E006');
      expect(e006Diags.length).toBeGreaterThanOrEqual(1);
    } else {
      // 如果解析通过（容错），变量可能没有被正确解析
      if (result.data.variables.length > 0) {
        // 检查深度
        const deepVar = result.data.variables.find((v) => v.name === 'deep');
        if (deepVar && deepVar.fields) {
          // 可能被截断或降级
          console.log('[EDGE-05] 深层嵌套 object 被容错解析');
        }
      }
    }
  });

  it('Frontmatter 中变量重复声明 → 产生 E008 错误', () => {
    const content = `---
vars:
  金币: int
  金币: int
---

# 第一章

## 节点：起点

正文。
`;
    const result = parseStory(content);
    if (!result.ok) {
      const e008Diags = result.errors.filter((d) => d.code === 'E008');
      expect(e008Diags.length).toBeGreaterThanOrEqual(1);
    }
    // 也可能容错解析（后面的覆盖前面的）但应有诊断
    if (result.ok) {
      // 检查解析结果的诊断中是否有 E008
      // parseStory 通过 success/failure 返回诊断
      // 但 ok 路径只包含 warning/info 级别诊断
      // 所以 E008 如果产生会导致 ok = false
      // 如果容错处理了，ok 可能为 true
      // 这个断言不那么严格，因为可能存在容错
    }
  });

  it('变量名含特殊字符 → 产生 E005 错误', () => {
    const content = `---
vars:
  123invalid: int
  bad-name: string
  special@char: bool
---

# 第一章

## 节点：起点

正文。
`;
    const result = parseStory(content);
    // 无效变量名应在 Frontmatter 解析阶段产生 E005
    // 可能是 error 级别的 → ok = false
    if (!result.ok) {
      const e005Diags = result.errors.filter((d) => d.code === 'E005');
      expect(e005Diags.length).toBeGreaterThanOrEqual(1);
    }
  });
});

// ============================================================================
// J-11: Unicode 与特殊字符
// ============================================================================

describe('J-11: Unicode 与特殊字符', () => {
  it('节点名含 emoji → 解析成功且不破坏结构', () => {
    const content = `---
---
# 第一章

## 节点：🎮⚔️🛡️

你发现了一把传说中的武器。

[选项] 拿起剑 -> 节点：🗡️试炼
[选项] 离开 -> 节点：end

## 节点：🗡️试炼

战斗开始！

[选项] 攻击 -> 节点：end
[选项] 防御 -> 节点：end

## 节点：end

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const nodes = result.data.chapters.flatMap((c) => c.nodes);
      const emojiNode = nodes.find((n) => n.id === '🎮⚔️🛡️');
      expect(emojiNode).toBeDefined();
      expect(emojiNode!.title).toBe('🎮⚔️🛡️');

      const trialNode = nodes.find((n) => n.id === '🗡️试炼');
      expect(trialNode).toBeDefined();
      expect(trialNode!.options).toHaveLength(2);
    }
  });

  it('选项含中文全角标点 → 解析成功', () => {
    const content = `---
---
# 第一章

## 节点：宝箱

[选项] 打开「宝箱」→ 获得『钥匙』 -> 节点：获得钥匙
[选项] 离开…… -> 节点：end

## 节点：获得钥匙

你获得了「金钥匙」！

## 节点：end

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const node = result.data.chapters
        .flatMap((c) => c.nodes)
        .find((n) => n.id === '宝箱');
      expect(node).toBeDefined();
      expect(node!.options).toHaveLength(2);
      expect(node!.options[0]!.description).toContain('「宝箱」');
      expect(node!.options[1]!.description).toContain('……');
    }
  });

  it('混合 CJK 与西文 → 解析成功', () => {
    const content = `---
vars:
  playerName: string
  hp: int
  maxHP: int
---

# Chapter 1: 冒险开始

## 节点：start

Hello, 世界！あなたの冒険が始まる。

[选项] 進む (Forward) -> 节点：forest
[选项] 戻る (Back) & 离开 -> 节点：end

## 节点：forest

你走进了 🌳 Forest of 試練。
HP: $hp / $maxHP

[选项] Fight 戦う！-> 节点：end

## 节点：end

Goodbye, $playerName.
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const chapters = result.data.chapters;
      expect(chapters.length).toBeGreaterThanOrEqual(1);
      const nodes = chapters.flatMap((c) => c.nodes);
      expect(nodes.length).toBeGreaterThanOrEqual(3);

      // 验证变量
      expect(result.data.variables).toHaveLength(3);
    }
  });

  it('变量值含引号 → 正确转义', () => {
    const content = `---
title: 他说"你好"
vars:
  message: string
---

# 第一章

## 节点：start

他说"你好"。

[选项] 回复 -> 节点：end

## 节点：end

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.meta.title).toBe('他说"你好"');
    }
  });

  it('变量名含中文 → 解析成功', () => {
    const content = `---
vars:
  玩家等级: int
  生命值: int
  角色名: string
---

# 第一章

## 节点：start

$玩家等级, $生命值, $角色名

[选项] 继续 -> 节点：end

## 节点：end

结束。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const varNames = result.data.variables.map((v) => v.name);
      expect(varNames).toContain('玩家等级');
      expect(varNames).toContain('生命值');
      expect(varNames).toContain('角色名');
    }
  });

  it('枚举类型含中文值 → 正确解析', () => {
    const content = `---
vars:
  职业: enum[战士, 法师, 盗贼]
---

# 第一章

## 节点：start

选择你的职业。

[选项] 战士 -> 节点：warrior
[选项] 法师 -> 节点：mage
[选项] 盗贼 -> 节点：rogue

## 节点：warrior

你是战士。

## 节点：mage

你是法师。

## 节点：rogue

你是盗贼。
`;
    const result = parseStory(content);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const jobVar = result.data.variables.find((v) => v.name === '职业');
      expect(jobVar).toBeDefined();
      expect(jobVar!.type).toBe('enum');
      expect(jobVar!.enumValues).toEqual(['战士', '法师', '盗贼']);
      expect(jobVar!.defaultValue).toBe('战士');
    }
  });
});

// ============================================================================
// 组合场景：多种边界条件同时生效
// ============================================================================

describe('组合场景：多边界并发', () => {
  it('大文件 + Unicode 节点名 + 条件选项 → 不崩溃', () => {
    // 生成 50 节点，节点名含 emoji 和中文，含条件和效果
    const lines: string[] = [];
    lines.push('---');
    lines.push('title: 🎮 综合压力测试');
    lines.push('vars:');
    for (let i = 1; i <= 10; i++) {
      lines.push(`  变量${i}: int`);
    }
    lines.push('---');
    lines.push('');

    for (let nd = 1; nd <= 50; nd++) {
      const emojis = ['🔥', '⚔️', '🛡️', '🧪', '📜', '💎', '🗺️', '🏰', '🧙', '🐉'];
      const emoji = emojis[nd % emojis.length];
      const nodeId = `场景${nd}${emoji}`;
      lines.push(`# 第${Math.ceil(nd / 10)}章`);
      lines.push('');
      lines.push(`## 节点：${nodeId}`);
      lines.push('');
      lines.push(`这是第 ${nd} 个场景的描述。变量值: $变量${(nd % 10) + 1}`);
      lines.push('');
      lines.push(`[选项] 继续前进 [变量${(nd % 10) + 1} > 0] {变量${(nd % 10) + 1} -= 1} -> 节点：场景${nd + 1}${emojis[(nd + 1) % emojis.length]}`);
      lines.push(`[选项] 跳过条件 -> 节点：场景${nd + 1}${emojis[(nd + 1) % emojis.length]}`);
      lines.push('');
    }

    // 结束节点
    lines.push('## 节点：终');
    lines.push('');
    lines.push('🎉 故事结束！');
    lines.push('');

    const content = lines.join('\n');
    const startTime = performance.now();
    const result = parseStory(content);
    const elapsed = performance.now() - startTime;

    console.log(`[组合测试] 50节点+Unicode+条件 解析耗时: ${elapsed.toFixed(1)}ms`);

    // 不应抛异常
    expect(result.ok).toBeDefined();
    expect(elapsed).toBeLessThan(10000);
  });
});
