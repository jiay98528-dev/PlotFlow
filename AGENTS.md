# Fablevia（维叙）项目开发规则

> 文档导航：[工程规则与架构索引](doc/indexes/engineering.md) · [总索引](doc/INDEX.md)

工作目录为 D:/VibeCoding/PlotFlow。只访问当前项目所需文件，不跨项目扩张。默认中文沟通；用户是唯一产品决策者。共享 harness 约束由用户根目录规则维护。

## 文档索引与查看时机

文档总索引地址：[doc/INDEX.md](doc/INDEX.md)，本机绝对路径 D:/VibeCoding/PlotFlow/doc/INDEX.md。

三层结构为：总索引 → doc/indexes 下的分类索引 → 具体文档。新任务、接手和上下文恢复时先读总索引，按任务进入分类，只加载必要正文；不要默认全量加载。

| 任务 | 第二级索引 |
|---|---|
| 产品目标、功能范围、品牌 | [产品与品牌](doc/indexes/product.md) |
| 桌面 UI、主题、样式、官网设计 | [交互、主题与视觉](doc/indexes/design.md) |
| parser、Schema、导出、FullID、引擎 | [故事数据与引擎](doc/indexes/data.md) |
| 代码、状态同步、IPC、配置、缺陷定位 | [工程规则与架构](doc/indexes/engineering.md) |
| 进度、后台测试、构建、发行或部署 | [状态、验证与部署](doc/indexes/delivery.md) |

新增、删除、移动或改变文档职责时，同步对应分类索引和受影响链接；完成任务只更新实际变化的正文与状态，不新增过程报告。索引负责定位，不能覆盖具体合同；不同领域的权威来源见下文。

页面样机图册地址：[spec/assets/graph-editing-ux/gallery.html](spec/assets/graph-editing-ux/gallery.html)，本机绝对路径 D:/VibeCoding/PlotFlow/spec/assets/graph-editing-ux/gallery.html。评审页面、处理按图册编号提出的反馈或实现对应页面前，从交互分类进入图册，并按需对照 UX 规范。图片用于视觉对齐，实际交互和开发状态以相应文档为准；更新样机时同步图册链接、页面清单和配套提示词，不把正式设计资产当临时输出清理。

结构化 UX 母版说明：[design/ux-master/README.md](design/ux-master/README.md)；主文件为 D:/VibeCoding/PlotFlow/design/ux-master/fablevia-ux-master.pen，预览为 [design/ux-master/index.html](design/ux-master/index.html)。后续页面设计、控件状态修改和 UI 实现前，先从设计分类进入母版说明并查看对应画板。母版负责目标布局、组件与状态，UX 规范负责行为合同，原图册保留为视觉起点；实际完成状态以 progress.md 为准。`.pen` 只能通过 PenCLI／Pencil 工具读取和修改，不按文本或 JSON 搜索、改写。

## 当前目标与入口

- 当前软件版本与渠道以 package.json 为准：0.1.1 Preview。V0.3 是历史规划阶段名，不是安装包版本。
- 面向 1—5 人独立游戏团队，交付本地优先的叙事分支工作台。
- Graph Lab 为默认创作入口；Split 为并列的完整源码投影。
- .mdstory 为唯一磁盘真相源。图形编辑必须经命令层回写文本，再同步解析、诊断与图形；禁止数据库保存故事内容。
- 当前范围为 Windows 预览版、JSON/HTML/TXT 导出、Godot 对接和三套内置主题。
- 实际开发状态只维护 spec/progress.md；产品需求见 PRD.md；技术结构见 doc/TAD.md。
- 开始下一阶段或需要回退时，从 spec/progress.md 核对固定开发基线标签；不要把软件版本、开发基线和正式发行混用。
- 桌面 UX 权威为 spec/design-brief-editor-ux.md，主题权威为 doc/standards-theme-development.md，官网方向见 website/DESIGN_BASELINE.md。

## 直接交付

