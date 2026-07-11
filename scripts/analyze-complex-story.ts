/**
 * Complex 30-node story analysis script.
 * Parses, validates, and exports the complex test story to analyze
 * parser/exporter processing capabilities.
 */
import { parseStory } from '../packages/core/src/parser/parser.js';
import { validate } from '../packages/core/src/validator/validator.js';
import { exportJSON } from '../packages/core/src/exporter/json.js';
import { exportHTML } from '../packages/core/src/exporter/html.js';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const fixturePath = resolve(
  'D:\\VibeCoding\\PlotFlow\\packages\\app\\e2e\\fixtures\\complex-30-node.mdstory'
);

const raw = readFileSync(fixturePath, 'utf-8');

console.log('='.repeat(80));
console.log('PHASE 1: PARSE');
console.log('='.repeat(80));

const t0 = performance.now();
const result = parseStory(raw);
const t1 = performance.now();

console.log(`Parse success: ${result.ok}`);
console.log(`Parse time: ${(t1 - t0).toFixed(2)}ms`);
console.log(`Input size: ${raw.length} chars, ${raw.split(/\n/).length} lines`);

if (!result.ok) {
  console.error('PARSE FAILED');
  process.exit(1);
}

const data = result.data;

// Basic stats
const totalNodes = data.chapters.reduce((sum, c) => sum + c.nodes.length, 0);
const totalOptions = data.chapters.reduce(
  (sum, c) => sum + c.nodes.reduce((s, n) => s + n.options.length, 0),
  0
);
const totalEffects = data.chapters.reduce(
  (sum, c) =>
    sum +
    c.nodes.reduce(
      (s, n) => s + n.options.reduce((so, o) => so + o.sideEffects.length, 0),
      0
    ),
  0
);
const totalConditions = data.chapters.reduce(
  (sum, c) =>
    sum + c.nodes.reduce((s, n) => s + n.options.filter((o) => o.condition !== null).length, 0),
  0
);

console.log(`\nParsed AST Summary:`);
console.log(`  Title: ${data.meta.title}`);
console.log(`  Author: ${data.meta.author}`);
console.log(`  Engine: ${data.meta.engine}`);
console.log(`  Variables: ${data.variables.length}`);
console.log(`  Chapters: ${data.chapters.length}`);
console.log(`  Total Nodes: ${totalNodes}`);
console.log(`  Total Options: ${totalOptions}`);
console.log(`  Total Conditions: ${totalConditions}`);
console.log(`  Total Effects: ${totalEffects}`);

// Variable details
console.log(`\nVariables:`);
for (const v of data.variables) {
  const extra = v.type === 'enum' ? ` [${v.enumValues?.join(',')}]` : '';
  const objFields = v.type === 'object' && v.fields ? ` {${v.fields.map(f => f.name).join(',')}}` : '';
  console.log(`  $${v.name}: ${v.type}${extra}${objFields} = ${JSON.stringify(v.defaultValue)}`);
}

// Chapter breakdown
console.log(`\nChapter breakdown:`);
for (const ch of data.chapters) {
  const conditionCount = ch.nodes.reduce(
    (s, n) => s + n.options.filter((o) => o.condition !== null).length,
    0
  );
  const effectCount = ch.nodes.reduce(
    (s, n) => s + n.options.reduce((so, o) => so + o.sideEffects.length, 0),
    0
  );
  console.log(`  [${ch.id}] ${ch.nodes.length} nodes, ${conditionCount} conditions, ${effectCount} effects`);
  for (const node of ch.nodes) {
    const optInfo = node.options.map((o) => {
      const parts = [`→${o.targetNodeId || '?'}`];
      if (o.condition) parts.push('[COND]');
      if (o.sideEffects.length > 0) parts.push(`[${o.sideEffects.length}EFF]`);
      return parts.join('');
    }).join(', ');
    const status = [];
    if (node.diagnostics.isRoot) status.push('ROOT');
    if (node.diagnostics.isOrphan) status.push('ORPHAN');
    if (node.diagnostics.isDeadEnd) status.push('DEADEND');
    const statusStr = status.length > 0 ? ` [${status.join(',')}]` : '';
    console.log(`    ${node.fullId}${statusStr}: ${node.options.length} options -> ${optInfo || '(none)'}`);
  }
}

