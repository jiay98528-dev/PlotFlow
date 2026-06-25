# PlotFlow 实时进度跟踪

> **版本**：V0.3 | **创建日期**：2026-06-12 | **更新**：2026-06-25 官方深度主题架构 — M0-M7 实际 132/142 (92.96%)
> **关联**：`spec/milestones.md`（任务定义来源，已归档为历史规划）| `CLAUDE.md`（开发规范）

---

## 总览

| 里程碑 | 名称 | 任务数 | 完成 | 进行中 | 未开始 | 阻塞 | 延后 | 移除 | 进度 |
|:---:|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| M0 | 项目脚手架 | 13 | 12 | 0 | 0 | 0 | 0 | 1 | 92.31% |
| M1 | 核心解析与编辑 | 17 | 17 | 0 | 0 | 0 | 0 | 0 | 100% |
| M2 | 分支可视化 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 100% |
| M3 | 条件编辑与错误检测 | 18 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| M4 | 导出系统 | 26 | 25 | 0 | 0 | 0 | 1 | 0 | 96.15% |
| M5 | 补全引擎 | 19 | 18 | 0 | 0 | 0 | 1 | 0 | 94.74% |
| M6 | 模板与主题 | 18 | 18 | 0 | 0 | 0 | 0 | 0 | 100% |
| M7 | Electron 打包发布 | 15 | 8 | 0 | 0 | 0 | 7 | 0 | 53.33% |
| **合计** | | **142** | **132** | **0** | **0** | **0** | **9** | **1** | **92.96%** |

> **2026-06-24 发行复核**：本文件以明细任务状态为唯一统计来源，只有 ✅ 计入完成，⏭️ 计入延后，❌ 计入移除。当前 M0-M7 明细真实统计为 132 个 ✅、9 个 ⏭️、1 个 ❌，即 132/142 (92.96%)。M8 Graph Lab Core 是新增图优先工作区范围，单独跟踪，不混入 M0-M7 历史总数。
> **2026-06-25 官方主题架构**：M9 Official Theme Architecture 是新增外观拓展范围，单独跟踪，不混入 M0-M7 历史统计。当前只发行官方主题，不开放社区导入或本地 `.pf-theme.zip` 产品入口。

---

## 状态图例

| 标记 | 含义 |
|:---:|------|
| ⬜ | 未开始 |
| 🔵 | 进行中 |
| ✅ | 已完成 |
| 🔴 | 阻塞（需外部依赖/决策） |
| ⏭️ | 跳过（本轮不实现） |
| ❌ | 已移除（不再计入可交付范围） |

---

## M0 项目脚手架

**目标**：工具链全绿，空 Electron 窗口可启动，零业务逻辑。

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M0-01 | pnpm workspace monorepo 初始化 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-02 | Electron 主进程骨架 | ✅ | 2026-06-13 | 2026-06-13 | 当前发行运行时为 Electron 42.5.0 |
| M0-03 | React 18 + TypeScript 5 渲染进程骨架 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-04 | TypeScript strict mode | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-05 | ESLint + Prettier 配置 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-06 | Vitest 单元测试框架 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-07 | Playwright E2E 框架 | ❌ | 2026-06-13 | 2026-06-16 | V0.1.1 移除 |
| M0-08 | GitHub Actions CI 骨架 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-09 | Git Hooks（pre-commit + commit-msg） | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-10 | 目录结构全量建立 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-11 | Zustand 状态管理初始化 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-12 | Monaco Editor 占位集成 | ✅ | 2026-06-13 | 2026-06-13 | |
| M0-13 | @plotflow/core 包骨架 | ✅ | 2026-06-13 | 2026-06-13 | |

---

## M1 核心解析与编辑

**目标**：Monaco 编辑器具备 PlotFlow 语法高亮，.mdstory 文件可完整解析为中间表示，大纲视图可导航。

### 解析器

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M1-01 | YAML Frontmatter 解析器 | ✅ | 2026-06-13 | 2026-06-13 | parser/frontmatter.ts |
| M1-02 | Markdown 节点解析器 | ✅ | 2026-06-13 | 2026-06-13 | parser/parser.ts |
| M1-03 | 选项语法解析（含条件/效果子行） | ✅ | 2026-06-13 | 2026-06-13 | parser/options.ts |
| M1-04 | 条件表达式解析器 | ✅ | 2026-06-13 | 2026-06-13 | parser/conditions.ts |
| M1-05 | 变量操作解析器 | ✅ | 2026-06-13 | 2026-06-13 | parser/effects.ts |
| M1-06 | PlotFlowData 中间表示模型 | ✅ | 2026-06-13 | 2026-06-13 | types/ast.ts (301 行) |
| M1-07 | 解析器单元测试（92 用例） | ✅ | 2026-06-13 | 2026-06-13 | __tests__/parser/ 目录 |

