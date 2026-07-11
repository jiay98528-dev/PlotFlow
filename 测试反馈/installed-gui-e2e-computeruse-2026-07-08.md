# PlotFlow 安装版 GUI 外审报告（ComputerUse）

日期：2026-07-08
执行方式：ComputerUse 真实 Windows GUI 操作。未使用 Playwright、内部 test bridge、IPC mock、store 读取、代码级断言或直接修改应用状态。
结论：**installed GUI smoke failed**。不得声明 `release-candidate passed`。

## 测试对象

- 安装包：`D:\VibeCoding\PlotFlow\release\PlotFlow Setup 0.1.0.exe`
- 安装包 SHA256：`69F8AC1A04283EFDA602BF94C020AE090B934F8A5BEC521F5DD16D1282757CB8`
- 实际安装路径：`D:\Test\PlotFlow`
- 实际启动 EXE：`D:\Test\PlotFlow\PlotFlow.exe`
- Installed EXE SHA256：`5399B39417E4AE3D055A81ACF0F3206E1577BB0B34B10E3DA75BEDA9E53D1813`
- 截图目录：`D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\`
- 截图数量：53

说明：用户确认 `D:\Test\PlotFlow` 当前安装即本轮新包，因此未重新卸载/安装。实际验收启动的是安装版 `D:\Test\PlotFlow\PlotFlow.exe`，不是 `release\win-unpacked`。

## 总体判定

阻断项复核结果：

| 项目 | 结论 | 严重级别 |
|---|---:|---:|
| P0-1 保存/导出原生对话框乱码、下层、取消 stuck | PASS | - |
| P0-2 Source Drawer 章节切片边界 | PASS | - |
| P1-1 新建/Graph Lab 状态重置 | PASS | - |
| P1-2 问题面板跳转 | PASS | - |
| P1-3 保存/取消后大面积文本选中 | PASS | - |
| 补充：1000 节点性能/稳定性 | FAIL | P1 |

发行 GUI gate：**不通过**。
理由：核心阻断项已关闭，但 1000 节点安装版 GUI 性能烟测出现可见运行时错误：底部状态栏显示 `Uncaught RangeError: Maximum call stack size exceeded...`。这是安装版 GUI 层可见错误，不能作为 release candidate 通过证据。

## 用例 1：P0-1 保存/导出原生对话框

步骤：

1. 启动安装版 PlotFlow。
2. 新建 RPG 对话模板故事。
3. `Ctrl+S` 触发首次保存。
4. 检查系统保存对话框标题、前置层级。
5. 取消保存，检查主界面是否 stuck 或大面积文本选中。
6. 再次 `Ctrl+S`，保存到测试目录。
7. 点击“导出”，选择 JSON，保存到测试目录。
8. 只读检查导出 JSON 是否实际写入测试目录，安装目录是否被误写 JSON。

实际结果：

- 保存对话框标题为 `保存 PlotFlow 故事文件`，中文正常。
- 保存对话框在最前层，可直接输入绝对路径保存。
- 取消保存后主界面返回，底部显示 `cancelled 已取消保存`，未卡在 saving/exporting。
- 未出现大面积文本选中高亮。
- `.mdstory` 成功写入 `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\p0-save-rpg.mdstory`。
- JSON 成功写入 `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\p0-export-rpg.json`。
- `D:\Test\PlotFlow` 下未发现误写业务 JSON；只存在应用自带 `vk_swiftshader_icd.json`。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\05-save_dialog_title_normal.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\05-after_cancel_save_dialog_no_saving_stuck.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\06-after_real_save_to_test_dir.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\08-export_json_dialog_title_normal.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\08-after_json_export_to_test_dir.png`

判定：PASS。

## 用例 2：P0-2 Source Drawer 章节切片边界

步骤：

1. 在 RPG 故事中通过 Split 追加第二章：
   - `# 第二章边界验收`
   - `## 节点：第二章入口`
2. 切回 Graph Lab，确认顶部显示 2 章。
3. 打开 Source Drawer。
4. 在第一章切片末尾追加 `P0-2 第一章切片追加。`。
5. 点击“保存切片”。
6. 切换到第二章，检查第二章是否仍为独立章节。
7. 回到 Split，跳到源码末尾检查章节结构。
8. 保存、关闭、重启，点击 Continue editing 恢复文件，再检查末尾结构。

实际结果：

- 保存 Source Drawer 切片后，顶部统计仍为 2 章。
- 第二章标签 `第二章边界验收` 仍独立存在。
- Split 源码中第一章追加文本后仍有空行和独立 `# 第二章边界验收`。
- 重启后 Continue editing 恢复同一文件，章节边界仍正确。
- 未复现旧问题：后续章节标题被拼进第一章正文。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\10-split_added_second_chapter.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\13-source_drawer_open_via_top_button.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\14-source_drawer_after_append_before_save.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\15-source_drawer_after_save_slice.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\16-source_drawer_after_switch_second_chapter.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\18-split_end_after_source_drawer_boundary_save.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\21-reloaded_split_end_boundary_still_valid.png`

判定：PASS。

## 用例 3：P1-1 新建/Graph Lab 状态重置

步骤：

1. 从已保存 RPG 多章节故事进入“新建”。
2. 选择“空白文件”并创建。
3. 切到 Graph Lab。
4. 创建节点。
5. 创建章节。
6. 在新增章节内创建节点和结局。
7. 保存新故事到 `p1-reset-blank.mdstory`。
8. 切 Split 检查源码。

实际结果：

- 新建空白故事后源码仅包含 `第一章/开始`，无旧 RPG 章节。
- 创建节点后，新节点落在当前 `第一章`。
- 创建章节后出现 `第一章 2`，未复活旧故事章节名。
- 在 `第一章 2` 中创建节点和结局后，左侧大纲显示新节点/结局，未出现 `村口黄昏`、`守卫盘问`、`侧门` 等旧 RPG 节点。
- 保存后 Split 源码只包含新故事章节和新节点。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\23-blank_story_created_after_rpg.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\24-blank_story_graph_lab_initial.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\25-blank_story_after_create_node.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\26-blank_story_after_create_chapter.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\29-blank_story_after_explicit_ending_click.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\30-reset_blank_split_source_after_save.png`

判定：PASS。

## 用例 4：P1-2 问题面板跳转

步骤：

1. 在 Graph Lab 中打开问题面板。
2. 点击第一条 W001 诊断项。
3. 检查 Graph Lab 是否定位到目标节点。
4. 切 Split 检查源码定位。

实际结果：

- 问题面板可通过 Graph Lab 顶部 `12 诊断` chip 打开。
- 点击第一条诊断后：
  - Graph Lab 选中 `开始` 节点。
  - Inspector 标题变为 `开始`。
  - 状态栏显示 `已定位到节点：开始`。
- 切 Split 后，左侧大纲高亮 `开始`，源码滚动到 `## 节点：开始` 附近。

补充观察：

- 在 Split 模式下直接点击状态栏诊断数字没有打开问题面板；问题面板入口主要可从 Graph Lab 诊断 chip 进入。该点不是本轮阻断，但属于 UI 可达性可优化项。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\34-problem_panel_open_from_graph_lab_chip.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\35-after_click_first_diagnostic_graph_lab.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\36-after_diagnostic_click_split_source_position.png`

判定：PASS。

## 用例 5：P1-3 保存异常/取消后的文本选中高亮

步骤：

1. 首次保存时打开系统保存对话框。
2. 按 Escape 取消。
3. 返回主界面后观察 Split/Graph Lab/工具栏状态。

实际结果：

- 取消保存后没有出现大面积文本选中高亮。
- Graph Lab 仍可继续点击、保存、导出和切换。
- 后续多次打开/保存/导出/切换过程中未复现大面积蓝色选中。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\05-after_cancel_save_dialog_no_saving_stuck.png`

判定：PASS。

## 用例 6：Continue editing

步骤：

1. 保存 `p0-save-rpg.mdstory`。
2. 关闭安装版应用。
3. 重新启动 `D:\Test\PlotFlow\PlotFlow.exe`。
4. 点击 Continue editing。

实际结果：

- 重启后进入 Home，显示 Continue editing。
- 点击后恢复最近保存的 `p0-save-rpg.mdstory`。
- 没有回到未命名空白故事。
- 恢复后 Source Drawer 保存过的章节边界仍正确。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\19-relaunch_after_source_drawer_save.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\20-continue_editing_restored_recent_file.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\21-reloaded_split_end_boundary_still_valid.png`

判定：PASS。

## 用例 7：Graph Lab 基础闭环烟测

步骤：

1. 在新建空白故事中创建节点、章节、结局。
2. 点击诊断项定位节点。
3. 在 Graph Lab 中从无选项节点默认出口拖线。
4. 在弹出的目标选择菜单中选择现有 `新节点`。

实际结果：

- 节点、章节、结局创建入口可用。
- 默认下一步出口可拖动。
- 选择现有目标后生成连接，状态栏显示 `Graph Lab 已连接到【新节点】`。
- 诊断数量从 12 降到 10，说明连接写回后 validator 重新计算。

未完全覆盖：

- 本轮未完成“删除边/删除节点/布局拖拽重启持久化/变量条件效果 UI 写回”的完整闭合，仅完成基础创建与默认连线烟测。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\37-graph_lab_basic_before_drag_connection.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\38-graph_lab_after_default_next_drag.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\39-graph_lab_after_select_existing_target_for_default_next.png`

判定：PARTIAL PASS。

## 用例 8：文件边界

步骤：

1. 通过真实打开对话框打开 Unicode 路径文件。
2. 通过真实打开对话框尝试打开非 `.mdstory` 文件。
3. 打开空 `.mdstory`。
4. 打开 frontmatter-only `.mdstory`。

实际结果：

- Unicode 路径文件 `unicode-路径-章节.mdstory` 打开成功，文件名和正文中文显示正常。
- 非 `.mdstory` 文件被阻止，当前故事未被替换，底部显示 `打开文件失败...`。
- 空 `.mdstory` 打开后无白屏，显示 0 章、0 节点、默认 story metadata。
- frontmatter-only `.mdstory` 打开后无白屏，显示 0 章、0 节点，并正确读取标题/作者。

未覆盖：

- 外部编辑同一文件后的 dirty/autosave 冲突闭环未完成。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\41-open_dialog_title_normal.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\41-opened_unicode_path_story.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\42-after_attempt_open_non_mdstory_txt.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\43-opened_empty_mdstory_no_white_screen.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\44-opened_frontmatter_only_no_white_screen.png`

判定：PARTIAL PASS。

## 用例 9：主题中心与主题切换

步骤：

1. 点击“主题”打开官方主题中心。
2. 检查主题中心文案。
3. 滚动到 Engine Telemetry。
4. 点击“立即启用”。

实际结果：

- 主题中心打开正常。
- 文案为“官方免费主题 / 官方主题中心”，未出现第三方、本地导入、社区上传入口。
- Engine Telemetry 卡片可见，按钮为“立即启用”。
- 点击后界面立即切换到 Engine Telemetry 暗色视觉，并显示 Engine Telemetry `已启用`。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\48-theme_center_from_installed_app.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\49-theme_center_engine_card_scrolled.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\50-theme_center_after_enable_engine_telemetry.png`

判定：PASS。

## 用例 10：性能感知

步骤：

1. 打开 100 节点样例。
2. 打开 500 节点样例。
3. 打开 1000 节点样例。
4. 观察 Graph Lab 是否白屏、崩溃、明显卡死或出现错误。

实际结果：

