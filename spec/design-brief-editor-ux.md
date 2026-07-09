# PlotFlow 编辑器 UX 设计简报

> 版本：V0.3
> 更新日期：2026-07-07
> 状态：当前 UX 设计唯一真相源
> 范围：PlotFlow 桌面编辑器、Split 工作区、Graph Lab、Source Drawer、主题系统、导出和发行验收口径。

## 1. 产品定位

PlotFlow 是面向独立游戏开发者的本地优先叙事分支管理工具。用户可以在 Split 模式直接编辑 `.mdstory` 源文本，也可以在 Graph Lab 以流程图优先的方式搭建、检查和调整剧情结构。`.mdstory` 始终是唯一磁盘真相源，所有 GUI 操作都必须写回同一个纯文本文件。

核心体验目标：

- 文案策划能直接写 Markdown 方言，不被图形工具锁死。
- 叙事设计师能在 Graph Lab 中完成节点、选项、条件、效果、变量和章节的主路径编辑。
- 程序能拿到稳定 JSON/HTML/TXT 导出，不依赖专有数据库。
- 发行版必须离线可用，不强制联网，不上传用户内容。

## 2. 目标用户与使用场景

首要用户是 1 到 5 人独立游戏团队中的叙事设计师、文案策划和程序开发者。典型场景是：用户打开一个 `.mdstory` 文件，在 Split 中补写文本，在 Graph Lab 中检查分支结构，修复诊断，导出 JSON 给引擎运行。

Graph Lab 的目标不是替代源文本，而是让“不想手写语法”的用户也能完成核心闭环。用户随时可以回到 Split 查看完整文件，Graph Lab Source Drawer 只承担当前章节切片的辅助编辑。

## 3. 信息架构

全局应用由 Home、Toolbar、工作区、Status Bar 和弹层系统组成。

Split 工作区：

- 左侧 Outline 显示章节和节点结构。
- 中间 Monaco Editor 显示完整 `.mdstory` 文件。
- 右侧分支图显示当前故事图结构。
- 问题面板按错误、警告、建议展示诊断。

Graph Lab 工作区：

- 顶部命令栏显示当前文件、统计、诊断入口、Source Drawer 开关。
- 顶部第二行固定显示章节标签栏。
- 左侧 rail 包含工作区浏览器、Outline 和创建工具。
- 中间 React Flow 画布显示当前章节图。
- 右侧 Inspector 编辑故事、节点、变量、选项、条件和效果。
- 底部 Source Drawer 编辑当前章节源码切片。

## 4. 视觉原则

PlotFlow 的视觉风格应安静、清晰、工作导向。它是叙事生产工具，不是营销页面。

颜色必须通过设计 token 和主题变量表达，不在组件、文档示例或测试夹具中写直接色值。语义颜色按用途命名：

| 语义 | 用途 |
|---|---|
| surface | 页面、面板、卡片背景 |
| text-primary | 主文本 |
| text-muted | 次要说明和元信息 |
| accent | 主操作、当前选中状态 |
| syntax-node | 节点标题语法 |
| syntax-option | 选项语法 |
| syntax-condition | 条件语法 |
| syntax-effect | 效果语法 |
| syntax-variable | 变量语法 |
| diagnostic-error | 阻断性错误 |
| diagnostic-warning | 需要关注的警告 |
| diagnostic-info | 建议和提示 |

布局密度应服务重复使用：

- 工具栏、标签栏、Inspector 字段使用紧凑尺寸。
- 卡片圆角保持克制，不使用装饰性漂浮卡片包裹整个页面区块。
- 文本必须在按钮、标签、节点卡片内完整可读，不能依赖 viewport 字号缩放。
- 章节标签栏、工具按钮、节点端口等固定格式 UI 必须有稳定尺寸，避免 hover 或动态文案导致布局跳动。

## 5. Split 工作区

Split 是默认稳定入口，适合直接编辑完整 `.mdstory`。

必须保持：

- Monaco 显示全文件，而不是章节切片。
- 源文本编辑后通过 debounce 触发解析、诊断、Outline 和图更新。
- 分支图控件只出现在 Split 工作区内，不能泄漏到 Graph Lab 全局工具栏。
- 问题面板点击诊断后定位到 Monaco 对应行。

## 6. Graph Lab 工作区

Graph Lab 是正式图优先入口。它必须覆盖核心 GUI 操作：创建章节、创建节点、编辑正文、编辑变量、编辑条件和效果、连接节点、删除节点、保存布局、查看源码切片和导出。

