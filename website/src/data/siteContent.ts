import type { Locale } from '../types';

export const locales: Locale[] = ['zh', 'en'];

export const navigation = {
  zh: [
    { label: '首页', path: '/' },
    { label: '使用说明', path: '/guide/' },
    { label: '开发进度', path: '/development/' },
  ],
  en: [
    { label: 'Home', path: '/' },
    { label: 'Guide', path: '/guide/' },
    { label: 'Development', path: '/development/' },
  ],
};

export const landing = {
  zh: {
    eyebrow: '本地优先的叙事分支工作台',
    title: '把剧情分支写清楚、看清楚，再交给引擎运行。',
    subtitle:
      'PlotFlow 面向独立游戏团队，把 .mdstory 源文件、Graph Lab、实时诊断、条件编辑和 JSON / HTML / TXT 导出收束到一个离线桌面工具。',
    primaryCta: '阅读使用说明',
    secondaryCta: '查看开发进度',
    status: '当前无已知阻断 BUG；Windows 包、Graph Lab 和主题平台持续收敛。',
    loopTitle: '核心闭环',
    loop: '打开或创建 .mdstory → 编写节点与选项 → 在 Graph Lab 检查走向 → 修复诊断 → 导出 JSON / HTML / TXT → 接入 Godot。',
    audiencesTitle: '服务写作、设计和程序交接',
    audiences: [
      { title: '独立游戏开发者', body: '用一个本地文本文件管理剧情结构，避免云端依赖和格式锁死。' },
      { title: '叙事设计师', body: '保留 Markdown 写作体验，同时用流程图检查路径、死胡同和条件逻辑。' },
      { title: '程序与引擎集成者', body: '拿到结构化 JSON 与 Godot 运行时约定，减少手工翻译。' },
    ],
    featureTitle: '已形成闭环的能力',
    features: [
      { title: 'Split 双投影', body: 'Monaco 文本编辑器与 React Flow 分支图并排工作，源文本仍可直接打开。' },
      { title: '实时诊断', body: '错误、警告和建议同步到波浪线、问题面板和节点状态。' },
      { title: 'Graph Lab', body: '图优先入口支持节点、连线、Inspector 与 Source Drawer。' },
      { title: '多格式导出', body: '面向程序的 JSON、面向试玩的 HTML、面向校对的 TXT 共用同一解析结果。' },
    ],
  },
  en: {
    eyebrow: 'A local-first branching narrative workspace',
    title: 'Write the branch, see the branch, ship it to your engine.',
    subtitle:
      'PlotFlow brings .mdstory files, Graph Lab, diagnostics, visual conditions, and JSON / HTML / TXT export into one offline desktop tool.',
    primaryCta: 'Read the guide',
    secondaryCta: 'See development',
    status: 'No known blocking bugs; Windows packaging, Graph Lab, and the theme platform continue to converge.',
    loopTitle: 'Core loop',
    loop: 'Open or create .mdstory → write nodes and choices → inspect Graph Lab → fix diagnostics → export JSON / HTML / TXT → load in Godot.',
    audiencesTitle: 'Built for the handoff between writing, design, and implementation',
    audiences: [
      { title: 'Indie game developers', body: 'Manage story structure in a local text file without cloud lock-in.' },
      { title: 'Narrative designers', body: 'Keep Markdown writing while checking paths, dead ends, and conditions visually.' },
      { title: 'Engine integrators', body: 'Use structured JSON and Godot runtime contracts instead of manual translation.' },
    ],
    featureTitle: 'Closed-loop capabilities',
    features: [
      { title: 'Split projection', body: 'Monaco text editing and React Flow graph views stay synchronized.' },
      { title: 'Live diagnostics', body: 'Errors, warnings, and suggestions appear in markers, panels, and node states.' },
      { title: 'Graph Lab', body: 'A graph-first entry with nodes, edges, Inspector, and Source Drawer.' },
      { title: 'Multi-format export', body: 'JSON for code, HTML for playtest, and TXT for review share one parse result.' },
    ],
  },
};

