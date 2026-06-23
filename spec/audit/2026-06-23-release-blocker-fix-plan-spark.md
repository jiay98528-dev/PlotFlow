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