### 6.1 章节标签栏

章节标签栏是 Graph Lab 的一级导航，必须始终可见。

- 位置：顶部命令栏下方独立一行。
- 每个 H1 章节对应一个 tab。
- 新增章节后，新 tab 必须立即出现并被选中。
- 当前 tab 使用明确选中态和 `aria-selected`。
- tab 显示章节标题、节点数和章节内诊断数。
- 多章节时支持横向滚动，不压缩到不可读。
- 空故事显示空态，不隐藏整行结构。

章节标签可见性是截图门禁。E2E 必须保存新增章节前后的标签栏截图和完整工作区截图，不能只检查 DOM 存在。

### 6.2 Source Drawer

Source Drawer 在 Graph Lab 中显示当前章节源码切片。Split 模式仍显示完整文件。

行为要求：

- 切片范围来自 `analyzeStorySource()` 的章节 offset range。
- 保存切片时通过 offset edit 映射回完整 `.mdstory`。
- 用户在 textarea 中修改切片后，状态显示未保存。
- 切换章节、Outline 跨章导航、创建新章节前，如果当前切片 dirty 且未 stale，自动保存后再继续。
- 如果当前切片 stale，阻止切换并提示用户先还原或重新载入，避免用过期 offset 覆盖完整源码。
- `Ctrl/Cmd+S` 保存当前切片；`Escape` 在 dirty 或 stale 时还原切片。

### 6.3 Inspector

Inspector 是 Graph Lab 的主编辑面板。

必须支持：

- 故事 title 和 author。
- 节点标题、章节、正文。
- 选项描述、目标、排序和删除。
- 条件字段化编辑。
- 效果字段化编辑。
- `vars:` 单文件全局变量的新增、修改和删除。

变量是当前 `.mdstory` frontmatter 的全局变量源。条件和效果下拉只能从已声明变量中选择，不引入数据库或隐藏项目状态。

### 6.4 流程节点与 `下一步`

无选项节点必须显示默认节点级连线口。用户从默认 handle 连线时写入：

```markdown
下一步: 节点：目标
```

如果节点存在任意普通选项，默认连线口隐藏，以普通选项作为显式出口。`下一步` 可带紧邻缩进 `效果:` 行。JSON schema 升级前，导出器将 `下一步` 投影为文本为 `下一步` 的无条件合成 option。

### 6.5 删除与危险操作

删除节点必须二次确认，并使用 i18n 文案。

- Delete/Backspace 快捷键不能在输入框、textarea 或 select 聚焦时触发。
- 确认后删除节点源码块和相关图状态。
- 取消确认不得改变源码。

## 7. 诊断体验

诊断分为 Error、Warning、Info 三层。

关键规则：

- E001 未定义目标节点阻断导出。
- E002 未声明变量阻断导出。
- W001/W002/I001 的图结构判断必须同时考虑普通选项边和 `下一步` 边。
- W007 检测由普通选项边和 `下一步` 边组成、没有外部出口的闭环。存在真实外部出口的回环不应报警。

Graph Lab 顶部诊断按钮必须可点击打开 ProblemPanel。章节 tab 上的诊断数只统计当前章节 source range 内的诊断。

### 7.6 节点卡片路线摘要

Graph Lab 节点卡片必须承担“流程性节点模块”的职责，而不是只显示标题和选项数量。用户在画布上编辑时，应能直接看到当前节点的出路、变量需求和结果预览。

卡片信息优先级：

- 第一优先级：节点标题、状态、章节或入口上下文。
- 第二优先级：路线摘要，包括普通 `[选项]`、node-level `下一步`、未连接态和终端态。
- 第三优先级：正文摘要。正文可以更短，但不能挤掉路线需求和结果。

路线摘要规则：

- 有普通选项时，每个选项显示一条路线行；无普通选项但有 `下一步` 时显示 `下一步` 路线行；无出路时显示终端或待连接状态。
- 每条路线行必须显示选项文本、变量需求 chip、目标预览 chip；存在效果时显示效果 chip。
- 简单条件显示为 `需 变量 操作符 值`。复杂逻辑条件显示 `复杂条件` 和相关变量名。不可解析条件保留 raw 文本作为 title/可访问文本。
- 效果预览显示前两个变量变化，超出后用 `+N` 汇总。raw 效果不可结构化时仍显示原文摘要。
- 目标可解析时显示目标节点标题；目标缺失显示 `目标缺失`；未连接显示 `待连接`；终端显示 `终端节点`。
- 默认最多展示 3 条路线，超出显示 `+N 条路线`；隐藏路线仍必须保留 React Flow source handle，避免已有连线丢失。

