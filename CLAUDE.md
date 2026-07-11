# PlotFlow 项目开发工作流

> 版本：V0.3 | 日期：2026-06-23 | 基于 MarkLuck 实战工作流模板构建
> 适用于：单人 + AI 协作的独立游戏开发工具项目

---

## ⛔ 工作区隔离

**本项目工作目录**: `D:\VibeCoding\PlotFlow`

禁止访问与 PlotFlow 开发无关的系统目录和文件。所有操作限定在本工作目录内。如需参考 MarkLuck 项目的工作流与代码，先读取 `MARKLUCK_REFERENCE.md` 了解可复用范围。

---

## 一、项目身份

**PlotFlow** — 面向独立游戏开发者的叙事分支管理工具。以 `.mdstory` 纯文本文件为唯一磁盘真相源，以 Graph Lab 作为主要且默认的图优先创作工作区，并保留顶栏并列的 Split 完整源码投影，以多格式导出为目标。

**一句话**：让叙事设计师用 Markdown 或流程图管理分支剧情，程序拿干净 JSON 直接跑。不锁死数据，不强制联网，$29 买断。

### 核心闭环

```
用户打开/创建 .mdstory 文件 → 默认进入 Graph Lab，以完整 GUI 工作流编辑分支叙事
    ├── 实时分支可视化图（React Flow，可拖拽编辑，双向同步源文本）
    ├── Graph Lab 默认主工作区（流程图优先、Inspector 编辑、Source Drawer 辅助）
    ├── Split 辅助源码投影（完整 `.mdstory`、Monaco、Outline 与分支图）
    ├── 图形化条件编辑器（Airtable 风格，零代码）
    ├── 三级语法错误检测（错误/警告/建议，波浪线+侧边标记）
    ├── 四维幽灵字符补全（节点标题/选项句式/正文描述/变量名）
    ├── 多格式导出（JSON + HTML可玩版 + TXT纯文本）
    └── Godot 编辑器插件 + 运行时库（Unity/Unreal 接口预留）
```

### 目标用户

- **首要**：独立游戏开发者（单人/小型团队，1-5人）
- **次要**：游戏设计院校师生、视觉小说/互动小说制作者
- **潜在**：桌游剧本作者

---

## 二、技术架构（不可变）

### 2.1 技术选型

| 层级 | 选型 | 锁定原因 |
|------|------|---------|
| 桌面框架 | **Electron 42** | 当前受支持稳定主版本线，Monaco Editor 官方支持，复用现有编辑器资产 |
| 前端框架 | **React 18 + TypeScript 5** (strict) | React Flow 原生 React 组件，TS 类型安全 |
| 构建工具 | **Vite 5** | 快，Electron 生态首选 |
| 包管理 | **pnpm workspace** | 为后续拆分解析器为独立包做准备 |
| 代码编辑器 | **Monaco Editor**（VSCode 内核） | 语法高亮、波浪线标记、幽灵补全均原生支持 |
| 分支图 | **React Flow + Dagre** | 可编辑节点图 + 层级布局，MIT 协议，n8n/TypeForm 同款 |
| Markdown 解析 | **unified + remark + 自定义插件** | 成熟 AST 生态，自定义语法通过插件实现 |
| YAML 解析 | **js-yaml** | 解析 Frontmatter |
| 状态管理 | **Zustand** | 轻量，适合编辑器细粒度状态 |
| 测试 | **Vitest**（单元） | Vite 生态兼容 |
| 桌面搜索 | **本地文件遍历**（MVP 不引入 tantivy） | 单文件模式下无需全文索引 |

### 2.2 明确禁用的技术

| 类别 | 禁止 | 原因 |
|------|------|------|
| 存储 | 任何数据库（SQLite/IndexedDB 存储 .mdstory 内容） | 文件即数据源。数据库引入同步冲突和数据锁死 |
| 框架 | Vue / Angular / Svelte | 已锁定 React，避免框架混乱 |
| 云端 | 强制联网功能 | 离线优先。云端同步 V0.3 再议 |
| 导出 | 旧版 `.doc` 格式 | 仅支持 JSON/HTML/TXT（Word/PDF 非程序员目标需求） |

