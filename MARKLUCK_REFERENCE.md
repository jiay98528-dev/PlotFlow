# MarkLuck 工作流与代码复用参考

> **用途**：作为创建 PlotFlow 项目级元指令（CLAUDE.md）的输入素材
> **来源**：`D:\VibeCoding\MarkLuck` 项目深度分析
> **日期**：2026-06-10
> **状态**：供元指令创建时参考

---

## 一、工作流方法论（可直接迁移）

### 1.1 四层质量门禁体系

MarkLuck 定义了一套 AI 协作开发的验证流水线，PlotFlow 应全盘采纳：

```
L1 ⚡  快速检查 (TypeScript编译 + ESLint + Prettier)
    ↓  <30秒，每次修改后自动运行
L2 🧪  自动化测试 (Vitest单元 + Playwright E2E)
    ↓  <5分钟，提交前运行
L3 🔗  集成测试 (真实文件系统读写、导出完整性验证)
    ↓  <15分钟，合并前运行
L3.5 🔍 质量审计 (代码审查 + 安全扫描 + 类型对齐)
    ↓  按里程碑触发
L4 🔷 人工复审 (体验验证 + 视觉还原度 + 完整走查)
    ↓  里程碑完成后
```

**PlotFlow 适配要点**：
- L1：替换为 `tsc --noEmit` + ESLint + Prettier（与 MarkLuck 一致）
- L2：Vitest 单元 + Playwright E2E（与 MarkLuck 一致）
- L3：验证 .mdstory 文件读写、JSON 导出完整性、React Flow 渲染
- L3.5：类型定义与 spec 文档一致性检查
- L4：手工走查完整的 写→检查→导出→引擎加载 流程

### 1.2 双轨进度管理

**MarkLuck 实践**：

| 文档 | 性质 | 更新时机 |
|------|------|---------|
| `spec/milestones.md` | 计划（静态基准） | 里程碑启动时冻结 |
| `spec/progress.md` | 实际（动态追踪） | 每次 L3 集成测试通过后更新 |

每个任务标注：**状态图标 + 完成日期 + Commit Hash**。

**PlotFlow 应采纳**：在 `spec/` 目录下建立 milestone.md 和 progress.md，格式照搬。

### 1.3 架构决策记录 (ADR)

**MarkLuck 格式**（每条 ADR 包含 4 节）：

```markdown
## ADR-001: 标题

- **状态**: 已采纳
- **日期**: YYYY-MM-DD

### 背景
（为什么需要做这个决策）

### 决策
（选择了什么方案）

### 后果
**正面**：...
**负面**：...

### 替代方案
| 方案 | 未选原因 |
|------|---------|
```

**PlotFlow 应采纳**：将 PRD 附录中的 15 条决策迁移为独立 ADR 文件 `spec/decisions.md`。

### 1.4 错题本 (Bug Log)

**MarkLuck 格式**（每个 BUG 包含 5 节）：

```markdown
## BUG-001: 简短标题

- **现象**: 用户看到什么
- **根因**: 代码层面原因
- **根因类别**: 文件IO/渲染管线/状态管理/类型边界/跨平台兼容/索引搜索/导出
- **修复**: 具体改动
- **教训**: 从根本上防止同类问题的方法
```

**强制规则**：文档开头声明"任何 Debug/修BUG/编码任务开始前，必须先阅读本文档"。

**PlotFlow 应采纳**：创建 `memory/bug_log.md`，根因类别调整为：解析器/分支图/导出/补全引擎/跨平台/文件IO/状态管理。

### 1.5 编码规范分层

MarkLuck 有 5 份独立编码规范：

| 规范文件 | 内容 | PlotFlow 对应 |
|----------|------|--------------|
| `doc/standards-css.md` | 4px 栅格、OKLCH 色彩、token 强制 | 替换为 React 组件样式规范 |
| `doc/standards-git.md` | 分支命名、Commit 格式、PR 流程 | 直接复用，改仓库名 |
| `doc/standards-rust.md` | Rust 代码规范 | 不适用（Electron 不用 Rust） |
| `doc/standards-typescript-vue.md` | TS + Vue SFC 规范 | 替换为 TS + React 规范 |
| `.prettierrc` + `eslint.config.js` | 自动格式化 | 全局复用（调整规则细节） |

### 1.6 CI 基础设施

**可直接复制的配置文件**：

| 文件 | 用途 | 修改点 |
|------|------|--------|
| `.github/workflows/ci.yml` | CI 流水线 | 改包名、改 Node 版本 |
| `.husky/pre-commit` | pre-commit hook | 不变 |
| `commitlint.config.js` | Commit 格式校验 | 不变（都用 Conventional Commits） |
| `lint-staged` 配置 | 只 lint 变更文件 | 调整 glob 模式 |

---

## 二、可复用代码模块

### 2.1 N-gram 补全引擎 ⭐⭐⭐⭐⭐

**来源文件**：`packages/app/src/utils/ngram-engine.ts`

**复用价值**：**极高** — 算法核心是语言无关的纯统计模型，可直接移植到 PlotFlow。

