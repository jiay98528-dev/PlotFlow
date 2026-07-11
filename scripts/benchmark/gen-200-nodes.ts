/**
 * Generate a 200-node .mdstory test file for performance benchmarking.
 *
 * Structure:
 *   - 4 chapters x 50 nodes each = 200 nodes
 *   - Each node has 2-3 options (average ~2.5)
 *   - 30% of options have conditions
 *   - 40% of options have effects
 *   - Variables: 10 multi-type declarations
 *   - Total: ~500 options, ~200 conditions, ~200 effects
 *
 * run: npx tsx scripts/benchmark/gen-200-nodes.ts
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const FRONTMATTER = `---
plotflow: "0.1"
title: "PerfTest-200Nodes"
author: "Benchmark"
variables:
  - name: hp
    type: int
    default: 100
  - name: gold
    type: int
    default: 0
  - name: reputation
    type: enum
    values: ["hero","neutral","villain"]
    default: "neutral"
  - name: hasSword
    type: bool
    default: false
  - name: faction
    type: string
    default: "none"
  - name: completedQuests
    type: int
    default: 0
  - name: chapterFlag
    type: bool
    default: false
  - name: companion
    type: string
    default: ""
  - name: magicPower
    type: int
    default: 10
  - name: darkSide
    type: bool
    default: false
engine: godot
---

`;

const NODES_PER_CHAPTER = 50;
const CHAPTER_COUNT = 4;

const CHAPTER_NAMES = ['第一章：冒险启程', '第二章：命运之路', '第三章：黑暗降临', '第四章：最终决战'];

const CONDITIONS = ['hp > 50', 'gold >= 100', 'reputation == "hero"', 'hasSword == true', 'magicPower >= 30', 'darkSide == true', 'companion != ""', 'gold >= 50', 'hp >= 80', 'completedQuests >= 3'];
const EFFECTS = ['(hp - 10)', '(gold - 50)', '(gold + 100)', '(hp + 20)', '(reputation = "hero")', '(hasSword = true)', '(magicPower + 15)', '(companion = "战士")', '(darkSide = true)', '(completedQuests + 1)'];

function generate(): string {
  const lines: string[] = [FRONTMATTER];

  for (let ch = 0; ch < CHAPTER_COUNT; ch++) {
    const chapterName = CHAPTER_NAMES[ch]!;
    lines.push(`# ${chapterName}\n`);

    for (let n = 0; n < NODES_PER_CHAPTER; n++) {
      const nodeIdx = ch * NODES_PER_CHAPTER + n;
      const nodeTitle = `场景${(nodeIdx + 1).toString().padStart(3, '0')}`;
      lines.push(`## 节点：${nodeTitle}`);

      // Node body
      lines.push(`这是第 ${nodeIdx + 1} 个节点的正文描述。`);
      lines.push(`角色在这一场景中面临选择，前方的道路充满了未知与挑战。`);
      if (n % 5 === 0) {
        lines.push('古老的预言之石闪烁着微弱的光芒，空气中弥漫着魔法的气息。');
      }

      // 2-3 options per node
      const optCount = 2 + (n % 2); // 2 or 3
      for (let o = 0; o < optCount; o++) {
        const targetChapter = (ch + o + 1) % CHAPTER_COUNT;
        const targetNode = (n + o * 3 + 7) % NODES_PER_CHAPTER;
        const targetIdx = targetChapter * NODES_PER_CHAPTER + targetNode;
        const targetTitle = `场景${(targetIdx + 1).toString().padStart(3, '0')}`;

        const descs = ['继续前行', '探索周围', '与同伴商议', '返回原路', '使用特殊能力', '仔细观察', '发起挑战', '寻求帮助', '深入调查', '暂时休息'];
        const desc = descs[(nodeIdx + o) % descs.length]!;

        lines.push(`[选项] ${desc} -> 节点：${targetTitle}`);

        // ~30% have conditions
        if ((nodeIdx + o * 7) % 10 < 3) {
          const cond = CONDITIONS[(nodeIdx + o) % CONDITIONS.length]!;
          lines.push(`\t条件: ${cond}`);
        }

        // ~40% have effects
        if ((nodeIdx + o * 11) % 10 < 4) {
          const effCount = 1 + ((nodeIdx + o) % 2);
          const effs = [];
          for (let e = 0; e < effCount; e++) {
            effs.push(EFFECTS[(nodeIdx + o * 3 + e * 7) % EFFECTS.length]!);
          }
          if (effs.length === 1) {
            lines.push(`\t效果: ${effs[0]}`);
          } else {
            lines.push(`\t效果: (${effs.join(', ')})`);
          }
        }
      }

      lines.push('');
    }
  }

  return lines.join('\n');
}

const output = generate();
const outPath = resolve(__dirname, '200-nodes.mds');
writeFileSync(outPath, output, 'utf-8');

const nodeCount = (output.match(/^##[ \t]+节点[：:]/gm) ?? []).length;
const optionCount = (output.match(/^[ \t]*\[选项\]/gm) ?? []).length;
const condCount = (output.match(/^[ \t]+条件:/gm) ?? []).length;
const effectCount = (output.match(/^[ \t]+效果:/gm) ?? []).length;

console.log(`Generated: ${outPath}`);
console.log(`  Size: ${(Buffer.byteLength(output, 'utf-8') / 1024).toFixed(1)} KB`);
console.log(`  Chapters: ${CHAPTER_COUNT}`);
console.log(`  Nodes: ${nodeCount}`);
console.log(`  Options: ${optionCount}`);
console.log(`  Conditions: ${condCount}`);
console.log(`  Effects: ${effectCount}`);
