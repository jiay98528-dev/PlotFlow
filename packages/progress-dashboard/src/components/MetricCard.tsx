import type { ReactNode } from 'react';
import type { MetricStatus } from '../types/dashboard';

const STATUS_LABELS: Record<MetricStatus, string> = {
  pass: 'Healthy',
  warn: 'Watch',
  fail: 'Fail',
  blocked: 'Blocked',
  neutral: 'Info',
  unknown: 'Unknown',
};

interface MetricCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  status: MetricStatus;
  detail?: ReactNode;
}

export function MetricCard({
  label,
  value,
  hint,
  status,
  detail,
}: MetricCardProps): ReactNode {
  return (
    <article className={`metric-card metric-card--${status}`}>
      <div className="metric-card__topline">
        <span className="metric-card__label">{label}</span>
        <span className={`status-dot status-dot--${status}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      <p className="metric-card__value">{value}</p>
      {hint ? <p className="metric-card__hint">{hint}</p> : null}
      {detail ? <div className="metric-card__detail">{detail}</div> : null}
    </article>
  );
}
