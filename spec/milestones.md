# PlotFlow 里程碑规划

> 版本：V0.2 | 日期：2026-06-13 | 更新：标注模型分配与串并行策略
> 关联文档：`PRD.md`（功能规格）、`CLAUDE.md`（开发规范 + 工作流策略）
> 
> **归档注记（2026-06-20）**：本文档是 V0.1-V0.2 开发阶段的历史规划与模型分配参考。
> 当前实际进度以 `spec/progress.md` 为准（132/142, 93%）。里程碑任务定义已全部落地，
> 剩余 10 项为 M7 打包发布相关。V0.3 开发不再需要此规划文档作为基线。

---

## 模型分配图例

| 标记 | Agent model | 路由 | 适用场景 |
|:---:|:---:|------|------|
| ⚡ | `"haiku"` | **V4Flash** | 纯配置文件 / 模板填充 / 测试用例 / 格式转换 / CSS Token 翻译 |
| 🔶 | `"sonnet"` | **V4Flash** | 骨架代码 / 标准组件 / i18n / 接口定义 / 展示组件 |
| 🧠 | 默认 | **V4Pro** | 解析器核心 / 架构设计 / 交互逻辑 / 性能优化 / 双向同步 |
| ∥ | — | **并行** | 独立于其他任务，可与同阶段任务并行执行 |
| → | — | **串行** | 依赖前置任务产物，或需避免竞态条件 |

---

## 总览

| 里程碑 | 名称 | 总任务 | ⚡haiku | 🔶sonnet | 🧠V4Pro | Fast占比 | 预估 |
|:---:|------|:---:|:---:|:---:|:---:|:---:|:---:|
| M0 | 项目脚手架 | 13 | 9 | 2 | 2 | 85% | 2-3天 |
| M1 | 核心解析与编辑 | 17 | 5 | 4 | 8 | 53% | 3-4天 |
| M2 | 分支可视化 | 16 | 4 | 4 | 8 | 50% | 3天 |
| M3 | 条件编辑与错误检测 | 18 | 7 | 5 | 6 | 67% | 2天 |
| M4 | 导出系统 | 26 | 17 | 6 | 3 | 88% | 2天 |
| M5 | 补全引擎 | 19 | 5 | 4 | 10 | 47% | 2天 |
| M6 | 模板与主题 | 18 | 12 | 4 | 2 | 89% | 1天 |
| M7 | Electron 打包发布 | 15 | 8 | 3 | 4 | 73% | 2天 |
| **合计** | | **142** | **67** | **32** | **43** | **70%** | 15-18天 |

> **70% 任务可委派 V4Flash**，通过 Workflow 并行执行，wall-clock 时间可压缩至串行的 30-40%。

---

## M0 项目脚手架

**目标**：工具链全绿，空 Electron 窗口可启动，零业务逻辑。

### 交付物

| #      | 任务                                   | 产出                                                              |
| ------ | -------------------------------------- | ----------------------------------------------------------------- |
| M0-01  | pnpm workspace monorepo 初始化         | `pnpm-workspace.yaml`，`packages/app/` + `packages/core/` 骨架    |
| M0-02  | Electron 28+ 主进程骨架                | `packages/app/src/main/`，`pnpm dev` 可启动空白窗口               |
| M0-03  | React 18 + TypeScript 5 渲染进程骨架   | `packages/app/src/renderer/`，Vite 构建通过                       |
| M0-04  | TypeScript strict mode                | 全项目 `tsconfig.json`，`tsc --noEmit` 零错误                     |
| M0-05  | ESLint + Prettier 配置                 | `.eslintrc.cjs`、`.prettierrc`，`eslint src/` 零警告              |
| M0-06  | Vitest 单元测试框架                    | `vitest.config.ts`，示例测试 PASS                                 |
| M0-07  | Playwright E2E 框架                    | ❌ V0.1.1 移除（`playwright.config.ts`、`e2e/` 已删除）             |
| M0-08  | GitHub Actions CI 骨架                 | `.github/workflows/ci.yml`，L1 自动运行（lint + typecheck + test）|
| M0-09  | Git Hooks（pre-commit + commit-msg）   | `lint-staged` + `commitlint`                                      |
| M0-10  | 目录结构全量建立                       | `src/components/`、`src/stores/`、`src/services/`、`src/types/`   |
| M0-11  | Zustand 状态管理初始化                 | `packages/app/src/stores/`，store 骨架 + devtools 集成            |
| M0-12  | Monaco Editor 占位集成                 | 编辑器组件挂载，基础文本编辑可用，无语法高亮                      |
| M0-13  | `@plotflow/core` 包骨架                | `packages/core/` 入口 + 类型导出 + 空解析器桩                     |

### L4 复审清单

- [ ] `pnpm install` 无报错
- [ ] `pnpm dev` 启动，空白 Electron 窗口显示（约 800x600）
- [ ] `pnpm build` 构建成功，产物存在于 `dist/`
- [ ] `npx tsc --noEmit` 零错误
- [ ] `npx eslint src/` 零警告
- [ ] `npx vitest run` 全量 PASS
- [ ] CI（GitHub Actions）绿色
- [ ] `pnpm-workspace.yaml` 正确，`@plotflow/core` 可被 `@plotflow/app` 引用
- [ ] Git commit 触发 pre-commit hook（lint-staged 运行）
- [ ] Monaco 编辑器组件在窗口中可输入文字

### 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Electron + Vite 构建配置复杂 | 延误 0.5 天 | 使用 `electron-vite` 脚手架而非手配 |
| pnpm workspace 依赖解析冲突 | 构建失败 | 统一版本号，`pnpm.overrides` 锁定关键包 |
| Windows CI runner 不可用 | 无法 CI | 先用 GitHub Actions ubuntu-latest，手工 Windows 验证 |

---

## M1 核心解析与编辑

**目标**：Monaco 编辑器具备 PlotFlow 语法高亮，.mdstory 文件可完整解析为中间表示，大纲视图可导航。

### 交付物

| #      | 任务                               | 产出                                                                |
| ------ | ---------------------------------- | ------------------------------------------------------------------- |
| **解析器** |                                  |                                                                     |
| M1-01  | YAML Frontmatter 解析器            | `packages/core/src/parser/frontmatter.ts`，解析变量声明 + 类型校验  |
| M1-02  | Markdown 节点解析器                | `packages/core/src/parser/parser.ts`，unified + remark 自定义插件   |
| M1-03  | 选项语法解析（含条件/效果子行）    | 解析 `[选项]` + `条件:` + `效果:` 完整语法树                        |
| M1-04  | 条件表达式解析器                   | 支持 `== != > < >= <= AND OR NOT` + 嵌套括号 + 字段访问 `.`         |
| M1-05  | 变量操作解析器                     | 解析 `赋值/增减/追加` 三种操作语法                                  |
| M1-06  | PlotFlowData 中间表示模型          | `packages/core/src/types/ast.ts`，完整 AST 类型定义                 |
| M1-07  | 解析器单元测试                     | `tests/unit/parser/`，覆盖 92 个用例（PRD §12.1 规划）              |
| **编辑器** |                                  |                                                                     |
| M1-08  | Monaco 语法高亮 — Tokenizer        | `packages/app/src/renderer/editor/monaco-tokenizer.ts`，7 色标记    |
| M1-09  | Monaco 语法高亮 — Theme            | 暗色主题色值注入（`#569CD6` 蓝/`#6A9955` 绿/`#CE9178` 橙等）       |
| M1-10  | 括号自动闭合                       | `[` 输入后自动补 `]`，光标定位到中间                                |
| M1-11  | 节点折叠（Code Folding）           | Monaco folding provider，`## 节点：` 块可折叠                       |
| M1-12  | 响应式保存（500ms debounce）       | 每次有效修改后自动写入磁盘，通过 IPC 调用主进程                     |
| M1-13  | 文件操作服务                       | `IFileService` 接口 + Electron 实现（打开/保存/新建/另存为）        |
| **大纲视图** |                                  |                                                                     |
| M1-14  | OutlinePanel 组件                  | 左侧边栏，树形展示章节→节点层级，点击跳转到编辑器对应行             |
| M1-15  | 大纲与编辑器联动                   | 编辑器滚动 → 大纲高亮当前节点；大纲点击 → 编辑器 `revealLine`       |
| **状态栏** |                                  |                                                                     |
| M1-16  | StatusBar 组件                     | 右下角：保存状态（✅/⏳/●）+ 节点数/选项数 + 缩放比例               |
| **菜单** |                                  |                                                                     |
| M1-17  | 应用菜单栏（Electron Menu API）    | 文件/编辑/视图/导出/帮助 五菜单，部分绑定快捷键                     |

### L4 复审清单

**解析正确性**：