### 2.3 架构分层

```
┌──────────────────────────────────────────────┐
│          Electron Main Process               │
│  文件管理 | 自动保存 | 原生菜单/对话框        │
├──────────────────────────────────────────────┤
│          Electron Renderer Process            │
│  ┌─────────────────────────────────────────┐ │
│  │         UI Layer (React)                │ │
│  │  Monaco 编辑器 | ReactFlow 分支图        │ │
│  │  条件编辑面板 | 幽灵补全 | 大纲视图      │ │
│  └────────────────┬────────────────────────┘ │
│                   │                           │
│  ┌────────────────┴────────────────────────┐ │
│  │       Core Layer (Pure TypeScript)      │ │
│  │  解析器(Parser) → PlotFlowData AST      │ │
│  │  语法检查器(Validator) → 诊断信息        │ │
│  │  导出器(Exporter) → JSON/HTML/TXT        │ │
│  │  补全引擎(Completion) → N-gram 预测      │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### 2.4 关键不可变设计决策

| 决策 | 说明 |
|------|------|
| 文件即数据源 | `.mdstory` 是唯一数据源，绝不引入数据库存储脚本内容 |
| 双投影同步 | `.mdstory` 是唯一磁盘真相源；GUI 与源文本是同一故事数据的两个编辑投影，图形化修改必须序列化回 `.mdstory` |
| 离线优先 | 零网络依赖。本地运行，本地补全，本地导出 |
| 补全隐私安全 | N-gram 统计模型，数据不离开本地 |
| 插件模式变量由引擎定义 | 从 Godot/Unity 启动时，变量从引擎同步，编辑器不可自由创建变量 |

---

## 三、当前阶段

**Phase 2: 质量打磨与发布 (V0.3)** ← 当前阶段

**目标**：V0.2 QA 审计全部 CRITICAL+HIGH 已修复，M0-M7 明细实际完成 132/142 (92.96%)。V0.3 聚焦发行门禁、文档同步与 Windows 正式包；M8 Graph Lab 已推进为图优先正式入口，后续收尾发布说明与帮助文案。

详见 `spec/progress.md`（进度权威来源）。

**当前进度（2026-07-11 V0.3）**：
- M0-M7 历史任务明细：132 个 ✅、9 个 ⏭️、1 个 ❌，总进度 **132/142（92.96%）**
- M0 1 项历史 E2E 框架任务已移除；M4/M5 各 1 项延后；M7 7 项平台发布任务延后
- M4 Godot 插件（9项）+ Unity 接口（2项）+ Unreal 接口（2项）均已实现
- M5 增量学习器/语料导入/预处理/持久化/CorpusManager 面板均已实现
- M7 核心配置/图标/文件关联/双击打开/CHANGELOG/Windows NSIS 正式包/Windows packaged smoke 完成，其余 7 项延后
- V0.2 QA 审计 2 CRITICAL + 8 HIGH 全部修复验证通过
- 基础门禁：lint（0 errors / 9 既有 warnings）、typecheck、test、build、lint:css、lint:tokens、lint:bundle 与 dependency audit 均通过；`pnpm.cmd test` 为 60 files / 1356 tests
- 当前发行门禁：Graph-first/P2 完整 app 集成 E2E 79/79、source blackbox 11 passed / 6 目标专属 skipped、引擎合同 fixture 6/6、全新 Windows package 和 unpacked blackbox 16 passed / 1 installed-only skipped 均通过；严格 unpacked 旅程已通过原生 Open/Export 与磁盘 JSON Schema 0.2 Ajv 校验。远程 CI、installed blackbox、30 分钟人工巡检、Godot/Unity/Unreal 真实工具链 smoke 与 Authenticode 签名仍待完成，不得宣称 release-candidate-passed 或公共正式发行完成；详见 `spec/release-blackbox-gate.md`
- M8 Graph Lab Core：18 项新增图优先源码任务当前 18/18，不混入旧 142 项统计；源码任务计数与发行验收继续分开记录

### V0.1 核心交付范围

| 模块 | 内容 |
|------|------|
| 编辑器 | Monaco 编辑器 + PlotFlow 语法高亮 + 大纲视图 + 自动保存 |
| 分支图 | React Flow 可编辑分支图（自上而下布局，拖拽连线，点击跳转，小地图） |
| Graph Lab Core | 图优先正式入口：全屏画布、节点 palette、Inspector、Source Drawer，支持完整 GUI 操控并序列化回 `.mdstory` |
| 条件编辑 | 内联图形化条件编辑器（Airtable 风格），双向文本同步 |
| 错误检测 | 三级错误标记（8E/6W/3I 波浪线）+ 问题面板 |
| 导出 | JSON（标准格式）+ HTML（可玩版）+ TXT（纯文本） |
| 模板 | 4 个内置模板（RPG/视觉小说/解谜/Godot 示例）+ 新建文件对话框 |
| UI | 暗色/亮色双主题 + 海洋蓝/暖金双强调色 + 中英双语 |

### V0.2-V0.3 已交付（截至 2026-06-20）

| 模块 | 内容 |
|------|------|
| 连线交互 | StoryEdge 全交互升级（Alt+删除/双击→条件编辑器/右键菜单/hover 高亮） |
| 画布交互 | 双击节点内联重命名 |
| GhostText | 幽灵补全接线（4维触发/英文语料152句/Tab/Esc/Ctrl+Space） |
| 条件编辑器 | 集成连线双击触发 + AST 自动加载已有条件 |
| Edge ID | encodeURIComponent 编码加固 + parseEdgeId 确定性解码 |
| 引擎插件 | Godot 编辑器插件+运行时库（8文件）、Unity C# 接口（2文件）、Unreal 数据模型 |
| 学习管道 | N-gram 增量学习器（90天衰减）+ 语料导入器 + 预处理 + 持久化 + CorpusManager面板 |
| Bug 修复 | 章节标题正则（monaco-tokenizer）/ CorpusLoader API / 条件编辑器初始状态 / QA审计2 CRITICAL+8 HIGH全部修复 |

### V0.3 延后交付

| 模块 | 内容 |
|------|------|
| 语料 | 中文语料包扩展至 3.5MB（当前 45KB）、英文语料包扩展至 1.5MB（当前 30KB） |
| 打包 | Electron 三平台构建 (.exe/.dmg/.AppImage) + 自动更新 + 首次启动引导 |

---

## 四、文档索引

### 核心文档（必读）

| # | 文档 | 内容 | 状态 |
|---|------|------|:---:|
| 0 | `CLAUDE.md` | 本文件——项目元指令与开发工作流 | ✅ |
| 1 | `PRD.md` | 产品需求规格（15章，50+功能点） | ✅ |
| 2 | `COMPETITIVE_ANALYSIS.md` | 竞品分析（51功能矩阵，6竞品六维评分） | ✅ |
| 3 | `MARKLUCK_REFERENCE.md` | MarkLuck 工作流与代码复用参考 | ✅ |
| 4 | `spec/design-brief-editor-ux.md` | **🎨 UX 设计唯一真相源**（色彩/布局/交互/状态/文案/M0-M8 UI 规划） | ✅ |
| 5 | `doc/TAD.md` | 技术架构设计（组件/接口/数据流/类型定义，3,513 行） | ✅ |
| 6 | `spec/syntax-formal.md` | 语法形式化规范（ISO 14977 EBNF/正则/解析规则，1,441 行） | ✅ |
| 7 | `spec/json-schema.md` | JSON 导出格式 Schema 规范（draft-2020-12，1,697 行） | ✅ |
| 8 | `spec/milestones.md` | 里程碑拆分与进度（M0-M7，142 项任务，依赖关系图） | ✅ |
| 9 | `doc/standards-theme-development.md` | **主题开发唯一标准**（官方主题边界、ThemeDescriptor、Surface/Slot、官方远程包 runtime） | ✅ |

### 🎨 UX 设计权威来源

`spec/design-brief-editor-ux.md` 是 PlotFlow 编辑器所有 UI/UX 设计的**唯一真相源（Single Source of Truth）**。

- 所有 UI 组件实现必须对照此文档中的设计决策
- 任何视觉变更、交互调整、布局修改必须先更新此文档，再改代码
- 代码审查时，此文档中的规则与 `CLAUDE.md` 代码约束具有同等效力
- 关键设计决策摘要：**语义多色策略** / **默认亮色主题** / **shadcn/ui 组件库** / **迷你地图+并排均衡双模式** / **游戏化入门任务** / **反目标：不学 Articy 臃肿**

### 待创建文档

> 暂无 — 所有 P0/P1/P2 文档已就绪。后续按需在 `spec/decisions.md` 中记录新的 ADR。

---

## 五、质量保障

### 5.1 CI 自动检查

PR 的 Ubuntu 门禁覆盖 ESLint、TypeScript、Vitest、build、CSS/token/bundle、Graph 主路径 UI 字面量、Schema mirror、引擎合同、moderate+ 依赖审计和网站静态验证；PR 的 `windows-2022` 门禁覆盖 app E2E、视觉旅程和 source blackbox。nightly/manual Windows package、unpacked、性能、SHA256 与受保护 self-hosted installed 分层见 `.github/workflows/release-validation.yml`。工作流配置存在不等于门禁已通过，发行证据仍以 `spec/release-blackbox-gate.md` 为准。

### 5.2 里程碑复审

每个里程碑完成后，必须人工走查完整的 **写→检查→导出→引擎加载** 闭环，确认所有用户故事可独立完成。

### 5.3 核心数据流

```
用户输入 (Monaco Editor)
    │
    ▼
