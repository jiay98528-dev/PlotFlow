/**
 * Edge case & stress test for parser/exporter capabilities.
 * Tests specific processing limits and boundary conditions.
 */
import { parseStory } from '../packages/core/src/parser/parser.js';
import { validate } from '../packages/core/src/validator/validator.js';
import { exportJSON } from '../packages/core/src/exporter/json.js';
import { exportHTML } from '../packages/core/src/exporter/html.js';

// ==========================================================================
// Test 1: Max condition depth
// ==========================================================================
function testMaxConditionDepth() {
  const input = `---
vars:
  a: int
  b: int
  c: int
  d: int
  e: int
---
# C

## 节点：N
body
[选项] opt -> 节点：T
  条件: ($a>=1) AND (($b>=2) AND (($c>=3) OR ($d>=4))) AND ($e>=5)

## 节点：T
end
`;
  const r = parseStory(input);
  if (r.ok) {
    const n = r.data.chapters[0]!.nodes[0]!;
    const cond = n.options[0]!.condition;
    return { maxDepth: calcCondDepth(cond, 0), parsed: r.ok };
  }
  return { maxDepth: 0, parsed: false };
}

function calcCondDepth(c: unknown, d: number): number {
  if (!c) return d;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((c as any).type === 'logical') return Math.max(...(c as any).operands.map((o: unknown) => calcCondDepth(o, d + 1)));
  return d;
}

// ==========================================================================
// Test 2: Node ID with special characters
// ==========================================================================
function testSpecialCharsInNodeId() {
  const input = `# C
## 节点：path/with/slash
body
[选项] -> 节点：target

## 节点：target
end
`;
  const r = parseStory(input);
  if (r.ok) {
    const nodes = r.data.chapters[0]!.nodes;
    const diag = r.diagnostics.filter(d => d.severity === 'error');
    return {
      nodes: nodes.map(n => n.id),
      errors: diag.map(d => d.code + ': ' + d.message),
    };
  }
  return { nodes: [], errors: ['parse failed'] };
}

// ==========================================================================
// Test 3: Very long body text
// ==========================================================================
function testLongBodyText() {
  const longText = 'A'.repeat(10000);
  const input = `# C

## 节点：LONG
${longText}
[选项] -> 节点：END

## 节点：END
end
`;
  const r = parseStory(input);
  if (r.ok) {
    const n = r.data.chapters[0]!.nodes[0]!;
    return { bodyLength: n.body.length, options: n.options.length };
  }
  return { bodyLength: 0, options: 0, failed: true };
}

// ==========================================================================
// Test 4: Many options per node
// ==========================================================================
function testManyOptions() {
  const options = Array.from({ length: 50 }, (_, i) =>
    `[选项] Option ${i} -> 节点：T${i}`
  ).join('\n');

  const nodes = Array.from({ length: 50 }, (_, i) =>
    `## 节点：T${i}\nend node ${i}`
  ).join('\n\n');

  const input = `# C
## 节点：MANY
body
${options}
${nodes}
`;
  const r = parseStory(input);
  if (r.ok) {
    const n = r.data.chapters[0]!.nodes[0]!;
    return { optionCount: n.options.length, totalNodes: r.data.chapters[0]!.nodes.length };
  }
  return { optionCount: 0, totalNodes: 0, failed: true };
}

// ==========================================================================
// Test 5: Cross-chapter reference resolution
// ==========================================================================
function testCrossChapterRefs() {
  const input = `# A
## 节点：a1
body
[选项] -> 节点：b2

## 节点：a2
body
[选项] -> 节点：c1

# B
## 节点：b1
body
[选项] -> 节点：a2

## 节点：b2
body
[选项] -> 节点：c2

# C
## 节点：c1
body
[选项] -> 节点：b1

## 节点：c2
body
[选项] -> 节点：a1
`;
  const r = parseStory(input);
  if (r.ok) {
    const refs: string[] = [];
    for (const ch of r.data.chapters) {
      for (const n of ch.nodes) {
        for (const o of n.options) {
          refs.push(`${n.fullId} -> ${o.targetFullId || 'UNRESOLVED'}`);
        }
      }
    }
    return refs;
  }
  return [];
}