端口与交互：

- 左侧接入端口和无选项节点的默认 `next` 输出端口必须保持水平平行，且可见端口圆点必须落在卡片视觉边界内。
- 普通选项和默认 `next` 的输出端口必须与对应路线行垂直对齐。
- `next` 输出端口必须作为 `下一步` 路线行的一部分渲染，不得另起根级悬浮端口容器。
- 路线行右侧必须预留稳定端口槽。透明拖拽命中区可以略大，但不能造成端口像外挂临时控件。
- source handle id 不得改变：普通选项仍为 `option-{index}`，默认流程出口仍为 `next`。
- 路线摘要是只读预览。编辑仍通过 Inspector、画布连线和 Source Drawer 完成。

主题表现：

- 默认主题使用紧凑工作台控件语言，避免临时表单感。
- Narrative Workbench 作为默认主题时使用中性浅灰工具面，路线行是卡片核心信息。
- Engine Telemetry 使用克制遥测信号行：条件为琥珀门控，目标为青绿向量，缺失或错误为红色 fault 标记。
- 错误、缺失、警告不能只依赖颜色，必须同时有文字或形状差异。

E2E 和截图门槛：

- 覆盖含变量条件、效果和目标的节点卡片。
- 覆盖无普通选项但有 `下一步` 的流程节点。
- 覆盖多选项端口与路线行对齐。
- 覆盖 Engine Telemetry 下路线摘要可见、无重叠、无旧选项行退化。

### 7.7 Graph Lab Codex/macOS Visual Direction

Graph Lab V0.3 的视觉目标是“Codex + macOS 风格的次世代游戏叙事工具”。它应像长期生产环境中的原生编辑器，而不是彩色调试原型、营销页、游戏 HUD 或传统监控大屏。

核心原则：

- 低噪声：默认状态使用中性 surface、1px 分隔线、浅层阴影和系统字体；语义色只用于小面积状态点、focus ring、故障、警告和连接信号。
- 内容优先：节点标题、路线、条件、目标、效果是主信息；装饰性网格、发光、渐变和色块不得抢占阅读优先级。
- 原生工具感：章节 tab、按钮、输入框、Source Dock、Inspector section 使用 macOS 式紧凑控件语言，圆角保持 8-10px，避免卡片套卡片。
- 精密而克制：线缆和端口必须清晰可命中，但视觉点位要小，hover/focus 才增加强调；默认画布不使用大面积高饱和背景。

节点卡片规则：

- 卡片目标尺寸为 320 x 228px，布局常量、React Flow node wrapper 和官方主题卡片必须使用同一尺寸预算。
- 路线摘要表现为紧凑路线表，不再使用高饱和 chip 堆叠。条件、目标、效果以低饱和 token 呈现，仍保留可访问文本和 title。
- 普通选项端口与路线行中心对齐；无选项节点的 `next` 端口与左侧接入端口水平对齐，并内嵌在路线行右侧 gutter。
- 卡片外框负责裁切视觉溢出；端口 hover/focus 只能使用小面积 ring、微阴影或背景变化，不能用大面积强发光。
- 卡片内容不得溢出 React Flow 测量盒；截图不得只截到半张卡片，也不得出现端口漂浮在卡片外。

主题规则：

- Narrative Workbench 作为默认主题时，Graph Lab 应转向中性浅灰工具面，不再强化暖纸底色。
- Engine Telemetry 保留遥测语义，但视觉上采用克制深色生产工具：石墨画布、低亮度网格、少量青绿连接信号、琥珀条件门控、红色 fault。
- Engine Telemetry 不使用大面积荧光填充、强发光、装饰光球、玻璃拟态或紫蓝科幻渐变。

截图门禁：

- 默认主题和 Engine Telemetry 都必须保存 Graph Lab 工作区、节点卡片、Source Dock 展开和窄屏布局截图。
- 截图验收必须检查节点无几何重叠、路线文本无裁切、端口与路线行对齐、状态不只依赖颜色。

## 8. 主题系统

当前只支持官方主题：

- 内置官方主题随应用发布。
- 官方远程免费主题通过官方 registry 下载 `.pf-official-theme.zip`，校验后使用 `plotflow-theme://` 加载。
- 不开放第三方上传、社区市场、本地导入、购买或授权。
- 主题可以控制视觉、布局 recipe、React surfaces、React slots、Monaco 配色、CSS 和 assets。
- 主题不得改变 `.mdstory` 语义、保存流程、导出语义、parser、validator 或 Graph Lab 命令层。

