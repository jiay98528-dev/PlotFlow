# ADR-012 — Graph Lab 作为主要且默认工作区

- **日期：** 2026-07-10
- **状态：** 已通过
- **适用范围：** Home、工作区默认值与迁移、新建/打开/继续编辑、Split、Graph Lab、发行门禁与用户文档
- **覆盖关系：** 仅覆盖 ADR-008 中“Graph Lab 不替代 Split 默认工作流”的条款；ADR-008 的 `.mdstory` 唯一真相源与双投影原则继续有效

## 背景

PlotFlow 最初以 Split 分栏和 Monaco 源文本编辑为主要入口。M8 已把 Graph Lab 推进为支持画布、Palette、Inspector、章节标签、Source Drawer、诊断与导出的正式图优先工作区。继续把 Split 定义为默认入口，会让产品信息架构、首次使用路径和发行验收落后于当前“完整 GUI 创作闭环”的目标。

“文本是数据格式”与“文本编辑器是默认体验”不是同一件事。PlotFlow 仍需保留可读、可 diff、可由外部工具编辑的 `.mdstory`，但首要用户不应被要求先学习或手写语法才能开始创作。

## 决策

- **Graph Lab 是 PlotFlow 的主要且默认创作工作区。** 首次启动、旧偏好迁移后的首次进入、新建、打开、命令行打开和 Home 的 Continue editing，默认落入 Graph Lab。
- **Split 与 Graph Lab 在顶栏保持并列可达。** Split 定位为完整 `.mdstory` 源码投影，服务透明性、精确源码编辑、恢复和高级用户，不隐藏、不删除，也不作为默认路径。
- **`.mdstory` 继续是唯一磁盘真相源。** Graph Lab 的 GUI 操作必须写回同一个纯文本文件，再由既有解析、诊断与导出管线消费；不得引入图数据库、专有工程文件或第二份故事状态。
- **Source Drawer 是 Graph Lab 内的辅助源码投影。** 它显示当前章节切片，不取代 Split 的全文件视图，也不改变 Graph Lab 的画布优先心智。
- **用户显式选择优先于产品默认值。** 旧版本偏好只迁移一次；迁移后用户再次选择 Split，后续启动必须尊重该选择。
- **发行证据必须以 Graph-first 闭环为主。** 严格黑盒需覆盖首次启动或打开文件后直接在 Graph Lab 创建、编辑、保存、重启、继续编辑、诊断和真实导出，全程不依赖 Split、内部测试桥或 IPC mock；Split 仍保留独立辅助路径回归。

## 后果

正面：

- 产品默认体验与已交付的图优先能力一致，非技术用户无需先学习 `.mdstory` 语法。
- `.mdstory` 的开放性、Git 友好与外部编辑能力不受影响。
- Graph Lab 的撤销、保存、诊断、导出、键盘可达性和高级语法覆盖成为正式发布门禁，而不再是可选增强。

负面：

- 旧的 Split-first E2E、帮助文案、性能基线和 Home 信息层级必须迁移。
- Graph Lab 的缺口会直接阻断发布，不能再以“可切回 Split”作为核心路径的兜底。
- 必须维护 Graph Lab、Source Drawer 与 Split 三种投影之间的可恢复同步。

## 禁止回归

- 不得把首次启动、新建、打开或 Continue editing 的产品默认值恢复为 Split。
- 不得把 Graph Lab 描述为实验模式、预览器、检查器或 Split 的附属功能。
- 不得把“`.mdstory` 是唯一真相源”解释为“Monaco 必须是默认 UX”。
- 不得隐藏或删除顶栏 Split 入口，也不得忽略迁移后用户明确保存的 Split 偏好。
- 不得用只经过内部测试桥的 E2E 代替真实 Graph-first 文件闭环。

## 相关文件

- `spec/design-brief-editor-ux.md`
- `PRD.md`
- `packages/app/src/stores/uiStore.ts`
- `packages/app/src/services/storySessionService.ts`
- `spec/release-blackbox-gate.md`
- `spec/blackbox-gui-e2e-plan.md`
