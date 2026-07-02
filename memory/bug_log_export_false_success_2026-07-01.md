# BUG-007: 导出默认文件名非法且失败后仍显示成功

**日期**：2026-07-01
**分类**：`FS`
**严重程度**：阻断
**里程碑**：Release Blackbox / M4 导出

## 文件/模块

- `packages/app/src/components/panels/ExportDialog.tsx`
- `packages/app/src-electron/main.ts`
- `packages/app/src-electron/mainProcessUtils.ts`
- `packages/app/e2e-blackbox/file-dialogs.spec.ts`
- `packages/app/e2e-blackbox/helpers/nativeDialog.ts`

## 现象

人工和解包态黑盒验证中，JSON 导出打开 Windows 原生保存对话框时默认文件名可能为 `{{title}}.json`。用户选择保存后系统层出现非法名称/重命名错误；同时应用内仍可能显示“导出成功”，说明导出 IPC 只按调用流程返回，缺少真实落盘确认。

## 根因

渲染层直接把 `meta.title` 作为导出文件名来源，没有识别内置模板占位符。主进程 `file:export` 在 `writeFile()` 后立即返回 `{ filePath }`，没有 `stat` 或读回比对，无法区分“对话框流程完成”和“文件确实写入且内容正确”。

黑盒 helper 早期还会误填 Windows 保存对话框中的非文件名输入框，并错误假设保存对话框一定是独立 `#32770` 顶层窗口。Windows 11 / Electron 42 下，保存对话框可能嵌在 `Chrome_WidgetWin_1` 窗口树内，文件名区域实际是 `FileNameControlHost`。

## 教训

导出成功必须以磁盘可读回的目标文件为准，不能以按钮点击、对话框关闭或 IPC resolved 为准。模板占位符不能进入任何面向操作系统的文件名字段。原生对话框黑盒自动化也必须以实际 UIAutomation 控件树为准，不能只按旧版 Windows 对话框类名建模。

## 预防措施

- 导出默认名通过 `buildExportBaseName()` 清洗，`{{...}}` 占位符回退到当前 `.mdstory` 文件名或 `plotflow-story`。
- 主进程新增 `sanitizeExportDefaultPath()` 兜底清洗建议文件名。
- 保存、另存、导出统一走 `writeTextFileAndVerify()`，写入后 `stat` 并读回精确比对，失败则向渲染层抛错。
- 解包态黑盒 `file-dialogs.spec.ts` 保留真实 Windows 保存对话框 + 读盘验证；该用例不得降级成内部 bridge 或 DOM mock。
- `nativeDialog.ts` 必须兼容 Windows 11 嵌入式 common dialog：按 `FileNameControlHost` 定位文件名输入区，不能只找 `#32770`。

## 修复验证

- `pnpm.cmd lint`：PASS，0 error / 9 existing warnings。
- `pnpm.cmd typecheck`：PASS。
- `pnpm.cmd test -- ExportDialog mainProcessUtils`：PASS，43 files / 1248 tests。
- `pnpm.cmd --filter @plotflow/app test:e2e`：PASS，39/39。
- `pnpm.cmd --filter @plotflow/app test:e2e:blackbox`：PASS，10 passed / 4 packaged-or-installed skips。
- `pnpm.cmd package:win`：PASS。
- `pnpm.cmd --filter @plotflow/app test:e2e:unpacked`：PASS，13 passed / 1 installed-only skip（清空 `release/` 和旧安装目录后重打包验证）。
- `pnpm.cmd audit --audit-level moderate`：PASS。

安装态黑盒仍需安装 2026-07-01 刷新的安装器后再运行。
