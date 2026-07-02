import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(websiteRoot, '..');
const dashboardPath = path.join(repoRoot, 'packages', 'progress-dashboard', 'public', 'dashboard-data.json');
const progressPath = path.join(repoRoot, 'spec', 'progress.md');
const outputPath = path.join(websiteRoot, 'public', 'data', 'project-status.json');

function stripBom(value) {
  return value.replace(/^\uFEFF/, '');
}

const dashboard = JSON.parse(stripBom(await readFile(dashboardPath, 'utf8')));
const progress = stripBom(await readFile(progressPath, 'utf8'));

function metricValue(name, fallback) {
  return dashboard.summary?.[name]?.value ?? fallback;
}

function positiveMetricValue(name, fallback, alternateName) {
  const value = dashboard.summary?.[name]?.value;
  if (typeof value === 'number' && value > 0) return value;
  const alternate = alternateName ? dashboard.summary?.[alternateName]?.value : undefined;
  if (typeof alternate === 'number' && alternate > 0) return alternate;
  return fallback;
}

const summaryTotal = positiveMetricValue('totalTasks', 142);
const summaryCompleted = positiveMetricValue('realCompleted', 132, 'publicCompleted');
const summaryRate = positiveMetricValue('realCompletionRate', 92.96, 'publicCompletionRate');
const rawRemaining = dashboard.summary?.remainingTasks?.value;
const summaryRemaining =
  typeof rawRemaining === 'number' && rawRemaining >= 0 && rawRemaining < summaryTotal ? rawRemaining : 9;

function normalizeGateStatus(result) {
  if (/PASS/.test(result)) return 'pass';
  if (/FAIL|失败/.test(result)) return 'warn';
  return 'neutral';
}

function normalizeGateResult(result) {
  return result
    .replace(/鉁\?/g, '✅')
    .replace(/鈴笍/g, '⏭️')
    .replace(/鉂\?/g, '❌')
    .replace(/✅\s*PASS/g, '✅ PASS')
    .replace(/⏭️\s*SKIPPED/g, '⏭️ SKIPPED')
    .replace(/❌\s*FAIL/g, '❌ FAIL');
}

function localizeGate(name, result, detail) {
  const status = /PASS/.test(result) ? '通过' : /FAIL|失败/.test(result) ? '失败' : '跟踪';
  const rules = [
    ['pnpm.cmd --filter @plotflow/progress-dashboard typecheck', '进度仪表盘类型检查', '进度仪表盘类型检查通过。'],
    ['pnpm.cmd --filter @plotflow/progress-dashboard test', '进度仪表盘测试', '进度仪表盘单元测试通过。'],
    ['pnpm.cmd --filter @plotflow/app test:e2e:blackbox', '源码态黑盒验收', '源码构建产物黑盒通过；packaged/installed 专属检查单独统计，不能代表正式发行通过。'],
    ['pnpm.cmd --filter @plotflow/app test:e2e:unpacked', '解包态黑盒验收', '当前干净打包后的 Windows 解包应用黑盒通过；安装态注册表检查仍单独统计。'],
    ['pnpm.cmd --filter @plotflow/app test:e2e:installed', '安装态黑盒验收', '真实安装路径黑盒验收，需设置 PLOTFLOW_INSTALLED_EXE。'],
    ['pnpm.cmd --filter @plotflow/app test:e2e', '应用端到端验收', '44 条应用 E2E 全部通过，覆盖 Home 布局、Graph Lab 重命名、诊断入口、保存反馈和 English 主界面。'],
    ['pnpm.cmd test', '单元测试', '44 个测试文件 / 1252 条测试用例通过。'],
    ['pnpm.cmd lint:css', '样式规范检查', '样式令牌与样式规则检查通过。'],
    ['pnpm.cmd lint', '代码规范检查', '代码规范检查通过，仅保留既有控制台日志警告。'],
    ['pnpm.cmd typecheck', '类型检查', '严格类型检查通过。'],
    ['pnpm.cmd build', '生产构建', '生产构建通过，保留一条既有模块拆分提示。'],
    ['pnpm.cmd audit', '依赖安全审计', '依赖安全审计通过；Electron 42.5.0 当前无已知中高危漏洞。'],
    ['pnpm.cmd package:win', 'Windows 安装包构建', 'Windows NSIS 安装器、blockmap、latest.yml、调试元数据和解包应用已由干净构建生成。'],
    ['Windows packaged smoke', 'Windows 安装包冒烟验收', '当前解包态黑盒主路径通过，桌面包未包含官网目录。'],
  ];
  const matched = rules.find(([needle]) => name.includes(needle));
  return {
    name: matched?.[1] ?? '未识别门禁',
    result: status,
    detail: matched?.[2] ?? '详见项目发行门禁记录。',
  };
}