**MarkLuck 实现要点**：
- 纯 TypeScript，无外部运行时依赖
- N-gram（1-5 gram）统计模型
- 基于倒排索引的快速前缀匹配
- 支持权重衰减（90天未用模式 ×0.5）
- 紧凑二进制格式存储（baseline-ngram.v1.compact.txt）

**PlotFlow 移植策略**：
1. 复制 `ngram-engine.ts` 核心算法（MIT 协议允许）
2. 替换 MarkLuck 的笔记语料 → PlotFlow 的游戏对话语料
3. 新增变量名补全（读取 Frontmatter 变量列表注入索引）
4. 保持权重衰减 + 本地学习机制不变
5. 接口需从 CM6 → Monaco Editor 适配

**移植工作量估算**：1.5 人天

### 2.2 幽灵文本补全插件 ⭐⭐⭐⭐

**来源文件**：`packages/app/src/utils/cm6-ghost-text.ts`

**复用价值**：**高** — 交互模式可照搬，但需从 CM6 ViewPlugin → Monaco Decorations API 改写。

**MarkLuck 实现要点**：
- CM6 ViewPlugin 在光标后渲染灰色斜体幽灵文本
- Tab 接受 / Esc 忽略 / 继续输入自动刷新
- 500ms 防抖触发预测
- 支持结构化补全（Wiki-link `[[`、标签 `#`、路径 `/`）

**PlotFlow 移植策略**：
1. 交互模式照搬：幽灵字符显示 + Tab/Esc/Ctrl+Space
2. 底层 API 替换：CM6 ViewPlugin → Monaco `InlineCompletionItemProvider`
3. 触发条件替换：`#` 触发 → `# 节点：` 触发；`[[` 触发 → `[选项]` 触发；`$` 触发 → 变量名补全
4. 保留防抖逻辑（Monaco 用 `registerInlineCompletionsProvider`）

**移植工作量估算**：2 人天（含 Monaco API 学习）

### 2.3 语料训练管道 ⭐⭐⭐⭐

**来源文件**：`scripts/train-baseline.ts` + `corpus/` 目录

**复用价值**：**高** — 训练脚本结构可直接复用。

**MarkLuck 实现要点**：
- 读取语料目录 → 分词 → N-gram 统计 → 压缩存储
- 支持增量训练（新语料追加）
- 输出紧凑二进制格式

**PlotFlow 移植策略**：
1. 复用分词和 N-gram 统计算法
2. 替换语料输入：笔记文本 → 游戏对话文本
3. 新增语料分类标签（RPG对话/视觉小说/解谜描述/通用描写）
4. 保留增量训练和压缩存储格式

**移植工作量估算**：1 人天

### 2.4 导出管线架构 ⭐⭐⭐

**来源文件**：`packages/app/src/services/Exporter.ts`

**复用价值**：**中** — Pipeline 模式可参考，但导出逻辑完全不同。

**MarkLuck 实现要点**：
- 多格式 Pipeline：Markdown → 中间格式 → 各格式渲染
- 统一的导出入口 + 按格式分发的策略
- 文件命名和目录创建逻辑

**PlotFlow 移植策略**：
1. 参考 Pipeline 架构设计（不是复制代码）
2. PlotFlow 的 Pipeline：.mdstory → PlotFlowData IR → JSON/HTML/TXT
3. 参考文件命名和导出目录管理逻辑

**移植工作量估算**：0.5 人天（参考架构，非复制代码）

### 2.5 模板引擎 ⭐⭐⭐

**来源文件**：`packages/app/src/services/TemplateEngine.ts` + `src-tauri/src/template.rs`

**复用价值**：**中** — TS 端模板逻辑可参考。

**MarkLuck 实现要点**：
- 模板占位符系统：`{{date}}`, `{{time}}`, `{{year}}` 等 7 种
- 自定义模板支持
- Rust 端模板引擎（文件系统侧）

**PlotFlow 移植策略**：
1. 参考占位符替换逻辑（但 PlotFlow 模板是 .mdstory 文件，不是占位符替换）
2. PlotFlow 的模板是完整的故事骨架，采用"复制模板文件 + 替换标题/作者占位符"

**移植工作量估算**：0.5 人天

### 2.6 Monaco Editor 集成参考

MarkLuck 使用 **CodeMirror 6**，PlotFlow 使用 **Monaco Editor**。代码不可复用，但以下设计模式可从 MarkLuck 的 CM6 扩展体系中获得启发：

| MarkLuck 模块 | 对应 PlotFlow 需求 | 可迁移的设计思想 |
|---------------|-------------------|-----------------|
| `blockParser.ts` | .mdstory 语法解析器 | 防抖解析 + AST 缓存 + 增量更新模式 |
| `BlockDecorator` (CM6) | Monaco Decorations（错误标记） | 语法标记点 → 对应的装饰器映射 |
| `FormatToolbar` | 选项模板插入工具栏 | 工具栏按钮 → Monaco `executeEdits()` 模式 |
| `FormatAutoDetector` | 语法自动识别（`[选项]` 后自动高亮） | 输入后 150ms 防抖触发模式匹配 |