Monaco Change Event (500ms debounce)
    │
    ▼
Markdown Parser (unified + 自定义 PlotFlow 插件)
    │
    ▼
PlotFlowData AST (中间表示)
    │
    ├──→ 语法检查器 → 诊断信息 → Monaco Decorations (波浪线)
    ├──→ 分支图数据适配器 → React Flow Nodes & Edges (实时渲染)
    ├──→ 大纲视图数据 (节点树)
    ├──→ 补全引擎 (异步，独立线程)
    └──→ 自动保存 → 写入 .mdstory 文件
```

### 5.4 ADR 决策记录

重大架构决策按 ADR 格式记录到 `spec/decisions.md`（背景 → 决策 → 后果 → 替代方案）。

---

## 六、代码约束

### 6.1 样式 Token 约束（强制）

- 禁止在任何组件中使用**裸 hex 色值**（如 `#fff`、`#eee`、`#333`）
- 所有颜色必须引用 Design Token CSS 变量
- CI 配置 stylelint 规则：`color-no-hex: true`（或限 Design Token 文件豁免）
- 暗色/亮色主题切换必须通过 CSS 变量驱动，不得硬编码两套样式

**PRD 中已定义的色值体系**（PRD §5.5）——创建 Token 文件时以此为来源。

### 6.2 Monaco Editor 扩展规范