| 样例 | 近似打开耗时 | GUI 结果 |
|---|---:|---|
| 100 节点 / 99 选项 | 约 4.2s | 可见，无白屏 |
| 500 节点 / 499 选项 | 约 8.2s | 可见，无白屏 |
| 1000 节点 / 999 选项 | 约 15.4s | 可见，但出现运行时错误 |

失败详情：

- 打开 1000 节点后，底部状态栏出现 `Uncaught RangeError: Maximum call stack size exceeded...`。
- 这不是测试脚本断言，而是安装版 GUI 可见错误。
- 即使界面没有白屏，该错误也说明大图路径仍存在稳定性风险。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\45-opened_perf_100_graph_lab.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\46-opened_perf_500_graph_lab.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\47-opened_perf_1000_graph_lab.png`

判定：FAIL。严重级别：P1。

## 未完成项

以下补充项本轮未完整闭合，不能作为通过证据：

1. 删除边、删除节点、Del/Backspace 删除确认文案。
2. 节点拖动布局保存后重启持久化。
3. 变量、条件、效果 UI 完整写回源码。
4. 外部编辑同一文件后的 dirty/autosave 冲突处理。
5. 远程官方免费主题下载链路和 hash mismatch。
6. 安装器卸载流程。

这些未完成项不改变本轮主要结论：已验证的历史阻断项大多关闭，但由于 1000 节点安装版 GUI 出现可见 `Uncaught RangeError`，本轮仍不能声明 release candidate passed。

## 结论

安装版 GUI 阻断项复核结论：

- 历史 P0/P1 阻断项：保存对话框、导出对话框、Source Drawer 章节边界、新建状态重置、问题面板跳转、保存取消高亮，均在本轮未复现。
- 新发现发行风险：1000 节点 Graph Lab 打开后出现可见 `Uncaught RangeError: Maximum call stack size exceeded...`。

最终状态：**installed GUI smoke failed**。
禁止写：`release-candidate passed`。
建议修复后至少重跑：

1. 100/500/1000 节点安装版 GUI 性能烟测。
2. Graph Lab 大图切换、缩放、Source Drawer、问题面板打开。
3. installed blackbox 自动化。
4. 30 分钟安装版人工巡检。


---

# 续跑记录：R11-R40（ComputerUse 真实 GUI，新增 30 轮）

追加时间：2026-07-08T11:05:20.029Z

本节继续使用安装版 `D:\Test\PlotFlow\PlotFlow.exe`，不使用 Playwright、内部 bridge、IPC mock、store 读取或代码级断言。R11-R40 共 30 轮，目标是在已发现 1000 节点 RangeError 后继续覆盖更多边界，而不是提前停止。

## 续跑总览

| 轮次 | 用例 | 结果 | 严重级别 |
|---:|---|---|---|
| R11 | 主题中心 Engine Telemetry 已启用状态 | PASS | - |
| R12 | 关闭主题中心后 Engine Telemetry 外壳保持 | PASS | - |
| R13 | 主题切回叙事工作台 | PASS | - |
| R14 | 官方免费主题库离线刷新 | PASS | - |
| R15 | 1000 节点状态下语言菜单可达性 | PASS_WITH_EXISTING_ERROR | P1 existing |
| R16 | 1000 节点 Split ↔ Graph Lab 快速切换 | PASS_WITH_EXISTING_ERROR | P1 existing |
| R17 | 1000 节点问题面板打开 | PASS_WITH_EXISTING_ERROR | P1 existing |
| R18 | 1000 节点 Source Drawer 可达性 | PASS_WITH_EXISTING_ERROR | P1 existing |
| R19 | 1000 节点缩放控件 | PASS_WITH_EXISTING_ERROR | P1 existing |
| R20 | 1000 节点导出弹窗取消 | INCONCLUSIVE_SUPERSEDED_BY_R21 | P3 automation coordinate note |
| R21 | 1000 节点正确触发导出弹窗并取消 | PASS_WITH_EXISTING_ERROR | P1 existing |
| R22 | RangeError 后保存既有文件 | PASS_WITH_EXISTING_ERROR | P1 existing |
| R23 | Split 问题面板关闭与快捷键重开 | PASS | - |
| R24 | Ambiguous Unicode 高亮提示关闭 | FAIL_MINOR | P2 |
| R25 | 语言从 English 切回中文 | PASS | - |
| R26 | RangeError 后打开小文件恢复 | PASS | - |
| R27 | 错误恢复后小文件 Source Drawer | PASS | - |
| R28 | 错误恢复后小文件导出取消 | PASS | - |
| R29 | 窗口最大化与还原 | PASS | - |
| R30 | R30 初次未保存退出探针导致窗口关闭后的恢复 | INCONCLUSIVE | P2 |
| R31 | 新建未保存故事退出提示与取消 | PASS_WITH_OPERATOR_RETRY | - |
| R32 | 选择工作区对话框取消 | PASS | - |
| R33 | 新建未保存故事 Source Drawer 初始状态 | PASS | - |
| R34 | Source Drawer 覆盖下变量 UI 误命中 | FAIL_USABILITY | P2 |
| R35 | Source Drawer 覆盖下节点选择误命中 | INCONCLUSIVE | P2 coverage gap |
| R36 | Unicode 文件名保存 | PASS | - |
| R37 | Unicode 文件名 JSON 导出 | PASS | - |
| R38 | 删除节点确认取消 | INCONCLUSIVE | P2 coverage gap |
| R39 | Split 文本添加选项反向同步到 Graph Lab | PARTIAL_PASS | P2 semantic coverage gap |
| R40 | Home/Graph 快速导航稳定性 | PASS_WITH_NOTE | P3 |

## 续跑详细记录

### R11 主题中心 Engine Telemetry 已启用状态

步骤：

- 保持主题中心打开
- 观察 Engine Telemetry 卡片是否显示已启用
- 观察官方免费主题文案是否仍存在

实际结果：Engine Telemetry 卡片显示“已启用”，主题中心仍写“官方主题中心 / OFFICIAL FREE THEMES”，没有第三方/本地导入入口。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\55-R11_theme_center_engine_enabled_visible.png`

### R12 关闭主题中心后 Engine Telemetry 外壳保持

步骤：

- 点击主题中心“完成”
- 返回主界面
- 观察 Graph Lab 外壳主题是否仍为 Engine Telemetry 暗色

实际结果：返回主界面后仍为 Engine Telemetry 暗色网格/卡片风格，主题切换不是只作用于弹窗。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\56-R12_after_close_theme_center_engine_shell.png`

### R13 主题切回叙事工作台

步骤：

- 打开主题中心
- 点击叙事工作台卡片“立即启用”
- 观察主题中心和背景视觉变化

实际结果：叙事工作台可重新启用，界面从 Engine Telemetry 暗色风格切回浅色工作台风格。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\57-R13_theme_center_reopen_for_workbench.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\58-R13_after_enable_narrative_workbench.png`

### R14 官方免费主题库离线刷新

步骤：

- 点击“刷新免费主题库”
- 观察离线/无远程源状态
- 确认不影响已安装主题卡片

实际结果：离线刷新后主题中心仍可用，已安装主题卡片保留；页面说明“当前离线或暂无远程主题”，未崩溃。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\59-R14_refresh_official_free_theme_library_offline.png`

### R15 1000 节点状态下语言菜单可达性

步骤：

- 在 1000 节点 Graph Lab 中点击语言下拉
- 尝试选择另一语言
- 观察应用是否白屏/崩溃/卡死

实际结果：语言下拉可打开，选择操作后应用未白屏、未崩溃；底部 RangeError 仍存在。

判定：PASS_WITH_EXISTING_ERROR。严重级别：P1 existing。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\61-R15_language_dropdown_open_on_1000.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\62-R15_after_language_choice_attempt.png`

### R16 1000 节点 Split ↔ Graph Lab 快速切换

步骤：

- 点击 Split
- 等待源码视图出现
- 点击 Graph Lab 返回图视图

实际结果：1000 节点文件在 Split 与 Graph Lab 间可切换，无白屏；Graph Lab 返回后仍可见大图。底部 RangeError 未自动消除。

判定：PASS_WITH_EXISTING_ERROR。严重级别：P1 existing。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\63-R16_1000_nodes_split_view.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\64-R16_1000_nodes_back_graph_lab.png`

### R17 1000 节点问题面板打开

步骤：

- 点击顶部诊断 chip
- 观察问题面板是否展开并显示大量诊断
- 确认主界面仍可响应

实际结果：问题面板可展开，显示大量 W001 诊断；主界面未白屏。底部 RangeError 仍是既有风险。

判定：PASS_WITH_EXISTING_ERROR。严重级别：P1 existing。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\65-R17_1000_nodes_problem_panel_open.png`

### R18 1000 节点 Source Drawer 可达性

步骤：

- 点击右上“源文本”按钮
- 观察 Source Drawer 是否展开/可见
- 确认大图状态下应用是否卡死

实际结果：Source Drawer 区域可操作，应用未卡死；若面板已被问题面板占据，源文本按钮仍可点击。底部 RangeError 仍存在。

判定：PASS_WITH_EXISTING_ERROR。严重级别：P1 existing。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\66-R18_1000_nodes_source_drawer_open_attempt.png`

### R19 1000 节点缩放控件

步骤：

- 点击画布 + 缩放
- 点击画布 - 缩放
- 观察节点图是否仍可见

实际结果：缩放控件可点击，图面仍可见，未白屏。底部 RangeError 仍存在。

判定：PASS_WITH_EXISTING_ERROR。严重级别：P1 existing。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\67-R19_1000_nodes_zoom_controls.png`

### R20 1000 节点导出弹窗取消

步骤：

- 点击导出
- 确认导出格式弹窗出现
- 按 Escape 取消
- 观察主界面状态

实际结果：首次在 1000 节点状态点击导出坐标未稳定触发导出弹窗，未出现 stuck；后续 R21 使用正确按钮坐标完成导出弹窗取消验证。

判定：INCONCLUSIVE_SUPERSEDED_BY_R21。严重级别：P3 automation coordinate note。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\68-R20_export_modal_on_1000_nodes.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\69-R20_after_cancel_export_modal_on_1000.png`

### R21 1000 节点正确触发导出弹窗并取消

步骤：

- 在英文界面点击 Export 按钮
- 观察导出格式弹窗
- 按 Escape 取消
- 确认不进入 exporting stuck

实际结果：导出按钮可触发弹窗；取消后回到主界面，未卡住。底部 RangeError 仍存在。

判定：PASS_WITH_EXISTING_ERROR。严重级别：P1 existing。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\70-R21_export_modal_correct_click_1000.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\71-R21_after_cancel_export_1000.png`

### R22 RangeError 后保存既有文件

步骤：

- 对当前已打开 1000 节点文件按 Ctrl+S
- 观察是否弹出错误或卡住 saving

实际结果：既有文件保存没有弹出系统另存为，也未卡住 saving；但底部 RangeError 仍存在。

判定：PASS_WITH_EXISTING_ERROR。严重级别：P1 existing。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\72-R22_existing_file_save_after_rangeerror.png`

### R23 Split 问题面板关闭与快捷键重开

步骤：

- 点击 ProblemPanel 右上关闭按钮
- 使用 Ctrl+Shift+M 重开问题面板
- 观察 Split 中问题面板可达性

实际结果：问题面板可关闭；Ctrl+Shift+M 可重开，解决 Split 顶部缺少明显诊断入口的问题一部分。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\73-R23_problem_panel_closed_in_split.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\74-R23_problem_panel_reopened_by_shortcut.png`

### R24 Ambiguous Unicode 高亮提示关闭

步骤：

