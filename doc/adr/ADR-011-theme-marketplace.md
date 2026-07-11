# ADR-011 — 官方远程代码主题与全 UX 权限

- **日期：** 2026-06-26（2026-07-10 更新）
- **状态：** 已通过
- **适用范围：** 官方主题系统、Theme Center、远程官方主题目录、UX 配方权限

## 背景

PlotFlow 主题系统已经从旧双轨架构收敛到 `ThemePlatformProvider + ThemeRegistry + ThemeDescriptor`。当前内置官方主题包括 `plotflow-narrative-workbench`、`plotflow-engine-telemetry` 与 `plotflow-prism-foundry`；Prism Foundry 是新安装与未知主题回退的亮色默认主题。旧夜航主题已删除。

新的产品目标不是开放第三方主题生态，而是让 PlotFlow 官方主题拥有足够高的 UX 控制权，并通过官方远程目录分发免费主题。第三方上传、社区主题、本地 `.pf-theme.zip` 导入、授权销售和用户自定义包均不属于当前产品方向。

## 决策

PlotFlow 只支持官方主题：

- **内置官方主题：** 随应用编译打包，启动时直接注册。
- **远程官方主题：** 从 PlotFlow 官方静态目录注册，下载官方 ZIP 代码包后校验 `sha256`，安全解包到 `userData/official-themes/<themeId>/<version>/`，再通过 `plotflow-theme://official/<themeId>/<version>/index.mjs` 动态加载并注册完整 `ThemeDescriptor`。
- **免费心智：** 当前所有远程官方主题统一标注为“免费主题”。暂不实现购买、授权、付费解锁或销售后台。

主题权限模型升级为全 UX 配方：

- `ThemeDescriptor` 可以声明 `tokens`、`monacoTheme`、`layoutRecipe`、`uxRecipe`、`motionRecipe`、`assets` 和 React `slots`。
- `uxRecipe` 可控制 app shell、Home、Theme Center、Graph Lab、Split、toolbar、panel、dock、node、edge、spacing、size、position、opacity、z-index、radius、typography、motion 等展示参数。
- 主题不得改变 `.mdstory` 语义、parser/exporter、保存流程或 Graph Lab 命令层。

远程代码主题采用官方本地协议加载策略：

- 远程 registry 负责发布主题 ID、版本、URL、hash、预览、变更说明和免费标识。
- Electron 主进程负责下载、完整性校验、ZIP 路径安全校验、manifest 校验和安装。
- Renderer 不直接执行 HTTPS JS；只从 `plotflow-theme://` 加载已安装且已校验的官方本地代码包。
- 远程包 `index.mjs` 必须导出 `createTheme(host)`，返回完整 `ThemeDescriptor`，可提供 React `surfaces`、`slots`、CSS、assets、tokens、Monaco 和 UX recipes。
- 未来如需更高风险隔离，可在同一 ABI 上增加官方签名和沙箱隔离，但不改变“仅官方”的产品边界。

## 后果

正面：

- 官方主题可以真正改变 UX，而不只是换色。
- 用户能在 Theme Center 中形成“官方免费主题库”的心智。
- 远程主题可更新，不需要每次随 App 发版。
- 不承担第三方生态、审核、授权、支付和任意代码执行风险。

负面：

- 官方远程主题包已经可以携带当前主题架构的完整 UX 能力；新增主题不再要求 App 内预置 descriptor 映射。
- 动态远程主题代码必须严格使用 `OfficialThemeRuntimeHost` 提供的受控能力；不得访问 Node、Electron、文件系统或任意 IPC。

## 禁止回归

- 不得在产品 UI 暴露第三方主题上传、本地 `.pf-theme.zip` 导入或社区主题市场。
- 不得把“购买更多官方主题”作为当前主文案；当前应使用“官方免费主题库 / 免费主题”。
- 不得重新引入 `plotflow-blueprint-nightwatch`、`ThemeVariant`、`OfficialThemeProvider`、`data-official-theme`、`data-theme-pack`。
- 不得让远程下载绕过官方 registry 和 `sha256` 校验。
- 不得直接从 HTTPS 执行主题 JS；执行入口必须来自已安装的 `plotflow-theme://` 官方本地协议。

## 相关文件

- `packages/app/src/theme-platform/types.ts`
- `packages/app/src/theme-platform/engine.ts`
- `packages/app/src-electron/official-theme-service.ts`
- `packages/app/src/theme/officialRemoteThemes.ts`
- `packages/app/src/components/panels/ThemeCenter.tsx`
- `website/public/data/official-themes.json`
- `doc/standards-theme-development.md`