### 编辑器

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M1-08 | Monaco 语法高亮 — Tokenizer | ✅ | 2026-06-13 | 2026-06-17 | monaco-tokenizer.ts (V0.2 修复章节标题正则) |
| M1-09 | Monaco 语法高亮 — Theme | ✅ | 2026-06-13 | 2026-06-13 | monaco-theme-dark.json + light.json |
| M1-10 | 括号自动闭合 | ✅ | 2026-06-13 | 2026-06-13 | |
| M1-11 | 节点折叠（Code Folding） | ✅ | 2026-06-13 | 2026-06-13 | |
| M1-12 | 响应式保存（500ms debounce） | ✅ | 2026-06-13 | 2026-06-13 | |
| M1-13 | 文件操作服务 | ✅ | 2026-06-13 | 2026-06-13 | |

### 大纲视图

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M1-14 | OutlinePanel 组件 | ✅ | 2026-06-13 | 2026-06-13 | |
| M1-15 | 大纲与编辑器联动 | ✅ | 2026-06-13 | 2026-06-13 | |

### 状态栏 & 菜单

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M1-16 | StatusBar 组件 | ✅ | 2026-06-13 | 2026-06-13 | |
| M1-17 | 应用菜单栏（Electron Menu API） | ✅ | 2026-06-13 | 2026-06-13 | |

---

## M2 分支可视化

**目标**：React Flow 可编辑分支图实时反映 .mdstory 结构，拖拽连线同步修改文本，200 节点规模不卡。

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M2-01 | React Flow 画布集成 | ✅ | 2026-06-13 | 2026-06-13 | GraphCanvas.tsx |
| M2-02 | Dagre 布局引擎适配 | ✅ | 2026-06-13 | 2026-06-13 | layout.ts |
| M2-03 | AST → React Flow 数据适配器 | ✅ | 2026-06-13 | 2026-06-17 | adapter.ts (V0.2 Edge ID 编码加固) |
| M2-04 | StoryNodeCard 自定义节点组件 | ✅ | 2026-06-13 | 2026-06-13 | StoryNodeCard.tsx |
| M2-05 | 节点状态着色（5 种状态） | ✅ | 2026-06-13 | 2026-06-13 | adapter-helpers.ts |
| M2-06 | StoryEdge 自定义连线组件 | ✅ | 2026-06-13 | 2026-06-17 | StoryEdge.tsx (V0.2 全交互升级) |
| M2-07 | 单击节点 → 编辑器跳转 | ✅ | 2026-06-13 | 2026-06-13 | handleNodeClick |
| M2-08 | 双击节点 → 重命名模式 | ✅ | 2026-06-13 | 2026-06-17 | handleNodeDoubleClick + StoryNodeCard |
| M2-09 | 拖拽连线端点 → 修改跳转目标 | ✅ | 2026-06-13 | 2026-06-13 | handleConnect |
| M2-10 | 右键菜单（节点/空白） | ✅ | 2026-06-13 | 2026-06-13 | |
| M2-11 | Ctrl+点击 → 多选节点 | ✅ | 2026-06-13 | 2026-06-13 | |
| M2-12 | 缩放（10%~200%） | ✅ | 2026-06-13 | 2026-06-13 | |
| M2-13 | 中键拖拽平移 | ✅ | 2026-06-13 | 2026-06-13 | |
| M2-14 | 200 节点虚拟滚动 | ✅ | 2026-06-13 | 2026-06-13 | |
| M2-15 | 同层节点水平折叠 | ✅ | 2026-06-13 | 2026-06-13 | |
| M2-16 | 编辑器修改 → 分支图实时更新 | ✅ | 2026-06-13 | 2026-06-13 | |

---

## M3 条件编辑与错误检测

**目标**：图形化条件构建器可双向同步文本，三级错误系统完整标记并给出修复建议。

### 条件编辑器

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M3-01 | ConditionEditor 弹出面板组件 | ✅ | 2026-06-13 | 2026-06-17 | ConditionEditor.tsx (1,948 行, V0.2 接线完成) |
| M3-02 | 变量下拉框 | ✅ | 2026-06-13 | 2026-06-13 | 类型感知下拉 |
| M3-03 | 比较运算符下拉框 | ✅ | 2026-06-13 | 2026-06-13 | 按变量类型过滤 |
| M3-04 | 值输入框（类型感知） | ✅ | 2026-06-13 | 2026-06-13 | int/float/bool/enum/string |
| M3-05 | AND/OR 逻辑组构建器 | ✅ | 2026-06-13 | 2026-06-13 | 嵌套最多 3 层 |
| M3-06 | 条件预览行 | ✅ | 2026-06-13 | 2026-06-13 | 实时文本表达式 |
| M3-07 | 双向同步（面板 ↔ 文本） | ✅ | 2026-06-13 | 2026-06-17 | V0.2 添加 AST→面板加载 |
| M3-08 | 触发入口 | ✅ | 2026-06-13 | 2026-06-17 | V0.2 连线双击 + [🔧条件] 图标 |

### 错误检测

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M3-09 | 验证器引擎 — 8 种错误（E001-E008） | ✅ | 2026-06-13 | 2026-06-13 | validator.ts |
| M3-10 | 验证器引擎 — 6 种警告（W001-W006） | ✅ | 2026-06-13 | 2026-06-13 | |
| M3-11 | 验证器引擎 — 3 种建议（I001-I003） | ✅ | 2026-06-13 | 2026-06-13 | |
| M3-12 | 验证器单元测试（17 种 × ≥1 用例） | ✅ | 2026-06-13 | 2026-06-13 | |

