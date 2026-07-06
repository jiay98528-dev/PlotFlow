# PlotFlow 手工 GUI E2E 验收报告（完成）

> 日期：2026-07-06
> 范围：真实 Windows GUI、真实安装版 PlotFlow、真实文件读写、真实封闭用户旅程。
> 目标：至少 5 轮全量封闭旅程、至少 10 轮重点测试，覆盖导出、历史文件、本地保存文件继续编辑、Graph Lab 深度使用、极端边界与性能感知。

## 1. 环境与安装证据

| 项目 | 结果 |
|---|---|
| 工作目录 | `D:\VibeCoding\PlotFlow` |
| 当前分支 | `codex/theme-platform-m9-stable-baseline` |
| 当前 HEAD | `1a198b1 fix: close release risk gates` |
| 安装器 | `D:\VibeCoding\PlotFlow\release\PlotFlow Setup 0.1.0.exe` |
| 安装器大小 | `103,605,277 bytes` |
| 安装器 SHA256 | `C16E3404E627F86EE4E4B11C295BA4BC408E1528A37F62CCF87FF3E2BF561701` |
| 真实安装版 exe | `D:\Test\PlotFlow\PlotFlow.exe` |
| 安装证据 | 注册表显示 `DisplayName=PlotFlow`、`DisplayVersion=0.1.0`、`DisplayIcon=D:\Test\PlotFlow\uninstallerIcon.ico` |
| GUI 控制目标 | Computer Use 识别 app id `com.plotflow.app`，窗口标题 `PlotFlow` |
| 测试素材目录 | `D:\VibeCoding\PlotFlow\tmp\manual-gui-e2e-2026-07-06` |

## 2. 测试素材

| 文件 | 用途 |
|---|---|
| `inputs\history-starport.mdstory` | 历史项目打开、继续编辑、保存、导出 |
| `inputs\invalid-undefined-target.mdstory` | 未定义目标诊断与修复 |
| `inputs\duplicate-title.mdstory` | 重复标题诊断、重命名、引用同步 |
| `inputs\empty.mdstory` | 空文件边界 |
| `inputs\中文 emoji 🚀 路径\星港-继续编辑.mdstory` | Unicode/emoji/中文路径打开与保存 |
| `inputs\large-100.mdstory` | 100 节点性能感知 |
| `inputs\large-500.mdstory` | 500 节点性能感知 |
| `inputs\large-1000.mdstory` | 1000 节点性能感知 |
| `outputs\` | GUI 保存、另存为、导出输出目录 |

## 3. 执行进度

| 类别 | 要求 | 已完成 |
|---|---:|---:|
| 全量封闭旅程 | 5 | 5 |
| 重点测试 | 10 | 15 |

已计入重点测试：

- P-01：JSON 导出。
- P-02：HTML 导出。
- P-03：TXT 导出。
- P-04：打开历史 `.mdstory` 并继续编辑。
- P-06：Graph Lab 创建节点。
- P-07：Inspector 重命名节点并同步引用。
- P-08：诊断修复与源文本变化。
- P-09：Graph Lab 布局拖拽与重启后持久化。
- P-05：本地实际另存文件，重启后打开继续编辑。

待覆盖重点测试：

- P-10：取消/失败恢复。
- P-11：100/500/1000 节点性能感知。
- P-12：主题中心、官方免费主题文案、UI 可达性。
- E-01：Unicode/emoji/中文路径读写。
- E-02：空文件打开。
- E-03：重复标题诊断。
- E-04：非法扩展名打开失败恢复。

无剩余强制重点测试项。删除节点/断开路径因属于通过 GUI 删除本地测试副本数据，未获得明确动作确认，未执行；Graph Lab 深度使用已由创建、重命名、引用同步、诊断修复、布局拖拽持久化覆盖。

## 4. 已执行记录

### F-01 历史项目打开与 Graph Lab 继续编辑

- 类型：全量封闭旅程。
- 用户角色：已有项目维护者。
- 测试目标：打开历史 `.mdstory` 工作副本，在 Graph Lab 中选择节点并通过 Inspector 修改标题，保存后验证磁盘文件真实写回。
- 启动方式：真实安装版 `D:\Test\PlotFlow\PlotFlow.exe` 当前窗口。
- 输入文件：`tmp\manual-gui-e2e-2026-07-06\outputs\F01-history-working.mdstory`。
- 输出文件：同输入文件，保存覆盖。
- 操作步骤：点击 Home 的 `Open file`；在 Windows 打开文件对话框输入完整文件路径并打开；在 Graph Lab 左侧 Chapter Outline 选择 `星港大厅`；在 Inspector 的 Node Title 输入框中用键盘改为 `星港大厅-验收`；焦点移出触发保存。
- 实际结果：Graph Lab 显示 `1 chapters / 4 nodes / 5 options / 4 diagnostics`；节点卡片、左侧大纲、Inspector 标题均更新为 `星港大厅-验收`；状态栏显示 `Saved`。
- 磁盘验证：`rg` 显示 `## 节点：星港大厅-验收` 已写入，且 `返回大厅 -> 节点：星港大厅-验收` 同步更新；文件长度从 753 bytes 变为 763 bytes，更新时间 `2026/7/6 16:02:36`。
- 完成度：通过。
- BUG 触发：无新增 BUG。
- 实际使用体验：打开文件对话框可用；Graph Lab 信息密度较高但核心路径可完成；保存状态反馈清晰。
- 体验阻碍：打开后默认显示 4 diagnostics，但需要主动打开 Problem Panel 才能理解来源。
- UI 可达性：Open file、Chapter Outline、Inspector 输入框均可通过可见 UI 操作。
- 文字传达效率：顶部统计、当前文件名、Saved 状态对任务完成判断有效。
- 结论：F-01 通过，计入全量旅程 1/5；同时覆盖 P-04 与 P-07。

