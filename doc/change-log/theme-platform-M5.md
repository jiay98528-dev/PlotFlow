# M5 — CSS 残余清理与最终门禁

**日期：** 2026-06-26
**状态：** ✅ 完成，待 Codex 审计

---

## M5-1：过渡兼容残留检查

| 检查项 | 结果 |
|--------|------|
| engine.ts 是否写入 `data-official-theme` / `data-theme-pack` | ❌ 无——只写新属性 `data-theme-id` / `data-theme` / `data-theme-density` / `data-theme-card` / `data-theme-source-dock` / `data-theme-cable` / `data-theme-motion` |
| ThemePlatformProvider 是否写入旧属性 | ❌ 无——只从 `officialThemes` 导入注册，无兼容写 |

## M5-2：CSS 死规则扫描

| 文件 | 检查项 | 结果 |
|------|--------|------|
| `official-themes.css` | `[data-official-theme]` / `[data-theme-pack]` / `[data-theme-node-card]` | ❌ 零命中 |
| `graph-lab.css` | 同上 | ❌ 零命中 |
| `branch-graph.css` | `node-status-*` 规则 | 仍被 `adapter-helpers.ts → STATUS_TO_CLASS_MAP` 活跃引用，非死代码 |

## M5-3：CSS 变量目录

新建 `packages/app/src/theme-platform/tokens.ts`：
- 18 个 `--theme-*` 变量按类别分组（网格 / 背景 / 节点 / 连线 / 端口 / 阴影 / 布局）
- 导出 `ALL_THEME_TOKEN_KEYS` 全量数组和 `THEME_TOKEN_CATALOG` 分类索引
- 更新 `theme-platform/index.ts` barrel export

## M5-4：Variant class 一致性

| 组件 class | CSS 规则 | 状态 |
|-----------|---------|:---:|
| `official-graph-node` | `.official-graph-node` | ✅ |
| `official-graph-node--workbench` | `.official-graph-node--workbench` | ✅ |
| `official-graph-node--nightwatch` | `.official-graph-node--nightwatch` | ✅ |
| `official-graph-node.is-selected` | `.official-graph-node.is-selected` | ✅ |
| `official-graph-edge__path` | `.official-graph-edge__path` | ✅ |
| `official-graph-edge--conditional` | `.official-graph-edge--conditional ...` | ✅ |
| `official-graph-edge--nightwatch` | `.official-graph-edge--nightwatch ...` | ✅ |
| `official-graph-edge.is-selected/.is-hovered` | `.official-graph-edge.is-selected/.is-hovered ...` | ✅ |
| `official-graph-edge__label` | `.official-graph-edge__label` | ✅ |

## M5-5：最终 grep 扫描

| # | grep 模式 | 结果 |
|---|----------|:---:|
| 1 | `activeOfficialThemeId` | ✅ 零命中 |
| 2 | `activeThemePackId` | ✅ 零命中 |
| 3 | `OfficialThemeId` | ✅ 零命中 |
| 4 | `ThemeVariant` | ✅ 注释豁免 |
| 5 | `createNodeSlot\|createEdgeSlot` | ✅ 注释豁免 |
| 6 | `applyThemePackToRoot\|applyOfficialThemeToRoot` | ✅ 注释豁免 |
| 7 | `data-official-theme` | ✅ 零命中 |
| 8 | `data-theme-pack` | ✅ 零命中 |
| 9 | `data-theme-node-card` | ✅ 零命中 |
| 10 | `OfficialThemeProvider` | ✅ 零命中 |
| 11 | `themeRegistry` | ✅ 零命中 |

## 全门禁

| 层级 | 命令 | 结果 |
|:---:|------|:---:|
| L1 | `pnpm typecheck` | ✅ 0 error |
| L1 | `pnpm lint` | ✅ 0 error, 9 pre-existing warnings |
| L1 | `pnpm lint:css` | ✅ 0 error |
| L2 | `pnpm test` | ✅ 1232 passed |
| L3 | `pnpm build` | ✅ |
| - | `pnpm --filter @plotflow/app test:e2e` | 待 Codex 运行 |

## 文件变更

```
新建:
  packages/app/src/theme-platform/tokens.ts     # CSS 变量目录

修改:
  packages/app/src/theme-platform/index.ts      # 新增 tokens 导出
```
