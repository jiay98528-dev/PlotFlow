import fs from 'node:fs/promises';
import path from 'node:path';

const SCHEMA_VERSION = '2026-06-25.v1';

function isMilestoneId(value) {
  return /^M\d+$/.test(value);
}

function compareMilestoneIds(left, right) {
  return Number(left.slice(1)) - Number(right.slice(1));
}

function sortMilestoneIds(ids) {
  return Array.from(new Set(ids)).sort(compareMilestoneIds);
}

const STATUS_MAP = new Map([
  ['✅', 'complete'],
  ['🔵', 'in_progress'],
  ['⬜', 'not_started'],
  ['🔴', 'blocked'],
  ['⏭️', 'skipped'],
  ['❌', 'removed'],
]);

function sourceRef(filePath, kind, extra = {}) {
  return {
    path: filePath.replace(/\\/g, '/'),
    kind,
    confidence: 'high',
    ...extra,
  };
}

function metric(status, value, sourceRefs, extras = {}) {
  return {
    status,
    value,
    sourceRefs,
    ...extras,
  };
}

function toMetricStatus(value) {
  if (value === 'PASS') return 'pass';
  if (value === 'WARN') return 'warn';
  if (value === 'FAIL') return 'fail';
  if (value === 'SKIPPED') return 'blocked';
  return 'unknown';
}

function toSeverity(value) {
  if (value === 'CRITICAL') return 'critical';
  if (value === 'HIGH') return 'high';
  if (value === 'MEDIUM') return 'medium';
  return 'low';
}

function percent(value, total) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(2));
}

function round(value) {
  return Number(value.toFixed(2));
}

function parsePercentValue(value) {
  const match = String(value ?? '').match(/(\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : null;
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function findStatusIndex(cells) {
  return cells.findIndex((cell, index) => index > 0 && STATUS_MAP.has(cell));
}

function parseMilestoneTaskRow(line) {
  const cells = splitMarkdownRow(line);
  if (cells.length < 3 || !/^M\d-\d{2}$/.test(cells[0])) return null;

  return {
    id: cells[0],
    title: cells.slice(1, -1).join(' | ').trim() || cells[1]?.trim() || '',
  };
}

function parseProgressTaskRow(line) {
  const cells = splitMarkdownRow(line);
  const statusIndex = findStatusIndex(cells);
  if (cells.length < 6 || statusIndex < 2) return null;

  return {
    id: cells[0],
    title: cells.slice(1, statusIndex).join(' | ').trim() || cells[1]?.trim() || '',
    status: cells[statusIndex],
    startedAt: cells[statusIndex + 1] ?? '',
    completedAt: cells[statusIndex + 2] ?? '',
    note: cells.slice(statusIndex + 3).join(' | ').trim(),
  };
}

function extractFirstTableAfter(content, marker) {
  const startIndex = content.indexOf(marker);
  if (startIndex === -1) return [];

  const rest = content.slice(startIndex).split(/\r?\n/);
  const lines = [];
  let inTable = false;

  for (const line of rest) {
    if (line.trim().startsWith('|')) {
      inTable = true;
      lines.push(line);
      continue;
    }

    if (inTable) break;
  }

  if (lines.length < 2) return [];
  const headers = splitMarkdownRow(lines[0]);
  return lines
    .slice(2)
    .map(splitMarkdownRow)
    .filter((row) => row.length >= headers.length)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ''])));
}

function findLineNumber(content, pattern) {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index === -1 ? undefined : index + 1;
}

function normalizeDate(value) {
  if (!value || value === '—') return undefined;
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match?.[0];
}

