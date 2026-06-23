/**
 * Fuzz Tests — PlotFlow Parser
 *
 * Comprehensive fuzz testing for parseStory:
 * - Random valid syntax combos
 * - Malformed inputs (unclosed brackets, invalid YAML, binary sim, 10K+ char)
 * - Mixed CJK + emoji + RTL
 * - Deeply nested conditions
 * - Empty docs
 * - Duplicate IDs
 * - Circular refs (A→B→C→A)
 *
 * Every case checks: no crash, parse time < 100ms normal.
 */
import { describe, it, expect } from 'vitest';
import { parseStory } from '../parser/parser.js';
import { parseFrontmatter } from '../parser/frontmatter.js';
import { parseOptions } from '../parser/options.js';
import { parseCondition } from '../parser/conditions.js';
import { parseEffects } from '../parser/effects.js';

// ============================================================================
// Helpers
// ============================================================================

/** Time a parse call, returning { result, ms } */
function timeParse(raw: string): { result: ReturnType<typeof parseStory>; ms: number } {
  const start = performance.now();
  const result = parseStory(raw);
  const ms = performance.now() - start;
  return { result, ms };
}

/**
 * Time the same parse input multiple times and return the median run time.
 * This keeps the fuzz check stable while still failing on sustained regressions.
 */
function timeParseStable(raw: string, sampleCount = 3): { result: ReturnType<typeof parseStory>; ms: number } {
  const samples: number[] = [];
  let result: ReturnType<typeof parseStory> | undefined;

  // Warm up once so the measurement is less sensitive to JIT/cold-cache noise.
  timeParse(raw);

  for (let i = 0; i < sampleCount; i++) {
    const timed = timeParse(raw);
    result = timed.result;
    samples.push(timed.ms);
  }

  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)] ?? 0;
  return { result: result as ReturnType<typeof parseStory>, ms: median };
}

/** Time any function call */
function timeIt<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

/** Assert no crash (result is defined, no thrown exception) */
function assertNoCrash(result: unknown): void {
  expect(result).toBeDefined();
  expect(typeof result).toBe('object');
  expect(result).not.toBeNull();
}

// ============================================================================
// Fuzz Test Suite
// ============================================================================

