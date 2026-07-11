import { useEffect, useMemo, useState } from 'react';
import { defaultDashboardConfig } from './config/defaultDashboardConfig';
import { MetricCard } from './components/MetricCard';
import { Section } from './components/Section';
import {
  DistributionBars,
  RatioBar,
  StackedStatusBar,
  StatusMatrix,
  TaskHeatmap,
  TimelineBars,
} from './components/SimpleCharts';
import { StatusBadge } from './components/StatusBadge';
import { TweaksPanel } from './components/TweaksPanel';
import type {
  DashboardConfig,
  DashboardData,
  DashboardModuleId,
  MetricStatus,
} from './types/dashboard';

const UNKNOWN_VALUE_LABEL = defaultDashboardConfig.labels.unknownValue;

interface DashboardAppProps {
  initialData?: DashboardData;
  config?: DashboardConfig;
}

function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return UNKNOWN_VALUE_LABEL;
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function formatMetric(value: number | string | null | undefined, unit?: string): string {
  if (typeof value === 'number') {
    return unit === '%' || unit === 'pts'
      ? `${formatNumber(value, 2)}${unit}`
      : unit
        ? `${formatNumber(value)} ${unit}`
        : formatNumber(value);
  }

  if (value === null || value === undefined || value === '') {
    return UNKNOWN_VALUE_LABEL;
  }

  return String(value);
}

function moduleCopy(): Record<DashboardModuleId, { eyebrow: string; title: string; description: string }> {
  return {
    overview: {
      eyebrow: 'Command View',
      title: '总览',
      description: '优先回答真实进度、公开口径偏差、剩余工作和当前阻断。',
    },
    milestones: {
      eyebrow: 'Milestones',
      title: '里程碑推进',
      description: '总览声明值仅保留作对比，图表全部按明细任务重算。',
    },
    quality: {
      eyebrow: 'Quality Gates',
      title: '质量门禁',
      description: '把 L1-L4、测试增量和 E2E 覆盖缺口放在同一个操作面里。',
    },
    audit: {
      eyebrow: 'Audit Risk',
      title: '审计风险',
      description: '展示严重级别、类别分布、contradictions 和修复优先级。',
    },
    performance: {
      eyebrow: 'Performance',
      title: '性能基线',
      description: '所有 target vs actual 区分估算值和实测值，不混写。',
    },
    journey: {
      eyebrow: 'Complex Story',
      title: '复杂故事演练',
      description: '从复杂故事旅程视角看 parser / graph / exporter readiness。',
    },
    integrity: {
      eyebrow: 'Data Integrity',
      title: '数据完整性',
      description: '每个来源的解析状态、冲突数和当前映射全部暴露出来。',
    },
  };
}

function kpiStatus(status: MetricStatus): MetricStatus {
  return status;
}

function filterByDiscrepancy<T extends { id: string }>(
  items: T[],
  enabled: boolean,
  discrepancyIds: Set<string>,
): T[] {
  if (!enabled) return items;
  return items.filter((item) => discrepancyIds.has(item.id));
}

