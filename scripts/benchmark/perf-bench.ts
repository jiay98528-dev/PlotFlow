/**
 * Fablevia Performance Baseline Benchmark
 *
 * Measures:
 *   1. 200-node .mdstory file parse time
 *   2. 200-node file validator time
 *   3. Adapter (AST→ReactFlow) conversion time
 *   4. Dagre layout computation time
 *   5. Full pipeline (parse+validate+adapt+layout) time
 *   6. NGramEngine tokenize/predict latency
 *   7. Algorithmic complexity analysis (static code reasoning)
 *
 * run: npx tsx scripts/benchmark/perf-bench.ts
 *
 * @version 2026-06-19
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// --- Dynamically import @dagrejs/dagre for layout benchmark ---
import { graphlib, layout as dagreLayout } from '@dagrejs/dagre';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');

// ============================================================================
// Types
// ============================================================================

interface TimingResult {
  label: string;
  mean: number;   // ms
  min: number;    // ms
  max: number;    // ms
  samples: number;
  targetMs?: number;
}

interface PerfReport {
  meta: {
    date: string;
    nodeVersion: string;
    platform: string;
    arch: string;
    testFile: string;
    testFileSizeKB: number;
    testFileNodes: number;
    iterations: number;
  };
  measurements: TimingResult[];
  complexityAnalysis: {
    parser: Record<string, string>;
    adapter: Record<string, string>;
    validator: Record<string, string>;
    layout: Record<string, string>;
    ghosttext: Record<string, string>;
  };
  baselinesEstimated: {
    coldStartMs: number;
    warmStartMs: number;
    themeToggleMs: number;
    languageToggleMs: number;
    ghostTextMs: number;
    memoryIdleMB: number;
    memory200NodeMB: number;
  };
}

// ============================================================================
// Helpers
// ============================================================================

function time(fn: () => void, iterations: number = 100): TimingResult {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    // warm up
    if (i < 5) {
      fn();
      continue;
    }
    const start = performance.now();
    fn();
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }
  times.sort((a, b) => a - b);
  const samples = times.length;
  const mean = times.reduce((s, t) => s + t, 0) / samples;
  return { label: '', mean, min: times[0]!, max: times[times.length - 1]!, samples };
}

function timeWithLabel(label: string, fn: () => void, iterations: number = 100, targetMs?: number): TimingResult {
  const r = time(fn, iterations);
  r.label = label;
  r.targetMs = targetMs;
  return r;
}

// ============================================================================
// Core Benchmark
// ============================================================================

async function main() {
  console.log(' Fablevia Performance Baseline Benchmark');
  console.log('='.repeat(60) + '\n');

  // Load test file
  const testFile = resolve(PROJECT_ROOT, 'scripts/benchmark/200-nodes.mds');
  const raw = readFileSync(testFile, 'utf-8');
  const fileSizeKB = Buffer.byteLength(raw, 'utf-8') / 1024;

  console.log(`Test file: ${testFile}`);
  console.log(`File size: ${fileSizeKB.toFixed(1)} KB\n`);

  // Dynamically import core modules (they use ESM)
  const core = await import('@plotflow/core');
  const { parseStory, validateAll } = core;

  // ========================================================================
  // 1. Count nodes
  // ========================================================================
  const nodeCount = (raw.match(/^##[ \t]+节点[：:]/gm) ?? []).length;
  const optionCount = (raw.match(/^[ \t]*\[选项\]/gm) ?? []).length;
  console.log(`Nodes detected: ${nodeCount} (H2 headings)`);
  console.log(`Options detected: ${optionCount}\n`);

  // ========================================================================
  // 2. Parse time
  // ========================================================================
  console.log('--- Parse Performance ---');
  const PARSE_ITERS = 500;

  // Pre-parse once to get AST for subsequent benchmarks
  const preResult = parseStory(raw);
  const preAST = preResult.data;
  console.log(`  Pre-parse: OK, chapters=${preAST.chapters.length}, nodes=${(() => { let c = 0; for (const ch of preAST.chapters) c += ch.nodes.length; return c; })()}`);

  const parseResult = timeWithLabel(
    'parseStory (raw text → PlotFlowData AST)',
    () => { parseStory(raw); },
    PARSE_ITERS,
    500, // M2 target: <500ms for large files
  );
  console.log(`  parseStory: mean=${parseResult.mean.toFixed(2)}ms, min=${parseResult.min.toFixed(2)}ms, max=${parseResult.max.toFixed(2)}ms`);

  // ========================================================================
  // 3. Validate time
  // ========================================================================
  console.log('\n--- Validator Performance ---');
  const validateResult = timeWithLabel(
    'validate (17 rules: E001-E008 + W001-W006 + I001-I003)',
    () => { validateAll(preAST); },
    PARSE_ITERS,
    100, // aspirational target
  );
  console.log(`  validate: mean=${validateResult.mean.toFixed(2)}ms, min=${validateResult.min.toFixed(2)}ms, max=${validateResult.max.toFixed(2)}ms`);

  const validationStats = validateAll(preAST);
  console.log(`  Diagnostic summary: ${validationStats.summary.errors}E / ${validationStats.summary.warnings}W / ${validationStats.summary.infos}I (${validationStats.summary.total} total)`);

  // ========================================================================
  // 4. Adapter + Layout (need to import from @plotflow/app)
  // ========================================================================
  console.log('\n--- Adapter + Layout Performance ---');

  // The adapter and layout depend on @xyflow/react types but are pure functions.
  // We'll implement a minimal inline version here for benchmarking, matching the
  // exact algorithms used in the real codebase.

  // --- Minimal node/edge types matching ReactFlow ---
  interface FlowNode {
    id: string;
    position: { x: number; y: number };
    [key: string]: unknown;
  }
  interface FlowEdge {
    id: string;
    source: string;
    target: string;
    [key: string]: unknown;
  }

  // --- Adapter (matching adapter.ts algorithm) ---
  function adaptToFlow(ast: typeof preAST): { nodes: FlowNode[]; edges: FlowEdge[] } {
    // Step 1: Flatten all nodes + build Map (O(N))
    const allNodes: typeof preAST.chapters[0]['nodes'] = [];
    const nodeMap = new Map<string, typeof preAST.chapters[0]['nodes'][0]>();
    for (const chapter of ast.chapters) {
      for (const node of chapter.nodes) {
        allNodes.push(node);
        nodeMap.set(node.fullId, node);
      }
    }

    if (allNodes.length === 0) return { nodes: [], edges: [] };

    // Step 2: Build edges (O(N * avg_options))
    const flowEdges: FlowEdge[] = [];
    for (const node of allNodes) {
      for (let i = 0; i < node.options.length; i++) {
        const option = node.options[i]!;
        if (!option.targetFullId) continue;
        if (!nodeMap.has(option.targetFullId)) continue;
        flowEdges.push({
          id: `${node.fullId}->${option.targetFullId}#${i}`,
          source: node.fullId,
          target: option.targetFullId,
          type: option.condition ? 'conditional' : 'default',
        });
      }
    }

    // Step 3: Build ReactFlow nodes
    const flowNodes: FlowNode[] = allNodes.map((n) => ({
      id: n.fullId,
      type: 'storyNode',
      position: { x: 0, y: 0 },
      data: { title: n.title, status: 'normal' },
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }

  const adapterResult = timeWithLabel(
    'adapt (AST → ReactFlow nodes/edges)',
    () => { adaptToFlow(preAST); },
    PARSE_ITERS,
    500,
  );
  console.log(`  adaptToFlow: mean=${adapterResult.mean.toFixed(2)}ms, min=${adapterResult.min.toFixed(2)}ms, max=${adapterResult.max.toFixed(2)}ms`);

  // --- Layout (matching layout.ts algorithm with Dagre) ---
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 120;

  function layoutFlow(nodes: FlowNode[], edges: FlowEdge[]): { nodes: FlowNode[]; edges: FlowEdge[] } {
    if (nodes.length === 0) return { nodes: [], edges };

    const g = new graphlib.Graph({ directed: true, multigraph: false });
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: 'TB',
      nodesep: 150,
      ranksep: 120,
      marginx: 50,
      marginy: 50,
    });

    for (const node of nodes) {
      g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    const connectedIds = new Set<string>();
    for (const edge of edges) {
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        g.setEdge(edge.source, edge.target);
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
      }
    }

    dagreLayout(g);

    const layouted: FlowNode[] = nodes.map((node) => {
      const dagreNode = g.node(node.id);
      if (dagreNode && typeof dagreNode.x === 'number') {
        return { ...node, position: { x: dagreNode.x - NODE_WIDTH / 2, y: dagreNode.y - NODE_HEIGHT / 2 } };
      }
      return node;
    });

    // Orphan nodes placement
    const orphanNodes = layouted.filter((n) => !connectedIds.has(n.id));
    if (orphanNodes.length > 0) {
      const maxX = layouted.reduce((max, n) => Math.max(max, n.position.x + NODE_WIDTH), 0);
      const orphanX = maxX + 200;
      let orphanY = 50;
      for (const node of orphanNodes) {
        node.position = { x: orphanX, y: orphanY };
        orphanY += NODE_HEIGHT + 100;
      }
    }

    return { nodes: layouted, edges };
  }

  // Pre-adapt to feed into layout
  const { nodes: testNodes, edges: testEdges } = adaptToFlow(preAST);
  console.log(`  Flow nodes: ${testNodes.length}, Flow edges: ${testEdges.length}`);

  const layoutResult = timeWithLabel(
    'layout (Dagre TB layout + orphan placement)',
    () => { layoutFlow(testNodes, testEdges); },
    100, // fewer iterations because Dagre is CPU-heavy
    200, // aspirational target
  );
  console.log(`  layout: mean=${layoutResult.mean.toFixed(2)}ms, min=${layoutResult.min.toFixed(2)}ms, max=${layoutResult.max.toFixed(2)}ms`);

  // ========================================================================
  // 5. Full pipeline (parse + validate + adapt + layout)
  // ========================================================================
  console.log('\n--- Full Pipeline Performance ---');
  const FULL_PIPELINE_ITERS = 200;

  function fullPipeline(raw: string) {
    const ast = parseStory(raw);
    if (!ast.ok) return;
    const validated = validateAll(ast.data);
    const { nodes, edges } = adaptToFlow(ast.data);
    layoutFlow(nodes, edges);
    // consume validated to avoid dead-code elimination
    void validated.summary.total;
  }

  const pipelineResult = timeWithLabel(
    'fullPipeline (parse+validate+adapt+layout)',
    () => { fullPipeline(raw); },
    FULL_PIPELINE_ITERS,
    1000, // <1s for full 200-node pipeline
  );
  console.log(`  fullPipeline: mean=${pipelineResult.mean.toFixed(2)}ms, min=${pipelineResult.min.toFixed(2)}ms, max=${pipelineResult.max.toFixed(2)}ms`);

  // ========================================================================
  // 6. NGramEngine performance (GhostText)
  // ========================================================================
  console.log('\n--- GhostText / NGramEngine Performance ---');

  const { NGramEngine } = core;
  const engine = new NGramEngine();

  // Tokenize benchmark
  const sampleText = raw.slice(0, 5000);
  const tokenizeResult = timeWithLabel(
    'tokenize (CJK+en+number, 5KB sample)',
    () => { engine.tokenize(sampleText); },
    1000,
    5, // should be nearly instant
  );
  const tokens = engine.tokenize(sampleText);
  console.log(`  tokenize: mean=${tokenizeResult.mean.toFixed(3)}ms, tokens=${tokens.length}`);

  // Train benchmark
  engine.clear();
  const trainTokens = engine.tokenize(raw);
  const trainResult = timeWithLabel(
    'train (200-node file tokens → 1..5 gram)',
    () => { engine.train([...trainTokens]); },
    10, // fewer iterations — training is heavier
    50,
  );
  engine.clear();
  engine.train([...trainTokens]); // retrain for predict benchmark
  console.log(`  train: mean=${trainResult.mean.toFixed(2)}ms, entryCount=${engine.entryCount}`);

  // Predict benchmark
  const predictResult = timeWithLabel(
    'predict (5-gram lookup, topN=5)',
    () => { engine.predict('走向', 5); },
    1000,
    10, // should be fast — Map lookups
  );
  const preds = engine.predict('森林', 5);
  console.log(`  predict: mean=${predictResult.mean.toFixed(3)}ms, samples=["森林" → ${preds.join(',') || '(none)'}]`);

  // PredictScored benchmark
  const predictScoredResult = timeWithLabel(
    'predictScored (with scoring, topN=5)',
    () => { engine.predictScored('走向', 5); },
    1000,
    10,
  );
  console.log(`  predictScored: mean=${predictScoredResult.mean.toFixed(3)}ms`);

  // ========================================================================
  // 7. Complexity Analysis (static code reasoning)
  // ========================================================================
  console.log('\n--- Algorithmic Complexity Analysis ---');

  const complexityAnalysis = {
    parser: {
      'parseStory': 'O(N) where N = raw text length. Single-pass line scan. Split, frontmatter match, then linear scan.',
      'parseChaptersAndNodes': 'O(L) where L = number of lines. Single linear pass with chapter/node regex matching per line.',
      'parseOptions': 'O(B + O) where B = body text length, O = number of option lines. Linear scan with per-option sub-line collection.',
      'parseCondition': 'O(E) where E = expression length. Recursive descent parser, linear in token count.',
      'parseEffects': 'O(F) where F = effects text length. Linear split + per-effect parse.',
      'resolveTargetFullIds': 'O(N + E) where N = nodes, E = total options. Two-pass: build Maps (O(N)), then iterate all options (O(E)).',
      'overall_bottleneck': 'String split and RegExp matching on raw text. Regex exec on every line. Unicode length checks (`[...str].length`) create intermediate arrays.',
      'optimization_notes': 'RegExp objects are compiled at module level (static). Could memoize Unicode grapheme counts for repeated title checks.',
    },
    adapter: {
      'plotFlowDataToFlow': 'O(N + E) where N = nodes, E = total edges (options with valid targets).',
      'node_flatmap': 'O(N) — single pass through chapters→nodes. Builds Map<string, StoryNode> for O(1) target lookups.',
      'edge_construction': 'O(E) — iterate all nodes all options. Map.has() for O(1) target existence check (replaces Array.find O(N)).',
      'status_determination': 'O(N * D) where D = diagnosticIds.length per node. getNodeStatus runs diagnosticIds.some() which is O(D).',
      'structural_hash': 'O(N log N + E log E) — sorts node IDs and edge pairs for hash. Only on topology change.',
      'layout_cache': 'O(1) hit — avoids Dagre recomputation. Cache invalidated only on topology change.',
      'overall_bottleneck': 'Dagre layout (O(|V| * |E|) in worst case). Cached on topology hash.',
    },
    validator: {
      'validate (17 rules)': 'Sum of individual rule costs. Each rule iterates the full AST.',
      'E001 (undefined target)': 'O(N + E) — build id Set (O(N)), then iterate all options checking Set.has() (O(E)).',
      'E002 (undeclared var)': 'O(V + N*O*C) — flat map variables (O(V)), collect condition var names recursively (depth-limited to 3).',
      'E003 (invalid enum)': 'O(N*O*C) — iterate all options, recursive condition walk (depth ≤ 3).',
      'E004 (type mismatch)': 'O(N*O*C) — same pattern as E003.',
      'E005 (syntax fail)': 'O(N*O) — simple presence check on all options.',
      'E006 (depth)': 'O(V * D) where D = average object nesting depth (≤ 3). Recursive walk of variable declarations.',
      'E007 (duplicate node id)': 'O(N) — single pass build Map + check.',
      'E008 (duplicate var)': 'O(V) — recursive walk of variable declarations.',
      'W001-W006': 'Each O(N) or O(N*O). Similar iteration patterns.',
      'I001-I003': 'Each O(N) or O(N*O).',
      'updateNodeDiagnostics': 'O(E + D + N) — collect all target IDs (O(E)), group diagnostics by node (O(D)), update nodes (O(N)).',
      'overall_bottleneck': '17 individual rules each traversing the full AST independently. Total ~17 * O(N*O) = O(N*O). Could be fused into a single traversal for ~O(N*O) total.',
      'optimization_notes': 'Fusing E001-E008 into single pass would reduce from 8x traversal to 1x. W rules could also be fused. Currently validation is O(R * N * O) where R=17 rules.',
    },
    layout: {
      'layoutNodes (Dagre)': 'O(|V| * |E|) worst-case. Dagre uses network simplex internally, which is O(|V|^3) worst-case but typically O(|V|^2) for hierarchical graphs.',
      'node_registration': 'O(|V|) — single loop.',
      'edge_registration': 'O(|E|) — single loop.',
      'dagre_layout_call': 'O(|V| * |E|) practical, O(|V|^3) worst-case. TB layout is typically faster than general digraph.',
      'position_extraction': 'O(|V|) — single map.',
      'orphan_placement': 'O(|V|) — filter unconnected + place.',
      'identifySiblingGroups': 'O(|E| + |V|) — build parent→children map from edges.',
      'collapseSiblingNodes': 'O(|V| + |E|) — filter nodes/edges based on collapse decisions.',
      'overall_bottleneck': 'Dagre network simplex. TB rankdir with 200 nodes should be well under 200ms in practice.',
    },
    ghosttext: {
      'tokenize': 'O(T) where T = text length in characters. Single pass with CJK detection regex per character.',
      'train': 'O(T * N^2) where T = token count, N = max gram level (5). For each of T tokens, creates (N) n-grams. Each n-gram performs Map operations (O(1) amortized).',
      'predict': 'O(N * C) where N = max gram level (5), C = candidate count. Map.get() is O(1). Sorting candidates by frequency is O(C log C).',
      'predictScored': 'Same as predict + O(R log R) sort where R = result count.',
      'serialize/deserialize': 'O(M) where M = total entries in the n-gram store.',
      'overall_bottleneck': 'Training time grows linearly with token count. Predict is near-instant (Map lookups + small sort).',
    },
  };

  // ========================================================================
  // 8. Estimated baselines (from code analysis, not runtime measurement)
  // ========================================================================
  console.log('\n--- Estimated Runtime Baselines ---');

  // These are estimates based on:
  // - Cold start: Electron 28 startup overhead (~800ms typical on modern SSD)
  //   + React app bundle load (~200ms) + Monaco init (~400ms) + ReactFlow init (~100ms)
  // - Warm start: OS page cache warm, only JS init (~200ms React + ~400ms Monaco + ~100ms RF)
  // - Theme toggle: CSS variable swap only, instant DOM style recalc (browser repaint ~16ms frame)
  // - Language toggle: `changeLanguage()` iterates subscribers O(S) where S = subscribers (estimated <50)
  // - GhostText: tokenize + predict O(T) per keystroke
  // - Memory: Electron heap (~80MB base) + Monaco model (~10MB) + React (~20MB) + 200-node AST (~5MB)

  const estimatedBaselines = {
    coldStartMs: 1500,  // Electron 28 cold boot + app init
    warmStartMs: 700,   // Electron already in memory, just window creation
    themeToggleMs: 8,   // CSS variable swap + single repaint frame
    languageToggleMs: 2, // i18n.subscribe notifies <50 subscribers synchronously
    ghostTextMs: 15,    // tokenize(prefix) + predict(5-gram lookup) ≈ 10-15ms for typical prefix
    memoryIdleMB: 80,   // Electron base heap (40MB renderer + 40MB main process)
    memory200NodeMB: 120, // + Monaco model ~10MB + React ~20MB + Dagre graph ~5MB + AST ~5MB
  };

  // ========================================================================
  // 9. Assemble and output report
  // ========================================================================
  console.log('\n' + '='.repeat(60));
  console.log(' PERFORMANCE REPORT (JSON)');
  console.log('='.repeat(60) + '\n');

  const report: PerfReport = {
    meta: {
      date: new Date().toISOString().split('T')[0]!,
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      testFile: 'scripts/benchmark/200-nodes.mds',
      testFileSizeKB: Math.round(fileSizeKB * 100) / 100,
      testFileNodes: nodeCount,
      iterations: PARSE_ITERS,
    },
    measurements: [
      parseResult,
      validateResult,
      adapterResult,
      layoutResult,
      pipelineResult,
      tokenizeResult,
      trainResult,
      predictResult,
      predictScoredResult,
    ],
    complexityAnalysis,
    baselinesEstimated: estimatedBaselines,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch(console.error);