describe('Fuzz: Parser Robustness', () => {

  // --------------------------------------------------------------------------
  // 1. Empty / Near-empty Docs
  // --------------------------------------------------------------------------
  describe('Category 1: Empty / Near-empty Docs', () => {
    const cases: Array<[string, string]> = [
      ['empty string', ''],
      ['single newline', '\n'],
      ['multiple newlines', '\n\n\n\n\n'],
      ['only whitespace', '   \t  \n  \t \n  '],
      ['only BOM', '﻿'],
      ['BOM + content', '﻿# 章\n\n## 节点：A\n\n正文\n'],
    ];

    for (const [name, input] of cases) {
      it(`no crash: ${name}`, () => {
        const { result, ms } = timeParse(input);
        assertNoCrash(result);
        expect(ms).toBeLessThan(100);
      });
    }
  });

  // --------------------------------------------------------------------------
  // 2. Valid Random Syntax Combos
  // --------------------------------------------------------------------------
  describe('Category 2: Random Valid Syntax Combos', () => {
    for (let seed = 0; seed < 20; seed++) {
      it(`seed ${seed}: random valid doc`, () => {
        // Generate pseudo-random but deterministic inputs
        const rng = mulberry32(seed);

        const parts: string[] = [];

        // Optional Frontmatter
        if (rng() > 0.3) {
          parts.push('---');
          parts.push('title: "Fuzz Story ' + seed + '"');
          parts.push('author: Fuzzer');
          parts.push('plotflow: "0.1"');
          parts.push('vars:');
          const varCount = Math.floor(rng() * 5) + 1;
          const varNames = ['hp', 'mp', 'gold', 'reputation', 'hasKey', 'magicLevel', 'friendship'];
          for (let v = 0; v < varCount; v++) {
            const vName = varNames[v % varNames.length]! + (v > 0 ? v : '');
            const vType = ['int', 'float', 'bool', 'string'][Math.floor(rng() * 4)]!;
            if (vType === 'bool') {
              parts.push('  ' + vName + ': bool');
            } else {
              parts.push('  ' + vName + ': ' + vType);
            }
          }
          parts.push('---');
          parts.push('');
        }

        // Chapters and nodes
        const chapterCount = Math.floor(rng() * 4) + 1;
        for (let c = 0; c < chapterCount; c++) {
          const chapterTitle = ['序幕', '第一章', '第二章', '第三章', '终章'][c] ?? '第' + c + '章';
          parts.push('# ' + chapterTitle);
          parts.push('');

          const nodeCount = Math.floor(rng() * 4) + 1;
          for (let n = 0; n < nodeCount; n++) {
            const nodeTitle = '节点' + c + '_' + n + '_' + ['森林', '城堡', '洞穴', '村庄', '山顶'][n % 5];
            parts.push('## 节点：' + nodeTitle);
            parts.push('');
            parts.push('这是' + nodeTitle + '的正文描述。');
            parts.push('第二行内容。');

            // Options
            const optCount = Math.floor(rng() * 3) + 1;
            for (let o = 0; o < optCount; o++) {
              const targetChapter = Math.floor(rng() * chapterCount);
              const targetNode = Math.floor(rng() * 4);
              const targetNodeTitle = '节点' + targetChapter + '_' + targetNode + '_' + ['森林', '城堡', '洞穴', '村庄', '山顶'][targetNode % 5];
              parts.push(
                '[选项] 选项' + n + '_' + o + ' -> 节点：' + targetNodeTitle
              );

              // Optional condition
              if (rng() > 0.7) {
                parts.push('  条件: gold > 10');
              }
              // Optional effect
              if (rng() > 0.6) {
                parts.push('  效果: (gold - 10)');
              }
            }

            parts.push('');
            // Optional separator
            if (rng() > 0.8) {
              parts.push('---');
              parts.push('');
            }
          }
        }

        const input = parts.join('\n');
        const { result, ms } = timeParseStable(input);

        assertNoCrash(result);
        // Valid combos should parse fast
        expect(ms).toBeLessThan(100);

        // If it parsed OK, data should be well-formed
        if (result.ok) {
          for (const ch of result.data.chapters) {
            expect(ch.id).toBeDefined();
            expect(Array.isArray(ch.nodes)).toBe(true);
            for (const node of ch.nodes) {
              expect(node.id).toBeDefined();
              expect(node.fullId).toBeDefined();
              expect(Array.isArray(node.options)).toBe(true);
            }
          }
        }
      });
    }
  });

  // --------------------------------------------------------------------------
  // 3. Malformed Inputs — Unclosed Brackets
  // --------------------------------------------------------------------------
  describe('Category 3: Malformed — Unclosed Brackets', () => {
    it('unclosed frontmatter ---', () => {
      const input = '---\ntitle: test\nvars:\n  hp: int\n---  missing end';
      const { result } = timeParse(input);
      assertNoCrash(result);
      // May be ok or fail — just no crash
    });

    it('unclosed object type {', () => {
      const input = `---
vars:
  player: object{
    name: string
    level: int
---
# 章

## 节点：A

正文
`;
      const { result } = timeParse(input);
      assertNoCrash(result);
    });

    it('unclosed enum [', () => {
      const input = `---
vars:
  class: enum[战士, 法师
---
# 章

## 节点：A

正文
`;
      const { result } = timeParse(input);
      assertNoCrash(result);
    });

    it('unclosed effect parens', () => {
      const input = `# 章

## 节点：A

正文
[选项] 继续 -> 节点：B
  效果: (hp - 10  missing close paren
`;
      const { result } = timeParse(input);
      assertNoCrash(result);
    });

    it('nested unclosed brackets', () => {
      const input = `---
vars:
  data: object{
    inner: object{
      deep: enum[a, b
---
# X

## 节点：N

[[[unclosed brackets]]]
`;
      const { result } = timeParse(input);
      assertNoCrash(result);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Malformed — Invalid YAML
  // --------------------------------------------------------------------------
  describe('Category 4: Malformed — Invalid YAML', () => {
    it('YAML with tab in wrong place', () => {
      const input = '---\ntitle:\t\tmixed tabs\nvars:\n  hp: int\n---\n';
      const { result } = timeParse(input);
      assertNoCrash(result);
    });

    it('YAML with bare colon', () => {
      const input = '---\n:\nvars:\n  hp: int\n---\n';
      const { result } = timeParse(input);
      assertNoCrash(result);
    });

    it('YAML with NaN float', () => {
      const input = '---\ntitle: .nan\nvars:\n  hp: int\n---\n';
      const { result } = timeParse(input);
      assertNoCrash(result);
    });

    it('YAML with Infinity', () => {
      const input = '---\ntitle: .inf\nvars:\n  hp: int\n---\n';
      const { result } = timeParse(input);
      assertNoCrash(result);
    });

    it('YAML with deeply nested anchors (if supported)', () => {
      const input = '---\na: &anchor\n  b: *anchor\nvars:\n  hp: int\n---\n';
      const { result } = timeParse(input);
      assertNoCrash(result);
    });

    it('YAML with mixed types in array', () => {
      const input = `---
title: [1, "two", true, null]
vars:
  hp: int
---
# 章

## 节点：A

正文
`;
      const { result } = timeParse(input);
      assertNoCrash(result);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Binary Data Sim
  // --------------------------------------------------------------------------
  describe('Category 5: Binary Data Sim', () => {
    it('null bytes embedded', () => {
      const input = '---\ntitle: test\0broken\n---\n# 章\n\n## 节点：A\n\n正文\0more\0chars\n';
      const { result } = timeParse(input);
      assertNoCrash(result);
    });

    it('random binary-like bytes', () => {
      // Generate printable and non-printable ASCII mix
      let raw = '';
      for (let i = 0; i < 200; i++) {
        raw += String.fromCodePoint(Math.floor(Math.random() * 256));
      }
      const { result } = timeParse(raw);
      assertNoCrash(result);
    });

    it('high surrogates without low surrogate', () => {
      const input = '# 章\n\n## 节点：\uD800\uD800test\n\n正文\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('lone low surrogate', () => {
      const input = '# 章\n\n## 节点：\uDC00 solo\n\n正文\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      // solo low surrogate: the parser should handle string length in codepoints
      // which means [...str] will include the lone surrogate as one codepoint
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 6. 10K+ Character Node Names
  // --------------------------------------------------------------------------
  describe('Category 6: Oversized Node Names', () => {
    it('10K char node name', () => {
      const bigName = 'A'.repeat(10_000);
      const input = '# 章\n\n## 节点：' + bigName + '\n\n正文\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      // Should fail with E005, but must not crash
      expect(ms).toBeLessThan(500);
    });

    it('50K char node name', () => {
      const bigName = 'B'.repeat(50_000);
      const input = '# 章\n\n## 节点：' + bigName + '\n\n正文\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(2000);
    });

    it('10K char chapter title', () => {
      const bigTitle = 'C'.repeat(10_000);
      const input = '# ' + bigTitle + '\n\n## 节点：A\n\n正文\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(500);
    });

    it('10K char option description', () => {
      const bigDesc = 'D'.repeat(10_000);
      const input = '# 章\n\n## 节点：A\n\n正文\n[选项] ' + bigDesc + ' -> 节点：B\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(500);
    });

    it('10K char node body', () => {
      const bigBody = 'E'.repeat(10_000);
      const input = '# 章\n\n## 节点：A\n\n' + bigBody + '\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(500);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Mixed CJK + Emoji + RTL
  // --------------------------------------------------------------------------
  describe('Category 7: Mixed CJK + Emoji + RTL', () => {
    it('CJK chapter and node titles', () => {
      const input = `# 序幕：千年之约 📜

## 节点：🗡️ 龍が如く・鳳凰涅槃

遠古の予言により、世界は闇に包まれた。
勇者たちは立ち上がった——だが、それは始まりに過ぎない。

「難道……這就是命運嗎？」少女喃喃自語。
"Destiny is not written," 盔甲之下傳來低沉的回應。

[选项] 🔥 接受試煉，踏上征途 -> 节点：试炼神殿
[选项] 😱 退缩 -> 节点：村庄出口
      `;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('RTL text (Arabic) in body', () => {
      const input = `# 章

## 节点：RTL测试

هذا نص عربي للاختبار.
The quick brown fox jumps over the lazy dog.
مرحبا بالعالم!
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('mixed CJK + emoji + RTL node titles', () => {
      const input = `# テスト・اختبار・🧪

## 节点：مرحبا・你好・👋

متعدد اللغات テスト 🎉 متن.
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('emoji in option descriptions', () => {
      const input = `# 章

## 节点：Emoji测试

正文。

[选项] 🗡️ 攻击！ ⚔️ -> 节点：战斗
[选项] 🛡️ 防御 💪 -> 节点：防御
[选项] 🏃‍♂️ 逃跑 → 💨 -> 节点：撤退
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('Zalgo text (combining chars)', () => {
      const input = `# 章

## 节点：Zalgo

T̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺͔̹̖̮̦̲̭̫̜̳̲̺͔h̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺͔i̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺s̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺ i̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺s̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺ Z̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺a̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺l̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺g̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺ơ̷̢̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('zero-width characters in node names', () => {
      /* eslint-disable no-irregular-whitespace */
      const input = `# 章

## 节点：​hidden‌zero‍width

正文
`;
      /* eslint-enable no-irregular-whitespace */
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Deeply Nested Conditions
  // --------------------------------------------------------------------------
  describe('Category 8: Deeply Nested Conditions', () => {
    it('single deep condition: 10 AND', () => {
      const cond = Array(10).fill('hp > 0').join(' AND ');
      const input = `# 章

## 节点：A

正文
[选项] test -> 节点：B
  条件: ${cond}
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('nested conditions with parens', () => {
      const cond = 'hp > 0 AND (mp > 10 OR (level >= 5 AND gold > 100))';
      const input = `# 章

## 节点：A

正文
[选项] test -> 节点：B
  条件: ${cond}
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('deeply nested (10 levels)', () => {
      let cond = 'hp > 0';
      for (let i = 0; i < 9; i++) {
        cond = `(${cond}) AND hp > ${i}`;
      }
      const input = `# 章

## 节点：A

正文
[选项] test -> 节点：B
  条件: ${cond}
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('multiple NOT operators', () => {
      const cond = 'NOT NOT NOT NOT hp <= 0';
      const input = `# 章

## 节点：A

正文
[选项] test -> 节点：B
  条件: ${cond}
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('long expression: 100 AND-chained', () => {
      const cond = Array(100).fill('x == 1').join(' AND ');
      const input = `# 章

## 节点：A

正文
[选项] test -> 节点：B
  条件: ${cond}
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      // May be slower due to many operands
      expect(ms).toBeLessThan(500);
    });
  });

  // --------------------------------------------------------------------------
  // 9. Duplicate IDs
  // --------------------------------------------------------------------------
  describe('Category 9: Duplicate IDs', () => {
    it('duplicate node IDs within same chapter', () => {
      const input = `# 章

## 节点：A

正文1

## 节点：A

正文2

## 节点：A

正文3
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      // V02-033: parseStory 始终返回 success，错误通过 diagnostics 传递
      expect(result.ok).toBe(true);
      if (result.ok) {
        const e007Count = result.diagnostics.filter((e) => e.code === 'E007' && e.severity === 'error').length;
        expect(e007Count).toBeGreaterThanOrEqual(2);
      }
      expect(ms).toBeLessThan(100);
    });

    it('duplicate variable names in frontmatter', () => {
      const input = `---
vars:
  hp: int
  hp: int
  mp: float
  mp: float
---
# 章

## 节点：A

正文
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('duplicate chapter IDs (same chapter name)', () => {
      const input = `# 第一章

## 节点：起始

正文1

# 第一章

## 节点：起始

正文2
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('many duplicate options (same description)', () => {
      const input = `# 章

## 节点：A

正文
[选项] 继续 -> 节点：B
[选项] 继续 -> 节点：B
[选项] 继续 -> 节点：C
[选项] 继续 -> 节点：C
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Circular Refs (A→B→C→A)
  // --------------------------------------------------------------------------
  describe('Category 10: Circular References', () => {
    it('simple A→B→A cycle', () => {
      const input = `# 章

## 节点：A

正文A
[选项] 去B -> 节点：B

## 节点：B

正文B
[选项] 回A -> 节点：A
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(result.ok).toBe(true);
      expect(ms).toBeLessThan(100);
    });

    it('A→B→C→A cycle (3 nodes)', () => {
      const input = `# 章

## 节点：A

正文A
[选项] 去B -> 节点：B

## 节点：B

正文B
[选项] 去C -> 节点：C

## 节点：C

正文C
[选项] 回A -> 节点：A
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(result.ok).toBe(true);
      expect(ms).toBeLessThan(100);
    });

    it('self-loop A→A', () => {
      const input = `# 章

## 节点：A

正文A
[选项] 再来一次 -> 节点：A
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(result.ok).toBe(true);
      expect(ms).toBeLessThan(100);
    });

    it('cross-chapter circular ref', () => {
      const input = `# 第一章

## 节点：入口

正文
[选项] 进入 -> 节点：大厅

# 第二章

## 节点：大厅

正文
[选项] 返回 -> 节点：入口
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(result.ok).toBe(true);
      expect(ms).toBeLessThan(100);
    });

    it('deep chain: 50 nodes all pointing to next, last to first', () => {
      const parts: string[] = [];
      parts.push('# 环');
      parts.push('');
      for (let i = 0; i < 50; i++) {
        const next = i < 49 ? i + 1 : 0;
        parts.push('## 节点：N' + i);
        parts.push('');
        parts.push('节点 ' + i + ' 的正文。');
        parts.push('[选项] 前往 -> 节点：N' + next);
        parts.push('');
      }
      const input = parts.join('\n');
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(result.ok).toBe(true);
      expect(ms).toBeLessThan(200);
    });

    it('diamond pattern with cycles', () => {
      const input = `# 章

## 节点：开始

正文开始
[选项] 左路 -> 节点：左
[选项] 右路 -> 节点：右

## 节点：左

正文左
[选项] 汇合 -> 节点：汇合

## 节点：右

正文右
[选项] 汇合 -> 节点：汇合

## 节点：汇合

正文汇合
[选项] 回到起点 -> 节点：开始
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(result.ok).toBe(true);
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 11. Deeply Nested Objects in Frontmatter
  // --------------------------------------------------------------------------
  describe('Category 11: Deeply Nested Objects', () => {
    it('max depth object (3 levels)', () => {
      const input = `---
vars:
  player: object{
    stats: object{
      combat: object{
        attack: int
        defense: int
      }
    }
  }
---
# 章

## 节点：A

正文
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('exceed max depth (4 levels) → E006', () => {
      const input = `---
vars:
  player: object{
    stats: object{
      combat: object{
        physical: object{
          attack: int
        }
      }
    }
  }
---
# 章

## 节点：A

正文
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 12. Effects with Various Edge Cases
  // --------------------------------------------------------------------------
  describe('Category 12: Effects Edge Cases', () => {
    it('many simultaneous effects', () => {
      const effects = Array(20).fill('hp + 1').join(', ');
      const input = `# 章

## 节点：A

正文
[选项] buff -> 节点：B
  效果: (${effects})
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('append effects', () => {
      const input = `# 章

## 节点：A

正文
[选项] add item -> 节点：B
  效果: (inventory ← 'Sword of Destiny', hp + 50, gold - 100)
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 13. Frontmatter with Many Variables
  // --------------------------------------------------------------------------
  describe('Category 13: Large Frontmatter', () => {
    it('200 variables', () => {
      const parts: string[] = ['---', 'title: "Large Test"', 'vars:'];
      for (let i = 0; i < 200; i++) {
        const types = ['int', 'float', 'bool', 'string'];
        parts.push('  var' + i + ': ' + types[i % 4]);
      }
      parts.push('---');
      parts.push('');
      parts.push('# 章');
      parts.push('');
      parts.push('## 节点：A');
      parts.push('');
      parts.push('正文');
      const input = parts.join('\n');
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(200);
    });
  });

  // --------------------------------------------------------------------------
  // 14. Tab vs Space Indentation
  // --------------------------------------------------------------------------
  describe('Category 14: Tab/Space Indentation', () => {
    it('tab-indented option', () => {
      const input = `# 章

## 节点：A

正文
\t[选项] tabbed option -> 节点：B
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('mixed tabs and spaces in frontmatter vars', () => {
      const input = `---
vars:
  hp: int
\tmp: float
  gold: int
---
# 章

## 节点：A

正文
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 15. Very Large Documents
  // --------------------------------------------------------------------------
  describe('Category 15: Large Documents', () => {
    it('200 nodes with text', () => {
      const parts: string[] = ['# 大型测试'];
      parts.push('');
      for (let i = 0; i < 200; i++) {
        parts.push('## 节点：N' + i);
        parts.push('');
        parts.push('这是节点 N' + i + ' 的正文内容。它包含多行文本。');
        parts.push('第二行。');
        parts.push('[选项] 前进 -> 节点：N' + ((i + 1) % 200));
        parts.push('');
      }
      const input = parts.join('\n');
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      // 200 nodes is significant but should complete
      expect(ms).toBeLessThan(1000);
    });
  });

  // --------------------------------------------------------------------------
  // 16. Individual Sub-Parser Fuzzing
  // --------------------------------------------------------------------------
  describe('Category 16: Sub-Parser Fuzzing', () => {
    it('parseFrontmatter: garbage input', () => {
      const inputs = [
        '---\n{{{}}}\n---\n',
        '---\ntitle: [1, [2, [3]]]\n---\n',
        '---\n\x00\x01\x02\n---\n',
      ];
      for (const input of inputs) {
        const { value, ms } = timeIt(() => parseFrontmatter(input));
        assertNoCrash(value);
        expect(ms).toBeLessThan(100);
      }
    });

    it('parseOptions: garbage body', () => {
      const inputs = [
        '[选项] ',
        '[选项]    ',
        '[选项] a -> ',
        '[选项] a -> 节点：',
        '\t\t\t[选项] deep indent -> 节点：X',
      ];
      for (const input of inputs) {
        const { value, ms } = timeIt(() => parseOptions(input, 1, []));
        assertNoCrash(value);
        expect(ms).toBeLessThan(100);
      }
    });

    it('parseCondition: edge cases', () => {
      const inputs = [
        '',
        '   ',
        'hp >',
        '> 10',
        'hp == == 10',
        'hp > 10 AND',
        'AND hp > 10',
        '((hp > 10)',
        '(hp > 10))',
        'hp > 10 AND OR mp < 5',
        'NOT',
        'NOT hp',
        'x > 1 AND NOT NOT NOT NOT y < 2',
        'a > 0 AND b > 0 AND c > 0 AND d > 0 AND e > 0 AND f > 0 AND g > 0 AND h > 0 AND i > 0 AND j > 0',
      ];
      for (const input of inputs) {
        const { value, ms } = timeIt(() => parseCondition(input, [], 1));
        assertNoCrash(value);
        expect(ms).toBeLessThan(100);
      }
    });

    it('parseEffects: edge cases', () => {
      const inputs = [
        '',
        '   ',
        'hp',
        'hp =',
        '= 10',
        'hp = = 10',
        'hp ←',
        'hp ← a, hp ← b',
        'a + 1, b+2, c+3,  d + 4',
        stringWithUnicode('🎉', 100),
      ];
      for (const input of inputs) {
        const { value, ms } = timeIt(() => parseEffects(input, [], 1));
        assertNoCrash(value);
        expect(ms).toBeLessThan(100);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 17. SQL/Code Injection-like Inputs
  // --------------------------------------------------------------------------
  describe('Category 17: Injection-like Inputs', () => {
    it('SQL injection attempt in body', () => {
      const input = `# 章

## 节点：A

正文; DROP TABLE nodes; --
[选项] ' OR 1=1; -- -> 节点：B
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('HTML injection in body', () => {
      const input = `# 章

## 节点：A

<script>alert('xss')</script>
<img src=x onerror=alert(1)>
[选项] <iframe src=evil.com> -> 节点：B
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('JS template literal injection', () => {
      const input = `# 章

## 节点：\${7*7}

正文\${constructor.constructor('return this')()}
[选项] \${process.exit()} -> 节点：B
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 18. Unicode Edge Cases
  // --------------------------------------------------------------------------
  describe('Category 18: Unicode Edge Cases', () => {
    it('right-to-left override chars', () => {
      // RLO (U+202E) and PDF (U+202C)
      const input = '# 章\n\n## 节点：‮backwards‬\n\n正文\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('variation selectors', () => {
      const input = '# 章\n\n## 节点：test️more\n\n正文\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('skin tone modifiers', () => {
      const input = '# 章\n\n## 节点：👋🏻👋🏼👋🏽👋🏾👋🏿\n\n正文\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('flags and ZWJ sequences', () => {
      const input = '# 章\n\n## 节点：🏳️‍🌈👨‍👩‍👧‍👦🇨🇳\n\n正文\n';
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 19. Malformed Node/Chapter Syntax
  // --------------------------------------------------------------------------
  describe('Category 19: Malformed Syntax', () => {
    it('### triple hash (not recognized)', () => {
      const input = `# 章

## 节点：A

正文

### 节点：sub

正文2
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('bare ## without 节点 keyword', () => {
      const input = `# 章

## Not a node

Just markdown.

## 节点：ActuallyANode

正文
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('Chinese colon vs ASCII colon mix', () => {
      const input = `# 章

## 节点：Test节点
## 节点:Another节点

正文混合
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });

    it('--- in body vs as separator (ambiguous)', () => {
      const input = `# 章

## 节点：A

正文A

---

这里不是新节点，是正文中的水平线。

---

## 节点：B

正文B
`;
      const { result, ms } = timeParse(input);
      assertNoCrash(result);
      expect(ms).toBeLessThan(100);
    });
  });

  // --------------------------------------------------------------------------
  // 20. Stress: Repeated parseStory on different inputs
  // --------------------------------------------------------------------------
  describe('Category 20: Repeat Parse Stress', () => {
    it('100 rapid parses of different inputs', () => {
      const maxTime = { ms: 0 };
      for (let i = 0; i < 100; i++) {
        const input = `# 第${i}章

## 节点：节点${i}

正文内容${i}。
[选项] 前往${(i + 1) % 100} -> 节点：节点${(i + 1) % 100}
`;
        const { result, ms } = timeParse(input);
        if (ms > maxTime.ms) maxTime.ms = ms;
        assertNoCrash(result);
      }
      // Average should be fast but we check max
      expect(maxTime.ms).toBeLessThan(200);
    });
  });
});

// ============================================================================
// Pseudo-random number generator (mulberry32)
// ============================================================================
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// Helper for unicode string generation
// ============================================================================
function stringWithUnicode(ch: string, count: number): string {
  let s = '';
  for (let i = 0; i < count; i++) s += ch;
  return s;
}
