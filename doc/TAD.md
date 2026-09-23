# Fablevia 技术架构

> 文档导航：[工程规则与架构索引](indexes/engineering.md) · [总索引](INDEX.md)

更新：2026-09-23。本文描述当前源码结构；精确依赖版本见根 package.json 与 pnpm-lock.yaml。

## 运行结构

- Electron 42 主进程负责文件系统、原生菜单、对话框、系统打开请求和反馈 HTTP 传输。
- preload 提供受限 IPC 桥；renderer 使用 React 18、TypeScript strict、Zustand、Monaco 和 React Flow。
- electron-vite 5 / Vite 6 构建到根 out/main、out/preload、out/renderer。
- packages/core 提供纯 TypeScript 解析、诊断、导出、模板与本地补全，桌面端通过 @plotflow/core 使用。
- packages/feedback-service 独立部署，邮件凭据不进入桌面包。
- website 独立构建，electron-builder 的文件白名单只包含 out 与 package.json，资源另由 extraResources 指定。

## 故事与会话

.mdstory 是唯一磁盘真相源。源文本编辑经 500ms 防抖解析为 PlotFlowData，随后更新诊断、图形与 Outline。Graph Lab 修改经过 graphEditService 和 storySourceEditService 转为文本事务，复用相同解析路径。

| 入口 | 职责 |
|---|---|
| packages/app/src/services/parsePipeline.ts | 文本解析、诊断与投影同步 |
| packages/app/src/services/storyTransactionService.ts | 会话身份、revision 与交互租约 |
| packages/app/src/services/storySessionService.ts | 故事会话切换 |
| packages/app/src/services/sourceDraftCoordinator.ts | 章节源码草稿提交与过期检测，并协调 Inspector 草稿 |
| packages/app/src/services/inspectorDraftCoordinator.ts | 详情字段的切换前提交，拒绝时保留输入，防止递归重复提交 |
| packages/app/src/services/storyReplaceGuard.ts | 替换故事前处理当前草稿和未保存修改 |
| packages/app/src/services/autoSaveService.ts | 自动保存与迟到回调隔离 |
| packages/app/src/services/exportSnapshotService.ts | 导出前取得一致的故事快照 |
| packages/app/src/services/externalChangeCoordinator.ts | 外部磁盘变更与当前编辑协调 |
| packages/app/src/services/graphHistoryService.ts | Graph 原生撤销重做 |

保存、打开、模式切换和导出不能绕过草稿协调器。交互提交须先释放阻止文本事务的租约；失败不能丢弃用户草稿或把旧会话结果写入新会话。

## 图与源码投影

Graph Lab 是默认工作区，Split 为完整源码投影。章节/节点 ID 使用编码组件组成的 canonical FullID；坐标保存在可选 layout.graph.nodes 中，不改变剧情语义。React Flow 的拖动瞬时状态由控制器管理，结束后提交文本与历史。

components/branch-graph 中的节点、连线、连接与拖线控制器各自维护交互，业务编辑统一调用故事服务。Inspector 和 Source Drawer 拒绝提交时保留输入。Inspector 协调器只用于用户导航、保存等边界；底层 selectNode 是内部投影操作，不触发草稿提交。未提交输入通过纯状态谓词计入保存风险，用户键入时递增 sourceDraftRevision，防止等待中的读写覆盖新草稿。

## 主进程与 IPC

packages/app/src/shared/ipcChannels.ts 维护通道名；src-electron/preload.ts 暴露类型受限的桥。ipcSecurity.ts 校验调用来源。closeGuard.ts 处理退出前保存与错误分支；pendingOpenFile.ts 和 systemOpenBuffer.ts 协调系统打开请求。

应用品牌为 Fablevia / 维叙，技术命名空间 plotflow、appId、旧用户目录与安装升级标识保留兼容。当前版本和 Preview 标签统一来自 shared/productIdentity.ts 对根 package.json 的读取。

## Core 与引擎

packages/core/src 中 parser、validator、exporter、completion 分别承担解析、诊断、三种导出和本地 N-gram。JSON 写出使用生成的 Ajv standalone 校验器；Schema 0.1 冻结兼容，0.2 为当前写出合同。

addons/plotflow 为 Godot 插件与运行时，plugins/unity 和 plugins/unreal 为对应接口与示例。tests/engine-contract 验证跨语言消费约定，真实引擎执行须在相应工具链中另行验证。

## 本机写作素材

services/corpusLibraryService.ts 管理本机 IndexedDB 素材库，只保存用户主动导入的写作素材；.mdstory 故事仍只由文件事务维护。TXT/CSV/MDSTORY 文件和粘贴文本共用 CorpusImporter 校验、去重及 PreprocessingPipeline。单文件 10 MB，总量 50 MB；存储失败显示错误，不伪报成功。

启用素材构成独立的 NGramEngine，增删或停用后重建该模型。GhostTextPlugin 在正文预测时读取素材建议，再使用既有内置与学习模型；不清空用户当前的基础学习引擎。setupEditor 启动时加载素材，无网络依赖。

## 主题与资源

当前只编译注册三套内置主题。主题通过 tokens、Surface、Slot、layout/UX/motion recipe 改变外观，不改变故事服务。远程 registry、下载、安装、自定义主题协议与磁盘 JavaScript 执行已停用；详见 standards-theme-development.md。

## 开发与交付

根 Vitest 覆盖 app/core，反馈服务有独立测试，Electron Playwright 覆盖 GUI。Graph Lab 测试每例独立应用和 profile，避免共享窗口污染。视觉快照、fixtures 和回归测试属于维护资产。

开发基线交付目录为 release/baseline，源码快照与同轮生成的 Windows 安装包一起保存。正式发行工具与最小规则见 ../spec/release-blackbox-gate.md；不把旧版本报告作为当前软件状态。