- 点击编辑器顶部 Disable Ambiguous Highlight 链接
- 观察提示条是否消失或状态变化

实际结果：点击后提示条仍可见或变化不明显，用户难以确认关闭是否生效。此为可改进项。

判定：FAIL_MINOR。严重级别：P2。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\75-R24_after_disable_ambiguous_highlight_banner.png`

### R25 语言从 English 切回中文

步骤：

- 点击 English 语言下拉
- 选择中文
- 观察菜单与主界面文案

实际结果：界面切回中文，菜单、工具栏和面板文案恢复中文。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\76-R25_language_dropdown_english_to_chinese.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\77-R25_after_switch_back_chinese.png`

### R26 RangeError 后打开小文件恢复

步骤：

- 从 1000 节点错误状态打开 Unicode 小文件
- 观察标题、节点数、底部状态

实际结果：小文件可打开，界面恢复到 1 节点；底部不再显示 RangeError，说明错误可通过打开其他文件恢复。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\78-R26_recovered_small_file_after_rangeerror.png`

### R27 错误恢复后小文件 Source Drawer

步骤：

- 打开小文件后切到 Graph Lab
- 点击 Source Drawer
- 观察是否正常展开且无 RangeError

实际结果：Source Drawer 可展开，小文件状态下没有继承 1000 节点 RangeError。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\79-R27_small_file_source_drawer_after_recovery.png`

### R28 错误恢复后小文件导出取消

步骤：

- 点击导出
- 打开导出弹窗
- 按 Escape 取消

实际结果：小文件导出弹窗可打开并取消，主界面未 stuck。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\80-R28_small_file_export_modal.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\81-R28_small_file_after_export_cancel.png`

### R29 窗口最大化与还原

步骤：

- 点击最大化按钮
- 观察布局
- 再次点击还原
- 观察布局和弹窗/面板状态

实际结果：窗口最大化和还原后界面仍可见，未白屏；Source Drawer/Graph Lab 布局保持可用。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\82-R29_window_maximized_small_file.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\83-R29_window_restored_small_file.png`

### R30 R30 初次未保存退出探针导致窗口关闭后的恢复

步骤：

- R30 初次在已保存小文件中追加文本后 Alt+F4
- 窗口未留下可捕获未保存确认，PlotFlow 进程消失
- 重新从安装路径启动应用

实际结果：应用可重新启动，但初次 R30 没有形成可确认的未保存提示证据；该点作为阻碍记录，后续 R31 用新建未保存故事重新验证。

判定：INCONCLUSIVE。严重级别：P2。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\84-R30_unsaved_change_before_close.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\85-R30_relaunch_after_window_disappeared.png`

### R31 新建未保存故事退出提示与取消

步骤：

- 从 Home 新建空白故事
- Alt+F4 触发未保存退出确认
- 点击取消
- 检查是否仍留在应用

实际结果：新建未保存故事能触发未保存提示；第一次坐标点击未命中取消，第二次点击弹窗内“取消”后留在应用。

判定：PASS_WITH_OPERATOR_RETRY。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\86-R31_new_file_modal_for_unsaved_prompt.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\87-R31_new_unsaved_blank_story_created.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\88-R31_unsaved_exit_prompt_visible.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\89-R31_after_cancel_unsaved_exit_prompt.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\90-R31_after_click_actual_cancel_option.png`

### R32 选择工作区对话框取消

步骤：

- 点击左侧“选择工作区”
- 观察系统选择/打开对话框或应用状态
- 按 Escape 取消
- 确认主界面不 stuck

实际结果：工作区选择入口可点击；取消后回到主界面，没有卡住。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\91-R32_choose_workspace_dialog_or_state.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\92-R32_after_cancel_choose_workspace.png`

### R33 新建未保存故事 Source Drawer 初始状态

步骤：

- 点击 Source Drawer
- 观察当前章节切片和 dirty/stale 状态

实际结果：Source Drawer 可展开；没有从上一文件继承旧草稿/旧章节名。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\93-R33_fresh_unsaved_source_drawer_open.png`

### R34 Source Drawer 覆盖下变量 UI 误命中

步骤：

- 尝试点击 Inspector 变量名输入框
- 输入 score
- 观察实际焦点

实际结果：实际焦点落在 Source Drawer 文本区域，score 被输入到源码切片而不是变量 UI。说明 Source Drawer 展开时右侧 Inspector/变量输入的可达性和焦点边界容易误判。

判定：FAIL_USABILITY。严重级别：P2。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\94-R34_variable_name_input_score.png`

### R35 Source Drawer 覆盖下节点选择误命中

步骤：

- 尝试点击画布节点
- 观察 Inspector 是否切为节点详情

实际结果：Source Drawer 展开后覆盖画布下半部分，点击坐标未稳定命中节点，Inspector 未形成明确节点选择证据。

判定：INCONCLUSIVE。严重级别：P2 coverage gap。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\95-R35_select_start_node_inspector.png`

### R36 Unicode 文件名保存

步骤：

- 对未保存故事按 Ctrl+S
- 系统保存对话框中输入含中文文件名的绝对路径
- 保存并返回应用

实际结果：Unicode 文件名保存成功，标题栏/侧边文件名正常显示。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\96-R36_unicode_save_dialog_title.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\97-R36_after_unicode_save_path.png`

### R37 Unicode 文件名 JSON 导出

步骤：

- 点击导出
- 选择 JSON 导出
- 系统保存对话框输入中文 JSON 文件名
- 保存后返回应用

实际结果：Unicode JSON 导出路径可保存，应用返回正常。

判定：PASS。严重级别：-。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\98-R37_export_modal_unicode_story.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\99-R37_export_save_dialog_unicode.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\100-R37_after_unicode_json_export.png`

### R38 删除节点确认取消

步骤：

- 选中节点
- 按 Delete
- 观察是否有确认提示或受控删除反馈
- 按 Escape 取消/关闭

实际结果：Delete 后未出现明显原生乱码；是否弹出确认取决于当前焦点和节点选中状态，未完成删除闭环。

判定：INCONCLUSIVE。严重级别：P2 coverage gap。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\101-R38_delete_node_prompt_or_result.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\102-R38_after_cancel_delete_node.png`

### R39 Split 文本添加选项反向同步到 Graph Lab

步骤：

- 切 Split
- 在源码末尾添加一条 [选项] 指向开始
- 切回 Graph Lab
- 观察节点选项/边是否更新

实际结果：文本编辑后 Graph Lab 可继续渲染，无白屏；由于添加位置在文档末尾，语义是否归属当前节点需进一步人工检查。

判定：PARTIAL_PASS。严重级别：P2 semantic coverage gap。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\103-R39_split_added_option_text.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\104-R39_graph_lab_after_split_option_sync.png`

### R40 Home/Graph 快速导航稳定性

步骤：

- 点击 Home 图标
- 观察是否回到 Home 或保持当前状态
- 点击 Graph Lab 返回/保持图视图

实际结果：快速导航未导致白屏或崩溃；若 Home 图标无明显响应，属于可达性待确认点。

判定：PASS_WITH_NOTE。严重级别：P3。

截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\105-R40_home_button_or_state.png`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\106-R40_back_graph_after_home_attempt.png`

## 续跑新增问题与改进点

| ID | 严重级别 | 标题 | 说明 |
|---|---|---|---|
| GUI-CONT-001 | P2 | Ambiguous Unicode 提示关闭反馈不明确 | 在 1000 节点中文内容的英文界面中，顶部出现英文 Ambiguous Unicode 提示。点击 Disable Ambiguous Highlight 后，提示条视觉上仍存在或反馈不明确。 |
| GUI-CONT-002 | P2 | 已保存文件追加文本后 Alt+F4 未捕获未保存提示 | 在 R30 初次探针中，向已保存小文件追加文本后 Alt+F4，窗口消失且 ComputerUse 未捕获未保存确认。可能原因包括自动保存已落盘、焦点/窗口句柄丢失或提示瞬时关闭；后续用新建未保存故事重测。 |
| GUI-CONT-003 | P2 | Source Drawer 展开时变量 UI 焦点边界易误命中 | R34 试图操作右侧变量输入，但实际 score 被输入到 Source Drawer 源码切片，说明展开态下编辑区域/Inspector 的空间与焦点边界不够清晰。 |

## 续跑结论

- 历史 P0/P1 阻断项在续跑中仍未复现：保存/导出乱码、Source Drawer 章节吞并、新建旧故事污染、问题面板跳转失效。
- 既有发行阻断仍存在：1000 节点 Graph Lab 打开后出现可见 `Uncaught RangeError: Maximum call stack size exceeded...`。R15-R22 证明该错误状态下部分 UI 仍能操作，但不能据此放行。
- 新增 P2 改进点：Ambiguous Unicode 提示关闭反馈不明确；Source Drawer 展开态下 Inspector/变量 UI 焦点边界容易误命中；已保存文件追加文本后 Alt+F4 的未保存提示捕获不稳定。
- 本轮最终状态仍为：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 续跑记录：R41-R60（ComputerUse 真实 GUI，新增 20 轮）

本节继续使用安装版 `D:\Test\PlotFlow\PlotFlow.exe`，仍不使用 Playwright、内部 bridge、IPC mock、store 读取或代码级断言。R41-R60 重点补齐上一轮的 Source Drawer 覆盖、变量/条件/效果字段化、删除确认、撤销、保存重启恢复等缺口。

## R41-R60 结果总览

| 轮次 | 场景 | 结果 | 严重级别 |
|---|---|---|---|
| R41 | 收起 Source Drawer 后 Inspector 可见性 | PASS | - |
| R42 | 变量输入焦点不再误落 Source Drawer | PASS | - |
| R43 | 保存变量并出现状态反馈 | PASS | - |
| R44 | Source Drawer 章节切片不显示 story-level vars | PASS_WITH_NOTE | - |
| R45 | Split 全源文本确认 vars 写回 | PASS | - |
| R46 | 选择节点并显示条件/效果控件 | PASS | - |
| R47 | 条件/效果控件显示 score_r42 变量 | PASS | - |
| R48 | 条件值输入 score_r42 == 5 | PASS_WITH_RISK | P1 follow-up |
| R49 | 效果控件可见 | PASS | - |
| R50 | 效果操作和值编辑后触发语法错误 | FAIL | P1 |
| R51 | Split 源码确认字段化条件写回为 parser 不接受格式 | FAIL | P1 |
| R52 | Split 语法错误状态栏/问题面板可达性 | INCONCLUSIVE | P2 |
| R53 | 通过 Split 手动删除错误条件行后恢复成功 | PASS | - |
| R54 | Delete 键删除节点路径仍不稳定 | INCONCLUSIVE | P2 |
| R55 | 放大画布下重新选择节点 | PASS | - |
| R56 | Inspector 删除节点按钮直接删除，无确认 | FAIL | P1 |
| R57 | Ctrl+Z 未恢复被删除节点 | FAIL | P1 |
| R58 | 删除后通过创建按钮重建节点 | PASS_WITH_NOTE | P3 |
| R59 | 新建节点重命名同步到画布/大纲/Inspector | PASS | - |
| R60 | 保存、关闭、重启、Continue editing 后恢复最近文件 | PASS_WITH_NOTE | P3 |

## R41-R60 关键发现

### GUI-CONT-004：字段化条件/效果 UI 可生成 parser 不接受的文本（P1）

步骤：
- 在 Graph Lab 中创建 `score_r42` 变量。
- 在节点选项条件区选择 `score_r42 == 5`。
- 在效果区选择 `score_r42`，将操作从“设为”切换到“增加”，值输入 `3`。
- 切到 Split 查看源码。

