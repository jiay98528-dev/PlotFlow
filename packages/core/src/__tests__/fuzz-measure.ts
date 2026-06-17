/**
 * Fuzz measurement script — runs the parser against many inputs and reports stats.
 * Usage: npx tsx this-script.ts
 */
import { parseStory } from '../parser/parser.js';
import { parseFrontmatter } from '../parser/frontmatter.js';
import { parseOptions } from '../parser/options.js';
import { parseCondition } from '../parser/conditions.js';
import { parseEffects } from '../parser/effects.js';

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
// Timing helper
// ============================================================================
function timeParse(raw: string): { ok: boolean; ms: number } {
  const start = performance.now();
  const result = parseStory(raw);
  const ms = performance.now() - start;
  return { ok: result.ok, ms };
}

function timeFn<T>(fn: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = fn();
  return { value, ms: performance.now() - start };
}

// ============================================================================
// Case generators
// ============================================================================
interface CaseResult {
  name: string;
  ok: boolean;
  ms: number;
  crashed: boolean;
  nullReturn: boolean;
}

const results: CaseResult[] = [];
const issues: string[] = [];

function addCase(name: string, raw: string): void {
  try {
    const { ok, ms } = timeParse(raw);
    results.push({ name, ok, ms, crashed: false, nullReturn: false });
    if (ms > 100) {
      issues.push(`SLOW: "${name}" took ${ms.toFixed(1)}ms (threshold: 100ms)`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    issues.push(`CRASH: "${name}" threw: ${msg}`);
    results.push({ name, ok: false, ms: 0, crashed: true, nullReturn: false });
  }
}

function addFnCase(name: string, fn: () => unknown): void {
  try {
    const { ms } = timeFn(fn);
    results.push({ name, ok: true, ms, crashed: false, nullReturn: false });
    if (ms > 100) {
      issues.push(`SLOW(sub): "${name}" took ${ms.toFixed(1)}ms`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    issues.push(`CRASH(sub): "${name}" threw: ${msg}`);
    results.push({ name, ok: false, ms: 0, crashed: true, nullReturn: false });
  }
}

// Check if a parse result returned null/undefined data when OK
function checkNull(name: string, raw: string): void {
  try {
    const result = parseStory(raw);
    if (result.ok && result.data === null) {
      issues.push(`UNEXPECTED_NULL: "${name}" returned ok but data is null`);
    }
    if (result.ok && result.data === undefined) {
      issues.push(`UNEXPECTED_NULL: "${name}" returned ok but data is undefined`);
    }
  } catch { /* crash already counted */ }
}

// ============================================================================
// Build all test cases
// ============================================================================

// --- Category 1: Empty / Near-empty ---
addCase('empty string', '');
addCase('single newline', '\n');
addCase('multiple newlines', '\n\n\n\n\n');
addCase('only whitespace', '   \t  \n  \t \n  ');
addCase('only BOM', '﻿');
addCase('BOM + content', '﻿# 章\n\n## 节点：A\n\n正文\n');

// --- Category 2: Random Valid Syntax Combos (20 seeds) ---
for (let seed = 0; seed < 20; seed++) {
  const rng = mulberry32(seed);
  const parts: string[] = [];
  if (rng() > 0.3) {
    parts.push('---');
    parts.push('title: "Fuzz Story ' + seed + '"');
    parts.push('author: Fuzzer');
    parts.push('plotflow: "0.1"');
    parts.push('vars:');
    const varCount = Math.floor(rng() * 5) + 1;
    const varNames = ['hp', 'mp', 'gold', 'reputation', 'hasKey', 'magicLevel', 'friendship'];
    for (let v = 0; v < varCount; v++) {
      const vName = varNames[v % varNames.length] + (v > 0 ? v : '');
      const vType = ['int', 'float', 'bool', 'string'][Math.floor(rng() * 4)];
      parts.push('  ' + vName + ': ' + vType);
    }
    parts.push('---');
    parts.push('');
  }
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
      const optCount = Math.floor(rng() * 3) + 1;
      for (let o = 0; o < optCount; o++) {
        const targetChapterIdx = Math.floor(rng() * chapterCount);
        const targetNodeIdx = Math.floor(rng() * 4);
        const targetNodeTitle = '节点' + targetChapterIdx + '_' + targetNodeIdx + '_' + ['森林', '城堡', '洞穴', '村庄', '山顶'][targetNodeIdx % 5];
        parts.push('[选项] 选项' + n + '_' + o + ' -> 节点：' + targetNodeTitle);
        if (rng() > 0.7) parts.push('  条件: gold > 10');
        if (rng() > 0.6) parts.push('  效果: (gold - 10)');
      }
      parts.push('');
      if (rng() > 0.8) { parts.push('---'); parts.push(''); }
    }
  }
  addCase('random-valid-seed-' + seed, parts.join('\n'));
}

// --- Category 3: Unclosed Brackets ---
addCase('unclosed-ftm', '---\ntitle: test\nvars:\n  hp: int\n---  missing end');
addCase('unclosed-object', '---\nvars:\n  player: object{\n    name: string\n---\n# 章\n\n## 节点：A\n\n正文\n');
addCase('unclosed-enum', '---\nvars:\n  class: enum[战士, 法师\n---\n# 章\n\n## 节点：A\n\n正文\n');
addCase('unclosed-effect-parens', '# 章\n\n## 节点：A\n\n正文\n[选项] 继续 -> 节点：B\n  效果: (hp - 10\n');
addCase('nested-unclosed', '---\nvars:\n  data: object{\n    inner: object{\n      deep: enum[a, b\n---\n# X\n\n## 节点：N\n\n正文\n[[[unclosed brackets]]]\n');

// --- Category 4: Invalid YAML ---
addCase('yaml-tab', '---\ntitle:\t\tmixed tabs\nvars:\n  hp: int\n---\n');
addCase('yaml-bare-colon', '---\n:\nvars:\n  hp: int\n---\n');
addCase('yaml-nan', '---\ntitle: .nan\nvars:\n  hp: int\n---\n');
addCase('yaml-inf', '---\ntitle: .inf\nvars:\n  hp: int\n---\n');
addCase('yaml-anchors', '---\na: &anchor\n  b: *anchor\nvars:\n  hp: int\n---\n');
addCase('yaml-mixed-array', '---\ntitle: [1, "two", true, null]\nvars:\n  hp: int\n---\n# 章\n\n## 节点：A\n\n正文\n');

// --- Category 5: Binary Data Sim ---
addCase('null-bytes', '---\ntitle: test\0broken\n---\n# 章\n\n## 节点：A\n\n正文\0more\0chars\n');
// random binary bytes
{ const rng = mulberry32(999);
  let raw = ''; for (let i = 0; i < 200; i++) raw += String.fromCodePoint(Math.floor(rng() * 256));
  addCase('random-binary-bytes', raw);
}
addCase('high-surrogates', '# 章\n\n## 节点：\uD800\uD800test\n\n正文\n');
addCase('lone-low-surrogate', '# 章\n\n## 节点：\uDC00 solo\n\n正文\n');

// --- Category 6: Oversized ---
addCase('10k-node-name', '# 章\n\n## 节点：' + 'A'.repeat(10_000) + '\n\n正文\n');
addCase('50k-node-name', '# 章\n\n## 节点：' + 'B'.repeat(50_000) + '\n\n正文\n');
addCase('10k-chapter-title', '# ' + 'C'.repeat(10_000) + '\n\n## 节点：A\n\n正文\n');
addCase('10k-option-desc', '# 章\n\n## 节点：A\n\n正文\n[选项] ' + 'D'.repeat(10_000) + ' -> 节点：B\n');
addCase('10k-body', '# 章\n\n## 节点：A\n\n' + 'E'.repeat(10_000) + '\n');

// --- Category 7: CJK + Emoji + RTL ---
addCase('cjk-emoji-node', '# 序幕：千年之约 📜\n\n## 节点：🗡️ 龍が如く・鳳凰涅槃\n\n遠古の予言。\n「難道……這就是命運嗎？」\n[选项] 🔥 接受試煉 -> 节点：试炼神殿\n[选项] 😱 退缩 -> 节点：村庄出口\n');
addCase('rtl-arabic', '# 章\n\n## 节点：RTL测试\n\nهذا نص عربي للاختبار.\nمرحبا بالعالم!\n');
addCase('mixed-cjk-emoji-rtl', '# テスト・اختبار・🧪\n\n## 节点：مرحبا・你好・👋\n\nمتعدد اللغات テスト 🎉 متن.\n');
addCase('emoji-options', '# 章\n\n## 节点：Emoji测试\n\n正文。\n[选项] 🗡️ 攻击！ ⚔️ -> 节点：战斗\n[选项] 🛡️ 防御 💪 -> 节点：防御\n[选项] 🏃‍♂️ 逃跑 → 💨 -> 节点：撤退\n');
addCase('zalgo-text', '# 章\n\n## 节点：Zalgo\n\nT̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩̖̮̦̲̭̫̜̳̲̺͔e̷̢̛̫͎̭̞̲̮̟̺̹̖͙̘̩s̷̢̛̫͎̭̞̲̮̟̺̹̖t\n');
addCase('zero-width', '# 章\n\n## 节点：​hidden‌zero‍width\n\n正文\n');

// --- Category 8: Deeply Nested Conditions ---
addCase('10-and', '# 章\n\n## 节点：A\n\n正文\n[选项] t -> 节点：B\n  条件: ' + Array(10).fill('hp > 0').join(' AND ') + '\n');
addCase('nested-parens', '# 章\n\n## 节点：A\n\n正文\n[选项] t -> 节点：B\n  条件: hp > 0 AND (mp > 10 OR (level >= 5 AND gold > 100))\n');
{
  let cond = 'hp > 0';
  for (let i = 0; i < 9; i++) cond = '(' + cond + ') AND hp > ' + i;
  addCase('deeply-nested-10', '# 章\n\n## 节点：A\n\n正文\n[选项] t -> 节点：B\n  条件: ' + cond + '\n');
}
addCase('multi-not', '# 章\n\n## 节点：A\n\n正文\n[选项] t -> 节点：B\n  条件: NOT NOT NOT NOT hp <= 0\n');
addCase('100-and', '# 章\n\n## 节点：A\n\n正文\n[选项] t -> 节点：B\n  条件: ' + Array(100).fill('x == 1').join(' AND ') + '\n');

// --- Category 9: Duplicate IDs ---
addCase('dup-node-ids', '# 章\n\n## 节点：A\n\n正文1\n\n## 节点：A\n\n正文2\n\n## 节点：A\n\n正文3\n');
addCase('dup-vars', '---\nvars:\n  hp: int\n  hp: int\n  mp: float\n  mp: float\n---\n# 章\n\n## 节点：A\n\n正文\n');
addCase('dup-chapters', '# 第一章\n\n## 节点：起始\n\n正文1\n\n# 第一章\n\n## 节点：起始\n\n正文2\n');
addCase('dup-options', '# 章\n\n## 节点：A\n\n正文\n[选项] 继续 -> 节点：B\n[选项] 继续 -> 节点：B\n[选项] 继续 -> 节点：C\n[选项] 继续 -> 节点：C\n');

// --- Category 10: Circular Refs ---
addCase('cycle-A-B', '# 章\n\n## 节点：A\n\n正文A\n[选项] 去B -> 节点：B\n\n## 节点：B\n\n正文B\n[选项] 回A -> 节点：A\n');
addCase('cycle-A-B-C', '# 章\n\n## 节点：A\n\n正文A\n[选项] 去B -> 节点：B\n\n## 节点：B\n\n正文B\n[选项] 去C -> 节点：C\n\n## 节点：C\n\n正文C\n[选项] 回A -> 节点：A\n');
addCase('self-loop', '# 章\n\n## 节点：A\n\n正文A\n[选项] 再来 -> 节点：A\n');
addCase('cross-chapter-cycle', '# 第一章\n\n## 节点：入口\n\n正文\n[选项] 进入 -> 节点：大厅\n\n# 第二章\n\n## 节点：大厅\n\n正文\n[选项] 返回 -> 节点：入口\n');
{
  const parts: string[] = ['# 环', ''];
  for (let i = 0; i < 50; i++) {
    const next = i < 49 ? i + 1 : 0;
    parts.push('## 节点：N' + i); parts.push(''); parts.push('节点' + i); parts.push('[选项] 前往 -> 节点：N' + next); parts.push('');
  }
  addCase('50-chain-cycle', parts.join('\n'));
}
addCase('diamond-cycle', '# 章\n\n## 节点：开始\n\n正文\n[选项] 左 -> 节点：左\n[选项] 右 -> 节点：右\n\n## 节点：左\n\n正文\n[选项] 合 -> 节点：汇合\n\n## 节点：右\n\n正文\n[选项] 合 -> 节点：汇合\n\n## 节点：汇合\n\n正文\n[选项] 回开始 -> 节点：开始\n');

// --- Category 11: Deeply Nested Objects ---
addCase('max-depth-obj', '---\nvars:\n  player: object{\n    stats: object{\n      combat: object{\n        attack: int\n        defense: int\n      }\n    }\n  }\n---\n# 章\n\n## 节点：A\n\n正文\n');
addCase('exceed-depth-obj', '---\nvars:\n  player: object{\n    stats: object{\n      combat: object{\n        physical: object{\n          attack: int\n        }\n      }\n    }\n  }\n---\n# 章\n\n## 节点：A\n\n正文\n');

// --- Category 12: Effects ---
addCase('20-effects', '# 章\n\n## 节点：A\n\n正文\n[选项] buff -> 节点：B\n  效果: (' + Array(20).fill('hp + 1').join(', ') + ')\n');
addCase('append-effects', '# 章\n\n## 节点：A\n\n正文\n[选项] add -> 节点：B\n  效果: (inventory ← \'Sword of Destiny\', hp + 50, gold - 100)\n');

// --- Category 13: Large Frontmatter ---
{
  const parts: string[] = ['---', 'title: "Large Test"', 'vars:'];
  for (let i = 0; i < 200; i++) {
    parts.push('  var' + i + ': ' + ['int','float','bool','string'][i % 4]);
  }
  parts.push('---', '', '# 章', '', '## 节点：A', '', '正文');
  addCase('200-vars', parts.join('\n'));
}

// --- Category 14: Tab/Space ---
addCase('tab-option', '# 章\n\n## 节点：A\n\n正文\n\t[选项] tabbed -> 节点：B\n');
addCase('tab-space-mix-vars', '---\nvars:\n  hp: int\n\tmp: float\n  gold: int\n---\n# 章\n\n## 节点：A\n\n正文\n');

// --- Category 15: Large Docs ---
{
  const parts: string[] = ['# 大型测试', ''];
  for (let i = 0; i < 200; i++) {
    parts.push('## 节点：N' + i); parts.push(''); parts.push('正文内容' + i); parts.push('第二行。'); parts.push('[选项] 前进 -> 节点：N' + ((i+1)%200)); parts.push('');
  }
  addCase('200-nodes', parts.join('\n'));
}

// --- Category 16: Sub-parsers ---
addFnCase('ftm-garbage-1', () => parseFrontmatter('---\n{{{}}}\n---\n'));
addFnCase('ftm-garbage-2', () => parseFrontmatter('---\ntitle: [1, [2, [3]]]\n---\n'));
addFnCase('ftm-garbage-3', () => parseFrontmatter('---\n\x00\x01\x02\n---\n'));
addFnCase('opt-garbage-1', () => parseOptions('[选项] ', 1, []));
addFnCase('opt-garbage-2', () => parseOptions('[选项] a -> ', 1, []));
addFnCase('opt-garbage-3', () => parseOptions('[选项] a -> 节点：', 1, []));
addFnCase('opt-garbage-4', () => parseOptions('\t\t\t[选项] deep indent -> 节点：X', 1, []));
for (const input of ['', '   ', 'hp >', '> 10', 'hp == == 10', 'hp > 10 AND', 'AND hp > 10', '((hp > 10)', '(hp > 10))', 'hp > 10 AND OR mp < 5', 'NOT', 'NOT hp', 'x > 1 AND NOT NOT NOT NOT y < 2', 'a > 0 AND b > 0 AND c > 0 AND d > 0 AND e > 0 AND f > 0 AND g > 0 AND h > 0 AND i > 0 AND j > 0']) {
  addFnCase('cond-garbage:' + input.substring(0, 20), () => parseCondition(input, [], 1));
}
for (const input of ['', '   ', 'hp', 'hp =', '= 10', 'hp = = 10', 'hp ←', 'hp ← a, hp ← b', 'a + 1, b+2, c+3, d + 4']) {
  addFnCase('eff-garbage:' + input.substring(0, 20), () => parseEffects(input, [], 1));
}

// --- Category 17: Injections ---
addCase('sql-inject', '# 章\n\n## 节点：A\n\n正文; DROP TABLE nodes; --\n[选项] \' OR 1=1; -- -> 节点：B\n');
addCase('html-inject', '# 章\n\n## 节点：A\n\n<script>alert(\'xss\')</script>\n<img src=x onerror=alert(1)>\n[选项] <iframe> -> 节点：B\n');
addCase('js-inject', '# 章\n\n## 节点：${7*7}\n\n正文${constructor}\n[选项] ${process.exit()} -> 节点：B\n');

// --- Category 18: Unicode ---
addCase('rlo-pdf', '# 章\n\n## 节点：‮backwards‬\n\n正文\n');
addCase('variation-selectors', '# 章\n\n## 节点：test️more\n\n正文\n');
addCase('skin-tones', '# 章\n\n## 节点：👋🏻👋🏼👋🏽👋🏾👋🏿\n\n正文\n');
addCase('flags-zwj', '# 章\n\n## 节点：🏳️‍🌈👨‍👩‍👧‍👦🇨🇳\n\n正文\n');

// --- Category 19: Malformed Syntax ---
addCase('triple-hash', '# 章\n\n## 节点：A\n\n正文\n\n### 节点：sub\n\n正文2\n');
addCase('bare-h2', '# 章\n\n## Not a node\n\nJust markdown.\n\n## 节点：ActuallyANode\n\n正文\n');
addCase('chinese-colon-mix', '# 章\n\n## 节点：Test节点\n## 节点:Another节点\n\n正文混合\n');
addCase('sep-ambiguous', '# 章\n\n## 节点：A\n\n正文A\n\n---\n\n这里不是新节点。\n\n---\n\n## 节点：B\n\n正文B\n');

// --- Stress: 100 rapid parses ---
for (let i = 0; i < 100; i++) {
  addCase('stress-' + i, '# 第' + i + '章\n\n## 节点：节点' + i + '\n\n正文' + i + '\n[选项] 前往' + ((i+1)%100) + ' -> 节点：节点' + ((i+1)%100) + '\n');
}

// ============================================================================
// Run null checks
// ============================================================================
checkNull('empty string', '');
checkNull('random-valid-seed-0', '---\ntitle: "Fuzz Story 0"\nauthor: Fuzzer\nplotflow: "0.1"\nvars:\n  hp: int\n---\n\n# 序幕\n\n## 节点：0_0_森林\n\n正文。\n[选项] test -> 节点：0_1_城堡\n');

// ============================================================================
// Compute stats
// ============================================================================
const totalCases = results.length;
const crashes = results.filter(r => r.crashed).length;
const timeoutCases = results.filter(r => r.ms > 1000).length;
const unexpectedNulls = issues.filter(i => i.startsWith('UNEXPECTED_NULL')).length;
const maxParseTimeMs = Math.max(...results.map(r => r.ms));

// Log the 5 slowest
const sorted = [...results].sort((a, b) => b.ms - a.ms);
console.log('=== Top 10 Slowest Cases ===');
for (const r of sorted.slice(0, 10)) {
  console.log(`  ${r.ms.toFixed(1)}ms - ${r.name} ${r.crashed ? '[CRASHED]' : ''}`);
}

console.log('\n=== Issues ===');
for (const issue of issues) {
  console.log('  ' + issue);
}

console.log('\n=== Summary ===');
console.log(JSON.stringify({
  totalCases,
  crashes,
  timeoutCases,
  unexpectedNulls,
  maxParseTimeMs: Math.round(maxParseTimeMs * 100) / 100,
  issues,
}, null, 2));