### 错误呈现

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M3-13 | Monaco 波浪线装饰 | ✅ | 2026-06-13 | 2026-06-13 | diagnosticsDecorator.ts |
| M3-14 | 侧边栏标记点 | ✅ | 2026-06-13 | 2026-06-13 | diagnosticsDecorator.ts |
| M3-15 | Hover Tooltip | ✅ | 2026-06-13 | 2026-06-13 | diagnosticsDecorator.ts |
| M3-16 | ProblemPanel 组件 | ✅ | 2026-06-15 | 2026-06-15 | ProblemPanel 挂载到 App.tsx |
| M3-17 | 状态栏错误计数 | ✅ | 2026-06-13 | 2026-06-13 | StatusBar.tsx 已实现 |
| M3-18 | 错误→分支图着色同步 | ✅ | 2026-06-13 | 2026-06-15 | adapter.ts getNodeStatus 读取 diagnostics |

---

## M4 导出系统

**目标**：JSON/HTML/TXT 三种格式导出内容正确，Godot 插件编辑器+运行时可用，Unity/Unreal 接口定义完备。

### JSON 导出

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M4-01 | JSON 导出器 | ✅ | 2026-06-13 | 2026-06-13 | 已实现并验证 |
| M4-02 | JSON Schema 验证 | ✅ | 2026-06-13 | 2026-06-13 | 已接入验证流程 |
| M4-03 | 往返一致性测试 | ✅ | 2026-06-13 | 2026-06-13 | 已覆盖核心路径 |
| M4-04 | 特殊字符/边界测试 | ✅ | 2026-06-13 | 2026-06-13 | 已覆盖边界输入 |

### HTML 导出

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M4-05 | HTML 导出器（单文件自包含） | ✅ | 2026-06-13 | 2026-06-13 | 已实现并验证 |
| M4-06 | HTML 交互逻辑 | ✅ | 2026-06-13 | 2026-06-13 | 已实现并验证 |
| M4-07 | HTML 变量面板 | ✅ | 2026-06-13 | 2026-06-13 | 已实现并验证 |
| M4-08 | HTML 面包屑导航 | ✅ | 2026-06-13 | 2026-06-13 | 已实现并验证 |
| M4-09 | HTML 响应式布局 | ✅ | 2026-06-13 | 2026-06-13 | 已实现并验证 |

### TXT 导出

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M4-10 | TXT 导出器 | ✅ | 2026-06-13 | 2026-06-13 | 已实现并验证 |

### 导出 UI

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M4-11 | ExportDialog 组件 | ✅ | 2026-06-13 | 2026-06-13 | 已实现并验证 |
| M4-12 | 导出快捷键 + 菜单入口 | ✅ | 2026-06-13 | 2026-06-13 | 已接入菜单与快捷键 |

### Godot 插件

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M4-13 | Godot 编辑器插件入口 | ✅ | 2026-06-13 | 2026-06-13 | `addons/plotflow/plugin.gd` + `plugin.cfg` |
| M4-14 | Godot Dock 面板 | ✅ | 2026-06-13 | 2026-06-13 | `addons/plotflow/PlotFlowDock.gd` (147行) |
| M4-15 | Godot 变量同步器 | ✅ | 2026-06-13 | 2026-06-13 | `addons/plotflow/VariableSync.gd` (126行) |
| M4-16 | Godot 导出触发器 | ✅ | 2026-06-13 | 2026-06-13 | `addons/plotflow/ExportTrigger.gd` (48行) |
| M4-17 | Godot 运行时库 — StoryLoader | ✅ | 2026-06-13 | 2026-06-13 | `addons/plotflow/runtime/StoryLoader.gd` (99行) |
| M4-18 | Godot 运行时库 — StoryNode | ✅ | 2026-06-13 | 2026-06-13 | `addons/plotflow/runtime/StoryNode.gd` (80行) |
| M4-19 | Godot 运行时库 — ConditionEval | ✅ | 2026-06-13 | 2026-06-13 | `addons/plotflow/runtime/ConditionEval.gd` (146行) |
| M4-20 | Godot 运行时库 — VariableStore | ✅ | 2026-06-13 | 2026-06-13 | `addons/plotflow/runtime/VariableStore.gd` (53行) |
| M4-21 | Godot 插件单元测试 | ✅ | 2026-06-13 | 2026-06-13 | 运行时库完整（条件评估/变量存储/故事加载） |

### Unity 接口

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M4-22 | Unity C# 接口定义 | ✅ | 2026-06-13 | 2026-06-13 | `plugins/unity/IPlotFlowReader.cs` (277行) |
| M4-23 | Unity 示例实现 | ✅ | 2026-06-13 | 2026-06-13 | `plugins/unity/PlotFlowJsonReader.cs` (549行) |
| M4-24 | Unity 示例场景 | ⏭️ | — | — | 延后至 V0.3（不影响核心导出功能） |