实际结果：顶部出现红色错误条“编辑器中有 1 个语法错误，分支图可能不完整”。Split 源码显示 GUI 写回了 `条件: score_r42 == 5`，该文本被当前 parser 标为语法错误。字段化 GUI 与 `.mdstory` parser 合同不一致。

判定：FAIL，P1。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\116-R48_condition_value_score_r42_5.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\118-R50_effect_operation_dropdown_open.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\119-R50_effect_operation_value_changed.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\120-R51_split_after_condition_effect_syntax_error.jpg`

### GUI-CONT-005：删除节点按钮无确认且 Ctrl+Z 不恢复（P1）

步骤：
- 选中 Graph Lab 节点。
- 点击 Inspector 的删除节点按钮。
- 删除后按 `Ctrl+Z`。

实际结果：删除节点按钮没有弹出确认框，节点直接被删除，状态显示“Graph Lab 已删除节点”。随后 `Ctrl+Z` 没有恢复节点，节点数仍为 0。该路径对真实用户数据是高风险破坏性操作。

判定：FAIL，P1。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\124-R55_reselect_node_for_delete.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\125-R56_delete_node_button_prompt.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\126-R57_undo_after_node_delete.jpg`

### GUI-CONT-006：Split 语法错误状态栏的问题面板入口反馈不明确（P2）

步骤：
- 在 Split 保持语法错误状态。
- 点击底部语法错误状态文本。

实际结果：未看到明确 Problem Panel 展开或定位证据，界面仍停留在源码视图和底部错误状态。此路径不证明问题面板完全失效，但反馈不足。

判定：INCONCLUSIVE，P2。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\121-R52_problem_panel_after_condition_syntax_error.jpg`

### GUI-CONT-007：新建节点后未自动选中（P3）

步骤：
- 删除节点后点击左侧“节点”创建按钮。

实际结果：新节点创建成功，节点数恢复为 1。但创建后 Inspector 仍显示“未选择节点”，用户需要再次点击节点才能编辑。

判定：PASS_WITH_NOTE，P3。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\127-R58_create_node_after_delete_recovery.jpg`

### GUI-CONT-008：重启后不是自动打开最近文件，但 Continue editing 可恢复（P3）

步骤：
- 保存当前故事。
- 关闭安装版。
- 重新启动 `D:\Test\PlotFlow\PlotFlow.exe`。
- 点击“继续编辑”。

实际结果：重启后初始落在 Home/未保存故事，但“继续编辑”可见；点击后成功打开最近文件，`R59节点` 和 `score_r42` 均保留。若产品期望自动恢复，则需调整；若只要求手动继续编辑，则当前可接受。

判定：PASS_WITH_NOTE，P3。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\130-R60_saved_before_restart.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\131-R60_after_relaunch_initial_state.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\132-R60_after_continue_editing_persistence.jpg`

## R41-R60 续跑结论

- 本轮补齐了上一轮未闭合的变量、条件、效果、删除、撤销、重启恢复路径。
- 变量创建与 frontmatter 写回通过：`score_r42: int` 出现在 Split 全源文本中。
- 字段化条件/效果写回与 parser 不一致，这是新增 P1。
- 删除节点无确认且撤销不可用，这是新增 P1。
- 结合既有 1000 节点 `Uncaught RangeError`，安装版 GUI 发行闸门仍不通过。
- 当前最终状态仍为：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 续跑记录：R61-R80（ComputerUse 真实 GUI，新增 20 轮）

本节继续使用安装版 `D:\Test\PlotFlow\PlotFlow.exe`，不使用 Playwright、内部 bridge、IPC mock、store 读取或代码级断言。R61-R80 聚焦导出恢复、真实文件边界、外部文件冲突、Problem Panel 跳转、主题中心可达性与悬挂原生对话框恢复。

## R61-R80 结果总览

| 轮次 | 场景 | 结果 | 严重级别 |
|---|---|---|---|
| R61 | 当前故事打开导出面板，确认 JSON/HTML/TXT 入口 | PASS | - |
| R62 | TXT 导出原生保存对话框路径输入与写入 | INCONCLUSIVE | P2 follow-up |
| R63 | 导出中卡住后关闭导出面板 | PASS_WITH_NOTE | P2 |
| R64 | 导出取消/异常后大面积文本选中高亮恢复 | FAIL | P2 |
| R65 | 打开空 `.mdstory` 文件 | PASS | - |
| R66 | 打开 frontmatter-only `.mdstory` 文件 | PASS | - |
| R67 | 打开非 `.mdstory` 文件 | PASS_WITH_NOTE | P2 |
| R68 | 发现并取消上一轮残留原生导出对话框 | FAIL | P2 |
| R69 | 打开外部冲突测试 `.mdstory` 文件 | PASS | - |
| R70 | dirty 状态下外部修改同一文件，触发冲突 UX | PASS_WITH_NOTE | P2 |
| R71 | 冲突框选择 Keep Editing 后确认磁盘外部改动未被覆盖 | PASS | - |
| R72 | 冲突框选择 Save Copy 并写入真实副本 | PASS_WITH_NOTE | P2 |
| R73 | Save Copy 后冲突对话框/状态清理 | FAIL | P2 |
| R74 | HTML 导出原生保存对话框路径输入与写入 | INCONCLUSIVE | P2 follow-up |
| R75 | HTML 导出悬挂后关闭导出面板并确认主界面可操作 | PASS_WITH_NOTE | P2 |
| R76 | 冲突/Save Copy 后进入 Graph Lab 查看当前文件 | PASS_WITH_NOTE | P2 |
| R77 | Graph Lab 诊断 chip 打开 Problem Panel | PASS | - |
| R78 | Problem Panel 点击 W001 并定位节点 | PASS | - |
| R79 | Theme Center 在冲突状态后仍可打开/关闭 | PASS_WITH_NOTE | P3 |
| R80 | 会话末尾发现悬挂原生导出对话框并取消恢复主界面 | FAIL | P2 |

## R61-R80 关键发现

### GUI-CONT-009：导出异常/取消路径会留下悬挂状态、残留原生对话框或文本选中高亮（P2，需人工复测确认根因）

步骤：
- 从当前故事打开导出面板。
- 选择 TXT/HTML 导出，进入 Windows 原生保存对话框。
- 在保存路径交互失败或取消后回到主界面。
- 继续切换 Split/Graph Lab/Theme Center，并在会话末尾复查窗口列表。

实际结果：R62/R74 均未能确认目标文件写入，应用层导出面板出现 `导出中...` 悬挂，需要手动关闭。R64 返回主界面后出现大面积文本选中高亮，且一段时间内无法通过普通点击完全清理。R68 与 R80 分别发现 `导出 PlotFlow 文件` 原生保存对话框仍挂在后台，R80 取消后主界面恢复可操作。

判定：FAIL，P2。由于部分输入失败可能受 ComputerUse 原生对话框目标窗口切换影响，本项不单独升级 P1，但足以要求安装版人工复测导出取消/失败恢复路径。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\135-R62_txt_export_save_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\137-R62_txt_export_after_wait.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\141-R64_split_after_export_cancel_selection.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\148-R68_stale_export_native_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\169-R80_stale_export_dialog_before_cancel.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\170-R80_after_cancel_stale_export_main_state.jpg`

### GUI-CONT-010：非 `.mdstory` 打开错误泄漏内部 IPC 文案（P2）

步骤：
- 通过真实“打开文件”对话框选择 `R67-invalid.txt`。

实际结果：应用阻止打开并保留当前文件，这是正确行为；但底部错误文案为 `打开文件失败: Error invoking remote method 'file:open': Error: 仅支持读取 .mdstory 文件`。这暴露了内部 IPC 调用细节，用户可读性不足。

判定：PASS_WITH_NOTE，P2。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\146-R67_invalid_txt_open_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\147-R67_after_invalid_txt_open_attempt.jpg`

### GUI-CONT-011：外部文件冲突 UX 在中文界面下仍是英文（P2）

步骤：
- 打开 `R68-external-conflict.mdstory`。
- 在 Split 中输入 `GUI_R70_DIRTY_LINE`，形成 dirty 状态。
- 从磁盘外部追加 `EXTERNAL_R70_DISK_LINE`。

实际结果：应用弹出冲突确认框且没有静默覆盖磁盘，这是正确行为；但冲突标题、正文和按钮为英文：`File changed on disk`、`Save Copy`、`Reload Disk`、`Overwrite Disk`、`Keep Editing`。当前 UI 语言为中文，冲突路径属于高风险数据保护路径，不应中英混用。

判定：PASS_WITH_NOTE，P2。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\151-R70_external_conflict_dialog.jpg`

### GUI-CONT-012：Save Copy 后冲突状态清理不完整（P2）

步骤：
- 在外部文件冲突确认框中选择 `Save Copy`。
- 保存为 `R72-conflict-save-copy.mdstory`。
- 回到主界面并进入 Graph Lab。

实际结果：副本文件真实写入，包含 GUI dirty 行且不包含外部追加行，核心数据路径正确。但保存副本后冲突确认框仍保留，需要再点 `Keep Editing` 才消失。之后当前文件标题已变为 `R72-conflict-save-copy.mdstory`，但底部状态一度仍显示 `conflict External file change kept pending.`，状态来源与当前文件不一致。

判定：PASS_WITH_NOTE，P2。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\153-R72_ctrl_s_conflict_dialog_before_save_copy.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\156-R72_save_copy_actual_success.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\157-R73_after_save_copy_keep_editing.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\163-R76_graph_lab_after_conflict_save_copy.jpg`

### GUI-CONT-013：Theme Center 不响应 Escape 关闭（P3）

步骤：
- 在 Graph Lab/冲突后状态点击“主题”打开 Theme Center。
- 按 Escape 尝试关闭。
- 点击“完成”关闭。

实际结果：Theme Center 可正常打开，官方免费主题文案与主题卡可见；Escape 未关闭面板，必须点击“完成”。这不是数据风险，但影响模态窗口的一致性和键盘可达性。

判定：PASS_WITH_NOTE，P3。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\166-R79_theme_center_after_conflict_state.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\167-R79_theme_center_after_escape.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\168-R79_theme_center_done_closed.jpg`

## R61-R80 续跑结论

- 空文件、frontmatter-only 文件、非 `.mdstory` 文件阻断、外部冲突检测、Keep Editing、Save Copy、Problem Panel 定位、Theme Center 基本可达性均有真实 GUI 证据。
- 外部冲突保护没有静默覆盖磁盘改动，这是正向结果；但冲突文案、Save Copy 后状态清理、导出异常恢复仍存在明显发行体验风险。
- R61-R80 没有推翻既有结论：1000 节点 Graph Lab 的 `Uncaught RangeError`、字段化条件/效果写回 parser 不一致、节点删除无确认且不可撤销仍是更高优先级阻断。
- 当前最终状态仍为：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 续跑记录：R81-R102（ComputerUse 真实 GUI，含中断与外部阻塞）

本节继续使用安装版 `D:\Test\PlotFlow\PlotFlow.exe`。R81-R102 覆盖真实原生导出成功路径、导出后残留窗口核查、窗口最大化/还原、语言切换、主题中心、Engine Telemetry 启用/恢复默认，以及后续不可交互状态。期间发生两类外部中断：一次用户物理 `Esc` 停止 ComputerUse；随后多轮 Windows 桌面处于系统封面/不可激活状态。以下结论只基于已完成的 GUI 证据，不把未完成部分当作通过。

## R81-R102 结果总览