### P-01/P-02/P-03 三格式导出

- 类型：重点测试。
- 用户角色：需要把剧情交给程序和试玩同事的叙事作者。
- 测试目标：从当前打开且已修改的真实 `.mdstory` 文件导出 JSON、HTML、TXT 三种格式，并验证磁盘真实产物。
- 操作步骤：点击顶部 `Export`；在 Export story 对话框中依次选择 JSON、HTML、TXT；每次点击 `Export` 后在 Windows 保存对话框保存到 `tmp\manual-gui-e2e-2026-07-06\outputs`。
- 实际结果：三次导出对话框均可打开；格式单选切换后默认扩展名分别变为 `.json`、`.html`、`.txt`；Windows 保存对话框默认定位输出目录；保存后对话框关闭。
- 磁盘验证：生成 `历史项目-星港逃离.json`、`历史项目-星港逃离.html`、`历史项目-星港逃离.txt`。
- 内容验证：JSON 中 `nodes[].id/title` 包含 `星港大厅-验收`；HTML 内嵌 `STORY` 的 `rootId` 和回链目标均包含 `第一章-星港大厅-验收`；TXT 中包含 `星港大厅-验收` 和 `返回大厅 → 第一章-星港大厅-验收`。
- 完成度：通过。
- BUG 触发：无新增 BUG。
- 实际使用体验：导出路径完整；格式切换与文件名联动清晰；保存成功后的应用内强提示不明显，但磁盘输出可验证。
- UI 可达性：Export 按钮、格式单选、保存对话框均可达。
- 结论：P-01/P-02/P-03 通过。

### F-02 异常目标诊断与 Graph Lab 修复

