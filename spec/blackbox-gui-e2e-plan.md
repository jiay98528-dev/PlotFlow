# PlotFlow 黑盒 GUI E2E 全面测试计划

> 状态：已部分实施；发行门禁权威见 `spec/release-blackbox-gate.md`
> 创建日期：2026-06-28
> 定位：release/nightly 手动门禁计划，不替代现有集成 E2E
> 计划命令：`pnpm.cmd --filter @plotflow/app test:e2e:blackbox`

> 2026-06-30 更新：黑盒套件已扩展为 source / unpacked / installed 三类启动目标。`test:e2e:blackbox` 只代表源码构建产物黑盒通过；正式发行必须继续跑 `test:e2e:unpacked` 和 `test:e2e:installed`，并按 `spec/release-blackbox-gate.md` 记录结果。

> 2026-07-06 更新：外审 P0/P1 回归必须覆盖 Home `Continue editing` 最近文件恢复、Graph Lab `vars:` 全局变量闭环、`下一步` 流程出口、W007 闭环循环诊断、章节标签栏截图验证、Source Drawer 章节源码切片。章节标签可见性不能只靠 DOM locator，必须有截图附件。

> 2026-07-10 更新：ADR-012 将 Graph Lab 设为主要且默认工作区。默认闭合旅程必须全程通过 Graph Lab 完成新建/打开、GUI 编辑、保存、重启/Continue editing、撤销重做、诊断与真实导出，不得进入 Split；Split 只作为并列保留的辅助源码路径单独回归。

## Summary

- 新增独立黑盒测试套件，不重构现有 38 项 E2E；现有套件继续作为集成回归，黑盒套件作为 release/nightly 手动门禁。
- 黑盒定义：禁止 `__test_store__`、`window.plotflow` 直接调用、IPC handler mock、localStorage 状态注入、store/DOM 状态注入；只允许真实键鼠、菜单快捷键、可见 UI、真实文件系统、命令行文件打开、官方 registry 本地 HTTP fixture、Windows OS 级原生对话框自动化。
- 目标覆盖：Graph-first 默认闭合用户旅程、极端边界条件、性能基线、主题远程下载、文件读写导出、Split 辅助源码入口和错误恢复。
- 测试定位：`pnpm --filter @plotflow/app test:e2e:blackbox` 手动或 nightly 跑完整套件；后续可再抽核心 smoke 进入 PR 门禁。

## Key Changes

- 新增黑盒测试目录与脚本：
  - `packages/app/e2e-blackbox/`：只放严格黑盒 GUI 测试。
  - `packages/app/e2e-blackbox/fixtures/`：生成/存放空文件、小文件、Unicode 路径、100/500/1000 节点、接近 10MB 上限、非法扩展名等真实文件。
  - `packages/app/e2e-blackbox/helpers/`：Electron 启动、Windows 原生对话框 UIAutomation、文件断言、本地官方 registry HTTP server、性能计时、截图/日志采集。
  - `packages/app/e2e-blackbox/playwright.config.ts`：单 worker、较长 timeout、trace/video/screenshot retain-on-failure。
  - `packages/app/package.json` 增加 `test:e2e:blackbox`，根 `package.json` 可选增加代理脚本。
- Windows 原生对话框自动化：
  - 用 PowerShell + .NET UIAutomation 控制“打开/保存/导出/选择文件夹”对话框。
  - 通过窗口标题、文件名输入框、确认按钮定位；失败时截图并输出当前可见窗口树。
  - 不改主进程 IPC，不替换 Electron dialog，不 mock `file:*` handler。
- 黑盒约束写入测试 helper：
  - 禁止 helper 暴露 `page.evaluate()` 读取/修改 app 状态。
  - 允许 `page.locator/getByRole/getByTestId` 检查可见 UI。
  - 允许使用命令行参数启动真实 `.mdstory` 文件，验证系统打开文件链路。
  - 允许读取磁盘输出文件验证保存/导出结果。
  - 允许用本地 HTTP server 模拟官方 registry，因为这是外部网络边界，不是 app 内部状态。

## Test Scenarios

### 闭合旅程 1：新建到导出

- 冷启动进入 Home。
- 通过“新建故事”创建模板故事。
- 断言新建后默认进入 Graph Lab；使用 Palette 创建节点、Inspector 编辑正文与选项，并拖线连接目标，全程不进入 Split。
- 通过 Graph Lab 命令或系统菜单执行撤销/重做，验证画布、Inspector 和源码投影一致。
- `Ctrl+S` 首次触发另存为对话框，用 OS 自动化保存到真实 `.mdstory`。
- 关闭并用命令行参数重新打开该文件，断言仍直接进入 Graph Lab，验证内容、图、诊断、布局仍一致。
- 从 Home 使用 Continue editing 重载最近文件，断言直接进入 Graph Lab 且从磁盘恢复。
- 通过导出对话框分别导出 JSON/HTML/TXT，验证文件存在、格式可读、核心内容一致。

### 闭合旅程 2：已有文件编辑回写

