import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(websiteRoot, '..');
const dashboardPath = path.join(
  repoRoot,
  'packages',
  'progress-dashboard',
  'public',
  'dashboard-data.json',
);
const progressPath = path.join(repoRoot, 'spec', 'progress.md');
const outputPath = path.join(websiteRoot, 'public', 'data', 'project-status.json');

const dashboard = JSON.parse(await readFile(dashboardPath, 'utf8'));
const progress = await readFile(progressPath, 'utf8');

function metricValue(name, fallback) {
  return dashboard.summary?.[name]?.value ?? fallback;
}

function normalizeGateStatus(result) {
  if (/PASS/.test(result)) {
    if (/无\s*GHSA\s*ignore|No known vulnerabilities/i.test(result)) {
      return 'pass';
    }
    if (/(显式\s*ignore|显式忽略|风险接受|GHSA.*(ignore|忽略|放行))/.test(result)) {
      return 'risk';
    }
    return 'pass';
  }
  if (/FAIL|失败/.test(result)) {
    return 'warn';
  }
  return 'neutral';
}

function parseReleaseGates(markdown) {
  const start = markdown.indexOf('## 发行门禁状态');
  if (start < 0) {
    return [];
  }
  const rest = markdown.slice(start);
  const next = rest.slice(1).search(/\n##\s+/);
  const section = next >= 0 ? rest.slice(0, next + 1) : rest;

  return section
    .split(/\r?\n/)
    .filter((line) => /^\|.+\|$/.test(line.trim()))
    .filter((line) => !/^\|\s*-+/.test(line))
    .filter((line) => !/门禁\s*\|/.test(line))
    .map((line) => {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/^`|`$/g, ''));
      const [name, result, detail] = cells;
      const zh = localizeGate(name, result, detail);
      return {
        name,
        zhName: zh.name,
        status: normalizeGateStatus(`${result} ${detail}`),
        result,
        zhResult: zh.result,
        detail,
        zhDetail: zh.detail,
      };
    });
}

function localizeGate(name, result, detail) {
  const status = /PASS/.test(result) ? '通过' : /FAIL|失败/.test(result) ? '失败' : '跟踪';
  const fallback = {
    name: '未识别门禁',
    result: status,
    detail: '详见项目发行门禁记录。',
  };

  const rules = [
    [
      'pnpm.cmd --filter @plotflow/progress-dashboard typecheck',
      '进度仪表盘类型检查',
      '进度仪表盘类型检查通过。',
    ],
    [
      'pnpm.cmd --filter @plotflow/progress-dashboard test',
      '进度仪表盘测试',
      '进度仪表盘单元测试通过。',
    ],
    [
      'pnpm.cmd --filter @plotflow/app test:e2e',
      '应用端到端验收',
      '39 条应用 E2E 全部通过，无关闭超时或未运行用例。',
    ],
    ['pnpm.cmd test', '单元测试', '41 个测试文件 / 1231 条测试用例通过。'],
    ['pnpm.cmd lint:css', '样式规范检查', '样式令牌与样式规则检查通过。'],
    ['pnpm.cmd lint', '代码规范检查', '代码规范检查通过，仅保留既有控制台日志警告。'],
    ['pnpm.cmd typecheck', '类型检查', '严格类型检查通过。'],
    ['pnpm.cmd build', '生产构建', '生产构建通过，保留一条既有模块拆分提示。'],
    ['pnpm.cmd audit', '依赖安全审计', '依赖安全审计通过；Electron 42.5.0 当前无已知中高危漏洞。'],
    ['pnpm.cmd package:win', 'Windows 安装包构建', 'Windows 安装包和解包应用构建通过。'],
    ['Windows packaged smoke', 'Windows 安装包冒烟验收', '解包应用可启动；命令行打开 .mdstory、Graph Lab 图形编辑、Source Drawer 和导出 JSON 均成功。'],
  ];

  const matched = rules.find(([needle]) => name.includes(needle));
  if (!matched) {
    return fallback;
  }

  return {
    name: matched[1],
    result: status,
    detail: matched[2],
  };
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
    detail:
      'Monaco editing, React Flow graph visualization, node navigation, and source-to-graph refresh are implemented.',
    zhDetail: 'Monaco 编辑、React Flow 分支图、节点导航和源文本到图形刷新已经形成稳定闭环。',
    evidence: 'M1/M2 complete; default app E2E currently passes 39/39.',
    zhEvidence: 'M1/M2 已完成；默认应用 E2E 当前 39/39 通过。',
  },
  {
    title: 'Parser, validator, diagnostics',
    zhTitle: '解析器、校验器与诊断系统',
    status: 'pass',
    detail:
      'The parser, E001-E008 errors, W001-W006 warnings, I001-I003 suggestions, markers, ProblemPanel, and graph status sync are implemented.',
    zhDetail: '解析器、E001-E008 错误、W001-W006 警告、I001-I003 建议、编辑器标记、问题面板和图节点状态同步已经接入。',
    evidence: 'pnpm.cmd test passes 41 files / 1231 tests; Parser/Validator E2E record is green.',
    zhEvidence: 'pnpm.cmd test 通过 41 个文件 / 1231 条用例；Parser/Validator E2E 为通过状态。',
  },
  {
    title: 'Condition editor and text sync',
    zhTitle: '条件编辑器与文本同步',
    status: 'pass',
    detail:
      'The visual condition editor can load existing conditions and apply variable/operator/value logic back to text.',
    zhDetail: '图形化条件编辑器可载入已有条件，并把变量、运算符和值逻辑回写到文本。',
    evidence: 'M3 complete; condition-editor E2E is part of the default app E2E gate.',
    zhEvidence: 'M3 已完成；条件编辑器已纳入默认应用 E2E。',
  },
  {
    title: 'JSON / HTML / TXT export',
    zhTitle: 'JSON / HTML / TXT 导出',
    status: 'pass',
    detail:
      'The export flow is implemented and current export E2E passes; PNG placeholder menu has been removed from release scope.',
    zhDetail: '导出流程已实现并通过当前导出 E2E；PNG 占位菜单已从发行范围移除。',
    evidence: 'M4 25/26; export suite passed in the latest release audit notes.',
    zhEvidence: 'M4 25/26；导出套件在最新发行审计记录中通过。',
  },
  {
    title: 'Windows local package smoke',
    zhTitle: 'Windows 本地安装包冒烟验收',
    status: 'pass',
    detail:
      'The Windows NSIS installer and win-unpacked app were built locally and smoke-tested for launch, command-line open, save, and JSON export.',
    zhDetail: 'Windows NSIS 安装器与 win-unpacked 应用已完成本地构建，并验证启动、命令行打开、保存和 JSON 导出。',
    evidence: 'M7-02 and M7-14 complete in spec/progress.md.',
    zhEvidence: 'M7-02 和 M7-14 已在进度文档中标记完成。',
  },
  {
    title: 'Graph Lab graph-first workflow',
    zhTitle: 'Graph Lab 图优先工作流',
    status: 'pass',
    detail:
      'Graph Lab is now a core entry with workspace mode switching, Palette, Inspector, Source Drawer, text command layer, and E2E coverage.',
    zhDetail: 'Graph Lab 已作为核心入口接入，覆盖模式切换、节点素材盘、检查器、源文本抽屉、文本命令层和 E2E。',
    evidence: 'M8 Graph Lab Core is 17/18; default app E2E currently passes 39/39.',
    zhEvidence: 'M8 Graph Lab Core 当前 17/18；默认应用 E2E 当前 39/39 通过。',
  },
];

