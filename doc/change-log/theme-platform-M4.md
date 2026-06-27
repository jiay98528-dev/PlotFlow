# M4 — Store 与遗留代码清退

日期：2026-06-26 | 状态：✅ 已完成

## Store 合并 (uiStore.ts)
- 删除 `activeOfficialThemeId`、`activeThemePackId` 字段
- 删除 `setActiveOfficialThemeId`、`setActiveThemePackId` action
- `activeThemeId: string` 成为唯一主题字段
- `setActiveThemeId` 成为唯一主题 action
- localStorage 键收敛为 `plotflow:themeId`
- `readStoredThemeId()` 包含 4 级旧键迁移 + 迁移后删除旧键

## 删除文件（5 个）
- `theme/themeRegistry.ts`
- `theme/builtinThemePacks.ts`
- `theme/officialThemeIds.ts`
- `theme/officialThemeTypes.ts`
- `theme/OfficialThemeProvider.tsx`

## 消费者更新
- `App.tsx` — `activeOfficialThemeId` → `activeThemeId`，`setOfficialTheme` → `setTheme`
- `MonacoEditor.tsx` — `getOfficialTheme` → `getThemeOrDefault`
- `ThemeCenter.tsx` — `DEFAULT_OFFICIAL_THEME_ID` → `DEFAULT_THEME_ID`
- `HomeSurface.tsx` — `useOfficialTheme` → `useThemePlatform`
- `GraphCanvas.tsx` — `useOfficialTheme` → `useThemePlatform`
- `electron.d.ts` — `TestStoreBridge` 硬编码联合 → `string`
- `qa-store-persistence.test.ts` — 全部旧字段/旧 key 替换
- `officialThemes.test.ts` — 使用 `ThemeDescriptor` 类型 + `DEFAULT_THEME_ID`
- `themePack.test.ts` — 删除对 `builtinThemePacks`/`themeRegistry` 的依赖
- `e2e/theme-pack.e2e.spec.ts` — `setOfficialTheme` → `setTheme`，localStorage key 更新

## Codex 审计修复（4 项）
- [P0] Provider 首屏崩溃 → 模块初始化预注册内置主题（替代 useEffect 后注册）
- [P0] 双击重命名失效 → WorkbenchNodeCard + NightwatchNodeCard 添加完整 rename 链路
- [P1] graph-lab.css data-theme-pack 残留 → 单独修复 :active 伪类版本
- [P1] 测试期望旧 key → qa-store-persistence.test.ts 断言更新

## 验收
- pnpm typecheck: PASS（零错误）
- pnpm test: PASS（1232 passed）
- pnpm lint: PASS（0 errors, 9 pre-existing console warnings）
- grep activeOfficialThemeId: 零结果
- grep activeThemePackId: 零结果
- grep OfficialThemeId: 零结果
- grep setActiveOfficialThemeId|setActiveThemePackId: 零结果
- 5 个文件已确认删除（ls 验证）
- CSS 残留 grep 已通过 M2 验证