| 轮次 | 场景 | 结果 | 严重级别 |
|---|---|---|---|
| R81 | 恢复当前安装版主窗口状态 | PASS | - |
| R82 | 打开导出面板并确认 JSON/HTML/TXT 入口 | PASS | - |
| R83 | JSON 导出原生保存对话框出现 | PASS | - |
| R84 | JSON 导出保存到指定真实路径并验证文件 | PASS | - |
| R85 | 选择 HTML 导出格式 | PASS | - |
| R86 | HTML 导出保存到指定真实路径并验证文件 | PASS | - |
| R87 | 选择 TXT 导出格式 | PASS_WITH_NOTE | P3 |
| R88 | TXT 导出保存到指定真实路径并验证文件 | PASS | - |
| R89 | 连续成功导出后核查无残留原生对话框 | PASS | - |
| R90 | 最大化窗口下 Graph Lab 布局可用 | PASS | - |
| R91 | 还原窗口后 Graph Lab 布局可用 | PASS_WITH_NOTE | P3 |
| R92 | 打开语言菜单，中文/English 可见 | PASS | - |
| R93 | 切换 English 后主 UI/问题面板/Inspector 文案同步 | PASS | - |
| R94 | 从 English 切回中文 | PASS | - |
| R95 | 打开 Theme Center，官方免费主题库/离线提示/内置主题可见 | PASS | - |
| R96 | Engine Telemetry 启用尝试被用户物理 Esc 中断 | INCOMPLETE | 外部中断 |
| R97 | 恢复后启用 Engine Telemetry 成功 | PASS | - |
| R98 | 关闭 Theme Center 后 Graph Lab 视觉切到 Engine Telemetry | PASS | - |
| R99 | Engine Telemetry 下切 Split，可编辑源码和问题面板可见 | PASS | - |
| R100 | Theme Center 恢复默认主题 | PASS | - |
| R101 | 关闭 Theme Center 后默认主题恢复到 Split | PASS_WITH_NOTE | P3 |
| R102 | 试图继续关闭 Problem Panel，但 PlotFlow 窗口不可激活 | BLOCKED | 外部环境 |

## R81-R102 关键发现

### GUI-CONT-014：原生导出成功路径可通过，但文件名字段焦点依赖较强（P3）

步骤：
- 在导出面板分别选择 JSON、HTML、TXT。
- 进入 Windows 原生保存对话框。
- 用完整路径覆盖文件名并点击保存。
- 从磁盘读取导出文件确认写入。

实际结果：三种格式均成功写入目标路径。JSON 文件包含 story schema 和 `External Conflict` 元数据；HTML 文件为可读 HTML；TXT 文件包含 `External Conflict` 与 `GUI_R70_DIRTY_LINE`。这修正了 R61-R80 中因目标窗口/焦点混乱导致的导出失败假阴性。仍需注意：保存对话框当前焦点常落在搜索框，必须明确聚焦“文件名”字段；普通用户一般不受影响，但自动化和键盘可达性需要更稳。

判定：PASS_WITH_NOTE，P3。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\173-R83_export_json_native_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\175-R84_after_json_export_keyboard_path.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\177-R86_html_export_native_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\178-R86_after_html_export_save.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\181-R88_txt_export_native_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\182-R88_after_txt_export_save.jpg`

### GUI-CONT-015：连续成功导出后无原生对话框残留（正向证据）

步骤：
- 完成 JSON、HTML、TXT 三次导出。
- 重新枚举 PlotFlow 窗口并截图主界面。

实际结果：窗口列表只剩 `PlotFlow` 主窗口；无 `导出 PlotFlow 文件` 残留；accessibility 中 `selected_text` 为 `null`。说明 R61-R80 的残留对话框问题更偏向取消/异常/错误焦点恢复路径，而非成功导出主路径。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\183-R89_after_repeated_successful_exports_no_dialog.jpg`

### GUI-CONT-016：窗口最大化/还原可用，但系统 Snap overlay 会干扰瞬时截图（P3）

步骤：
- 最大化 PlotFlow 窗口。
- 还原窗口。
- 分别检查 Graph Lab/Split 主控件可见性。

实际结果：最大化和还原后主布局仍可用。还原时 Windows Snap overlay 短暂出现在右上角，属于系统层覆盖，不是 PlotFlow 缺陷；但对人工截图和自动化截图会造成干扰。

判定：PASS_WITH_NOTE，P3。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\184-R90_maximized_graph_lab_layout.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\185-R91_restored_from_maximized_layout.jpg`

### GUI-CONT-017：语言切换中英可逆，用户数据不被翻译（正向证据）

步骤：
- 打开语言菜单。
- 从中文切到 English。
- 再从 English 切回中文。

实际结果：顶部菜单、主按钮、Problem Panel、Inspector、Source Dock 等 UI 文案可切换；故事内容中的 `第一章` 等用户数据保持原文，这是正确行为。中英切换没有破坏当前文件或主题状态。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\186-R92_language_dropdown_opened.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\187-R93_language_switched_english.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\188-R94_language_dropdown_from_english.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\189-R94_language_switched_back_chinese.jpg`

### GUI-CONT-018：官方主题切换链路可用，Engine Telemetry 和默认主题可逆（正向证据）

步骤：
- 打开 Theme Center。
- 启用 Engine Telemetry。
- 关闭 Theme Center，检查 Graph Lab/Split 视觉变化。
- 重新打开 Theme Center，恢复默认主题。

实际结果：Theme Center 显示已安装官方主题、官方免费主题库离线提示和“不提供本地导入/非官方来源”的文案。Engine Telemetry 启用后 Graph Lab 节点卡、背景和面板视觉明显切换；Split 仍可编辑源码；恢复默认主题后状态回到叙事工作台。R96 初次中断是用户物理 `Esc` 造成，R97 恢复后已验证启用成功。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\190-R95_theme_center_opened.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\195-R97_engine_telemetry_coordinate_click_result.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\196-R98_engine_telemetry_graph_lab_applied.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\197-R99_split_under_engine_telemetry.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\199-R100_restore_default_theme_result.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\200-R101_default_theme_restored_split.jpg`

### GUI-CONT-019：PlotFlow 可后台枚举但窗口不可激活，阻断后续 GUI 操作（外部环境阻塞）

步骤：
- 尝试从 R102 继续关闭 Problem Panel 并执行后续用例。
- 枚举 PlotFlow 窗口与 accessibility tree。
- 尝试标准 `activate_window`。

实际结果：PlotFlow accessibility tree 可读，仍能看到 Split、Problem Panel、`GUI_R70_DIRTY_LINE` 等内容；但截图显示 Windows 系统封面/壁纸而非 PlotFlow，且 `activate_window` 连续返回 `failed to activate captured window`。按 ComputerUse 安全规则，不能在此状态下继续发送点击/键盘输入，也不能绕过锁屏或系统封面。

判定：BLOCKED，外部环境。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\201-R102_passive_state_after_activation_failure.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\202-R102_resume_after_unlock_attempt.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\203-R102_passive_lock_check_current_turn.jpg`

## R81-R102 续跑结论

- 新增正向证据：三种导出格式真实写入目标路径；成功导出后无原生对话框残留；语言切换可逆；Engine Telemetry 与默认主题可逆；主题切换不修改 `.mdstory` 内容。
- 新增改进点：原生保存对话框字段焦点对键盘/自动化不够稳；系统 Snap overlay 会污染窗口还原截图。
- 未完成：R102 之后的 Problem Panel 关闭、后续异常文件/关闭恢复/大图交互补测无法继续，因为 PlotFlow 当前可后台枚举但不可激活。
- 当前最终状态仍为：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 续跑记录：R103-R126（恢复后安装版 GUI 真实操作）

本节在用户恢复系统可交互状态后继续执行。目标是补足前一轮 R102 后被外部系统封面阻断的 GUI 覆盖：继续编辑恢复、Graph Lab 诊断跳转、Source Drawer、frontmatter/正文分隔符边界、重复节点/未定义目标、Unicode/CRLF 路径、新建状态重置、未保存退出确认、主题中心入口。全程使用安装版 `D:\Test\PlotFlow\PlotFlow.exe`，不调用 Playwright、内部 test bridge、IPC mock、store 读取或代码级断言。

## R103-R126 结果总览

| 轮次 | 场景 | 结果 | 严重级别 |
|---|---|---|---|
| R103 | 重新启动安装版 PlotFlow | PASS | - |
| R104 | 等待 Home 渲染 | PASS | - |
| R105 | Continue editing 恢复最近保存文件 | PASS | - |
| R106 | 切换 Graph Lab 恢复 R72 文件图投影 | PASS | - |
| R107 | 点击节点并同步 Inspector | PASS | - |
| R108 | 恢复续跑起始状态截图 | PASS | - |
| R109 | 点击诊断 chip 打开 Problem Panel | PASS | - |
| R110 | 点击 W002 诊断项定位 Graph Lab 节点 | PASS | - |
| R111 | 打开 Source Drawer 当前章节切片 | PASS | - |
| R112 | 点击 Source Drawer 诊断项定位节点 | PASS | - |
| R113 | 通过系统打开对话框选择 frontmatter/body `---` 边界 fixture | PASS | - |
| R114 | 载入含正文 `---` 的 fixture | PASS_WITH_NOTE | P2 |
| R115 | Split 检查章节未被吞并 | PASS_WITH_NOTE | P2 |
| R116 | 载入重复节点/未定义目标 fixture | PASS | - |
| R117 | Split 中打开 Problem Panel | PASS | - |
| R118 | 点击 E001 定位未定义目标源码行 | PASS | - |
| R119 | 载入 Unicode 路径、emoji 文件名、CRLF fixture | PASS | - |
| R120 | Unicode/CRLF 文件切到 Graph Lab 图投影 | PASS_WITH_NOTE | P3 |
| R121 | 从 Graph Lab 打开新建文件弹窗 | PASS | - |
| R122 | 创建新模板故事并验证旧文件状态未污染 | PASS | - |
| R123 | 未保存退出确认框 | PASS | - |
| R124 | 点击取消后回到可交互 Graph Lab | PASS | - |
| R125 | 未保存 Graph Lab 中打开 Theme Center | PASS | - |
| R126 | 关闭 Theme Center 回到原未保存故事 | PASS | - |

## R103-R126 关键发现

### GUI-CONT-020：Continue editing 可恢复真实保存文件（正向证据）

步骤：
- 从安装版重新启动。
- 在 Home 点击 Continue editing。
- 切换 Graph Lab 并选择节点。

实际结果：应用恢复 `R72-conflict-save-copy.mdstory`，Split/Graph Lab 均能显示 `External Conflict` 与 `GUI_R70_DIRTY_LINE`；Graph Lab 中 1 节点/0 选项/2 诊断可见，点击节点后 Inspector 同步到“开始”节点。说明 Continue editing 未回到空白故事，也未丢失前一轮保存副本。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\204-R103_launched_installed_plotflow.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\205-R104_after_launch_wait_state.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\206-R105_continue_editing_after_relaunch.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\207-R106_graph_lab_after_continue_editing.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\208-R107_select_node_after_resume.jpg`

### GUI-CONT-021：Graph Lab 与 Source Drawer 诊断跳转闭环可用（正向证据）

步骤：
- 点击 Graph Lab 顶部诊断 chip。
- 在 Problem Panel 中点击 W002。
- 打开 Source Drawer。
- 点击 Source Drawer 内 W001。

实际结果：Problem Panel 可打开并列出 W001/W002；点击 W002 后底部状态显示“已定位到节点：开始”，Inspector 保持目标节点上下文；Source Drawer 展示当前章节行范围、第 8-13 行、当前章节 2 条诊断和源码切片；点击切片诊断后同样定位到“开始”节点。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\210-R109_click_diagnostic_chip_problem_panel.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\211-R110_click_problem_row_graph_lab_context.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\212-R111_open_source_drawer_graph_lab.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\213-R112_click_source_drawer_diagnostic_row.jpg`

