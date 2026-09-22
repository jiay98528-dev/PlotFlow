import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const progress = await readFile(path.join(repoRoot, 'spec/progress.md'), 'utf8');
const product = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
const releaseGates = progress
  .split(/\r?\n/)
  .filter((line) => /^\| `(?:pnpm\.cmd|node\.exe)/.test(line))
  .map((line) => {
    const [name, result, detail] = line
      .split('|')
      .slice(1, -1)
      .map((value) => value.trim().replace(/^`|`$/g, ''));
    return {
      name,
      zhName: name,
      result,
      zhResult: result,
      detail,
      zhDetail: detail,
      status: result === 'PASS' ? 'pass' : result === 'FAIL' ? 'risk' : 'neutral',
    };
  });
const feature = (title, zhTitle, detail, zhDetail) => ({
  title,
  zhTitle,
  detail,
  zhDetail,
  status: 'pass',
  evidence: '',
  zhEvidence: '',
});
const status = {
  generatedAt: new Date().toISOString(),
  summary: {
    version: product.version,
    channel: product.releaseChannel,
    lastUpdated: progress.match(/更新：(\d{4}-\d{2}-\d{2})/)?.[1] ?? '',
  },
  releaseGates,
  stableFeatures: [
    feature(
      'Graph Lab',
      '图优先创作',
      'Create nodes, choices, conditions and variables on the canvas.',
      '在画布中编排节点、选项、条件和变量。',
    ),
    feature(
      'Open story files',
      '开放故事文件',
      'Graph Lab and Split edit the same local .mdstory file.',
      'Graph Lab 和 Split 编辑同一个本地 .mdstory 文件。',
    ),
    feature(
      'Export',
      '多格式导出',
      'Export JSON Schema 0.2, playable HTML and TXT.',
      '导出 JSON Schema 0.2、可试玩 HTML 和 TXT。',
    ),
    feature(
      'Bundled themes',
      '三套内置主题',
      'Prism Foundry, Narrative Workbench and Engine Telemetry.',
      '棱镜铸造台、叙事工作台和引擎遥测台。',
    ),
  ],
  experimentalFeatures: [],
  roadmap: [
    {
      title: 'Website and preview access',
      zhTitle: '官网与预览版获取',
      status: 'neutral',
      detail: 'Real product demos and a preview download path.',
      zhDetail: '真实产品演示和预览版获取入口。',
    },
    {
      title: 'Godot example',
      zhTitle: 'Godot 示例',
      status: 'neutral',
      detail: 'Complete a minimal story-to-engine example.',
      zhDetail: '完善从故事编辑到引擎运行的最小示例。',
    },
    {
      title: 'First-run guide',
      zhTitle: '首次启动引导',
      status: 'neutral',
      detail: 'Guide a new user through their first branch.',
      zhDetail: '帮助新用户完成第一个故事分支。',
    },
  ],
  sourceRefs: ['spec/progress.md'],
};
await writeFile(
  path.join(repoRoot, 'website/public/data/project-status.json'),
  `${JSON.stringify(status, null, 2)}\n`,
  'utf8',
);
console.log('Website status synchronized from spec/progress.md.');
