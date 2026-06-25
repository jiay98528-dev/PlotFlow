import type { Locale } from '../types';

export const locales: Locale[] = ['zh', 'en'];

export const navigation = {
  zh: [
    { label: '首页', path: '/' },
    { label: '使用说明', path: '/guide/' },
    { label: '开发', path: '/development/' },
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
      'PlotFlow 面向独立游戏团队，把 .mdstory 剧情源文件、实时流程图、条件编辑、错误检测和多格式导出收束到同一个离线桌面工具里。',
    primaryCta: '阅读使用说明',
    secondaryCta: '查看开发进度',
    status: '当前 Windows 正式包与核心发行门禁已通过；Graph Lab 已作为图优先核心入口接入。',
    loopTitle: '核心闭环',
    loop:
      '打开或创建 .mdstory → 编写节点与选项 → 在分支图检查走向 → 修复诊断 → 导出 JSON / HTML / TXT → 接入 Godot 或运行时。',
    audiencesTitle: '为三类用户降低沟通成本',
    audiences: [
      {
        title: '独立游戏开发者',
        body: '用一个本地文件管理剧情结构，避免工具锁死、云端依赖和导出格式不透明。',
      },
      {
        title: '叙事设计师',
        body: '在编辑器里写正文，同时用分支图检查路径、死胡同、孤立节点和条件逻辑。',
      },
      {
        title: '程序与引擎集成者',
        body: '拿到结构化 JSON 和 Godot 运行时约定，减少从文案到游戏逻辑的手工转译。',
      },
    ],
    featureTitle: '已经形成闭环的能力',
    features: [
      {
        title: 'Split 双栏编辑工作流',
        body: 'Monaco 文本编辑器与 React Flow 分支图并排工作，源文本仍可直接用普通编辑器打开。',
      },
      {
        title: '实时诊断',
        body: '错误、警告和建议会同步到波浪线、侧边标记、问题面板和节点状态。',
      },
      {
        title: '图形化条件编辑',
        body: '面板化编辑变量、比较运算与 AND / OR 条件，并回写为可读 .mdstory 文本。',
      },
      {
        title: '多格式导出',
        body: '面向程序的 JSON、面向试玩的 HTML、面向校对的 TXT，共用同一解析结果。',
      },
    ],
  },
  en: {
    eyebrow: 'A local-first branching narrative workspace',
    title: 'Write the branch, see the branch, ship it to your engine.',
    subtitle:
      'PlotFlow brings .mdstory text, live flow graphs, visual conditions, diagnostics, and multi-format export into one offline desktop tool for indie game teams.',
    primaryCta: 'Read the guide',
    secondaryCta: 'See development',
    status:
      'Windows local packaging and the core release gates currently pass; Graph Lab is now available as a graph-first core entry.',
    loopTitle: 'Core loop',
    loop:
      'Open or create a .mdstory file → write nodes and choices → inspect the graph → fix diagnostics → export JSON / HTML / TXT → load it in Godot or runtime code.',
    audiencesTitle: 'Built for the handoff between writing and implementation',
    audiences: [
      {
        title: 'Indie game developers',
        body: 'Keep branching stories in a local file without cloud lock-in or opaque export formats.',
      },
      {
        title: 'Narrative designers',
        body: 'Write prose in the editor while checking routes, dead ends, orphan nodes, and conditions in the graph.',
      },
      {
        title: 'Engine integrators',
        body: 'Use structured JSON and Godot runtime conventions instead of translating narrative documents by hand.',
      },
    ],
    featureTitle: 'Stable workflow capabilities',
    features: [
      {
        title: 'Split editing workflow',
        body: 'Monaco text editing and React Flow visualization work side by side while the source file stays readable.',
      },
      {
        title: 'Real-time diagnostics',
        body: 'Errors, warnings, and suggestions appear in markers, the problem panel, and graph node states.',
      },
      {
        title: 'Visual condition editing',
        body: 'Edit variables, comparisons, and AND/OR groups in a panel and write them back to .mdstory text.',
      },
      {
        title: 'Multi-format export',
        body: 'JSON for code, HTML for playable review, and TXT for proofreading share the same parsed story model.',
      },
    ],
  },
};

