# ADR-011 — 官方远程代码主题与全 UX 权限

- **日期：** 2026-06-26
- **状态：** 已通过
- **适用范围：** 官方主题系统、Theme Center、远程官方主题目录、UX 配方权限

## 背景

PlotFlow 主题系统已经从旧双轨架构收敛到 `ThemePlatformProvider + ThemeRegistry + ThemeDescriptor`。M8 后只保留 `plotflow-narrative-workbench` 作为内置主题，并删除夜航主题。

新的产品目标不是开放第三方主题生态，而是让 PlotFlow 官方主题拥有足够高的 UX 控制权，并通过官方远程目录分发免费主题。第三方上传、社区主题、本地 `.pf-theme.zip` 导入、授权销售和用户自定义包均不属于当前产品方向。

## 决策

PlotFlow 只支持官方主题：

- **内置官方主题：** 随应用编译打包，启动时直接注册。
- **远程官方主题：** 从 PlotFlow 官方静态目录注册，下载后校验 `sha256`，写入 `userData/official-themes/<themeId>/<version>/`，再通过受控代码主题模块注册。
- **免费心智：** 当前所有远程官方主题统一标注为“免费主题”。暂不实现购买、授权、付费解锁或销售后台。

主题权限模型升级为全 UX 配方：

- `ThemeDescriptor` 可以声明 `tokens`、`monacoTheme`、`layoutRecipe`、`uxRecipe`、`motionRecipe`、`assets` 和 React `slots`。
- `uxRecipe` 可控制 app shell、Home、Theme Center、Graph Lab、Split、toolbar、panel、dock、node、edge、spacing、size、position、opacity、z-index、radius、typography、motion 等展示参数。
- 主题不得改变 `.mdstory` 语义、parser/exporter、保存流程或 Graph Lab 命令层。

远程代码主题采用受控加载策略：

- 远程 registry 负责发布主题 ID、版本、URL、hash、预览、变更说明和免费标识。
- Electron 主进程负责下载和完整性校验。
- Renderer 只注册 App 内已知的官方代码主题模块映射；不会执行任意用户提供的 JS。
- 未来如需真正外部 JS bundle，必须在同一 ABI 上增加官方签名、版本兼容和加载隔离，但不改变“仅官方”的产品边界。

## 后果

正面：

- 官方主题可以真正改变 UX，而不只是换色。
- 用户能在 Theme Center 中形成“官方免费主题库”的心智。
- 远程主题可更新，不需要每次随 App 发版。
- 不承担第三方生态、审核、授权、支付和任意代码执行风险。

负面：

- 当前远程代码主题仍需要 App 内预置受控模块映射，新增全新 React 组件能力仍依赖 App 发版。
- `theme-platform/validation.ts` 和旧本地导入 IPC 只作为历史基础设施保留，不是产品入口，后续应单独清退或重命名为官方下载校验工具。

## 禁止回归

- 不得在产品 UI 暴露第三方主题上传、本地 `.pf-theme.zip` 导入或社区主题市场。
- 不得把“购买更多官方主题”作为当前主文案；当前应使用“官方免费主题库 / 免费主题”。
- 不得重新引入 `plotflow-blueprint-nightwatch`、`ThemeVariant`、`OfficialThemeProvider`、`data-official-theme`、`data-theme-pack`。
- 不得让远程下载绕过官方 registry 和 `sha256` 校验。

## 相关文件

- `packages/app/src/theme-platform/types.ts`
- `packages/app/src/theme-platform/engine.ts`
- `packages/app/src-electron/official-theme-service.ts`
- `packages/app/src/components/panels/ThemeCenter.tsx`
- `website/public/data/official-themes.json`