### GUI-CONT-022：正文中的独立 `---` 不吞章节，但会触发语法/展示边界（P2）

步骤：
- 创建并通过系统打开对话框载入 `R113-frontmatter-body-dashes.mdstory`。
- 文件包含 frontmatter 之后的正文独立 `---`，并包含第二章。
- 在 Graph Lab 与 Split 中检查章节结构。

实际结果：应用未白屏，Graph Lab 识别为 2 章/3 节点/2 选项，Split 仍能看到第一章和第二章，说明没有发生“吞掉后续章节”的 P0 数据结构事故。但正文中的独立 `---` 被 Graph Lab 节点预览压缩显示为 `--`，顶部提示“编辑器中有 1 个语法错误，分支图可能不完整”。这属于 frontmatter/正文分隔符的语法边界和展示一致性风险。

判定：PASS_WITH_NOTE，P2。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\214-R113_native_open_dialog_for_frontmatter_dash.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\215-R114_open_frontmatter_dash_fixture_result.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\216-R115_split_after_frontmatter_dash_fixture.jpg`

### GUI-CONT-023：重复节点与未定义目标诊断可见，Split 跳转可用（正向证据）

步骤：
- 通过系统打开对话框载入 `R116-duplicate-undefined.mdstory`。
- 打开 Split 中 Problem Panel。
- 点击 E001 未定义目标诊断。

实际结果：Split 未白屏，源码行 10/12 出现红色标记；Problem Panel 显示 E007 “节点 ID 重复”和 E001 “目标节点未定义”；点击 E001 后源码行 10 高亮，底部状态显示“已定位到节点：重复”。此路径能把用户带回问题源码位置。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\217-R116_open_duplicate_undefined_fixture_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\218-R116_open_duplicate_undefined_fixture_result.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\219-R117_split_problem_panel_duplicate_fixture_open.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\220-R118_split_click_E001_undefined_target.jpg`

### GUI-CONT-024：Unicode 路径、emoji 文件名、CRLF 文件可打开并投影到 Graph Lab（P3 文本瑕疵）

步骤：
- 通过系统打开对话框载入 `中文 路径 emoji\R118-unicode-crlf-😺.mdstory`。
- 在 Split 中检查源码。
- 切换 Graph Lab 检查节点、边、章节。

实际结果：Split 正常显示中文章节、`猫咪😺` 节点、CRLF 内容；Graph Lab 正常显示 2 节点/1 选项、`猫咪😺 -> 终点` 边，没有白屏或路径乱码。轻微瑕疵：accessibility 文本中路径片段出现重复拼接，例如 `中文 路径 emoji/R118-unicode-crlf-😺.mdstory径 emoji/...`，视觉主界面未见明显重复。

判定：PASS_WITH_NOTE，P3。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\221-R119_open_unicode_crlf_fixture_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\222-R119_open_unicode_crlf_fixture_result.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\223-R120_unicode_fixture_graph_lab_projection.jpg`

### GUI-CONT-025：新建故事会重置旧文件上下文（正向证据）

步骤：
- 在已打开 Unicode 文件的 Graph Lab 中点击“新建”。
- 在新建文件弹窗中使用默认选中模板创建故事。
- 检查 Graph Lab 当前文件名、章节、节点、边和 Source Dock 状态。

实际结果：创建后当前标题为“未保存故事”，章节为“村口黄昏”，显示 8 节点/13 选项；旧 Unicode 文件名、`中文章节`、`猫咪😺` 节点、旧 Source Dock 路径不再作为当前故事上下文出现。说明新建路径未复用旧文件章节、节点选择或旧 Source Drawer 草稿。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\224-R121_new_story_after_unicode_fixture.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\225-R122_created_new_story_after_fixture.jpg`

### GUI-CONT-026：未保存退出确认框中文正常，取消后可恢复操作（正向证据）

步骤：
- 在未保存新故事状态点击窗口关闭。
- 观察未保存确认框。
- 点击“取消”。

实际结果：确认框标题为 PlotFlow，主文案为“有未保存的更改”，正文为“未命名文件有未保存的更改。退出前是否保存？”，按钮为“保存 / 不保存 / 取消”，未见乱码；点击取消后回到 Graph Lab，画布、Inspector、变量区和工具栏均可继续交互。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\226-R123_unsaved_exit_confirmation_prompt.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\227-R124_cancel_unsaved_exit_back_to_app.jpg`

### GUI-CONT-027：Theme Center 入口文案符合“官方免费主题”口径（正向证据）

步骤：
- 在未保存 Graph Lab 状态点击“主题”。
- 查看 Theme Center 文案和主题卡。
- 点击完成关闭。

实际结果：Theme Center 标题为“官方主题中心”，文案明确“PlotFlow 只支持官方主题”“免费主题可远程下载、更新并立即生效”“当前不提供本地导入或非官方来源”；已安装主题包含“叙事工作台”和 “Engine Telemetry”；关闭后回到同一个未保存 Graph Lab 故事，状态未丢。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\228-R125_open_theme_center_from_unsaved_graph_lab.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\229-R126_close_theme_center_back_to_unsaved_graph_lab.jpg`

## R103-R126 续跑结论

- 本轮新增正向证据：Continue editing、Graph Lab 诊断跳转、Source Drawer 诊断跳转、Split 诊断跳转、Unicode/CRLF 打开、Graph Lab 投影、新建状态重置、未保存退出确认、Theme Center 官方免费主题入口均通过真实安装版 GUI 验证。
- 新增改进点：正文独立 `---` 不再造成章节吞并，但会触发语法错误且节点预览将 `---` 展示为 `--`；Unicode 路径在 accessibility 文本中存在重复拼接瑕疵。
- 仍未覆盖或仍需单独跑的内容：100/500/1000 节点性能、真实保存新故事到磁盘后重启恢复、外部修改 dirty 冲突再验证、拖线/断线/重连的细粒度画布操作。
- 当前最终状态仍为：**installed GUI smoke failed**。原因是历史 P0/P1/P2 风险尚未全部关闭，且本节不能替代完整 package/unpacked/installed/manual 全部门禁证据。不得写 `release-candidate passed`。

# 续跑记录：R127（外部系统封面阻碍）

## R127 结果

步骤：
- 尝试恢复安装版 `D:\Test\PlotFlow\PlotFlow.exe` 主窗口。
- 标准激活窗口失败后，不继续发送点击或键盘输入。
- 被动枚举 PlotFlow 窗口、获取 accessibility tree 和截图。

实际结果：PlotFlow 进程与主窗口仍可枚举，accessibility tree 可读，当前应用状态仍是 Graph Lab 中的“未保存故事”，包含 1 章、8 节点、13 选项、2 诊断，说明应用本身没有崩溃。但截图捕获的是 Windows 系统封面/壁纸而不是 PlotFlow 主界面，且 `activate_window` 返回 `failed to activate captured window`。按 ComputerUse 安全规则，此状态不能继续发送鼠标、键盘输入，也不能绕过锁屏或系统封面。

判定：BLOCKED，外部环境，不计为应用内失败。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\230-R127_passive_after_activation_failure.jpg`

## R127 同步准备

为避免下一轮空转，已预生成后续性能 GUI 验收输入文件，等待系统恢复可交互后通过原生“打开”对话框加载：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\inputs-r127-performance\R128-performance-100.mdstory`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\inputs-r127-performance\R129-performance-500.mdstory`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\inputs-r127-performance\R130-performance-1000.mdstory`

下一轮优先顺序：
- R128-R130：通过系统打开对话框分别加载 100/500/1000 节点文件，记录打开耗时、Graph Lab 切换耗时、是否白屏/卡死。
- R131-R134：保存当前新故事到真实磁盘，关闭并重启安装版，验证 Continue editing 恢复。
- R135-R138：外部修改 dirty 冲突再次验证，重点确认中文文案和保存副本状态清理。
- R139+：Graph Lab 画布拖动、连线、断线、重连的细粒度补测。

当前最终状态仍为：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 续跑记录：R130-R171（系统恢复后深度 GUI 黑盒）

> 本段为 2026-07-09 续跑追加记录。本轮证据以截图编号 233-305 与磁盘文件核查为准。所有 GUI 操作均通过安装版 `D:\Test\PlotFlow\PlotFlow.exe` 的真实窗口、系统文件对话框、鼠标和键盘完成；未使用 Playwright、内部 test bridge、IPC mock、store 读取或代码级状态注入。

## R130-R171 总览

| 轮次 | 用例 | 结果 | 严重级别 |
|---|---|---:|---|
| R130 | Windows 可交互恢复后重新激活 PlotFlow | PASS | - |
| R131 | 原生打开 100 节点性能样例 | PASS | - |
| R132 | 原生打开 500 节点性能样例 | PASS_WITH_NOTE | P2/P3 |
| R133-R135 | 原生打开 1000 节点样例并在 Split/Graph Lab 间切换 | FAIL | P0/P1 |
| R136-R139 | 大图错误后新建、保存、重启、Continue editing | PASS_WITH_NOTE | P3 |
| R140 | 外部修改顺序写入路径 | PASS_WITH_NOTE | - |
| R141-R143 | dirty 状态外部修改冲突、Keep Editing、Ctrl+S 二次确认 | PASS_WITH_NOTE | P2 |
| R144-R150 | 冲突状态 Save Copy、普通保存、新建未提示 | FAIL | P0 |
| R151-R158 | 新建空白故事、Source Drawer 切片编辑、保存、新建节点 | PASS | - |
| R159-R160 | 节点选择与 Inspector 标题写回 | PASS | - |
| R161-R162 | Problem Panel 打开与诊断跳转 | PASS | - |
| R163-R164 | Delete 键删除节点确认框与取消 | PASS | - |
| R165 | Split/Graph Lab 来回切换 | PASS | - |
| R166 | JSON 导出到真实磁盘 | PASS | - |
| R167-R171 | Theme Center、Engine Telemetry 启用、重启与 Continue editing | PASS | - |

## 新增阻断项

### GUI-CONT-028：1000 节点 Graph Lab 出现未捕获 RangeError（P0/P1）

步骤：

- 通过系统打开对话框加载 `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\inputs-r127-performance\R130-performance-1000.mdstory`。
- 等待 Graph Lab 显示 1000 节点 / 999 选项。
- 切到 Split，再切回 Graph Lab，观察底部状态与画布稳定性。

实际结果：

- 应用没有白屏，Split 与 Graph Lab 仍可切换。
- 底部状态持续显示 `Uncaught RangeError: Maximum call stack size exceeded`。
- 该错误在切到 Split 后仍保留，切回 Graph Lab 也仍保留。
- 500 节点样例可打开，但初始画布中部存在大图视口/fit 体验风险；1000 节点已触发运行时未捕获错误。

判定：FAIL，P0/P1。发行闸门不通过。