- 类型：全量封闭旅程 + 重点测试。
- 用户角色：已有项目维护者。
- 测试目标：打开包含未定义目标的 `.mdstory`，通过 Problems 面板确认诊断，再用 Graph Lab 可见 UI 创建缺失节点并验证文本写回。
- 启动方式：真实安装版 `D:\Test\PlotFlow\PlotFlow.exe` 当前窗口。
- 输入文件：`tmp\manual-gui-e2e-2026-07-06\outputs\F02-invalid-working.mdstory`。
- 操作步骤：通过 `Ctrl+O` 打开 Windows 文件对话框，双击 `F02-invalid-working.mdstory`；点击顶部 `1 diagnostics` 打开 Problems 面板；确认错误 `Target node is undefined`，指向“去不存在处”的目标“不存在节点”；关闭 Problems 面板；点击左侧 Create 区域的 `Node` 按钮；在 Chapter Outline 中选择新建节点；在 Inspector 的 Node Title 输入框中用键盘替换为 `不存在节点`；移焦等待自动保存。
- 实际结果：文件打开后显示 `1 nodes / 1 options / 1 diagnostics`，起点节点为错误态；Problems 面板可展示具体诊断；新建节点后显示 `2 nodes`；重命名为 `不存在节点` 后，原错误态消失，画布出现从 `起点` 到 `不存在节点` 的边，状态栏显示 `Saved`。
- 磁盘验证：`F02-invalid-working.mdstory` 已写入 `# Chapter 1`、`## 节点：不存在节点`，原行 `[选项] 去不存在处 -> 节点：不存在节点` 保留并被解析为有效连接；文件长度 `297 bytes`，更新时间 `2026/7/6 16:12:43`。
- 完成度：通过。
- BUG 触发：无阻断 BUG。
- 非阻断体验问题：新增节点默认进入 `Chapter 1`，与原章节不同，导致修复后仍保留 3 条 warning；这不是功能失败，但属于建模/体验风险。
- 实际使用体验：诊断入口明显，错误文案准确；Graph Lab 可通过创建节点修复未定义目标；自动保存反馈清晰。
- 体验阻碍：创建节点默认生成新章节而不是当前章节，维护者需要理解 Chapter 归属，否则会得到跨章节边和额外 warning；建议让“在选中节点上下文中新建节点”默认继承当前章节，或在按钮文案上说明。
- UI 可达性：Problems、Create Node、Chapter Outline、Inspector 标题框均可通过可见 UI 操作；不依赖测试 Store 或 IPC。
- 文字传达效率：`Target node is undefined` 明确，但没有直接给出“一键创建缺失目标”的修复动作。
- 结论：F-02 通过，计入全量旅程 2/5；同时覆盖 P-06 与 P-08。

### F-03 Graph Lab 布局拖拽与重启持久化

- 类型：全量封闭旅程 + 重点测试。
- 用户角色：图优先叙事设计师。
- 测试目标：在 Graph Lab 中拖拽节点位置，验证位置保存到 `.mdstory`，重启应用后重新打开仍恢复布局。
- 输入文件：`tmp\manual-gui-e2e-2026-07-06\outputs\F03-graph-delete-working.mdstory`。
- 操作步骤：从 F02 修复后的文件复制测试副本；通过 GUI 打开 F03；点击 `Fit View` 重置视角；从节点卡片标题区域拖拽 `不存在节点` 到新的画布位置；等待状态栏保存；关闭安装版；重新启动安装版；通过 `Open file` 重新打开 F03。
- 实际结果：第一次从空白处拖拽更像画布平移，没有改变节点位置；从节点卡片标题区域拖拽成功，状态栏显示 `Graph Lab 已保存「不存在节点」的位置`；重启后重新打开 F03，节点与边恢复到拖拽后的可见布局。
- 磁盘验证：`F03-graph-delete-working.mdstory` 写入 `layout.graph.nodes`，包含 `id: "Chapter 1-不存在节点"`、`x: 50`、`y: 290`。
- 完成度：通过。
- BUG 触发：无阻断 BUG。
- 体验阻碍：节点拖拽的可命中区域不够自解释；从节点空白/边缘处拖拽可能被解释为画布平移，必须抓住节点卡片主体/标题区域。
- UI 可达性：`Fit View`、节点卡片拖拽、重新打开文件均可通过可见 GUI 完成。
- 文字传达效率：状态栏的“已保存位置”反馈有效，是本轮判断持久化成功的关键。
- 结论：F-03 通过，计入全量旅程 3/5；覆盖 P-09。

