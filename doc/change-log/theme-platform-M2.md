# M2 — 单一运行时 owner 迁移

日期：2026-06-26 | 状态：✅ 已完成

## 执行记录

### M2-1: uiStore.ts 新增 activeThemeId
- 新增字段 `activeThemeId: string`
- 新增 action `setActiveThemeId(id: string)`
- 新 localStorage key `plotflow:platformTheme`
- `setActiveThemeId` 过渡期双向写（新key + 旧key + 旧字段）
- 新增 `readStoredThemeId()` 读取器，支持 4 级回退
- 导入 `ThemeId` from `theme-platform/types`

### M2-2: 创建 ThemePlatformProvider
- 3 个独立 useEffect：CSS/Monaco/语言
- mount 时注册内置主题到 ThemeRegistry
- React Context 通过 `useThemePlatform()` 暴露

### M2-3: 同步迁移 CSS 选择器
- `official-themes.css`：`[data-official-theme]` → `[data-theme-id]`（3处）
- `graph-lab.css`：`[data-theme-pack='...']` → `[data-theme-id='...']`（2处）

### M2-4: 切换 ThemeProvider + 旧 Provider 最小改造
- `ThemeProvider.tsx` 切到 `ThemePlatformProvider`
- `OfficialThemeProvider.tsx`：`applyOfficialThemeToRoot` 简化为一行委托 `applyThemeToRoot()`
- 旧 Provider 不再被任何运行时路径挂载

### M2-5: 连接消费者到新 API
- `ThemeCenter.tsx`：`setActiveOfficialThemeId` → `setActiveThemeId`，`useOfficialTheme` → `useThemePlatform`
- `GraphCanvas.tsx`：`useOfficialTheme` → `useThemePlatform`
- `MonacoEditor.tsx`：`getOfficialTheme` → `getThemeOrDefault` + `activeThemeId`
- `HomeSurface.tsx`：`useOfficialTheme` → `useThemePlatform`

## 验收

- pnpm typecheck: PASS（零错误）
- pnpm test: PASS（41 files, 1231 tests）
- pnpm lint: PASS（9 warnings，全部为预存 console 语句）
- grep "import.*OfficialThemeProvider" packages/app/src/: 零结果
- grep "\[data-official-theme\]|\[data-theme-pack\]" packages/app/src/styles/: 零结果
- ThemeProvider.tsx 只挂载 ThemePlatformProvider ✅
- 旧 OfficialThemeProvider 不在任何运行时路径中被挂载 ✅