- 最小读取后修改真实产物，只解决当前需求并复用现有模式。不先建立任务书、状态文件或审批链。
- 普通技术细节自行决定；仅产品方向变化、对外发送、实际费用、不可逆破坏或法律/隐私/直接安全边界需要用户决定。
- 局部变更默认运行最相关的现有检查。打包或共享安全边界改动再扩大到受影响的构建与用户路径。
- 测试默认后台无界面执行，不得弹出 Electron 或原生对话框抢占用户桌面。原生 GUI E2E 只在隔离桌面/CI 中运行；本地收尾复用已取得的 GUI 结果。
- Windows 本地应用 E2E 使用 pnpm.cmd --filter @plotflow/app test:e2e:background，在独立隐藏桌面运行。该入口只运行 CDP 集成测试，不运行使用全局输入的原生对话框黑盒。
- 检查失败必须对应具体问题；文档形式检查和历史外审记录不得阻断普通开发。
- 默认主线程自行完成。仅用户明确要求委派且任务确有隔离必要时，才按共享规则使用独立子代理。
- 不把内部进度、测试状态和责任切割写进产品营销正文。
- 阶段结束只在对话总结已完成内容、未解决事项和一个明确下一步。

## 技术与数据边界

- Electron 42、React 18、TypeScript strict、Zustand、Monaco、React Flow + Dagre；精确依赖版本以 package.json 和 pnpm-lock.yaml 为准。
- 当前使用 Vite 6 / electron-vite 5、pnpm 11。不要按历史 Vite 5 规格降级。
- Core 为纯 TypeScript，位于 packages/core；桌面端位于 packages/app；反馈服务位于 packages/feedback-service。
- website 为独立静态网站，不进入 Electron 安装包；反馈服务凭据只存在服务端。
- 禁止引入 Vue/Angular/Svelte 或强制联网创作能力。
- 补全为本地 N-gram 与本地语料学习，数据不离开设备。
- .mdstory 系统格式版本为 0.1；当前 JSON 写出使用 Schema 0.2，引擎保留 0.1/0.2 兼容。
- 从引擎启动时，变量由引擎定义，不允许在编辑器绕过来源约束。
- 导出支持 JSON、HTML、TXT，不生成专有二进制故事或旧 .doc。

## 编辑器约束

- Monaco 语法使用 Monarch；诊断用 setModelMarkers；幽灵补全用 registerInlineCompletionsProvider；输入解析防抖为 500ms。
- Graph 修改经 Zustand / graphEditService / 文本事务流，不直接把 React Flow 内部状态作为真相源。
- 自定义节点使用 React.FC<NodeProps>；节点状态通过 className 和主题 token 表达。
- 保存、导出、打开与模式切换必须遵循会话身份、草稿提交及交互租约边界；不能丢弃拒绝提交的用户草稿。
- IPC、preload、文件路径、ZIP、安全校验及会话竞态由主线程负责，不交给机械替换型代理。

## 主题与样式

- 当前只注册棱镜铸造台、叙事工作台、引擎遥测台三套编译内置主题，默认为棱镜铸造台。
- ADR-016 已暂停远程 registry、下载、安装、主题协议和磁盘 JavaScript 执行。不得恢复旧 ZIP 代码主题链路。
- 不开放社区上传、本地导入、购买或授权。旧远程主题目录保留但忽略，未知 ID 回退内置默认主题。
- 所有颜色引用 Design Token CSS 变量；组件不得写裸 hex 色值或复制两套硬编码亮暗样式。
- Surface/Slot/API 变化须同步主题标准；视觉方向或交互合同变化须同步 UX 简报。局部缺陷和可访问性修复不以新增文档为前置条件。
- 主题不得改变故事语义、解析、导出、保存或 Graph Lab 命令层。

## 文件与验证

- 文件读写显式 UTF-8；路径统一正斜杠；.mdstory 扩展名小写；源码引用使用相对路径。
- Windows 使用 PowerShell 7，原生程序避免与别名混淆。递归删除前检查绝对路径留在目标项目内。
- 测试源码、fixtures、视觉基线与生成 Schema 校验器属于维护资产，不当临时产物清理。
- 历史过程报告从 Git 历史查询；运行日志、临时导出与测试输出不提交。
- 开发基线包放在 release/baseline，包含安装包、解包应用与同轮源码快照；该目录不进入 Git。
- 正式 RC 和公共发布的最小检查见 spec/release-blackbox-gate.md；普通开发不需要外审证据链。
