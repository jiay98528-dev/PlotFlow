# Fablevia（维叙）编辑器 UX 设计简报

> 品牌展示合同：中文界面以“维叙”为主名、`Fablevia` 为小字辅助，读屏名为“维叙（Fablevia）”；英文界面只显示 `Fablevia`。沿用现有软件图标，移除 `PF` 文字标记。

> 版本：V0.3
> 更新日期：2026-07-12
> 状态：当前 UX 设计唯一真相源
> 范围：Fablevia（维叙）桌面编辑器、Split 工作区、Graph Lab、Source Drawer、主题系统、导出和发行验收口径。
> 默认工作区决策：Graph Lab 是主要且默认工作区；Split 顶栏并列保留为辅助与高级源码投影。详见 `doc/adr/ADR-012-graph-lab-default-workspace.md`。

## 1. 产品定位

Fablevia（维叙）是面向独立游戏开发者的本地优先叙事分支管理工具。用户默认在 Graph Lab 以流程图优先的完整 GUI 工作流搭建、检查和调整剧情结构，也可以切换到 Split 直接编辑完整 `.mdstory` 源文本。`.mdstory` 始终是唯一磁盘真相源，所有 GUI 操作都必须写回同一个纯文本文件；文件真相源不等于文本编辑器是默认 UX。

核心体验目标：

- 叙事设计师无需先学习 Markdown 方言，即可在 Graph Lab 中完成节点、选项、条件、效果、变量和章节的主路径编辑。
- 文案策划和高级用户仍能在 Split 中直接编辑完整 Markdown 方言，不被图形工具锁死。
- 程序能拿到稳定 JSON/HTML/TXT 导出，不依赖专有数据库。
- 发行版必须离线可用，不强制联网，不上传用户内容。

## 2. 目标用户与使用场景

首要用户是 1 到 5 人独立游戏团队中的叙事设计师、文案策划和程序开发者。典型场景是：用户打开或创建一个 `.mdstory` 文件，默认进入 Graph Lab，通过画布和 Inspector 编排分支、修复诊断并导出 JSON 给引擎运行；需要查看或精确编辑完整源码时再切换到 Split。

Graph Lab 不替代 `.mdstory` 文件真相源，但替代 Split 成为默认用户体验，让“不想手写语法”的用户也能完成核心闭环。Split 始终在顶栏并列可达，用于查看或编辑完整文件；Graph Lab Source Drawer 只承担当前章节切片的辅助编辑。

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
- 左侧 rail 是全局编辑区，依次包含快速创建、章节 Outline、故事/变量编辑与折叠的工作区浏览器。
- 中间 React Flow 画布显示当前章节图。
- 右侧 Inspector 只编辑当前节点及其下一步、选项、条件和效果。
- 底部 Source Drawer 编辑当前章节源码切片。

## 4. 视觉原则

Fablevia（维叙）的视觉风格应安静、清晰、工作导向。它是叙事生产工具，不是营销页面。

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

## 5. Split 辅助源码工作区

Split 是稳定的辅助与高级源码投影，适合直接编辑完整 `.mdstory`。它在顶栏与 Graph Lab 并列可达，但不是首次启动、新建、打开或继续编辑的默认落点。

必须保持：

- Monaco 显示全文件，而不是章节切片。
- 源文本编辑后通过 debounce 触发解析、诊断、Outline 和图更新。
- 分支图控件只出现在 Split 工作区内，不能泄漏到 Graph Lab 全局工具栏。
- 问题面板点击诊断后定位到 Monaco 对应行。

## 6. Graph Lab 工作区

Graph Lab 是主要且默认的正式图优先工作区。首次启动、旧偏好一次性迁移、新建、打开、命令行打开和 Continue editing 默认进入 Graph Lab。它必须覆盖核心 GUI 操作：创建章节、创建节点、编辑正文、编辑变量、编辑条件和效果、连接节点、删除节点、保存布局、查看源码切片和导出。

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

### 6.3 Inspector 与全局编辑区

右侧 Inspector 是 Graph Lab 的当前节点编辑面板，使用静态“节点”上下文标题，不使用只有一个项目的伪标签栏。选中节点后，节点字段、默认“下一步”、选项、条件和效果必须在同一滚动流中连续出现，避免把同一节点的路线操作割裂为另一层语义。