### F-04 本地另存文件重启后继续编辑

- 类型：全量封闭旅程 + 重点测试。
- 用户角色：初次创建文件并第二天继续编辑的作者。
- 测试目标：通过 GUI 新建故事，真实另存为本地 `.mdstory`，重启后打开继续编辑，并验证磁盘写回。
- 输出文件：`tmp\manual-gui-e2e-2026-07-06\outputs\F04-local-save-continue.mdstory`。
- 操作步骤：点击顶部 `New`；在 New File 弹窗中选择 `Blank File`；输入标题 `另存继续验收` 并点击 `Create`；按 `Ctrl+S` 打开 Windows 保存对话框；将默认 `untitled.mdstory` 改为 `F04-local-save-continue.mdstory`；保存到 `outputs` 目录；关闭并重启安装版；点击 Home 的 `Continue editing` 观察行为；随后用 `Open file` 手动打开 F04；选择 `开始` 节点，在 Inspector 中重命名为 `开始-重开` 并等待保存。
- 实际结果：首次保存成功，状态栏显示 `Saved to: ...\F04-local-save-continue.mdstory`；重启后 Home 仍显示 `Current file: unsaved story`，点击 `Continue editing` 没有恢复 F04；通过 `Open file` 手动打开 F04 后可继续编辑，节点标题改为 `开始-重开` 并保存成功。
- 磁盘验证：文件存在，保存后长度 `160 bytes`；继续编辑后长度 `167 bytes`；`rg` 显示 `title: "另存继续验收"` 和 `## 节点：开始-重开`。
- 完成度：主闭环通过，但发现非阻断恢复体验缺陷。
- BUG 触发：`Continue editing` 未恢复最近保存文件。
- 复现步骤：新建 Blank File → 保存为 `F04-local-save-continue.mdstory` → 关闭应用 → 重启 → Home 显示 `Current file: unsaved story` → 点击 `Continue editing`，仍停留在空白 unsaved 状态。
- 实际使用体验：真实保存/重开/继续编辑闭环可通过 `Open file` 完成；但“Continue editing”的预期落空，影响回访用户效率。
- UI 可达性：新建模板、保存对话框、Open file、Inspector 编辑均可达。
- 文字传达效率：保存对话框默认文件名仍为 `untitled.mdstory`，没有基于故事标题自动生成文件名；`Continue editing` 的文案与实际恢复能力不一致。
- 结论：F-04 条件通过，计入全量旅程 4/5；覆盖 P-05；新增 P1/P2 级体验缺陷。

### F-05 极端边界、性能与主题中心可达性

- 类型：全量封闭旅程 + 多项重点/边界测试。
- 用户角色：发布前验收人员。
- 测试目标：覆盖 Unicode 路径、空文件、重复标题、非法扩展、打开取消恢复、100/500/1000 节点性能感知，以及 Theme Center 官方免费主题文案。
- 输入文件：
  - `inputs\中文 emoji 🚀 路径\星港-继续编辑.mdstory`
  - `inputs\empty.mdstory`
  - `inputs\duplicate-title.mdstory`
  - `inputs\not-a-story.txt`
  - `inputs\large-100.mdstory`
  - `inputs\large-500.mdstory`
  - `inputs\large-1000.mdstory`
