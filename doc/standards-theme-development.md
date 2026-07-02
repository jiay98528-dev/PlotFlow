# PlotFlow 主题开发标准

> 版本：2026-06-27
> 权威级别：主题开发唯一标准
> 适用范围：内置官方主题、官方远程免费 ZIP 代码主题、Theme Platform API、Theme Center、主题文档与主题测试

## 1. 产品边界

PlotFlow 当前只支持官方主题。

- 内置官方主题随 App 编译发布，位于 `packages/app/src/theme/builtin/<theme-id>/`。
- 官方远程免费主题由 PlotFlow 官方 registry 注册，下载 `.pf-official-theme.zip` 后由 Electron 主进程执行 `sha256` 校验、安全解包和 manifest 校验，再通过 `plotflow-theme://` 动态加载。
- 当前不支持第三方主题、社区上传、本地导入、用户自定义包、购买、授权、付费解锁或任意来源主题。
- 当前 Theme Center 文案必须使用“官方免费主题库 / Free Official Themes”和“免费主题”心智。
- 主题只能改变 UX、视觉、布局、React surface、React slot、Monaco 主题、CSS 和 assets；不得改变 `.mdstory` 语义、parser、validator、exporter、保存流程、Graph Lab 命令层或故事数据同步规则。

## 2. 主题包形态

内置官方主题目录结构：

```text
packages/app/src/theme/builtin/<theme-id>/
├── theme.json
├── index.ts
├── slots.tsx
├── surfaces.tsx
└── assets/
```

官方远程主题包结构：

```text
<theme-id>-<version>.pf-official-theme.zip
├── manifest.json
├── index.mjs
├── theme.css
└── assets/
```

远程包 `manifest.json` 必须声明：

```json
{
  "id": "plotflow-example-theme",
  "version": "1.0.0",
  "themeApiVersion": 1,
  "entry": "index.mjs",
  "styles": ["theme.css"],
  "assetsBase": "assets"
}
```

远程包 `index.mjs` 必须导出：

```js
export function createTheme(host) {
  return { descriptor, cssText, styleUrls };
}
```

`descriptor` 必须满足完整 `ThemeDescriptor`，包括 `tokens`、`monacoTheme`、`assets`、`layoutRecipe`、`uxRecipe`、`entryRecipe`、`interactionRecipe`、`motionRecipe`、`storeMeta`、`slots` 和 `surfaces`。

## 3. Runtime API

主题平台公开 API 以 `packages/app/src/theme-platform/types.ts` 为代码真相源。

- `ThemeDescriptor`：完整主题描述符，注册到 `ThemeRegistry` 后由 `ThemePlatformProvider` 激活。
- `ThemeSlots`：替换 React Flow 节点、连线、Theme Center 预览、Home 预览。
- `ThemeSurfaces`：替换 App 外壳、Toolbar、Split、Graph Lab、Home、Theme Center、Panel、Dock 的布局壳。
- `ThemeTokens`：写入 `document.documentElement` 的 `--theme-*` CSS 变量。
- `ThemeLayoutRecipe`：控制 Graph Lab 面板宽度、source dock、节点卡片风格、线缆风格和密度。
- `ThemeUxRecipe`：写入 `--theme-ux-*` CSS 变量，覆盖位置、大小、布局类型、透明度、z-index、半径、阴影等 UX 参数。
- `OfficialThemeRegistryEntry`：官方远程主题 registry 条目。
- `InstalledOfficialThemeSummary.runtime`：远程主题安装后的 `moduleUrl`、`styleUrls`、`assetBaseUrl`。
- `OfficialThemeRuntimeHost`：远程 `index.mjs` 运行时可使用的受控 host 能力。
- `OfficialThemeRuntimeModule`：远程模块必须实现 `createTheme(host)`。

`OfficialThemeRuntimeHost` 当前提供：

- `React`
- `createElement`
- `Fragment`
- `defaultThemeSurfaces`
- `baseSlots`
- `assetUrl(path)`
- `themeId`
- `version`
- `apiVersion`

远程主题代码不得访问 Node、Electron、文件系统或任意 IPC；只能通过 `host`、surface props、slot props 和已传入的业务 JSX 组合 UI。

## 4. Surface 能力

当前 `ThemeSurfaces` 类型包含：

- `AppShell`
- `Toolbar`
- `SplitShell`
- `GraphLabShell`
- `HomeSurface`
- `ThemeCenterSurface`
- `PanelFrame`
- `DockFrame`

当前真实接线状态：