- 语法高亮：通过 Monarch tokenizer 实现（非 TextMate）
- 波浪线标记：通过 `monaco.editor.setModelMarkers()` 注入诊断
- 幽灵补全：通过 `monaco.languages.registerInlineCompletionsProvider()` 实现
- 防抖：编辑事件 500ms debounce 后才触发解析（避免频繁重解析）

### 6.3 React Flow 节点组件规范

- 自定义节点组件必须继承 `React.FC<NodeProps>`
- 节点状态着色通过 className 注入，不在组件内硬编码颜色：
  - 正常：`node-status-normal`
  - 孤立：`node-status-orphan`
  - 死胡同：`node-status-deadend`
  - 错误：`node-status-error`
  - 选中：`node-status-selected`
- 连线编辑回调必须通过 Zustand store 派发，更新 AST 后再触发 Monaco 文本同步

### 6.4 补全引擎触发规则

| 触发前缀 | 补全维度 | 候选来源 | 交互模式 |
|---------|---------|---------|---------|
| `# 节点：` 或 `## 节点：` | 节点标题 | 语料库 + 本地学习 | 灰色幽灵字符 + Tab接受/Esc忽略 |
| `[选项]` 后文字 | 选项句式 | 语料库 + 上下文 | 同上 |
| 正文任意输入 | 描述正文 | N-gram 语言模型 | 同上 |
| `$` 后文字 | 变量名 | Frontmatter 声明 + 引擎变量 | 同上 + Ctrl+Space 下拉所有匹配 |

