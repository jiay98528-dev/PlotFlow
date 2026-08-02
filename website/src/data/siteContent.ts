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
    eyebrow: '官方内置主题',
    title: '三套随应用交付的主题',
    intro: '维叙（Fablevia）0.1.1 只启用随应用编译交付的官方主题。主题可以控制颜色、布局、节点、连线、面板、动效和 Monaco 配色。',
    storeCta: '查看三个内置主题',
    note: '远程主题 registry、下载、安装和代码加载已暂停；不提供本地导入或非官方来源。',
    items: [
      {
        id: 'plotflow-prism-foundry',
        name: '棱镜铸造台',
        alias: 'Prism Foundry',
        tone: '内置 · 默认',
        body: '默认亮色主题，以冷白棱镜、紫罗兰控制与青色信号组织图优先工作区。',
      },
      {
        id: 'plotflow-narrative-workbench',
        name: '叙事工作台',
        alias: 'Narrative Workbench',
        tone: '内置',
        body: '强调清晰节点、稳定连线和适合长时间写作的纸张工作台布局。',
      },
      {
        id: 'plotflow-engine-telemetry',
        name: '引擎遥测台',
        alias: 'Engine Telemetry',
        tone: '内置',
        body: '以石墨暗面、青绿信号线和琥珀状态光呈现紧凑的引擎控制台。',
      },
    ],
  },
  en: {
    eyebrow: 'Official Bundled Themes',
    title: 'Three themes shipped with the app',
    intro:
      'Fablevia 0.1.1 enables only official themes compiled and shipped with the app. Themes may control color, layout, nodes, edges, panels, motion, and Monaco colors.',
    storeCta: 'View the three bundled themes',
    note: 'Remote registry, download, installation, and code loading are paused. Local imports and unofficial sources are not available.',
    items: [
      {
        id: 'plotflow-prism-foundry',
        name: 'Prism Foundry',
        alias: '棱镜铸造台',
        tone: 'Built in · Default',
        body: 'The default light theme, organizing the graph-first workspace with cold-white prisms, violet controls, and cyan signals.',
      },
      {
        id: 'plotflow-narrative-workbench',
        name: 'Narrative Workbench',
        alias: '叙事工作台',
        tone: 'Built in',
        body: 'A paper workbench for readable nodes, stable edges, and long writing sessions.',
      },
      {
        id: 'plotflow-engine-telemetry',
        name: 'Engine Telemetry',
        alias: '引擎遥测台',
        tone: 'Built in',
        body: 'A compact engine console using graphite surfaces, cyan signal lines, and amber status lights.',
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
  ['themes', '切换内置主题', '在主题中心选择棱镜铸造台、叙事工作台或引擎遥测台。远程主题在 0.1.1 中暂停。'],
  ['export', '导出交付', '先修复全部 Error，再导出 JSON Schema 0.2 / HTML / TXT 供程序、试玩和校对使用。'],
  ['godot', '接入引擎', 'Godot 与 Unity 运行时兼容 0.1/0.2，并按当前章节隔离 chapter scope 变量；Unreal 提供数据与 Blueprint 合同。'],
] as const;

const enGuideSections = [
  ['create', 'Create a story', 'New and existing .mdstory files open in Graph Lab by default; the file remains the source of truth.'],
  ['write', 'Create nodes on the canvas', 'Use the Palette, node cards, and Inspector to create chapters, nodes, body text, choices, and six typed or chapter-scoped variables.'],
  ['graph', 'Connect the story flow', 'Connect nodes on the default graph-first canvas and inspect branches, dead ends, and orphan paths.'],
  ['conditions', 'Edit conditions', 'Edit typed left/right operands with three-level AND / OR / NOT, including literal-left expressions such as 5 < $coins.'],
  ['diagnostics', 'Fix diagnostics', 'Resolve errors, warnings, and suggestions before export.'],
  ['themes', 'Switch bundled themes', 'Choose Prism Foundry, Narrative Workbench, or Engine Telemetry in Theme Center. Remote themes are paused in 0.1.1.'],
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