export const officialThemes = {
  zh: {
    eyebrow: '官方免费主题',
    title: '官方免费主题库',
    intro: 'PlotFlow 只支持官方发布的代码主题。主题可以控制颜色、布局、尺寸、透明度、节点、连线、面板、动效和 Monaco 配色。',
    storeCta: '浏览官方免费主题',
    note: '当前主题均标注为免费主题；不提供本地导入或非官方来源。',
    items: [
      {
        id: 'plotflow-narrative-workbench',
        name: '叙事工作台',
        alias: 'Narrative Workbench',
        tone: '免费主题 · 内置',
        body: '默认官方主题，强调清晰节点、稳定连线和适合长时间写作的工作台布局。',
      },
      {
        id: 'plotflow-neon-dossier',
        name: '霓虹档案',
        alias: 'Neon Dossier',
        tone: '免费主题 · 官方远程',
        body: '用于验证 registry、下载、校验、安装、注册和启用链路的官方远程 smoke 主题。',
      },
    ],
  },
  en: {
    eyebrow: 'Official Free Themes',
    title: 'Official free theme library',
    intro:
      'PlotFlow only supports official code themes. A theme may control color, layout, size, opacity, nodes, edges, panels, motion, and Monaco colors.',
    storeCta: 'Browse official free themes',
    note: 'All current themes are labeled free themes; local import and non-official sources are not exposed.',
    items: [
      {
        id: 'plotflow-narrative-workbench',
        name: 'Narrative Workbench',
        alias: '叙事工作台',
        tone: 'Free theme · Built in',
        body: 'The default official theme for readable nodes, stable edges, and long writing sessions.',
      },
      {
        id: 'plotflow-neon-dossier',
        name: 'Neon Dossier',
        alias: '霓虹档案',
        tone: 'Free theme · Official remote',
        body: 'A smoke theme that verifies registry, download, hash check, install, register, and enable flow.',
      },
    ],
  },
};

const zhGuideSections = [
  ['create', '创建故事', '从新建或打开 .mdstory 文件开始，文件就是唯一数据源。'],
  ['write', '编写节点', '使用“# 节点：”和“[选项]”组织剧情分支。'],
  ['graph', '检查 Graph Lab', '进入图优先画布，检查节点连接、走向和孤立分支。'],
  ['conditions', '编辑条件', '用面板编辑变量、比较器、AND / OR 条件并回写文本。'],
  ['diagnostics', '修复诊断', '根据错误、警告和建议修复语法与结构问题。'],
  ['themes', '切换官方主题', '在主题中心启用叙事工作台或下载官方免费主题。'],
  ['export', '导出交付', '导出 JSON / HTML / TXT 供程序、试玩和校对使用。'],
  ['godot', '接入 Godot', '使用 Godot 运行时约定读取导出的结构化 JSON。'],
] as const;

const enGuideSections = [
  ['create', 'Create a story', 'Start from a new or existing .mdstory file. The file is the source of truth.'],
  ['write', 'Write nodes', 'Use “# Node:” and “[Choice]” syntax to organize branches.'],
  ['graph', 'Inspect Graph Lab', 'Use the graph-first canvas to check links, direction, and orphan branches.'],
  ['conditions', 'Edit conditions', 'Edit variables, operators, and AND / OR conditions in panels.'],
  ['diagnostics', 'Fix diagnostics', 'Resolve errors, warnings, and suggestions before export.'],
  ['themes', 'Switch official themes', 'Enable Narrative Workbench or download official free themes in Theme Center.'],
  ['export', 'Export handoff files', 'Export JSON / HTML / TXT for code, playtest, and review.'],
  ['godot', 'Load in Godot', 'Use the Godot runtime contract to read structured JSON.'],
] as const;

export const guide = {
  zh: {
    eyebrow: '使用说明',
    title: 'PlotFlow 使用说明',
    intro: '这份指南按真实工作流组织：创建文件、编写节点、检查分支、修复问题、导出交付。',
    sections: zhGuideSections.map(([id, title, body]) => ({
      id,
      title,
      body,
      steps: ['打开 PlotFlow', '完成当前步骤', '确认诊断面板没有阻断错误'],
      code: '',
      tip: '所有故事内容仍保存在 .mdstory 文本文件中。',
    })),
  },
  en: {
    eyebrow: 'User guide',
    title: 'PlotFlow guide',
    intro: 'The guide follows the real workflow: create, write, inspect, fix, and export.',
    sections: enGuideSections.map(([id, title, body]) => ({
      id,
      title,
      body,
      steps: ['Open PlotFlow', 'Complete the step', 'Confirm there are no blocking diagnostics'],
      code: '',
      tip: 'Story content remains in the .mdstory text file.',
    })),
  },
};

export const developmentCopy = {
  zh: {
    eyebrow: '开发进度',
    title: '真实发行状态',
    intro: '进度页面读取生成数据，展示当前门禁、稳定能力和路线图。',
    sourceNote: '数据由项目进度文档和 progress-dashboard 生成，页面构建前需运行 sync:data。',
    gatesTitle: '发行门禁',
    milestonesTitle: '里程碑',
    stableTitle: '稳定能力',
    experimentalTitle: '实验能力',
    roadmapTitle: '路线图',
  },
  en: {
    eyebrow: 'Development',
    title: 'Current release status',
    intro: 'This page reads generated data for gates, stable features, and roadmap.',
    sourceNote: 'Data is generated from project progress docs and progress-dashboard. Run sync:data before building the site.',
    gatesTitle: 'Release gates',
    milestonesTitle: 'Milestones',
    stableTitle: 'Stable features',
    experimentalTitle: 'Experimental features',
    roadmapTitle: 'Roadmap',
  },
};