function parseUpdateDateFromHeader(content) {
  const match = content.match(/更新[^0-9\n]*(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

function parseReadmePublicProgress(readmeContent) {
  const rows = extractFirstTableAfter(readmeContent, '## 里程碑');
  const byMilestone = rows
    .filter((row) => /^M[0-7]$/.test(row['里程碑'] ?? ''))
    .map((row) => {
      const progressCell = row['进度'] ?? '';
      return {
        id: row['里程碑'],
        title: row['名称'],
        progress: parsePercentValue(progressCell),
      };
    });

  const totalMatch = readmeContent.match(
    /当前(?:\s*M0-M7\s*历史)?总进度见 .*?(\d+)\/(\d+).*?[（(](\d+(?:\.\d+)?)%[）)]/,
  );
  return {
    milestoneProgress: byMilestone,
    totalCompleted: totalMatch ? Number(totalMatch[1]) : null,
    totalTasks: totalMatch ? Number(totalMatch[2]) : null,
    totalPercent: totalMatch
      ? Number(totalMatch[3])
      : byMilestone.length > 0 && byMilestone.every((item) => item.progress !== null)
        ? round(
            byMilestone.reduce((accumulator, item) => accumulator + Number(item.progress), 0)
              / byMilestone.length,
          )
        : null,
  };
}

function parseMilestoneUniverse(milestonesContent) {
  const lines = milestonesContent.split(/\r?\n/);
  const titles = new Map();
  const milestoneIds = new Set();
  const totals = new Map();
  const overview = new Map();

  for (const line of lines) {
    const taskRow = parseMilestoneTaskRow(line);
    if (taskRow && !titles.has(taskRow.id)) {
      titles.set(taskRow.id, taskRow.title);
      const milestoneId = taskRow.id.slice(0, 2);
      milestoneIds.add(milestoneId);
      totals.set(milestoneId, (totals.get(milestoneId) ?? 0) + 1);
    }
  }

  for (const row of extractFirstTableAfter(milestonesContent, '## 总览')) {
    const id = row['里程碑'];
    if (!isMilestoneId(id)) continue;
    milestoneIds.add(id);
    overview.set(id, {
      totalTasks: Number(row['总任务']),
      fastRatio: row['Fast占比'],
      estimate: row['预估'],
    });
  }

  return { titles, totals, overview, milestoneIds: sortMilestoneIds(milestoneIds) };
}

function parseProgressDetails(progressContent, milestoneTitles) {
  const lines = progressContent.split(/\r?\n/);
  const tasksByMilestone = new Map();
  const overviewRows = extractFirstTableAfter(progressContent, '## 总览');
  const blockingRows = extractFirstTableAfter(progressContent, '## 阻塞项');
  const timelineMap = new Map();
  const sectionTitles = new Map();
  const milestoneIds = new Set();

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^##\s+(M\d+)\s+(.+)$/);
    if (headingMatch) {
      milestoneIds.add(headingMatch[1]);
      sectionTitles.set(headingMatch[1], headingMatch[2].trim());
      return;
    }

    const taskRow = parseProgressTaskRow(line);
    if (!taskRow) return;
    if (!/^M\d-\d{2}$/.test(taskRow.id)) return;

    const milestoneId = taskRow.id.slice(0, 2);
    milestoneIds.add(milestoneId);
    if (!tasksByMilestone.has(milestoneId)) {
      tasksByMilestone.set(milestoneId, []);
    }
    const rawStatus = taskRow.status.trim();
    const status = STATUS_MAP.get(rawStatus) ?? 'unknown';
    const titleFromUniverse = milestoneTitles.get(taskRow.id);
    const taskTitle = titleFromUniverse ?? taskRow.title;
    const startedAt = normalizeDate(taskRow.startedAt.trim());
    const completedAt = normalizeDate(taskRow.completedAt.trim());
    const note = taskRow.note.trim() || undefined;

    const task = {
      id: taskRow.id,
      title: taskTitle,
      status,
      rawStatus,
      startedAt,
      completedAt,
      note,
      sourceRefs: [
        sourceRef('spec/progress.md', 'markdown', {
          line: index + 1,
          capturedAt: parseUpdateDateFromHeader(progressContent),
        }),
      ],
    };

    tasksByMilestone.get(milestoneId)?.push(task);

    if (completedAt) {
      const existing = timelineMap.get(completedAt) ?? 0;
      timelineMap.set(completedAt, existing + 1);
    }
  });

  const overview = overviewRows
    .filter((row) => isMilestoneId(row['里程碑'] ?? '') && Number((row['里程碑'] ?? 'M0').slice(1)) <= 7)
    .map((row) => ({
      id: row['里程碑'],
      title: row['名称'],
      totalTasks: Number(row['任务数']),
      complete: Number(row['完成']),
      inProgress: Number(row['进行中']),
      notStarted: Number(row['未开始']),
      blocked: Number(row['阻塞']),
      progress: Number((row['进度'] ?? '0').replace('%', '')),
    }));

  const blocking = blockingRows
    .filter((row) => isMilestoneId(row['里程碑'] ?? '') && Number((row['里程碑'] ?? 'M0').slice(1)) <= 7)
    .map((row) => ({
      id: row['里程碑'],
      blockers: Number(row['阻塞数']),
      note: row['说明'],
    }));

  const timeline = Array.from(timelineMap.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, completedTasks]) => ({
      date,
      completedTasks,
      sourceRefs: [
        sourceRef('spec/progress.md', 'markdown', {
          capturedAt: parseUpdateDateFromHeader(progressContent),
          confidence: 'medium',
        }),
      ],
    }));

  return {
    tasksByMilestone,
    overview,
    blocking,
    timeline,
    sectionTitles,
    milestoneIds: sortMilestoneIds(milestoneIds),
  };
}

