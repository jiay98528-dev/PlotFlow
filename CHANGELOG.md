# Changelog

所有重要变更均记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本遵循 [Semantic Versioning](https://semver.org/)。

## [0.2.0] — 2026-06-17

### Added
- **连线交互基础设施**：StoryEdge 从纯渲染组件升级为全交互组件
  - Alt+点击连线删除连接（移除 `-> 节点：XXX` 文本）
  - 双击连线打开条件编辑器（自动加载已有条件）
  - 右键连线菜单：编辑条件 / 删除连线 / 跳转源节点 / 跳转目标节点
  - 连线悬停高亮（线宽 2→3，12px 透明交互区域）
- **双击节点内联重命名**：双击节点卡片进入编辑模式，Enter 确认，Esc 取消
- **GhostText 幽灵补全接线**：NGramEngine + 英文语料（152 句）注册到 Monaco InlineCompletionsProvider
  - 四维触发：节点标题 / 选项句式 / 正文描述 / 变量名
  - Tab 接受 / Esc 忽略 / Ctrl+Space 多候选下拉 / <100ms 频率抑制
- **条件编辑器集成**：连线双击或 `[🔧条件]` 图标触发，自动从 AST 加载已有条件
- **Edge ID 编码加固**：encodeURIComponent 编码 fullId，parseEdgeId() 确定性解码
- **edgeStore 工具模块**：encodeEdgeId / parseEdgeId 公共 API
- **条件编辑器上下文状态**：uiStore 新增 openConditionEditor(nodeId, optionIndex)

### Fixed
- **章节标题正则 bug**：`/^#\s*章节[：:].*$/` 改为 `/^#\s+.+$/`，匹配任意章节标题
- **GhostText CorpusLoader API**：修正为 `CorpusLoader.getInstance()` + `loadToEngine()`
- **条件编辑器初始状态**：添加 `resolvedCondition` 从 AST 加载已有条件
- **Edge ID 可逆性**：fullId 中 `#`/`->` 字符不再破坏 edge.id 解析

### Security
- `.gitignore` 增强：新增 `.tmp/`、OS 文件、IDE 文件、构建产物

---

## [0.1.0] — 2026-06-14

### Added

#### M0 — 项目脚手架

- pnpm workspace monorepo 初始化（`@plotflow/app` + `@plotflow/core`）
- Electron 28 主进程骨架（`electron-vite` 构建，空白窗口启动）
- React 18 + TypeScript 5 渲染进程骨架（Vite 构建通过）
- TypeScript strict mode 全覆盖（`tsc --noEmit` 零错误）
- ESLint + Prettier 代码规范配置（`eslint src/` 零警告）
- Vitest 单元测试框架（示例测试 PASS）
- GitHub Actions CI 骨架（L1 自动运行：lint + typecheck + test）
- Git Hooks（lint-staged pre-commit + commitlint）
- 全量目录结构建立（`src/components/`、`src/stores/`、`src/services/`、`src/types/`）
- Zustand 状态管理初始化（store 骨架 + devtools 集成）
- Monaco Editor 占位集成（组件挂载，基础文本编辑可用）
- `@plotflow/core` 包骨架（入口导出 + 类型定义）

#### M1 — 核心解析与编辑

- **解析器**：YAML Frontmatter 解析器（int/float/bool/string/enum/object 三级嵌套）、Markdown 节点解析器（unified + remark 自定义插件）、选项语法解析器（含条件/效果子行）、条件表达式解析器（`== != > < >= <= AND OR NOT` + 嵌套括号）、变量操作解析器（赋值/增减/追加）、PlotFlowData 完整 AST 模型定义
- **解析器单元测试**：92 个用例全覆盖（特殊字符/Unicode/emoji/中英混排边界）
- **Monaco 语法高亮**：7 色 Monarch Tokenizer（章节/节点/选项/条件/效果/变量/跳转）、暗色主题色值注入
- **编辑器增强**：括号自动闭合（`[` → `]` 自动补全）、节点折叠（Code Folding Provider）、500ms debounce 响应式自动保存、文件操作服务（IFileService + Electron 打开/保存/新建/另存为）
- **大纲视图**：OutlinePanel 树形组件（章节→节点层级）、大纲与编辑器双向联动（滚动同步 + 点击跳转 `revealLine`）
- **状态栏**：StatusBar 组件（保存状态 + 节点/选项计数 + 缩放比例）
- **应用菜单栏**：文件/编辑/视图/导出/帮助五菜单 + 快捷键绑定

#### M2 — 分支可视化

- React Flow 画布集成（GraphCanvas 组件，与编辑器并排显示）
- Dagre 布局引擎适配（自上而下树状布局，同层 ≥150px，父子 120px）
- AST → React Flow 数据适配器（PlotFlowData → Nodes + Edges 增量更新）
- StoryNodeCard 自定义节点组件（标题 + 前 30 字摘要 + 选项数量徽章）
- 节点状态着色（5 种：正常 🟢 / 孤立 🟡 / 死胡同 ⬜ / 错误 🔴 / 当前选中 🔵）
- StoryEdge 自定义连线组件（条件：#CE9178 橙色虚线 + 贝塞尔；无条件：#4EC9B0 青色实线 + 贝塞尔）
- 单击节点 → 编辑器跳转（revealLine + 节点高亮）
- 双击节点 → 内联重命名模式（→ 同步到文本）
- 拖拽连线端点 → 修改跳转目标（→ 更新 `.mdstory` 中 `-> 节点：`）
- 右键菜单（节点：跳转/重命名/添加选项/删除；空白：添加节点/重新布局/导出 PNG）
- Ctrl+点击多选 + 缩放（10%~200%）+ 中键拖拽平移
- 200 节点虚拟滚动（`onlyRenderVisibleElements`，≥30fps）
- 同层节点水平折叠（超 20 节点自动启用）
- 编辑器修改 → 分支图实时更新（300ms debounce → 增量同步）

#### M3 — 条件编辑与错误检测

- **条件编辑器**：ConditionEditor Airtable 风格弹出面板、变量下拉框（Frontmatter + 引擎变量）、比较运算符下拉框（6 种，按变量类型过滤）、类型感知值输入框（int/float/bool/enum）、AND/OR 逻辑组构建器（3 层嵌套）、条件预览行（实时文本表达式）
- **双向同步**：面板修改 → `条件:` 行更新；手动编辑文本 → 面板自动刷新（防抖 + 来源标记，避免循环）
- **验证器引擎 — 8 种错误（E001-E008）**：未定义目标节点、未声明变量、枚举值非法、类型不匹配、语法解析失败、嵌套深度超限、节点 ID 重名、变量重复声明
- **验证器引擎 — 6 种警告（W001-W006）**：孤立节点、死胡同节点、未使用变量、重复选项描述、空描述节点、格式不规范
- **验证器引擎 — 3 种建议（I001-I003）**：可能卡关（全部选项有条件）、描述过短（<10 字符）、无章节归属
- **验证器单元测试**：17 种诊断类型全覆盖，每种 ≥1 用例
- **错误呈现**：Monaco 红色波浪线（Error）/ 黄色波浪线（Warning）/ 蓝色下划线（Info）、侧边栏标记点（红色方块/黄色三角/蓝色圆点）、Hover Tooltip（诊断编号 + 描述 + 修复建议）、ProblemPanel 问题面板（Ctrl+Shift+M，点击跳转）
- **状态栏错误计数**：`🔴3 🟡2 🔵1` 实时显示
- **分支图联动**：节点 Error → 红色边框，Warning → 黄色边框，Info → 蓝色边框

#### M4 — 导出系统

- **JSON 导出**：AST → JSON 序列化（符合 JSON Schema）、Schema 自动化验证、往返一致性测试（`.mdstory → JSON → AST` 语义一致）、Unicode/emoji/边界测试全覆盖
- **HTML 导出**：单文件自包含（内嵌 CSS + JS）、交互逻辑（节点渲染 + 选项按钮 + 条件灰显🔒）、变量面板（底部可折叠，实时变量值）、面包屑导航（节点历史路径可回溯）、响应式布局（桌面 + 移动端 CSS Grid）
- **TXT 导出**：纯文本导出，无标记残留，节点间双换行分隔
- **导出 UI**：ExportDialog 组件（格式选择 + 文件路径）、`Ctrl+E` 快捷键 + 菜单入口
- **Godot 编辑器插件**：`plugin.gd` 入口注册 + Dock 面板（`.mdstory` 文件列表）、变量同步器（Godot 变量 → Frontmatter）、导出触发器（一键 JSON 导出）
- **Godot 运行时库**：StoryLoader（加载 JSON 建节点树）、StoryNode（获取描述/选项）、ConditionEval（条件评估引擎）、VariableStore（变量存储管理）、插件单元测试全覆盖
- **Unity 接口**：`IPlotFlowReader` 标准化 C# 读取接口、`PlotFlowJsonReader` 参考实现、示例驱动对话 UI 场景
- **Unreal 接口**：蓝图接口 `BPI_PlotFlowReader` 定义、C++ 数据模型 `FPlotFlowNode`/`FPlotFlowOption` 结构体（接口定义完成，运行时实现延后至 V0.2）

#### M5 — 补全引擎

- NGramEngine 核心（1-5 gram 统计模型，纯客户端）
- 预置语料库加载器（CorpusLoader，支持中英文分类加载）
- 倒排索引（InvertedIndex，按前缀快速检索）
- 引擎单元测试（658 用例，含 CorpusLoader 测试）
- 英文语料包（`corpus/en.json`，151 句，50% 游戏 + 50% 文学）
- 语料预处理脚本（`scripts/preprocess-corpus.ts`，分词 + 分类推断 + 输出）
- **注**：补全 UI（GhostText 渲染/Tab 接受/Ctrl+Space 下拉）、增量学习器、语料导入面板延后至 V0.2

#### M6 — 模板与主题

- **模板系统**：TemplateEngine（`{{var}}` 占位符替换）、4 个内置模板——RPG 对话模板（8 节点）、视觉小说模板（6 节点）、解谜游戏模板（10 节点 + 复杂条件链）、Godot 示例项目模板（含 `.mdstory` + 运行时库 + Godot 场景）
- **新建文件**：NewFileDialog 组件（选择模板 → 预览 → 填写标题/作者 → 创建）
- **暗色主题**：CSS 变量驱动（背景 `#1E1E1E`，文字 `#D4D4D4`）、Monaco 主题（7 色语法标记 vs PRD §5.5）、分支图节点样式（卡片 `#2D2D2D` + 边框 `#404040`）
- **亮色主题**：CSS 变量（背景 `#FFFFFF`，文字 `#333333`）、Monaco 主题（亮色色值）、分支图节点样式（卡片 `#FFFFFF` + 边框 `#DDDDDD`）
- **主题切换**：ThemeProvider（`data-theme` 属性 + CSS 变量即时切换，零闪烁）、ThemeToggle 工具栏按钮 + `Ctrl+Shift+T` 快捷键
- **国际化（i18n）**：轻量 i18n 框架（react-i18next 集成）、中文翻译文件（`locales/zh-CN.json`）、英文翻译文件（`locales/en-US.json`）、语言切换器（设置菜单即时切换，无刷新）

### Known Issues

- **M5 补全 UI 延后**：GhostText 幽灵字符渲染、Tab 接受/Esc 忽略交互、Ctrl+Space 多候选下拉菜单、增量学习器、权重衰减（90 天）、学习数据持久化、语料导入器及 CorpusManager 面板均延后至 V0.2；当前 N-gram 核心引擎已完成但无可视化交互入口
- **中文语料包未就绪**：`corpus/zh.json`（RPG 对话 40% + 视觉小说 30% + 解谜 15% + 通用 15%，3.5MB）待创建
- **Unreal 引擎接口未完整实现**：蓝图接口和 C++ 数据模型的定义已完成，但运行时集成和示例场景延后至 V0.2
- **Monaco Worker 配置未优化**：当前使用默认 Worker 加载方式，长文本（>5000 行）场景可能出现编辑卡顿，需在 V0.2 中实现 Worker 自定义配置
- **浏览器预览模式功能受限**：在纯浏览器环境（非 Electron）下，导出功能因缺失 `window.plotflow` IPC 通道而失败；部分 Electron-only 功能（文件保存对话框、原生菜单）不可用，且无明确的降级提示
- **首次启动引导未实装**：欢迎页（语言选择 → 主题选择 → 新建/打开文件）延后至 V0.2
- **M7 打包与发布全部延后**：electron-builder 配置、三平台安装包构建、文件关联注册、自动更新、GitHub Release 均未开始

### Changed

- 无（初始版本）

---

## [0.0.0] — 2026-06-12

- 项目初始化，规格文档编制（PRD、TAD、语法规范、里程碑规划）
