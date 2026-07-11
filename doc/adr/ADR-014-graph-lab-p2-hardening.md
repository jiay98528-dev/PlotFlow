# ADR-014: Graph Lab P2 可靠性、响应式与发行硬化

> 日期：2026-07-11
> 状态：已采纳；本地实现完成，外部发行门禁待验收
> 决策者：PlotFlow 产品与工程
> 关联：ADR-008、ADR-012、ADR-013、`spec/design-brief-editor-ux.md`

## 背景

Graph Lab 已成为 PlotFlow 的主要且默认工作区，但 P2 审计仍发现五类系统性风险：Graph → Split 可能绕过 Source Drawer 草稿边界；Inspector 临时状态可能跨故事或路线复用；三栏布局在窄屏退化为不可用的纵向堆叠；诊断与桌面确认框存在分散的可见文案；PR 与发行验证没有清晰区分源码集成、unpacked 和真实 installed 证据。

这些问题彼此相关。若只修单个按钮或单条文案，仍会留下跨投影数据风险、响应式不可达路径和无法审计的发行结论。因此本 ADR 把状态边界、UI 结构、i18n 合同和 CI 证据定义为一个 P2 硬化单元。

## 决策

### 1. 模式切换与故事会话

- 所有工作区切换统一经过 `requestWorkspaceMode(mode)`，不得由 Toolbar、菜单或快捷键直接写 `workspaceMode`。
- Graph → Split 时，dirty Source Drawer 先提交到内存 `.mdstory` 文本；stale 草稿阻断切换，Graph Lab、草稿和恢复操作保持可用。
- Editor 暴露单调递增的 `storySessionId` 与 `beginStorySession()`。新建、打开、命令行打开、Continue 和外部重载都开始新会话。
- 变量草稿以故事会话为生命周期；效果草稿以 `storySessionId + nodeFullId + route identity` 为生命周期。节点切换、选项重排和同章节 ID 的故事替换都不能复用旧草稿。

### 2. Graph Lab 信息架构与响应式

- Command Bar 承载故事标题、搜索、诊断、Undo/Redo、保存和 Source 操作；章节标签独占第二行。
- Palette 不重复故事 hero。Inspector 使用 `InspectorTab = 'node' | 'routes' | 'variables' | 'story'` 四个互斥标签；窄屏使用 `CompactGraphPanel = 'palette' | 'inspector' | null` 保证两个侧栏互斥。
- `≥1180px` 为完整三栏；`901–1179px` 为紧凑三栏；`≤900px` 为 canvas-first。窄屏 Palette 与 Inspector 是互斥侧边抽屉，Source Drawer 保持受视口约束的底部工具。
- 节点搜索产生 `GraphFocusRequest { requestId, fullId, behavior }`；选择结果只切章、选中和聚焦，不触发布局或 AST 修改。
- dropdown、canvas overlay、panel、modal 使用语义层级 token，不允许组件内任意 z-index 或 fallback。

### 3. 诊断与桌面 i18n

- `Diagnostic` 增加稳定的 `messageKey/messageParams`，可选 `detailKey/detailParams`；旧 `message/detail` 保留为日志和兼容回退。
- ProblemPanel、Source Drawer 与 Monaco marker 统一通过 `localizeDiagnostic()` 显示诊断。
- 主进程确认框复用当前菜单语言；系统打开失败返回 tagged result，并显示本地化错误及路径。
- 待打开文件使用 `PendingOpenFileResult = none | opened | error` tagged union；Main 与 preload 共用 `IPC_CHANNELS` 常量与类型，移除未使用的 `FileService.newFile`。Renderer CSP 显式包含 `connect-src 'self'`，官方远程主题仍只通过 Main IPC 下载。
- UI 字面量门禁采用 TypeScript AST，只覆盖主路径 JSXText、`title`、`aria-label`、`placeholder` 和明确的状态/对话框参数。产品名、格式名、schema 枚举和测试 fixture 使用窄白名单。

### 4. CI 与发行证据分层

- 仓库与 CI 统一使用 pnpm 11.5.1；moderate 及以上依赖审计为阻断门禁。
- Ubuntu PR 门禁覆盖 lint、typecheck、unit、build、CSS/token/bundle、UI literal、Schema mirror、engine contracts 与网站静态验证。
- Windows PR 门禁在固定 `windows-2022`/Segoe UI 环境运行完整 app E2E、视觉旅程与 source blackbox，并仅在失败时上传 trace、截图和视频。
- nightly/manual Windows 任务每次 fresh `package:win`，运行 unpacked blackbox、100/500/1000 节点性能旅程并生成 SHA256 清单。
- installed blackbox 仅允许 `workflow_dispatch`、受保护 environment 和 self-hosted Windows runner。它必须验证本次安装包 SHA256、实际安装路径以及安装 EXE 与本次 unpacked EXE 哈希一致。

工作流配置落地不等于门禁通过。进度与发布文档只能引用该 revision 上实际产生的运行结果和产物哈希。

## 后果

正向后果：模式切换成为可测试事务；故事替换不会泄漏 Inspector 草稿；窄屏保留画布主任务；诊断文案由单一合同驱动；PR 与发行证据可以明确区分源码、unpacked 和 installed 层级。

成本与风险：`storySessionId` 必须贯穿多个打开入口；现有未本地化字面量会被新门禁暴露；Windows E2E 增加 CI 时间；installed job 依赖仓库外的 runner 标签、受保护 environment 和人工安装权限。GitHub 仓库管理员仍需在设置中为 `windows-installed-release` 配置审批保护，YAML 名称本身不能提供审批保证。

## 替代方案

- 让每个入口自行处理 Source Drawer：拒绝。容易出现菜单、Toolbar 和快捷键行为漂移。
- 仅以节点 ID 重置效果草稿：拒绝。跨故事同 ID 和选项重排仍可能串用状态。
- 在窄屏把三栏纵向堆叠：拒绝。画布会离开首屏，且 Source Drawer 与 Inspector 形成滚动陷阱。
- 在 Ubuntu 上模拟全部桌面发行验证：拒绝。无法证明 Windows 原生对话框、安装路径和文件关联。
- 自动执行静默 installed 测试：拒绝。per-machine 安装涉及 UAC 与外部状态，只能在受保护的 self-hosted 环境中进行。

## 验收

本 ADR 在以下条件全部满足后才能从“实施中”改为“已完成”：相关单元和 App E2E 通过；四个目标视口验收通过；Ubuntu 与 Windows PR 工作流在当前 revision 成功；fresh package/unpacked/performance/SHA256 任务成功；installed blackbox、30 分钟人工巡检与 Authenticode 仍按 `spec/release-blackbox-gate.md` 独立记录，不得由源码门禁替代。