- [ ] 打开 `PRD §4.6` 完整示例 `.mdstory` → 解析为 `PlotFlowData` → 无报错
- [ ] Frontmatter 解析：`int`/`float`/`bool`/`string`/`enum`/`object`（含 3 层嵌套）全部正确
- [ ] 节点解析：章节归属、`fullId` 生成、跨章节引用
- [ ] 选项解析：无条件选项、带条件选项、带效果选项、条件+效果同时存在
- [ ] 条件表达式：`($a>=5) AND ($b==true)` → AST 结构正确
- [ ] 效果表达式：`(好感度+3, 金币-10, 武器='长剑')` → 副作用列表正确
- [ ] 空 Frontmatter（无变量声明）→ 不报错，变量列表为空
- [ ] 特殊字符（Unicode/emoji/中英混排）→ 解析不崩溃

**编辑体验**（手感）：

- [ ] 打开 `.mdstory` → 语法高亮即时生效，7 种标记色准确
- [ ] 输入 `# 节点：` → 蓝色显示；输入 `[选项]` → 绿色显示
- [ ] 输入 `$变量` → 紫色显示；输入 `条件:` → 橙色显示
- [ ] 输入 `[` → 自动补 `]`，光标在中间
- [ ] 折叠节点块（`## 节点：XXX` 区域）→ 折叠/展开流畅
- [ ] Ctrl+S 强制保存 → 右下角状态栏 ✅
- [ ] 停止输入 500ms → 自动保存触发 → 状态栏 ✅
- [ ] 新建文件 → 写入内容 → 保存 → 关闭 → 重新打开 → 内容一致
- [ ] 中文输入法 → 正常输入，不高亮混乱

**大纲视图**（功能）：

- [ ] 加载 `.mdstory` → 大纲树显示所有章节+节点
- [ ] 点击大纲中的节点 → 编辑器滚动到对应行并高亮
- [ ] 编辑器滚动到不同节点 → 大纲自动展开并高亮当前节点
- [ ] 大纲面板可折叠/展开，拖拽边缘调整宽度（200px 默认）

### 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| unified/remark 插件开发复杂 | 延误 1 天 | 先手写简单递归下降解析器，M2 后再迁移到 unified |
| Monaco tokenizer 状态机 bug | 高亮错误 | 用 PRD §4.6 完整示例做黄金测试，逐 token 对比 |
| 嵌套 object 解析（3层）递归溢出 | 解析崩溃 | 硬限制深度=3，超限报 E006 错误而非崩溃 |
| 自动保存与外部修改冲突 | 数据丢失 | mtime 检测 + 冲突对话框（参考 MarkLuck M7-04） |

---

## M2 分支可视化

**目标**：React Flow 可编辑分支图实时反映 .mdstory 结构，拖拽连线同步修改文本，200 节点规模不卡。

### 交付物

| #      | 任务                               | 产出                                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------------------- |
| **核心集成** |                              |                                                                           |
| M2-01  | React Flow 画布集成                | `packages/app/src/renderer/graph/GraphCanvas.tsx`，与编辑器并排显示        |
| M2-02  | Dagre 布局引擎适配                 | `packages/app/src/renderer/graph/layout.ts`，自上而下树状布局             |
| M2-03  | AST → React Flow 数据适配器        | `packages/app/src/renderer/graph/adapter.ts`，PlotFlowData → Nodes + Edges |
| **节点组件** |                              |                                                                           |
| M2-04  | StoryNodeCard 自定义节点组件       | 显示：节点标题 + 前 30 字正文摘要 + 选项数量徽章                          |
| M2-05  | 节点状态着色（5 种状态）           | 🟢正常 / 🟡孤立 / ⬜死胡同 / 🔴错误 / 🔵当前选中                          |
| **连线组件** |                              |                                                                           |
| M2-06  | StoryEdge 自定义连线组件           | 条件连线：`#CE9178` 虚线 + 贝塞尔；无条件连线：`#4EC9B0` 实线 + 贝塞尔     |
| **交互行为** |                              |                                                                           |
| M2-07  | 单击节点 → 编辑器跳转              | 单击节点卡片 → 编辑器 `revealLine` 到对应 `## 节点：` + 节点高亮          |
| M2-08  | 双击节点 → 重命名模式              | 双击节点卡片 → 内联编辑节点标题 → 同步到文本                              |
| M2-09  | 拖拽连线端点 → 修改跳转目标        | 拖拽连线 endpoint 到另一节点 → 更新 `.mdstory` 中 `-> 节点：目标`         |
| M2-10  | 右键菜单（节点/空白）              | 节点右键：跳转/重命名/添加选项/删除节点；空白右键：添加节点/重新布局/导出PNG |
| M2-11  | Ctrl+点击 → 多选节点               | 多选后支持批量操作（预留接口）                                            |
| **画布操作** |                              |                                                                           |
| M2-12  | 缩放（10%~200%）                   | 鼠标滚轮缩放 + Ctrl+0 恢复默认（100%）                                    |
| M2-13  | 中键拖拽平移                       | 中键按住拖拽移动画布                                                      |
| **性能** |                              |                                                                           |
| M2-14  | 200 节点虚拟滚动                   | 超 200 节点启用 `onlyRenderVisibleElements`，≥30fps                       |
| M2-15  | 同层节点水平折叠                   | 同层超 20 节点时启用水平折叠                                              |
| **联动** |                              |                                                                           |
| M2-16  | 编辑器修改 → 分支图实时更新        | debounce 300ms 后重新解析 → React Flow 增量更新                           |

### L4 复审清单

**视觉**：

- [ ] 加载 10 节点 `.mdstory` → 分支图显示自上而下树状布局，根节点在顶部中央
- [ ] 节点卡片显示：标题 + 前 30 字摘要 + 选项数量徽章（如 `[3]`）
- [ ] 条件连线：橙色虚线；无条件连线：青色实线；贝塞尔曲线平滑
- [ ] 孤立节点（无入口）→ 黄色边框 + 放置在画布右侧独立区域
- [ ] 死胡同节点（无出口）→ 灰色边框
- [ ] 错误节点（语法错误/引用不存在）→ 红色边框 + 错误图标
- [ ] 编辑器光标所在节点 → 蓝色光晕高亮
- [ ] 节点间距：同层水平 ≥150px，父子垂直 120px

**交互**：

- [ ] 单击节点 → 编辑器滚动到对应位置，节点高亮
- [ ] 双击节点 → 进入重命名模式，修改标题 → 文本同步更新
- [ ] 拖拽连线端点到另一节点 → `-> 节点：目标` 文本自动更新
- [ ] 右键节点 → 弹出菜单（跳转/重命名/添加选项/删除节点全部可用）
- [ ] 右键空白 → 弹出菜单（添加节点/重新布局/导出 PNG）
- [ ] 滚轮缩放 → 10%~200% 范围限制，Ctrl+0 恢复 100%
- [ ] 中键拖拽 → 平移画布流畅
- [ ] Ctrl+点击 → 多选节点高亮

**同步**：

- [ ] 编辑器中修改选项的 `-> 节点：X` → 分支图连线目标更新
- [ ] 编辑器中新增 `## 节点：Y` → 分支图出现新节点卡片
- [ ] 编辑器中删除整个节点块 → 分支图移除对应节点+连线
- [ ] 分支图拖拽连线 → `.mdstory` 文本中 `-> 节点：目标` 更新

**性能**：

- [ ] 200 节点项目 → 分支图 ≥30fps，操作不卡顿
- [ ] 1000 选项项目 → 数据适配耗时 <500ms

### 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 拖拽连线到错误节点类型 | 生成非法引用 | 拖拽时过滤目标：仅允许 `## 节点：` 行接收连线 |
| 大图布局抖动 | 用户体验差 | Dagre 布局异步计算，动画过渡防抖 |
| React Flow 版本 API 不稳定 | 重构成本 | 锁定 v11.x，封装适配层隔离 React Flow 细节 |
| 分支图编辑→文本同步竞争 | 数据不一致 | 操作锁机制：一次只允许一种编辑来源生效 |

---

## M3 条件编辑与错误检测

**目标**：图形化条件构建器可双向同步文本，三级错误系统完整标记并给出修复建议。

### 交付物