export const officialThemes = {
  zh: {
    eyebrow: '官方主题',
    title: '同一个故事文件，两套官方工作台气质',
    intro:
      'PlotFlow 当前只发行官方主题。主题会深度替换节点、线缆、面板、Monaco 配色和动效，不会修改 .mdstory 内容。',
    storeCta: '购买更多官方主题',
    note: '社区主题市场暂不开放；首版购买入口跳转官方商店。',
    items: [
      {
        id: 'plotflow-narrative-workbench',
        name: '叙事工作台',
        alias: 'Narrative Workbench',
        tone: '暖纸工作台 + 蓝图线缆',
        body: '默认官方主题，适合长时间剧情梳理、文本审校和团队交付。',
      },
      {
        id: 'plotflow-blueprint-nightwatch',
        name: '夜航蓝图',
        alias: 'Blueprint Nightwatch',
        tone: '低光编辑室 + 发光线缆',
        body: '官方深色主题，适合夜间工作和高密度 Graph Lab 图形编辑。',
      },
    ],
  },
  en: {
    eyebrow: 'Official themes',
    title: 'One story file, two official workbench moods',
    intro:
      'PlotFlow currently ships official themes only. Themes replace nodes, cables, panels, Monaco colors, and motion without changing .mdstory content.',
    storeCta: 'Buy more official themes',
    note: 'Community themes are not open yet; the first store entry opens the official website.',
    items: [
      {
        id: 'plotflow-narrative-workbench',
        name: 'Narrative Workbench',
        alias: '叙事工作台',
        tone: 'Warm paper workspace + blueprint cables',
        body: 'The default official theme for long-form plotting, review, and team handoff.',
      },
      {
        id: 'plotflow-blueprint-nightwatch',
        name: 'Blueprint Nightwatch',
        alias: '夜航蓝图',
        tone: 'Low-light studio + luminous cables',
        body: 'The official dark theme for night work and dense Graph Lab editing.',
      },
    ],
  },
};