Engine Telemetry 是官方主题之一。它可以改变 Graph Lab 外观、节点卡、线缆、Inspector 和 Source Drawer 视觉，但必须保留所有功能、i18n 和截图门禁。

## 9. 交互状态

全局状态：

| 状态 | 用户反馈 |
|---|---|
| 未保存 | Status Bar 和相关面板显示 dirty 状态 |
| 保存中 | 显示保存进行中反馈，避免用户重复触发 |
| 已保存 | 显示保存路径或同步状态 |
| 外部冲突 | 阻止 autosave 静默覆盖，提示 reload/save copy/overwrite |
| Source 切片 dirty | Source Drawer 显示未保存 |
| Source 切片 stale | 阻止切章和保存，提示还原或重新载入 |
| 诊断存在 | Toolbar、ProblemPanel、章节 tab 和节点状态同步反馈 |

Home 的 `Continue editing` 必须优先重新读取最近保存的 `.mdstory`。文件缺失、非法扩展或 hash 冲突必须明确反馈，不能静默回到 unsaved story。

## 10. 键盘与可达性

核心快捷键：

| 快捷键 | 行为 |
|---|---|
| Ctrl/Cmd+S | 保存当前文件；Source Drawer textarea 聚焦时保存当前章节切片 |
| Ctrl+Shift+G | 切换 Split 与 Graph Lab |
| Ctrl+E | 打开导出 |
| Ctrl+Shift+M | 打开问题面板 |
| Delete/Backspace | Graph Lab 中删除当前选中节点，输入控件聚焦时不触发 |
| Escape | 关闭弹层；Source Drawer dirty/stale 时还原切片 |

所有图标按钮必须有可访问名称或 title。章节 tab 使用 `role="tablist"` 和 `role="tab"`。

## 11. 文案规范

默认语言为中文，英文 UI 必须覆盖主路径。

文案原则：

- 状态反馈使用动词和对象，例如“已保存章节源码：第一章”。
- 错误提示给出下一步，例如“源码切片已变化。请先还原或重新载入后再切换章节。”
- 不在界面中解释技术实现或快捷键列表。
- 不混用中英文，除品牌名、文件格式、Graph Lab、Source Drawer 等产品术语外。

## 12. E2E 与截图门槛

源码态 Graph Lab E2E 必须覆盖：

- 章节 tab 可见性和新增章节截图。
- Source Drawer 当前章节切片保存。
- dirty 切片切章自动保存。
- stale 切片阻止切章。
- Palette 创建章节前保存 dirty 切片。
- Delete/Backspace 删除确认 i18n。
- 变量新增后进入条件和效果下拉。
- `下一步` 默认流程出口写回。
- W007 闭环诊断。
- Engine Telemetry 主题下 Graph Lab 仍可读可操作。

截图验收必须检查：

- locator 可见。
- bounding box 尺寸合理。
- 截图文件非空。
- 截图中可看到章节标签栏和当前选中 tab。

## 13. 发行状态口径

文档和报告不得把源码 E2E 通过写成 release-candidate passed。

状态词使用：

- Integration passed：只代表 `test:e2e` 通过。
- Source blackbox passed：代表源码构建黑盒通过。
- Unpacked blackbox passed：代表 `release/win-unpacked/PlotFlow.exe` 通过。
- Installed blackbox passed：代表新安装路径通过。
- Release candidate passed：必须 package、unpacked、installed、manual patrol 全部通过。

当前 Graph Lab UX 基础验收可作为源码层通过；最新源码变更后，旧 package/unpacked/installed 证据需要刷新。

## 14. 反目标

PlotFlow 不做以下事情：

- 不引入数据库作为 `.mdstory` 内容真相源。
- 不把 Graph Lab 变成专有二进制格式编辑器。
- 不让主题改变剧情语义或保存/导出行为。
- 不用装饰性 hero、营销卡片或大型插画占据编辑器首屏。
- 不在组件中硬编码色值。
- 不通过 DOM 存在断言替代用户可见性验证。

## 15. 相关规范

- 语法规范：`spec/syntax-formal.md`
- JSON schema：`spec/json-schema.md`
- 发行门禁：`spec/release-blackbox-gate.md`
- 主题开发标准：`doc/standards-theme-development.md`
- 进度状态：`spec/progress.md`

本文件是 PlotFlow 编辑器 UX 设计的当前权威来源。实现、测试和审计发现冲突时，以本文件和对应技术规格的最新版本为准。