// Diagnose check
console.log(`\nParser-stage diagnostics: ${result.diagnostics.length}`);
const parseErrors = result.diagnostics.filter(d => d.severity === 'error');
const parseWarnings = result.diagnostics.filter(d => d.severity === 'warning');
const parseInfos = result.diagnostics.filter(d => d.severity === 'info');
console.log(`  Errors: ${parseErrors.length}`);
console.log(`  Warnings: ${parseWarnings.length}`);
console.log(`  Infos: ${parseInfos.length}`);

for (const d of parseErrors) {
  console.log(`  [ERROR] ${d.code}: ${d.message} (line ${d.range.startLine})`);
}
for (const d of parseWarnings) {
  console.log(`  [WARN] ${d.code}: ${d.message} (line ${d.range.startLine})`);
}

console.log('');
console.log('='.repeat(80));
console.log('PHASE 2: VALIDATE');
console.log('='.repeat(80));

const vResult = validate(data);
console.log(`Validation Summary: ${vResult.summary.errors}E / ${vResult.summary.warnings}W / ${vResult.summary.infos}I (total: ${vResult.summary.total})`);

const errors = vResult.diagnostics.filter(d => d.severity === 'error');
const warnings = vResult.diagnostics.filter(d => d.severity === 'warning');
const infos = vResult.diagnostics.filter(d => d.severity === 'info');

console.log(`\nERRORS (${errors.length}):`);
for (const d of errors) {
  console.log(`  ${d.code} [L${d.range.startLine}]: ${d.message}${d.relatedNodeId ? ` (node: ${d.relatedNodeId})` : ''}`);
}

console.log(`\nWARNINGS (${warnings.length}):`);
for (const d of warnings) {
  console.log(`  ${d.code} [L${d.range.startLine}]: ${d.message}${d.relatedNodeId ? ` (node: ${d.relatedNodeId})` : ''}`);
}

console.log(`\nINFOS (${infos.length}):`);
for (const d of infos) {
  console.log(`  ${d.code} [L${d.range.startLine}]: ${d.message}${d.relatedNodeId ? ` (node: ${d.relatedNodeId})` : ''}`);
}

// After validation: check node diagnostics
console.log(`\nNode state after validation:`);
const orphans = data.chapters.flatMap(c => c.nodes.filter(n => n.diagnostics.isOrphan));
const roots = data.chapters.flatMap(c => c.nodes.filter(n => n.diagnostics.isRoot));
const deadEnds = data.chapters.flatMap(c => c.nodes.filter(n => n.diagnostics.isDeadEnd));
console.log(`  Root nodes: ${roots.map(n => n.fullId).join(', ')}`);
console.log(`  Orphan nodes: ${orphans.length > 0 ? orphans.map(n => n.fullId).join(', ') : '(none)'}`);
console.log(`  Dead-end nodes: ${deadEnds.map(n => n.fullId).join(', ')}`);

console.log('');
console.log('='.repeat(80));
console.log('PHASE 3: EXPORT JSON');
console.log('='.repeat(80));

const jsonResult = exportJSON(data);
if (jsonResult.ok) {
  const jsonPath = resolve('D:\\VibeCoding\\PlotFlow\\scripts\\output\\complex-30-node.json');
  writeFileSync(jsonPath, jsonResult.data, 'utf-8');
  console.log(`JSON exported: ${jsonPath}`);
  console.log(`JSON size: ${jsonResult.data.length} chars`);

  // Parse back to check structure
  const parsed = JSON.parse(jsonResult.data);
  console.log(`  $schema: ${parsed.$schema}`);
  console.log(`  meta.title: ${parsed.meta.title}`);
  console.log(`  variables count: ${Object.keys(parsed.variables || {}).length}`);
  console.log(`  chapters count: ${parsed.chapters?.length}`);
  let jsonNodeCount = 0;
  for (const ch of parsed.chapters || []) {
    jsonNodeCount += ch.nodes?.length || 0;
  }
  console.log(`  total nodes in JSON: ${jsonNodeCount}`);

  // Check condition AST preservation
  let jsonCondCount = 0;
  let jsonEffectCount = 0;
  for (const ch of parsed.chapters || []) {
    for (const n of ch.nodes || []) {
      for (const opt of n.options || []) {
        if (opt.conditions) jsonCondCount++;
        if (opt.sideEffects?.length > 0) jsonEffectCount += opt.sideEffects.length;
      }
    }
  }
  console.log(`  conditions in JSON: ${jsonCondCount}`);
  console.log(`  sideEffects in JSON: ${jsonEffectCount}`);
} else {
  console.error('JSON export failed:', jsonResult.errors);
}