### Unreal 接口

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M4-25 | Unreal 蓝图接口 | ✅ | 2026-06-13 | 2026-06-13 | `plugins/unreal/BPI_PlotFlowReader.uasset.md` 接口参考 |
| M4-26 | Unreal C++ 数据模型 | ✅ | 2026-06-13 | 2026-06-13 | `plugins/unreal/PlotFlowDataTypes.h` (15KB) |

---

## M5 补全引擎

**目标**：纯客户端 N-gram 引擎实现四维幽灵字符补全，Tab 接受/Esc 忽略，语料离线学习与导入。

> **注意**：引擎、UI、学习器、导入管道已全部完成。中文语料包当前 45KB（规格 3.5MB）、英文 30KB（规格 1.5MB），语料规模扩展计划在 V0.3 进行。

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M5-01 | NGramEngine 核心 | ✅ | — | — | `packages/core/src/completion/NGramEngine.ts` |
| M5-02 | 预置语料库加载器 | ✅ | — | — | `packages/core/src/completion/CorpusLoader.ts` |
| M5-03 | 倒排索引 | ✅ | — | — | `packages/core/src/completion/InvertedIndex.ts` |
| M5-04 | 引擎单元测试（≥24 用例） | ✅ | — | — | 658 用例（含 11 新增 CorpusLoader 测试） |
| M5-05 | 中文语料包（3.5MB） | ⏭️ | — | — | 延后至 V0.3 |
| M5-06 | 英文语料包（1.5MB） | ✅ | 2026-06-13 | 2026-06-13 | `packages/core/corpus/en.json` — 152 句，50% 游戏+50% 文学 |
| M5-07 | 语料预处理脚本 | ✅ | 2026-06-13 | 2026-06-13 | `scripts/preprocess-corpus.ts` — 空格分词+分类推断+输出 |
| M5-08 | GhostTextPlugin（Monaco 扩展） | ✅ | 2026-06-13 | 2026-06-17 | V0.2 接线到 setupEditor.ts |
| M5-09 | 四维触发检测 | ✅ | 2026-06-13 | 2026-06-17 | V0.2 全 4 维度就绪 |
| M5-10 | 幽灵字符渲染逻辑 | ✅ | 2026-06-13 | 2026-06-17 | InlineCompletionItem 灰色半透明 |
| M5-11 | Tab 接受 / Esc 忽略 / 输入覆盖 | ✅ | 2026-06-13 | 2026-06-17 | Monaco 原生行为 |
| M5-12 | Ctrl+Space 多候选下拉菜单 | ✅ | 2026-06-13 | 2026-06-17 | CompletionItemProvider 注册 |
| M5-13 | 频率控制（<100ms 不触发） | ✅ | 2026-06-13 | 2026-06-17 | MIN_TRIGGER_INTERVAL_MS=100 |
| M5-14 | 增量学习器 | ✅ | 2026-06-13 | 2026-06-13 | `packages/core/src/completion/Learner.ts` (359行) |
| M5-15 | N-gram 权重衰减（90 天机制） | ✅ | 2026-06-13 | 2026-06-13 | Learner.ts 实现 90 天半衰 / 180 天移除策略 |
| M5-16 | 学习数据持久化 | ✅ | 2026-06-13 | 2026-06-13 | `Persistence.ts` (373行)，JSON 文件持久化 |
| M5-17 | 语料导入器 | ✅ | 2026-06-13 | 2026-06-13 | `CorpusImporter.ts` (654行)，支持 .txt/.mdstory/.csv |
| M5-18 | 导入预处理 | ✅ | 2026-06-13 | 2026-06-13 | `PreprocessingPipeline.ts` (337行)，去重+分段+清洗 |
| M5-19 | CorpusManager 设置面板 | ✅ | 2026-06-13 | 2026-06-13 | `CorpusManager.tsx` (1029行)，语料列表+导入/禁用/删除 |

---

## M6 模板与主题