证据截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\240-R133_open_perf_1000_native_open_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\241-R133_open_perf_1000_opened_result.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\242-R134_perf_1000_switch_split_after_rangeerror.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\243-R135_perf_1000_switch_back_graph_lab.jpg`

### GUI-CONT-029：外部文件冲突弹窗与状态文案仍为英文（P2）

步骤：

- 在已保存文件中通过 GUI 输入 `GUI_R141_DIRTY_NOW`。
- 立即从外部写入 `EXTERNAL_R141_DISK_NOW`。
- 触发保存。

实际结果：

- 应用弹出冲突确认，数据保护路径正确：磁盘保留外部行，GUI 保留当前草稿，自动保存暂停。
- 弹窗主文案、按钮和状态为英文：`File changed on disk`、`Save Copy`、`Reload Disk`、`Overwrite Disk`、`Keep Editing`、`External file change kept pending`。
- 当前 UI 语言为中文，故该冲突路径仍未完成 i18n。

判定：PASS_WITH_NOTE，P2。数据保护通过，文案一致性未通过。

证据截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\253-R141_immediate_external_write_after_dirty_input.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\254-R142_current_conflict_dialog_state.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\257-R142_keep_editing_coordinate_after_conflict.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\258-R143_ctrl_s_after_keep_editing_pending_conflict.jpg`

### GUI-CONT-030：冲突状态 Save Copy 保存成功但丢失界面最新可见编辑（P0）

步骤：

- 构造外部文件冲突。
- 在界面中可见 `GUI_R146_DIRTY_FOR_COPY`。
- 使用冲突弹窗 `Save Copy`，通过系统保存对话框保存为 `R147-conflict-save-copy.mdstory`。
- 等待 3 秒后读取磁盘副本。
- 对该副本再次按 `Ctrl+S`，重新读取磁盘。

实际结果：

- UI 状态显示 `success✅ 已保存至: ...\R147-conflict-save-copy.mdstory`。
- 界面仍可见 `GUI_R146_DIRTY_FOR_COPY`。
- 磁盘副本不包含 `GUI_R146_DIRTY_FOR_COPY`。
- 3 秒后仍不包含该行，排除异步延迟。
- 对新副本再次 `Ctrl+S` 后仍不包含该行。
- 副本只保存到了更早的 `GUI_R141_DIRTY_NOW`，说明保存源状态与编辑器可见内容发生分裂。

判定：FAIL，P0。用户看到“已保存”，但当前可见编辑没有落盘，属于数据丢失风险。

证据截图与文件：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\266-R146_new_conflict_for_save_copy.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\269-R147_save_dialog_targeted_state.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\270-R147_after_targeted_save_copy.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\271-R148_wait_after_save_copy_and_recheck.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\272-R149_ctrl_s_on_save_copy_file_after_missing_latest_line.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\outputs-r130-continue\R147-conflict-save-copy.mdstory`

备注：

- `R144` 中曾发生一次测试工具目标窗口切错，文件名输入进入主编辑区；该次被标记为 harness misfocus，不作为产品缺陷判定。
- `R147-R149` 已改为锁定系统保存框窗口后复测，结论有效。

### GUI-CONT-031：存在未落盘可见编辑时点击“新建”不提示未保存（P0）

步骤：

- 延续 `GUI-CONT-030` 状态：界面仍可见 `GUI_R146_DIRTY_FOR_COPY`，但磁盘副本没有该行。
- 点击顶部“新建”。

实际结果：

- 没有弹出未保存确认。
- 直接打开“新建文件”对话框。
- 创建空白故事后 `GUI_R146_DIRTY_FOR_COPY` 从界面消失，且磁盘副本仍不包含该行。

判定：FAIL，P0。应用状态认为已保存，但用户可见编辑未落盘且可被新建流程静默丢弃。

证据截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\273-R150_click_new_after_visible_unsaved_not_persisted.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\274-R151_create_blank_after_new_without_unsaved_prompt.jpg`

## 新增正向证据

### GUI-CONT-032：Source Drawer 切片编辑可写回并保存到真实 `.mdstory`

步骤：

- 新建空白故事并进入 Graph Lab。
- 打开 Source Drawer。
- 在当前章节切片中输入 `SOURCE_R154_SLICE_EDIT`。
- 保存到 `R154-source-drawer-saved.mdstory`。
- 读取磁盘文件。

实际结果：

- Source Drawer 显示当前章节范围与诊断列表。
- 输入后诊断数从 3 降到 2。
- 保存文件成功。
- 磁盘文件包含 `SOURCE_R154_SLICE_EDIT`。

判定：PASS。

证据截图与文件：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\276-R153_open_source_drawer_on_new_blank_graph_lab.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\277-R154_source_drawer_after_slice_edit_before_save.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\283-R156_after_alt_n_save_attempt.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\outputs-r130-continue\R154-source-drawer-saved.mdstory`

### GUI-CONT-033：Graph Lab 创建节点、Inspector 改名、保存写回可用

步骤：

- 在 Graph Lab 点击“+ 节点”。
- 选择新节点。
- 在 Inspector 中把标题改为 `GUI_R160_NODE`。
- 保存并读取磁盘文件。

实际结果：

- 节点计数从 1 变为 2。
- 新节点出现在画布、章节大纲和 Source Drawer。
- Inspector 可编辑节点标题。
- 保存后磁盘文件包含 `## 节点：GUI_R160_NODE`，旧 `## 节点：新节点` 不再存在。

判定：PASS。

证据截图与文件：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\284-R157_click_create_node_in_graph_lab.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\285-R158_save_after_graph_lab_create_node.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\286-R159_select_new_node_for_inspector.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\289-R160_after_node_title_edit_save.jpg`

### GUI-CONT-034：Problem Panel 诊断跳转在 Graph Lab 中可定位节点

步骤：

- 打开 Problem Panel。
- 点击第一条 W001 诊断。

实际结果：

- 问题面板显示 4 条诊断，包含 W001/W002、行号和中文描述。
- 点击第一条诊断后选中“开始”节点。
- Inspector 标题切换到“开始”。
- 底部状态显示“已定位到节点：开始”。

判定：PASS。

证据截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\290-R161_open_problem_panel_graph_lab.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\291-R162_click_problem_item_jump_to_start_node.jpg`

### GUI-CONT-035：删除节点确认框中文正常，取消后不删除

步骤：

- 在选中“开始”节点状态下按 Delete。
- 观察确认框。
- 点击取消。

实际结果：

- 确认框显示“确定要删除节点「开始」吗？”。
- 按钮为“确定 / 取消”，无乱码。
- 取消后仍为 2 节点，磁盘文件仍包含“开始”和 `GUI_R160_NODE`。

判定：PASS。

证据截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\292-R163_delete_key_node_confirm_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\294-R164_cancel_delete_node_confirm.jpg`

### GUI-CONT-036：Split/Graph Lab 往返切换稳定

步骤：

- 从 Graph Lab 切到 Split。
- 再切回 Graph Lab。

实际结果：

- Split 源码显示 `SOURCE_R154_SLICE_EDIT` 与 `GUI_R160_NODE`。
- 切回 Graph Lab 后仍显示 2 节点 / 0 选项 / 4 诊断。
- 当前节点上下文与画布没有白屏或丢失。

判定：PASS。

证据截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\295-R165_switch_to_split_after_graph_lab_edits.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\296-R165_switch_back_graph_lab_after_split.jpg`

### GUI-CONT-037：JSON 导出系统保存框与磁盘文件通过

步骤：

- 点击“导出”。
- 默认选择 JSON。
- 通过系统保存对话框保存为 `R166-export.json`。
- 读取并解析 JSON。

实际结果：

- 导出对话框显示 JSON/HTML/TXT，默认 JSON。
- 系统保存框标题为“导出 PlotFlow 文件”。
- 磁盘写入 `R166-export.json`。
- JSON 可解析，内容包含 `GUI_R160_NODE` 和 `SOURCE_R154_SLICE_EDIT`。

判定：PASS。

证据截图与文件：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\297-R166_click_export_toolbar.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\298-R166_export_save_dialog_targeted.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\299-R166_after_export_json_saved.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\outputs-r130-continue\R166-export.json`

### GUI-CONT-038：Theme Center、Engine Telemetry、重启与 Continue editing 通过

步骤：

- 打开 Theme Center。
- 启用 Engine Telemetry。
- 关闭主题中心，确认 Graph Lab 仍显示当前文件。
- 关闭应用并重新启动安装版。
- 点击 Continue editing。

实际结果：

- Theme Center 文案明确“官方免费主题”“不提供本地导入或非官方来源”。
- Engine Telemetry 可立即启用，主题中心和 Graph Lab 立即换肤。
- 重启后主题仍保持 Engine Telemetry。
- Home 显示 Continue editing。
- 点击 Continue editing 后恢复 `R154-source-drawer-saved.mdstory`，2 节点、`GUI_R160_NODE` 和 `SOURCE_R154_SLICE_EDIT` 均可见。

判定：PASS。

证据截图：

- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\300-R167_open_theme_center.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\302-R168_enable_engine_telemetry_theme.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\303-R169_graph_lab_after_engine_telemetry_theme_enabled.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\304-R170_relaunch_after_engine_theme_and_saved_story.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\305-R171_continue_editing_after_relaunch_engine_theme.jpg`

## R130-R171 结论

- 新增正向覆盖：100/500 节点打开、真实保存、重启、Continue editing、Source Drawer 切片编辑、Graph Lab 新建节点、Inspector 改名、诊断跳转、删除确认、Split/Graph Lab 切换、JSON 导出、Theme Center 与 Engine Telemetry 持久化。
- 新增阻断：1000 节点 Graph Lab 触发未捕获 `RangeError`；冲突状态 Save Copy/普通保存可出现“界面可见内容未落盘但显示已保存”；在此状态下点击新建没有未保存提示并可静默丢弃可见编辑。
- 新增非阻断问题：外部文件冲突弹窗和状态仍为英文；路径/状态在 accessibility 文本中仍有重复拼接；500 节点初始视口体验仍需观察。
- 当前发行 GUI gate 结论：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 续跑记录：R128（外部系统封面阻碍重复）

## R128 结果

步骤：
- 再次尝试恢复安装版 PlotFlow 主窗口。
- 调用标准窗口激活。
- 激活失败后仅做被动截图和 accessibility tree 读取，不发送任何点击、键盘或绕过动作。

实际结果：`activate_window` 再次返回 `failed to activate captured window`。PlotFlow 主窗口仍可枚举，accessibility tree 仍显示当前处于 Graph Lab 的“未保存故事”：1 章、8 节点、13 选项、2 诊断；说明应用状态仍存活。但截图仍是 Windows 系统封面/壁纸而非 PlotFlow 界面，因此无法继续真实 GUI 输入。

判定：BLOCKED，外部环境。本项不计为 PlotFlow 应用内失败，但会阻断后续安装版 GUI 验收。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\231-R128_passive_activation_still_failed.jpg`

仍待系统恢复可交互后继续：
- R129-R131：100/500/1000 节点性能文件打开与 Graph Lab 切换。
- R132-R135：真实保存新故事、关闭、重启、Continue editing 恢复。
- R136-R139：外部修改冲突与保存副本状态清理复测。
- R140+：Graph Lab 画布拖动、连线、断线、重连补测。

当前最终状态仍为：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 续跑记录：R129（外部系统封面阻碍第三次重复）

## R129 结果

步骤：
- 再次执行标准窗口恢复流程。
- 只针对 PlotFlow 安装版窗口调用 `activate_window`。
- 激活失败后仅做被动状态读取和截图，不发送任何 GUI 输入。

实际结果：第三次连续出现相同阻碍：`activate_window` 返回 `failed to activate captured window`，截图仍为 Windows 系统封面/壁纸。PlotFlow 仍可被枚举，accessibility tree 仍显示 Graph Lab 的“未保存故事”状态：1 章、8 节点、13 选项、2 诊断，说明应用没有崩溃，但当前 Windows 会话层不允许 ComputerUse 将窗口拉到可交互前台。

判定：BLOCKED，外部环境。已达到连续三次相同阻碍，真实安装版 GUI 验收无法继续。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\232-R129_passive_activation_still_failed_third.jpg`

