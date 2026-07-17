import type { DashboardConfig } from '../types/dashboard';

export const defaultDashboardConfig: DashboardConfig = {
  defaultTheme: 'light',
  defaultDensity: 'compact',
  moduleOrder: [
    'overview',
    'milestones',
    'quality',
    'audit',
    'performance',
    'journey',
    'integrity',
  ],
  emphasizedKpis: [
    'realCompletionRate',
    'publicCompletionRate',
    'remainingTasks',
    'blockerTasks',
    'overallGrade',
    'discrepancies',
  ],
  thresholds: {
    progressHealthy: 90,
    blockerWarn: 5,
    discrepancyWarn: 1,
    coverageWarn: 80,
    passRateHealthy: 85,
  },
  chartVisibility: {
    milestoneHeatmap: true,
    milestoneTimeline: true,
    severityDistribution: true,
    categoryDistribution: true,
    checkpointMatrix: true,
    sourceHealth: true,
  },
  labels: {
    dashboardTitle: 'Fablevia Engineering Dashboard',
    dashboardSubtitle: '工程作战室 / Progress, Risk, Readiness',
    discrepancyBanner: '文档声明值与明细/实测值存在冲突，页面已按重算结果展示。',
    unknownValue: 'unknown / unavailable',
    milestoneFocusAll: '全部里程碑',
  },
  sourcePriority: [
    'spec/milestones.md',
    'spec/progress.md',
    'spec/audit/pass1-data.json',
    'scripts/output/journey-report.json',
    'scripts/benchmark/perf-report.json',
    'README.md',
    'packages/app/test-results/.last-run.json',
  ],
};