---

## 三、文档结构对照表

| MarkLuck 文档 | PlotFlow 对应文档 | 状态 | 创建优先级 |
|---------------|------------------|:---:|:---:|
| `PRODUCT.md` | 部分内容在 PRD 中 | ⚠️ | P2 拆分独立 |
| `doc/PRD.md` | `PRD.md` | ✅ | 已完成 |
| `doc/TAD.md` | 待创建 | ❌ | P0 |
| `doc/standards-*.md` | 待创建 | ❌ | P1 |
| `spec/decisions.md` | PRD 附录有 15 条 | ⚠️ | P1 独立成文件 |
| `spec/milestones.md` | 待创建 | ❌ | P0 |
| `spec/progress.md` | 待创建 | ❌ | P0 |
| `spec/types/*.ts` | 待创建 | ❌ | P1 |
| `spec/frontend/*.md` | 待创建 | ❌ | P2 |
| `memory/bug_log.md` | 待创建 | ❌ | P0 |
| `CHANGELOG.md` | 待创建 | ❌ | P2 |
| `README.md` | 待创建 | ❌ | P2 |
| `COMPETITIVE_ANALYSIS.md` | `COMPETITIVE_ANALYSIS.md` | ✅ | 已完成 |
| `CLAUDE.md` | 待创建（本文件为素材） | ❌ | P0 |

---

## 四、技术选型启示

### 4.1 MarkLuck 的好决策（PlotFlow 应借鉴）

| 决策 | MarkLuck 理由 | PlotFlow 适用性 |
|------|--------------|----------------|
| pnpm workspace monorepo | 拆分 renderer 共享包 | ✅ PlotFlow 可将解析器拆为 `@plotflow/parser` 独立包 |
| 文件即数据源 | .md 是唯一数据源，绝不引入数据库 | ✅ PlotFlow 同样——`.mdstory` 是唯一数据源 |
| Mock 与真实实现共享接口 | `IFileSystemService` 接口 | ✅ PlotFlow `IPlotFlowParser` 接口用于测试 |
| 前端先行 + 后端接入 | Phase 1-3 纯 Web 开发，Phase 4 接 Tauri | ✅ PlotFlow Monaco 先 Web 跑通，再 Electron 包壳 |

### 4.2 MarkLuck 的教训（PlotFlow 应避免）

| 教训 | 来源 | 预防措施 |
|------|------|---------|
| 核心功能标记完成但实际缺失 | BUG-004（块级混合编辑器 BlockWidget 从未实现） | 每个里程碑完成后必须 L4 体验复审——实际使用一遍 |
| 设计系统被组件绕过 | BUG-005（10+ 组件硬编码 `#fff`/`#eee`） | CI 加 stylelint 规则强制引用 Design Token |
| Tauri 打包未尽早验证 | M6 "编码完成，待打包验证" | Electron 打包在 V0.1 开始后第一周就建好空壳验证 |
| 未调试的浏览器 API 盲目使用 | BUG-003（DOCX 分享 MIME 不支持） | 使用不熟悉的 API 前先查 MDN 兼容性表 |

---

## 五、PlotFlow CLAUDE.md 创建建议

基于以上分析，PlotFlow 的 `CLAUDE.md` 应包含以下章节：

```markdown
1. 项目身份（一句话定位 + 核心闭环）
2. 技术架构（不可变的选型决策表）
3. 当前阶段（V0.1 MVP 目标）
4. 文档索引（PRD/TAD/ADR/里程碑/错题本/竞品分析）
5. 工作流规范
   5.1 四层质量门禁（L1-L4）
   5.2 双轨进度管理（里程碑 + 进度跟踪）
   5.3 错题本强制阅读规则
   5.4 类型合同对齐规范
6. 代码约束
   6.1 样式 Token 约束（引用设计系统，禁用裸色值）
   6.2 Monaco Editor 扩展规范
   6.3 React Flow 节点组件规范
   6.4 补全引擎触发规则
7. 文件结构约定
8. 禁止事项（明确禁用某些技术或模式）
```

---

## 六、快速复用检查清单

在创建 PlotFlow CLAUDE.md 时，逐条对照：

- [ ] L1-L4 质量门禁定义完成
- [ ] milestones.md 和 progress.md 模板创建
- [ ] ADR 决策记录模板迁移
- [ ] bug_log.md 格式和根因分类定义
- [ ] N-gram 引擎代码已复制到 PlotFlow 仓库
- [ ] 幽灵补全交互模式文档已撰写
- [ ] 语料训练管道设计文档已撰写
- [ ] 导出 Pipeline 架构图已绘制
- [ ] Electron 打包空壳已在第一周验证
- [ ] CI 配置文件已从 MarkLuck 迁移并修改
- [ ] 编码规范文档（TS/React/CSS/Git）已创建
- [ ] 设计系统 Token 文件已创建
- [ ] "禁止裸色值" stylelint 规则已配置

---

*本文档作为 CLAUDE.md 创建的输入素材，不替代 CLAUDE.md。实际创建时请从中提取适用内容并做 PlotFlow 场景化调整。*
