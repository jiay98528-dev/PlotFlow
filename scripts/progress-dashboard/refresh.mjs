import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDashboardData, writeDashboardData } from './extractor.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const outputPath = path.join(
  repoRoot,
  'packages',
  'progress-dashboard',
  'public',
  'dashboard-data.json',
);

const data = await buildDashboardData({ repoRoot });
await writeDashboardData({ outputPath, data });

const realRate = data.summary.realCompletionRate.value;
const publicRate = data.summary.publicCompletionRate.value;

console.log(
  [
    'Dashboard data refreshed.',
    `output=${outputPath.replace(/\\/g, '/')}`,
    `real=${realRate}%`,
    `public=${publicRate ?? 'unknown'}%`,
    `discrepancies=${data.discrepancies.length}`,
  ].join(' '),
);
