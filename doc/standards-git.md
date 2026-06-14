# PlotFlow Git 分支策略 + Commit 规范

> **版本**：V0.1 | **日期**：2026-06-12 | **强制执行**：Husky + commitlint
> **关联**：`CLAUDE.md`（milestones 复审流程）

---

## 1. 分支策略

### 1.1 主分支

```
main ──────────────────────────────────────────→
  │        │         │         │
  └─ M0 ───┘─ M1 ────┘─ M2 ────┘─ ...
```

| 分支 | 用途 | 保护规则 |
|------|------|---------|
| `main` | 始终可发布，M7 前为 V0.1-dev | 禁止直接 push，仅通过 PR 合并 |
| `dev` | 日常开发集成分支 | 宽松，pre-commit hook 通过即可 push |

### 1.2 功能分支

```
命名：feat/<milestone>/<简短描述>
示例：feat/m1/monaco-tokenizer
      feat/m2/react-flow-canvas
      feat/m3/condition-editor
```

### 1.3 修复分支

```
命名：fix/<scope>/<简短描述>
示例：fix/parser/emoji-crash
      fix/graph/orphan-node-layout
      fix/export/json-encoding
```

### 1.4 分支生命周期

```
创建：从 dev 切出
     ↓
开发：本地迭代 + 自测
     ↓
PR  ：→ dev（单人项目可跳过 PR 审查，但 CI 必须绿）
     ↓
合并：squash merge → dev
     ↓
删除：合并后删除功能分支
```

---

## 2. Commit 规范

### 2.1 格式

```
<type>(<scope>): <subject>

[body]    ← 可选：详细描述

[footer]  ← 可选：关闭 Issue / Breaking Change
```

### 2.2 Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(parser): add option syntax parsing` |
| `fix` | Bug 修复 | `fix(editor): emoji input breaks tokenizer` |
| `docs` | 文档变更 | `docs(readme): add installation guide` |
| `style` | 格式（不影响代码逻辑） | `style(lint): fix eslint warnings` |
| `refactor` | 重构（非新功能/非修复） | `refactor(store): split editor store` |
| `perf` | 性能优化 | `perf(graph): virtualize nodes above 200` |
| `test` | 测试 | `test(parser): add 24 unit test cases` |
| `chore` | 构建/工具/依赖 | `chore(deps): update electron to 28.2` |
| `ci` | CI/CD 配置 | `ci(actions): add Windows build matrix` |
| `revert` | 回退 | `revert: feat(parser): add option syntax` |

### 2.3 Scope 范围

| Scope | 对应模块 |
|-------|---------|
| `parser` | @plotflow/core 解析器 |
| `validator` | 语法验证器 |
| `exporter` | JSON/HTML/TXT 导出器 |
| `editor` | Monaco 编辑器相关 |
| `graph` | React Flow 分支图 |
| `completion` | 补全引擎 |
| `condition` | 条件编辑器面板 |
| `electron` | Electron 主进程 |
| `i18n` | 国际化 |
| `theme` | 主题/样式 |
| `template` | 模板系统 |
| `godot` | Godot 插件 |
| `unity` | Unity 接口 |
| `unreal` | Unreal 接口 |
| `docs` | 文档 |
| `ci` | CI/CD |
| `deps` | 依赖管理 |

### 2.4 Subject 规则

- ✅ 使用中文或英文，保持项目一致（本项目推荐中文）
- ✅ 使用祈使句（"添加"而非"添加了"）
- ✅ 首字母小写（中文无此限制）
- ✅ 不以句号结尾
- ✅ 不超过 72 字符

```
✅ feat(parser): 添加选项语法解析支持
✅ fix(editor): 修复 emoji 输入导致 tokenizer 崩溃
✅ docs(standards): 添加 Git 分支策略文档
❌ feat(parser): 添加了选项语法解析支持。（过去式 + 句号）
❌ update code (无 type，无 scope)
```

### 2.5 Body 规范（可选）

当 commit 需要解释"为什么"和"怎么做的"时使用：

```
fix(graph): 修复 200+ 节点时布局抖动

根因是 Dagre 布局在主线程同步计算，阻塞渲染。
修复方案：将 layout 计算移到 requestIdleCallback 中，
并在计算期间显示骨架屏。

修复效果：200 节点场景从 800ms 卡顿降至 <16ms。
```

---

## 3. 合并策略

### 3.1 PR 要求

| 检查项 | L1（自动） | 说明 |
|--------|:---:|------|
| `tsc --noEmit` | ✅ | 零错误 |
| `eslint src/` | ✅ | 零警告 |
| `vitest run` | ✅ | 全量 PASS |
| `playwright test` | ✅ | 冒烟测试 PASS |
| `stylelint` | ✅ | 零警告 |

### 3.2 Merge 方式

- 功能分支 → dev：**Squash merge**（保持 dev 线性历史）
- dev → main（里程碑完成时）：**Merge commit**（保留里程碑边界）

### 3.3 单人项目简化

V0.1 阶段为单人开发，以下可简化：
- PR 审查可跳过（自我审查：对照 L4 复审清单）
- 功能分支在本地开发完成后直接 `git merge --squash` 到 dev
- 重点保证 CI 绿色 + commit 格式规范

---

## 4. Git Hooks

### 4.1 pre-commit（lint-staged）

```javascript
// .husky/pre-commit
npx lint-staged
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.css": [
      "stylelint --fix",
      "prettier --write"
    ]
  }
}
```

### 4.2 commit-msg（commitlint）

```javascript
// .husky/commit-msg
npx --no -- commitlint --edit $1
```

```javascript
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat','fix','docs','style','refactor','perf','test','chore','ci','revert']],
    'scope-empty': [1, 'never'],
    'subject-max-length': [2, 'always', 72],
  },
};
```

---

## 5. 版本标记

```
v0.1.0-m0  ← M0 完成
v0.1.0-m1  ← M1 完成
v0.1.0-m4  ← M4 完成（JSON 导出可用）
v0.1.0     ← M7 完成，正式 V0.1 发布
```

每个里程碑完成后打 annotated tag：
```bash
git tag -a v0.1.0-m0 -m "M0: 项目脚手架完成"
```

---

*本规范在 M0 创建 `.husky/` + `commitlint.config.js` 时正式生效。*
