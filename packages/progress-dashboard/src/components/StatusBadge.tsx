import type { ReactNode } from 'react';
import type { MetricStatus, TaskStatus } from '../types/dashboard';

const STATUS_TEXT: Record<MetricStatus, string> = {
  pass: 'PASS',
  warn: 'WARN',
  fail: 'FAIL',
  blocked: 'BLOCKED',
  neutral: 'INFO',
  unknown: 'UNKNOWN',
};

const TASK_TEXT: Record<TaskStatus, string> = {
  complete: '完成',
  in_progress: '进行中',
  not_started: '未开始',
  blocked: '阻塞',
  skipped: '延后',
  removed: '移除',
  unknown: '未知',
};

interface StatusBadgeProps {
  status: MetricStatus | TaskStatus;
  mode?: 'metric' | 'task';
}

export function StatusBadge({
  status,
  mode = 'metric',
}: StatusBadgeProps): ReactNode {
  const text = mode === 'metric'
    ? STATUS_TEXT[status as MetricStatus]
    : TASK_TEXT[status as TaskStatus];

  return <span className={`status-pill status-pill--${status}`}>{text}</span>;
}
