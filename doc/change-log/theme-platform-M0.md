# M0 — 主题平台基线冻结

日期：2026-06-26 | 状态：✅ 已完成

## 文件矩阵

涉及主题系统的全部文件：

```
theme/officialThemeIds.ts          — OfficialThemeId 封闭联合 ('plotflow-narrative-workbench' | 'plotflow-blueprint-nightwatch')
                                        normalizeOfficialThemeId, LEGACY_THEME_ID_MAP
theme/officialThemeTypes.ts        — OfficialWorkspaceTheme, OfficialThemeSlots, OfficialThemeMotionRecipe,
                                        ThemeEntryRecipe, ThemeInteractionRecipe, OfficialThemeAssets,
                                        OfficialThemeStoreMeta
                                        ⚠ 类型污染：导入 StoryFlowNodeData, StoryEdgeType
theme/officialThemes.tsx           — officialThemes 数组 (2主题), listOfficialThemes, Monaco 主题常量
theme/officialThemeSlots.tsx       — ThemeVariant ('workbench' | 'nightwatch') 联合
                                        createNodeSlot(themeId, variant), createEdgeSlot(themeId, variant)
                                        WorkbenchPreview, NightwatchPreview
                                        narrativeWorkbenchSlots, blueprintNightwatchSlots
theme/OfficialThemeProvider.tsx    — applyOfficialThemeToRoot (10+ DOM属性), OfficialThemeProvider (3 useEffect)
theme/themePack.ts                 — ThemePackManifest, ThemePackTokens, MonacoThemeDefinition,
                                        validateThemePackManifest, summarizeThemePack
theme/themeRegistry.ts             — RegisteredThemePack, applyThemePackToRoot, registerThemePack
theme/builtinThemePacks.ts         — 只注册 1 个旧版主题 (plotflow-narrative-workbench)

styles/official-themes.css         — 704行, [data-official-theme] 和 [data-official-theme="..."] 选择器
styles/graph-lab.css               — 630行, [data-theme-pack='plotflow-narrative-workbench'] 选择器

stores/uiStore.ts                  — activeOfficialThemeId + activeThemePackId 双字段, 双 action, 4 localStorage keys

components/branch-graph/GraphCanvas.tsx   — isGraphLab 三元分支 (nodeTypes/edgeTypes)
components/branch-graph/StoryNodeCard.tsx  — 旧 split 模式渲染器
components/branch-graph/StoryEdge.tsx      — 旧 split 模式连线渲染器
components/ThemeProvider.tsx               — OfficialThemeProvider 包装器
components/panels/ThemeCenter.tsx          — 主题选择 UI
components/home/HomeSurface.tsx            — 首页主题模块 + activeTheme.slots.HomePreview
components/editor/MonacoEditor.tsx         — 主题驱动 Monaco 选择 (THEME_DARK/THEME_LIGHT)
renderer/App.tsx                           — ThemeProvider 挂载 + workspaceMode 分支

types/electron.d.ts                — ThemeInstallResult, ThemeAPI, TestStoreBridge 硬编码联合
```

## Store 字段与 localStorage 键

```
activeOfficialThemeId: OfficialThemeId   → localStorage: plotflow:officialTheme + plotflow:themePack
activeThemePackId: ThemePackId            → localStorage: plotflow:officialTheme + plotflow:themePack (同上)
plotflow:theme                           → 旧版迁移键 (light/dark), 只读不写
plotflow:language                        → 不相关但相邻
plotflow:workspaceMode                   → 不相关但相邻

同步：setActiveOfficialThemeId 同时写两个字段 + 两个 key
      setActiveThemePackId 同时写两个字段 + 两个 key
```

## 两个 applyToRoot 的属性差异

applyThemePackToRoot (themeRegistry.ts):
  - data-theme-pack (主题ID)
  - data-theme-density (density)
  - data-theme-cable (cableStyle)
  - data-theme-motion (motionIntensity)
  - --theme-* CSS 变量
  - --theme-graph-lab-* 布局变量

applyOfficialThemeToRoot (OfficialThemeProvider.tsx):
  - data-theme (light/dark mode)
  - data-accent (删除)
  - data-official-theme (主题ID)
  - data-theme-pack (主题ID，与前一项重复)
  - data-theme-density
  - data-theme-node-card (nodeCardStyle)
  - data-theme-source-dock (sourceDock)
  - data-theme-cable (cableStyle)
  - data-theme-motion (motionIntensity)
  - --theme-* CSS 变量
  - --theme-graph-lab-* 布局变量
  - Monaco defineTheme + setTheme

## CSS 属性选择器依赖清单

official-themes.css:
  - 行1:  html[data-official-theme]                                 → 通用主题变量 (--theme-card-radius, --theme-grid-size)
  - 行674: html[data-official-theme="plotflow-blueprint-nightwatch"] .app-shell → 暗色主题 app shell
  - 行679: html[data-official-theme="plotflow-blueprint-nightwatch"] .official-theme-preview--nightwatch → 暗色预览

graph-lab.css:
  - 行553: html[data-theme-pack='plotflow-narrative-workbench'] .graph-lab__canvas .react-flow__pane → grab 光标
  - 行557: html[data-theme-pack='plotflow-narrative-workbench'] .graph-lab__canvas .react-flow__pane:active → grabbing 光标

## 门禁基线

```
pnpm typecheck     → PASS (零错误)
pnpm lint          → PASS (0 errors, 9 warnings — 均为 console 语句, 预存)
pnpm test          → PASS (41 files, 1231 tests, 9.58s)
```

## 关键依赖图

```
officialThemeSlots.tsx → imports StoryFlowNodeData (from branch-graph/adapter)
                       → imports StoryEdgeType (from branch-graph/StoryEdge)
GraphCanvas.tsx        → imports useOfficialTheme (from OfficialThemeProvider)
                       → imports StoryNodeCard, StoryEdge (旧渲染器)
MonacoEditor.tsx       → imports getOfficialTheme (from OfficialThemeProvider)
OfficialThemeProvider  → imports setupEditor (从 editor/)
officialThemeTypes.ts  → imports ThemePackTokens, MonacoThemeDefinition (从 themePack.ts)
                       → imports StoryFlowNodeData, StoryEdgeType (类型污染)
```