### 6.5 文件路径规范

- 统一使用正斜杠 `/` 作为路径分隔符
- 文件读写显式指定 UTF-8 编码
- `.mdstory` 文件扩展名：全小写
- 导入路径使用相对路径（`../`），避免绝对路径依赖

### 6.6 主题开发约束（强制）

- 任何新增主题、修改主题 API、扩展 Surface/Slot、扩展官方远程主题 loader，必须先遵循并同步 `doc/standards-theme-development.md`
- PlotFlow 当前只支持官方主题：内置官方主题和官方远程免费主题；不开放第三方、社区上传、本地导入、购买或授权
- 官方远程主题必须通过 registry → ZIP 下载 → `sha256` 校验 → 安全解包 → `plotflow-theme://` 动态加载链路，不得直接执行 HTTPS JS
- 主题可以控制 UX/视觉/布局/Surface/Slot/Monaco/assets，但不得改变 `.mdstory` 语义、parser/exporter、保存流程或 Graph Lab 命令层

---

## 七、文件结构约定

```
PlotFlow/
├── CLAUDE.md                      ← 本文件（项目元指令）
├── PRD.md                         ← 产品需求规格
├── COMPETITIVE_ANALYSIS.md        ← 竞品分析报告
├── MARKLUCK_REFERENCE.md          ← MarkLuck 工作流与代码复用参考
├── README.md                      ← 项目门面（待创建）
│
├── doc/                           ← 设计文档
│   ├── TAD.md                     ← 技术架构设计（待创建）
│   ├── standards-css.md           ← CSS/Token 规范（待创建）
│   ├── standards-ts-react.md      ← TS/React 规范（待创建）
│   └── standards-git.md           ← Git 规范（待创建）
│
├── spec/                          ← 规格文档
│   ├── syntax-formal.md           ← 语法形式化规范（待创建）
│   ├── json-schema.md             ← JSON Schema 规范（待创建）
│   ├── milestones.md              ← 里程碑拆分（待创建）
│   ├── progress.md                ← 进度跟踪（动态文档，待创建）
│   ├── decisions.md               ← ADR 决策记录（待创建）
│   ├── types/                     ← TypeScript 类型合同（待创建）
│   └── frontend/                  ← 前端规格（待创建）
│
├── memory/                        ← 项目记忆
│   └── bug_log.md                 ← 错题本（待创建）
│
├── packages/                      ← pnpm workspace
│   ├── app/                       ← Electron + React 主应用（待创建）
│   │   ├── src/
│   │   │   ├── components/        ← React 组件
│   │   │   │   ├── editor/        ← Monaco 编辑器相关
│   │   │   │   ├── branch-graph/  ← React Flow 分支图相关
│   │   │   │   ├── condition/     ← 图形化条件编辑器
│   │   │   │   ├── completion/    ← 补全提示组件
│   │   │   │   └── layout/        ← 布局组件
│   │   │   ├── stores/            ← Zustand 状态
│   │   │   ├── services/          ← 业务逻辑
│   │   │   ├── core/              ← 核心层（解析器/导出器/检查器）
│   │   │   ├── types/             ← 类型定义
│   │   │   └── utils/             ← 工具函数
│   │   ├── src-electron/          ← Electron 主进程
│   │   ├── public/
│   │   └── package.json
│   │
│   └── parser/                    ← @plotflow/parser（独立解析器包，待创建）
│       ├── src/
│       │   ├── parser.ts          ← Markdown → AST
│       │   ├── validator.ts       ← 语法检查器
│       │   ├── exporter/          ← JSON/HTML/TXT 导出器
│       │   └── types.ts           ← PlotFlowData 类型定义
│       └── package.json
│
├── tests/                         ← 测试根目录
│   ├── fixtures/                  ← 测试用 .mdstory 文件
│   └── unit/                      ← 单元测试
│
├── scripts/                       ← 脚本
│   └── train-corpus.ts            ← 补全语料训练管道（待创建）
│
├── .github/                       ← CI/CD
│   └── workflows/
│       └── ci.yml                 ← CI 流水线（待创建）
│
├── .husky/                        ← Git Hooks（待创建）
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
├── eslint.config.js
└── .prettierrc
```

