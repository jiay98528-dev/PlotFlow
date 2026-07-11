# 2026-06-23 Parser/Validator E2E 修复验收记录

## 范围

本次只修复 `packages/app/e2e/parser-validator-e2e.spec.ts` 当前失败，不处理 `pnpm audit` 漏洞、CI full E2E 接入等独立发行门禁。

## 问题

完整 E2E 中 Parser/Validator 套件曾失败：

- `E002 undeclared variable shows red wave underline`
- `W002 dead-end node shows yellow wave + gray graph border`

第一轮修复后，`E001/E002/E007/W002/Ctrl+Shift+M` 通过，但 `W001 orphan node` 在完整顺序中超时。

## 根因

1. `loadContentIntoEditor()` 公共 helper 同时做内容注入、诊断等待和 React Flow 节点等待。E001/E002/E007 只需要诊断，却被强制等待 `.react-flow__node`，导致在错误状态或无图状态下超时。
2. 拆分等待后暴露第二层问题：默认 minimap 下 `onlyRenderVisibleElements={true}`，从解析错误/空图状态切回有效 AST 后，`graphStore.nodes` 已有节点，但 React Flow DOM 未稳定挂载，`node-status-orphan` 等待失败。

## 修复

- `parser-validator-e2e.spec.ts`
  - `loadContentIntoEditor()` 缩小为只做 `setEditorContent(content)` 和等待 `getEditorContent() === content`。
  - 新增 `waitForDiagnostic(page, code)`，只等待 `editorStore.diagnostics` 出现目标诊断。
  - 新增 `waitForGraphStatus(page, status)`，只在 W001/W002 图状态用例中等待 DOM class。
- `App.tsx` / `electron.d.ts`
  - 测试态 `__test_store__` 增加 `getDiagnostics()`，不暴露到生产环境。
- `GraphCanvas.tsx`
  - `onlyRenderVisibleElements` 改为仅 split 模式启用；minimap 关闭该裁剪，保证状态切换后节点 DOM 稳定恢复。

## 验收结果

| 命令 | 结果 |
|---|---|
| `pnpm.cmd --filter @plotflow/app exec playwright test --config e2e/playwright.config.ts e2e/parser-validator-e2e.spec.ts --workers=1` | PASS，6 passed |
| `pnpm.cmd --filter @plotflow/app test:e2e` | PASS，当前 37 passed；teardown 超时已修复，Graph Lab 叙事工作台、内容浏览器与 Theme Pack E2E 已加入 |
| `pnpm.cmd lint` | PASS，0 errors，8 existing no-console warnings |
| `pnpm.cmd typecheck` | PASS |
| `pnpm.cmd test` | PASS，39 files / 1222 tests |
| `pnpm.cmd build` | PASS，保留既有 Vite dynamic/static import warning |
| `pnpm.cmd lint:css` | PASS |
| `pnpm.cmd audit --audit-level moderate` | PASS；Electron 42.5.0；无 GHSA ignore；No known vulnerabilities found |

## 防回归要求

- Parser/Validator E2E helper 不得重新把图渲染等待放回公共内容注入路径。
- 图状态断言必须继续验证 DOM class，不能只读 Zustand store。
- 如果未来重新启用 minimap 可见区域裁剪，必须先增加“错误 AST -> 有效 AST -> W001/W002 DOM class 恢复”的 E2E 覆盖。

## 最新复核更新（2026-06-24）

Parser/Validator 修复本身仍按单文件套件 6/6 通过记录保留；后续发行阻断修复补上 race-safe Electron teardown 后，完整默认 E2E 已恢复并扩展到当前 37/37 passed。

| 命令 | 当前结果 | 说明 |
|---|---|---|
| `pnpm.cmd --filter @plotflow/app exec playwright test --config e2e/playwright.config.ts e2e/parser-validator-e2e.spec.ts --workers=1` | PASS，6 passed | 单文件套件通过 |
| `pnpm.cmd --filter @plotflow/app exec playwright test --config e2e/playwright.config.ts e2e/parser-validator-e2e.spec.ts -g "Ctrl\\+Shift\\+M" --workers=1 --repeat-each=5` | PASS，5 passed | TC-6 重复运行稳定 |
| `pnpm.cmd --filter @plotflow/app test:e2e` | PASS，37 passed | 无 teardown error，无 did-not-run |

当前判断：原失败确认为 E2E teardown 生命周期问题，不足以证明 Parser/Validator 诊断逻辑回归。相关卡点已在 `memory/bug_log.md` 的 BUG-005 标记为已修，并同步到 `spec/progress.md` 的发行门禁状态。
