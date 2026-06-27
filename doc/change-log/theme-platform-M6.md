# M6 — ADR 限定：主题市场独立立项

**日期：** 2026-06-26
**状态：** ✅ 完成，待 Codex 审计

---

## M6-1：ADR 文档

创建 `doc/adr/ADR-011-theme-marketplace.md`，内容涵盖：

### 已统一的范围（禁止回归）

完整列出了 M0–M5 收敛的 10 个维度（类型系统、运行时 owner、DOM 属性、Store 字段、localStorage 键、渲染路径、React 组件工厂、主题引擎、官方主题注册表、类型文件），每个维度给出**旧（禁止回归）→ 新（唯一路径）**对照表。

**明确禁止重新引入的 6 项：**
- `ThemeVariant` 类型
- `OfficialThemeProvider` 组件
- `data-official-theme`、`data-theme-pack` 属性
- `createNodeSlot()` / `createEdgeSlot()` 工厂函数
- `activeOfficialThemeId` / `activeThemePackId` store 字段
- `theme-platform/` 模块导入 branch-graph 内部类型

附赠 CI grep 阻断命令（可直接用于 pre-commit）。

### `themePack.ts` / `ThemePackManifest` 留存边界

| 维度 | 结论 |
|------|------|
| 留存原因 | IPC 安装管道已建未接 UI，删除需要重写 IPC 协议/preload/主进程 |
| 当前状态 | 5 项能力矩阵（已建/未接入/未被引用/未测试/被隐藏） |
| 风险 | 后续开发者可能误判为"另一个主题入口" |
| 清理入口 | 独立里程碑：适配 ThemeDescriptor、接入 Registry.register、删除孤立校验 |

### 社区主题市场准入条件

5 项前置条件：签名校验、CSS 作用域隔离、编译验证管线、授权链路、失败回退策略。

### 技术预留清单

`ThemeRegistry.register()`、CSS 注入管道、IPC 安装管道、ThemeCenter 的当前公开条件和未来公开条件。

## 文件变更

```
新建:
  doc/adr/ADR-011-theme-marketplace.md     # ADR 文档（零代码变更）
```

## 门禁

| 层级 | 命令 | 结果 |
|:---:|------|:---:|
| L1 | `pnpm typecheck` | ✅（零代码变更，通过） |
| L1 | `pnpm lint` | ✅ 0 error，9 pre-existing warnings |