export const guide = {
  zh: {
    eyebrow: '使用说明',
    title: '从第一份 .mdstory 到可交付导出',
    intro:
      '这份指南按实际用户旅程组织：先建立文件，再写节点、检查分支、修复问题，最后导出给引擎或团队成员。',
    sections: [
      {
        id: 'start',
        title: '1. 创建或打开故事文件',
        body:
          'PlotFlow 的磁盘真相源是 .mdstory 剧情源文件。它是 Markdown 方言文本，可以用 PlotFlow 编辑，也可以用普通文本编辑器查看。',
        steps: [
          '启动应用后选择新建文件、打开现有 .mdstory，或通过命令行/文件关联打开故事文件。',
          '优先从内置模板开始：角色扮演对话、视觉小说、解谜游戏或空白故事。',
          '保存后，后续编辑、图形状态、导出结果都从同一份 .mdstory 解析得到。',
        ],
        tip: '不要把 .mdstory 当成二进制工程文件；它应该能进入 Git、能被代码审阅、能被程序读取。',
      },
      {
        id: 'syntax',
        title: '2. 编写章节、节点和选项',
        body:
          '常用结构由章节标题、节点标题、正文和选项组成。节点是剧情跳转的最小单位，选项决定玩家能走向哪里。',
        steps: [
          '用章节组织大段剧情，用节点承载具体场景。',
          '在节点正文里写对白、旁白和行动描述。',
          '用选项行表达玩家选择，并指向目标节点。',
          '需要条件或效果时，把它们挂在选项下面，让解析器生成结构化数据。',
        ],
        code: '# 第一章\n## 节点：村口\n守卫拦住了你。\n\n[选项] 说明来意 -> 节点：守卫询问\n  [条件] $通行证数量 >= 1\n  [效果] $信任度 += 1',
      },
      {
        id: 'split',
        title: '3. 使用 Split 双栏工作台',
        body:
          '当前稳定工作流是左侧文本、右侧分支图。文本是高精度编辑入口，图形视图负责结构确认和导航。',
        steps: [
          '在左侧编辑器修改文本，等待解析管线刷新。',
          '右侧图会显示节点、选项连线和诊断状态。',
          '点击图上节点可跳回对应文本位置；拖拽连线会更新跳转目标。',
          '使用缩放、平移和重新布局检查大型剧情图。',
        ],
      },
      {
        id: 'diagnostics',
        title: '4. 处理错误、警告和建议',
        body:
          '诊断分为错误、警告和建议。错误通常会阻断可靠导出；警告常见于孤立节点、死胡同或潜在逻辑问题。',
        steps: [
          '查看编辑器波浪线和右侧节点颜色，定位问题发生在哪里。',
          '打开问题面板，按诊断代码跳转到具体文本位置。',
          '优先修复未定义目标、重复标识、条件语法错误等错误级问题。',
          '再处理孤立节点、死胡同和建议级质量问题。',
        ],
        tip: '如果图上状态和问题面板不一致，优先重新解析当前文件并保留复现文本；这是高价值回归样本。',
      },
      {
        id: 'conditions',
        title: '5. 图形化编辑条件',
        body:
          '条件编辑器适合把复杂真假逻辑交给非程序用户维护，同时保留可读的 .mdstory 文本。',
        steps: [
          '从选项或连线入口打开条件编辑器。',
          '选择变量、比较运算符和值，必要时组合 AND / OR。',
          '应用后检查生成文本是否符合团队约定。',
          '如果变量来自引擎插件模式，应以引擎同步的变量清单为准。',
        ],
      },
      {
        id: 'completion',
        title: '6. 使用本地补全',
        body:
          '幽灵补全基于本地 N-gram 和语料，不依赖联网。它适合补节点标题、选项句式、正文描述和变量名。',
        steps: [
          '看到灰色幽灵文本时，按 Tab 接受，按 Esc 忽略。',
          '在 $ 后触发变量名补全；在节点标题和选项文本中会使用不同候选来源。',
          '导入语料后，补全会更贴近团队自己的表达习惯。',
        ],
      },
      {
        id: 'export',
        title: '7. 导出 JSON / HTML / TXT',
        body:
          '导出前先确保错误级诊断已处理。三个导出格式面向不同协作者，但都来自同一份解析结果。',
        steps: [
          'JSON：给程序或运行时加载，遵循项目 JSON Schema。',
          'HTML：给策划、测试或外部成员快速试玩分支流程。',
          'TXT：给文本校对和非技术审阅使用。',
          '导出后用目标工具打开一次，确认编码、节点数量和跳转关系符合预期。',
        ],
      },
      {
        id: 'graph-lab',
        title: '8. 关于 Graph Lab',
        body:
          'Graph Lab 是“完全图形界面操控”的图优先核心入口，不替代当前稳定 Split 工作流。它把流程图、节点面板、检查器和源文本抽屉组织成完整 GUI 创作体验。',
        steps: [
          '在画布中拖拽节点会实时移动卡片，松手后把位置保存到 .mdstory 的 layout.graph.nodes 块。',
          '从选项端口拖线到已有节点会建立连接；拖到空白处会打开动作菜单，可创建普通节点、创建结局节点、搜索已有节点或取消。',
          '拖已有连接到空白处可断开此选项；所有 GUI 操作仍会序列化回 .mdstory，不引入数据库或专有二进制工程文件。',
          '当前已用 E2E 覆盖图形界面创建、编辑、节点位置持久化、连线、断开、Source Drawer 和 JSON 导出。',
        ],
      },
    ],
  },
  en: {
    eyebrow: 'User guide',
    title: 'From the first .mdstory file to a usable export',
    intro:
      'This guide follows the real workflow: create a file, write nodes, inspect branches, fix issues, and export for the engine or the team.',
    sections: [
      {
        id: 'start',
        title: '1. Create or open a story file',
        body:
          'The source of truth is a .mdstory file. It is Markdown-like text, editable in PlotFlow and readable in any text editor.',
        steps: [
          'Start the app and create a file, open an existing .mdstory, or launch one through the command line/file association.',
          'Start from a built-in template when possible: RPG dialogue, visual novel, puzzle escape, or blank story.',
          'After saving, editing state, graph state, and export output all come from the same parsed file.',
        ],
        tip: 'Treat .mdstory as source text: it should work in Git, code review, and runtime pipelines.',
      },
      {
        id: 'syntax',
        title: '2. Write chapters, nodes, and choices',
        body:
          'The common structure uses chapters, nodes, body text, and choices. Nodes are the smallest jump targets; choices decide where players go.',
        steps: [
          'Use chapters to organize large story regions.',
          'Use node bodies for dialogue, narration, and action.',
          'Use choice lines to express player decisions and target nodes.',
          'Attach conditions and effects under choices when logic is needed.',
        ],
        code: '# Chapter One\n## Node: Village Gate\nThe guard stops you.\n\n[Choice] Explain yourself -> Node: Guard Questions\n  [Condition] $has_pass == true\n  [Effect] $trust += 1',
      },
      {
        id: 'split',
        title: '3. Work in Split mode',
        body:
          'The stable workflow is text on the left and the branch graph on the right. Text is the precise editing surface; the graph is for structure, navigation, and review.',
        steps: [
          'Edit the source on the left and wait for the parser pipeline to refresh.',
          'Inspect nodes, choice edges, and diagnostic states on the right.',
          'Click graph nodes to jump back to source text; reconnect edges to update jump targets.',
          'Use zoom, pan, and relayout to review larger story maps.',
        ],
      },
      {
        id: 'diagnostics',
        title: '4. Fix errors, warnings, and suggestions',
        body:
          'Diagnostics are grouped into errors, warnings, and suggestions. Errors usually block reliable export; warnings often indicate orphan nodes, dead ends, or logic issues.',
        steps: [
          'Use editor markers and graph node colors to locate problems.',
          'Open the ProblemPanel and jump to the exact source range.',
          'Fix undefined targets, duplicate IDs, and condition syntax errors first.',
          'Then clean up orphan nodes, dead ends, and quality suggestions.',
        ],
        tip: 'If graph state and the problem list disagree, keep the source text as a regression sample.',
      },
      {
        id: 'conditions',
        title: '5. Edit conditions visually',
        body:
          'The condition editor lets non-programmers maintain boolean logic while preserving readable .mdstory text.',
        steps: [
          'Open it from a choice or edge entry point.',
          'Pick a variable, operator, and value; combine rules with AND / OR when needed.',
          'Apply the change and review the generated text.',
          'In engine-plugin mode, variables should come from the engine-provided list.',
        ],
      },
      {
        id: 'completion',
        title: '6. Use local completion',
        body:
          'Ghost text completion is local and N-gram based. It helps with node titles, choice phrasing, prose, and variables without requiring network calls.',
        steps: [
          'Press Tab to accept ghost text or Esc to ignore it.',
          'Use $ to trigger variable completion.',
          'Importing team corpus data makes suggestions closer to your writing style.',
        ],
      },
      {
        id: 'export',
        title: '7. Export JSON / HTML / TXT',
        body:
          'Before export, resolve error-level diagnostics. The three export formats serve different collaborators but use the same parsed story model.',
        steps: [
          'JSON is for code and runtime loading, following the project JSON Schema.',
          'HTML is for playable review by designers, testers, or external collaborators.',
          'TXT is for proofreading and non-technical review.',
          'Open the exported file once in the target tool and verify encoding, node count, and links.',
        ],
      },
      {
        id: 'graph-lab',
        title: '8. About Graph Lab',
        body:
          'Graph Lab is the graph-first GUI entry. It does not replace the current Split workflow.',
        steps: [
          'Dragging a node moves it live and saves its position into the .mdstory layout.graph.nodes block on release.',
          'Dragging from a choice port to an existing node connects it; dropping on blank space opens a menu to create, search, connect, or cancel.',
          'Dragging an existing connection to blank space can disconnect the choice. All GUI operations still serialize back to .mdstory without a database or proprietary project file.',
          'Current E2E coverage includes GUI create/edit, position persistence, connect, disconnect, Source Drawer, and JSON export.',
        ],
      },
    ],
  },
};