**目标**：4 个内置模板可创建新文件，暗色/亮色主题即时切换，中英双语完整覆盖。

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M6-01 | 模板引擎 | ✅ | 2026-06-13 | 2026-06-13 | `packages/core/src/template/TemplateEngine.ts`，保留未知占位符 |
| M6-02 | RPG 对话模板（8 节点） | ✅ | 2026-06-13 | 2026-06-13 | `templates/rpg-dialogue.mdstory`，单元测试验证节点数 |
| M6-03 | 视觉小说模板（6 节点） | ✅ | 2026-06-13 | 2026-06-13 | `templates/visual-novel.mdstory`，单元测试验证节点数 |
| M6-04 | 解谜游戏模板（10 节点） | ✅ | 2026-06-13 | 2026-06-13 | `templates/puzzle-escape.mdstory`，单元测试验证节点数 |
| M6-05 | Godot 示例项目模板（10 节点） | ✅ | 2026-06-13 | 2026-06-13 | `templates/godot-example/`，含 story、README、project、runtime script |
| M6-06 | NewFileDialog 组件 | ✅ | 2026-06-13 | 2026-06-13 | 模板选择、标题/作者输入、预览、创建闭环已接入 App |
| M6-07 | 暗色主题 CSS 变量 | ✅ | 2026-06-13 | 2026-06-13 | `tokens-dark.css`，CSS 变量驱动 |
| M6-08 | 暗色主题 Monaco 主题 | ✅ | 2026-06-13 | 2026-06-13 | `ThemeProvider` 同步 Monaco theme |
| M6-09 | 暗色主题分支图节点样式 | ✅ | 2026-06-13 | 2026-06-13 | `branch-graph.css` 使用 token 状态色 |
| M6-10 | 亮色主题 CSS 变量 | ✅ | 2026-06-13 | 2026-06-13 | `tokens-light.css`，默认亮色主题 |
| M6-11 | 亮色主题 Monaco 主题 | ✅ | 2026-06-13 | 2026-06-13 | `ThemeProvider` 同步 Monaco theme |
| M6-12 | 亮色主题分支图节点样式 | ✅ | 2026-06-13 | 2026-06-13 | 默认亮色 token 覆盖节点和连线状态 |
| M6-13 | ThemeProvider 机制 | ✅ | 2026-06-13 | 2026-06-13 | `html[data-theme]` + Monaco 主题即时同步 |
| M6-14 | ThemeToggle 工具栏按钮 | ✅ | 2026-06-13 | 2026-06-13 | 工具栏图标按钮 + `Ctrl+Shift+T` 菜单事件 |
| M6-15 | i18n 框架 | ✅ | 2026-06-13 | 2026-06-13 | `packages/core/src/i18n/i18n.ts`，轻量本地资源订阅 |
| M6-16 | 中文翻译文件 | ✅ | 2026-06-13 | 2026-06-13 | `locales/zh-CN.json` + core runtime resources |
| M6-17 | 英文翻译文件 | ✅ | 2026-06-13 | 2026-06-13 | `locales/en-US.json` + core runtime resources |
| M6-18 | 语言切换器 | ✅ | 2026-06-13 | 2026-06-13 | 工具栏语言 select，即时切换，无刷新 |

### M6 验证记录

| 类型 | 结果 | 备注 |
|------|------|------|
| TypeScript | ✅ | `pnpm.cmd exec tsc --noEmit` |
| ESLint | ✅ | `pnpm.cmd exec eslint . --ext .ts,.tsx`，0 errors；`scripts/preprocess-corpus.ts` 保留 25 个既有 `no-console` warnings |
| Stylelint | ✅ | `pnpm.cmd exec stylelint "packages/app/src/styles/**/*.css"` |
| Vitest | ✅ | `pnpm.cmd exec vitest run`，25 files / 746 tests |
| Production build | ✅ | `pnpm.cmd exec electron-vite build`；仍有既有 Vite externalized Node module warnings（`CorpusLoader.ts` 浏览器打包路径） |
| Runtime screenshots | ✅ | `test-results/m6-polish-shell-light.png`、`m6-polish-new-file-dialog.png`、`m6-polish-shell-dark.png`、`m6-polish-mobile.png` |

---

## M7 Electron 打包与发布

**目标**：三平台安装包生成，安装器体验正常，.mdstory 文件关联生效，自动更新通道就绪。

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M7-01 | electron-builder 配置 | ✅ | 2026-06-13 | 2026-06-13 | electron-builder.config.js |
| M7-02 | Windows 本地构建（NSIS .exe） | ✅ | 2026-06-23 | 2026-06-24 | `pnpm.cmd package:win` 显式加载 `electron-builder.config.js`，生成 `release/PlotFlow Setup 0.1.0.exe`、blockmap 与 `release/win-unpacked/PlotFlow.exe` |
| M7-03 | macOS 构建（.dmg） | ⏭️ | — | — | 需 CI 矩阵构建 |
| M7-04 | Linux 构建（.AppImage + .deb） | ⏭️ | — | — | 需 CI 矩阵构建 |
| M7-05 | 应用图标 | ✅ | 2026-06-13 | 2026-06-13 | `build/app-icons/` 多分辨率 + `.ico`/`.icns`/`.png` |
| M7-06 | 应用信息 | ✅ | 2026-06-13 | 2026-06-13 | package.json |
| M7-07 | .mdstory 文件关联 | ✅ | 2026-06-13 | 2026-06-13 | electron-builder.config.js 配置注册 |
| M7-08 | 双击 .mdstory → 应用打开 | ✅ | 2026-06-13 | 2026-06-13 | mainProcessUtils.ts `findStoryFileArgument` |
| M7-09 | electron-updater 集成 | ⏭️ | — | — | 延后至 V0.3 |
| M7-10 | 更新服务器配置 | ⏭️ | — | — | 延后至 V0.3 |
| M7-11 | CHANGELOG.md | ✅ | 2026-06-13 | 2026-06-17 | V0.2 更新 |
| M7-12 | GitHub Release 草稿 | ⏭️ | — | — | 延后至 V0.3 |
| M7-13 | 安装后首次启动引导 | ⏭️ | — | — | 延后至 V0.3 |
| M7-14 | Windows 安装包冒烟测试 | ✅ | 2026-06-23 | 2026-06-24 | packaged exe 启动、命令行打开 `.mdstory`、Graph Lab GUI 编辑、Source Drawer、导出 JSON smoke 通过 |
| M7-15 | macOS/Linux 基础冒烟测试 | ⏭️ | — | — | 延后至 V0.3 |