---

## 八、禁止事项

| 类别 | 禁止 | 原因 |
|------|------|------|
| 存储 | 引入任何数据库存储 .mdstory 内容 | 文件即数据源——这是不可变决策 |
| 补全 | 补全引擎联网 | N-gram 纯本地，隐私底线 |
| UI | 组件内硬编码色值（`#fff`、`#eee` 等） | 必须使用 Design Token |
| UI | 裸 CSS 实现主题切换（如两套 `.light` / `.dark` 类） | 必须使用 CSS 变量驱动 |
| 导出 | .mdstory → 专有二进制格式 | 必须可被文本编辑器打开 |
| 架构 | 编辑器内直接操作 React Flow 状态 | 必须通过 Zustand → AST → Monaco 单向数据流 |
| 语法 | 在 .mdstory 中引入非 Markdown 的专有标记 | 语法扩展仅限 `# 节点：`/`[选项]`/`[条件]` |

---

## 九、交互规范

### 9.1 需求采集与确认（强制）

所有需求采集、需求确认、方案选择、设计决策等需要用户输入的场合，**必须使用 `AskUserQuestion` 工具**进行结构化提问，不得以纯文本对话方式收集用户意图。

**触发场景**（包括但不限于）：
- 功能优先级排序
- 技术方案二选一/多选一
- UI/UX 设计偏好确认
- 里程碑范围界定
- API/接口设计选择
- 用户故事验收标准确认

**禁止做法**：
- ❌ 在对话中直接问"你觉得这样做可以吗？"等待文本回复
- ❌ 对模糊需求自行脑补后直接实现
- ❌ 多项选择题用纯文本罗列让用户打字回复

**正确做法**：
- ✅ 使用 `AskUserQuestion` 工具，设置清晰的 `header` 和 `options`
- ✅ 每个选项附带 `description` 说明选择后果
- ✅ 必要时使用 `multiSelect` 支持多选

---

## 十、工作流与模型分配策略

### 10.1 模型路由映射

| Agent model 参数 | 实际路由 | 适用任务 | 特征 |
|:---:|------|------|------|
| `"haiku"` | **V4Flash** | 纯配置文件 / 模板填充 / 测试用例 / 格式转换 | 机械执行，无歧义，CI 可立即捕获错误 |
| `"sonnet"` | **V4Flash** | 骨架代码 / 标准组件 / i18n 翻译 / 接口定义 | 需轻量推理，但规格文档已给出明确合同 |
| 默认 (不指定) | **V4Pro** | 解析器核心 / 架构设计 / 交互逻辑 / 性能优化 | 需要深度架构推理、跨模块协调、UX 判断 |

### 10.2 任务分配判定规则