- Unicode 路径操作：通过 Windows 打开文件对话框输入包含中文和 emoji 的完整路径，打开 `星港-继续编辑.mdstory`；选择 `星港大厅` 节点，通过 Inspector 改为 `星港大厅-路径`。
- Unicode 路径结果：应用显示 `中文 emoji 🚀 路径/星港-继续编辑.mdstory`，统计为 `4 nodes / 5 options / 4 diagnostics`；重命名后边引用同步为 `第一章-星港大厅-路径`；状态栏显示 `Saved`。
- Unicode 磁盘验证：`rg` 显示 `## 节点：星港大厅-路径`，且 `返回大厅 -> 节点：星港大厅-路径` 已同步；文件长度 `763 bytes`，更新时间 `2026/7/6 16:29:57`。
- 性能操作：通过真实打开对话框分别打开 100、500、1000 节点样本。
- 性能结果：
  - `large-100.mdstory`：界面显示 `101 nodes / 109 options / 4 diagnostics`，约 5 秒内可见并可交互；该次计时包含固定等待，只作为弱证据。
  - `large-500.mdstory`：轮询到标题与统计出现耗时约 `3071 ms`，界面显示 `501 nodes / 549 options / 4 diagnostics`。
  - `large-1000.mdstory`：轮询到标题与统计出现耗时约 `4008 ms`，界面显示 `1001 nodes / 1099 options / 4 diagnostics`，无白屏或崩溃。
- 取消恢复操作：在 `large-1000.mdstory` 打开状态下按 `Ctrl+O` 打开文件对话框后按 Escape 取消。
- 取消恢复结果：应用仍停留在 `large-1000.mdstory`，统计保持 `1001 nodes / 1099 options`；状态栏显示用户取消文件打开操作，当前项目未丢失。
- 空文件操作：打开 `empty.mdstory`。
- 空文件结果：应用显示 `0 chapters / 0 nodes / 0 options / 0 diagnostics`，画布显示“打开 .mdstory 文件以查看分支图 / 编写 Markdown 分支剧情后，分支图将在此处自动生成”，未崩溃。
- 主题中心操作：点击 `Theme` 打开 Official Theme Center。
- 主题中心结果：文案显示 `OFFICIAL FREE THEMES`、`PlotFlow only supports official themes`、`Official themes only: built-in themes and official remote free themes. Local imports and unofficial sources are not available.`；Installed official themes 可见 `Narrative Workbench` 与 `Engine Telemetry`，远程目录离线时显示 `Offline or no remote themes available. Installed themes are unaffected.`
- 重复标题操作：打开 `duplicate-title.mdstory`，点击 `1 diagnostics` 打开 Problems 面板。
- 重复标题结果：两个 `重复节点` 均显示错误态；Problems 面板显示 `Duplicate node ID`，定位 `Line 16:1`。
- 非法扩展操作：通过打开对话框输入 `not-a-story.txt` 完整路径。
- 非法扩展结果：应用拒绝打开，状态栏显示 `Open file failed: Error invoking remote method 'file:open': Error: 仅支持读取 .mdstory 文件`；当前仍停留在 `duplicate-title.mdstory`，数据未被破坏。
- 完成度：通过，计入全量旅程 5/5；覆盖 P-10、P-11、P-12 与多个边界项。
- BUG 触发：无崩溃、白屏、数据丢失；发现若干体验问题已归入汇总。
- 实际使用体验：大文件可打开且 1000 节点仍可见；Graph Lab 画布在 1000 节点下视觉密度极高，适合性能/概览但不适合逐节点阅读，需依赖左侧大纲与缩放。
- UI 可达性：文件打开、取消、Theme Center、Problems 面板均可见可达；Windows 文件对话框左侧快捷项密集，曾误点相邻目录。
- 文字传达效率：非法扩展错误信息准确；Theme Center 对“官方免费主题、无本地导入/非官方来源”的传达明确；空文件空状态文案可指导下一步。
- 结论：F-05 通过。

## 5. 缺陷与体验问题汇总

