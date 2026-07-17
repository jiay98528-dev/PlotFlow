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
    title: '在画布上编排剧情分支，再把干净数据交给引擎。',
    subtitle:
      '维叙（Fablevia）面向独立游戏团队，默认用 Graph Lab 完成图形化创作，同时把所有内容可靠保存为开放的 .mdstory 纯文本。',
    primaryCta: '阅读使用说明',
    secondaryCta: '查看开发进度',
    status: 'Graph-first 源码态与全新 Windows 解包态自动门禁已通过；安装态、真实引擎 smoke、人工巡检和发行签名待完成。',
    loopTitle: '核心闭环',
    loop: '打开或创建 .mdstory → 默认进入 Graph Lab → 用画布与 Inspector 编排剧情 → 修复诊断 → 保存并导出 → 接入 Godot。',
    audiencesTitle: '服务写作、设计和程序交接',
    audiences: [
      { title: '独立游戏开发者', body: '默认用图形工作流管理剧情结构，同时保留一个本地纯文本文件，避免云端依赖和格式锁死。' },
      { title: '叙事设计师', body: '无需先学习语法，用画布、Inspector 和章节导航完成创作闭环。' },
      { title: '程序与引擎集成者', body: '拿到结构化 JSON 与 Godot 运行时约定，减少手工翻译。' },
    ],
    featureTitle: '已形成闭环的能力',
    features: [
      { title: 'Graph Lab 默认工作区', body: '用节点、连线、Inspector、章节标签与 Source Drawer 完成图优先创作。' },
      { title: '实时诊断', body: '错误、警告和建议同步到波浪线、问题面板和节点状态。' },
      { title: 'Split 源码投影', body: '顶栏并列保留完整 Monaco 源码视图，服务精确编辑、透明性与恢复。' },
      { title: '多格式导出', body: 'JSON / HTML / TXT 共用同一解析结果；JSON 使用 Schema 0.2，Error 诊断会阻断全部格式导出。' },
    ],
  },
  en: {
    eyebrow: 'A local-first branching narrative workspace',
    title: 'Shape branches on the canvas, then ship clean data to your engine.',
    subtitle:
      'Fablevia defaults to a complete Graph Lab workflow while saving every story to an open, local .mdstory text file.',
    primaryCta: 'Read the guide',
    secondaryCta: 'See development',
    status: 'Graph-first source and fresh Windows unpacked automation pass; installed-app, real engine smoke, manual patrol, and signing remain.',
    loopTitle: 'Core loop',
    loop: 'Open or create .mdstory → enter Graph Lab by default → shape the story with the canvas and Inspector → fix diagnostics → save and export → load in Godot.',
    audiencesTitle: 'Built for the handoff between writing, design, and implementation',
    audiences: [
      { title: 'Indie game developers', body: 'Use a visual workflow while keeping story data in one local text file without cloud lock-in.' },
      { title: 'Narrative designers', body: 'Create with the canvas, Inspector, and chapter navigation without learning syntax first.' },
      { title: 'Engine integrators', body: 'Use structured JSON and Godot runtime contracts instead of manual translation.' },
    ],
    featureTitle: 'Closed-loop capabilities',
    features: [
      { title: 'Graph Lab default workspace', body: 'Create graph-first with nodes, edges, Inspector, chapter tabs, and Source Drawer.' },
      { title: 'Live diagnostics', body: 'Errors, warnings, and suggestions appear in markers, panels, and node states.' },
      { title: 'Split source projection', body: 'A parallel full-source Monaco view remains available for precision, transparency, and recovery.' },
      { title: 'Multi-format export', body: 'JSON Schema 0.2, HTML playtest, and TXT review outputs share one parse result; Error diagnostics block export.' },
    ],
  },
};

export const officialThemes = {
  zh: {
    eyebrow: '官方免费主题',
    title: '官方免费主题库',
    intro: '维叙（Fablevia）只支持官方发布的代码主题。主题可以控制颜色、布局、尺寸、透明度、节点、连线、面板、动效和 Monaco 配色。',
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
      'Fablevia only supports official code themes. A theme may control color, layout, size, opacity, nodes, edges, panels, motion, and Monaco colors.',
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
  ['create', '创建故事', '新建或打开 .mdstory 后默认进入 Graph Lab；文件仍是唯一数据源。'],
  ['write', '在画布创建节点', '使用 Palette、节点卡片和 Inspector 创建章节、节点、正文、选项，以及六种类型和章节作用域变量。'],
  ['graph', '连接剧情走向', '在默认图优先画布上连接节点，检查分支、死胡同和孤立路径。'],
  ['conditions', '编辑条件', '用类型化左右操作数编辑 AND / OR / NOT 三层条件；支持 5 < $金币 等 literal-left 表达式并无损回写。'],
  ['diagnostics', '修复诊断', '根据错误、警告和建议修复语法与结构问题。'],
  ['themes', '切换官方主题', '在主题中心启用叙事工作台或下载官方免费主题。'],
  ['export', '导出交付', '先修复全部 Error，再导出 JSON Schema 0.2 / HTML / TXT 供程序、试玩和校对使用。'],
  ['godot', '接入引擎', 'Godot 与 Unity 运行时兼容 0.1/0.2，并按当前章节隔离 chapter scope 变量；Unreal 提供数据与 Blueprint 合同。'],
] as const;

const enGuideSections = [
  ['create', 'Create a story', 'New and existing .mdstory files open in Graph Lab by default; the file remains the source of truth.'],
  ['write', 'Create nodes on the canvas', 'Use the Palette, node cards, and Inspector to create chapters, nodes, body text, choices, and six typed or chapter-scoped variables.'],
  ['graph', 'Connect the story flow', 'Connect nodes on the default graph-first canvas and inspect branches, dead ends, and orphan paths.'],
  ['conditions', 'Edit conditions', 'Edit typed left/right operands with three-level AND / OR / NOT, including literal-left expressions such as 5 < $coins.'],
  ['diagnostics', 'Fix diagnostics', 'Resolve errors, warnings, and suggestions before export.'],
  ['themes', 'Switch official themes', 'Enable Narrative Workbench or download official free themes in Theme Center.'],
  ['export', 'Export handoff files', 'Resolve every Error, then export JSON Schema 0.2 / HTML / TXT for code, playtest, and review.'],
  ['godot', 'Load in an engine', 'Godot and Unity consume 0.1/0.2 with chapter-scoped state; Unreal provides data and Blueprint contracts.'],
] as const;

export const guide = {
  zh: {
    eyebrow: '使用说明',
    title: '维叙（Fablevia）使用说明',
    intro: '这份指南按默认 Graph-first 工作流组织：创建文件、画布编排、修复问题、保存并导出交付。',
    sections: zhGuideSections.map(([id, title, body]) => ({
      id,
      title,
      body,
      steps: ['打开维叙（Fablevia）', '完成当前步骤', '确认诊断面板没有阻断错误'],
      code: '',
      tip: '所有故事内容仍保存在 .mdstory 文本文件中。',
    })),
  },
  en: {
    eyebrow: 'User guide',
    title: 'Fablevia guide',
    intro: 'The guide follows the default Graph-first workflow: create, shape on the canvas, fix, save, and export.',
    sections: enGuideSections.map(([id, title, body]) => ({
      id,
      title,
      body,
      steps: ['Open Fablevia', 'Complete the step', 'Confirm there are no blocking diagnostics'],
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
