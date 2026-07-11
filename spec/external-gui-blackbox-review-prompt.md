# PlotFlow 外审 GUI 严格黑盒验收提示词

> 适用构建：Git `d5a9e4bd2c05532b428e645e8f0bd7a90788d2bb`
>
> 安装包：`PlotFlow Setup 0.1.0.exe`
>
> SHA256：`CB8C6FF25DD464279D9E2B1F88ECFFAF58D64D97CE2994A9F2B5E040633BD456`
>
> 签名状态：`NotSigned`（这是已知发行阻断项，不得据此宣称公共正式发行完成）

## 可直接复制给外审执行者的提示词

你是 PlotFlow 的独立 GUI 黑盒验收工程师。请在全新 Windows 本地用户或干净 Windows VM 中，仅通过已安装应用的可见 GUI、键盘、鼠标、Windows 原生文件对话框和资源管理器执行验收。

### 黑盒边界

- 禁止阅读或推断源码、测试代码、内部 Store、IPC、DevTools、日志实现和数据库状态。
- 禁止使用 Playwright 测试桥、Electron 调试端口、DOM 注入、脚本点击、接口 mock 或直接修改 userData。
- 禁止用 Split/Source Drawer 代替受支持的 Graph Lab GUI 功能；只有专门验证透明性、恢复能力或模式持久化时才可进入这些源码工具。
- 所有保存、打开和导出必须经过应用可见入口及 Windows 原生对话框；导出结果必须从磁盘重新读取验证。
- 不接受“按钮存在”作为通过证据；每项必须验证可观察结果、磁盘结果或重启后的持久状态。
- 测试中不得修复产品缺陷或改变系统安全设置。遇到崩溃、数据丢失、错误导出或无法恢复的阻断时立即保全证据。

### 前置核验

1. 校验安装包 SHA256 与本提示词一致，记录 Windows 版本、显示缩放、分辨率、系统语言和测试账号。
2. 完成安装后记录实际 `PlotFlow.exe` 路径、文件版本、Authenticode 状态和“应用和功能”卸载条目。
3. 首次启动前确认该 Windows 用户从未运行 PlotFlow；不要复制既有配置。
4. 开启全程屏幕录制，并为每个失败保留步骤前后截图、输入文件和输出文件。

### 必测连续主旅程

在同一连续录制中完成以下步骤，不得借助测试桥：

1. 首次启动，确认 Home 可用；新建故事后默认进入 Graph Lab，Split 与 Graph Lab 顶栏入口同级可见。
2. 仅用 Graph Lab GUI 创建至少两个章节、六个节点、同名跨章节节点、普通选项、跨章节选项和节点级“下一步”。
3. 编辑故事标题、作者和 `engine`；创建 `int/float/bool/string/enum/object` 六种变量，包含 enum 项、chapter scope 与三层 object 字段。
4. 创建三层 AND/OR/NOT 条件，至少包含一次 literal-left 比较（如 `5 < $金币`），并为普通选项和节点级“下一步”添加效果。
5. 执行节点重命名、拖动、连线和整图布局；逐项验证 Undo/Redo，确认一次拖动或布局只占一个历史步骤。
6. 通过搜索定位另一个章节的节点，验证切章、选中、居中和 Inspector 打开；搜索不得改变故事内容或触发布局。
7. 制造 Error 级诊断，确认 JSON/HTML/TXT 全部被阻断且不会打开原生保存对话框；从诊断入口定位并仅用 GUI 修复。
8. 使用原生对话框保存 `.mdstory`，关闭应用并重启；通过 Continue 继续编辑，确认内容完整且会话历史已清空。
9. 重启后进行一次新的编辑、Undo、Redo 和保存；分别导出 JSON、HTML、TXT 到磁盘。
10. 从磁盘核验：JSON `$schema` 为 `https://plotflow.dev/schema/0.2/story.json`，`targetChapterId` 必填可空，FullID 为规范编码形式，空 object 输出 `fields: {}`，章节变量和所有效果未丢失；HTML 可运行，TXT 内容完整。
11. 显式切换到 Split 并重启，确认用户选择被持久保留；再切回 Graph Lab 并确认故事无损。
12. 从资源管理器双击有效 `.mdstory`，验证运行中和冷启动打开；再尝试打开不存在或无权限文件，确认本地化错误保留路径和错误代码。

### 键盘与辅助技术

- 全程补做纯键盘旅程：章节 Tabs 的 Left/Right/Home/End，节点菜单的 ContextMenu 键或 `Shift+F10`、Up/Down/Home/End、Enter/Space、Escape。
- 使用 `Ctrl/Cmd+K` 搜索节点；验证 combobox 标签、结果数量 live region、方向键、Escape 和关闭后的焦点恢复。
- 用键盘打开/关闭 Palette、Inspector、Source Drawer、诊断和 ConditionEditor；关闭后焦点必须回到触发器或目标节点。
- ConditionEditor 验证 dialog 语义、初始焦点、Tab/Shift+Tab 循环、Escape、左右操作数可访问名称，以及 AND/OR/NOT 的 pressed 状态。
- 使用 Windows Narrator 抽查主要命令、图标按钮、节点、章节和诊断；不得出现无名称按钮或混合语言。

### 响应式与视觉

分别在 1440×900、1280×720、1180×720、1179×720、901×720、900×720 和尽可能接近 390×844 的窗口尺寸验收：

- 1180px 为完整三栏；1179px 与 901px 为紧凑三栏；900px 及以下为 Canvas-first 互斥侧边抽屉。
- 不得出现窗口级横向滚动、抽屉重叠或 Source Drawer 超出视口。
- 900px 以下主要命令和关闭按钮应具备约 44×44px 的可点击区域。
- 记录 Prism Foundry 在中英文、默认、密集 Inspector、条件、诊断、Source Drawer 和空状态下的截图；同时抽查 Narrative Workbench 与 Engine Telemetry。
- 检查节点 Grip、grab/grabbing、选中、诊断层级、成功状态和 reduced-motion，不以个人审美替代可用性判断。

### 大图与恢复性

- 分别打开 100、500、1000 节点故事，记录从打开到 Graph Lab 可交互的时间、搜索定位时间、缩放/平移和导出表现。
- 在 1000 节点故事中搜索并居中目标节点，确认没有自动重新布局或文本修改。
- 验证未保存关闭提示、取消关闭、外部文件冲突、保存副本、空文件、仅 frontmatter、CRLF、Unicode 路径和同章节 ID 的跨故事替换。
- 如果发生崩溃或无响应，记录 Windows 事件、持续时间和最后一个用户动作，但不得用内部实现推测根因。

### 缺陷与结论格式

每个缺陷必须包含：`ID`、`P0/P1/P2/P3`、环境、前置条件、逐步复现、预期、实际、复现率、视频时间点、截图、输入/输出文件、是否造成数据丢失以及建议的最小复测范围。

最终输出以下独立结论：

1. `GUI 外审：PASS / PASS WITH ISSUES / FAIL`
2. `Graph-first 主闭环：PASS / FAIL`
3. `键盘与辅助技术：PASS / FAIL`
4. `响应式与视觉：PASS / FAIL`
5. `安装包完整性：PASS / FAIL`
6. `可进入代码外审：YES / NO`
7. `可作为 RC：YES / NO`
8. `可公共正式发行：NO`，直到 installed blackbox、真实引擎 smoke、30 分钟人工巡检和 Authenticode 全部有独立通过证据。

任何 P0、数据丢失、Error 诊断仍可导出、磁盘往返不一致、默认未进入 Graph Lab、严格主旅程依赖 Split/测试桥，均必须判定 Graph-first 主闭环失败。
