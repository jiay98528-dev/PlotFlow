# M3 — 渲染路径统一

日期：2026-06-26 | 状态：✅ 已完成

## 新建文件

```
theme/themes/utils.ts               — stripMarkdown + truncate 共享工具
theme/themes/WorkbenchNodeCard.tsx  — 叙事工作台节点卡片 (body preview 68字符)
theme/themes/NightwatchNodeCard.tsx — 夜航蓝图节点卡片 (telemetry bar)
theme/themes/WorkbenchEdge.tsx      — 叙事工作台连线 (hit area 22px)
theme/themes/NightwatchEdge.tsx     — 夜航蓝图连线 (hit area 26px)
```

## 重写文件

- `officialThemeSlots.tsx` — 删除 ThemeVariant 类型、createNodeSlot/createEdgeSlot 工厂函数；直接引用 4 个独立组件
- `GraphCanvas.tsx` — 删除 `isGraphLab ? themeSlot : StoryNodeCard/StoryEdge` 三元分支；删除 StoryNodeCard/StoryEdge 导入

## 验证

- pnpm typecheck: PASS（零错误）
- pnpm test: PASS（1231 tests）
- grep "isGraphLab.*nodeTypes|isGraphLab.*edgeTypes|isGraphLab.*StoryNodeCard|isGraphLab.*StoryEdge" GraphCanvas.tsx: 零结果
- ThemeVariant/创造工厂: 只在文档注释中出现（M5 会清理），不在运行时代码中
- Handle dataset 完整: data-source-full-id, data-option-index, data-nodeid, data-handleid ✅
- className 契约: official-graph-node--{workbench|nightwatch}--{status} + is-selected/is-hovered ✅
- StripMarkdown/truncate: 从共享 utils.ts 导入（无重复代码）✅