export const developmentCopy = {
  zh: {
    eyebrow: '开发透明度',
    title: '当前进度、稳固能力与实验边界',
    intro:
      '这个页面面向试用用户和协作者，直接说明哪些能力已通过当前门禁，哪些仍是发布收尾或发行后续任务。',
    stableTitle: '当前无已知阻断 BUG 的稳固能力',
    experimentalTitle: '可能仍有风险的实验性能力',
    roadmapTitle: '后续开发规划',
    gatesTitle: '发行门禁',
    milestonesTitle: '零号至七号里程碑',
    sourceNote: '数据由项目进度文档和 progress-dashboard 生成，页面构建前需运行 sync:data。',
  },
  en: {
    eyebrow: 'Development transparency',
    title: 'Progress, stable surfaces, and experimental edges',
    intro:
      'This page is for testers and collaborators: it separates what currently passes release gates from what remains experimental or deferred.',
    stableTitle: 'Stable surfaces with no known blocking bugs',
    experimentalTitle: 'Experimental or risk-accepted areas',
    roadmapTitle: 'Roadmap',
    gatesTitle: 'Release gates',
    milestonesTitle: 'M0-M7 milestones',
    sourceNote:
      'Data is generated from project progress docs and progress-dashboard. Run sync:data before building the site.',
  },
};
