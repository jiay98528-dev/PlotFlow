# 2026-06-23 Release Blocker Fix Plan

## 目标

只修复当前发行阻断中的第一批测试层问题，保持范围收敛，不扩展到 UI 审计、色值规范、PNG/CI 大改或产品逻辑重构。

## 已完成的局部修复

- 暗色冷启动 Monaco 已修复并验证，`dark` localStorage 重启后仍为 `vs-dark`
- 命令行打开 `.mdstory` 已修复并验证，ASCII sentinel 可加载进编辑器
- `diagnosticsDecorator` 装饰泄漏已修复，已改为 `createDecorationsCollection().set()/clear()`
- `decoration-leak` 测试已存在
- `Backspace/ArrowUp` 原故障当前未复现
- `pnpm.cmd lint` 之前已到 `0 error`，仅 warning
- `pnpm.cmd typecheck` 通过
- `pnpm.cmd build` 通过

## 剩余阻断项

1. `packages/core/src/__tests__/fuzz-parser.test.ts` 的 fuzz 性能阈值存在单次波动失败，需要改成稳定且仍能识别真实退化的测法
2. `packages/app/e2e` 下的 Playwright 配置与测试文件路径/匹配规则需要对齐
3. `packages/app/e2e/condition-editor.e2e.ts` 的 Electron 主入口路径有越级问题，且 `afterAll` 需要防御 `electronApp` 未初始化
4. `packages/app/e2e/export.e2e.spec.ts` 里的 IPC 常量在 `electronApp.evaluate()` 闭包中未正确传入
5. `packages/app/e2e/parser-validator-e2e.spec.ts` 里的 `electronApp.evaluate()` 闭包未正确接收 `content`

## 执行顺序

1. 先修 fuzz 稳定性，避免测试抖动继续阻塞
2. 再修 `packages/app/e2e` 的测试辅助和入口路径问题
3. 最后跑最小验证，确认当前批次修复没有引入新的测试层错误

## 验收命令

- `pnpm.cmd test`
- `pnpm.cmd --filter @plotflow/app exec playwright test --config e2e/playwright.config.ts`

## 2026-06-23 Parser/Validator E2E 验收更新

当前 Parser/Validator E2E 阻断分两层处理：公共 helper/minimap DOM 稳定性问题已按单文件套件通过记录保留；后续暴露的 TC-6 `afterAll` 关闭 Electron 超时已通过 race-safe teardown 修复。2026-06-25 复核中默认 app E2E 当前为 37/37 passed，新增 Graph Lab 叙事工作台、内容浏览器与 Theme Pack E2E 均通过；ExportDialog 自动关闭竞态已通过 race-safe `closeExportDialog()` 修复。

### 已确认根因

1. `parser-validator-e2e.spec.ts` 的公共 `loadContentIntoEditor()` 同时等待内容注入和 React Flow 节点渲染，导致只需要诊断的 E001/E002/E007 用例被错误耦合到图渲染。
2. 默认 minimap 下 `onlyRenderVisibleElements={true}` 在“错误 AST/空图 -> 有效 AST”切换后未稳定恢复节点 DOM；`graphStore.nodes` 已更新，但 `.react-flow__node` 为空。

### 已完成修复

- `loadContentIntoEditor()` 仅负责测试态直连注入和内容同步确认。
- 新增 `waitForDiagnostic(page, code)`，按诊断语义等待 `editorStore.diagnostics`。
- 新增 `waitForGraphStatus(page, status)`，仅 W001/W002 图状态用例等待 DOM class。
- 测试态 `__test_store__` 增加 `getDiagnostics()`。
- `GraphCanvas` 将 `onlyRenderVisibleElements` 限定为 split 模式，minimap 关闭该裁剪以保证 DOM 稳定恢复。

### 验收结果

- `pnpm.cmd --filter @plotflow/app exec playwright test --config e2e/playwright.config.ts e2e/parser-validator-e2e.spec.ts --workers=1`：6 passed。
- `pnpm.cmd --filter @plotflow/app exec playwright test --config e2e/playwright.config.ts e2e/parser-validator-e2e.spec.ts -g "Ctrl\\+Shift\\+M" --workers=1 --repeat-each=5`：5 passed。
- `pnpm.cmd --filter @plotflow/app test:e2e`：29 passed，无 teardown error，无 did-not-run。
- `pnpm.cmd lint`：0 errors，8 existing no-console warnings。
- `pnpm.cmd typecheck`：passed。
- `pnpm.cmd test`：39 files / 1222 tests passed。
- `pnpm.cmd build`：passed。
- `pnpm.cmd lint:css`：passed。
- `pnpm.cmd audit --audit-level moderate`：passed；项目已迁移到 Electron 42.5.0，无 GHSA ignore，返回 `No known vulnerabilities found`。

详细记录见 `spec/audit/2026-06-23-parser-validator-e2e-fix-validation.md`。

## 2026-06-23 进度权威与剩余门禁更新

当前文档同步后的权威状态如下：

| 门禁 | 状态 | 说明 |
|------|------|------|
| `pnpm.cmd lint` | ✅ PASS | 0 error，8 个既有 `no-console` warning |
| `pnpm.cmd typecheck` | ✅ PASS | TypeScript strict 通过 |
| `pnpm.cmd test` | ✅ PASS | 39 files / 1222 tests |
| `pnpm.cmd build` | ✅ PASS | 保留 1 个 Vite 动态/静态 import warning |
| `pnpm.cmd lint:css` | ✅ PASS | CSS 门禁通过 |
| `pnpm.cmd --filter @plotflow/app test:e2e` | ✅ PASS | 37 passed；无 teardown error |
| `pnpm.cmd audit --audit-level moderate` | ✅ PASS | Electron 42.5.0；无 GHSA ignore；No known vulnerabilities found |
| `pnpm.cmd package:win` | ✅ PASS | 生成 `release/PlotFlow Setup 0.1.0.exe` 与 `release/win-unpacked/PlotFlow.exe` |
| Windows packaged smoke | ✅ PASS | packaged exe 启动、命令行打开 `.mdstory`、Graph Lab GUI 编辑、Source Drawer、JSON 导出通过 |

下一轮发行阻断修复优先级：

1. 旧 Electron 风险接受已废止；当前正式包基于 Electron 42.5.0。
2. macOS/Linux 安装包、自动更新、GitHub Release、首次启动引导仍未进入本轮范围。
3. CI 对 full E2E/audit/stylelint/placeholder/color scan 的发行门禁覆盖仍需复核。