下一步恢复条件：
- 用户需要让 Windows 回到可交互桌面，并确保 PlotFlow 窗口可被正常前置。
- 恢复后从 R130 继续，不需要重新生成性能 fixture；现有 100/500/1000 节点输入文件仍可用。

当前最终状态仍为：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 最终索引：R130-R171 续跑已完成

R130-R171 的系统恢复后深度 GUI 黑盒记录已追加在本文件上方 `# 续跑记录：R130-R171（系统恢复后深度 GUI 黑盒）` 段落。因文件中存在多处历史“当前最终状态”结论行，本索引用于明确最新结论：

- 最新执行范围：R130-R171。
- 最新证据截图范围：`233-R130_activation_recovered_state.jpg` 至 `305-R171_continue_editing_after_relaunch_engine_theme.jpg`。
- 最新正向证据：100/500 节点打开、真实保存、重启、Continue editing、Source Drawer、Graph Lab 节点创建/改名、Problem Panel、删除确认、Split/Graph Lab 往返、JSON 导出、Theme Center 与 Engine Telemetry 持久化。
- 最新阻断项：1000 节点 Graph Lab 未捕获 `RangeError`；外部冲突 Save Copy/普通保存出现“界面可见内容未落盘但显示已保存”；随后点击“新建”不会提示未保存并可静默丢失该可见编辑。
- 最新发行 GUI gate 结论：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 续跑记录：R172-R191（Graph Lab 多章节、Source Drawer、导出与重启持久化）

## GUI-CONT-039：Graph Lab 拖拽布局保存与重启后恢复

步骤：
- 从 R171 恢复后的安装版继续，在 Graph Lab 中拖动 `GUI_R160_NODE`。
- 执行真实全局保存。
- 关闭安装版窗口，再从 `D:\Test\PlotFlow\PlotFlow.exe` 重新启动。
- 点击 `继续编辑` 恢复最近文件。

实际结果：
- 拖动后磁盘 `.mdstory` 写入 `layout.graph.nodes`，包含 `GUI_R160_NODE` 的 `x/y` 坐标。
- 重启后 `继续编辑` 能恢复 `R154-source-drawer-saved.mdstory`，显示 2 章、3 节点，`GUI_R160_NODE` 可见。
- 当前官方主题恢复为默认“叙事工作台”，不是 Engine Telemetry。

判定：PASS。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\306-R172_start_state_after_goal_resume.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\307-R173_after_drag_gui_node_before_save.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\308-R173_after_drag_gui_node_saved.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\344-R190_relaunch_installed_after_export_and_save.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\345-R191_continue_editing_after_relaunch.jpg`

## GUI-CONT-040：新增章节与第二章节点创建可达性

步骤：
- 在 Graph Lab 中新增章节。
- 切到新章节后尝试创建节点。
- 初始可见区域中创建按钮不可直接稳定命中时，滚动左侧栏后再次点击 `节点`。
- 保存并检查源码。

实际结果：
- 新增章节成功，但自动命名为 `第一章 2`，中文命名不自然，容易让用户误以为是重复章而非第二章。
- 第二章初始空章创建节点时，按钮位置被左侧栏/Source Dock/滚动状态影响，前两次真实点击未创建节点。
- 滚动左侧栏后 `章节/节点/结局/重新布局` 按钮可见，再点击 `节点` 成功创建 `## 节点：新节点`。
- 保存后磁盘第二章包含新节点，章节未被并入第一章。

判定：PASS_WITH_P2_UX_RISK。

严重级别：P2。节点创建路径存在可达性和视觉引导问题，但有可用 workaround，未造成数据损坏。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\309-R174_create_new_chapter_graph_lab.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\310-R175_create_node_in_second_chapter.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\312-R176_create_node_second_chapter_via_accessible_button.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\314-R177_scroll_left_sidebar_for_create_buttons_second_chapter.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\315-R178_create_node_second_chapter_after_scroll.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\316-R178_save_node_second_chapter_after_scroll.jpg`

## GUI-CONT-041：Engine Telemetry 下 Source Drawer 视觉不可达

步骤：
- 在 Engine Telemetry 主题下切到第二章。
- 点击顶部 `源文本` 展开 Source Drawer。
- 再次收起/展开验证是否为一次性渲染问题。
- 切回默认叙事工作台主题后重复打开 Source Drawer。

实际结果：
- Engine Telemetry 主题下 accessibility tree 能看到 Source Drawer 的编辑器和 `第 27-32 行` 切片信息，但画面上只稳定显示底部 `源文本 Dock` 栏，正文编辑区视觉不可达。
- 重复收起/展开仍未恢复。
- 切回默认主题后 Source Drawer 能正常显示诊断列表、章节切片源码和保存按钮。

判定：FAIL。

严重级别：P1。主题覆盖导致关键编辑面板视觉不可用，虽非默认主题，但属于官方内置主题的核心编辑路径缺陷。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\317-R179_open_source_drawer_second_chapter.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\318-R180_engine_theme_source_drawer_retoggle_second_chapter.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\319-R181_open_theme_center_to_restore_default.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\320-R181_restore_default_theme_clicked.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\323-R183_reopen_source_drawer_default_second_chapter.jpg`

## GUI-CONT-042：Source Drawer 跨章节草稿与保存语义

步骤：
- 默认主题下打开第二章 Source Drawer。
- 用真实键盘在第二章切片末尾输入 `SOURCE_R184_SECOND_CHAPTER_DIRTY`。
- 不点击保存，切换到第一章，再切回第二章。
- 点击 `保存切片`，检查磁盘。
- 再执行 `Ctrl+S` 全局保存并检查磁盘。

实际结果：
- 输入后 Source Drawer 显示 `未保存`，保存和还原按钮启用。
- 未保存状态切到第一章时没有弹窗；切回第二章后草稿仍保留，没有污染第一章。
- 点击 `保存切片` 后 UI 显示 `已保存章节源码: 第一章 2`，按钮变 disabled，但磁盘文件尚未包含 `SOURCE_R184_SECOND_CHAPTER_DIRTY`。
- 再执行全局 `Ctrl+S` 后，磁盘文件才包含该文本，且位于 `# 第一章 2` 章节内。

判定：PASS_WITH_P1_COPY_RISK。

严重级别：P1。数据最终可通过全局保存落盘，但 `保存切片` 的“已保存”文案容易被用户理解为已写入磁盘；如果用户随后关闭或触发其他流程，存在误判保存状态的风险，需要把文案改为“已提交到文档，仍需保存文件”或直接触发文件保存。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\324-R184_source_drawer_second_chapter_dirty_unsaved.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\325-R185_switch_to_first_chapter_with_dirty_slice.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\326-R186_back_to_second_chapter_after_dirty_switch.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\327-R187_save_second_chapter_slice_after_switch_return.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\328-R187b_ctrl_s_after_source_slice_saved_claim.jpg`

## GUI-CONT-043：HTML/TXT 真实系统导出

步骤：
- 打开应用内导出对话框。
- 分别选择 HTML 和 TXT。
- 在真实 Windows 保存对话框中输入文件名并保存到 `outputs-r130-continue`。
- 读取磁盘文件，验证内容包含当前故事核心文本。

实际结果：
- HTML 与 TXT 原生保存对话框标题均为 `导出 PlotFlow 文件`，未见乱码。
- `R188-export.html` 写入成功，大小 10578 bytes，包含当前故事内容。
- `R189-export.txt` 写入成功，大小 225 bytes，包含当前故事内容。
- HTML 导出中途发现一个可达性问题：如果焦点误落到 `保存类型` 下拉而非文件名输入框，应用内导出按钮会保持 `导出中...`，需要重新聚焦文件名并保存后才能恢复。最终未造成文件丢失，但对普通用户有卡住感。

判定：PASS_WITH_P2_UX_RISK。

严重级别：P2。导出功能可完成，保存对话框标题正常；但导出中状态依赖原生对话框完成，误焦点时反馈不够明确。

证据截图与文件：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\329-R188_open_export_dialog_for_html.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\330-R188_html_native_save_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\337-R188b_html_dialog_before_filename_precise.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\338-R188b_html_dialog_filename_precise_typed.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\339-R188b_after_html_dialog_precise_save.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\340-R189_open_export_dialog_for_txt.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\341-R189_txt_native_save_dialog.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\342-R189_txt_dialog_filename_typed.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\343-R189_after_txt_export_saved.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\outputs-r130-continue\R188-export.html`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\outputs-r130-continue\R189-export.txt`

## GUI-CONT-044：重启后的 Home/Graph Lab 状态表达

步骤：
- 保存当前文件。
- 关闭安装版。
- 重新启动安装版。
- 观察初始界面。
- 点击 `继续编辑`。

实际结果：
- 关闭时未出现未保存提示，说明全局保存后的退出路径正常。
- 重启后初始界面显示 Home 入口卡片，同时顶部仍处于 Graph Lab 选中状态，底层还有 Graph Lab shell 和未保存空故事状态，视觉上像 Home 与 Graph Lab 叠层。
- 点击 `继续编辑` 后能恢复最近文件，显示 `R154-source-drawer-saved.mdstory`、2 章、3 节点。

判定：PASS_WITH_P2_UX_RISK。

严重级别：P2。恢复链路可用，但重启初屏的模式状态表达不清晰，容易让用户误以为已经打开 Graph Lab 空白故事。

证据截图：
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\344-R190_relaunch_installed_after_export_and_save.jpg`
- `D:\VibeCoding\PlotFlow\测试反馈\installed-gui-e2e-computeruse-2026-07-08\345-R191_continue_editing_after_relaunch.jpg`

## R172-R191 结论

- 本轮新增 20 轮以上真实安装版 GUI 覆盖，主要覆盖 Graph Lab 拖拽布局、章节新增、第二章节点创建、Source Drawer 跨章节草稿、官方主题切换、HTML/TXT 系统导出、关闭重启和 Continue editing。
- 新增正向证据：布局可落盘并重启恢复；第二章 Source Drawer 编辑不会合并章节；HTML/TXT 导出真实写入磁盘；默认主题 Source Drawer 可用；Continue editing 能恢复最近文件。
- 新增阻断或风险：Engine Telemetry 主题下 Source Drawer 视觉不可达；`保存切片` 文案显示已保存但未写入磁盘，必须再全局保存；新增章节命名为 `第一章 2`；第二章节点创建按钮需要滚动才稳定可达；重启初屏 Home/Graph Lab 状态表达混杂。
- 结合 R130-R171 既有阻断项，当前发行 GUI gate 结论仍为：**installed GUI smoke failed**。不得写 `release-candidate passed`。

# 最终索引：R172-R191 续跑已完成

- 最新执行范围：R172-R191。
- 最新证据截图范围：`306-R172_start_state_after_goal_resume.jpg` 至 `345-R191_continue_editing_after_relaunch.jpg`。
- 最新输出文件：`R188-export.html`、`R189-export.txt`、`R154-source-drawer-saved.mdstory`。
- 最新正向证据：Graph Lab layout 持久化、第二章 Source Drawer 切片编辑、HTML/TXT 导出、默认主题恢复、安装版重启与 Continue editing。
- 最新阻断项仍包含：1000 节点 Graph Lab `RangeError`、外部冲突保存误报、Engine Telemetry Source Drawer 视觉不可达、Source Drawer 保存文案与磁盘保存语义不一致。
- 最新发行 GUI gate 结论：**installed GUI smoke failed**。不得写 `release-candidate passed`。