| #      | 任务                               | 产出                                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------------------- |
| **条件编辑器** |                              |                                                                           |
| M3-01  | ConditionEditor 弹出面板组件       | `packages/app/src/renderer/panels/ConditionEditor.tsx`，Airtable 风格      |
| M3-02  | 变量下拉框（读取 Frontmatter/引擎）| 自动填充已声明的变量列表 + 类型图标                                       |
| M3-03  | 比较运算符下拉框                   | `==` `!=` `>` `<` `>=` `<=` 六种，根据变量类型过滤可用运算符              |
| M3-04  | 值输入框（类型感知）               | int/float → 数字输入；bool → true/false 下拉；enum → 合法值下拉           |
| M3-05  | AND/OR 逻辑组构建器                | 添加条件组按钮，支持嵌套 3 层（与 PRD §3.1.3 一致）                       |
| M3-06  | 条件预览行（实时文本）             | 面板底部显示 `($开锁技能>=5) AND ($有工具==true)` 预览                    |
| M3-07  | 双向同步（面板 ↔ 文本）            | 面板修改 → 更新 `条件:` 行；手动编辑文本 → 面板自动刷新                   |
| M3-08  | 触发入口                          | 选项行右侧 `[🔧条件]` 图标点击触发，无条件的选项显示虚线图标              |
| **错误检测系统** |                         |                                                                           |
| M3-09  | 验证器引擎 — 8 种错误（E001-E008）| `packages/core/src/validator/validator.ts`，实现 PRD §9.1 全部错误检测     |
| M3-10  | 验证器引擎 — 6 种警告（W001-W006）| 孤立节点/死胡同/未使用变量/重复选项/空描述/格式不规范                     |
| M3-11  | 验证器引擎 — 3 种建议（I001-I003）| 可能卡关/描述过短/无章节归属                                              |
| M3-12  | 验证器单元测试                     | `tests/unit/validator/`，覆盖 17 种诊断类型，每种至少 1 个用例             |
| **错误呈现** |                              |                                                                           |
| M3-13  | Monaco 波浪线装饰（Decorations）   | 红色波浪线（Error）/ 黄色波浪线（Warning）/ 蓝色下划线（Info）            |
| M3-14  | 侧边栏标记点（Gutter Glyphs）      | 红色方块 / 黄色三角 / 蓝色圆点                                           |
| M3-15  | Hover Tooltip（错误说明+修复建议） | 鼠标悬停显示诊断编号 + 描述 + 可操作建议（如 `[点击创建节点 XXX]`）       |
| M3-16  | ProblemPanel 问题面板              | `Ctrl+Shift+M` 打开，完整列表：类型图标 + 信息 + 位置 + 可点击跳转        |
| M3-17  | 状态栏错误计数                     | `🔴3 🟡2 🔵1` 实时显示                                                   |
| **分支图联动** |                              |                                                                           |
| M3-18  | 错误状态 → 分支图节点着色同步      | 包含 Error 的节点 → 红色边框；包含 Warning → 黄色边框；Info → 蓝色边框    |

### L4 复审清单

**条件编辑器**：

- [ ] 点击选项行 `[🔧条件]` → 弹出条件编辑器面板
- [ ] 变量下拉框列出 Frontmatter 全部声明变量（含 object 字段路径如 `角色状态.魔力`）
- [ ] 运算符下拉框根据变量类型过滤：int 可见 `< > <= >=`，bool 仅 `== !=`
- [ ] 值输入框根据类型适配：bool → true/false 下拉；enum → 合法值下拉
- [ ] 构建 `AND` 条件组 → 预览行正确显示带括号的文本表达式
- [ ] 构建 `OR` 条件组 → 预览行正确显示 `(A) OR (B)`
- [ ] 嵌套 3 层（AND 组内嵌套 OR 组）→ 不崩溃，预览正确
- [ ] 面板 → 文本：修改条件 → 编辑器 `条件:` 行自动更新
- [ ] 文本 → 面板：手动编辑 `条件:` 行 → 面板自动刷新组件
- [ ] 应用/取消按钮：应用保存修改，取消恢复原状

**错误检测**：

- [ ] E001-未定义目标节点：选项指向不存在的节点 → 红色波浪线标记 `-> 节点：XXX`
- [ ] E002-未声明变量：`$未声明` → 红色波浪线标记 `$未声明`
- [ ] E003-枚举值非法：赋值不在合法值列表 → 红色波浪线标记效果括号内
- [ ] E004-类型不匹配：`金币='非数字'` → 红色波浪线标记
- [ ] E005-语法解析失败：缺少 `->` 的选项行 → 红色波浪线标记整行
- [ ] E006-嵌套深度超限：object 嵌套 4 层 → 红色波浪线标记 Frontmatter
- [ ] E007-节点ID重名：两个 `## 节点：森林入口` → 红色波浪线标记重复行
- [ ] E008-变量重复声明：Frontmatter 同名变量 → 红色波浪线标记
- [ ] W001-孤立节点 → 黄色波浪线 + 黄色三角标记
- [ ] W002-死胡同节点 → 黄色波浪线 + 黄色三角标记
- [ ] W003-未使用变量 → 黄色波浪线 Frontmatter 中
- [ ] W004-重复选项描述 → 黄色波浪线选项行
- [ ] W005-空描述节点 → 黄色波浪线节点标题
- [ ] W006-格式不规范 → 黄色波浪线标题行
- [ ] I001-可能卡关（全部选项有条件）→ 蓝色下划线节点标题
- [ ] I002-描述过短（<10字符）→ 蓝色下划线节点标题
- [ ] I003-无章节归属 → 蓝色下划线文件开头

**呈现**：

- [ ] 红色波浪线（Error）视觉明显，与黄色/蓝色可区分
- [ ] 悬停 tooltip 显示：诊断编号 + 错误描述 + 修复建议（如 `可用节点：森林入口、狼穴、古井。[点击创建节点 XXX]`）
- [ ] Ctrl+Shift+M 打开问题面板 → 完整列表，点击跳转到错误位置
- [ ] 状态栏 `🔴3 🟡2 🔵1` 实时更新
- [ ] 分支图节点着色与错误状态联动（红色边框 = 含 Error）

### 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 条件编辑器 ↔ 文本同步竞争 | 数据不一致 | 防抖 + 来源标记（`source: 'panel' | 'editor'`），避免循环更新 |
| Monaco decorations 过多导致性能下降 | 编辑器卡顿 | 仅可视区域 decoration，超 100 个诊断时自动折叠 |
| 复杂条件嵌套(3层AND/OR)UI 交互复杂 | 误操作 | 每个条件组醒目边框+颜色编码（AND=蓝色组，OR=橙色组） |
| 验证器规则遗漏 | 漏报错误 | 以 PRD §9.1 表格为检查清单逐条对照，17 种类型全覆盖测试 |

---

## M4 导出系统

**目标**：JSON/HTML/TXT 三种格式导出内容正确，Godot 插件编辑器+运行时可用，Unity/Unreal 接口定义完备。

### 交付物

| #      | 任务                               | 产出                                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------------------- |
| **JSON 导出** |                              |                                                                           |
| M4-01  | JSON 导出器                        | `packages/core/src/exporter/json.ts`，输出符合 PRD §8.2 完整 Schema        |
| M4-02  | JSON Schema 验证                   | 导出后通过 JSON Schema 校验，`tests/unit/exporter/json.test.ts`            |
| M4-03  | 往返一致性测试                     | `.mdstory → JSON → AST` 与原始 AST 一致                                   |
| M4-04  | 特殊字符/边界测试                  | Unicode/emoji/空 body/无 options 节点/0 变量文件                           |
| **HTML 导出** |                              |                                                                           |
| M4-05  | HTML 导出器（单文件自包含）        | `packages/core/src/exporter/html.ts`，内嵌 CSS + JS，浏览器直接打开        |
| M4-06  | HTML 交互逻辑                      | 节点描述渲染 → 可用选项按钮 → 点击跳转；条件选项灰显+🔒                   |
| M4-07  | HTML 变量面板                      | 底部可折叠面板，实时显示当前变量值                                        |
| M4-08  | HTML 面包屑导航                    | 顶部显示节点历史路径，可回溯                                              |
| M4-09  | HTML 响应式布局                    | CSS Grid，桌面+移动端适配                                                 |
| **TXT 导出** |                              |                                                                           |
| M4-10  | TXT 导出器                         | `packages/core/src/exporter/txt.ts`，移除所有标记，仅保留正文+选项文本     |
| **导出 UI** |                              |                                                                           |
| M4-11  | ExportDialog 组件                  | 格式选择（JSON/HTML/TXT）+ 文件路径选择                                   |
| M4-12  | 导出快捷键 + 菜单入口              | `Ctrl+E` 打开导出对话框；菜单栏 → 导出 → 选择格式                        |
| **Godot 插件** |                              |                                                                           |
| M4-13  | Godot 编辑器插件入口               | `addons/plotflow/plugin.gd`，注册插件 + Dock 面板                         |
| M4-14  | Godot Dock 面板                    | `addons/plotflow/PlotFlowDock.gd`，管理 .mdstory + 变量同步 + 一键导出    |
| M4-15  | Godot 变量同步器                   | `addons/plotflow/VariableSync.gd`，读取 Godot 变量 → 写入 Frontmatter     |
| M4-16  | Godot 导出触发器                   | `addons/plotflow/ExportTrigger.gd`，调用 PlotFlow CLI 导出 JSON            |
| M4-17  | Godot 运行时库 — StoryLoader       | `addons/plotflow/runtime/StoryLoader.gd`，加载 JSON 构建节点树            |
| M4-18  | Godot 运行时库 — StoryNode         | `addons/plotflow/runtime/StoryNode.gd`，获取描述/选项列表                 |
| M4-19  | Godot 运行时库 — ConditionEval     | `addons/plotflow/runtime/ConditionEval.gd`，根据变量评估条件              |
| M4-20  | Godot 运行时库 — VariableStore     | `addons/plotflow/runtime/VariableStore.gd`，存储和管理故事变量            |
| M4-21  | Godot 插件单元测试                 | 解析示例 JSON → 加载节点 → 评估条件 → 执行副作用 全部 PASS               |
| **Unity 接口** |                              |                                                                           |
| M4-22  | Unity C# 接口定义                  | `plugins/unity/IPlotFlowReader.cs`，标准化读取接口                        |
| M4-23  | Unity 示例实现                     | `plugins/unity/PlotFlowJsonReader.cs`，基于 JSON 的参考实现               |
| M4-24  | Unity 示例场景                     | 展示如何使用接口驱动对话 UI 的 Unity 场景文件                             |
| **Unreal 接口** |                              |                                                                           |
| M4-25  | Unreal 蓝图接口                    | `plugins/unreal/BPI_PlotFlowReader.uasset` 接口定义                       |
| M4-26  | Unreal C++ 数据模型               | `plugins/unreal/PlotFlowDataTypes.h`，FPlotFlowNode/FPlotFlowOption 结构体 |