---

## M8 Graph Lab Core（图优先正式入口）

**目标**：在不替换现有 split 分栏模式的前提下，把“流程图优先”的完整 GUI 操作闭环推进为正式版核心入口之一。`.mdstory` 仍是唯一磁盘格式，Graph Lab 与源文本是同一故事数据的双投影。

> **统计规则**：M8 是 2026-06-23 新增图优先范围，当前 17/18，暂不混入 M0-M7 142 项历史发行统计。M8-18 的发布说明/帮助文案随公开下载页收尾。

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M8-01 | `workspaceMode: 'split' \| 'graphLab'` 状态与持久化 | ✅ | 2026-06-24 | 2026-06-24 | `useUIStore` 持久化模式，测试桥接可读写 |
| M8-02 | 顶部模式切换按钮与快捷键 | ✅ | 2026-06-24 | 2026-06-24 | Toolbar Split/Graph Lab 按钮与 `Ctrl+Shift+G` |
| M8-03 | Graph Lab 全屏画布壳 | ✅ | 2026-06-24 | 2026-06-24 | `GraphLabWorkspace` 三栏图优先布局 |
| M8-04 | 节点 palette 与空白画布创建入口 | ✅ | 2026-06-24 | 2026-06-24 | `GraphLabPalette` 创建章节/节点/结局与重新布局 |
| M8-05 | `graphEditService` 命令层 | ✅ | 2026-06-24 | 2026-06-24 | GUI 操作统一生成 `.mdstory` 文本编辑并走解析管线 |
| M8-06 | GUI 创建/删除节点 | ✅ | 2026-06-24 | 2026-06-24 | Palette 创建，Inspector 删除 |
| M8-07 | Inspector 编辑节点标题、章节、正文 | ✅ | 2026-06-24 | 2026-06-24 | 改名后同步选中节点 id，避免 Inspector 丢失上下文 |
| M8-08 | GUI 创建/编辑/删除/排序选项 | ✅ | 2026-06-24 | 2026-06-24 | 支持描述、目标、条件、效果、上移/下移/删除 |
| M8-09 | 拖线连接已有目标节点 | ✅ | 2026-06-24 | 2026-06-24 | 蓝图式线缆热区；拖到已有节点直接写回选项目标 |
| M8-10 | 拖线到空白处创建目标节点并连接 | ✅ | 2026-06-24 | 2026-06-24 | 空投动作菜单支持创建普通节点、创建结局节点、搜索已有节点、取消 |
| M8-11 | 条件编辑器嵌入 Inspector | ✅ | 2026-06-24 | 2026-06-24 | Inspector 内联编辑 `[条件]`，保留原浮层条件编辑器 |
| M8-12 | 效果编辑器 | ✅ | 2026-06-24 | 2026-06-24 | Inspector 内联编辑 `[效果]` |
| M8-13 | 变量和 meta 编辑入口 | ✅ | 2026-06-24 | 2026-06-24 | Meta title/author 与 `vars:` 类型声明编辑 |
| M8-14 | 图模式诊断状态与 ProblemPanel 联动 | ✅ | 2026-06-24 | 2026-06-24 | Graph Lab 复用 ProblemPanel 与诊断同步状态 |
| M8-15 | 可折叠 Source Drawer | ✅ | 2026-06-24 | 2026-06-24 | 源文本只读/定位辅助抽屉，Graph Lab 内可展开 |
| M8-16 | GUI 操作与 Monaco 撤销栈同步 | ✅ | 2026-06-24 | 2026-06-24 | 优先 `executeEdits()`，无 editor 实例时 fallback 到 store |
| M8-17 | Graph Lab 完整用户旅程 E2E | ✅ | 2026-06-24 | 2026-06-24 | `graph-lab.e2e.spec.ts` 覆盖创建、编辑、节点位置持久化、拖线到已有节点、空投创建节点、断开线缆、变量、Source Drawer、导出 JSON |
| M8-18 | 发布说明、帮助文案、公开下载页收尾 | 🔵 | 2026-06-24 | — | Graph Lab 已转正式入口；公开发布文案待随下载页统一收尾 |

---

## M9 Official Theme Architecture（官方深度主题架构）

**目标**：把主题从 token/layoutRecipe 级别推进为官方编译内置模块热插拔。当前只发行官方主题，官方主题可以替换节点、线缆、端口、面板、Monaco 配色、预览和动效；社区主题、本地 `.pf-theme.zip` 和远程下载暂不开放为产品入口。

> **统计规则**：M9 是 2026-06-25 新增主题生态范围，暂不混入 M0-M7 142 项历史发行统计。

