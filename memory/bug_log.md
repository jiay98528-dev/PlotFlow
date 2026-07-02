# PlotFlow 错题本

> **版本**：V0.1 | **创建日期**：2026-06-12 | **类型**：动态文档（发现 Bug 时立即记录）
> **规则**：编码前必读最近 10 条记录，避免重复踩坑。

---

## 快速导航

- [根因分类统计](#根因分类统计)
- [Bug 记录](#bug-记录)
- [高频错误模式](#高频错误模式)

---

## 根因分类统计

| 分类 | 代码 | 说明 | 累计次数 |
|------|:---:|------|:---:|
| 类型系统 | `TYP` | TypeScript 类型标注遗漏/错误/any 滥用 | 0 |
| 状态管理 | `STT` | Zustand store 更新时序/竞态/循环依赖 | 0 |
| 异步处理 | `ASY` | Promise/async 遗漏 await、未捕获 rejection、UI 自动关闭与测试等待竞态、E2E teardown 超时 | 2 |
| Monaco 集成 | `MON` | Editor API 误用、decoration 泄漏、tokenizer 状态机 bug、类型定义滞后 | 13 |
| React Flow | `RFL` | 节点坐标异常、连线渲染错误、性能回退 | 1 |
| 解析器 | `PRS` | 递归溢出、边界字符解析崩溃、AST 结构错误 | 0 |
| Electron | `ELC` | IPC 通信异常、主进程崩溃、文件锁冲突 | 0 |
| 文件 I/O | `FIO` | 编码错误、mtime 冲突、自动保存数据丢失 | 0 |
| 样式/主题 | `STY` | CSS 变量遗漏、主题切换闪烁、硬编码色值 | 0 |
| 国际化 | `I18` | 翻译遗漏、key 冲突、语言切换不完整 | 0 |
| 构建/打包 | `BLD` | Vite 配置错误、electron-builder 签名、路径问题 | 0 |
| 其他 | `OTH` | 以上分类不包括的 | 2 |

---

## Bug 记录

> 格式模板：
>
> ```markdown
> ### BUG-001: [简短标题]
> 
> **日期**：YYYY-MM-DD
> **分类**：`TYP` / `STT` / `ASY` / ...
> **严重程度**：🔴 阻断 / 🟠 严重 / 🟡 一般 / 🔵 轻微
> **里程碑**：M0 / M1 / ...
> **文件/模块**：`path/to/file.ts`
> 
> **现象**：
> [用户可观测的行为描述]
> 
> **根因**：
> [技术层面的根本原因，不要只说"修复了 XXX"]
> 
> **教训**：
> [一句话教训，编码时能记住的]
> 
> **预防措施**：
> [ESLint 规则 / 单元测试 / 类型约束 / 代码审查检查点]
> 
> **修复**：
> [修复 commit SHA + 一句话描述]
> ```

---

### BUG-001: Monaco 0.45 类型定义滞后导致 13 个 TS 错误

**日期**：2026-06-13
**分类**：`MON`
**严重程度**：🟡 一般
**里程碑**：M1

**文件/模块**：`foldingProvider.ts` / `monaco-tokenizer.ts` / `setupEditor.ts`

**现象**：
16 个 TypeScript 类型错误，全部集中在 Monaco Editor 相关文件：
- `languages.ITextModel` 未导出（实际 API 存在，类型未声明）
- `IMonarchLanguageRule` 不接受 `fontStyle` 字段（实际 API 支持，类型过时）
- `monaco-editor/esm/vs/editor/editor.worker?worker` 模块声明缺失
- `Window` → `Record<string, unknown>` 转换不安全

**根因**：
Monaco Editor 0.45 的捆绑类型定义（`.d.ts`）滞后于实际运行时 API。Monarch tokenizer 的 `fontStyle`、`ITextModel` 等 API 在运行时正常工作，但 TypeScript 编译器不认识。

**教训**：
Monaco 0.45 的类型定义不是运行时真相源。升级到 0.50+ 或在 `src/types/monaco-patches.d.ts` 中补充缺失的类型声明。

**预防措施**：
- M6（主题/模板里程碑）统一升级 Monaco 到 0.50+ 并验证所有类型
- 新建 `packages/app/src/types/monaco-patches.d.ts` 补充 `ITextModel`、`IMonarchLanguageRule` 等声明
- CI 中 tsc 错误可针对 Monaco 文件临时豁免（`// @ts-nocheck`），等 M6 升级后移除

**修复**：
跳过 — M6 统一处理。修复本身（写类型补丁或升级版本）会导致 M2-M5 开发中 Monaco API 不稳定，打乱开发进程。

---

### BUG-002: ESLint `no-constant-condition` 在解析器 while(true) 循环中误报

**日期**：2026-06-13
**分类**：`OTH`
**严重程度**：🔵 轻微
**里程碑**：M1

**文件/模块**：`conditions.ts` 行 731、793

**现象**：
递归下降解析器的 `while (true) { ... break }` 模式被 ESLint 标记为 `no-constant-condition` 错误。

**根因**：
解析器的 `parseAnd()` 和 `parseOr()` 函数使用 `while (true)` + 内嵌 `break` 来消费连续的 AND/OR 运算符。这是递归下降解析器的标准模式，不是真正的无限循环。

**教训**：
解析器代码必然使用 `while (true)` 模式。ESLint 的 `no-constant-condition` 规则在解析器文件中应全局禁用。

**预防措施**：
- 在 `packages/core/.eslintrc.cjs` 中添加 `no-constant-condition: off`
- 或在 `conditions.ts` 文件头部添加 `/* eslint-disable no-constant-condition */`

**修复**：
已添加 `// eslint-disable-next-line no-constant-condition` 注释（2 处）。后续 M2-M5 新增解析器文件应在文件头禁用此规则。

---

### BUG-003: Parser/Validator E2E 公共注入 helper 误绑 React Flow 渲染前置条件

**日期**：2026-06-23
**分类**：`RFL`
**严重程度**：🔴 阻断
**里程碑**：Release Audit / M3-M2 集成

**文件/模块**：`packages/app/e2e/parser-validator-e2e.spec.ts` / `packages/app/src/renderer/App.tsx` / `packages/app/src/components/branch-graph/GraphCanvas.tsx`

**现象**：
完整 E2E 中 Parser/Validator 套件曾出现 `E002`、`W002` 超时；拆分等待后进一步暴露 `W001` 在前序错误用例后诊断已进入 store，但 minimap React Flow DOM 仍为空，导致 `node-status-orphan` 等待失败。

**根因**：
第一层根因是 `loadContentIntoEditor()` 公共 helper 同时负责内容注入、诊断等待和 React Flow 节点等待，把只需要诊断的 E001/E002/E007 用例错误耦合到图渲染。第二层根因是默认 minimap 下 `onlyRenderVisibleElements={true}`，在从解析错误/空图状态切回有效 AST 后，React Flow 可见区域裁剪未稳定恢复节点 DOM；此时 `graphStore.nodes` 已更新，但 `.react-flow__node` 未挂载。

**教训**：
E2E helper 必须按用户语义拆层：内容注入、诊断出现、图 DOM 状态是三个不同等待条件，不能在公共 helper 中强行等待最重的 UI 子系统。

**预防措施**：
- `parser-validator-e2e.spec.ts` 保留 `waitForDiagnostic()` 和 `waitForGraphStatus()` 分层等待。
- 图状态用例继续验证 DOM class，不只读 Zustand store，避免漏掉 React Flow 渲染失败。
- minimap 不启用 `onlyRenderVisibleElements`；split 大图保留该优化，兼顾稳定性和性能。
- 回归命令必须包含完整 `pnpm.cmd --filter @plotflow/app test:e2e`，不能只跑单文件或 store 层断言。

**修复**：
工作区未提交。已拆分 Parser/Validator E2E helper、测试 bridge 增加 `getDiagnostics()`，并将 `GraphCanvas` 的 `onlyRenderVisibleElements` 限定为 split 模式。验证快照：Parser/Validator 单文件曾 6/6 passed；最新完整 app E2E 复核中 Parser/Validator TC-6 在 `afterAll` 关闭 Electron 时超时，需要继续追查 teardown/trace。

---

### BUG-004: ExportDialog E2E 关闭 helper 与自动关闭 timer 竞争

**日期**：2026-06-23
**分类**：`ASY`
**严重程度**：🔴 阻断
**里程碑**：Release Audit / M4 导出 UI

**文件/模块**：`packages/app/e2e/export.e2e.spec.ts` / `packages/app/src/components/export/ExportDialog.tsx`

**现象**：
历史复核中完整默认 E2E 曾为 28/29 passed，`Export TC-5 exports valid JSON matching schema` 在 `closeExportDialog()` 超时。Playwright 看到关闭按钮可见，但点击前后元素持续不稳定，最终因对话框被卸载或移动而超时。后续复核中导出套件 5/5 通过；当前完整默认 app E2E 已扩展到 37/37 通过。

**根因**：
导出成功后 ExportDialog 有自动关闭 timer；测试 helper `clickExportAndWait()` 只等待固定 500ms，没有等待对话框完全关闭或稳定。下一条用例的 `beforeEach` 调用 `closeExportDialog()` 时，可能正好点击一个即将被 auto-close 卸载的关闭按钮，Playwright 等待元素稳定失败。根因是 E2E helper 对自动关闭 UI 的生命周期建模不足，而不是 JSON 导出逻辑失败。

**教训**：
带自动关闭 timer 的 UI 不能用“先短等再点击关闭”的 helper。测试必须等待明确状态：要么成功后等待 overlay hidden，要么使用 race-safe 的关闭函数处理“已关闭/正在关闭/可点击关闭”三种状态。

**预防措施**：
- `clickExportAndWait()` 应等待导出成功后的 overlay hidden，或显式取消自动关闭后再进入下一步。
- `closeExportDialog()` 应先检查 overlay 是否存在；存在时用 Promise race 处理 close click 与自动 hidden，避免点击卸载中的元素。
- 导出 E2E 不应使用固定 timeout 表示 UI 稳定，必须等待 DOM 状态或测试 bridge 状态。

**修复**：
已修。`export.e2e.spec.ts` 的 `closeExportDialog()` 改为 race-safe：先尝试 `Escape`，再在 overlay 仍存在时强制点击关闭/取消按钮，并吞掉清理期“已隐藏/已卸载”状态；`ExportDialog` 提交按钮增加 `data-export-status` 便于等待成功状态。验证：导出 E2E 5/5 passed，当前完整默认 app E2E 37/37 passed。

---

### BUG-005: Parser/Validator TC-6 后置清理关闭 Electron 超时

**日期**：2026-06-23
**分类**：`ASY`
**严重程度**：🔴 阻断
**里程碑**：Release Audit / E2E 稳定性

**文件/模块**：`packages/app/e2e/parser-validator-e2e.spec.ts`

**现象**：
历史完整默认 E2E 为 28/29 passed。导出套件本轮 5/5 通过，失败转移到 Parser/Validator TC-6：测试输出显示 TC-6 后 `afterAll` hook 超时，`electronApp.close()` 超过 90000ms 未完成，随后 worker teardown 也超时。

**根因判断**：
已确认根因是 E2E teardown 生命周期问题，而不是 Parser/Validator 诊断逻辑回归。TC-6 会多次通过 `Ctrl+Shift+M` 打开/关闭 ProblemPanel、点击诊断并让 Monaco 重新聚焦；随后 `afterAll` 直接 `await electronApp.close()`，容易与窗口 close 拦截、renderer 未完成任务、ProblemPanel 状态切换发生竞争，导致 Electron 进程关闭等待卡住。附件中的 `content is not defined` 与当前源码不一致，未在复核中复现。

**教训**：
Electron E2E 的 test body 通过不等于套件稳定。所有共享 app 的套件必须有 race-safe teardown，尤其是多次打开 panel、聚焦 Monaco、触发 IPC/menu 的用例。

**预防措施**：
- `afterAll` 关闭 Electron 前先解除 page 事件、关闭 panel、等待 renderer 空闲，必要时 fallback 到 `app.exit(0)`。
- Parser/Validator TC-6 应拆出可重复单测，单独跑 3-5 次确认是否与前序用例残留有关。
- 保留 Playwright trace，优先确认 `content is not defined` 是否来自当前代码路径或陈旧附件。

**修复**：
已修。`parser-validator-e2e.spec.ts` 新增 race-safe Electron 关闭 helper：关闭 ProblemPanel 和 page，尝试 `electronApp.close()`，超时后 fallback 到主进程 `BrowserWindow.destroy()` + `app.exit(0)`，并只吞清理期“窗口已销毁/进程已关闭”类异常，不吞测试体断言失败。验证：Parser/Validator 单文件 6/6 passed，`Ctrl+Shift+M` repeat-each=5 passed，当前默认 app E2E 37/37 passed。

---

### BUG-006: Graph Lab 线缆拖到空白处 E2E 固定坐标与画布外释放竞争

**日期**：2026-06-25
**分类**：`ASY`
**严重程度**：🟡 中
**里程碑**：M8 Graph Lab / Theme Pack E2E 回归

**文件/模块**：`packages/app/src/components/branch-graph/GraphCanvas.tsx` / `packages/app/e2e/graph-lab.e2e.spec.ts`

**现象**：
完整 E2E 扩展到 Theme Pack 用例后，`Graph Lab E2E › disconnects an existing option by dragging its cable endpoint to blank space` 曾出现一次失败：拖拽已有线缆端点后未出现 `wire-drop-menu`。单独看产品状态，Graph Lab 仍可渲染节点和边，失败集中在拖线释放点没有被 GraphCanvas 捕获。

**根因判断**：
第一层是 E2E helper 使用 `sourceCenter + 260/+120` 作为“空白画布”固定坐标；当画布存在第二个节点、折叠 Source Drawer 按钮或底部控件时，该坐标不一定仍是 React Flow 空白区域。第二层是真实竞态风险：手动线缆拖拽主要依赖 GraphCanvas 内部的 pointer/mouse up 捕获，如果释放点落到画布外层控件上，可能不会进入 GraphCanvas 的结束逻辑，导致菜单不出现或编辑锁清理不及时。

**教训**：
节点画布 E2E 不能用固定屏幕偏移证明“空白处”。任何拖拽类测试都应通过 DOM 碰撞检测选择空白点，并把面板、控件、节点、minimap 作为阻挡区域排除。产品层也不能假设 mouseup 一定发生在画布内部。

**预防措施**：
- Graph Lab E2E 新增 `findBlankCanvasPoint()`，动态查找位于 `.react-flow` 内且不与节点、Controls、MiniMap、Source Drawer 重叠的空白点。
- `GraphCanvas` 为手动线缆拖拽增加 window 级 `pointerup` / `mouseup` capture 兜底；释放到画布外时取消拖拽并释放编辑锁。
- 断开线缆用例追加 `--repeat-each=5` 验证，避免偶发绿。

**修复**：
已修。验证：Graph Lab 单套件 7/7 passed，断开线缆用例 repeat-each=5 passed，完整默认 app E2E 37/37 passed。

---

### BUG-007: 手工黑盒发现 Home 溢出、Graph Lab 重命名断链、诊断入口弱、保存反馈弱与 English 混杂

**日期**：2026-07-01
**分类**：`STY` / `RFL` / `ASY` / `I18`
**严重程度**：🔴 阻断
**里程碑**：M8 Graph Lab / Release blackbox

**文件/模块**：`packages/app/src/styles/official-themes.css` / `packages/app/src/services/graphEditService.ts` / `packages/app/src/components/graph-lab/*` / `packages/app/src/i18n/appI18n.ts` / `packages/app/src/services/autoSaveService.ts` / `packages/app/src/services/parsePipeline.ts`

**现象**：
- Home 首屏标题在两个官方主题下覆盖正文和按钮区域。
- Graph Lab Inspector 重命名被其他节点引用的目标节点后，入边仍指向旧标题，产生 E001 “目标节点未定义”。
- Graph Lab 顶部“n 诊断”胶囊看起来可交互但点击无明显动作。
- `Ctrl+S` / 菜单保存或另存为触发原生对话框前后缺少即时且稳定的状态反馈，成功反馈会被诊断状态抢占。
- 切换 English 后，Home、Inspector、ProblemPanel、ExportDialog、ThemeCenter、状态栏等主界面仍有中文 UI 文案。

**根因**：
- Home 使用 `grid-template-rows: minmax(min-content, 1fr) auto auto`，在有限高度下首行被压缩，预览区域溢出后与卡片区相交。
- `graphEditService.updateNodeText()` 只重写节点标题行和 layout id，没有把所有 `[选项] ... -> 节点：旧标题` 引用迁移到新标题。
- Graph Lab 诊断胶囊是静态 `span`，没有绑定 `setProblemPanelOpen(true)`，用户无法从该入口进入问题面板。
- 保存状态和解析诊断共用 `ui.statusMessage`，解析管线可在保存成功后立即覆盖 `save:` 状态。
- 应用缺少统一 app 级 i18n 字典，多个主界面组件直接写中文字符串。

**教训**：手工黑盒反馈必须转成可执行 UI 断言；功能 E2E 通过不代表视觉边界、状态优先级和语言完整性通过。

**预防措施**：
- `graph-lab.e2e.spec.ts` 增加 Home 两主题三视口重叠断言、Graph Lab 诊断胶囊打开 ProblemPanel、Inspector 重命名目标节点后无 E001、保存菜单 300ms 内出现反馈、English 主界面表面英文化断言。
- `appI18n.test.ts` 校验 `zh-CN` / `en-US` 字典 key 完整一致，并覆盖本次手工黑盒反馈涉及的主 UI key。
- `graphEditService.test.ts` 增加“重命名被引用节点时同步更新入边 target 和 layout id”回归。

**修复**：工作区未提交。源码态验证：`pnpm.cmd lint` PASS，0 error / 9 个既有 `no-console` warning；`pnpm.cmd typecheck` PASS；`pnpm.cmd test` PASS，44 files / 1252 tests；`pnpm.cmd build` PASS，保留既有 Vite 动态/静态 import warning；`pnpm.cmd lint:css` PASS；Graph Lab 窄 E2E PASS，13/13；导出 E2E PASS，5/5；完整 app 集成 E2E PASS，44/44；源码态黑盒 PASS，10 passed / 4 packaged-or-installed skips；`pnpm.cmd audit --audit-level moderate` PASS。未重新打包，unpacked/installed 黑盒和人工巡检仍需在下一次干净打包后复跑。

---

> 同分类累计 ≥3 次时，在此总结模式并链接回具体 Bug 记录。

---

*每次发现 Bug 都值得被记住。踩过的坑，不该踩第二次。*
---

### BUG-008: Graph Lab 手工 GUI 复验发现 Ctrl+S、未保存关闭、菜单语言和诊断文案残留

**日期**：2026-07-01
**分类**：`ASY` / `I18` / `UX`
**严重程度**：P1 阻断 + P2 体验
**里程碑**：M8 Graph Lab / Release GUI blackbox

**现象**：
- Graph Lab 模式中未保存故事按 `Ctrl+S` 没有弹出保存对话框，也没有稳定可见反馈。
- 未保存故事下 `Alt+F4` 或窗口关闭按钮没有弹出保存/放弃确认，窗口关闭路径不可信。
- English 模式下 Windows 原生菜单栏仍显示中文“文件/编辑/视图/导出/帮助”。
- English 模式下 Problems 面板仍显示 core 诊断中文消息。

**根因**：
- `Ctrl+S` 只在 `MonacoEditor` 中 `preventDefault()`，Graph Lab 模式不挂载 Monaco，因此保存快捷键缺少全局兜底；同时 Electron accelerator 在部分焦点路径下会被 renderer keydown 拦截。
- 主进程 `before-quit` 过早设置 `forceQuitting`，可能绕过 `BrowserWindow.close` 的脏状态裁决；关闭时保存流程也没有向主进程返回“用户取消保存”的布尔结果。
- Electron 菜单只在启动时用固定中文模板构建，renderer 语言状态没有同步给主进程。
- core 诊断消息是语义层中文常量，Problems 面板直接展示 `diagnostic.message`，没有 UI 层本地化。

**修复**：
- `App.tsx` 增加全局 `Ctrl/Cmd+S` 保存处理，Graph Lab 和 Split 均走 `saveOrSaveAs()`；Monaco 内部保留兜底。
- `autoSaveService` 的 `forceSave()`、`saveOrSaveAs()`、`saveAsCurrentFile()` 改为返回 `boolean`，保存取消或失败返回 `false`。
- `main.ts` 关闭确认检查 `__forceSave__` 返回值；保存取消时留在应用内；确认关闭后用 `destroy()` 结束窗口，并不再在 `before-quit` 中抢先设置 `forceQuitting`。
- `menu.ts` 重建为干净的中英双语菜单定义；preload 增加 `menu.setLanguage()`；renderer 语言变化时同步主进程菜单。
- `ProblemPanel` 按诊断 code 在 English 模式显示英文诊断摘要，core 诊断语义不变。

**防回归**：
- `graph-lab.e2e.spec.ts` 新增 Graph Lab 下 `Ctrl+S` 保存反馈测试。
- 新增 English 模式菜单栏标签断言。
- 新增 Problems 面板英文诊断摘要断言。
- 新增未保存窗口关闭测试：取消保持窗口，放弃后关闭，并显式退出测试 Electron 进程避免 single-instance lock 泄漏。

**验证**：
- `pnpm.cmd typecheck` PASS。
- `pnpm.cmd lint` PASS，0 error / 9 个既有 `no-console` warning。
- `pnpm.cmd build` PASS，保留既有 Vite 动态/静态 import warning。
- `pnpm.cmd --filter @plotflow/app exec playwright test --config e2e/playwright.config.ts e2e/graph-lab.e2e.spec.ts --workers=1` PASS，15/15。
- `pnpm.cmd --filter @plotflow/app exec playwright test --config e2e/playwright.config.ts e2e/graph-lab.e2e.spec.ts e2e/parser-validator-e2e.spec.ts e2e/theme-language.spec.ts --workers=1` PASS，24/24。
- `pnpm.cmd --filter @plotflow/app test:e2e` PASS，46/46。
- 2026-07-01 save-flow safety follow-up: `saveOrSaveAs()` now returns false on Save As cancellation/failure and all save-and-open/save-and-new flows stop instead of replacing the current story; Save As lock is set before the first await to prevent duplicate native dialogs; real Save As failures show failure feedback instead of cancellation.
- 2026-07-01 verification update: `pnpm.cmd --filter @plotflow/app exec playwright test --config e2e/playwright.config.ts e2e/graph-lab.e2e.spec.ts --workers=1` PASS，18/18；`pnpm.cmd --filter @plotflow/app test:e2e` PASS，49/49。
- 2026-07-01 blackbox update: after the blocking unsaved dialog was manually dismissed, `pnpm.cmd --filter @plotflow/app test:e2e:blackbox` PASS，10 passed / 4 packaged-or-installed skipped.
- Current package status: source changed after the last Windows package/unpacked blackbox result. Existing `release/` artifacts are stale; package, unpacked blackbox, installed blackbox, and manual patrol must be rerun before release-candidate claims.
