export type MetricStatus =
  | 'pass'
  | 'warn'
  | 'fail'
  | 'blocked'
  | 'neutral'
  | 'unknown';

export type TaskStatus =
  | 'complete'
  | 'in_progress'
  | 'not_started'
  | 'blocked'
  | 'skipped'
  | 'removed'
  | 'unknown';

export type SourceKind = 'markdown' | 'json' | 'generated' | 'runtime';

export interface SourceRef {
  path: string;
  line?: number;
  range?: string;
  kind: SourceKind;
  capturedAt?: string;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export interface MetricValue<T = number | string | null> {
  status: MetricStatus;
  value: T;
  target?: number | string | null;
  unit?: string;
  sourceRefs: SourceRef[];
  capturedAt?: string;
  label?: string;
}

export interface MilestoneCounts {
  complete: number;
  inProgress: number;
  notStarted: number;
  blocked: number;
  skipped: number;
  removed: number;
  remaining: number;
}

export interface MilestoneTask {
  id: string;
  title: string;
  status: TaskStatus;
  rawStatus: string;
  startedAt?: string;
  completedAt?: string;
  note?: string;
  sourceRefs: SourceRef[];
}

export interface MilestoneProgress {
  id: string;
  title: string;
  totalTasks: number;
  computedCounts: MilestoneCounts;
  declaredCounts?: Partial<MilestoneCounts>;
  computedProgress: number;
  declaredProgress?: number | null;
  publicProgress?: number | null;
  tasks: MilestoneTask[];
  sourceRefs: SourceRef[];
}

export interface DiscrepancyRecord {
  id: string;
  area: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  declared: number | string | null;
  computed: number | string | null;
  measured?: number | string | null;
  unit?: string;
  summary: string;
  sourceRefs: SourceRef[];
}

export interface QualityGate {
  id: string;
  title: string;
  status: MetricStatus;
  summary: string;
  metric?: MetricValue<number | string>;
  sourceRefs: SourceRef[];
}

export interface FindingRecord {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  title: string;
  file?: string | null;
  line?: number | string | null;
  status: string;
  detail: string;
  priority?: string;
  effortMinutes?: number | string | null;
  sourceRefs: SourceRef[];
}

export interface PerformanceBenchmark {
  id: string;
  name: string;
  type: 'measured' | 'estimated' | 'unknown';
  targetValue: number | null;
  actualValue: number | null;
  unit: 'ms' | 'fps' | 'mb' | 's' | 'count';
  verdict: MetricStatus;
  detail?: string;
  methodology?: string;
}

export interface SourceHealthRecord {
  id: string;
  label: string;
  path: string;
  status: MetricStatus;
  lastUpdated?: string;
  discrepancyCount: number;
  missingFields: string[];
  notes: string[];
}

export interface ProvenanceMapping {
  metric: string;
  sourceRefs: SourceRef[];
}

export interface DashboardData {
  meta: {
    projectName: string;
    schemaVersion: string;
    generatedAt: string;
    repoRoot: string;
  };
  summary: {
    totalTasks: MetricValue<number>;
    realCompleted: MetricValue<number>;
    realCompletionRate: MetricValue<number>;
    publicCompleted: MetricValue<number | null>;
    publicCompletionRate: MetricValue<number | null>;
    declaredCompleted: MetricValue<number | null>;
    declaredCompletionRate: MetricValue<number | null>;
    deltaPublicVsReal: MetricValue<number | null>;
    remainingTasks: MetricValue<number>;
    blockerTasks: MetricValue<number>;
    lastUpdated: MetricValue<string | null>;
    overallGrade: MetricValue<string | null>;
    discrepancies: MetricValue<number>;
  };
  milestones: {
    order: string[];
    items: MilestoneProgress[];
    timeline: Array<{
      date: string;
      completedTasks: number;
      sourceRefs: SourceRef[];
    }>;
  };
  qualityGates: {
    gates: QualityGate[];
    testCounts: {
      progressDoc?: { files: number; tests: number };
      audited?: { files: number; tests: number; failed?: number; durationSeconds?: number };
      delta?: { files: number; tests: number };
    };
    e2eCoverage: {
      matchedFiles: number;
      totalFiles: number;
      matchedLines: number;
      totalLines: number;
      excludedLines: number;
      coverageRatio: number;
      sourceRefs: SourceRef[];
    };
  };
  findings: {
    total: number;
    bySeverity: Array<{ severity: string; count: number }>;
    byCategory: Array<{ category: string; count: number }>;
    recommendations: Array<{ priority: string; items: Array<{ id: string; action: string; effort?: number | string }> }>;
    top: FindingRecord[];
  };
  contradictions: {
    total: number;
    items: Array<{
      id: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
      location: string;
      sourceRefs: SourceRef[];
    }>;
  };
  discrepancies: DiscrepancyRecord[];
  e2e: {
    configStatus: MetricStatus;
    matchedFiles: number;
    totalFiles: number;
    matchedLines: number;
    totalLines: number;
    deadCodeLines: number;
    files: Array<{ name: string; lines: number; matchedByConfig: boolean }>;
  };
  journey: {
    storyStats: {
      totalNodes: number;
      totalOptions: number;
      totalConditions: number;
      totalEffects: number;
      chapters: number;
      variables: number;
      inputSizeChars: number;
      inputSizeLines: number;
      parseTimeMs: number;
      crossChapterReferences: number;
    };
    chapters: Array<{ id: string; nodes: number; conditions: number; effects: number }>;
    variableTypes: Array<{ type: string; count: number }>;
    checkpoints: Array<{ id: string; status: MetricStatus; description: string }>;
    readiness: Array<{ area: string; status: MetricStatus; detail: string }>;
  };
  performance: {
    benchmarks: PerformanceBenchmark[];
    summary: {
      totalBenchmarks: number;
      pass: number;
      fail: number;
      passRate: number;
      criticalIssues: number;
      criticalIssue: string;
      overallAssessment: string;
    };
    bottlenecks: Array<{
      rank: string;
      component: string;
      severity: string;
      currentMs: number;
      targetMs: number;
      excessPercent: number;
      impact: string;
      fix: string;
    }>;
    recommendations: Array<{
      priority: string;
      action: string;
      detail: string;
      effort: string;
      impact: string;
    }>;
  };
  sourceHealth: {
    sources: SourceHealthRecord[];
  };
  provenance: {
    sourcePriority: string[];
    mappings: ProvenanceMapping[];
  };
}

export type DashboardModuleId =
  | 'overview'
  | 'milestones'
  | 'quality'
  | 'audit'
  | 'performance'
  | 'journey'
  | 'integrity';

export interface DashboardConfig {
  defaultTheme: 'light' | 'dark';
  defaultDensity: 'compact' | 'comfortable';
  moduleOrder: DashboardModuleId[];
  emphasizedKpis: Array<
    | 'realCompletionRate'
    | 'publicCompletionRate'
    | 'remainingTasks'
    | 'blockerTasks'
    | 'overallGrade'
    | 'discrepancies'
  >;
  thresholds: {
    progressHealthy: number;
    blockerWarn: number;
    discrepancyWarn: number;
    coverageWarn: number;
    passRateHealthy: number;
  };
  chartVisibility: {
    milestoneHeatmap: boolean;
    milestoneTimeline: boolean;
    severityDistribution: boolean;
    categoryDistribution: boolean;
    checkpointMatrix: boolean;
    sourceHealth: boolean;
  };
  labels: {
    dashboardTitle: string;
    dashboardSubtitle: string;
    discrepancyBanner: string;
    unknownValue: string;
    milestoneFocusAll: string;
  };
  sourcePriority: string[];
}