| Surface | 当前状态 | 说明 |
|---|---|---|
| `AppShell` | 已接线 | 可包裹 App 主外壳，必须保留 `topbar`、`children`、`overlays`、`statusBar`。 |
| `Toolbar` | 已接线 | 可重排顶部工具栏，必须保留 `brand`、`fileControls`、`viewControls`、`preferenceControls`。 |
| `SplitShell` | 已接线 | 可重排 Split 工作区，必须保留 `viewbar`、`outline`、`editor`、`graph`、`minimap`。 |
| `GraphLabShell` | 已接线 | 可重排 Graph Lab，必须保留 `commandbar`、`palette`、`canvas`、`inspector`、`sourceDrawer`。 |
| `HomeSurface` | 已接线 | 可重排首页，必须保留 `heroCopy`、`preview`、`actions`、`cards`、`status`。 |
| `ThemeCenterSurface` | 已接线 | 可重排主题中心，必须保留 `header`、`sidebar`、`installedThemes`、`remoteThemes`、`footer`。 |
| `PanelFrame` | 合同存在，覆盖有限 | 类型和默认实现存在；当前不是所有面板都通过该 surface 渲染。 |
| `DockFrame` | 合同存在，覆盖有限 | 类型和默认实现存在；当前不是所有 dock 都通过该 surface 渲染。 |

Surface 可以重排、包裹、改变布局与视觉，但不得吞掉传入的业务节点。若主题需要深度改造 Inspector、Palette、Condition Editor、Export Dialog、Problem Panel、Corpus Manager 等内部结构，必须先新增对应 Surface 合同和测试，再开发主题。

Graph Lab 当前 CSS 依赖 `.graph-lab` 的直接子元素布局。自定义 `GraphLabShell` 必须让 `commandbar`、`palette`、`canvas`、`inspector`、`sourceDrawer` 保持为 `.graph-lab` 直系布局节点，除非同步修改 CSS 和 E2E。

## 5. Slot 能力

`ThemeSlots` 当前包含：

- `StoryNodeCard`
- `StoryEdge`
- `ThemePreview`
- `HomePreview`

`StoryNodeCard` 和 `StoryEdge` 必须使用 React Flow `NodeProps` / `EdgeProps`。

节点 slot 必须保留：

- 选中态、状态态、章节/标题/正文/选项可见性。
- rename 路径。
- source/target Handle。
- 点击选中与编辑器联动。
- 必要的测试定位属性和可访问性语义。

连线 slot 必须保留：

- default/conditional 两种边类型。
- hover/selected 状态。
- Alt 删除、双击条件编辑、右键菜单、重连命中路径。
- 足够宽的 hit area，避免用户无法点击边。

Slot 不得直接写 `.mdstory`，不得绕过 `graphEditService`、Zustand store、AST 和 Monaco 同步链路。

## 6. Recipe、Token 与 CSS 标准

- 所有主题变量必须使用 `--theme-*` 或 `--theme-ux-*`。
- `applyThemeToRoot()` 会清除旧 `--theme-*` 并写入当前主题变量。
- `uxRecipe` 会写入 root dataset 与 CSS 变量；只有被 CSS 或 surface 显式消费时，才构成有效 UX 能力。
- 组件内禁止裸 hex 色值；Monaco 主题和静态 SVG assets 可使用编辑器/图像格式需要的 hex。
- 远程主题 CSS 必须通过 `manifest.styles` 或 `createTheme(host).cssText/styleUrls` 注入。
- 远程主题 CSS 必须以 `html[data-theme-id="<theme-id>"]`、`[data-theme-id="<theme-id>"]` 或主题专属 class 限定作用域，避免污染内置主题。

## 7. 官方远程主题运行时

官方远程主题加载流程：

```text
registry -> download zip -> sha256 verify -> safe unzip
-> install.json runtime metadata -> plotflow-theme:// URL
-> dynamic import index.mjs -> createTheme(host)
-> validate ThemeDescriptor -> registerTheme()
```

安全与边界要求：

- Renderer 不直接执行 HTTPS JS。
- Renderer 只从 `plotflow-theme://official/<themeId>/<version>/<path>` 加载已安装主题文件。
- ZIP 内禁止绝对路径、路径穿越、缺失 manifest、缺失 entry、manifest 与 registry 的 `id/version/themeApiVersion` 不一致。
- registry 条目必须使用官方 URL、`.pf-official-theme.zip`、合法 `sha256`、`themeApiVersion` 和 `priceLabel: "免费主题"`。
- 单个远程主题加载失败必须跳过，不影响内置默认主题启动。
- 当前 active theme 加载失败时必须回退默认主题。

## 8. 当前能力边界矩阵