左侧 rail 的全局编辑区使用“故事｜变量”标签，承载不依赖当前节点选择的故事 frontmatter 和顶层变量编辑。未选节点时，这两个全局编辑路径仍必须完整可用。标签遵循标准 roving tabindex 模型：`ArrowLeft` / `ArrowRight` 循环切换并移动焦点，`Home` / `End` 跳到首尾，非激活标签不能因 `tabIndex=-1` 而失去键盘进入路径。

必须支持：

- 故事 title、author 和 engine。engine 下拉只显示 `generic | godot | unity | unreal`；`generic` 导出为 JSON 0.2 的 `none`，UI 不展示 JSON 专用值 `none`。
- 系统管理的 `plotflow` schema 版本只读显示为 `0.1`，不得由 Inspector 修改。
- 节点标题、章节、正文。
- 选项描述、目标、排序和删除。
- 条件字段化编辑。
- 效果字段化编辑。
- Inspector 内的效果编辑器必须按面板实际可用宽度收敛，而不是按窗口宽度猜测。变量、操作、值、删除与提交操作均不得被 Inspector 的局部滚动容器裁切；效果值输入聚焦时，`Enter` 必须与可见提交按钮调用同一提交路径。
- `vars:` 顶层变量的新增、修改和删除，包括完整类型、默认值、description、scope，以及 chapter scope 的章节选择。

变量声明集中存放在当前 `.mdstory` frontmatter，不引入数据库或隐藏项目状态。顶层省略 scope 时视为 global；选择 chapter scope 后必须选择真实章节，切回 global 必须清除旧 `chapter`。chapter-scoped 值随故事会话持久化，但仅在归属章节的节点、条件和效果上下文中可见；其他章节的下拉不得暴露该变量。object 嵌套 fields 继承顶层 scope/chapter，Inspector 不提供字段级 scope/chapter 控件。

条件编辑器对合法 Condition AST 必须无损往返。JSON 0.2 Comparison 使用 typed `left/right` operands：variable operand 显示变量/字段选择器，literal operand 显示按变量类型约束的值控件。导入历史 0.1 `variable/value` Comparison 时先在读取边界规范化为 typed operands，编辑和后续导出均使用 0.2；损坏或未知语法才进入只读保留态并引导源码修复。条件内的变量和运算符下拉必须作为顶层浮层渲染，不能被 Inspector 或条件容器裁切；浮层随触发器重定位，外点与 Escape 可关闭，Escape 恢复触发器焦点。当条件编辑器以 `aria-modal` 对话框打开时，Portal 菜单必须纳入同一可访问焦点域：运算符选项可由键盘直接进入和选择，`Tab` / `Shift+Tab` 不得越过菜单进入背景界面。

节点和目标身份遵循 ADR-013：canonical FullID 由 core 以 encoded-slash 组件生成并作为 opaque key 使用。UI 只显示可读的“章节 / 节点”标签，不展示百分号编码，也不得拆分 FullID 反推章节。旧 hyphen layout 只有唯一匹配时才恢复坐标；碰撞时显示可操作的歧义诊断，引导用户 Relayout 或拖拽，不静默猜测。

### 6.4 流程节点与 `下一步`

无选项节点必须显示默认节点级连线口。用户从默认 handle 连线时写入：

```markdown
下一步: 节点：目标
```

如果节点存在任意普通选项，默认连线口隐藏，以普通选项作为显式出口。`下一步` 可带紧邻缩进 `效果:` 行。JSON Schema 0.2 中，导出器将 `下一步` 投影为文本为 `下一步` 的无条件合成 option，并显式输出可空的 `targetChapterId`、`targetNodeId` 与 canonical opaque `targetFullId`。

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
- 默认 `下一步` 路线必须明显区别于普通选项：它是低强调的流程续接轨道，不使用选项卡片的表面、阴影和交互暗示；仍保留“下一步”可访问名称、目标预览和 `next` handle。

端口与交互：

- 左侧接入端口和无选项节点的默认 `next` 输出端口必须保持水平平行，且可见端口圆点必须落在卡片视觉边界内。
- 普通选项和默认 `next` 的输出端口必须与对应路线行垂直对齐。
- `next` 输出端口必须作为 `下一步` 路线行的一部分渲染，不得另起根级悬浮端口容器。
- 路线行右侧必须预留稳定端口槽。透明拖拽命中区可以略大，但不能造成端口像外挂临时控件。
- source handle id 不得改变：普通选项仍为 `option-{index}`，默认流程出口仍为 `next`。
- 路线摘要是只读预览。编辑仍通过 Inspector、画布连线和 Source Drawer 完成。

