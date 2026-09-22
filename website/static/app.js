(function () {
  const fallbackStatus = {
    generatedAt: 'not-generated',
    summary: { version: '—', channel: '—', lastUpdated: '—' },
    releaseGates: [], stableFeatures: [], experimentalFeatures: [], roadmap: []
  };

  const content = {
    zh: {
      nav: ['首页', '使用说明', '开发'],
      home: {
        eyebrow: '本地优先的叙事分支工作台',
        title: '在画布上编排剧情分支，再把干净数据交给引擎。',
        subtitle:
          '维叙（Fablevia）面向独立游戏团队，默认用 Graph Lab 完成图形化创作，同时把所有内容可靠保存为开放的 .mdstory 纯文本。',
        primary: '阅读使用说明',
        secondary: '查看开发进度',
        status: 'Windows 本地创作 · 开放故事文件 · JSON / HTML / TXT 导出',
        loopTitle: '核心闭环',
        loop:
          '打开或创建 .mdstory → 默认进入 Graph Lab → 用画布与 Inspector 编排剧情 → 修复诊断 → 保存并导出 → 接入 Godot 或运行时。',
        featuresTitle: '已经形成闭环的能力',
        features: [
          ['Graph Lab 默认工作区', '用节点、连线、Inspector、章节标签和 Source Drawer 完成图优先创作。'],
          ['实时诊断', '错误、警告和建议会同步到波浪线、侧边标记、问题面板和节点状态。'],
          ['Split 源码投影', '顶栏并列保留完整 Monaco 源码视图，服务精确编辑、透明性与恢复。'],
          ['多格式导出', '面向程序的 JSON、面向试玩的 HTML、面向校对的 TXT，共用同一解析结果。'],
        ],
        audienceTitle: '为三类用户降低沟通成本',
        audiences: [
          ['独立游戏开发者', '默认用图形工作流管理剧情结构，同时保留一个本地纯文本文件，避免工具锁死和云端依赖。'],
          ['叙事设计师', '无需先学习语法，用画布、Inspector 和章节导航完成创作闭环。'],
          ['程序与引擎集成者', '拿到结构化 JSON 和 Godot 运行时约定，减少从文案到游戏逻辑的手工转译。'],
        ],
      },
      guide: {
        eyebrow: '使用说明',
        title: '从第一份 .mdstory 到可交付导出',
        intro: '这份指南按默认 Graph-first 旅程组织：创建文件、画布编排、修复问题、保存并导出给引擎或团队成员。',
        sections: [
          ['创建或打开故事文件', '维叙（Fablevia）的磁盘真相源是 .mdstory 剧情源文件；首次启动、新建、打开和继续编辑默认进入 Graph Lab。', ['启动应用后选择新建文件、打开现有 .mdstory，或通过命令行/文件关联打开故事文件。', '确认默认显示 Graph Lab 画布；文件仍可用普通文本编辑器查看。', '保存后，后续编辑、图形状态、导出结果都从同一份 .mdstory 解析得到。']],
          ['在 Graph Lab 编排剧情', '使用 Palette、节点卡片、连线和 Inspector 创建章节、节点、正文与选项。', ['用章节标签组织大段剧情。', '在 Inspector 中写对白、旁白和行动描述。', '拖线连接目标节点，并在字段化面板维护条件和效果。', '通过诊断入口检查死胡同、孤立节点和语法问题。']],
          ['按需使用 Split 源码投影', 'Split 在顶栏并列保留，提供完整 .mdstory 的精确编辑、透明性与恢复能力，但不是默认工作区。', ['显式切换到 Split 查看完整文件。', '修改文本后等待解析管线同步 Graph Lab。', '确认图形编辑与源码编辑始终落回同一文件。', '完成高级源码操作后可随时返回 Graph Lab。']],
          ['处理错误、警告和建议', '诊断分为错误、警告和建议。错误通常会阻断可靠导出；警告常见于孤立节点、死胡同或潜在逻辑问题。', ['查看编辑器波浪线和右侧节点颜色，定位问题发生在哪里。', '打开问题面板，按诊断代码跳转到具体文本位置。', '优先修复未定义目标、重复标识、条件语法错误等错误级问题。', '再处理孤立节点、死胡同和建议级质量问题。']],
          ['图形化编辑条件', '条件编辑器适合把复杂布尔逻辑交给非程序用户维护，同时保留可读的 .mdstory 文本。', ['从选项或连线入口打开条件编辑器。', '选择变量、比较运算符和值，必要时组合 AND / OR。', '应用后检查生成文本是否符合团队约定。', '如果变量来自引擎插件模式，应以引擎同步的变量清单为准。']],
          ['使用本地补全', '幽灵补全基于本地 N-gram 和语料，不依赖联网。它适合补节点标题、选项句式、正文描述和变量名。', ['看到灰色幽灵文本时，按 Tab 接受，按 Esc 忽略。', '在 $ 后触发变量名补全；在节点标题和选项文本中会使用不同候选来源。', '导入语料后，补全会更贴近团队自己的表达习惯。']],
          ['导出 JSON / HTML / TXT', '导出前先确保错误级诊断已处理。三个导出格式面向不同协作者，但都来自同一份解析结果。', ['JSON 给程序或运行时加载，遵循项目 JSON Schema。', 'HTML 给策划、测试或外部成员快速试玩分支流程。', 'TXT 给文本校对和非技术审阅使用。', '导出后用目标工具打开一次，确认编码、节点数量和跳转关系符合预期。']],
          ['关于 Graph Lab', 'Graph Lab 是主要且默认的“完全图形界面操控”工作区；Split 是并列保留的辅助源码投影。', ['首次启动、新建、打开和继续编辑默认进入 Graph Lab。', '所有 GUI 操作仍序列化回 .mdstory，不引入数据库或专有二进制工程文件。', '发行门禁必须验证不进入 Split 的真实 Graph-first 保存、重启、诊断与导出闭环。']],
        ],
      },
      development: {
        eyebrow: '开发透明度',
        title: '当前进度、稳固能力与实验边界',
        intro: '这个页面面向试用用户和协作者，直接说明哪些能力已通过当前门禁，哪些仍是发布收尾或发行后续任务。',
        gates: '发行门禁',        stable: '当前已通过自动门禁的稳固能力',
        experimental: '可能仍有风险的实验性能力',
        roadmap: '后续开发规划',
      },
    },
    en: {
      nav: ['Home', 'Guide', 'Development'],
      home: {
        eyebrow: 'A local-first branching narrative workspace',
        title: 'Shape branches on the canvas, then ship clean data to your engine.',
        subtitle:
          'Fablevia defaults to a complete Graph Lab workflow while saving every story to an open, local .mdstory text file.',
        primary: 'Read the guide',
        secondary: 'See development',
        status: 'Local Windows workspace · Open story files · JSON / HTML / TXT export',
        loopTitle: 'Core loop',
        loop:
          'Open or create .mdstory → enter Graph Lab by default → shape the story with the canvas and Inspector → fix diagnostics → save and export → load it in Godot or runtime code.',
        featuresTitle: 'Stable workflow capabilities',
        features: [
          ['Graph Lab default workspace', 'Create graph-first with nodes, edges, Inspector, chapter tabs, and Source Drawer.'],
          ['Real-time diagnostics', 'Errors, warnings, and suggestions appear in markers, the problem panel, and graph node states.'],
          ['Split source projection', 'A parallel full-source Monaco view remains available for precision, transparency, and recovery.'],
          ['Multi-format export', 'JSON for code, HTML for playable review, and TXT for proofreading share the same parsed story model.'],
        ],
        audienceTitle: 'Built for the handoff between writing and implementation',
        audiences: [
          ['Indie game developers', 'Use a visual workflow while keeping branching stories in one local text file without cloud lock-in.'],
          ['Narrative designers', 'Create with the canvas, Inspector, and chapter navigation without learning syntax first.'],
          ['Engine integrators', 'Use structured JSON and Godot runtime conventions instead of translating narrative documents by hand.'],
        ],
      },
      guide: {
        eyebrow: 'User guide',
        title: 'From the first .mdstory file to a usable export',
        intro: 'This guide follows the default Graph-first workflow: create, shape on the canvas, fix, save, and export for the engine or the team.',
        sections: [
          ['Create or open a story file', 'The source of truth is a .mdstory file; first launch, new, open, and Continue editing land in Graph Lab by default.', ['Create a file, open an existing .mdstory, or launch one through the command line/file association.', 'Confirm the Graph Lab canvas is the default surface; the file remains readable in any text editor.', 'After saving, editing state, graph state, and export output all come from the same parsed file.']],
          ['Shape the story in Graph Lab', 'Use the Palette, node cards, edges, and Inspector to create chapters, nodes, body text, and choices.', ['Organize regions with chapter tabs.', 'Write dialogue, narration, and action in the Inspector.', 'Connect target nodes and maintain conditions and effects in structured controls.', 'Use diagnostics to find dead ends, orphan nodes, and syntax issues.']],
          ['Use the Split source projection when needed', 'Split remains parallel in the top bar for full-source precision, transparency, and recovery, but it is not the default workspace.', ['Explicitly switch to Split to inspect the complete file.', 'Wait for source edits to synchronize back to Graph Lab.', 'Confirm graphical and source edits always return to the same file.', 'Return to Graph Lab after advanced source work.']],
          ['Fix errors, warnings, and suggestions', 'Diagnostics are grouped into errors, warnings, and suggestions. Errors usually block reliable export; warnings often indicate orphan nodes, dead ends, or logic issues.', ['Use editor markers and graph node colors to locate problems.', 'Open the ProblemPanel and jump to the exact source range.', 'Fix undefined targets, duplicate IDs, and condition syntax errors first.', 'Then clean up orphan nodes, dead ends, and quality suggestions.']],
          ['Edit conditions visually', 'The condition editor lets non-programmers maintain boolean logic while preserving readable .mdstory text.', ['Open it from a choice or edge entry point.', 'Pick a variable, operator, and value; combine rules with AND / OR when needed.', 'Apply the change and review the generated text.', 'In engine-plugin mode, variables should come from the engine-provided list.']],
          ['Use local completion', 'Ghost text completion is local and N-gram based. It helps with node titles, choice phrasing, prose, and variables without requiring network calls.', ['Press Tab to accept ghost text or Esc to ignore it.', 'Use $ to trigger variable completion.', 'Importing team corpus data makes suggestions closer to your writing style.']],
          ['Export JSON / HTML / TXT', 'Before export, resolve error-level diagnostics. The three export formats serve different collaborators but use the same parsed story model.', ['JSON is for code and runtime loading, following the project JSON Schema.', 'HTML is for playable review by designers, testers, or external collaborators.', 'TXT is for proofreading and non-technical review.', 'Open the exported file once in the target tool and verify encoding, node count, and links.']],
          ['About Graph Lab', 'Graph Lab is the primary and default full-GUI workspace; Split remains a parallel auxiliary source projection.', ['First launch, new, open, and Continue editing land in Graph Lab by default.', 'Every GUI command still serializes back to .mdstory without a database or proprietary binary project file.', 'Release gates must prove a real Graph-first save, restart, diagnostics, and export journey without entering Split.']],
        ],
      },
      development: {
        eyebrow: 'Development transparency',
        title: 'Progress, stable surfaces, and experimental edges',
        intro: 'This page is for testers and collaborators: it separates what currently passes release gates from what remains experimental or deferred.',
        gates: 'Release gates',        stable: 'Stable surfaces that pass current automated gates',
        experimental: 'Experimental or risk-accepted areas',
        roadmap: 'Roadmap',
      },
    },
  };

  const state = {
    locale: localStorage.getItem('plotflow-static-locale') || 'zh',
    page: location.hash.replace('#', '') || 'home',
    status: fallbackStatus,
  };

  const app = document.getElementById('app');

  function esc(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function localizedGate(gate) {
    if (state.locale !== 'zh') {
      return gate;
    }
    return {
      ...gate,
      name: gate.zhName || gate.name,
      result: gate.zhResult || (gate.result === 'PASS' ? '通过' : gate.result),
      detail: gate.zhDetail || gate.detail,
    };
  }

  function localizedFeature(item) {
    if (state.locale !== 'zh') {
      return item;
    }
    return {
      ...item,
      title: item.zhTitle || item.title,
      detail: item.zhDetail || item.detail,
      evidence: item.zhEvidence || item.evidence || '',
    };
  }

  function localizedRoadmap(item) {
    if (state.locale !== 'zh') {
      return item;
    }
    return {
      ...item,
      title: item.zhTitle || item.title,
      detail: item.zhDetail || item.detail,
    };
  }

  function setPage(page) {
    state.page = page;
    location.hash = page === 'home' ? '' : page;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setLocale(locale) {
    state.locale = locale;
    localStorage.setItem('plotflow-static-locale', locale);
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title =
      locale === 'zh'
        ? '维叙（Fablevia）- 叙事分支工作台'
        : 'Fablevia - Narrative Branching Workspace';
    render();
  }

  function header() {
    const t = content[state.locale];
    const navTargets = ['home', 'guide', 'development'];
    return `
      <header class="site-header">
        <button class="brand-mark" data-page="home" type="button">
          <img class="brand-mark__icon" src="./fablevia-icon.svg" alt="" aria-hidden="true">
          <span class="brand-lockup brand-lockup--${state.locale}" aria-label="${state.locale === 'zh' ? '维叙（Fablevia）' : 'Fablevia'}"><strong>${state.locale === 'zh' ? '维叙' : 'Fablevia'}</strong>${state.locale === 'zh' ? '<small>Fablevia</small>' : ''}</span>
        </button>
        <nav class="nav-links" aria-label="${state.locale === 'zh' ? '主导航' : 'Main navigation'}">
          ${t.nav
            .map(
              (label, index) =>
                `<button class="${state.page === navTargets[index] ? 'is-active' : ''}" data-page="${navTargets[index]}" type="button">${label}</button>`,
            )
            .join('')}
        </nav>
        <div class="language-switch" aria-label="${state.locale === 'zh' ? '语言切换' : 'Language switch'}">
          <span>${state.locale === 'zh' ? '语言' : 'Lang'}</span>
          <button class="${state.locale === 'zh' ? 'is-active' : ''}" data-locale="zh" type="button">中</button>
          <button class="${state.locale === 'en' ? 'is-active' : ''}" data-locale="en" type="button">英</button>
        </div>
      </header>
    `;
  }

  function whiteboard() {
    const labels =
      state.locale === 'zh'
        ? {
            aria: '维叙（Fablevia）界面预览',
            file: '第一章.mdstory',
            saved: '已自动保存',
            chapter: '第一章',
            node: '节点：村口',
            body: '守卫拦住了月光下的道路。',
            choiceA: '[选项] 出示通行证 -> 节点：城门开启',
            condition: '[条件] $通行证数量 >= 1',
            choiceB: '[选项] 走森林小路 -> 节点：古松林',
            warningCode: '警告二号',
            warning: '发现未续写分支',
            mainNode: '村口',
            mainNodeMeta: '两个选项',
            okNode: '城门开启',
            okNodeMeta: '有条件',
            warnNode: '古松林',
            warnNodeMeta: '死胡同',
            exportA: 'JSON',
            exportB: 'HTML 试玩',
            exportC: 'TXT 校对',
          }
        : {
            aria: 'Fablevia interface preview',
            file: 'chapter-one.mdstory',
            saved: 'autosaved',
            chapter: 'Chapter One',
            node: 'Node: Village Gate',
            body: 'The guard blocks the moonlit road.',
            choiceA: '[Choice] Show the pass -> Node: Gate Opens',
            condition: '[Condition] $has_pass == true',
            choiceB: '[Choice] Take the forest path -> Node: Old Pines',
            warningCode: 'W002',
            warning: 'Dead end detected',
            mainNode: 'Village Gate',
            mainNodeMeta: '2 choices',
            okNode: 'Gate Opens',
            okNodeMeta: 'conditioned',
            warnNode: 'Old Pines',
            warnNodeMeta: 'dead end',
            exportA: 'JSON',
            exportB: 'HTML playable',
            exportC: 'TXT review',
          };
    return `
      <div class="whiteboard" aria-label="${labels.aria}">
        <div class="whiteboard__rail"><span></span><span></span><span></span></div>
        <div class="whiteboard__editor">
          <div class="whiteboard__bar"><strong>${labels.file}</strong><span>${labels.saved}</span></div>
          <div class="whiteboard__code">
            <p class="muted"># ${labels.chapter}</p>
            <p>## ${labels.node}</p>
            <p>${labels.body}</p>
            <p>${labels.choiceA}</p>
            <p class="indent">${labels.condition}</p>
            <p>${labels.choiceB}</p>
          </div>
          <div class="whiteboard__problem"><span>${labels.warningCode}</span><strong>${labels.warning}</strong></div>
        </div>
        <div class="whiteboard__graph">
          <div class="node node--main"><span>${labels.mainNode}</span><small>${labels.mainNodeMeta}</small></div>
          <div class="edge edge--a"></div>
          <div class="edge edge--b"></div>
          <div class="node node--ok"><span>${labels.okNode}</span><small>${labels.okNodeMeta}</small></div>
          <div class="node node--warn"><span>${labels.warnNode}</span><small>${labels.warnNodeMeta}</small></div>
        </div>
        <div class="whiteboard__notes"><span>${labels.exportA}</span><span>${labels.exportB}</span><span>${labels.exportC}</span></div>
      </div>
    `;
  }

  function homePage() {
    const t = content[state.locale].home;
    return `
      <main>
        <section class="hero">
          <div class="hero__visual" aria-hidden="true">${whiteboard()}</div>
          <div class="hero__content">
            <p class="eyebrow">${t.eyebrow}</p>
            <h1>${t.title}</h1>
            <p class="hero__subtitle">${t.subtitle}</p>
            <div class="hero__actions">
              <button class="button button--primary" data-page="guide" type="button">${t.primary}</button>
              <button class="button button--secondary" data-page="development" type="button">${t.secondary}</button>
            </div>
            <div class="hero__status">
              <span>${t.status}</span>
            </div>
          </div>
        </section>
        <section class="section section--loop">
          <div class="section__intro"><p class="eyebrow">${t.loopTitle}</p><h2>${t.loop}</h2></div>
        </section>
        <section class="section">
          <div class="section__intro"><p class="eyebrow">${t.featuresTitle}</p><h2>${state.locale === 'zh' ? '默认在画布上完成创作，源码始终透明可控。' : 'Create on the canvas by default, with the source always transparent and controllable.'}</h2></div>
          <div class="feature-grid">${t.features.map(([title, body]) => `<article class="feature-item"><span class="mark"></span><h3>${title}</h3><p>${body}</p></article>`).join('')}</div>
        </section>
        <section class="section section--audience">
          <div class="section__intro"><p class="eyebrow">${t.audienceTitle}</p><h2>${state.locale === 'zh' ? '同一份故事文件，服务写作、设计和程序。' : 'One story file for writing, design, and implementation.'}</h2></div>
          <div class="audience-list">${t.audiences.map(([title, body]) => `<article class="audience-row"><h3>${title}</h3><p>${body}</p></article>`).join('')}</div>
        </section>
      </main>
    `;
  }

  function guidePage() {
    const t = content[state.locale].guide;
    return `
      <main class="page-layout">
        <aside class="page-index">${t.sections.map((section, index) => `<a href="#guide-${index + 1}">${section[0]}</a>`).join('')}</aside>
        <article class="guide-article">
          <p class="eyebrow">${t.eyebrow}</p>
          <h1>${t.title}</h1>
          <p class="lead">${t.intro}</p>
          <section class="guide-section guide-code">
            <h2>${state.locale === 'zh' ? '基础 .mdstory 示例' : 'Basic .mdstory example'}</h2>
            <pre>${state.locale === 'zh' ? `# 第一章
## 节点：村口
守卫拦住了你。

[选项] 说明来意 -> 节点：守卫询问
  [条件] $通行证数量 >= 1
  [效果] $信任度 += 1` : `# Chapter One
## Node: Village Gate
The guard stops you.

[Choice] Explain yourself -> Node: Guard Questions
  [Condition] $has_pass == true
  [Effect] $trust += 1`}</pre>
          </section>
          ${t.sections
            .map(
              ([title, body, steps], index) => `
                <section class="guide-section" id="guide-${index + 1}">
                  <h2>${index + 1}. ${title}</h2>
                  <p>${body}</p>
                  <ol>${steps.map((step) => `<li>${step}</li>`).join('')}</ol>
                </section>
              `,
            )
            .join('')}
        </article>
      </main>
    `;
  }

  function statusSection(title, items) {
    return `
      <section class="section">
        <div class="section__intro"><p class="eyebrow">${state.locale === 'zh' ? '状态分层' : 'Status layer'}</p><h2>${title}</h2></div>
        <div class="status-grid">
          ${items
            .map((rawItem) => {
              const item = localizedFeature(rawItem);
              return `
                <article class="status-item tone-${esc(item.status)}">
                  <span class="mark"></span>
                  <h3>${esc(item.title)}</h3>
                  <p>${esc(item.detail)}</p>
                  <small>${esc(item.evidence || '')}</small>
                </article>
              `;
            })
            .join('')}
        </div>
      </section>
    `;
  }

  function developmentPage() {
    const t = content[state.locale].development;
    const status = state.status;
    const generatedLabel =
      status.generatedAt === 'not-generated'
        ? state.locale === 'zh'
          ? '使用内置回退数据'
          : 'Using fallback data'
        : state.locale === 'zh'
          ? new Date(status.generatedAt).toLocaleString('zh-CN')
          : status.generatedAt;
    return `
      <main class="development-page">
        <section class="dev-hero">
          <p class="eyebrow">${t.eyebrow}</p>
          <h1>${t.title}</h1>
          <p class="lead">${t.intro}</p>
          <div class="metric-strip">
            <div class="metric-block"><span>Version</span><strong>${esc(status.summary.version)}</strong><small>${esc(status.summary.channel)}</small></div>
            <div class="metric-block"><span>Workspace</span><strong>Graph Lab</strong><small>.mdstory</small></div>
            <div class="metric-block"><span>Updated</span><strong>${esc(status.summary.lastUpdated)}</strong><small>Windows</small></div>
          </div>
          <p class="source-note">${state.locale === 'zh' ? '数据生成时间：' : 'Generated: '} ${esc(generatedLabel)}</p>
        </section>
        <section class="section">
          <div class="section__intro"><p class="eyebrow">${t.gates}</p><h2>${state.locale === 'zh' ? '当前开发基线的验证记录。' : 'Current development baseline checks.'}</h2></div>
          <div class="gate-list">
            ${status.releaseGates
              .map((rawGate) => {
                const gate = localizedGate(rawGate);
                return `
                  <article class="gate-row tone-${esc(gate.status)}">
                    <span class="mark"></span>
                    <div><strong>${esc(gate.name)}</strong><p>${esc(gate.detail)}</p></div>
                    <b>${esc(gate.result)}</b>
                  </article>
                `;
              })
              .join('')}
          </div>
        </section>

        ${statusSection(t.stable, status.stableFeatures)}
        ${statusSection(t.experimental, status.experimentalFeatures)}
        <section class="section">
          <div class="section__intro"><p class="eyebrow">${t.roadmap}</p><h2>${state.locale === 'zh' ? '下一步完善产品演示、获取入口与引擎示例。' : 'Next: product demos, preview access and an engine example.'}</h2></div>
          <div class="roadmap-list">
            ${status.roadmap
              .map((rawItem) => {
                const item = localizedRoadmap(rawItem);
                return `<article class="roadmap-item tone-${esc(item.status)}"><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></article>`;
              })
              .join('')}
          </div>
        </section>
      </main>
    `;
  }

  function unusedLegacyStatusSection() {
    return `
      <section class="section">
        <div class="status-grid">
          ${[]
            .map(
              (item) => `
                <article class="status-item tone-${esc(item.status)}">
                  <span class="mark"></span>
                  <h3>${esc(item.title)}</h3>
                  <p>${esc(item.detail)}</p>
                  <small>${esc(item.evidence || '')}</small>
                </article>
              `,
            )
            .join('')}
        </div>
      </section>
    `;
  }

  function footer() {
    return `
      <footer class="site-footer">
        <div><span class="brand-lockup brand-lockup--${state.locale}" aria-label="${state.locale === 'zh' ? '维叙（Fablevia）' : 'Fablevia'}"><strong>${state.locale === 'zh' ? '维叙' : 'Fablevia'}</strong>${state.locale === 'zh' ? '<small>Fablevia</small>' : ''}</span><p>${state.locale === 'zh' ? '本地优先，不锁数据，面向独立游戏叙事生产。' : 'Local-first, source-readable, built for branching narrative production.'}</p></div>
        <button class="footer-link" data-page="guide" type="button">${state.locale === 'zh' ? '开始阅读' : 'Start reading'} →</button>
      </footer>
    `;
  }

  function render() {
    if (!app) {
      return;
    }
    const page = state.page === 'guide' ? guidePage() : state.page === 'development' ? developmentPage() : homePage();
    app.innerHTML = `${header()}${page}${footer()}`;

    app.querySelectorAll('[data-page]').forEach((button) => {
      button.addEventListener('click', () => setPage(button.getAttribute('data-page') || 'home'));
    });
    app.querySelectorAll('[data-locale]').forEach((button) => {
      button.addEventListener('click', () => setLocale(button.getAttribute('data-locale') || 'zh'));
    });
  }

  window.addEventListener('hashchange', () => {
    state.page = location.hash.replace('#', '') || 'home';
    render();
  });

  fetch('./data/project-status.json')
    .then((response) => {
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      return response.json();
    })
    .then((status) => {
      state.status = status;
      render();
    })
    .catch(() => {
      render();
    });

  render();
})();