### L4 复审清单

**JSON 导出**：

- [ ] 完整示例 `.mdstory` → 导出 JSON → 通过 JSON Schema 验证
- [ ] JSON 中 `meta` 字段完整（plotflow/title/author/engine/exportedAt）
- [ ] JSON 中 `variables` 区块：所有类型（int/float/bool/string/enum/object）正确导出
- [ ] JSON 中 `chapters[].nodes[]`：id/fullId/title/body/options 完整
- [ ] JSON 中 `options[].conditions`：含原始表达式 + AST 树
- [ ] JSON 中 `options[].sideEffects`：操作类型（set/add/subtract/append）正确
- [ ] `isRoot`/`isOrphan`/`isDeadEnd` 诊断字段正确
- [ ] 往返测试：`.mdstory → JSON → 重新解析 → AST` 语义一致
- [ ] Unicode/emoji/中英混排 → JSON 正确编码（UTF-8）

**HTML 导出**：

- [ ] 导出 HTML → 浏览器打开 → 显示第一个节点描述正文
- [ ] HTML 渲染选项按钮 → 点击跳转到目标节点
- [ ] 有条件选项：不满足条件时灰显 + 🔒 图标 + 条件说明 tooltip
- [ ] 变量面板：底部可折叠，实时显示当前所有变量值
- [ ] 面包屑导航：顶部显示已访问节点路径，可点击回溯
- [ ] 响应式：桌面（宽屏）+ 移动端（窄屏）均可正常交互
- [ ] 文件大小：不含用户文本部分 ≤ 50KB

**TXT 导出**：

- [ ] 导出的 TXT 文件用记事本打开 → 无 Markdown 语法残留
- [ ] `[选项]`、`条件:`、`效果:` 行已移除，仅保留正文和选项描述
- [ ] 节点之间双换行分隔

**Godot 插件**：

- [ ] Godot 项目中启用 PlotFlow 插件 → Dock 面板出现
- [ ] Dock 面板列出 `story/` 目录下所有 `.mdstory` 文件
- [ ] 变量同步：Godot 变量 → 自动写入 Frontmatter
- [ ] 一键导出：触发导出 → JSON 文件出现在 `story/exports/`
- [ ] 运行时库：`StoryLoader.load()` 返回可用的节点树
- [ ] 运行时库：`node.get_available_options(vars)` 正确过滤条件
- [ ] 运行时库：`option.apply_effects(vars)` 正确修改变量

### 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| JSON Schema 与 PRD 不一致 | 导出格式错误 | Schema 定义文件单独测试，以 PRD §8.2 示例为黄金数据 |
| HTML 导出 JavaScript 注入 | XSS 风险 | 用户文本全部 HTML 转义，条件表达式单独转义 |
| Godot 插件依赖 Godot 4.x API | 版本不兼容 | 锁定 Godot 4.2+，`plugin.cfg` 声明最小版本 |
| Godot 运行时条件评估性能 | 大型脚本卡顿 | 表达式预编译为栈机指令，O(n) 评估 |

---

## M5 补全引擎

**目标**：纯客户端 N-gram 引擎实现四维幽灵字符补全，Tab 接受/Esc 忽略，语料离线学习与导入。

### 交付物

| #      | 任务                               | 产出                                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------------------- |
| **N-gram 引擎** |                          |                                                                           |
| M5-01  | NGramEngine 核心                    | `packages/core/src/completion/NGramEngine.ts`，1-5 gram 统计模型           |
| M5-02  | 预置语料库加载器                   | `packages/core/src/completion/CorpusLoader.ts`，加载 5MB 压缩语料          |
| M5-03  | 倒排索引                           | `packages/core/src/completion/InvertedIndex.ts`，按前缀快速检索             |
| M5-04  | 引擎单元测试                       | `tests/unit/completion/NGramEngine.test.ts`，≥24 用例                      |
| **预制语料** |                              |                                                                           |
| M5-05  | 中文语料包（3.5MB）                | `packages/core/corpus/zh.dat`，RPG对话(40%)+视觉小说(30%)+解谜(15%)+通用(15%) |
| M5-06  | 英文语料包（1.5MB）                | `packages/core/corpus/en.dat`，开源游戏脚本 + 经典文学对话                 |
| M5-07  | 语料预处理脚本                     | `scripts/preprocess-corpus.ts`，分词 + 去特殊符号 + 句式分类              |
| **幽灵字符渲染** |                          |                                                                           |
| M5-08  | GhostTextPlugin（Monaco 扩展）     | `packages/app/src/renderer/editor/GhostTextPlugin.ts`                     |
| M5-09  | 四维触发检测                       | 节点标题（`## 节点：`后）、选项句式（`[选项]`后）、正文描述（任意输入）、变量名（`$`后） |
| M5-10  | 幽灵字符渲染逻辑                   | 灰色半透明文本出现在光标后方，使用 Monaco ContentWidget                   |
| M5-11  | Tab 接受 / Esc 忽略 / 输入覆盖     | Tab 插入建议文本；Esc 移除建议；继续输入不一致时建议自动消失              |
| M5-12  | Ctrl+Space 多候选下拉菜单          | 打开建议列表，方向键选择，Enter 确认                                      |
| M5-13  | 频率控制（<100ms 不触发）          | 快速输入时抑制补全，避免闪烁                                              |
| **本地学习** |                              |                                                                           |
| M5-14  | 增量学习器                         | `packages/core/src/completion/Learner.ts`，保存时后台线程训练             |
| M5-15  | N-gram 权重衰减（90 天机制）       | 90 天未使用模式权重 ×0.5，180 天移除（PRD §7.4）                         |
| M5-16  | 学习数据持久化                     | `%APPDATA%/PlotFlow/learner/`，SQLite（better-sqlite3）存储              |
| **语料导入** |                              |                                                                           |
| M5-17  | 语言料导入器                       | 支持 `.txt`/`.mdstory`/`.csv`，单文件 ≤10MB，总计 ≤50MB                   |
| M5-18  | 导入预处理                         | 自动去重（编辑距离<3 视为重复）、分段、清洗（去除 URL/代码）              |
| M5-19  | CorpusManager 设置面板             | 语料列表：文件名/大小/导入时间，支持禁用/删除/重新处理                    |

### L4 复审清单

**补全准确性**：

- [ ] 输入 `## 节点：森林` → 幽灵字符推荐 `森林入口/森林深处/森林边缘`
- [ ] 输入 `[选项] 走向左` → 幽灵字符推荐常见句式续写
- [ ] 正文输入 `你站在` → 幽灵字符推荐环境描写续写（如 `幽暗森林的边缘，`）
- [ ] 输入 `$好` → 幽灵字符推荐匹配的已声明变量（如 `$好感度`）
- [ ] 输入 `$角色状态.` → 幽灵字符推荐 object 子字段

**交互体验**：

- [ ] 幽灵字符以灰色半透明显示在光标后方，视觉效果不刺眼
- [ ] 按 Tab → 接受补全，幽灵字符转为正常文字
- [ ] 按 Esc → 补全立即消失
- [ ] 继续输入不一致的文字 → 幽灵字符自动消失
- [ ] Ctrl+Space → 下拉菜单显示所有候选（节点标题 5 个/选项句式 3 个/正文 1 个）
- [ ] 方向键 + Enter → 在下拉菜单中确认选择
- [ ] 快速输入（<100ms 间隔）→ 补全不触发，不闪烁

**学习与语料**：

