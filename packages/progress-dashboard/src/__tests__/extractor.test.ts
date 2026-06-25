import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import type { DashboardData } from '../types/dashboard';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const tempDirs: string[] = [];

async function loadExtractor(): Promise<{
  buildDashboardData: (options: { repoRoot: string }) => Promise<DashboardData>;
}> {
  const extractorPath = path.resolve(repoRoot, 'scripts/progress-dashboard/extractor.mjs');
  return import(extractorPath) as Promise<{
    buildDashboardData: (options: { repoRoot: string }) => Promise<DashboardData>;
  }>;
}

async function writeFixture(tempRoot: string, relativePath: string, content: string): Promise<void> {
  const fullPath = path.join(tempRoot, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, 'utf8');
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(async (dirPath) => {
      await fs.rm(dirPath, { recursive: true, force: true });
    }),
  );
});

describe('dashboard extractor', () => {
  it('parses the six fixed sources and emits the required top-level modules', async () => {
    const { buildDashboardData } = await loadExtractor();
    const data = await buildDashboardData({ repoRoot });

    expect(data.meta.projectName).toBe('PlotFlow');
    expect(data.summary.totalTasks.value).toBeGreaterThan(0);
    expect(data.milestones.items.length).toBeGreaterThanOrEqual(10);
    expect(data.milestones.items.map((item) => item.id)).toEqual(
      expect.arrayContaining(['M8', 'M9']),
    );
    expect(data.qualityGates.gates.length).toBeGreaterThan(0);
    expect(data.findings.total).toBeGreaterThan(0);
    expect(data.contradictions.total).toBeGreaterThan(0);
    expect(data.performance.benchmarks.length).toBeGreaterThan(0);
    expect(data.journey.checkpoints.length).toBeGreaterThan(0);
    expect(data.sourceHealth.sources.length).toBeGreaterThanOrEqual(6);
  });

  it('parses date fields and reports the current source consistency state', async () => {
    const { buildDashboardData } = await loadExtractor();
    const data = await buildDashboardData({ repoRoot });

    expect(data.summary.lastUpdated.value).toBe('2026-06-25');
    expect(data.summary.realCompletionRate.value).toBe(92.96);
    expect(data.summary.deltaPublicVsReal.value).toBe(0);
    expect(data.discrepancies).toHaveLength(0);
  });

  it('supports maintenance refresh by changing only source data', async () => {
    const { buildDashboardData } = await loadExtractor();
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'plotflow-dashboard-'));
    tempDirs.push(tempRoot);

    await writeFixture(
      tempRoot,
      'README.md',
      `# PlotFlow

## 里程碑

| 里程碑 | 名称 | 预估 | 进度 |
|:---:|------|:---:|:---:|
| M0 | 项目脚手架 | 2 天 | ✅ 50% |

当前总进度见 [spec/progress.md](spec/progress.md)：1/2 项完成（50%）。
`,
    );

    await writeFixture(
      tempRoot,
      'spec/progress.md',
      `# PlotFlow 实时进度跟踪

> **更新**：2026-06-23

## 总览

| 里程碑 | 名称 | 任务数 | 完成 | 进行中 | 未开始 | 阻塞 | 进度 |
|:---:|------|:---:|:---:|:---:|:---:|:---:|:---:|
| M0 | 项目脚手架 | 2 | 1 | 0 | 1 | 0 | 50% |
| **合计** | | **2** | **1** | **0** | **1** | **0** | **50%** |

## M0 项目脚手架

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M0-01 | 初始化 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-02 | 收尾 | ⬜ | — | — | |

## 阻塞项

| 里程碑 | 阻塞数 | 说明 |
|--------|:---:|------|
| M0 | 0 | 无 |
`,
    );

    await writeFixture(
      tempRoot,
      'spec/milestones.md',
      `# PlotFlow 里程碑规划

## 总览

| 里程碑 | 名称 | 总任务 | ⚡haiku | 🔶sonnet | 🧠V4Pro | Fast占比 | 预估 |
|:---:|------|:---:|:---:|:---:|:---:|:---:|:---:|
| M0 | 项目脚手架 | 2 | 1 | 1 | 0 | 100% | 2天 |

## M0 项目脚手架

| # | 任务 | 产出 |
|---|------|------|
| M0-01 | 初始化 | foo |
| M0-02 | 收尾 | bar |
`,
    );

    await writeFixture(
      tempRoot,
      'spec/audit/pass1-data.json',
      JSON.stringify({
        meta: {
          audit_date: '2026-06-19',
          total_findings: 1,
          severity_distribution: { CRITICAL: 1, HIGH: 0, MEDIUM: 0, LOW: 0 },
        },
        quality_gates: {
          L1_tsc: { status: 'PASS', errors: 0 },
        },
        findings: [
          {
            id: 'C1',
            severity: 'CRITICAL',
            category: 'Config',
            title: 'example',
            status: '未修复',
            detail: 'detail',
          },
        ],
        contradictions: [],
        e2e_assessment: {
          config_match: 'PASS',
          files: [{ name: 'one.spec.ts', lines: 10, matched_by_config: true }],
          dead_code_lines: 0,
        },
        overall_grade: {
          weighted_score: 90,
          letter_grade: 'A-',
        },
        test_baseline: {
          V0_2_progress_md: { files: 1, tests: 10 },
          Pass_1_measured: { files: 1, tests: 12, failed: 0, duration_s: 0.5 },
          delta_vs_progress_md: { files: '+0', tests: '+2' },
        },
      }),
    );

    await writeFixture(
      tempRoot,
      'scripts/output/journey-report.json',
      JSON.stringify({
        journey_report: {
          meta: { simulation_date: '2026-06-19' },
          story_stats: {
            total_nodes: 2,
            total_options: 1,
            total_conditions: 0,
            total_effects: 0,
            chapters: 1,
            variables: 1,
            input_size_chars: 10,
            input_size_lines: 2,
            parse_time_ms: 1,
            cross_chapter_references: 0,
          },
          chapters: [{ id: '第一章', nodes: 2, conditions: 0, effects: 0 }],
          variables: [{ name: '金币', type: 'int', default: 0 }],
          checkpoints: {
            open: { status: 'PASS', description: 'ok' },
          },
          overall_assessment: {
            parser_readiness: '生产就绪',
            parser_readiness_detail: 'ready',
          },
        },
      }),
    );

    await writeFixture(
      tempRoot,
      'scripts/benchmark/perf-report.json',
      JSON.stringify({
        date: '2026-06-19',
        benchmarks: [
          {
            id: 1,
            name: 'Parse',
            type: 'measured',
            target_ms: 100,
            value_ms: 50,
            verdict: 'PASS',
          },
        ],
        bottlenecks: [],
        recommendations: [],
        summary: {
          totalBenchmarks: 1,
          pass: 1,
          fail: 0,
          passRate: '100%',
          criticalIssues: 0,
          criticalIssue: 'none',
          overallAssessment: 'good',
        },
      }),
    );

    const first = await buildDashboardData({ repoRoot: tempRoot });
    expect(first.summary.realCompletionRate.value).toBe(50);

    await writeFixture(
      tempRoot,
      'spec/progress.md',
      `# PlotFlow 实时进度跟踪

> **更新**：2026-06-23

## 总览

| 里程碑 | 名称 | 任务数 | 完成 | 进行中 | 未开始 | 阻塞 | 进度 |
|:---:|------|:---:|:---:|:---:|:---:|:---:|:---:|
| M0 | 项目脚手架 | 2 | 2 | 0 | 0 | 0 | 100% |
| **合计** | | **2** | **2** | **0** | **0** | **0** | **100%** |

## M0 项目脚手架

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M0-01 | 初始化 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-02 | 收尾 | ✅ | 2026-06-13 | 2026-06-14 | |

## 阻塞项

| 里程碑 | 阻塞数 | 说明 |
|--------|:---:|------|
| M0 | 0 | 无 |
`,
    );

    const second = await buildDashboardData({ repoRoot: tempRoot });
    expect(second.summary.realCompletionRate.value).toBe(100);
    expect(second.summary.realCompleted.value).toBe(2);
  });
});