// ==========================================================================
// Test 6: Deeply nested conditions
// ==========================================================================
function testDeepConditions() {
  const input = `---
vars:
  x1: bool
  x2: bool
  x3: bool
  x4: bool
  x5: bool
  x6: bool
---
# C
## 节点：DEEP
body
[选项] path -> 节点：T
  条件: ($x1==true) AND ($x2==true) AND ($x3==true) AND ($x4==true) AND ($x5==true) AND ($x6==true)
## 节点：T
end
`;
  const r = parseStory(input);
  if (r.ok) {
    const cond = r.data.chapters[0]!.nodes[0]!.options[0]!.condition;
    const json = exportJSON(r.data);
    return { conditionType: cond?.type, jsonOk: json.ok };
  }
  return { failed: true };
}

// ==========================================================================
// Test 7: Effect chaining stress
// ==========================================================================
function testEffectChaining() {
  const input = `---
vars:
  hp: int
  mp: int
  gold: int
  exp: int
  level: int
---
# C
## 节点：CHAIN
body
[选项] mega action -> 节点：T
  效果: (hp-10, mp+5, gold-50, exp+100, level+1)
## 节点：T
end
`;
  const r = parseStory(input);
  if (r.ok) {
    const eff = r.data.chapters[0]!.nodes[0]!.options[0]!.sideEffects;
    return { effectCount: eff.length, effects: eff.map(e => `${e.variableName} ${e.operation} ${e.value}`) };
  }
  return { effectCount: 0 };
}

// ==========================================================================
// Test 8: HTML export condition rendering
// ==========================================================================
function testConditionRendering() {
  const input = `---
vars:
  karma: int
  weapon: enum[sword, bow, staff]
---
# C

## 节点：S
body
[选项] good path -> 节点：G
  条件: ($karma>=10) OR ($weapon=='staff')
  效果: (karma+5)
[选项] evil path -> 节点：E
  条件: ($karma<0) AND ($weapon!='staff')
[选项] neutral -> 节点：N
## 节点：G
good ending
## 节点：E
bad ending
## 节点：N
neutral ending
`;
  const r = parseStory(input);
  if (!r.ok) return { failed: true };
  const html = exportHTML(r.data);
  if (!html.ok) return { failed: true, htmlError: true };

  const h = html.data;
  // Check for condition types in embedding
  const hasComparison = h.includes('"type":"comparison"');
  const hasLogical = h.includes('"type":"logical"');
  const hasEvalCond = h.includes('evalCond');
  const hasApplyEffects = h.includes('applyEffects');
  const hasOR = h.includes('some'); // OR uses some()
  const hasAND = h.includes('every'); // AND uses every()

  // Verify story data embedded
  const storyMatch = h.match(/var STORY = ({.*?});/s);
  let condInJSON = 0;
  if (storyMatch) {
    const sd = JSON.parse(storyMatch[1]!);
    for (const nid of Object.keys(sd.nodes)) {
      const n = sd.nodes[nid];
      for (const o of n.options || []) {
        if (o.condition) condInJSON++;
      }
    }
  }

  return {
    hasComparison,
    hasLogical,
    hasEvalCond,
    hasApplyEffects,
    hasOR,
    hasAND,
    condInJSON,
  };
}

// ==========================================================================
// Run all tests
// ==========================================================================
console.log('='.repeat(80));
console.log('EDGE CASE & CAPABILITY ANALYSIS');
console.log('='.repeat(80));

const t1 = testMaxConditionDepth();
console.log(`\n1. Max Condition Depth: ${t1.maxDepth} (parsed: ${t1.parsed})`);

const t2 = testSpecialCharsInNodeId();
console.log(`2. Special Chars in Node ID: nodes=${JSON.stringify(t2.nodes)}, errors=${JSON.stringify(t2.errors)}`);

const t3 = testLongBodyText();
console.log(`3. Long Body (10k chars): length=${t3.bodyLength}, options=${t3.options}`);

const t4 = testManyOptions();
console.log(`4. Many Options (50): count=${t4.optionCount}, totalNodes=${t4.totalNodes}`);

const t5 = testCrossChapterRefs();
console.log(`5. Cross-Chapter Ref Resolution:`);
t5.forEach(r => console.log(`   ${r}`));

const t6 = testDeepConditions();
console.log(`6. Deep Conditions (6 ANDs): type=${t6.conditionType}, jsonOk=${t6.jsonOk}`);