主题表现：

- 默认主题使用紧凑工作台控件语言，避免临时表单感。
- Prism Foundry 作为默认主题时使用冷白棱镜工作面，路线行是卡片核心信息；Narrative Workbench 保持可选的中性浅灰工作面。
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

- Prism Foundry 作为默认主题时，Graph Lab 应呈现冷白、淡薰衣草和小面积棱镜折射，不再强化暖纸底色；Narrative Workbench 维持其中性浅灰工具面。
- Engine Telemetry 保留遥测语义，但视觉上采用克制深色生产工具：石墨画布、低亮度网格、少量青绿连接信号、琥珀条件门控、红色 fault。
- Engine Telemetry 不使用大面积荧光填充、强发光、装饰光球、玻璃拟态或紫蓝科幻渐变。

截图门禁：

- Prism Foundry、Narrative Workbench 和 Engine Telemetry 都必须保存 Graph Lab 工作区、节点卡片、Source Dock 展开和窄屏布局截图。
- 截图验收必须检查节点无几何重叠、路线文本无裁切、端口与路线行对齐、状态不只依赖颜色。

### 7.8 Global UX Finish Rules

本节是 2026-07-10 全局 UX 完成度修复的权威口径。实现时优先保证工作台层级、控件状态、可读性和截图可验收，不通过装饰性视觉效果掩盖结构问题。

- Home Surface 必须是独立启动/工作台 surface。打开时不得透出底层 Split、Graph Lab、minimap、Status Bar 或其他 workspace 控件；内容应以继续编辑、新建、打开、模式入口、主题入口和当前文件状态为主，不做营销 hero。
- Graph Lab 采用固定 AppShell 内部布局。顶部命令栏、三栏工作区、Inspector、Source Dock 和 ProblemPanel 必须各自局部滚动，`documentElement` 不应成为主滚动容器。
- Graph Lab 默认视距必须保证节点卡片的路线摘要可读。初始视图优先居中 active node 或第一节点，默认缩放约 0.78；fit-all 只能作为用户可触发的导航能力，不能让主信息长期缩到不可读。
- 诊断反馈不得遮挡主导航。画布内部只允许低噪声状态条或入口提示；完整诊断列表放在底部 ProblemPanel dock 中，使用图标、代码、文本和形状共同表达 severity，不使用大面积红色横幅或 emoji。
- Source Dock 打开后必须稳定占据底部 grid 区域，不压断 Inspector 表单和保存/删除等操作按钮；Source Dock 内部诊断行应低噪声、可点击、可键盘聚焦。
- Home 与 Theme Center 的每个内置主题预览必须使用真实的主题节点、连线和画布组件渲染，禁止以手绘 SVG 或仿制节点占位；预览按该主题自身 token 隔离，不能被当前激活主题污染，也不得反向修改故事、选择或画布状态。底部 footer 是正常 panel row，不得覆盖列表内容。
- 所有 Graph Lab 控件必须具备 default、hover、focus-visible、active、disabled 状态；icon-only 控件必须有 `aria-label`，仅有 `title` 不足以通过验收。
- Engine Telemetry 保留深色遥测身份，但必须降噪：青绿只用于连接信号和 focus，琥珀只用于条件/警告，红色只用于 fault；禁止强发光、大面积高饱和色块、装饰 blur 或 HUD 化背景。
- 截图门禁必须覆盖 Home、Graph Lab 默认主题（Prism Foundry）、Narrative Workbench、Engine Telemetry、Source Dock 展开、ProblemPanel 打开、Theme Center；验收时检查无底层泄漏、无文本裁切、无控件遮挡、无窗口级滚动、节点路线摘要可读。

### 7.9 Prism Foundry 液态玻璃亮色主题

Prism Foundry（棱镜铸造台）是内置官方亮色主题与新安装默认主题。它服务于在明亮工作室中长时间编排复杂剧情拓扑的叙事设计师，应像一座由冷白玻璃、棱镜折射和精密圆角卡片构成的制作舱，而不是营销页、游戏 HUD 或泛化浅色 SaaS 看板。

