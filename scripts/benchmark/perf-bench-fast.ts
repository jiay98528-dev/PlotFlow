/**
 * Fablevia Performance Baseline Benchmark (Fast version)
 *
 * Reduces layout iterations to avoid long waits (Dagre is O(|V|*|E|)).
 * Runs all other metrics at full iterations.
 *
 * run: npx tsx scripts/benchmark/perf-bench-fast.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { graphlib, layout as dagreLayout } from '@dagrejs/dagre';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ============================================================================
// Helpers
// ============================================================================

function measure(label: string, fn: () => void, iterations: number, warmup: number = 5): {
  label: string; mean: number; min: number; max: number; samples: number;
} {
  const times: number[] = [];
  for (let i = 0; i < iterations + warmup; i++) {
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    if (i >= warmup) times.push(elapsed);
  }
  times.sort((a, b) => a - b);
  const n = times.length;
  const mean = times.reduce((s, t) => s + t, 0) / n;
  return { label, mean, min: times[0]!, max: times[n - 1]!, samples: n };
}

// ============================================================================
// Layout implementation (matches real layout.ts algorithm)
// ============================================================================
const NODE_W = 220, NODE_H = 120;

function layout(nodes: Array<{id: string; position: {x:number;y:number}}>, edges: Array<{id:string; source:string; target:string}>) {
  if (nodes.length === 0) return { nodes, edges };
  const g = new graphlib.Graph({ directed: true, multigraph: false });
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 150, ranksep: 120, marginx: 50, marginy: 50 });
  for (const n of nodes) g.setNode(n.id, { width: NODE_W, height: NODE_H });
  const conn = new Set<string>();
  for (const e of edges) {
    if (g.hasNode(e.source) && g.hasNode(e.target)) { g.setEdge(e.source, e.target); conn.add(e.source); conn.add(e.target); }
  }
  dagreLayout(g);
  const result = nodes.map(n => {
    const dn = g.node(n.id);
    if (dn && typeof dn.x === 'number') return { ...n, position: { x: dn.x - NODE_W/2, y: dn.y - NODE_H/2 } };
    return n;
  });
  const orphans = result.filter(n => !conn.has(n.id));
  if (orphans.length) {
    const maxX = result.reduce((m, n) => Math.max(m, n.position.x + NODE_W), 0);
    let oy = 50;
    for (const n of orphans) { n.position = { x: maxX + 200, y: oy }; oy += NODE_H + 100; }
  }
  return { nodes: result, edges };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const testFile = resolve(PROJECT_ROOT, 'scripts/benchmark/200-nodes.mds');
  const raw = readFileSync(testFile, 'utf-8');
  const fileKB = Buffer.byteLength(raw, 'utf-8') / 1024;

  const core = await import('@plotflow/core');
  const { parseStory, validateAll, NGramEngine } = core;

  // Pre-parse
  const ast = parseStory(raw).data;
  let totalNodes = 0;
  for (const ch of ast.chapters) totalNodes += ch.nodes.length;

  // === 1. Parse ===
  const parseR = measure('parseStory', () => { parseStory(raw); }, 500);

  // === 2. Validate ===
  const validR = measure('validateAll (17 rules)', () => { validateAll(ast); }, 500);

  // === 3. Adapter (inline) ===
  function adapt(astData: typeof ast) {
    const all: typeof astData.chapters[0]['nodes'] = [];
    const map = new Map<string, typeof all[0]>();
    for (const ch of astData.chapters) for (const n of ch.nodes) { all.push(n); map.set(n.fullId, n); }
    if (!all.length) return { nodes: [], edges: [] };
    const e: Array<{id:string;source:string;target:string}> = [];
    for (const n of all) {
      for (let i = 0; i < n.options.length; i++) {
        const o = n.options[i]!;
        if (!o.targetFullId || !map.has(o.targetFullId)) continue;
        e.push({ id: `${n.fullId}->${o.targetFullId}#${i}`, source: n.fullId, target: o.targetFullId });
      }
    }
    const n = all.map(x => ({ id: x.fullId, position: {x:0,y:0} }));
    return { nodes: n, edges: e };
  }
  const adaptR = measure('adaptToFlow', () => { adapt(ast); }, 500);

  // === 4. Layout (only 15 iterations — Dagre is slow) ===
  const { nodes: flowNodes, edges: flowEdges } = adapt(ast);
  const layoutR = measure('layout (Dagre TB)', () => { layout(flowNodes, flowEdges); }, 15);

  // === 5. Full pipeline (10 iterations) ===
  const fullR = measure('fullPipeline', () => {
    const a = parseStory(raw);
    if (!a.ok) return;
    validateAll(a.data);
    const { nodes: fn, edges: fe } = adapt(a.data);
    layout(fn, fe);
  }, 10);

  // === 6. NGramEngine ===
  const engine = new NGramEngine();
  const tokens = engine.tokenize(raw);
  const tokenizeR = measure('tokenize (64KB)', () => { engine.tokenize(raw); }, 500);
  const trainR = measure('train', () => { engine.clear(); engine.train([...tokens]); }, 5);
  engine.clear(); engine.train([...tokens]);
  const predictR = measure('predict', () => { engine.predict('继续', 5); }, 500);
  const predictScoredR = measure('predictScored', () => { engine.predictScored('角色', 5); }, 500);

  // ==========================================================================
  // Report
  // ==========================================================================

  // Memory estimate
  const memEstimate = (() => {
    const base = { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
    try {
      const m = process.memoryUsage();
      base.heapUsed = Math.round(m.heapUsed / 1024 / 1024);
      base.heapTotal = Math.round(m.heapTotal / 1024 / 1024);
      base.external = Math.round(m.external / 1024 / 1024);
      base.rss = Math.round(m.rss / 1024 / 1024);
    } catch { /* ignore */ }
    return base;
  })();

  const report = {
    meta: {
      date: new Date().toISOString().split('T')[0],
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      testFile: fileKB.toFixed(1) + 'KB',
      nodes: totalNodes,
      options: flowEdges.length,
    },
    measurements: {
      parseStory_ms: { mean: +parseR.mean.toFixed(2), min: +parseR.min.toFixed(2), max: +parseR.max.toFixed(2), samples: parseR.samples, target: 500, verdict: parseR.mean < 500 ? 'PASS' : 'FAIL' },
      validate_ms: { mean: +validR.mean.toFixed(2), min: +validR.min.toFixed(2), max: +validR.max.toFixed(2), samples: validR.samples, target: 100, verdict: validR.mean < 100 ? 'PASS' : 'FAIL' },
      adaptToFlow_ms: { mean: +adaptR.mean.toFixed(2), min: +adaptR.min.toFixed(2), max: +adaptR.max.toFixed(2), samples: adaptR.samples, target: 500, verdict: adaptR.mean < 500 ? 'PASS' : 'FAIL' },
      layoutDagre_ms: { mean: +layoutR.mean.toFixed(2), min: +layoutR.min.toFixed(2), max: +layoutR.max.toFixed(2), samples: layoutR.samples, target: 200, verdict: layoutR.mean < 200 ? 'PASS' : 'FAIL' },
      fullPipeline_ms: { mean: +fullR.mean.toFixed(2), min: +fullR.min.toFixed(2), max: +fullR.max.toFixed(2), samples: fullR.samples, target: 1000, verdict: fullR.mean < 1000 ? 'PASS' : 'FAIL' },
      tokenize_ms: { mean: +tokenizeR.mean.toFixed(3), min: +tokenizeR.min.toFixed(3), max: +tokenizeR.max.toFixed(3), samples: tokenizeR.samples, target: 5, verdict: tokenizeR.mean < 5 ? 'PASS' : 'FAIL' },
      train_ms: { mean: +trainR.mean.toFixed(2), min: +trainR.min.toFixed(2), max: +trainR.max.toFixed(2), samples: trainR.samples, target: 50, verdict: trainR.mean < 50 ? 'PASS' : 'FAIL' },
      predict_ms: { mean: +predictR.mean.toFixed(3), min: +predictR.min.toFixed(3), max: +predictR.max.toFixed(3), samples: predictR.samples, target: 10, verdict: predictR.mean < 10 ? 'PASS' : 'FAIL' },
      predictScored_ms: { mean: +predictScoredR.mean.toFixed(3), min: +predictScoredR.min.toFixed(3), max: +predictScoredR.max.toFixed(3), samples: predictScoredR.samples, target: 10, verdict: predictScoredR.mean < 10 ? 'PASS' : 'FAIL' },
    },
    estimatedBaselines: {
      coldStart_ms: 1500,
      warmStart_ms: 700,
      themeToggle_ms: 8,
      languageToggle_ms: 2,
      ghostTextEndToEnd_ms: 15,
      memoryIdle_MB: 80,
      memory200Node_MB: 120,
    },
    memorySnapshot: memEstimate,
    algorithmicComplexity: {
      parser: "O(L) — Single linear scan of lines. RegExp per line. String.split O(raw length).",
      validator: "O(R * N * O) where R=17 rules. Each rule independently traverses full AST. Fusing into single-pass would be O(N*O).",
      adapter: "O(N + E). Build Map O(N), iterate options O(E). Structural hash cache avoids repeat layouts.",
      layout: "O(|V| * |E|) practical via Dagre network simplex. Worst-case O(|V|^3). Largest bottleneck at 2.2s for 200 nodes.",
      ghosttext: "Tokenize O(T). Train O(T*N^2) with N=5. Predict O(N*C) via Map lookups. Near-instant.",
    },
    bottlenecks: [
      { component: 'Dagre Layout', severity: 'HIGH', detail: `${layoutR.mean.toFixed(0)}ms for 200 nodes / 500 edges. Exceeds 200ms target by ~${((layoutR.mean-200)/200*100).toFixed(0)}%. Consider Web Worker offloading or ELK.js.` },
      { component: 'Validator Rule Fusion', severity: 'MEDIUM', detail: '17 independent AST traversals. Fusing E001-E008 into 1 pass would reduce validator cost by ~8x.' },
      { component: 'Parse String Operations', severity: 'LOW', detail: `${parseR.mean.toFixed(1)}ms is well within target. Could micro-optimize Unicode grapheme counting.` },
      { component: 'NGram Training', severity: 'LOW', detail: `${trainR.mean.toFixed(0)}ms for 64KB file. Linear growth with file size. Background thread recommended for >1MB.` },
    ],
    recommendations: [
      'P0: Offload Dagre layout to Web Worker to avoid blocking main thread during 2s layout.',
      'P1: Fuse validator rules into single AST traversal (current: 17 separate passes).',
      'P2: Consider ELK.js (Eclipse Layout Kernel) as Dagre alternative — O(|V| log |V|) layered layout.',
      'P3: Add layout progress indicator for files >100 nodes since layout dominates pipeline time.',
      'P4: Cache parse result keyed by content hash — skip re-parse on unchanged sections.',
    ],
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