**自动委派 V4Flash 的条件**（全部满足才委派）：
1. ✅ 有完整规格文档或类型合同可直接翻译为代码
2. ✅ 纯函数 / 配置文件 / 模板填充 / 标准 API 调用
3. ✅ 独立于其他未完成模块，可单独验证
4. ✅ 错误会被 ESLint / tsc / Stylelint / CI 立即捕获
5. ✅ 不涉及跨模块状态同步或竞态条件

**必须 V4Pro 的场景**（任一满足即保留）：
1. ❌ 需要设计算法或架构权衡
2. ❌ 涉及 Monaco / React Flow / Zustand 的复杂交互逻辑
3. ❌ 双向同步 / 操作锁 / 防抖 / 增量更新
4. ❌ 性能优化（虚拟滚动 / 增量 diff / Worker 线程）
5. ❌ UX 敏感的交互行为（补全触发 / 拖拽连线 / 幽灵文本）

### 10.3 并行执行规则

**可并行**（通过 Workflow `parallel()` 同时执行）：
- 所有 V4Flash 任务（独立、无竞态）
- 同里程碑内互不依赖的 V4Pro 任务
- 目录结构必须先于文件创建（避免 Write 工具目录竞态）

**必须串行**（单 agent 顺序执行）：
- 跨模块联动任务（如"编辑器修改 → 分支图同步"）
- 操作锁保护的交互逻辑
- 集成验证（依赖所有前置任务产物）

**执行模式**：
```
里程碑入口
  ├── Phase 0: 目录结构 (1×haiku, 串行, ~5s)
  ├── Phase 1: Fast 并行 (N×haiku/sonnet, 并行, wall-clock ~60s)
  ├── Phase 2: Main 串行 (M×默认, 串行, ~5-10min)
  └── Phase 3: 集成验证 (1×默认, 串行, ~2min)
```

### 10.4 Workflow 脚本规范

- 每个里程碑对应一个 Workflow 脚本：`scripts/workflows/<milestone>.workflow.md`
- 脚本使用 `parallel()` 派发 V4Flash 子 agent，`agent()` 串行执行 V4Pro 任务
- V4Flash agent 统一使用 `{model: "haiku"}`（最轻量）或 `{model: "sonnet"}`（需轻量推理）
- V4Pro 任务不指定 model 参数（继承主模型）
- 子 agent 数量上限：haiku ≤15, sonnet ≤8, 默认 ≤5（单次 Workflow 调用）

### 10.5 禁止事项

| 类别 | 禁止 | 原因 |
|------|------|------|
| 分工 | 将解析器/编译器核心逻辑委派给 V4Flash | 需要深度理解 EBNF 和 AST 映射 |
| 分工 | 将双向同步逻辑委派给 V4Flash | 竞态条件必须在架构层面预防 |
| 分工 | V4Flash 并行创建同一父目录 | 目录创建竞态——Phase 0 先建目录 |
| 分工 | 跨里程碑推理委派给 V4Flash | 需要全局架构视角 |
| 执行 | 在一个 Workflow 中混合超过 15 个 agent | 超过限制时分批执行 |

### 10.6 集成边界文件必须 V4Pro（新增）

以下三类文件**禁止委派给 V4Flash**，必须由 V4Pro 处理：

| 类别 | 文件示例 | 原因 |
|------|------|------|
| **IPC/Bridge/跨进程** | `main.ts`, `preload.ts` | 路径、协议、安全性必须跨文件验证 |
| **全局约束文件** | `index.html` (CSP), `.npmrc`, `electron.vite.config.ts` | 一处错误全局影响 |
| **模块间胶水代码** | `parsePipeline.ts`, `adapter.ts`, `autoSaveService.ts` | 需要理解两端接口契约 |

### 10.7 Deepseek 协作闸门（新增）

当用户希望借助 Deepseek 或其他低成本模型执行任务时，必须按以下规则处理：

**可交给 Deepseek 的任务**（必须低风险、可机械验证）：
- 纯符号迁移、注释清理、简单命名替换、文档/changelog 补写
- 有明确规格的类型定义、barrel export、测试断言同步
- 单文件或低耦合改动，失败可被 `typecheck` / `lint` / `test` 立即捕获