- 材质层级：Topbar、Rail、Inspector、Theme Center 和结构性 Dock 使用半透明液态玻璃；Monaco、输入控件、Source Drawer 正文、节点正文和路线行保持高不透明阅读面。禁止在 React Flow 画布、每张节点卡片或每条路线行上使用 `backdrop-filter`。
- 颜色角色：珍珠冷白与淡薰衣草建立空间层次，紫罗兰仅用于主操作、选择和 focus，青色仅用于连接信号，琥珀与红色仅用于条件、警告与错误。状态必须同时使用文字、图标或形状表达。
- 卡片与布局：节点继续遵守 320 x 228px 尺寸预算、10px 圆角与既有 Handle 对齐规则。Graph Lab 必须保留 commandbar、palette、canvas、inspector、sourceDrawer 五个 `.graph-lab` 直系业务节点；主题只重排和包裹现有业务内容，不吞掉 controls。
- 动效：按压反馈为 120ms，hover、选择、端口可连接与连线悬停反馈为 180ms，抽屉、Theme Center 与弹层揭示为 240ms，统一采用指数缓出。仅动画 transform、opacity、color 和 shadow；节点高光优先使用伪元素的 opacity 与 transform，不插值节点 shadow。禁止布局属性动画、持续背景漂移、连续流光、画布级动画、画布滤镜和逐节点 filter 动画。
- 可访问性与性能：所有主题控件提供 default、hover、focus-visible、active、disabled 状态，普通正文及其相邻阅读面实际对比度至少 4.5:1，focus ring 相对相邻表面至少 3:1。错误与警告必须同时具有文本、图标、轮廓或形状等非颜色线索。`prefers-reduced-motion: reduce` 下关闭主题自有的空间位移、端口伪元素、节点选中、Theme Center、Source Drawer 与其他 Prism 控件的非必要过渡或持续动画。玻璃滤镜仅用于静态外壳层，并必须提供高不透明 `@supports` 回退。
- 默认与迁移：新安装、未知主题回退与旧通用 `light` / `dark` 偏好均进入 Prism Foundry；已保存的正式主题 ID 保持用户选择不变。

#### 7.9.1 满分化验收门禁

- 视口：1440 x 900、1280 x 720 与 390 x 844 的 Prism Foundry 截图必须在禁用动画后稳定可回归。390 x 844 下 `documentElement` 不得出现窗口级横向滚动，命令栏、章节标签、画布入口、Inspector 操作与 Source Drawer 开关仍须可见、可聚焦且不被遮挡。
- 动效：验收应同时覆盖按压、hover/选择、面板揭示、节点选中、端口可连接和连线悬停；只允许上述 120/180/240ms 指数缓出反馈。减少动态偏好下断言所有主题空间位移均为零，且不存在连续流光或其他持续性装饰动画。
- 可访问性：以 Prism 实际 CSS token 与真实渲染元素计算正文、次要文本、主操作、错误、警告与 focus ring 的对比度；正文门槛为至少 4.5:1，焦点门槛为至少 3:1。E2E 必须验证错误/警告的文字、图标或轮廓线索，而非仅颜色差异。
- 大图性能：在 200+ 节点图中，React Flow 画布、节点与连线不得存在 `filter` 或 `backdrop-filter`。拖拽、平移、连线和主题切换不得产生运行时错误；100、500、1000 节点的打开与进入 Graph Lab 继续遵守既有黑盒性能预算。

### 7.10 Graph Lab P2 结构与可靠性合同（实施中）

本节是 Graph Lab P2 的实现合同。它沿用 Prism Foundry 视觉语言，不重新探索视觉方向；当前状态为实施中，只有实际通过的自动或人工门禁才能进入第 13 节的发行证据。

