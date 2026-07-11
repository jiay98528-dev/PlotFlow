# M1 — 平台合同提取

日期：2026-06-26 | 状态：✅ 已完成

## 新建文件

```
theme-platform/types.ts       — ThemeId=string, ThemeDescriptor + 13个子接口
                                   零项目内部旧主题/branch-graph 导入
                                   ThemeSlots 使用泛型 NodeProps/EdgeProps
theme-platform/registry.ts    — Map<ThemeId, ThemeDescriptor> 注册表
                                   registerTheme/getTheme/getThemeOrDefault/listThemes/hasTheme
                                   DEFAULT_THEME_ID = 'plotflow-narrative-workbench'
theme-platform/engine.ts      — applyThemeToRoot (单一引擎函数)
                                   写 data-theme, data-theme-id, data-theme-density,
                                   data-theme-card, data-theme-source-dock, data-theme-cable,
                                   data-theme-motion
                                   不碰 Monaco, 不碰 document.lang
theme-platform/bridge.ts      — createMonacoThemeName, resolveMonacoTheme
theme-platform/index.ts       — barrel 导出
```

## 验证

- pnpm typecheck: PASS
- pnpm test: PASS (41 files, 1231 tests)
- pnpm lint: PASS (9 pre-existing console warnings)
- 零现有文件修改（git diff 为空，仅 LF/CRLF 换行提示）
- grep "from '.*(officialTheme|branch-graph|StoryFlow|StoryEdge)" theme-platform/: 零结果 ← 类型解耦验证通过
- ThemeVariant: 不存在于任何新文件
- OfficialThemeId: 不存在于任何新文件
- StoryFlowNodeData/StoryEdgeType: 不存在于任何新文件
