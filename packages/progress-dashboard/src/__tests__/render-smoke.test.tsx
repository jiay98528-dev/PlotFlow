import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DashboardApp } from '../App';
import type { DashboardData } from '../types/dashboard';

function createSampleData(): DashboardData {
  return {
    meta: {
      projectName: 'PlotFlow',
      schemaVersion: 'test-schema',
      generatedAt: '2026-06-23T00:00:00.000Z',
      repoRoot: '/tmp/plotflow',
    },
    summary: {
      totalTasks: { status: 'neutral', value: 142, sourceRefs: [] },
      realCompleted: { status: 'pass', value: 132, sourceRefs: [] },
      realCompletionRate: { status: 'pass', value: 92.96, unit: '%', sourceRefs: [] },
      publicCompleted: { status: 'warn', value: 125, sourceRefs: [] },
      publicCompletionRate: { status: 'warn', value: 88, unit: '%', sourceRefs: [] },
      declaredCompleted: { status: 'warn', value: 132, sourceRefs: [] },
      declaredCompletionRate: { status: 'warn', value: 93, unit: '%', sourceRefs: [] },
      deltaPublicVsReal: { status: 'warn', value: -4.96, unit: 'pts', sourceRefs: [] },
      remainingTasks: { status: 'blocked', value: 10, sourceRefs: [] },
      blockerTasks: { status: 'blocked', value: 10, sourceRefs: [] },
      lastUpdated: { status: 'neutral', value: '2026-06-23', sourceRefs: [] },
      overallGrade: { status: 'neutral', value: 'B+ / 82', sourceRefs: [] },
      discrepancies: { status: 'warn', value: 3, sourceRefs: [] },
    },
    milestones: {
      order: ['M0'],
      items: [
        {
          id: 'M0',
          title: '项目脚手架',
          totalTasks: 2,
          computedCounts: {
            complete: 1,
            inProgress: 0,
            notStarted: 1,
            blocked: 0,
            skipped: 0,
            removed: 0,
            remaining: 1,
          },
          declaredCounts: {
            complete: 2,
            inProgress: 0,
            notStarted: 0,
            blocked: 0,
          },
          computedProgress: 50,
          declaredProgress: 100,
          publicProgress: 100,
          tasks: [
            { id: 'M0-01', title: '初始化', status: 'complete', rawStatus: '✅', sourceRefs: [] },
            { id: 'M0-02', title: '收尾', status: 'not_started', rawStatus: '⬜', sourceRefs: [] },
          ],
          sourceRefs: [],
        },
      ],
      timeline: [{ date: '2026-06-13', completedTasks: 1, sourceRefs: [] }],
    },
    qualityGates: {
      gates: [{ id: 'L1', title: 'TS 编译', status: 'pass', summary: '通过', sourceRefs: [] }],
      testCounts: {
        progressDoc: { files: 25, tests: 746 },
        audited: { files: 36, tests: 1204, failed: 0, durationSeconds: 3.53 },
        delta: { files: 11, tests: 458 },
      },
      e2eCoverage: {
        matchedFiles: 1,
        totalFiles: 5,
        matchedLines: 469,
        totalLines: 2298,
        excludedLines: 1829,
        coverageRatio: 20.4,
        sourceRefs: [],
      },
    },
    findings: {
      total: 2,
      bySeverity: [{ severity: 'CRITICAL', count: 1 }, { severity: 'HIGH', count: 1 }],
      byCategory: [{ category: 'Config', count: 2 }],
      recommendations: [{ priority: 'P0', items: [{ id: 'C1', action: '修复配置', effort: 1 }] }],
      top: [],
    },
    contradictions: {
      total: 1,
      items: [
        {
          id: 'X1',
          severity: 'critical',
          description: 'overview 与 detail 冲突',
          location: 'spec/progress.md:L15',
          sourceRefs: [],
        },
      ],
    },
    discrepancies: [
      {
        id: 'discrepancy-readme-total',
        area: 'summary',
        title: 'README total mismatch',
        severity: 'critical',
        declared: 125,
        computed: 132,
        unit: 'tasks',
        summary: 'mismatch',
        sourceRefs: [],
      },
    ],
    e2e: {
      configStatus: 'fail',
      matchedFiles: 1,
      totalFiles: 5,
      matchedLines: 469,
      totalLines: 2298,
      deadCodeLines: 1829,
      files: [{ name: 'branch-graph.spec.ts', lines: 100, matchedByConfig: false }],
    },
    journey: {
      storyStats: {
        totalNodes: 59,
        totalOptions: 102,
        totalConditions: 11,
        totalEffects: 54,
        chapters: 5,
        variables: 8,
        inputSizeChars: 7132,
        inputSizeLines: 668,
        parseTimeMs: 6.52,
        crossChapterReferences: 21,
      },
      chapters: [{ id: '第一章', nodes: 24, conditions: 5, effects: 26 }],
      variableTypes: [{ type: 'int', count: 4 }],
      checkpoints: [{ id: 'open', status: 'pass', description: 'ok' }],
      readiness: [{ area: 'parser', status: 'pass', detail: 'ready' }],
    },
    performance: {
      benchmarks: [
        {
          id: '1',
          name: 'Parse',
          type: 'measured',
          targetValue: 100,
          actualValue: 50,
          unit: 'ms',
          verdict: 'pass',
        },
      ],
      summary: {
        totalBenchmarks: 1,
        pass: 1,
        fail: 0,
        passRate: 100,
        criticalIssues: 0,
        criticalIssue: 'none',
        overallAssessment: 'good',
      },
      bottlenecks: [],
      recommendations: [],
    },
    sourceHealth: {
      sources: [
        {
          id: 'progress',
          label: 'Current status detail',
          path: 'spec/progress.md',
          status: 'warn',
          lastUpdated: '2026-06-23',
          discrepancyCount: 2,
          missingFields: [],
          notes: ['总览表仅作声明值展示'],
        },
      ],
    },
    provenance: {
      sourcePriority: ['spec/progress.md'],
      mappings: [{ metric: 'summary.realCompletionRate', sourceRefs: [{ path: 'spec/progress.md', kind: 'markdown', confidence: 'high' }] }],
    },
  };
}

describe('dashboard render smoke', () => {
  it('renders with complete data', () => {
    const html = renderToStaticMarkup(<DashboardApp initialData={createSampleData()} />);

    expect(html).toContain('PlotFlow Engineering Dashboard');
    expect(html).toContain('真实完成率');
    expect(html).toContain('里程碑推进');
  });

  it('renders when values are missing', () => {
    const sample = createSampleData();
    sample.summary.publicCompletionRate.value = null;
    sample.summary.publicCompleted.value = null;
    sample.summary.overallGrade.value = null;

    const html = renderToStaticMarkup(<DashboardApp initialData={sample} />);

    expect(html).toContain('unknown / unavailable');
    expect(html).toContain('公开口径');
  });

  it('renders conflict state without crashing', () => {
    const sample = createSampleData();
    sample.discrepancies.push({
      id: 'discrepancy-progress-total',
      area: 'summary',
      title: 'progress mismatch',
      severity: 'critical',
      declared: 111,
      computed: 132,
      unit: 'tasks',
      summary: 'conflict',
      sourceRefs: [],
    });

    const html = renderToStaticMarkup(<DashboardApp initialData={sample} />);

    expect(html).toContain('Discrepancy Alert');
    expect(html).toContain('声明值与明细/实测值存在冲突');
  });
});