console.log('');
console.log('='.repeat(80));
console.log('PHASE 4: EXPORT HTML');
console.log('='.repeat(80));

const htmlResult = exportHTML(data);
if (htmlResult.ok) {
  const htmlPath = resolve('D:\\VibeCoding\\PlotFlow\\scripts\\output\\complex-30-node.html');
  writeFileSync(htmlPath, htmlResult.data, 'utf-8');
  console.log(`HTML exported: ${htmlPath}`);
  console.log(`HTML size: ${htmlResult.data.length} chars`);

  // Analyze HTML structure
  const html = htmlResult.data;
  // Count nodes embedded in the JSON blob
  const storyMatch = html.match(/var STORY = ({.*?});/s);
  if (storyMatch) {
    const storyData = JSON.parse(storyMatch[1]!);
    const nodeCount = Object.keys(storyData.nodes || {}).length;
    console.log(`  Runtime nodes: ${nodeCount}`);
    console.log(`  Root ID: ${storyData.rootId}`);
    console.log(`  Variable count: ${Object.keys(storyData.vars || {}).length}`);

    // Analyze reachability: BFS from root
    const visited = new Set<string>();
    const queue = [storyData.rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = storyData.nodes[id];
      if (node?.options) {
        for (const opt of node.options) {
          if (opt.target && storyData.nodes[opt.target] && !visited.has(opt.target)) {
            queue.push(opt.target);
          }
        }
      }
    }

    const unreachable = nodeCount - visited.size;
    console.log(`  Reachable nodes: ${visited.size} / ${nodeCount}`);
    if (unreachable > 0) {
      const unreachableIds = Object.keys(storyData.nodes).filter(id => !visited.has(id));
      console.log(`  Unreachable nodes: ${unreachable} -> ${unreachableIds.join(', ')}`);
    } else {
      console.log(`  All nodes reachable from root!`);
    }
  }

  // Check that condition logic is embedded
  const hasCondEval = html.includes('evalCond');
  const hasEffectApply = html.includes('applyEffects');
  console.log(`  Condition evaluator present: ${hasCondEval}`);
  console.log(`  Effect applicator present: ${hasEffectApply}`);
} else {
  console.error('HTML export failed:', htmlResult.errors);
}

console.log('');
console.log('='.repeat(80));
console.log('PHASE 5: EDGE CASES & LIMITATIONS ANALYSIS');
console.log('='.repeat(80));

// Test: max nodes per chapter
for (const ch of data.chapters) {
  console.log(`  Chapter "${ch.id}": ${ch.nodes.length} nodes`);
}

// Test: cross-chapter references
let crossChapterRefs = 0;
for (const ch of data.chapters) {
  for (const node of ch.nodes) {
    for (const opt of node.options) {
      if (opt.targetFullId && !opt.targetFullId.startsWith(ch.id + '-')) {
        crossChapterRefs++;
      }
    }
  }
}
console.log(`  Cross-chapter references: ${crossChapterRefs}`);

// Test: orphan detection
console.log(`  Orphans after validation: ${orphans.length}`);
for (const o of orphans) {
  console.log(`    - ${o.fullId}`);
}

// Test: dead-end detection
console.log(`  Dead-ends after validation: ${deadEnds.length}`);
for (const d of deadEnds) {
  console.log(`    - ${d.fullId} (intentional story endings)`);
}

// Test: max nesting depth of conditions
let maxCondDepth = 0;
function condDepth(cond: any, depth: number): number {
  if (!cond) return depth;
  if (cond.type === 'logical') {
    return Math.max(...cond.operands.map((o: any) => condDepth(o, depth + 1)));
  }
  return depth;
}
for (const ch of data.chapters) {
  for (const node of ch.nodes) {
    for (const opt of node.options) {
      if (opt.condition) {
        const d = condDepth(opt.condition, 0);
        if (d > maxCondDepth) maxCondDepth = d;
      }
    }
  }
}
console.log(`  Max condition nesting depth: ${maxCondDepth}`);

// Test: node body sizes
const bodySizes = data.chapters.flatMap(c => c.nodes.map(n => n.body.length));
console.log(`  Node body sizes: min=${Math.min(...bodySizes)}, max=${Math.max(...bodySizes)}, avg=${(bodySizes.reduce((a,b)=>a+b,0)/bodySizes.length).toFixed(0)}`);

console.log('');
console.log('='.repeat(80));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(80));