- [ ] 编辑并保存 `.mdstory` → 后台线程增量学习（不阻塞 UI）
- [ ] 反复使用特定句式 → 后续补全该句式权重提升
- [ ] 导入 `.txt` 语料文件 → 预处理完成 → 语料列表显示
- [ ] 导入 `.csv`（两列：类别,文本）→ 正确分类索引
- [ ] 禁用某个语料 → 该语料不再参与补全
- [ ] 删除语料 → 从索引中移除，不可恢复确认对话框
- [ ] 10MB 以上文件 → 拒绝导入并提示

**隐私与离线**：

- [ ] 断网测试 → 补全完全正常工作
- [ ] `%APPDATA%/PlotFlow/learner/` 目录存在，数据仅本地
- [ ] 无任何网络请求（检查 Network 面板）

### 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 预置语料版权不清 | 合规风险 | 仅用 CC0/MIT/公共领域语料，预处理脚本保留来源注释 |
| N-gram 模型质量差（冷启动） | 补全无意义 | 预置语料精细标注（RPG/VN/解谜/通用分类），按场景加权 |
| SQLite 写入阻塞 Electron 主进程 | UI 卡顿 | better-sqlite3 同步 API 在后台 Worker 线程中运行 |
| 中文分词不准确 | 补全碎片化 | 使用 `Intl.Segmenter`（Node 20+ 内置）做基础分词 |
| 学习模型膨胀超 50MB | 磁盘占用 | FIFO 淘汰 + 90 天衰减双重机制 |

---

## M6 模板与主题

**目标**：4 个内置模板可创建新文件，暗色/亮色主题即时切换，中英双语完整覆盖。

### 交付物

| #      | 任务                               | 产出                                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------------------- |
| **模板系统** |                              |                                                                           |
| M6-01  | 模板引擎                           | `packages/core/src/template/TemplateEngine.ts`，`{{var}}` 占位符替换      |
| M6-02  | RPG 对话模板（8 节点）             | `templates/rpg-dialogue.mdstory`，村庄场景 + 变量/条件/副作用             |
| M6-03  | 视觉小说模板（6 节点）             | `templates/visual-novel.mdstory`，校园恋爱 + 基础语法                     |
| M6-04  | 解谜游戏模板（10 节点）            | `templates/puzzle-escape.mdstory`，密室逃脱 + 复杂条件链                  |
| M6-05  | Godot 示例项目模板（10 节点）      | `templates/godot-example/`，含 .mdstory + 运行时库 + Godot 场景           |
| M6-06  | NewFileDialog 组件                 | 新建文件时弹出：选择模板 → 预览 → 填写标题/作者 → 创建                    |
| **暗色主题** |                              |                                                                           |
| M6-07  | 暗色主题 CSS 变量                  | 背景 `#1E1E1E`，文字 `#D4D4D4`，7 色语法标记，分支图背景 `#252526`       |
| M6-08  | 暗色主题 Monaco 主题               | `monaco-theme-dark.json`，与 PRD §5.5 色值完全对应                        |
| M6-09  | 暗色主题分支图节点样式             | 卡片 `#2D2D2D` + 边框 `#404040`，节点状态色不改                           |
| **亮色主题** |                              |                                                                           |
| M6-10  | 亮色主题 CSS 变量                  | 背景 `#FFFFFF`，文字 `#333333`，分支图背景 `#F5F5F5`                     |
| M6-11  | 亮色主题 Monaco 主题               | `monaco-theme-light.json`，与 PRD §5.5 色值完全对应                       |
| M6-12  | 亮色主题分支图节点样式             | 卡片 `#FFFFFF` + 边框 `#DDDDDD`                                          |
| **主题切换** |                              |                                                                           |
| M6-13  | ThemeProvider 机制                  | `data-theme` 属性 + CSS 变量即时切换，无闪烁                              |
| M6-14  | ThemeToggle 工具栏按钮             | 工具栏切换按钮 + `Ctrl+Shift+T` 快捷键                                    |
| **国际化** |                              |                                                                           |
| M6-15  | i18n 框架                          | `packages/core/src/i18n/i18n.ts`，react-i18next 集成                      |
| M6-16  | 中文翻译文件                       | `locales/zh-CN.json`，覆盖全部 UI 文本（菜单/按钮/提示/错误信息）         |
| M6-17  | 英文翻译文件                       | `locales/en-US.json`，完整英文 UI 文本                                    |
| M6-18  | 语言切换器                         | 设置菜单选择语言 → 即时生效，不刷新窗口                                   |

### L4 复审清单

**模板**：

- [ ] 新建文件 → 选择「RPG 对话模板」→ 生成 8 节点 `.mdstory`，含变量声明 + 条件/副作用
- [ ] 选择「视觉小说模板」→ 生成 6 节点，基础语法正确
- [ ] 选择「解谜游戏模板」→ 生成 10 节点，复杂条件链完整
- [ ] 选择「Godot 示例项目」→ 生成含 .mdstory + 插件资源文件的完整目录
- [ ] 模板 `title` 和 `author` 根据新建对话框输入自动填充

**暗色主题**：

- [ ] 工具栏切换至暗色 → 编辑器背景 `#1E1E1E`，文字 `#D4D4D4`
- [ ] 语法高亮：`# 节点：` 蓝色 `#569CD6`，`[选项]` 绿色 `#6A9955`
- [ ] 条件子行 `条件:` 橙色 `#CE9178`，效果子行 `效果:` 黄色 `#DCDCAA`
- [ ] 变量 `$变量` 紫色 `#C586C0`，跳转目标 `->` 青色 `#4EC9B0`
- [ ] 分支图背景 `#252526`，节点卡片 `#2D2D2D` + 边框 `#404040`
- [ ] 条件连线橙色虚线，无条件连线青色实线

**亮色主题**：

- [ ] 切换至亮色 → 编辑器背景 `#FFFFFF`，文字 `#333333`
- [ ] 语法高亮色值全部正确（PRD §5.5 亮色列）
- [ ] 分支图背景 `#F5F5F5`，节点卡片 `#FFFFFF` + 边框 `#DDDDDD`

**主题切换**：

- [ ] `Ctrl+Shift+T` 或工具栏按钮 → 即时切换暗/亮色
- [ ] 切换无闪烁，所有组件（编辑器/分支图/大纲/面板/状态栏）跟随
- [ ] 关闭重开 → 记住上次主题选择

**国际化**：

- [ ] 设置菜单切换为「English」→ 全部 UI 文本即时切换为英文
- [ ] 菜单栏：File / Edit / View / Export / Help 英文显示
- [ ] 工具栏和按钮：英文 tooltip
- [ ] 错误提示：诊断信息英文显示
- [ ] 对话框（新建/导出/设置/语料管理）：英文显示
- [ ] 状态栏：英文显示
- [ ] 切换回「简体中文」→ 全部恢复中文

### 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 模板内容语法错误 | 新用户第一印象差 | 每个模板走一遍解析器+验证器，确保零诊断 |
| Monaco 主题切换导致编辑器闪烁 | 体验差 | `monaco.editor.setTheme()` 批量更新，避免逐 token 重绘 |
| i18n 翻译字符串遗漏 | 混中英文界面 | 用 `i18next-parser` 自动扫描所有 `t()` 调用，生成完整 key 列表 |
| 模板文件随应用打包路径问题 | 新建模板失败 | 模板编译为 TS 字符串常量内联，不依赖外部文件路径 |

---

## M7 Electron 打包与发布

**目标**：三平台安装包生成，安装器体验正常，`.mdstory` 文件关联生效，自动更新通道就绪。

### 交付物

| #      | 任务                               | 产出                                                                      |
| ------ | ---------------------------------- | ------------------------------------------------------------------------- |
| **打包配置** |                              |                                                                           |
| M7-01  | electron-builder 配置              | `electron-builder.config.js`，Windows/macOS/Linux 三平台                   |
| M7-02  | Windows 构建（.exe + .msi）        | NSIS 安装器，含自定义安装路径 + 桌面快捷方式                              |
| M7-03  | macOS 构建（.dmg）                 | DMG 安装镜像，含 Applications 快捷方式                                    |
| M7-04  | Linux 构建（.AppImage + .deb）     | AppImage 免安装版本 + deb 包                                              |
| **应用配置** |                              |                                                                           |
| M7-05  | 应用图标                           | `build/icon.ico`（Win）/ `.icns`（Mac）/ `.png`（Linux），多分辨率        |
| M7-06  | 应用信息                           | 应用名：PlotFlow，版本号：`0.1.0`，`package.json` 与 `tauri.conf.json` 同步 |
| M7-07  | `.mdstory` 文件关联                | Windows 注册表关联 + macOS Info.plist + Linux mimetype                     |
| M7-08  | 双击 `.mdstory` → 应用打开         | 系统文件关联注册，命令行参数传递文件路径                                  |
| **自动更新** |                              |                                                                           |
| M7-09  | electron-updater 集成              | `packages/app/src/main/updater.ts`，检查更新 + 下载 + 安装                |
| M7-10  | 更新服务器配置                     | GitHub Releases 作为更新源，`latest.yml` 自动生成                         |
| **发布准备** |                              |                                                                           |
| M7-11  | CHANGELOG.md                       | V0.1.0 变更日志（按里程碑组织）                                           |
| M7-12  | GitHub Release 草稿                | Release Notes + 三平台安装包下载链接                                      |
| M7-13  | 安装后首次启动引导                 | 欢迎页：选择语言 → 选择主题 → 新建/打开文件                               |
| **冒烟测试** |                              |                                                                           |
| M7-14  | Windows 安装包冒烟测试             | 安装 → 启动 → 新建项目 → 编辑 → 导出 → 关闭 → 重新打开                   |
| M7-15  | macOS/Linux 基础冒烟测试           | 安装 → 启动（主要验证构建产物可运行）                                     |