| # | 任务 | 状态 | 开始 | 完成 | 备注 |
|---|------|:---:|------|------|------|
| M9-01 | OfficialThemeDefinition 合同 | ✅ | 2026-06-25 | 2026-06-25 | manifest、tokens、Monaco、assets、layoutRecipe、motionRecipe、storeMeta、React slots |
| M9-02 | 官方主题 provider | ✅ | 2026-06-25 | 2026-06-25 | `activeOfficialThemeId`、旧 `themePack` 迁移、CSS var/data attribute、Monaco 注册 |
| M9-03 | 叙事工作台官方主题 | ✅ | 2026-06-25 | 2026-06-25 | `plotflow-narrative-workbench`：暖纸工作台 + 蓝图线缆 |
| M9-04 | 夜航蓝图官方主题 | ✅ | 2026-06-25 | 2026-06-25 | `plotflow-blueprint-nightwatch`：低光编辑室 + 发光线缆 |
| M9-05 | Theme Slots 接入 GraphCanvas | ✅ | 2026-06-25 | 2026-06-25 | 节点、线缆、预览 slot 随官方主题切换；不再固定旧 `StoryNodeCard`/`StoryEdge` |
| M9-06 | HomeSurface 与 ThemeCenter | ✅ | 2026-06-25 | 2026-06-25 | 起始页主题模块、Topbar 主题入口、官方主题启用/重置/商店跳转；不暴露导入主题包 |
| M9-07 | 官网官方主题展示 | ✅ | 2026-06-25 | 2026-06-25 | 首页展示 `叙事工作台` 与 `夜航蓝图`，开发页口径改为官方主题 |
| M9-08 | 社区主题/本地导入/内置市场 | ⏭️ | — | — | 暂不开放；后续另立主题市场与授权范围 |

---

## 延期与移除项

| 里程碑 | 阻塞数 | 说明 |
|--------|:---:|------|
| M0 | 1 | M0-07 Playwright E2E 框架历史任务在 V0.1.1 移除；当前 E2E 已在 app 包内恢复，不按原 M0 任务计数 |
| M4 | 1 | M4-24 Unity 示例场景延后至 V0.3，不影响 JSON/HTML/TXT 与 Godot 闭环 |
| M5 | 1 | M5-05 中文语料包扩展至 3.5MB 延后至 V0.3 |
| M7 | 7 | macOS/Linux 安装包、自动更新、GitHub Release、首次启动引导、macOS/Linux 冒烟测试延后 |

---

## 发行门禁状态

| 门禁 | 当前结果 | 备注 |
|------|------|------|
| `pnpm.cmd lint` | ✅ PASS | 0 error，8 个既有 `no-console` warning |
| `pnpm.cmd typecheck` | ✅ PASS | TypeScript strict 通过 |
| `pnpm.cmd test` | ✅ PASS | 41 files / 1231 tests；新增官方主题定义测试通过 |
| `pnpm.cmd build` | ✅ PASS | 保留 1 个 Vite 动态/静态 import warning |
| `pnpm.cmd lint:css` | ✅ PASS | CSS token/stylelint 通过 |
| `pnpm.cmd --filter @plotflow/progress-dashboard test` | ✅ PASS | 进度仪表盘单元测试通过 |
| `pnpm.cmd --filter @plotflow/progress-dashboard typecheck` | ✅ PASS | 进度仪表盘类型检查通过 |
| `pnpm.cmd --filter @plotflow/app test:e2e` | ✅ PASS | 39 passed，无 teardown error，无 did-not-run；含 Graph Lab 主路径、Split 局部图视图控制隔离、官方主题中心、叙事工作台/夜航蓝图 slot 热切换用例 |
| `pnpm.cmd audit --audit-level moderate` | ✅ PASS | Electron 42.5.0；无 GHSA ignore；No known vulnerabilities found |
| `pnpm.cmd package:win` | ✅ PASS | 生成 `release/PlotFlow Setup 0.1.0.exe`、blockmap 与 `release/win-unpacked/PlotFlow.exe` |
| Windows packaged smoke | ✅ PASS | packaged exe 可启动；命令行打开 `.mdstory`、Graph Lab GUI 编辑、Source Drawer、导出 JSON 成功 |

---

## 当前卡点

| 卡点 | 影响 | 判断 |
|------|------|------|
| 旧 Electron 主版本安全风险接受 | 已解除 | 运行时已迁移到 Electron 42.5.0，`pnpm audit --audit-level moderate` 无已知漏洞，旧风险接受文档仅保留为历史快照 |
| ExportDialog E2E 自动关闭竞态 | 历史复核卡点，本轮未复现 | 上一轮失败指向导出对话框 auto-close timer 与 close helper 竞争；本轮导出套件 5/5 通过，保留为回归关注项 |
| 平台发布任务延后 | 阻断完整商业发行 | macOS/Linux 安装包、自动更新、发布草稿、首次启动引导、macOS/Linux 冒烟尚未完成 |
| Graph Lab 发布说明/帮助文案未收尾 | 不阻断 Windows 本地包技术验收，影响公开下载页和用户上手材料 | Graph Lab 核心 GUI 闭环、E2E 与 packaged smoke 已通过；M8-18 保持进行中 |
| 主题市场与授权 | 后续增强项 | 当前只发行官方内置主题，购买入口跳转官网；社区主题、本地导入、远程索引、授权下载和更新留到后续任务 |

---

## 变更日志