function computeMilestoneCounts(tasks, totalTasks) {
  const counts = {
    complete: 0,
    inProgress: 0,
    notStarted: 0,
    blocked: 0,
    skipped: 0,
    removed: 0,
    remaining: 0,
  };

  for (const task of tasks) {
    if (task.status === 'complete') counts.complete += 1;
    else if (task.status === 'in_progress') counts.inProgress += 1;
    else if (task.status === 'not_started') counts.notStarted += 1;
    else if (task.status === 'blocked') counts.blocked += 1;
    else if (task.status === 'skipped') counts.skipped += 1;
    else if (task.status === 'removed') counts.removed += 1;
  }

  counts.remaining = Math.max(
    0,
    totalTasks - counts.complete - counts.removed,
  );

  return counts;
}

function parseJsonContent(filePath, rawContent, errors) {
  try {
    return JSON.parse(rawContent);
  } catch (error) {
    errors.push({
      sourceId: filePath,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function readSource(repoRoot, relativePath, kind, errors) {
  const absolutePath = path.join(repoRoot, relativePath);

  try {
    const raw = await fs.readFile(absolutePath, 'utf8');
    return {
      id: relativePath,
      relativePath,
      kind,
      absolutePath,
      raw,
    };
  } catch (error) {
    errors.push({
      sourceId: relativePath,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function pickSourceErrors(errors, sourceId) {
  return errors.filter((entry) => entry.sourceId === sourceId).map((entry) => entry.message);
}

export async function buildDashboardData({ repoRoot }) {
  const generatedAt = new Date().toISOString();
  const errors = [];

  const readme = await readSource(repoRoot, 'README.md', 'markdown', errors);
  const progress = await readSource(repoRoot, 'spec/progress.md', 'markdown', errors);
  const milestones = await readSource(repoRoot, 'spec/milestones.md', 'markdown', errors);
  const audit = await readSource(repoRoot, 'spec/audit/pass1-data.json', 'json', errors);
  const journey = await readSource(repoRoot, 'scripts/output/journey-report.json', 'json', errors);
  const perf = await readSource(repoRoot, 'scripts/benchmark/perf-report.json', 'json', errors);
  const lastRun = await readSource(repoRoot, 'packages/app/test-results/.last-run.json', 'runtime', errors);

  if (!readme || !progress || !milestones || !audit || !journey || !perf) {
    throw new Error(`Dashboard source loading failed: ${errors.map((entry) => `${entry.sourceId}: ${entry.message}`).join('; ')}`);
  }

  const auditData = parseJsonContent(audit.relativePath, audit.raw, errors);
  const journeyData = parseJsonContent(journey.relativePath, journey.raw, errors);
  const perfData = parseJsonContent(perf.relativePath, perf.raw, errors);
  const lastRunData = lastRun ? parseJsonContent(lastRun.relativePath, lastRun.raw, errors) : null;

  if (!auditData || !journeyData || !perfData) {
    throw new Error(`Dashboard JSON parsing failed: ${errors.map((entry) => `${entry.sourceId}: ${entry.message}`).join('; ')}`);
  }

  const readmeProgress = parseReadmePublicProgress(readme.raw);
  const universe = parseMilestoneUniverse(milestones.raw);
  const progressDetails = parseProgressDetails(progress.raw, universe.titles);

  const publicByMilestone = new Map(
    readmeProgress.milestoneProgress.map((item) => [item.id, item.progress]),
  );
  const declaredByMilestone = new Map(
    progressDetails.overview.map((item) => [item.id, item]),
  );
  const coreMilestoneIds = universe.milestoneIds;
  const coreMilestoneIdSet = new Set(coreMilestoneIds);
  const allMilestoneIds = sortMilestoneIds([...coreMilestoneIds, ...progressDetails.milestoneIds]);

  const milestoneItems = [];
  const discrepancies = [];
  const provenanceMappings = [];

  let realCompleted = 0;
  let totalTasks = 0;
  let totalRemoved = 0;

  for (const milestoneId of coreMilestoneIds) {
    const tasks = progressDetails.tasksByMilestone.get(milestoneId) ?? [];
    const title = progressDetails.sectionTitles.get(milestoneId)
      ?? declaredByMilestone.get(milestoneId)?.title
      ?? readmeProgress.milestoneProgress.find((item) => item.id === milestoneId)?.title
      ?? milestoneId;
    const total = universe.totals.get(milestoneId) ?? tasks.length;
    const counts = computeMilestoneCounts(tasks, total);
    const declared = declaredByMilestone.get(milestoneId);
    const declaredCounts = declared
      ? {
          complete: declared.complete,
          inProgress: declared.inProgress,
          notStarted: declared.notStarted,
          blocked: declared.blocked,
        }
      : undefined;
    const computedProgress = percent(counts.complete, total);
    const declaredProgress = declared?.progress ?? null;
    const publicProgress = publicByMilestone.get(milestoneId) ?? null;

    totalTasks += total;
    realCompleted += counts.complete;
    totalRemoved += counts.removed;

    const sourceRefs = [
      sourceRef('spec/milestones.md', 'markdown', {
        line: findLineNumber(milestones.raw, new RegExp(`^##\\s+${milestoneId}\\b`)),
        confidence: 'high',
      }),
      sourceRef('spec/progress.md', 'markdown', {
        line: findLineNumber(progress.raw, new RegExp(`^##\\s+${milestoneId}\\b`)),
        capturedAt: parseUpdateDateFromHeader(progress.raw),
      }),
    ];

    milestoneItems.push({
      id: milestoneId,
      title,
      totalTasks: total,
      computedCounts: counts,
      declaredCounts,
      computedProgress,
      declaredProgress,
      publicProgress,
      tasks,
      sourceRefs,
    });

    provenanceMappings.push({
      metric: `milestones.${milestoneId}.computedProgress`,
      sourceRefs,
    });

    if (declaredProgress !== null && Math.abs(declaredProgress - computedProgress) > 0.1) {
      discrepancies.push({
        id: `discrepancy-${milestoneId}-progress`,
        area: 'milestones',
        title: `${milestoneId} 进度声明值与明细重算不一致`,
        severity: 'high',
        declared: declaredProgress,
        computed: computedProgress,
        unit: '%',
        summary: `${milestoneId} 总览表声明 ${declaredProgress}% ，明细表重算 ${computedProgress}% 。`,
        sourceRefs,
      });
    }

    if (declared && declared.complete !== counts.complete) {
      discrepancies.push({
        id: `discrepancy-${milestoneId}-complete`,
        area: 'milestones',
        title: `${milestoneId} 完成数声明值与明细重算不一致`,
        severity: 'critical',
        declared: declared.complete,
        computed: counts.complete,
        unit: 'tasks',
        summary: `${milestoneId} 总览表完成数 ${declared.complete}，明细重算 ${counts.complete}。`,
        sourceRefs,
      });
    }
  }

  for (const milestoneId of allMilestoneIds) {
    if (coreMilestoneIdSet.has(milestoneId)) continue;

    const tasks = progressDetails.tasksByMilestone.get(milestoneId) ?? [];
    const title = progressDetails.sectionTitles.get(milestoneId)
      ?? declaredByMilestone.get(milestoneId)?.title
      ?? readmeProgress.milestoneProgress.find((item) => item.id === milestoneId)?.title
      ?? milestoneId;
    const total = universe.totals.get(milestoneId) ?? tasks.length;
    const counts = computeMilestoneCounts(tasks, total);
    const computedProgress = percent(counts.complete, total);
    const sourceRefs = [];
    const progressLine = findLineNumber(progress.raw, new RegExp(`^##\\s+${milestoneId}\\b`));

    if (progressLine) {
      sourceRefs.push(sourceRef('spec/progress.md', 'markdown', {
        line: progressLine,
        capturedAt: parseUpdateDateFromHeader(progress.raw),
      }));
    }

    milestoneItems.push({
      id: milestoneId,
      title,
      totalTasks: total,
      computedCounts: counts,
      declaredCounts: undefined,
      computedProgress,
      declaredProgress: null,
      publicProgress: null,
      tasks,
      sourceRefs,
    });

    provenanceMappings.push({
      metric: `milestones.${milestoneId}.computedProgress`,
      sourceRefs,
    });
  }

  const realCompletionRate = percent(realCompleted, totalTasks);
  const publicCompletionRate = readmeProgress.totalPercent;
  const publicCompleted = readmeProgress.totalCompleted;
  const declaredTotalRow = progressDetails.overview.reduce(
    (accumulator, item) => accumulator + item.complete,
    0,
  );
  const declaredCompletionRate = progressDetails.overview.length
    ? percent(declaredTotalRow, totalTasks)
    : null;
  const blockerTasks = progressDetails.blocking.reduce(
    (accumulator, item) => accumulator + item.blockers,
    0,
  );
  const remainingTasks = totalTasks - realCompleted - totalRemoved;

  if (publicCompleted !== null && publicCompleted !== realCompleted) {
    discrepancies.push({
      id: 'discrepancy-readme-total',
      area: 'summary',
      title: 'README 对外口径与当前明细重算不一致',
      severity: 'critical',
      declared: publicCompleted,
      computed: realCompleted,
      unit: 'tasks',
      summary: `README 声明 ${publicCompleted}/${readmeProgress.totalTasks}，当前明细重算 ${realCompleted}/${totalTasks}。`,
      sourceRefs: [
        sourceRef('README.md', 'markdown', {
          line: findLineNumber(readme.raw, /当前(?:\s*M0-M7\s*历史)?总进度见/),
        }),
        sourceRef('spec/progress.md', 'markdown', {
          line: findLineNumber(progress.raw, /^\| \*\*合计\*\*/),
          capturedAt: parseUpdateDateFromHeader(progress.raw),
        }),
      ],
    });
  }

  if (declaredTotalRow !== realCompleted) {
    discrepancies.push({
      id: 'discrepancy-progress-total',
      area: 'summary',
      title: 'progress.md 总览完成数与明细重算不一致',
      severity: 'critical',
      declared: declaredTotalRow,
      computed: realCompleted,
      unit: 'tasks',
      summary: `progress.md 总览合计 ${declaredTotalRow}/${totalTasks}，明细重算 ${realCompleted}/${totalTasks}。`,
      sourceRefs: [
        sourceRef('spec/progress.md', 'markdown', {
          line: findLineNumber(progress.raw, /^\| \*\*合计\*\*/),
          capturedAt: parseUpdateDateFromHeader(progress.raw),
        }),
      ],
    });
  }

  const severityDistribution = Object.entries(auditData.meta?.severity_distribution ?? {})
    .map(([severity, count]) => ({ severity, count: Number(count) }))
    .sort((left, right) => right.count - left.count);

  const categoryDistribution = Array.from(
    (auditData.findings ?? []).reduce((map, finding) => {
      const count = map.get(finding.category) ?? 0;
      map.set(finding.category, count + 1);
      return map;
    }, new Map()),
  )
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count);

  const findingsTop = (auditData.findings ?? []).slice(0, 8).map((finding) => ({
    id: finding.id,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
    file: finding.file ?? null,
    line: finding.line ?? null,
    status: finding.status,
    detail: finding.detail,
    priority: finding.priority,
    effortMinutes: finding.effort_minutes ?? null,
    sourceRefs: [
      sourceRef('spec/audit/pass1-data.json', 'json', {
        capturedAt: auditData.meta?.audit_date,
      }),
    ],
  }));

  const contradictions = (auditData.contradictions ?? []).map((item) => ({
    id: item.id,
    severity: toSeverity(item.severity),
    description: item.description,
    location: item.location,
    sourceRefs: [
      sourceRef('spec/audit/pass1-data.json', 'json', {
        capturedAt: auditData.meta?.audit_date,
      }),
    ],
  }));

  const qualityGateSourceRefs = [
    sourceRef('spec/audit/pass1-data.json', 'json', {
      capturedAt: auditData.meta?.audit_date,
    }),
  ];

  const qualityGates = Object.entries(auditData.quality_gates ?? {}).map(([id, gate]) => ({
    id,
    title: id.replace(/_/g, ' '),
    status: toMetricStatus(gate.status),
    summary: gate.status === 'PASS'
      ? '通过'
      : gate.status === 'FAIL'
        ? '失败'
        : gate.status === 'SKIPPED'
          ? '跳过'
          : '警告',
    metric: 'errors' in gate
      ? metric(toMetricStatus(gate.status), Number(gate.errors), qualityGateSourceRefs, {
          target: 0,
          unit: 'errors',
        })
      : 'tests' in gate
        ? metric(toMetricStatus(gate.status), Number(gate.tests), qualityGateSourceRefs, {
            unit: 'tests',
            target: Number(gate.tests),
          })
        : undefined,
    sourceRefs: qualityGateSourceRefs,
  }));

  const e2eFiles = auditData.e2e_assessment?.files ?? [];
  const matchedFiles = e2eFiles.filter((file) => file.matched_by_config).length;
  const matchedLines = e2eFiles
    .filter((file) => file.matched_by_config)
    .reduce((accumulator, file) => accumulator + Number(file.lines), 0);
  const totalE2eLines = e2eFiles.reduce((accumulator, file) => accumulator + Number(file.lines), 0);
  const excludedLines = totalE2eLines - matchedLines;

  const journeyReport = journeyData.journey_report ?? {};
  const journeyCheckpoints = Object.entries(journeyReport.checkpoints ?? {}).map(([id, checkpoint]) => ({
    id,
    status: checkpoint.status === 'PASS' ? 'pass' : checkpoint.status === 'SIMULATED' ? 'warn' : checkpoint.status === 'FAIL' ? 'fail' : 'unknown',
    description: checkpoint.description,
  }));

  const variableTypes = Array.from(
    (journeyReport.variables ?? []).reduce((map, variable) => {
      const count = map.get(variable.type) ?? 0;
      map.set(variable.type, count + 1);
      return map;
    }, new Map()),
  )
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count);

  const readiness = Object.entries(journeyReport.overall_assessment ?? {})
    .filter(([key]) => key.endsWith('_readiness') || key.endsWith('_readiness_detail'))
    .reduce((items, [key, value]) => {
      if (!key.endsWith('_readiness')) return items;
      const baseKey = key.replace(/_readiness$/, '');
      const detail = journeyReport.overall_assessment?.[`${baseKey}_readiness_detail`] ?? '';
      items.push({
        area: baseKey,
        status: String(value).includes('生产就绪') || String(value).includes('Production Ready')
          ? 'pass'
          : String(value).includes('需修复') || String(value).includes('Needs Fix')
            ? 'fail'
            : 'warn',
        detail,
      });
      return items;
    }, []);

  const perfBenchmarks = (perfData.benchmarks ?? []).map((benchmark) => {
    const targetValue = benchmark.target_ms
      ?? benchmark.target_fps
      ?? benchmark.target_mb
      ?? null;
    const actualValue = benchmark.value_ms
      ?? benchmark.value_fps
      ?? benchmark.value_mb
      ?? benchmark.testSuiteDuration_s
      ?? null;

    let unit = 'count';
    if ('target_ms' in benchmark || 'value_ms' in benchmark) unit = 'ms';
    else if ('target_fps' in benchmark || 'value_fps' in benchmark) unit = 'fps';
    else if ('target_mb' in benchmark || 'value_mb' in benchmark) unit = 'mb';
    else if (benchmark.name.includes('Duration')) unit = 's';

    return {
      id: String(benchmark.id),
      name: benchmark.name,
      type: benchmark.type ?? 'unknown',
      targetValue: targetValue === null ? null : Number(targetValue),
      actualValue: actualValue === null ? null : Number(actualValue),
      unit,
      verdict: toMetricStatus(benchmark.verdict),
      detail: benchmark.detail ?? benchmark.optimizationPotential ?? '',
      methodology: benchmark.methodology,
    };
  });

  const sourceHealth = [
    {
      id: 'readme',
      label: 'README public snapshot',
      path: 'README.md',
      status: publicCompleted === realCompleted ? 'pass' : 'warn',
      lastUpdated: undefined,
      discrepancyCount: discrepancies.filter((item) => item.sourceRefs.some((ref) => ref.path === 'README.md')).length,
      missingFields: [],
      notes: publicCompleted === null ? ['未解析到对外总进度口径'] : ['作为公开口径保留，不参与真实值重算'],
    },
    {
      id: 'progress',
      label: 'Current status detail',
      path: 'spec/progress.md',
      status: discrepancies.some((item) => item.sourceRefs.some((ref) => ref.path === 'spec/progress.md')) ? 'warn' : 'pass',
      lastUpdated: parseUpdateDateFromHeader(progress.raw),
      discrepancyCount: discrepancies.filter((item) => item.sourceRefs.some((ref) => ref.path === 'spec/progress.md')).length,
      missingFields: [],
      notes: ['总览表仅作声明值展示，真实值按明细重算'],
    },
    {
      id: 'milestones',
      label: 'Task universe baseline',
      path: 'spec/milestones.md',
      status: 'pass',
      lastUpdated: normalizeDate(milestones.raw),
      discrepancyCount: discrepancies.filter((item) => item.sourceRefs.some((ref) => ref.path === 'spec/milestones.md')).length,
      missingFields: [],
      notes: ['任务全集与里程碑结构基于本文件'],
    },
    {
      id: 'audit',
      label: 'Audit dataset',
      path: 'spec/audit/pass1-data.json',
      status: 'pass',
      lastUpdated: auditData.meta?.audit_date,
      discrepancyCount: contradictions.length,
      missingFields: [],
      notes: [`${auditData.meta?.total_findings ?? 0} findings`, `${contradictions.length} contradictions`],
    },
    {
      id: 'journey',
      label: 'Journey simulation',
      path: 'scripts/output/journey-report.json',
      status: 'pass',
      lastUpdated: journeyReport.meta?.simulation_date,
      discrepancyCount: 0,
      missingFields: [],
      notes: ['复杂故事演练数据直接透传归一'],
    },
    {
      id: 'performance',
      label: 'Performance baseline',
      path: 'scripts/benchmark/perf-report.json',
      status: perfData.summary?.criticalIssues > 0 ? 'warn' : 'pass',
      lastUpdated: perfData.date,
      discrepancyCount: 0,
      missingFields: [],
      notes: [perfData.summary?.criticalIssue ?? ''],
    },
    {
      id: 'last-run',
      label: 'Playwright runtime marker',
      path: 'packages/app/test-results/.last-run.json',
      status: lastRunData?.status === 'passed' ? 'pass' : lastRun ? 'warn' : 'unknown',
      lastUpdated: undefined,
      discrepancyCount: 0,
      missingFields: lastRun ? [] : ['status'],
      notes: lastRun ? ['可选运行态来源'] : ['当前工作区没有该辅助来源'],
    },
  ];

  return {
    meta: {
      projectName: 'PlotFlow',
      schemaVersion: SCHEMA_VERSION,
      generatedAt,
      repoRoot: repoRoot.replace(/\\/g, '/'),
    },
    summary: {
      totalTasks: metric('neutral', totalTasks, [sourceRef('spec/milestones.md', 'markdown')], { unit: 'tasks' }),
      realCompleted: metric('pass', realCompleted, [sourceRef('spec/progress.md', 'markdown')], { unit: 'tasks' }),
      realCompletionRate: metric(realCompletionRate >= 90 ? 'pass' : 'warn', realCompletionRate, [sourceRef('spec/progress.md', 'markdown')], { unit: '%', target: 100 }),
      publicCompleted: metric(publicCompleted === null ? 'unknown' : publicCompleted === realCompleted ? 'pass' : 'warn', publicCompleted, [sourceRef('README.md', 'markdown')], { unit: 'tasks' }),
      publicCompletionRate: metric(publicCompletionRate === null ? 'unknown' : publicCompletionRate === realCompletionRate ? 'pass' : 'warn', publicCompletionRate, [sourceRef('README.md', 'markdown')], { unit: '%', target: 100 }),
      declaredCompleted: metric(declaredTotalRow === realCompleted ? 'pass' : 'warn', declaredTotalRow, [sourceRef('spec/progress.md', 'markdown')], { unit: 'tasks' }),
      declaredCompletionRate: metric(declaredCompletionRate === realCompletionRate ? 'pass' : 'warn', declaredCompletionRate, [sourceRef('spec/progress.md', 'markdown')], { unit: '%', target: 100 }),
      deltaPublicVsReal: metric(publicCompletionRate === null ? 'unknown' : publicCompletionRate === realCompletionRate ? 'pass' : 'warn', publicCompletionRate === null ? null : round(publicCompletionRate - realCompletionRate), [sourceRef('README.md', 'markdown'), sourceRef('spec/progress.md', 'markdown')], { unit: 'pts' }),
      remainingTasks: metric(remainingTasks === 0 ? 'pass' : 'blocked', remainingTasks, [sourceRef('spec/milestones.md', 'markdown'), sourceRef('spec/progress.md', 'markdown')], { unit: 'tasks' }),
      blockerTasks: metric(blockerTasks === 0 ? 'pass' : blockerTasks > 5 ? 'blocked' : 'warn', blockerTasks, [sourceRef('spec/progress.md', 'markdown')], { unit: 'tasks' }),
      lastUpdated: metric('neutral', parseUpdateDateFromHeader(progress.raw) ?? null, [sourceRef('spec/progress.md', 'markdown')]),
      overallGrade: metric('neutral', auditData.overall_grade ? `${auditData.overall_grade.letter_grade} / ${auditData.overall_grade.weighted_score}` : null, [sourceRef('spec/audit/pass1-data.json', 'json')]),
      discrepancies: metric(discrepancies.length === 0 ? 'pass' : 'warn', discrepancies.length, [sourceRef('README.md', 'markdown'), sourceRef('spec/progress.md', 'markdown')], { unit: 'issues' }),
    },
    milestones: {
      order: allMilestoneIds,
      items: milestoneItems,
      timeline: progressDetails.timeline,
    },
    qualityGates: {
      gates: qualityGates,
      testCounts: {
        progressDoc: auditData.test_baseline?.V0_2_progress_md
          ? {
              files: Number(auditData.test_baseline.V0_2_progress_md.files),
              tests: Number(auditData.test_baseline.V0_2_progress_md.tests),
            }
          : undefined,
        audited: auditData.test_baseline?.Pass_1_measured
          ? {
              files: Number(auditData.test_baseline.Pass_1_measured.files),
              tests: Number(auditData.test_baseline.Pass_1_measured.tests),
              failed: Number(auditData.test_baseline.Pass_1_measured.failed ?? 0),
              durationSeconds: Number(auditData.test_baseline.Pass_1_measured.duration_s ?? 0),
            }
          : undefined,
        delta: auditData.test_baseline?.delta_vs_progress_md
          ? {
              files: Number(String(auditData.test_baseline.delta_vs_progress_md.files).replace('+', '')),
              tests: Number(String(auditData.test_baseline.delta_vs_progress_md.tests).replace('+', '')),
            }
          : undefined,
      },
      e2eCoverage: {
        matchedFiles,
        totalFiles: e2eFiles.length,
        matchedLines,
        totalLines: totalE2eLines,
        excludedLines,
        coverageRatio: percent(matchedLines, totalE2eLines),
        sourceRefs: [sourceRef('spec/audit/pass1-data.json', 'json', { capturedAt: auditData.meta?.audit_date })],
      },
    },
    findings: {
      total: Number(auditData.meta?.total_findings ?? findingsTop.length),
      bySeverity: severityDistribution,
      byCategory: categoryDistribution,
      recommendations: Object.entries(auditData.pass2_recommendations ?? {})
        .filter(([key]) => /^p\d+_fixes$/i.test(key))
        .map(([key, items]) => ({
          priority: key.replace(/_fixes$/i, '').toUpperCase(),
          items: items.map((item) => ({
            id: item.id,
            action: item.action,
            effort: item.effort_min ?? null,
          })),
        })),
      top: findingsTop,
    },
    contradictions: {
      total: contradictions.length,
      items: contradictions,
    },
    discrepancies,
    e2e: {
      configStatus: toMetricStatus(auditData.e2e_assessment?.config_match),
      matchedFiles,
      totalFiles: e2eFiles.length,
      matchedLines,
      totalLines: totalE2eLines,
      deadCodeLines: Number(auditData.e2e_assessment?.dead_code_lines ?? excludedLines),
      files: e2eFiles.map((file) => ({
        name: file.name,
        lines: Number(file.lines),
        matchedByConfig: Boolean(file.matched_by_config),
      })),
    },
    journey: {
      storyStats: {
        totalNodes: Number(journeyReport.story_stats?.total_nodes ?? 0),
        totalOptions: Number(journeyReport.story_stats?.total_options ?? 0),
        totalConditions: Number(journeyReport.story_stats?.total_conditions ?? 0),
        totalEffects: Number(journeyReport.story_stats?.total_effects ?? 0),
        chapters: Number(journeyReport.story_stats?.chapters ?? 0),
        variables: Number(journeyReport.story_stats?.variables ?? 0),
        inputSizeChars: Number(journeyReport.story_stats?.input_size_chars ?? 0),
        inputSizeLines: Number(journeyReport.story_stats?.input_size_lines ?? 0),
        parseTimeMs: Number(journeyReport.story_stats?.parse_time_ms ?? 0),
        crossChapterReferences: Number(journeyReport.story_stats?.cross_chapter_references ?? 0),
      },
      chapters: journeyReport.chapters ?? [],
      variableTypes,
      checkpoints: journeyCheckpoints,
      readiness,
    },
    performance: {
      benchmarks: perfBenchmarks,
      summary: {
        totalBenchmarks: Number(perfData.summary?.totalBenchmarks ?? perfBenchmarks.length),
        pass: Number(perfData.summary?.pass ?? perfBenchmarks.filter((benchmark) => benchmark.verdict === 'pass').length),
        fail: Number(perfData.summary?.fail ?? perfBenchmarks.filter((benchmark) => benchmark.verdict === 'fail').length),
        passRate: Number(String(perfData.summary?.passRate ?? '0').replace('%', '')),
        criticalIssues: Number(perfData.summary?.criticalIssues ?? 0),
        criticalIssue: perfData.summary?.criticalIssue ?? '',
        overallAssessment: perfData.summary?.overallAssessment ?? '',
      },
      bottlenecks: (perfData.bottlenecks ?? []).map((item) => ({
        rank: item.rank,
        component: item.component,
        severity: item.severity,
        currentMs: Number(item.current_ms ?? 0),
        targetMs: Number(item.target_ms ?? 0),
        excessPercent: Number(item.excess_percent ?? 0),
        impact: item.impact,
        fix: item.fix,
      })),
      recommendations: perfData.recommendations ?? [],
    },
    sourceHealth: {
      sources: sourceHealth.map((item) => ({
        ...item,
        notes: item.notes.filter(Boolean),
      })),
    },
    provenance: {
      sourcePriority: [
        'spec/milestones.md',
        'spec/progress.md',
        'spec/audit/pass1-data.json',
        'scripts/output/journey-report.json',
        'scripts/benchmark/perf-report.json',
        'README.md',
        'packages/app/test-results/.last-run.json',
      ],
      mappings: [
        {
          metric: 'summary.realCompletionRate',
          sourceRefs: [sourceRef('spec/progress.md', 'markdown')],
        },
        {
          metric: 'summary.publicCompletionRate',
          sourceRefs: [sourceRef('README.md', 'markdown')],
        },
        {
          metric: 'summary.overallGrade',
          sourceRefs: [sourceRef('spec/audit/pass1-data.json', 'json')],
        },
        {
          metric: 'qualityGates.e2eCoverage',
          sourceRefs: [sourceRef('spec/audit/pass1-data.json', 'json')],
        },
        {
          metric: 'journey.storyStats',
          sourceRefs: [sourceRef('scripts/output/journey-report.json', 'json')],
        },
        {
          metric: 'performance.benchmarks',
          sourceRefs: [sourceRef('scripts/benchmark/perf-report.json', 'json')],
        },
        ...provenanceMappings,
      ],
    },
  };
}

export async function writeDashboardData({ outputPath, data }) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