- 以命令行参数打开 `valid-story.mdstory`。
- 断言默认进入 Graph Lab，通过画布与 Inspector 完成重命名、删除、连接、缩放和重置布局。
- `Ctrl+S` 保存，读取磁盘确认 `.mdstory` 被真实修改。
- 重启再次打开确认修改持久化。
- 显式切换到 Split，验证完整 `.mdstory` 源码与 Graph Lab 编辑结果一致；该步骤仅验证辅助投影，不计入默认闭环。

### 闭合旅程 3：Graph Lab 高级图优先闭环

- 从 Home 选择真实工作区文件夹并打开工作区内 `.mdstory`，断言自动进入 Graph Lab。
- 使用 palette 创建章节、节点、结局；拖拽节点改变 layout；拖线连接/断开；Source Drawer 展开查看文本。
- 新增章节后验证顶部章节 tab 可见、选中态正确，并保存 tab bar/完整工作区截图。
- Source Drawer 在 Graph Lab 中只显示当前章节源码切片；编辑切片后直接读取磁盘并重启确认完整文件映射正确，不依赖 Split 完成验收。
- 新增/删除 frontmatter `vars:` 变量后，在条件和效果编辑器下拉中选择该变量并确认源码写回。
- 无选项节点从默认 handle 连线写入 `下一步`；新增普通选项后默认 handle 隐藏。
- 构造 A→B→A、A→B→C→A 和带外部出口回环，验证 W007 只提示无外部出口闭环。
- 保存并重启验证文本、图结构、layout 均持久化。

### 诊断与错误恢复

- 打开 undefined target、undeclared variable、duplicate id、orphan、dead-end fixtures。
- 验证 Problem Panel 可打开、错误数量和严重级别可见、点击诊断跳转编辑器。
- 修复文本后验证诊断减少或消失。
- 打开非法扩展、超 10MB 文件、空文件、只有 frontmatter、极长标题、Unicode/emoji/中文路径文件，验证 app 不崩溃并显示受控失败或可编辑状态。

### 主题与远程包

- 默认离线启动只显示内置主题，不暴露本地导入/第三方入口。
- 启动本地官方 registry HTTP server，Theme Center 刷新后显示“免费主题”。
- 下载官方远程 ZIP 主题，启用后验证 `data-theme-id`、远程 Surface 标记、远程节点/边 slot 可见。
- hash mismatch registry 下下载失败，当前主题不变，内置主题仍可用。
- 重启后已安装远程主题仍可启用。

### 极端交互

- 快速连续切换 Split/Graph Lab/Home/Theme Center，不崩溃、不出现空白主界面。
- 快速输入 200 行文本并等待解析，图与诊断最终一致。
- 拖拽节点到画布边缘、极小窗口 800x600、窗口最大化、滚轮缩放上下限。
- 保存时关闭窗口：出现未保存确认；选择取消留在应用，选择保存写入磁盘，选择不保存退出。

### 性能基线

- 数据集：100、500、1000 节点；长正文接近 5MB；接近 10MB 读取上限。
- 指标用外部计时，不读内部 store：冷启动到 Home 可见、打开文件到默认 Graph Lab 可交互、Split 辅助切换、Problem Panel 打开、JSON/HTML/TXT 导出、远程主题下载启用。
- 默认阈值：100 节点打开到 Graph Lab 可交互 ≤ 3s、500 节点 ≤ 8s、1000 节点 ≤ 15s；Split 辅助切换 ≤ 3s；导出 JSON ≤ 5s、HTML ≤ 8s、TXT ≤ 5s；远程主题下载启用 ≤ 10s；UI 操作后 2s 内无白屏/崩溃。
- 性能失败先标记为 release blocker，不进入 PR 阻断；连续两次 nightly 失败才升级为 P0。

## Test Plan

- 新增命令：
  - `pnpm.cmd --filter @plotflow/app test:e2e:blackbox`
  - 可选分组：`test:e2e:blackbox:journey`、`test:e2e:blackbox:edge`、`test:e2e:blackbox:perf`
- 每次黑盒完整执行前：
  - `pnpm.cmd build`
  - 清理黑盒临时目录，例如 `%TEMP%/plotflow-blackbox-*`
  - 生成测试 fixtures 和本地官方 registry ZIP/hash。
- 验收标准：
  - 黑盒闭合旅程全部通过。
  - 极端边界无 renderer crash、main process uncaught fatal、白屏或无法关闭窗口。
  - 性能指标在默认阈值内；首次建立时同时输出基线报告。
  - 输出 artifacts：trace、screenshot、video、性能 JSON、失败时窗口树。
- 不替代现有门禁：
  - 现有 `pnpm.cmd --filter @plotflow/app test:e2e` 仍必须通过。
  - 黑盒套件用于补足真实用户路径，不删除现有集成 E2E。

## Assumptions

- 运行平台为 Windows，允许使用 OS 级 UIAutomation 控制原生对话框；非 Windows 平台先跳过原生对话框用例。
- 黑盒套件不修改运行时代码；如果某个关键 UI 无法通过可见文本、role、aria 或现有 `data-testid` 定位，先记录测试可达性缺口，不为测试随意改业务逻辑。
- “全面”定义为覆盖主要用户闭环、极端输入、真实文件 I/O、主题远程下载、性能基线；不包含安全渗透、安装包升级、系统文件关联注册和跨平台原生对话框差异。