const experimentalFeatures = [
  {
    title: 'macOS / Linux packaging',
    zhTitle: 'macOS / Linux 打包',
    status: 'warn',
    detail:
      'Cross-platform installers and smoke tests are deferred until CI matrix packaging is available.',
    zhDetail: '跨平台安装包和冒烟验收延后到 CI 矩阵构建可用后处理。',
    evidence: 'M7-03, M7-04, and M7-15 are deferred.',
    zhEvidence: 'M7-03、M7-04 和 M7-15 为延后状态。',
  },
  {
    title: 'Auto-update and public release pipeline',
    zhTitle: '自动更新与公开发布链路',
    status: 'warn',
    detail:
      'electron-updater integration, update server config, GitHub Release draft, and first-run onboarding are deferred.',
    zhDetail: 'electron-updater 集成、更新服务器配置、GitHub Release 草稿和首次启动引导仍为延后状态。',
    evidence: 'M7-09, M7-10, M7-12, and M7-13 are deferred.',
    zhEvidence: 'M7-09、M7-10、M7-12 和 M7-13 为延后状态。',
  },
  {
    title: 'Graph Lab release copy and onboarding',
    zhTitle: 'Graph Lab 发布文案与上手说明',
    status: 'neutral',
    detail:
      'The core Graph Lab workflow is implemented; public release copy, help text, and first-run guidance still need final polish.',
    zhDetail: 'Graph Lab 核心流程已实现；公开发布文案、帮助说明和首次上手引导仍需最终打磨。',
    evidence: 'M8-18 is still in progress.',
    zhEvidence: 'M8-18 仍处于进行中。',
  },
];

const roadmap = [
  {
    title: 'Graph Lab release documentation',
    zhTitle: 'Graph Lab 发布说明收尾',
    status: 'neutral',
    detail:
      'Finish Graph Lab public copy, help text, first-run guidance, and website download notes.',
    zhDetail: '完成 Graph Lab 公开文案、帮助说明、首次上手引导和官网下载说明。',
  },
  {
    title: 'Complete M7 publishing chain',
    zhTitle: '补齐七号发布链路',
    status: 'warn',
    detail:
      'Add macOS/Linux packaging, auto-update, GitHub Release draft, first-run onboarding, and cross-platform smoke verification.',
    zhDetail: '补齐 macOS / Linux 打包、自动更新、GitHub Release 草稿、首次启动引导和跨平台冒烟验收。',
  },
  {
    title: 'Extend Graph Lab visual editors',
    zhTitle: '扩展 Graph Lab 图形编辑器',
    status: 'neutral',
    detail:
      'Upgrade inline condition/effect fields into richer visual builders while keeping the same graphEditService command layer.',
    zhDetail: '把当前内联条件/效果字段升级为更完整的图形化构建器，同时继续复用 graphEditService 命令层。',
  },
  {
    title: 'Deploy this independent website',
    zhTitle: '部署独立官网',
    status: 'neutral',
    detail:
      'Build website/dist separately and deploy it to a server. Keep it excluded from desktop application packaging.',
    zhDetail: '单独构建官网目录并部署到服务器，继续排除在桌面应用安装包之外。',
  },
];

const status = {
  generatedAt: new Date().toISOString(),
  summary: {
    completed: metricValue('realCompleted', 132),
    total: metricValue('totalTasks', 142),
    rate: metricValue('realCompletionRate', 92.96),
    remaining: metricValue('remainingTasks', 9),
    deferred: 9,
    removed: 1,
    lastUpdated: metricValue('lastUpdated', '2026-06-23'),
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
