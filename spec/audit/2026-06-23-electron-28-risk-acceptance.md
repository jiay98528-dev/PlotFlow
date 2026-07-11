# 2026-06-23 Electron 28 风险接受记录

> **状态：历史快照，已废止。**
>
> 2026-06-24 项目已迁移到 Electron 42.5.0，并移除了 `pnpm-workspace.yaml` 中的 Electron GHSA ignore。当前 `pnpm.cmd audit --audit-level moderate` 返回 `No known vulnerabilities found`，正式 Windows 包不再依赖本风险接受放行。本文仅保留为 2026-06-23 过渡阶段的审计记录。

## 背景

本轮发行阻断修复已先升级可控 dev/test/build 依赖：

- `vitest` 升级到 `^3.2.6`
- `vite` 升级到 `^6.4.3`
- `electron-vite` 升级到 `^5.0.0`
- `@vitejs/plugin-react` 升级到 `^5.2.0`
- `electron-builder` / `electron-builder-squirrel-windows` 升级到 `26.15.3`

升级后 `pnpm.cmd audit --audit-level moderate` 的剩余项从 29 个降至 17 个，且全部来自 Electron 28.3.3。Electron 28 目前已经是 28.x 最新补丁线；剩余漏洞需要升级到 Electron 35/38/39+ 才能消除。

## 决策

V0.3 本轮保留 Electron 28，不在发行阻断修复中强升 Electron 主版本。

原因：

1. Electron 38/39+ 是跨十余个主版本的运行时迁移，影响 Chromium、Node、Electron API 行为、打包产物与 E2E 稳定性。
2. 当前目标是恢复发行门禁、完成本地 Windows 打包链路，不包含自动更新、GitHub Release、三平台公开发布。
3. 当前应用是离线优先、本地文件编辑器，不加载远程网页内容；大部分剩余 GHSA 依赖未使用的 Electron API 或更宽的 WebContents 能力面。
4. Electron 主版本升级应作为独立迁移任务执行，需单独跑三平台打包、文件关联、菜单、IPC、Monaco、React Flow 与 E2E 回归。

因此，`pnpm-workspace.yaml` 通过 `auditConfig.ignoreGhsas` 显式忽略以下 Electron GHSA，并以本文档作为风险接受依据。为让该配置被 `pnpm.cmd audit` 实际读取，项目 `packageManager` 已从 pnpm 9.0.0 升级到 pnpm 11.5.1，并在 `pnpm-workspace.yaml` 中以 `allowBuilds` 最小白名单允许 `electron`、`electron-winstaller`、`esbuild` 的安装脚本。

## 剩余 GHSA 清单

| GHSA | 严重级别 | 修复版本 | 本项目当前暴露判断 |
|---|---:|---|---|
| GHSA-vmqv-hx8q-j7mg | moderate | `>=35.7.5` | ASAR 完整性绕过；本轮未启用 Electron fuses 加固，需在正式公开安装包前复核 |
| GHSA-5rqw-r77c-jp79 | moderate | `>=38.8.6` | 未调用 `app.moveToApplicationsFolder()` |
| GHSA-xj5x-m3f3-5x3h | moderate | `>=38.8.6` | 未注册 service worker；未把 `executeJavaScript()` 返回值用于安全决策 |
| GHSA-r5p7-gp4j-qhrx | moderate | `>=38.8.6` | 未设置 `session.setPermissionRequestHandler()`，不授予 iframe 权限 |
| GHSA-3c8v-cfp5-9885 | moderate | `>=38.8.6` | 使用 `requestSingleInstanceLock()`；Windows 不受该 advisory 影响，macOS/Linux 打包前需重新评估 |
| GHSA-xwr5-m59h-vwqr | moderate | `>=38.8.6` | 未启用 `nodeIntegrationInWorker` |
| GHSA-532v-xpq5-8h95 | high | `>=39.8.1` | 未启用 offscreen rendering，未允许 renderer 创建子窗口 |
| GHSA-mwmh-mq4g-g6gr | moderate | `>=38.8.6` | 未调用 `app.setAsDefaultProtocolClient()` |
| GHSA-9w97-2464-8783 | moderate | `>=38.8.6` | 导出使用主进程保存对话框；无下载流程和下载保存回调 |
| GHSA-8337-3p73-46f4 | high | `>=38.8.6` | 未注册异步权限请求处理器 |
| GHSA-jjp3-mq3x-295m | high | `>=38.8.6` | 未使用 `powerMonitor` |
| GHSA-jfqx-fxh3-c62j | low | `>=38.8.6` | 未调用 `app.setLoginItemSettings()` |
| GHSA-4p4r-m79c-wq3v | moderate | `>=38.8.6` | 未注册 custom protocol handler，未使用 `webRequest.onHeadersReceived` 改响应头 |
| GHSA-9899-m83m-qhpj | low | `>=38.8.6` | 未处理 `select-usb-device` |
| GHSA-f37v-82c4-4x64 | low | `>=39.8.5` | 未调用 `clipboard.readImage()` |
| GHSA-f3pv-wv63-48x8 | moderate | `>=39.8.5` | 单主窗口应用；未给 child window 更高权限 |
| GHSA-9wfr-w7mm-pc7f | high | `>=38.8.6` | `BrowserWindow.webPreferences` 为固定白名单对象，不从外部输入展开 |

## 补偿措施

当前主进程安全边界：

- `BrowserWindow.webPreferences` 固定为 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`。
- 预加载层只通过 `contextBridge` 暴露受控 IPC API。
- 文件读写 IPC 限制 `.mdstory` 扩展名，并有 10MB 读取上限与系统目录拦截。
- 产品定位为离线优先，不加载远程网页内容，不依赖云服务。
- 本轮 M7 只验证本地 Windows 打包，不发布自动更新、不创建 GitHub Release、不开放三平台公开分发链路。

## 重新评估条件

出现以下任一条件时，必须取消本风险接受或重新审计：

1. 进入 macOS/Linux 打包发布。
2. 启用自动更新、GitHub Release 或公开安装包分发。
3. 引入 remote content、custom protocol、`window.open()` 子窗口、`shell.openExternal()` 打开外部 URL。
4. 使用权限请求处理器、offscreen rendering、PowerMonitor、USB、剪贴板图片、登录项、默认协议注册等 Electron API。
5. Electron 28 出现不依赖特殊 API 即可被远程触发的 critical/high advisory。
6. 项目进入 V0.3 正式公开发布前的最终安全门禁。

## 后续任务

单独创建 Electron 主版本迁移任务：从 Electron 28 迁移到当前受支持安全主版本，范围包含三平台打包、文件关联、菜单 IPC、Monaco/React Flow 渲染、E2E 全量回归与安装包冒烟测试。
