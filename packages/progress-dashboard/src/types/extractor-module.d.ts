import type { DashboardData } from './dashboard';

declare module '../../../../scripts/progress-dashboard/extractor.mjs' {
  export function buildDashboardData(options: {
    repoRoot: string;
  }): Promise<DashboardData>;
}