### L4 复审清单

**Windows 安装**（主验证平台）：

- [ ] 下载 `.exe` 或 `.msi` → 安装无报错
- [ ] 安装路径可选，默认 `%LOCALAPPDATA%/Programs/PlotFlow/`
- [ ] 桌面快捷方式创建 → 双击可启动
- [ ] 开始菜单条目 → PlotFlow 可搜索到
- [ ] 应用图标显示正常（非默认 Electron 图标）

**文件关联**：

- [ ] 双击 `.mdstory` 文件 → PlotFlow 启动并加载该文件
- [ ] 右键 `.mdstory` → 「打开方式」中 PlotFlow 存在
- [ ] 已打开 PlotFlow 时双击 `.mdstory` → 新窗口或新标签页加载

**基本功能验证**（安装包环境）：

- [ ] 新建文件 → 选择模板 → 写入内容 → Ctrl+S 保存 → 用记事本打开验证内容
- [ ] 打开 PRD §4.6 完整示例 → 分支图渲染正确 → 导出 JSON/HTML/TXT
- [ ] 导出 JSON → 检查 `meta.plotflow: "0.1"` 正确
- [ ] 导出 HTML → 浏览器打开 → 可点击交互
- [ ] 暗色/亮色切换 → 即时生效
- [ ] 中/英文切换 → 即时生效
- [ ] 幽灵补全 → Tab 接受/Esc 忽略

**自动更新**：

- [ ] 模拟新版本 GitHub Release → 应用检测到更新
- [ ] 下载更新包 → 应用重启后版本号更新
- [ ] 更新失败 → 保留当前版本 + 错误日志

**跨平台**（基础验证）：

- [ ] macOS `.dmg` → 拖入 Applications → 启动正常
- [ ] Linux `.AppImage` → 直接运行；`.deb` → `dpkg -i` 安装正常

### 风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Windows 代码签名证书缺失 | SmartScreen 警告 | V0.1 接受黄色警告，V0.2 申请 EV 证书 |
| macOS 公证（Notarization）失败 | macOS 无法打开 | V0.1 macOS 构建无公证版本，文档中说明手动信任步骤 |
| electron-builder 跨平台构建环境差异 | 构建失败 | GitHub Actions 三平台 CI 矩阵构建，本地仅验证 Windows |
| 自动更新 GitHub API 限流 | 更新检测失败 | 缓存更新检测 6 小时，本地 fallback 跳过更新 |
| `.mdstory` 文件关联被其他应用抢占 | 关联失效 | 安装程序中提供「重新关联」按钮 |

---

## 依赖关系

```
M0 ──→ M1 ──→ M2 ──→ M3 ──→ M4 ──→ M7
  │             │       │       │
  │             │       │       └── 导出系统（依赖解析器+语法检查器）
  │             │       │            Godot 插件依赖 JSON 导出器
  │             │       │
  │             │       └── 条件编辑器（依赖解析器 AST）
  │             │            错误检测（依赖解析器 + 验证器）
  │             │            与 M2 分支图联动（错误状态着色）
  │             │
  │             └── 分支图（依赖 M1 解析器 AST → React Flow 适配）
  │
  ├──→ M5（补全引擎相对独立，M1 编辑器完成后可启动）
  │
  └──→ M6（模板依赖 M1 解析器验证；主题/i18n 独立于业务逻辑）
```

**严格依赖**：
- M1 → M2：分支图依赖解析器产出的 `PlotFlowData` AST
- M1 → M3：错误检测依赖解析器 + 验证器；条件编辑器依赖 AST 中的选项/变量信息
- M2 → M3（部分）：M3 的分支图错误着色联动依赖 M2 的 React Flow 集成
- M3 → M4：JSON 导出包含诊断信息（`isOrphan`/`isDeadEnd`），依赖验证器
- M1, M2, M3, M4 → M7：打包前核心功能必须全就绪

**独立可并行**：
- M5（补全引擎）：M1 编辑器完成后即可开发，不依赖 M2/M3/M4
- M6（模板与主题）：M1 解析器完成后可验证模板语法；主题/i18n 随时可做
- M4 中 Godot 插件：依赖 JSON 导出器（M4 前半），但可在 M4 主体完成后单独迭代

---

## 工作流执行策略（模型分配 + 串并行规划）

> 按 `CLAUDE.md §十` 工作流与模型分配策略执行。

---

### M0 项目脚手架 — 85% Fast

**执行模式**：Phase 0 串行建目录 → Phase 1 并行写文件 → Phase 2/3 V4Pro 设计+验证

| 阶段 | 任务 | 模型 | 模式 | 说明 |
|:---:|------|:---:|:---:|------|
| P0 | M0-10 目录结构全量建立 | ⚡ haiku | → 串行 | 先建全部目录，避免后续并行写文件时的目录竞态 |
| P1 | M0-01 pnpm workspace | ⚡ haiku | ∥ 并行 | |
| P1 | M0-04 TS strict mode | ⚡ haiku | ∥ 并行 | |
| P1 | M0-05 ESLint + Prettier | ⚡ haiku | ∥ 并行 | |
| P1 | M0-06 Vitest 框架 | ⚡ haiku | ∥ 并行 | |
| P1 | M0-07 Playwright 框架 | ⚡ haiku | ∥ 并行 | |
| P1 | M0-08 GitHub Actions CI | ⚡ haiku | ∥ 并行 | |
| P1 | M0-09 Git Hooks | ⚡ haiku | ∥ 并行 | |
| P1 | M0-13 @plotflow/core 包骨架 | ⚡ haiku | ∥ 并行 | |
| P1 | M0-02 Electron 主进程骨架 | 🔶 sonnet | ∥ 并行 | 需要轻量推理（electron-vite 配置） |
| P1 | M0-03 React 渲染进程骨架 | 🔶 sonnet | ∥ 并行 | 需要轻量推理（Vite + React 配置） |
| P2 | M0-12 Monaco Editor 占位 | 🔶 sonnet | → 串行 | 依赖 P1 的 React 骨架 |
| P3 | M0-11 Zustand store 初始化 | 🧠 V4Pro | → 串行 | 需要对照 TAD 数据流图设计接口 |
| P4 | 集成验证（L4 复审清单） | 🧠 V4Pro | → 串行 | `pnpm install` → `dev` → `lint` → `test` → 全绿 |

---

### M1 核心解析与编辑 — 53% Fast

**执行模式**：解析器核心 V4Pro 串行 → 编辑器/V4Flash 任务可部分并行

| 阶段 | 任务 | 模型 | 模式 | 说明 |
|:---:|------|:---:|:---:|------|
| **解析器**（串行，依赖链：frontmatter → parser → options → conditions → effects → AST） |
| P0 | M1-01 YAML Frontmatter 解析器 | 🧠 V4Pro | → 串行 | syntax-formal §2，类型校验 |
| P0 | M1-02 Markdown 节点解析器 | 🧠 V4Pro | → 串行 | unified + remark 自定义插件 |
| P0 | M1-03 选项语法解析 | 🧠 V4Pro | → 串行 | 条件/效果子行嵌套，歧义消解 |
| P0 | M1-04 条件表达式解析器 | 🧠 V4Pro | → 串行 | 递归下降，运算符优先级 |
| P0 | M1-05 变量操作解析器 | 🧠 V4Pro | → 串行 | 类型感知副作用解析 |
| P0 | M1-06 PlotFlowData 中间表示 | 🧠 V4Pro | → 串行 | 全项目类型合同定义点 |
| **编辑器**（可部分并行） |
| P1 | M1-08 Monaco Tokenizer | 🧠 V4Pro | → 串行 | Monarch 状态机，需深度理解语法 |
| P1 | M1-09 Monaco Theme | ⚡ haiku | ∥ 并行 | 按 standards-css.md Token 表直译 |
| P1 | M1-10 括号自动闭合 | ⚡ haiku | ∥ 并行 | Monaco API 配置，5 行代码 |
| P1 | M1-11 节点折叠 | 🔶 sonnet | ∥ 并行 | Monaco foldingRangeProvider |
| P1 | M1-12 响应式保存 | 🔶 sonnet | ∥ 并行 | debounce + IPC，标准模式 |
| P1 | M1-13 文件操作服务 | 🔶 sonnet | ∥ 并行 | CRUD 封装，Electron dialog |
| **大纲/状态栏/菜单** |
| P2 | M1-14 OutlinePanel 组件 | 🔶 sonnet | → 串行 | 树形组件，标准 React |
| P2 | M1-15 大纲与编辑器联动 | 🧠 V4Pro | → 串行 | 双向联动，Monaco + Zustand |
| P2 | M1-16 StatusBar 组件 | ⚡ haiku | ∥ 并行 | 纯展示组件 |
| P2 | M1-17 应用菜单栏 | ⚡ haiku | ∥ 并行 | Electron Menu API 模板 |
| **测试** |
| P3 | M1-07 解析器单元测试 (92例) | ⚡ haiku | ∥ 并行 | 测试用例编写，机械但量大 |