- 模式切换：Toolbar、菜单和快捷键统一调用 `requestWorkspaceMode(mode)`。Graph → Split 前先处理 Source Drawer；dirty 切片必须先提交到内存 `.mdstory` 文本，stale 切片必须阻断切换并保留草稿与恢复操作。
- 故事会话：新建、打开、命令行打开、Continue 和外部重载均开始新的递增 `storySessionId`。变量草稿按会话重置；效果草稿按会话、节点 FullID 和路线 identity 重置，禁止跨故事或选项重排串用。
- 信息架构：第一行 Command Bar 只承载故事标题、节点搜索、诊断、Undo/Redo、保存和 Source 操作；第二行只承载可横向滚动的章节标签。Palette 顺序为快速创建、章节大纲、故事/变量全局编辑、折叠的工作区浏览器，不重复故事 hero。Inspector 是单一“节点”上下文，连续承载节点字段、下一步和选项路线。
- 节点搜索：`Ctrl/Cmd+K` 打开非模态 combobox，匹配节点标题、ID、正文和选项文字。结果显示章节与最高诊断级别；Enter 切章、选中、打开节点 Inspector 并居中到可读缩放，不得重新布局或修改 AST。画布直接点击节点只改变选择，绝不自动平移、缩放或重新居中。方向键、Escape、无结果状态和焦点恢复均为必需状态。
- 响应式：`≥1180px` 使用完整三栏；`901–1179px` 使用紧凑三栏且 Inspector 表单单列化；`≤900px` 使用 canvas-first，Palette 与 Inspector 变为互斥侧边抽屉，不能堆叠到画布下方。Source Drawer 始终是受视口高度约束的底部工具，不与侧边抽屉重叠。
- 节点拖动：卡片 header 提供统一 Grip、grab/grabbing 光标、本地化名称和拖动状态；输入、端口和按钮继续使用 `nodrag`。非交互 header 区域仍可拖动。
- 层级与动效：新增 dropdown、canvas overlay、panel、modal 语义层级 token，禁止任意 z-index、fallback z-index 和组件内联层级。状态过渡保持 150–250ms 指数缓出；reduced-motion 下移除非必要空间位移。
- 右键菜单：节点、连线和画布右键菜单必须可由菜单外主键点击关闭，且不能阻断该次画布操作；Escape 关闭后回到原触发控件。菜单保留 Arrow/Home/End 和菜单项操作，不产生持久浮层。
- 导出反馈：导出成功后对话框可关闭，但应用状态区必须保留成功状态与目标路径，直到下一次用户操作；取消或失败不得伪装为成功。
- i18n：GraphCanvas、GraphContextMenu、ConditionEditor、Outline、Source Drawer、外部冲突、诊断与状态反馈必须使用统一字典。UI 字面量门禁仅检查 JSXText、`title`、`aria-label`、`placeholder` 以及明确的状态/对话框参数，并对白名单产品名、格式名与 schema 枚举放行。
- 视觉验收：1440×900、1280×720、900×720、390×844 均不得出现窗口级横向滚动。窄屏首屏保留可用画布；Palette、Inspector 和 Source Drawer 均可由键盘打开、关闭且不重叠。

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
| Ctrl/Cmd+K | 打开 Graph Lab 节点搜索；选择结果只聚焦节点，不修改 AST 或布局 |
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
- Unpacked blackbox passed：代表 `release/win-unpacked/Fablevia.exe` 通过。
- Installed blackbox passed：代表新安装路径通过。
- Release candidate passed：必须 package、unpacked、installed、manual patrol 全部通过。

ADR-013 的 FullID、旧布局迁移、Schema 0.2、chapter 变量可见性与严格 packaged/unpacked Graph-first journey 已通过当前自动化验收，包括磁盘 JSON Ajv 校验。installed 黑盒、30 分钟人工巡检、真实引擎工具链 smoke 与 Authenticode 仍待完成；在这些门禁全部通过前不得使用 release-candidate-passed 或公共正式发行口径。

## 14. 反目标

Fablevia（维叙）不做以下事情：

- 不引入数据库作为 `.mdstory` 内容真相源。
- 不把 Graph Lab 变成专有二进制格式编辑器。
- 不让主题改变剧情语义或保存/导出行为。
- 不用装饰性 hero、营销卡片或大型插画占据编辑器首屏。
- 不在组件中硬编码色值。
- 不通过 DOM 存在断言替代用户可见性验证。

## 15. 相关规范

- 语法规范：`spec/syntax-formal.md`
- JSON schema：`spec/json-schema.md`
- 身份与导出 ADR：`doc/adr/ADR-013-fullid-schema-02.md`
- 发行门禁：`spec/release-blackbox-gate.md`
- 主题开发标准：`doc/standards-theme-development.md`
- 进度状态：`spec/progress.md`

本文件是 Fablevia（维叙）编辑器 UX 设计的当前权威来源。实现、测试和审计发现冲突时，以本文件和对应技术规格的最新版本为准。