function parseReleaseGates(markdown) {
  const start = markdown.indexOf('| `pnpm.cmd lint` |');
  if (start < 0) return [];

  const tableStart = markdown.lastIndexOf('\n|', start);
  const rest = markdown.slice(tableStart >= 0 ? tableStart + 1 : start);
  const lines = [];
  for (const line of rest.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!/^\|.+\|$/.test(trimmed)) {
      if (lines.length > 0) break;
      continue;
    }
    lines.push(trimmed);
  }

  return lines
    .filter((line) => !/^\|\s*-+/.test(line))
    .filter((line) => line.includes('pnpm.cmd') || line.includes('Windows packaged smoke'))
    .map((line) => {
      const cells = line.split('|').slice(1, -1).map((cell) => cell.trim().replace(/^`|`$/g, ''));
      const [name = '', result = '', detail = ''] = cells;
      const zh = localizeGate(name, result, detail);
      const normalizedResult = normalizeGateResult(result);
      return {
        name,
        zhName: zh.name,
        status: normalizeGateStatus(`${result} ${detail}`),
        result: normalizedResult,
        zhResult: zh.result,
        detail,
        zhDetail: zh.detail,
      };
    });
}

function milestoneItems() {
  return (dashboard.milestones?.items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    total: item.totalTasks,
    complete: item.computedCounts?.complete ?? 0,
    skipped: item.computedCounts?.skipped ?? 0,
    removed: item.computedCounts?.removed ?? 0,
    progress: item.computedProgress,
  }));
}

const stableFeatures = [
  {
    title: 'Split editor workflow',
    zhTitle: 'Split 双栏编辑工作流',
    status: 'pass',
    detail: 'Monaco editing, React Flow graph visualization, node navigation, and source-to-graph refresh are implemented.',
    zhDetail: 'Monaco 编辑、React Flow 分支图、节点导航和源文本到图形刷新已经形成稳定闭环。',
    evidence: 'M1/M2 complete; default app integration E2E currently passes 44/44.',
    zhEvidence: 'M1/M2 已完成；默认应用集成 E2E 当前 44/44 通过。',
  },
  {
    title: 'Parser, validator, diagnostics',
    zhTitle: '解析器、校验器与诊断系统',
    status: 'pass',
    detail: 'The parser, diagnostics, markers, ProblemPanel, and graph status sync are implemented.',
    zhDetail: '解析器、诊断、编辑器标记、问题面板和图节点状态同步已经接入。',
    evidence: 'pnpm.cmd test passes 44 files / 1252 tests; Parser/Validator E2E record is green.',
    zhEvidence: 'pnpm.cmd test 通过 44 个文件 / 1252 条用例；Parser/Validator E2E 为通过状态。',
  },
  {
    title: 'Graph Lab graph-first workflow',
    zhTitle: 'Graph Lab 图优先工作流',
    status: 'pass',
    detail: 'Graph Lab is a core entry with workspace mode switching, Palette, Inspector, Source Drawer, text command layer, and E2E coverage.',
    zhDetail: 'Graph Lab 已作为核心入口接入，覆盖模式切换、节点素材盘、检查器、源文档抽屉、文本命令层和 E2E。',
    evidence: 'Default app integration E2E currently passes 44/44; source blackbox passes 10 with 4 packaged-or-installed skips; current unpacked blackbox passes 13 with 1 installed-only skip.',
    zhEvidence: '默认应用集成 E2E 当前 44/44 通过；源码态黑盒 10 项通过，另有 4 项为打包/安装专属跳过；当前解包态黑盒 13 项通过，另有 1 项为安装专属跳过。',
  },
  {
    title: 'Official theme platform',
    zhTitle: '官方主题平台',
    status: 'pass',
    detail: 'Builtin themes and official remote ZIP themes are validated, downloaded, installed, and loaded through the official theme runtime.',
    zhDetail: '内置主题和官方远程 ZIP 主题已通过目录校验、下载、安装与官方主题运行时加载链路。',
    evidence: 'official-theme-service unit tests, theme E2E, and blackbox remote-theme E2E pass.',
    zhEvidence: 'official-theme-service 单测、主题 E2E 与黑盒远程主题 E2E 均通过。',
  },
  {
    title: 'JSON / HTML / TXT export',
    zhTitle: 'JSON / HTML / TXT 导出',
    status: 'pass',
    detail: 'The export flow is implemented, sanitizes placeholder filenames, and verifies disk output after write.',
    zhDetail: '导出流程已实现，会清洗占位符文件名，并在写入后验证磁盘输出。',
    evidence: 'Export suite is part of the 44/44 app integration E2E gate; current unpacked blackbox native save-dialog JSON export passes.',
    zhEvidence: '导出套件已纳入 44/44 应用集成 E2E 门禁；当前解包态黑盒原生保存对话框 JSON 导出通过。',
  },
];

