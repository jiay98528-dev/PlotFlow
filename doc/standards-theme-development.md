# PlotFlow 主题开发标准

> 版本：2026-08-02（0.1.1 安全收敛）
> 权威级别：主题开发唯一标准
> 适用范围：内置官方主题、Theme Platform API、Theme Center、主题文档与主题测试

## 1. 当前发行边界

0.1.1 只启用以下三套随应用编译发布的官方主题：

| ID | 名称 | 角色 |
|---|---|---|
| `plotflow-prism-foundry` | 棱镜铸造台 / Prism Foundry | 默认主题 |
| `plotflow-narrative-workbench` | 叙事工作台 / Narrative Workbench | 内置主题 |
| `plotflow-engine-telemetry` | 引擎遥测台 / Engine Telemetry | 内置主题 |

当前版本必须满足：

- 启动不请求任何主题 registry。
- 不提供主题下载、安装、更新或商店 IPC，也不向 preload 暴露相关 API。
- 不注册 `plotflow-theme://` 或其他主题自定义协议；CSP 不允许该 scheme。
- 不扫描用户目录中的已安装主题，不动态 import 或执行磁盘上的 `.mjs`、JavaScript 或 React 模块。
- 历史远程或未知主题 ID 回退并持久化为 `plotflow-prism-foundry`。
- 已存在的远程主题目录保持原样，不删除、不迁移、不读取、不执行。
- 官网 `official-themes.json` 的远程条目必须为空，公开文案不得声称远程主题可下载或可用。

第三方主题、社区上传、本地导入、购买和授权同样不开放。未来远程主题不得直接恢复旧 ZIP 代码运行时；必须另立 ADR，采用带独立签名、声明式且不可执行 JavaScript 的格式。

## 2. 内置主题目录

内置主题位于：

```text
packages/app/src/theme/builtin/<theme-id>/
├── theme.json
├── index.ts
├── slots.tsx
├── surfaces.tsx
└── assets/
```

新增或修改主题时：

1. `theme.json` 提供 metadata、tokens、Monaco、layout/UX/interaction/motion recipe、store metadata 与 assets。
2. `index.ts` 将静态 JSON、slots 和 surfaces 组装为完整 `ThemeDescriptor`。
3. `slots.tsx` 只实现受控插槽；不得触碰故事语义或跨越 Zustand → AST → 源文本的数据流。
4. `surfaces.tsx` 只重排平台传入的 React 内容，不复制业务状态或命令。
5. `packages/app/src/theme/builtin/index.ts` 是当前发行主题白名单；0.1.1 必须恰好导出三套主题。

## 3. Theme Platform 合同

`packages/app/src/theme-platform/types.ts` 是代码合同来源。

- `ThemeDescriptor`：完整内置主题描述符。
- `ThemeSlots`：React Flow 节点、连线、Theme Center 预览与 Home 预览。
- `ThemeSurfaces`：AppShell、Toolbar、Split、Graph Lab、Home、Theme Center、Panel 与 Dock 布局壳。
- `ThemeTokens`：写入 `document.documentElement` 的 `--theme-*` CSS 变量。
- `ThemeLayoutRecipe` / `ThemeUxRecipe`：控制布局、尺寸、密度和 surface 参数。
- `ThemeStoreMeta.availability`：当前只能是 `bundled`。
- `ThemeCenterSurfaceProps`：只接收 `header`、`sidebar`、`installedThemes` 与 `footer`，没有远程目录插槽。

主题可以改变视觉、布局、React surfaces、React slots、Monaco 配色、CSS 与 assets，但不得改变：

- `.mdstory` 语义与唯一真相源原则；
- parser、validator、exporter 或 JSON Schema；
- 保存、自动保存、外部冲突与 Source Drawer 事务；
- Graph Lab 命令层、历史记录或节点/连线语义；
- Electron IPC、文件系统或 preload 能力。

## 4. Token 与样式

- 组件不得使用裸 hex；颜色必须来自 Design Token CSS 变量。
- 主题 JSON 中的 Monaco 原生颜色定义可使用其 API 所需格式；组件 CSS 仍遵守 token 门禁。
- 主题样式必须作用域化到 `data-theme-id` 或专属类名，不得污染其他主题预览。
- Home 与 Theme Center 的预览使用真实主题 slots，并隔离自身 token。
- React Flow 节点和连线禁止 `filter` / `backdrop-filter`，避免大图交互性能退化。
- `prefers-reduced-motion` 下必须取消非必要位移和持续装饰动画。

## 5. 注册、激活与回退

`ThemePlatformProvider` 在模块初始化时注册 `builtinThemes`，随后只从内存 registry 读取主题。激活顺序为：

1. `uiStore` 读取 `plotflow:themeId`。
2. 只有三套内置 ID 被接受；其他值规范化为 Prism Foundry 并立即改写持久化值。
3. Provider 应用 CSS 变量、`data-theme-id` 与 Monaco 主题。
4. Theme Center 切换只写入内置 ID，不触发网络、IPC 或磁盘扫描。

回退不得删除 `%APPDATA%/PlotFlow/official-themes/` 或其中任何内容。保留目录不是能力启用证明；0.1.1 对其完全忽略。

## 6. 安全零容忍门禁

应用生产路径必须没有：

- `official-theme-service`；
- `officialRemoteThemes`；
- `IPC_CHANNELS.theme` 或 `window.plotflow.theme`；
- `registerOfficialThemeProtocol*`；
- `plotflow-theme:` CSP 权限；
- 从用户目录、registry 或网络 materialize `ThemeDescriptor` 的代码；
- 对主题 `.mjs` 的动态 `import()`。

官网可保留历史主题包文件以便取证，但远程 registry 必须返回空数组，UI 与状态页必须明确远程运行时暂停。

## 7. 最小验收

每次主题相关改动只运行直接相关检查：

```powershell
pnpm.cmd --filter @plotflow/app exec vitest run src/theme/builtinThemes.test.ts src/stores/qa-store-persistence.test.ts src-electron/remote-theme-disabled.test.ts
pnpm.cmd typecheck
pnpm.cmd --dir website test
```

并执行零结果扫描（测试与历史文档除外）：

```powershell
rg -n "IPC_CHANNELS\.theme|window\.plotflow\.theme|registerOfficialThemeProtocol|plotflow-theme:" packages/app/src packages/app/src-electron packages/app/index.html
rg -n "officialRemoteThemes|official-theme-service" packages/app/src packages/app/src-electron
```

若改动 Theme Center 或预览，再定向运行 `theme-pack.e2e.spec.ts`；验收必须证明：恰好三张内置主题卡、无远程/商店/下载控件、未知持久化 ID 回退到 Prism Foundry。

## 8. 未来远程主题前置条件

恢复远程交付前至少需要：

- 独立于下载源的发布者签名与撤销机制；
- 声明式、可校验、不可执行 JavaScript 的数据模型；
- 资源大小、数量、类型、路径和解压预算；
- 明确的 CSP、缓存、升级、回滚与离线行为；
- 不授予 preload、Node、Electron IPC 或任意网络能力的隔离边界；
- 新 ADR、威胁模型、定向单元测试、renderer E2E 与打包黑盒证据。

在这些条件正式批准前，不得以兼容、实验或隐藏开关重新接入旧远程代码主题链路。