export function DashboardApp({
  initialData,
  config = defaultDashboardConfig,
}: DashboardAppProps): JSX.Element {
  const [data, setData] = useState<DashboardData | null>(initialData ?? null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(config.defaultTheme);
  const [density, setDensity] = useState<'compact' | 'comfortable'>(config.defaultDensity);
  const [milestoneFocus, setMilestoneFocus] = useState<string>('all');
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (initialData) return;

    let active = true;

    void fetch('/dashboard-data.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load dashboard-data.json (${response.status})`);
        }

        return response.json() as Promise<DashboardData>;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload);
      })
      .catch((fetchError) => {
        if (!active) return;
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      });

    return () => {
      active = false;
    };
  }, [initialData]);

  const copy = moduleCopy();

  const discrepancyIds = useMemo(
    () => new Set((data?.discrepancies ?? []).map((item) => item.id)),
    [data],
  );

  const milestoneOptions = useMemo(
    () => [
      { value: 'all', label: config.labels.milestoneFocusAll },
      ...(data?.milestones.items ?? []).map((item) => ({
        value: item.id,
        label: `${item.id} · ${item.title}`,
      })),
    ],
    [config.labels.milestoneFocusAll, data?.milestones.items],
  );

  const milestoneItems = useMemo(() => {
    const items = data?.milestones.items ?? [];
    if (milestoneFocus === 'all') return items;
    return items.filter((item) => item.id === milestoneFocus);
  }, [data?.milestones.items, milestoneFocus]);

  const navSections = config.moduleOrder.map((moduleId) => ({
    id: moduleId,
    title: copy[moduleId].title,
  }));

  if (error) {
    return (
      <main className="dashboard-shell">
        <div className="state-panel">
          <p className="state-panel__eyebrow">Load Failure</p>
          <h1>驾驶舱数据加载失败</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="dashboard-shell">
        <div className="state-panel">
          <p className="state-panel__eyebrow">Loading</p>
          <h1>正在装载 PlotFlow 工程驾驶舱</h1>
          <p>等待 `dashboard-data.json`。</p>
        </div>
      </main>
    );
  }

  const summaryCards = config.emphasizedKpis.map((key) => {
    if (key === 'realCompletionRate') {
      return (
        <MetricCard
          key={key}
          label="真实完成率"
          status={kpiStatus(data.summary.realCompletionRate.status)}
          value={formatMetric(data.summary.realCompletionRate.value, '%')}
          hint={`${formatMetric(data.summary.realCompleted.value)} / ${formatMetric(data.summary.totalTasks.value)}`}
        />
      );
    }

    if (key === 'publicCompletionRate') {
      return (
        <MetricCard
          key={key}
          label="公开口径"
          status={kpiStatus(data.summary.publicCompletionRate.status)}
          value={formatMetric(data.summary.publicCompletionRate.value, '%')}
          hint={`${formatMetric(data.summary.publicCompleted.value)} / ${formatMetric(data.summary.totalTasks.value)}`}
        />
      );
    }

    if (key === 'remainingTasks') {
      return (
        <MetricCard
          key={key}
          label="剩余任务"
          status={kpiStatus(data.summary.remainingTasks.status)}
          value={formatMetric(data.summary.remainingTasks.value)}
          hint="按 detail 重算"
        />
      );
    }

    if (key === 'blockerTasks') {
      return (
        <MetricCard
          key={key}
          label="当前阻断"
          status={kpiStatus(data.summary.blockerTasks.status)}
          value={formatMetric(data.summary.blockerTasks.value)}
          hint="来自 progress 阻塞项"
        />
      );
    }

    if (key === 'overallGrade') {
      return (
        <MetricCard
          key={key}
          label="整体评分"
          status={kpiStatus(data.summary.overallGrade.status)}
          value={formatMetric(data.summary.overallGrade.value)}
          hint="Pass 1 audit"
        />
      );
    }

    return (
      <MetricCard
        key={key}
        label="Discrepancies"
        status={kpiStatus(data.summary.discrepancies.status)}
        value={formatMetric(data.summary.discrepancies.value)}
        hint="声明值 vs 明细/实测"
      />
    );
  });

  const findingSeverityItems = filterByDiscrepancy(
    data.findings.bySeverity.map((item) => ({
      id: item.severity,
      label: item.severity,
      value: item.count,
      status: (item.severity === 'CRITICAL'
        ? 'fail'
        : item.severity === 'HIGH'
          ? 'blocked'
          : item.severity === 'MEDIUM'
            ? 'warn'
            : 'neutral') as MetricStatus,
    })),
    discrepancyOnly,
    discrepancyIds,
  );

  const contradictionItems = data.contradictions.items;

  return (
    <main className="dashboard-shell" data-density={density}>
      <header className="dashboard-hero">
        <div className="dashboard-hero__copy">
          <p className="dashboard-hero__eyebrow">PlotFlow / Internal Operations</p>
          <h1>{config.labels.dashboardTitle}</h1>
          <p className="dashboard-hero__subtitle">{config.labels.dashboardSubtitle}</p>
          <div className="dashboard-hero__meta">
            <span>Generated {formatMetric(data.meta.generatedAt)}</span>
            <span>Last updated {formatMetric(data.summary.lastUpdated.value)}</span>
            <span>Schema {data.meta.schemaVersion}</span>
          </div>
        </div>
        <TweaksPanel
          theme={theme}
          density={density}
          milestoneFocus={milestoneFocus}
          discrepancyOnly={discrepancyOnly}
          milestoneOptions={milestoneOptions}
          onThemeChange={setTheme}
          onDensityChange={setDensity}
          onMilestoneChange={setMilestoneFocus}
          onDiscrepancyOnlyChange={setDiscrepancyOnly}
        />
      </header>

      <div className="dashboard-layout">
        <nav className="dashboard-nav">
          {navSections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="dashboard-nav__link">
              {section.title}
            </a>
          ))}
        </nav>

        <div className="dashboard-content">
          <Section
            id="overview"
            eyebrow={copy.overview.eyebrow}
            title={copy.overview.title}
            description={copy.overview.description}
          >
            {data.discrepancies.length > 0 ? (
              <div className="alert-banner">
                <strong>Discrepancy Alert</strong>
                <p>{config.labels.discrepancyBanner}</p>
              </div>
            ) : null}

            <div className="metrics-grid">{summaryCards}</div>

            <div className="two-column">
              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>真实值 vs 公开口径</h3>
                  <StatusBadge status={data.summary.deltaPublicVsReal.status} />
                </div>
                <div className="progress-compare">
                  <div>
                    <span>真实完成率</span>
                    <strong>{formatMetric(data.summary.realCompletionRate.value, '%')}</strong>
                  </div>
                  <div>
                    <span>README 公开口径</span>
                    <strong>{formatMetric(data.summary.publicCompletionRate.value, '%')}</strong>
                  </div>
                  <div>
                    <span>Delta</span>
                    <strong>{formatMetric(data.summary.deltaPublicVsReal.value, 'pts')}</strong>
                  </div>
                </div>
              </article>

              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>当前关键事实</h3>
                </div>
                <ul className="signal-list">
                  <li>真实完成值来自 `spec/progress.md` 任务明细重算。</li>
                  <li>公开口径来自 `README.md`，仅作对外声明保留。</li>
                  <li>任务全集与分母来自 `spec/milestones.md`。</li>
                  <li>质量、风险、性能直接来自审计与 benchmark JSON。</li>
                </ul>
              </article>
            </div>
          </Section>

          <Section
            id="milestones"
            eyebrow={copy.milestones.eyebrow}
            title={copy.milestones.title}
            description={copy.milestones.description}
          >
            <div className="milestone-grid">
              {milestoneItems.map((milestone) => (
                <article key={milestone.id} className="milestone-card">
                  <div className="milestone-card__header">
                    <div>
                      <p className="milestone-card__eyebrow">{milestone.id}</p>
                      <h3>{milestone.title}</h3>
                    </div>
                    <StatusBadge
                      status={
                        milestone.computedCounts.remaining === 0
                          ? 'pass'
                          : milestone.computedCounts.blocked > 0
                            ? 'blocked'
                            : 'warn'
                      }
                    />
                  </div>
                  <p className="milestone-card__progress">
                    重算 {formatMetric(milestone.computedProgress, '%')}
                    <span> / 声明 {formatMetric(milestone.declaredProgress, '%')}</span>
                    <span> / README {formatMetric(milestone.publicProgress, '%')}</span>
                  </p>
                  <StackedStatusBar milestone={milestone} />
                </article>
              ))}
            </div>

            {config.chartVisibility.milestoneHeatmap ? (
              <TaskHeatmap milestones={milestoneItems} />
            ) : null}

            {config.chartVisibility.milestoneTimeline ? (
              <TimelineBars items={data.milestones.timeline} />
            ) : null}
          </Section>

          <Section
            id="quality"
            eyebrow={copy.quality.eyebrow}
            title={copy.quality.title}
            description={copy.quality.description}
          >
            <StatusMatrix
              items={data.qualityGates.gates.map((gate) => ({
                id: gate.id,
                label: gate.title,
                description: gate.summary,
                status: gate.status,
              }))}
            />

            <div className="three-column">
              <MetricCard
                label="基线测试"
                status="neutral"
                value={formatMetric(data.qualityGates.testCounts.progressDoc?.tests ?? null)}
                hint={`${formatMetric(data.qualityGates.testCounts.progressDoc?.files ?? null)} files`}
              />
              <MetricCard
                label="审计实测"
                status="pass"
                value={formatMetric(data.qualityGates.testCounts.audited?.tests ?? null)}
                hint={`${formatMetric(data.qualityGates.testCounts.audited?.files ?? null)} files`}
              />
              <MetricCard
                label="测试增量"
                status="warn"
                value={formatMetric(data.qualityGates.testCounts.delta?.tests ?? null)}
                hint={`${formatMetric(data.qualityGates.testCounts.delta?.files ?? null)} files`}
              />
            </div>

            <RatioBar
              label="E2E 配置覆盖率"
              value={data.qualityGates.e2eCoverage.matchedLines}
              total={data.qualityGates.e2eCoverage.totalLines}
              detail={`${data.qualityGates.e2eCoverage.matchedFiles}/${data.qualityGates.e2eCoverage.totalFiles} files matched, ${data.qualityGates.e2eCoverage.excludedLines} lines excluded`}
              status={data.qualityGates.e2eCoverage.coverageRatio >= config.thresholds.coverageWarn ? 'pass' : 'warn'}
            />

            <div className="e2e-table">
              {data.e2e.files.map((file) => (
                <div key={file.name} className="e2e-table__row">
                  <div>
                    <strong>{file.name}</strong>
                    <p>{file.lines} lines</p>
                  </div>
                  <StatusBadge status={file.matchedByConfig ? 'pass' : 'fail'} />
                </div>
              ))}
            </div>
          </Section>

          <Section
            id="audit"
            eyebrow={copy.audit.eyebrow}
            title={copy.audit.title}
            description={copy.audit.description}
          >
            <div className="two-column">
              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>严重级别分布</h3>
                </div>
                <DistributionBars items={findingSeverityItems} />
              </article>

              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>类别分布</h3>
                </div>
                <DistributionBars
                  items={data.findings.byCategory.map((item) => ({
                    label: item.category,
                    value: item.count,
                  }))}
                />
              </article>
            </div>

            <div className="two-column">
              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>Contradictions</h3>
                  <StatusBadge status={contradictionItems.length > 0 ? 'warn' : 'pass'} />
                </div>
                <div className="issue-list">
                  {contradictionItems.map((item) => (
                    <article key={item.id} className="issue-list__item">
                      <div className="issue-list__topline">
                        <strong>{item.id}</strong>
                        <StatusBadge status={item.severity === 'critical' ? 'fail' : item.severity === 'high' ? 'blocked' : 'warn'} />
                      </div>
                      <p>{item.description}</p>
                      <code>{item.location}</code>
                    </article>
                  ))}
                </div>
              </article>

              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>P0 / P1 / P2 修复建议</h3>
                </div>
                <div className="issue-list">
                  {data.findings.recommendations.map((group) => (
                    <article key={group.priority} className="issue-list__item">
                      <div className="issue-list__topline">
                        <strong>{group.priority}</strong>
                        <span>{group.items.length} actions</span>
                      </div>
                      <ul className="signal-list">
                        {group.items.map((item) => (
                          <li key={item.id}>
                            {item.id} · {item.action}
                            {item.effort ? ` · ${item.effort}` : ''}
                          </li>
                        ))}
                      </ul>
                    </article>
                  ))}
                </div>
              </article>
            </div>
          </Section>

          <Section
            id="performance"
            eyebrow={copy.performance.eyebrow}
            title={copy.performance.title}
            description={copy.performance.description}
          >
            <div className="benchmark-grid">
              {data.performance.benchmarks.map((benchmark) => (
                <article key={benchmark.id} className="benchmark-card">
                  <div className="benchmark-card__topline">
                    <strong>{benchmark.name}</strong>
                    <StatusBadge status={benchmark.verdict} />
                  </div>
                  <p className="benchmark-card__value">
                    {formatMetric(benchmark.actualValue, benchmark.unit)}
                    <span> / target {formatMetric(benchmark.targetValue, benchmark.unit)}</span>
                  </p>
                  <p className="benchmark-card__detail">{benchmark.detail}</p>
                  <p className="benchmark-card__meta">{benchmark.type}</p>
                </article>
              ))}
            </div>

            <div className="two-column">
              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>瓶颈排序</h3>
                </div>
                <DistributionBars
                  items={data.performance.bottlenecks.map((item) => ({
                    label: item.component,
                    value: item.excessPercent,
                    meta: `${item.currentMs}ms vs ${item.targetMs}ms`,
                    status: item.severity.includes('P0') ? 'fail' : item.severity.includes('P1') ? 'warn' : 'neutral',
                  }))}
                  formatValue={(value) => `${formatNumber(value)}%`}
                />
              </article>

              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>优先级建议</h3>
                </div>
                <div className="issue-list">
                  {data.performance.recommendations.map((item) => (
                    <article key={item.action} className="issue-list__item">
                      <div className="issue-list__topline">
                        <strong>{item.priority}</strong>
                        <span>{item.effort}</span>
                      </div>
                      <p>{item.action}</p>
                      <small>{item.impact}</small>
                    </article>
                  ))}
                </div>
              </article>
            </div>
          </Section>

          <Section
            id="journey"
            eyebrow={copy.journey.eyebrow}
            title={copy.journey.title}
            description={copy.journey.description}
          >
            <div className="metrics-grid">
              <MetricCard label="节点" status="pass" value={formatMetric(data.journey.storyStats.totalNodes)} />
              <MetricCard label="选项" status="pass" value={formatMetric(data.journey.storyStats.totalOptions)} />
              <MetricCard label="条件" status="warn" value={formatMetric(data.journey.storyStats.totalConditions)} />
              <MetricCard label="效果" status="warn" value={formatMetric(data.journey.storyStats.totalEffects)} />
              <MetricCard label="解析耗时" status="pass" value={formatMetric(data.journey.storyStats.parseTimeMs, 'ms')} />
              <MetricCard label="跨章节引用" status="neutral" value={formatMetric(data.journey.storyStats.crossChapterReferences)} />
            </div>

            <div className="two-column">
              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>章节负载分布</h3>
                </div>
                <DistributionBars
                  items={data.journey.chapters.map((chapter) => ({
                    label: chapter.id,
                    value: chapter.nodes,
                    meta: `${chapter.conditions} cond / ${chapter.effects} fx`,
                  }))}
                />
              </article>

              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>变量类型分布</h3>
                </div>
                <DistributionBars items={data.journey.variableTypes.map((item) => ({ label: item.type, value: item.count }))} />
              </article>
            </div>

            <StatusMatrix
              items={data.journey.checkpoints.map((checkpoint) => ({
                id: checkpoint.id,
                label: checkpoint.id,
                description: checkpoint.description,
                status: checkpoint.status,
              }))}
            />

            <div className="two-column">
              <article className="surface-panel">
                <div className="surface-panel__header">
                  <h3>Readiness</h3>
                </div>
                <div className="issue-list">
                  {data.journey.readiness.map((item) => (
                    <article key={item.area} className="issue-list__item">
                      <div className="issue-list__topline">
                        <strong>{item.area}</strong>
                        <StatusBadge status={item.status} />
                      </div>
                      <p>{item.detail}</p>
                    </article>
                  ))}
                </div>
              </article>
            </div>
          </Section>

          <Section
            id="integrity"
            eyebrow={copy.integrity.eyebrow}
            title={copy.integrity.title}
            description={copy.integrity.description}
          >
            <div className="source-grid">
              {data.sourceHealth.sources.map((source) => (
                <article key={source.id} className="source-card">
                  <div className="source-card__topline">
                    <div>
                      <strong>{source.label}</strong>
                      <p>{source.path}</p>
                    </div>
                    <StatusBadge status={source.status} />
                  </div>
                  <div className="source-card__meta">
                    <span>Updated {formatMetric(source.lastUpdated)}</span>
                    <span>{source.discrepancyCount} discrepancies</span>
                  </div>
                  {source.missingFields.length > 0 ? (
                    <p className="source-card__warning">
                      Missing: {source.missingFields.join(', ')}
                    </p>
                  ) : null}
                  <ul className="signal-list">
                    {source.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <article className="surface-panel">
              <div className="surface-panel__header">
                <h3>当前来源映射</h3>
              </div>
              <div className="mapping-table">
                {data.provenance.mappings.map((mapping) => (
                  <div key={mapping.metric} className="mapping-table__row">
                    <strong>{mapping.metric}</strong>
                    <div className="mapping-table__refs">
                      {mapping.sourceRefs.map((ref) => (
                        <code key={`${mapping.metric}-${ref.path}`}>{ref.path}</code>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </Section>
        </div>
      </div>
    </main>
  );
}