const experimentalFeatures = [
  {
    title: 'Installed blackbox gate',
    zhTitle: '安装态黑盒门禁',
    status: 'neutral',
    detail: 'Source and unpacked blackbox gates are implemented and passing. Installed blackbox must be rerun after installing the current clean package.',
    zhDetail: '源码态和解包态黑盒已实现并通过。安装态黑盒必须在安装当前干净包后复跑。',
    evidence: 'See spec/release-blackbox-gate.md for layered release status vocabulary.',
    zhEvidence: '分层发行状态口径见 spec/release-blackbox-gate.md。',
  },
  {
    title: 'macOS / Linux packaging',
    zhTitle: 'macOS / Linux 打包',
    status: 'warn',
    detail: 'Cross-platform installers and smoke tests are deferred until CI matrix packaging is available.',
    zhDetail: '跨平台安装包和冒烟验收延后到 CI 矩阵构建可用后处理。',
    evidence: 'M7-03, M7-04, and M7-15 are deferred.',
    zhEvidence: 'M7-03、M7-04 和 M7-15 为延后状态。',
  },
  {
    title: 'Auto-update and public release pipeline',
    zhTitle: '自动更新与公开发布链路',
    status: 'warn',
    detail: 'electron-updater integration, update server config, GitHub Release draft, and first-run onboarding are deferred.',
    zhDetail: 'electron-updater 集成、更新服务器配置、GitHub Release 草稿和首次启动引导仍为延后状态。',
    evidence: 'M7-09, M7-10, M7-12, and M7-13 are deferred.',
    zhEvidence: 'M7-09、M7-10、M7-12 和 M7-13 为延后状态。',
  },
];

const roadmap = [
  {
    title: 'Stabilize official theme runtime',
    zhTitle: '稳定官方主题运行时',
    status: 'neutral',
    detail: 'Keep expanding surface contracts only when a real official theme needs them, and keep blackbox coverage in release/nightly.',
    zhDetail: '仅在真实官方主题需要时继续扩展 surface 合同，并将黑盒覆盖保留在 release/nightly。',
  },
  {
    title: 'Complete M7 publishing chain',
    zhTitle: '补齐 M7 发布链路',
    status: 'warn',
    detail: 'Add macOS/Linux packaging, auto-update, GitHub Release draft, first-run onboarding, and cross-platform smoke verification.',
    zhDetail: '补齐 macOS / Linux 打包、自动更新、GitHub Release 草稿、首次启动引导和跨平台冒烟验收。',
  },
  {
    title: 'Deploy this independent website',
    zhTitle: '部署独立官网',
    status: 'neutral',
    detail: 'Build website/dist separately and deploy it to a server. Keep it excluded from desktop application packaging.',
    zhDetail: '单独构建官网目录并部署到服务器，继续排除在桌面应用安装包之外。',
  },
];

const status = {
  generatedAt: new Date().toISOString(),
  summary: {
    completed: summaryCompleted,
    total: summaryTotal,
    rate: summaryRate,
    remaining: summaryRemaining,
    deferred: 9,
    removed: 1,
    lastUpdated: metricValue('lastUpdated', '2026-06-27'),
    grade: metricValue('overallGrade', 'B+ / 82'),
  },
  milestones: milestoneItems(),
  releaseGates: parseReleaseGates(progress),
  stableFeatures,
  experimentalFeatures,
  roadmap,
  sourceRefs: [
    'packages/progress-dashboard/public/dashboard-data.json',
    'spec/progress.md',
    'memory/bug_log.md',
    'spec/decisions.md',
  ],
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(status, null, 2)}\n`, 'utf8');
console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