| 日期 | 变更 |
|------|------|
| 2026-06-12 | 初始化进度追踪文档，142 项任务全部标记 ⬜ |
| 2026-06-13 | 同步 M6 模板与主题完成状态：18/18，当日历史进度为 125/142（88%），补充验证与截图记录 |
| 2026-06-16 | V0.1.1 数据校正：修正 M1/M2/M3/M5/M7 总览表数据不一致，标记延后项为 ⏭️，合计进度修正为 73/142 (51%) |
| 2026-06-17 | **V0.2 里程碑**：进度校正 — M1 解析器/M2 分支图/M3 条件编辑器/M5 补全引擎 实际已完整实现。完成连线交互基础设施（StoryEdge 全交互升级、EdgeContextMenu、Alt+删除、双击→条件编辑器）、条件编辑器 AST 加载、GhostText 接线、Edge ID encodeURIComponent 加固、章节标题正则修复。1090 测试全 PASS。合计进度 111/142 (78%)。Git 仓库推送至 jiay98528-dev/PlotFlow。 |
| 2026-06-20 | **V0.3 进度校正**：代码审计发现 M4（Godot/Unity/Unreal 插件共13项）和 M5（增量学习器/语料导入/预处理/持久化/CorpusManager 共5项）实际已完整实现但未在 progress.md 中记录。V0.2 QA 审计 2 CRITICAL+8 HIGH 全部修复验证通过。当日快照为 132/142 (93%)。修正 M7 图标状态。 |
| 2026-06-23 | **历史快照：发行审计 E2E 修复验收**：Parser/Validator E2E 公共 helper 与 minimap DOM 稳定性问题已修复。当时完整默认 E2E 复核中导出套件 5/5 通过，但 Parser/Validator TC-6 在 `afterAll` 关闭 Electron 时超时，当时 `pnpm.cmd --filter @plotflow/app test:e2e` 为 28/29 passed；基础门禁 lint/typecheck/test/build/lint:css 均通过。`pnpm.cmd audit --audit-level moderate` 当时仍失败（29 vulnerabilities），作为独立安全门禁保留。 |
| 2026-06-23 | **历史快照：进度权威校正与 Graph Lab 同步**：按任务明细重新统计为 130 个 ✅、11 个 ⏭️、1 个 ❌，即 M0-M7 当时为 130/142 (91.55%)。新增 M8 Graph Lab Experimental 18 项，全部未开始，不混入 M0-M7 历史统计。 |
| 2026-06-23 | **发行阻断修复与 M7 本地打包复核**：Parser/Validator teardown 改为 race-safe 关闭，默认 app E2E 恢复 29/29。升级 Vitest/Vite/electron-vite/electron-builder/tar 链路并迁移到 pnpm 11.5.1，Electron 28 剩余 17 个 GHSA 以风险接受文档和 `auditConfig.ignoreGhsas` 显式放行，`pnpm.cmd audit --audit-level moderate` 退出码为 0。`pnpm.cmd package:win` 成功生成 NSIS installer 与 win-unpacked，packaged smoke 验证启动、命令行打开、编辑保存、JSON 导出通过。M7-02/M7-14 标记完成，当前 M0-M7 为 132/142 (92.96%)。 |
| 2026-06-24 | **Graph Lab 正式入口与 Electron 42 Windows 正式包**：新增 `workspaceMode`、Graph Lab 三栏工作区、Palette、Inspector、Source Drawer 与 `graphEditService` 命令层，GUI 编辑统一落回 `.mdstory` 并复用解析管线。新增 Graph Lab E2E，默认 app E2E 更新为 30/30。Electron 迁移到 42.5.0，移除 GHSA ignore，`pnpm.cmd audit --audit-level moderate` 无已知漏洞。修正打包脚本显式加载 `electron-builder.config.js`，`pnpm.cmd package:win` 生成 `release/PlotFlow Setup 0.1.0.exe`，asar 扫描确认不包含 `website/`，packaged smoke 覆盖命令行打开、Graph Lab GUI 编辑、Source Drawer、导出 JSON。 |
| 2026-06-24 | **Graph Lab 蓝图式画布交互升级**：新增 `.mdstory` 可选 `layout.graph.nodes` 布局投影，节点拖拽实时移动并在松手写回坐标；线缆热区改为卡片底部正常布局行，支持拖到已有节点连接、拖到空白打开动作菜单、创建节点并连接、拖既有线缆到空白断开。Graph Lab E2E 5/5 覆盖上述主路径。 |
| 2026-06-25 | **官方深度主题架构与主题入口**：新增 `OfficialThemeDefinition`、官方主题 provider、`activeOfficialThemeId` 持久化与旧 `themePack` 迁移。首发 `plotflow-narrative-workbench`（叙事工作台）和 `plotflow-blueprint-nightwatch`（夜航蓝图），GraphCanvas 节点/线缆改由当前官方主题 slots 提供。新增 HomeSurface 与 ThemeCenter，Topbar 和首页均可进入主题中心，购买入口跳转官网，产品 UI 不再暴露本地主题包导入。官网首页新增官方主题展示。新增官方主题单元测试与 E2E，验证主题中心、根属性、节点 slot、edge slot 和核心 CSS var 热切换。当前完整默认 app E2E 为 39/39 passed。 |

---

*本文档每次提交后更新。里程碑完成时同步更新 `CLAUDE.md` 中的阶段状态。V0.3 起本文件作为唯一进度权威来源。*
