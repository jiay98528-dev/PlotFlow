import type { ReactNode } from 'react';
import type {
  MetricStatus,
  MilestoneProgress,
  TaskStatus,
} from '../types/dashboard';
import { StatusBadge } from './StatusBadge';

const TASK_SEGMENTS: Array<{
  key: keyof MilestoneProgress['computedCounts'];
  label: string;
  className: string;
}> = [
  { key: 'complete', label: '完成', className: 'bar-segment--complete' },
  { key: 'inProgress', label: '进行中', className: 'bar-segment--in-progress' },
  { key: 'blocked', label: '阻塞', className: 'bar-segment--blocked' },
  { key: 'skipped', label: '延后', className: 'bar-segment--skipped' },
  { key: 'notStarted', label: '未开始', className: 'bar-segment--not-started' },
  { key: 'removed', label: '移除', className: 'bar-segment--removed' },
];

const TASK_CLASS: Record<TaskStatus, string> = {
  complete: 'task-cell--complete',
  in_progress: 'task-cell--in-progress',
  not_started: 'task-cell--not-started',
  blocked: 'task-cell--blocked',
  skipped: 'task-cell--skipped',
  removed: 'task-cell--removed',
  unknown: 'task-cell--unknown',
};

const METRIC_CLASS: Record<MetricStatus, string> = {
  pass: 'status-track--pass',
  warn: 'status-track--warn',
  fail: 'status-track--fail',
  blocked: 'status-track--blocked',
  neutral: 'status-track--neutral',
  unknown: 'status-track--unknown',
};

interface DistributionItem {
  label: string;
  value: number;
  meta?: string;
  status?: MetricStatus;
}

export function StackedStatusBar({ milestone }: { milestone: MilestoneProgress }): ReactNode {
  const total = milestone.totalTasks;

  return (
    <div className="stacked-bar">
      <div className="stacked-bar__track" aria-hidden="true">
        {TASK_SEGMENTS.map((segment) => {
          const value = milestone.computedCounts[segment.key];
          if (!value) return null;

          return (
            <span
              key={segment.key}
              className={`bar-segment ${segment.className}`}
              style={{ width: `${(value / total) * 100}%` }}
              title={`${segment.label}: ${value}`}
            />
          );
        })}
      </div>
      <div className="stacked-bar__legend">
        {TASK_SEGMENTS.map((segment) => {
          const value = milestone.computedCounts[segment.key];
          if (!value) return null;

          return (
            <span key={segment.key} className="legend-chip">
              <span className={`legend-chip__swatch ${segment.className}`} />
              {segment.label} {value}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function DistributionBars({
  items,
  formatValue,
}: {
  items: DistributionItem[];
  formatValue?: (value: number) => string;
}): ReactNode {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="distribution-list">
      {items.map((item) => (
        <div key={item.label} className="distribution-row">
          <div className="distribution-row__copy">
            <strong>{item.label}</strong>
            {item.meta ? <span>{item.meta}</span> : null}
          </div>
          <div className="distribution-row__bar">
            <div
              className={`distribution-row__fill ${item.status ? METRIC_CLASS[item.status] : ''}`}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="distribution-row__value">
            {formatValue ? formatValue(item.value) : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TimelineBars({
  items,
}: {
  items: Array<{ date: string; completedTasks: number }>;
}): ReactNode {
  const max = Math.max(...items.map((item) => item.completedTasks), 1);

  return (
    <div className="timeline-bars">
      {items.map((item) => (
        <article key={item.date} className="timeline-bars__item">
          <p className="timeline-bars__date">{item.date}</p>
          <div className="timeline-bars__track">
            <div
              className="timeline-bars__fill"
              style={{ width: `${(item.completedTasks / max) * 100}%` }}
            />
          </div>
          <strong className="timeline-bars__value">{item.completedTasks}</strong>
        </article>
      ))}
    </div>
  );
}

export function TaskHeatmap({
  milestones,
}: {
  milestones: MilestoneProgress[];
}): ReactNode {
  return (
    <div className="heatmap-grid">
      {milestones.map((milestone) => (
        <article key={milestone.id} className="heatmap-card">
          <div className="heatmap-card__header">
            <div>
              <p className="heatmap-card__eyebrow">{milestone.id}</p>
              <h3 className="heatmap-card__title">{milestone.title}</h3>
            </div>
            <StatusBadge status="neutral" />
          </div>
          <div className="heatmap-card__cells">
            {milestone.tasks.map((task) => (
              <div
                key={task.id}
                className={`task-cell ${TASK_CLASS[task.status]}`}
                title={`${task.id} ${task.title} · ${task.status}`}
              >
                <span>{task.id.split('-')[1]}</span>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

export function StatusMatrix({
  items,
}: {
  items: Array<{ id: string; label: string; description?: string; status: MetricStatus }>;
}): ReactNode {
  return (
    <div className="status-matrix">
      {items.map((item) => (
        <article key={item.id} className={`status-matrix__card ${METRIC_CLASS[item.status]}`}>
          <div className="status-matrix__topline">
            <strong>{item.label}</strong>
            <StatusBadge status={item.status} />
          </div>
          {item.description ? <p>{item.description}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function RatioBar({
  label,
  value,
  total,
  detail,
  status,
}: {
  label: string;
  value: number;
  total: number;
  detail: string;
  status: MetricStatus;
}): ReactNode {
  const percentage = total === 0 ? 0 : (value / total) * 100;

  return (
    <article className="ratio-bar">
      <div className="ratio-bar__copy">
        <div>
          <strong>{label}</strong>
          <p>{detail}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="ratio-bar__track">
        <div
          className={`ratio-bar__fill ${METRIC_CLASS[status]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="ratio-bar__meta">
        <span>{value}</span>
        <span>{total}</span>
      </div>
    </article>
  );
}