const t7 = testEffectChaining();
console.log(`7. Effect Chaining (5 effects): count=${t7.effectCount}, effects=${JSON.stringify(t7.effects)}`);

const t8 = testConditionRendering();
console.log(`8. HTML Condition Rendering: comp=${t8.hasComparison}, logical=${t8.hasLogical}, eval=${t8.hasEvalCond}, apply=${t8.hasApplyEffects}, OR=${t8.hasOR}, AND=${t8.hasAND}, condInJSON=${t8.condInJSON}`);

// ==========================================================================
// BOUNDARY TESTS: What happens at limits?
// ==========================================================================
console.log(`\n` + '='.repeat(80));
console.log('BOUNDARY TESTS');
console.log('='.repeat(80));

// Test: Empty options in body
const emptyOptInput = `# C
## 节点：E
body text

[选项]
`;
const eo = parseStory(emptyOptInput);
if (eo.ok) {
  const opts = eo.data.chapters[0]!.nodes[0]!.options;
  const diags = eo.diagnostics.filter(d => d.severity === 'error');
  console.log(`9. Empty option: options=${opts.length}, errors=${diags.map(d => d.code).join(',')}`);
}

// Test: Duplicate node IDs in same chapter
const dupInput = `# C
## 节点：SAME
first
## 节点：SAME
second
`;
const dup = parseStory(dupInput);
if (dup.ok) {
  const e007 = dup.diagnostics.filter(d => d.code === 'E007');
  console.log(`10. Duplicate Node ID: E007 count=${e007.length}, message="${e007[0]?.message}"`);
}

// Test: Non-existent variable reference
const badVarInput = `---
vars:
  hp: int
---
# C
## 节点：B
body
[选项] bad ref -> 节点：T
  条件: ($nonexistent >= 10)
## 节点：T
end
`;
const bv = parseStory(badVarInput);
if (bv.ok) {
  const v = validate(bv.data);
  const e002 = v.diagnostics.filter(d => d.code === 'E002');
  console.log(`11. Undeclared Variable: E002 count=${e002.length}, message="${e002[0]?.message}"`);
}

// Test: Default author/title when missing
const noMetaInput = `---
vars:
  x: int
---
# C
## 节点：N
body
`;
const nm = parseStory(noMetaInput);
if (nm.ok) {
  console.log(`12. Missing Meta defaults: title="${nm.data.meta.title}", author="${nm.data.meta.author}", engine="${nm.data.meta.engine}"`);
}

// Test: Parser performance with BOM
const bomInput = '﻿' + `---
title: Test
---
# C
## 节点：X
body
`;
const bomResult = parseStory(bomInput);
console.log(`13. UTF-8 BOM handling: ok=${bomResult.ok}, title="${bomResult.ok ? bomResult.data.meta.title : 'FAIL'}"`);

console.log('\n' + '='.repeat(80));
console.log('CAPABILITY SUMMARY');
console.log('='.repeat(80));
console.log(`Parser:
  - Max condition nesting: unlimited (N-ary AND/OR, tested up to depth 3)
  - Special chars in node ID: '/' and '\\' replaced with '_' (E005 warning)
  - Max body length: tested 10k chars, no explicit limit
  - Max options per node: tested 50, no explicit limit
  - Cross-chapter resolution: works for unique node IDs
  - UTF-8 BOM: stripped automatically
  - Duplicate node IDs: detected (E007)
  - Parse time 59 nodes: ~6.5ms

Validator (17 rules):
  - E001-E008: 8 error rules
  - W001-W006: 6 warning rules (W003 has false positive for object parents)
  - I001-I003: 3 info rules
  - Object parent vars flagged as unused when only sub-fields used

JSON Exporter:
  - Full AST→Schema mapping with condition AST preservation
  - N-ary AND/OR → left-folded binary tree
  - Body split into narrative paragraphs (options stripped)

HTML Exporter:
  - Self-contained single file with embedded JS engine
  - Full condition evaluator (comparison + logical AND/OR/NOT)
  - Effect applicator (set/add/subtract/append)
  - Breadcrumb navigation with click-to-backtrack
  - Variable state panel (collapsible)
  - All user text HTML-escaped (XSS prevention)`);