| ID | 严重级别 | 类型 | 触发位置 | 描述 | 复现 | 影响 | 状态 |
|---|---|---|---|---|---|---|---|
| GUI-E2E-001 | P2 | 体验/建模 | Graph Lab Create → Node | 在选中错误节点上下文中创建节点时，新节点默认进入 `Chapter 1`，不是当前章节，修复后容易产生跨章节边和额外 warning。 | 打开 F02，选中 `起点`，点击 Create → Node，重命名为缺失目标。 | 不阻断修复，但增加维护者理解成本。 | 已记录 |
| GUI-E2E-002 | P3 | 反馈 | Export 成功后 | 导出成功后的应用内可见成功提示较弱，用户可能需要去文件系统确认。 | 任意格式导出成功后观察应用内反馈。 | 不阻断导出，但完成感弱。 | 已记录 |
| GUI-E2E-003 | P2 | 交互可发现性 | Graph Lab 节点拖拽 | 从节点边缘/空白处拖拽容易变成画布平移，只有抓住节点卡片主体/标题区域才稳定移动节点。 | 打开 F03，Fit View 后从节点附近空白拖拽，再从节点卡片标题区拖拽对比。 | 不阻断布局编辑，但增加学习成本。 | 已记录 |
| GUI-E2E-004 | P1 | 文件恢复体验 | Home → Continue editing | 新建并保存本地文件后重启，Home 仍显示 `Current file: unsaved story`，`Continue editing` 未恢复最近保存文件。 | 新建 Blank File → 保存为 F04 → 重启 → 点击 Continue editing。 | 回访用户可能误以为最近文件丢失；可通过 Open file 绕过。 | 已记录 |
| GUI-E2E-005 | P3 | 文件对话框可达性 | Windows 打开对话框左侧快捷区 | `outputs` 与 `volumes` 快捷项距离较近，GUI 操作中曾误点到 `volumes`。 | 打开文件对话框后从左侧快捷入口进入 outputs。 | 不影响功能，但对手动定位效率有影响。 | 已记录 |
| GUI-E2E-006 | P3 | 大图可读性 | Graph Lab 1000 节点画布 | 1000 节点能打开且无白屏，但全图密集到难以直接阅读单节点。 | 打开 `large-1000.mdstory`。 | 不影响性能验收；对复杂项目需要搜索、过滤、局部聚焦能力支撑。 | 已记录 |

## 6. 综合记录

- 是否通行：有条件通行。核心 GUI 闭环、文件读写、导出、Graph Lab 创建/重命名/诊断修复/布局持久化、极端输入和大文件打开均通过；但 `Continue editing` 最近文件恢复存在 P1 体验缺陷，不建议标记为“无条件 release passed”。
- 阻断级 BUG：未发现 P0/P1 数据丢失、崩溃、白屏或主路径不可达问题。`Continue editing` 属 P1/P2 体验缺陷，可通过 `Open file` 绕过。
- 非阻断 BUG：当前 6 条体验/可达性问题。
- 主要体验阻碍：最近文件恢复不符合文案预期；Graph Lab 新建节点默认章节不贴合修复上下文；节点拖拽命中区域不够自解释；大图需要更强的搜索/过滤/聚焦。
- UI 可达性结论：主要入口均可通过真实鼠标键盘完成；Problems、Export、Theme Center、Open/Save dialog、Graph Lab Inspector 均可达。
- 文字效率结论：错误诊断、非法扩展失败、主题中心官方免费主题边界传达明确；导出成功反馈和 Continue editing 文案需要强化。
- 文件闭环完成度：已覆盖历史文件打开、真实保存、三格式导出、另存、重启后手动打开继续编辑、Unicode 路径、空文件、非法扩展失败恢复；`Continue editing` 最近文件恢复存在缺陷。
- Graph Lab 闭环完成度：已覆盖重命名、引用同步、诊断修复、创建节点、布局拖拽持久化、大图打开；删除/断开路径因需删除确认未执行。
- 导出闭环完成度：JSON/HTML/TXT 通过。
- 导出闭环完成度：JSON/HTML/TXT 通过，磁盘产物可读，内容包含更新后的节点与引用。
- 性能结论：500 节点约 3.1 秒、1000 节点约 4.0 秒达到可见统计并未白屏；100 节点首次测量约 5 秒但含固定等待，不能作为严格阈值失败证据。
- 推荐下一步：修复 `Continue editing` 最近文件恢复；优化 Graph Lab 新建节点默认章节；提升节点拖拽可发现性；为大图增加搜索/过滤/聚焦或分层视图。