---

### M2 分支可视化 — 50% Fast

**执行模式**：基础集成 V4Flash 并行 → 核心交互 V4Pro 串行

| 阶段 | 任务 | 模型 | 模式 | 说明 |
|:---:|------|:---:|:---:|------|
| P0 | M2-01 React Flow 画布集成 | 🔶 sonnet | → 串行 | 标准组件挂载 |
| P0 | M2-02 Dagre 布局引擎 | 🧠 V4Pro | → 串行 | 自上而下树状布局算法 |
| P0 | M2-03 AST → React Flow 适配器 | 🧠 V4Pro | → 串行 | 双向同步核心，依赖 P0 |
| P1 | M2-04 StoryNodeCard 组件 | 🔶 sonnet | ∥ 并行 | 按 TAD 规格实现 |
| P1 | M2-05 节点状态着色 (5种) | ⚡ haiku | ∥ 并行 | CSS className 注入 |
| P1 | M2-06 StoryEdge 组件 | 🔶 sonnet | ∥ 并行 | 条件/无条件连线样式 |
| P1 | M2-12 缩放 10%~200% | ⚡ haiku | ∥ 并行 | React Flow 内置 |
| P1 | M2-13 中键拖拽平移 | ⚡ haiku | ∥ 并行 | React Flow 内置 |
| P1 | M2-10 右键菜单 | 🔶 sonnet | ∥ 并行 | 标准 ContextMenu |
| P1 | M2-11 Ctrl+点击多选 | ⚡ haiku | ∥ 并行 | React Flow 内置 |
| P2 | M2-07 单击节点→编辑器跳转 | 🧠 V4Pro | → 串行 | Monaco revealLine + store 协调 |
| P2 | M2-08 双击节点→重命名 | 🧠 V4Pro | → 串行 | 内联编辑 + AST 更新 + 文本同步 |
| P2 | M2-09 拖拽连线端点→修改跳转 | 🧠 V4Pro | → 串行 | 操作锁，最复杂交互 |
| P2 | M2-14 200 节点虚拟滚动 | 🧠 V4Pro | → 串行 | 性能优化 |
| P2 | M2-15 同层节点水平折叠 | 🧠 V4Pro | → 串行 | 自定义布局算法 |
| P2 | M2-16 编辑器→分支图实时更新 | 🧠 V4Pro | → 串行 | 增量更新 + debounce + diff |

---

### M3 条件编辑与错误检测 — 67% Fast

**执行模式**：验证器引擎（V4Flash 最适合）与条件编辑器（V4Pro）可并行

| 阶段 | 任务 | 模型 | 模式 | 说明 |
|:---:|------|:---:|:---:|------|
| **条件编辑器**（V4Pro 串行） |
| P0 | M3-01 ConditionEditor 面板 | 🧠 V4Pro | → 串行 | Airtable 风格 UI |
| P0 | M3-05 AND/OR 逻辑组构建器 | 🧠 V4Pro | → 串行 | 嵌套条件组 UI |
| P0 | M3-07 双向同步 (面板↔文本) | 🧠 V4Pro | → 串行 | 防抖 + 来源标记 |
| **条件编辑器**（V4Flash 并行） |
| P1 | M3-02 变量下拉框 | 🔶 sonnet | ∥ 并行 | 标准表单组件 |
| P1 | M3-03 比较运算符下拉框 | 🔶 sonnet | ∥ 并行 | 标准表单组件 |
| P1 | M3-04 值输入框（类型感知） | 🔶 sonnet | ∥ 并行 | 标准表单组件 |
| P1 | M3-06 条件预览行 | ⚡ haiku | ∥ 并行 | 纯展示组件 |
| P1 | M3-08 触发入口按钮 | ⚡ haiku | ∥ 并行 | 图标按钮 |
| **验证器引擎**（V4Flash 最适合——纯函数，规格完备） |
| P2 | M3-09 验证器 — 8 种错误 (E001-E008) | 🔶 sonnet | ∥ 并行 | 每种错误独立纯函数 |
| P2 | M3-10 验证器 — 6 种警告 (W001-W006) | 🔶 sonnet | ∥ 并行 | 每种警告独立纯函数 |
| P2 | M3-11 验证器 — 3 种建议 (I001-I003) | ⚡ haiku | ∥ 并行 | 每种建议独立纯函数 |
| P2 | M3-12 验证器单元测试 | ⚡ haiku | ∥ 并行 | 17 种 × ≥1 用例 |
| **错误呈现** |
| P3 | M3-13 Monaco 波浪线装饰 | ⚡ haiku | ∥ 并行 | setModelMarkers() API |
| P3 | M3-14 侧边栏标记点 | ⚡ haiku | ∥ 并行 | glyphMarginClassName |
| P3 | M3-15 Hover Tooltip | ⚡ haiku | ∥ 并行 | hoverMessage 格式固定 |
| P3 | M3-16 ProblemPanel 组件 | 🔶 sonnet | ∥ 并行 | 列表 + 点击跳转 |
| P3 | M3-17 状态栏错误计数 | ⚡ haiku | ∥ 并行 | 纯展示 |
| P4 | M3-18 错误→分支图着色同步 | 🧠 V4Pro | → 串行 | 跨模块联动 |

---

### M4 导出系统 — 88% Fast

**执行模式**：三种导出器可并行 + Godot 插件独立并行

| 阶段 | 任务 | 模型 | 模式 | 说明 |
|:---:|------|:---:|:---:|------|
| **JSON 导出**（V4Flash 并行） |
| P0 | M4-01 JSON 导出器 | 🔶 sonnet | ∥ 并行 | AST → JSON 结构映射 |
| P0 | M4-02 JSON Schema 验证 | ⚡ haiku | ∥ 并行 | ajv 验证 |
| P0 | M4-03 往返一致性测试 | ⚡ haiku | ∥ 并行 | |
| P0 | M4-04 特殊字符/边界测试 | ⚡ haiku | ∥ 并行 | |
| **HTML 导出**（V4Flash 并行） |
| P0 | M4-05 HTML 导出器 | 🔶 sonnet | ∥ 并行 | 模板生成 + 内嵌 CSS/JS |
| P0 | M4-06 HTML 交互逻辑 | 🔶 sonnet | ∥ 并行 | |
| P0 | M4-07 HTML 变量面板 | ⚡ haiku | ∥ 并行 | |
| P0 | M4-08 HTML 面包屑导航 | ⚡ haiku | ∥ 并行 | |
| P0 | M4-09 HTML 响应式布局 | ⚡ haiku | ∥ 并行 | CSS Grid |
| **TXT 导出** |
| P0 | M4-10 TXT 导出器 | ⚡ haiku | ∥ 并行 | 最简单导出器 |
| **导出 UI** |
| P1 | M4-11 ExportDialog 组件 | 🔶 sonnet | ∥ 并行 | 标准对话框 |
| P1 | M4-12 导出快捷键 + 菜单 | ⚡ haiku | ∥ 并行 | |
| **Godot 插件**（可独立并行） |
| P2 | M4-13 编辑器插件入口 | ⚡ haiku | ∥ 并行 | plugin.gd 模板 |
| P2 | M4-14 Dock 面板 | 🔶 sonnet | ∥ 并行 | |
| P2 | M4-15 变量同步器 | 🔶 sonnet | ∥ 并行 | |
| P2 | M4-16 导出触发器 | ⚡ haiku | ∥ 并行 | |
| P2 | M4-17~20 运行时库 (4 文件) | 🧠 V4Pro | → 串行 | 条件评估算法，需架构推理 |
| P2 | M4-21 Godot 插件单元测试 | ⚡ haiku | ∥ 并行 | |
| **引擎接口** |
| P3 | M4-22~24 Unity 接口 (3 文件) | ⚡ haiku | ∥ 并行 | C# 接口定义，契约式代码 |
| P3 | M4-25~26 Unreal 接口 (2 文件) | ⚡ haiku | ∥ 并行 | 蓝图 + C++ 结构体 |