**禁止交给 Deepseek 的任务**（必须由 Codex/V4Pro 执行或全程审计）：
- `main.ts`、`preload.ts`、Electron IPC、文件系统、ZIP/解压、路径安全、签名/权限边界
- Zustand/React Flow/Monaco 的交互状态同步、E2E 真实用户路径、拖拽/点击命中逻辑
- 安全校验器、迁移逻辑、数据持久化、跨模块架构合同、删除旧系统入口
- 主题 API、Theme Surface/Slot 扩展、官方远程主题 loader、Graph Lab 节点/连线真实交互行为
- 任何需要判断“测试是否覆盖真实路径”而不是只覆盖 helper 的任务

**交接流程**：
1. Codex 先判断任务是否适合 Deepseek；不适合时直接说明原因并自行执行。
2. 适合 Deepseek 时，Codex 只输出一份可复制的执行提示词，必须包含范围、禁止事项、验收命令、grep 门禁、停止点。
3. 输出提示词后 Codex 必须停下，等待用户手动启动 Deepseek；不得继续假设 Deepseek 已执行。
4. Deepseek 完成后，Codex 只按实际 diff / grep / 门禁结果审核，不接受摘要替代审计。
5. 每个子里程碑必须先审计再进入下一阶段；禁止 Deepseek 连续跨阶段执行。

**提示词必须包含的最低字段**：
- `任务目标`
- `允许修改文件`
- `禁止修改文件`
- `执行步骤`
- `验收命令`
- `必须为零的 grep`
- `完成后停止并提交摘要`

### 10.8 里程碑验收标准（不可变）

每个里程碑完成**必须通过以下全部检查**，缺一不可标记为 100%：

| 层级 | 检查 | 工具 |
|:---:|------|------|
| L1 | TypeScript 编译零错误 | `tsc --noEmit` |
| L1 | ESLint 零错误 | `eslint` |
| L2 | 单元测试全部 PASS | `vitest run` |
| L3 | 占位代码扫描零结果 | `grep -r "待 M[0-9]" packages/` |
| L3 | 入口可达性检查 | 每个组件必须被 App.tsx 或 setupEditor.ts 引用 |
| L3 | progress.md 总览=细项校验 | 脚本比较总览计数 vs 细项 ✅ 计数 |
| L4 | 人工端到端复审 | 打开 `.mdstory` → 编辑 → 看分支图 → 导出 → 引擎加载 |

---

## 十一、质量防线（自动化 + 约束）

### 11.1 占位代码阻断

CI 中新增扫描步骤，阻断所有 `"待 M*"` 占位文本进入主分支：

```bash
grep -rn "待 M[0-9]" packages/app/src/ && echo "❌ 占位代码阻断" && exit 1 || echo "✅"
```

### 11.2 TSX 内联样式 Token 约束

ESLint `no-restricted-syntax` 规则拦截 TSX 中的裸 hex 色值：

```javascript
'no-restricted-syntax': ['error', {
  selector: 'Property[left.name="color"] Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
  message: '禁止裸 hex 色值，使用 var(--color-*) Design Token'
}]
```

### 11.3 V4Flash 交叉验证

每里程碑结束后，V4Pro 必须审查所有 V4Flash 产出：
- `main.ts` 路径 → 对比 electron-vite 输出结构
- `index.html` CSP → 对比 Monaco/React 资源需求
- 所有组件 → `grep '#[0-9a-fA-F]\{6\}'` 扫描裸 hex

### 11.4 错题本联动

每个 BUG 修复后必须回答：
1. 能否用 ESLint rule 预防？→ 加规则
2. 能否用 CI 扫描预防？→ 加扫描
3. 能否用 smoke test 预防？→ 加 Playwright 用例
4. 以上都不能？→ 加入 L4 人工复审清单

---

*本文件是 PlotFlow 项目的唯一元指令来源。所有 AI 协作编码必须遵循本文件定义的架构、工作流和约束。*