| 能力 | 当前可达程度 | 说明 |
|---|---|---|
| 视觉外壳 | 高 | `AppShell`、CSS、tokens 可让整体视觉差异很大。 |
| Toolbar | 高 | `Toolbar` 已接线，可重排和重绘，但必须保留业务 controls。 |
| Split 工作区 | 高 | `SplitShell` 已接线，可重排 outline/editor/graph/minimap。 |
| Graph Lab 外壳 | 高 | `GraphLabShell` 已接线，可重排 commandbar/palette/canvas/inspector/sourceDrawer。 |
| Home | 高 | `HomeSurface` 与 `HomePreview` 已接线。 |
| Theme Center | 高 | `ThemeCenterSurface` 与 `ThemePreview` 已接线。 |
| 节点 | 高 | `StoryNodeCard` 可替换，但必须保留 React Flow 与编辑链路。 |
| 连线 | 高 | `StoryEdge` 可替换，但必须保留交互路径和 hit area。 |
| Monaco 配色 | 中高 | 主题可提供 Monaco colors/rules；编辑器能力本身不由主题改写。 |
| CSS/assets | 高 | 远程包可携带 CSS 和 assets，并通过 `plotflow-theme://` 加载。 |
| Inspector 内部结构 | 中低 | 可通过 `GraphLabShell` 包裹与布局，不能直接替换内部字段控件，除非新增 Surface。 |
| Palette 内部结构 | 中低 | 可布局和包裹，不能直接替换业务按钮逻辑，除非新增 Surface。 |
| Condition Editor | 低 | 当前未暴露专属 Surface。 |
| Export Dialog | 低 | 当前未暴露专属 Surface。 |
| Problem Panel / Corpus Manager | 低 | 当前未暴露专属 Surface。 |
| parser/export/save/store | 不允许 | 主题不得改变数据语义和业务命令。 |
| 主题私有持久化状态 | 未实现 | 当前没有主题私有存储 API。 |

结论：当前架构可以让主题在视觉、布局、主要工作台体验上“看上去几乎不是同一个软件”。但“用上去”必须保持 PlotFlow 的核心功能、`.mdstory` 数据语义、Graph Lab 编辑链路、保存/导出/解析流程一致。若目标是让 Inspector、Palette、条件编辑器、导出对话框等内部交互也完全换皮，需要先扩展对应 Surface 合同。

## 9. 禁止事项

- 禁止重新引入 `plotflow-blueprint-nightwatch`、`ThemeVariant`、`OfficialThemeProvider`、`data-official-theme`、`data-theme-pack`。
- 禁止产品 UI 暴露第三方主题、社区上传、本地 `.pf-theme.zip` 导入、购买、授权或付费解锁入口。
- 禁止绕过官方 registry、`sha256` 校验、manifest 校验和安全解包安装远程主题。
- 禁止远程主题直接执行 HTTPS JS。
- 禁止远程主题访问 Node、Electron、文件系统或任意 IPC。
- 禁止远程主题直接改变故事数据、导出结果、保存流程、parser、validator 或 Graph Lab 命令层。
- 禁止主题吞掉关键业务 controls，导致打开、保存、导出、编辑、连线、重命名、条件编辑等路径不可达。
- 禁止把“购买 / 授权 / 付费主题”作为当前正向产品文案；当前只能使用“官方免费主题库 / 免费主题”。

## 10. 开发验收

新增或修改主题必须通过：

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd lint:css
pnpm.cmd test
pnpm.cmd build
pnpm.cmd --filter @plotflow/app test:e2e
pnpm.cmd --dir website test
pnpm.cmd --dir website build
```

主题专属 grep：

```powershell
rg -n "plotflow-blueprint-nightwatch|Blueprint Nightwatch|夜航蓝图|ThemeVariant|OfficialThemeProvider|data-official-theme|data-theme-pack" packages/app/src packages/app/e2e doc/standards-theme-development.md
rg -n "第三方|社区上传|本地导入|购买|授权" doc/standards-theme-development.md AGENTS.md CLAUDE.md
```

第二条 grep 允许命中“产品边界 / 禁止事项 / 不支持范围”，不允许命中产品正向入口或功能承诺。

## 11. 后续扩展规则

新增主题能力必须先扩展合同，再开发主题：

- 需要改 Inspector 内部结构时，先新增 `InspectorSurface`。
- 需要改 Palette 内部结构时，先新增 `PaletteSurface`。
- 需要改 Condition Editor 时，先新增 `ConditionEditorSurface`。
- 需要改 Export Dialog 时，先新增 `ExportDialogSurface`。
- 需要主题私有状态时，先设计主题私有持久化 API 和迁移/清理策略。

每次扩展必须同步：

- `packages/app/src/theme-platform/types.ts`
- `doc/standards-theme-development.md`
- 对应默认 surface/slot 实现
- 内置主题与至少一个远程官方主题 fixture
- 单元测试与 E2E 覆盖