---

### M5 补全引擎 — 47% Fast

**执行模式**：核心算法 V4Pro → 语料/UI V4Flash 并行

| 阶段 | 任务 | 模型 | 模式 | 说明 |
|:---:|------|:---:|:---:|------|
| P0 | M5-01 NGramEngine 核心 | 🧠 V4Pro | → 串行 | N-gram 统计算法 |
| P0 | M5-03 倒排索引 | 🧠 V4Pro | → 串行 | 前缀检索，性能敏感 |
| P1 | M5-02 预置语料库加载器 | 🧠 V4Pro | → 串行 | 数据预处理管道 |
| P1 | M5-05 中文语料包 (3.5MB) | ⚡ haiku | ∥ 并行 | 数据采集 + 预处理 |
| P1 | M5-06 英文语料包 (1.5MB) | ⚡ haiku | ∥ 并行 | 数据采集 + 预处理 |
| P1 | M5-07 语料预处理脚本 | 🔶 sonnet | ∥ 并行 | 分词 + 去特殊符号 |
| P2 | M5-08 GhostTextPlugin | 🧠 V4Pro | → 串行 | Monaco ContentWidget |
| P2 | M5-09 四维触发检测 | 🧠 V4Pro | → 串行 | |
| P2 | M5-10 幽灵字符渲染逻辑 | 🧠 V4Pro | → 串行 | UX 敏感 |
| P2 | M5-11 Tab/Esc/覆盖 | 🧠 V4Pro | → 串行 | 键盘交互 |
| P2 | M5-12 Ctrl+Space 下拉菜单 | 🔶 sonnet | ∥ 并行 | 标准下拉组件 |
| P2 | M5-13 频率控制 (<100ms) | ⚡ haiku | ∥ 并行 | 简单节流 |
| P3 | M5-14 增量学习器 | 🧠 V4Pro | → 串行 | Worker 线程 + 权重更新 |
| P3 | M5-15 权重衰减 (90天) | ⚡ haiku | ∥ 并行 | 纯函数 |
| P3 | M5-16 学习数据持久化 | 🔶 sonnet | ∥ 并行 | better-sqlite3 CRUD |
| P3 | M5-17~18 语料导入 + 预处理 | 🔶 sonnet | ∥ 并行 | 文件解析管道 |
| P3 | M5-19 CorpusManager 面板 | 🔶 sonnet | ∥ 并行 | 标准列表管理 |
| P3 | M5-04 引擎单元测试 (≥24) | ⚡ haiku | ∥ 并行 | 测试用例编写 |

---

### M6 模板与主题 — 89% Fast

**执行模式**：V4Flash 主力 → V4Pro 仅主题切换机制

| 阶段 | 任务 | 模型 | 模式 | 说明 |
|:---:|------|:---:|:---:|------|
| P0 | M6-01 模板引擎 | 🔶 sonnet | → 串行 | {{var}} 替换 |
| P0 | M6-02~05 4 个模板文件 | ⚡ haiku | ∥ 并行 | Markdown 生成，可审查 |
| P0 | M6-06 NewFileDialog | 🔶 sonnet | ∥ 并行 | 标准对话框 |
| P1 | M6-07 暗色主题 CSS Token | ⚡ haiku | ∥ 并行 | 按 standards-css.md 直译 |
| P1 | M6-08 暗色 Monaco 主题 | ⚡ haiku | ∥ 并行 | monarch theme JSON |
| P1 | M6-09 暗色分支图节点样式 | ⚡ haiku | ∥ 并行 | CSS |
| P1 | M6-10 亮色主题 CSS Token | ⚡ haiku | ∥ 并行 | 按 standards-css.md 直译 |
| P1 | M6-11 亮色 Monaco 主题 | ⚡ haiku | ∥ 并行 | monarch theme JSON |
| P1 | M6-12 亮色分支图节点样式 | ⚡ haiku | ∥ 并行 | CSS |
| P2 | M6-13 ThemeProvider 机制 | 🧠 V4Pro | → 串行 | Monaco 主题批量更新，零闪烁 |
| P2 | M6-14 ThemeToggle 按钮 | ⚡ haiku | ∥ 并行 | 标准按钮 |
| P3 | M6-15 i18n 框架 | 🔶 sonnet | → 串行 | react-i18next 集成 |
| P3 | M6-16 中文翻译文件 | ⚡ haiku | ∥ 并行 | JSON key-value |
| P3 | M6-17 英文翻译文件 | ⚡ haiku | ∥ 并行 | JSON key-value |
| P3 | M6-18 语言切换器 | ⚡ haiku | ∥ 并行 | 标准下拉 |

---

### M7 Electron 打包发布 — 73% Fast

**执行模式**：打包配置 V4Flash 并行 → 文件关联/自动更新 V4Pro 串行

| 阶段 | 任务 | 模型 | 模式 | 说明 |
|:---:|------|:---:|:---:|------|
| P0 | M7-01 electron-builder 配置 | 🔶 sonnet | → 串行 | 三平台 YAML |
| P0 | M7-02 Windows 构建 (.exe+.msi) | ⚡ haiku | ∥ 并行 | 标准 NSIS 配置 |
| P0 | M7-03 macOS 构建 (.dmg) | ⚡ haiku | ∥ 并行 | 标准 DMG 配置 |
| P0 | M7-04 Linux 构建 (.AppImage+.deb) | ⚡ haiku | ∥ 并行 | 标准配置 |
| P1 | M7-05 应用图标 | ⚡ haiku | ∥ 并行 | 资源文件 |
| P1 | M7-06 应用信息 | ⚡ haiku | ∥ 并行 | package.json 字段 |
| P2 | M7-07 .mdstory 文件关联 | 🧠 V4Pro | → 串行 | Win 注册表 + macOS plist + Linux mimetype |
| P2 | M7-08 双击 .mdstory → 打开 | 🧠 V4Pro | → 串行 | 命令行参数传递 |
| P3 | M7-09 electron-updater 集成 | 🧠 V4Pro | → 串行 | 检查+下载+安装 |
| P3 | M7-10 更新服务器配置 | 🔶 sonnet | ∥ 并行 | GitHub Releases 源 |
| P4 | M7-11 CHANGELOG.md | ⚡ haiku | ∥ 并行 | 按里程碑组织 |
| P4 | M7-12 GitHub Release 草稿 | ⚡ haiku | ∥ 并行 | |
| P4 | M7-13 首次启动引导 | 🔶 sonnet | ∥ 并行 | 欢迎页 |
| P5 | M7-14 Windows 安装包冒烟测试 | 🧠 V4Pro | → 串行 | 需人工环境 |
| P5 | M7-15 macOS/Linux 基础冒烟测试 | 🧠 V4Pro | → 串行 | 需人工环境 |

---

## 跨里程碑并行机会

| 并行组 | 里程碑 | 前提 | 说明 |
|--------|--------|------|------|
| 组 A | M1（V4Pro 解析器）+ M5（V4Flash 语料包） | M0 完成 | 解析器开发时，语料预处理可并行 |
| 组 B | M2（分支图）+ M6（V4Flash 主题 CSS） | M1 解析器就绪 | 分支图开发时，CSS Token 翻译可并行 |
| 组 C | M3（V4Flash 验证器）+ M4（V4Flash 导出器） | M1 解析器就绪 | 验证器和导出器都是纯函数，无耦合 |
| 组 D | M6（V4Flash 模板）+ M7（V4Flash 打包配置） | M4 导出器就绪 | 模板创建与打包配置可同步 |

**理论最大并行度**：M1 完成后，M2+M3 验证器+M4 导出器+M5 语料+M6 主题可并行推进（5 轨），可将 15-18 天压缩至 8-10 天。

---

## 复审节奏

每个里程碑结束时触发 L4 人工复审。复审流程遵循 `CLAUDE.md` 五层验证：

```
L1 ⚡ 工具链 → L2 🧪 单元测试 → L3 🔗 集成测试 → L3.5 🔍 独立审计 → L4 🔷 人工复审
```

**人工复审只关注 4 件事**：手感 / 视觉 / 触控（此项目为键鼠交互）/ 文档。

**里程碑准入条件**：
- L1 绿（lint + typecheck + build）
- L2 绿（该里程碑单元测试全量 PASS）
- L3 绿（占位代码扫描 + 入口可达性 + 人工走查 — 从 M1 开始）
- 产出物与交付物清单逐项对照完整

---

*文档结束。共计 8 个里程碑，142 个任务项（⚡haiku 67 + 🔶sonnet 32 + 🧠V4Pro 43），覆盖 PRD §3-§14 全部功能规格。*
