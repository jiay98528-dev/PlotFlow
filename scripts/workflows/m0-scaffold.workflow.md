# M0 项目脚手架 — 工作流定义

> 这是工作流设计文档，实际执行脚本在下方。

## 模型分配策略

| 模型 | 实际路由 | 分配任务 | 数量 |
|------|---------|---------|:---:|
| `haiku` | V4Flash | 纯配置文件创建（JSON/YAML/CI） | 9 |
| `sonnet` | V4Flash | 需轻量推理的骨架代码 | 2 |
| 默认(opus) | V4Pro | Zustand store 设计 + 集成验证 | 2 |

## 执行脚本

```javascript
export const meta = {
  name: 'm0-scaffold',
  description: 'M0 项目脚手架 — 13 项任务，Fast 并行 + Main 串行，一键完成',
  phases: [
    { title: 'Fast 配置', detail: '9 项纯配置文件创建 (haiku→V4Flash)' },
    { title: 'Fast 骨架', detail: '2 项骨架代码 (sonnet→V4Flash)' },
    { title: 'Main 设计', detail: 'Zustand store 接口设计 (V4Pro)' },
    { title: 'Main 验证', detail: '集成验证：pnpm install + dev + lint (V4Pro)' },
  ],
}

// ============================================================================
// Phase 1: 纯配置文件 — haiku (V4Flash, 最快)
// ============================================================================
phase('Fast 配置')

const CONFIG_TASKS = [
  {
    label: 'pnpm-workspace',
    prompt: `创建 pnpm workspace monorepo 配置。

要求：
1. 在 D:/VibeCoding/PlotFlow/ 下创建 pnpm-workspace.yaml，内容：
   packages:
     - 'packages/*'
2. 创建根 package.json：
   - name: "plotflow"
   - private: true
   - packageManager: "pnpm@9.0.0"
   - scripts: { dev, build, test, lint, typecheck }
3. 创建 packages/app/package.json 骨架
4. 创建 packages/core/package.json 骨架 (name: @plotflow/core)

参考：doc/standards-git.md 中的工具链配置。`,
  },
  {
    label: 'tsconfig',
    prompt: `创建 TypeScript 配置文件。

1. 根目录 tsconfig.json（strict mode，按 doc/standards-ts-react.md §1.1）
2. packages/app/tsconfig.json（继承根配置，增加 React JSX）
3. packages/core/tsconfig.json（继承根配置，Node 环境）

关键 compilerOptions:
- strict: true
- noUncheckedIndexedAccess: true
- noUnusedLocals: true
- noUnusedParameters: true`,
  },
  {
    label: 'eslint-prettier',
    prompt: `创建 ESLint + Prettier 配置。

1. eslint.config.js（flat config 格式）：
   - @typescript-eslint 规则（禁止 any、禁止 as 断言、导入顺序）
   - React 规则（Props readonly、命名约定）
2. .prettierrc：
   - singleQuote: true, semi: true, tabWidth: 2, trailingComma: 'all'
3. 确保与 doc/standards-ts-react.md 的禁止模式对齐`,
  },
  {
    label: 'vitest',
    prompt: `创建 Vitest 单元测试框架配置。

1. 根目录 vitest.config.ts
2. 根目录 vitest.workspace.ts（workspace 模式，包含 packages/app 和 packages/core）
3. packages/core/src/__tests__/example.test.ts（一个简单示例：1+1=2）
4. 确保 pnpm test 可运行`,
  },
  {
    label: 'playwright',
    prompt: `创建 Playwright E2E 测试框架配置。

1. playwright.config.ts（三引擎：chromium/firefox/webkit）
2. packages/app/e2e/example.spec.ts（一个简单示例：打开 Electron 窗口，验证标题）
3. webServer 配置指向 pnpm dev`,
  },
  {
    label: 'ci-workflow',
    prompt: `创建 GitHub Actions CI 骨架。

1. .github/workflows/ci.yml：
   - on: push/pull_request to main/dev
   - jobs: lint / typecheck / test / e2e
   - 矩阵：ubuntu-latest（主要）+ windows-latest（可选）
2. L1 检查：tsc --noEmit → eslint → vitest run`,
  },
  {
    label: 'git-hooks',
    prompt: `创建 Git Hooks 配置。

1. .husky/ 目录：
   - pre-commit: npx lint-staged
   - commit-msg: npx commitlint --edit $1
2. commitlint.config.js：@commitlint/config-conventional，type-enum 按 doc/standards-git.md §2.2
3. package.json 中 lint-staged 配置：*.ts/tsx → eslint + prettier，*.css → stylelint
4. 按 doc/standards-git.md 规范`,
  },
  {
    label: 'dir-structure',
    prompt: `创建完整目录结构。

按 CLAUDE.md §七 文件结构约定创建所有目录。需要创建但不创建文件的目录：

packages/app/src/
  components/editor/
  components/branch-graph/
  components/condition/
  components/completion/
  components/layout/
  stores/
  services/
  core/
  types/
  utils/
packages/app/src-electron/
packages/app/public/
packages/app/e2e/
packages/core/src/
  parser/
  exporter/
  completion/
  types/
tests/fixtures/
tests/unit/
tests/e2e/
scripts/

用一个脚本或直接创建所有目录。`,
  },
  {
    label: 'stylelint',
    prompt: `创建 Stylelint 配置。

1. stylelint.config.js：
   - 按 doc/standards-css.md §5 的配置
   - color-no-hex: true（standards-css.md 除外）
   - custom-property-pattern 正则
2. 创建 packages/app/src/styles/tokens.css 空文件（后续 M6 填充 Token 值）`,
  },
]

const fastConfigResults = await parallel(
  CONFIG_TASKS.map(t => () => agent(t.prompt, { model: 'haiku', label: t.label }))
)

log(`配置文件阶段完成: ${fastConfigResults.filter(Boolean).length}/${CONFIG_TASKS.length}`)

// ============================================================================
// Phase 2: 骨架代码 — sonnet (V4Flash, 需轻量推理)
// ============================================================================
phase('Fast 骨架')

const SKELETON_TASKS = [
  {
    label: 'electron-main',
    prompt: `创建 Electron 28+ 主进程骨架。

文件：packages/app/src-electron/main.ts
- 使用 electron-vite 标准入口
- 创建 BrowserWindow（800×600 空白窗口）
- 加载 Vite dev server URL（开发模式）或 dist/index.html（生产模式）
- 注册基础的 IPC handlers 占位

文件：packages/app/src-electron/preload.ts
- contextBridge.exposeInMainWorld('plotflow', {})
- 空 API 对象，后续 M1 填充

文件：packages/app/index.html（渲染进程入口，空 div#root）

确保 pnpm dev 可启动空白 Electron 窗口。`,
  },
  {
    label: 'react-renderer',
    prompt: `创建 React 18 + TypeScript 5 渲染进程骨架。

文件：packages/app/src/renderer/index.tsx
- React 18 createRoot 入口
- 简单 App 组件（显示 "PlotFlow V0.1" 标题）

文件：packages/app/src/renderer/App.tsx
- 空壳组件，后续填充布局

文件：packages/app/vite.config.ts
- 使用 electron-vite 的 renderer 配置
- React 插件

确保 pnpm build 构建成功，产物存在于 dist/。`,
  },
]

const fastSkeletonResults = await parallel(
  SKELETON_TASKS.map(t => () => agent(t.prompt, { model: 'sonnet', label: t.label }))
)

log(`骨架代码阶段完成: ${fastSkeletonResults.filter(Boolean).length}/${SKELETON_TASKS.length}`)

// ============================================================================
// Phase 3: Zustand store 设计 — V4Pro (需要架构推理)
// ============================================================================
phase('Main 设计')

const storeResult = await agent(
  `设计并创建 Zustand store 初始化骨架。

你需要创建以下文件：

1. packages/app/src/stores/editorStore.ts
   - EditorState 接口：isDirty, content, filePath, cursorPosition, diagnostics
   - Actions: setContent, markSaved, setFilePath, setDiagnostics

2. packages/app/src/stores/storyStore.ts
   - StoryState 接口：plotFlowData, nodes, chapters, variables
   - Actions: setPlotFlowData, updateNode, removeNode

3. packages/app/src/stores/graphStore.ts
   - GraphState 接口：nodes, edges, selectedNodeId, zoomLevel, mode
   - mode: 'minimap' | 'split'
   - Actions: setNodes, setEdges, selectNode, setZoom, toggleMode

4. packages/app/src/stores/uiStore.ts
   - UIState 接口：theme, language, activePanel, statusMessage
   - Actions: toggleTheme, setLanguage, openPanel, setStatus

5. packages/app/src/stores/index.ts（统一导出）

关键约束：
- 按 doc/standards-ts-react.md §3 Zustand Store 规范
- 使用 create<T>()((set) => ({...})) 模式
- 每个 store 单一职责
- 集成 devtools（zustand/middleware）
- 接口签名参考 doc/TAD.md 的数据流图和 spec/types/ast.ts 的类型定义
- 所有状态字段 readonly

注意 M0 是占位实现——store 接口要正确但逻辑可以为空，等待 M1 填充。`,
  { label: 'zustand-stores' }
)

log(`Zustand store 设计完成: ${!!storeResult}`)

// ============================================================================
// Phase 4: 集成验证 — V4Pro
// ============================================================================
phase('Main 验证')

const verifyResult = await agent(
  `验证 M0 脚手架完整性。

请检查以下文件是否都已正确创建，并报告任何缺失或错误：

1. 配置文件检查：
   - pnpm-workspace.yaml
   - 根/子包 tsconfig.json
   - eslint.config.js
   - .prettierrc
   - vitest.config.ts + vitest.workspace.ts
   - playwright.config.ts
   - .github/workflows/ci.yml
   - .husky/pre-commit + commit-msg
   - commitlint.config.js
   - stylelint.config.js

2. 骨架代码检查：
   - packages/app/src-electron/main.ts
   - packages/app/src-electron/preload.ts
   - packages/app/index.html
   - packages/app/src/renderer/index.tsx + App.tsx
   - packages/app/vite.config.ts

3. Store 检查：
   - packages/app/src/stores/ 下 4 个 store 文件 + index.ts

4. 目录结构检查：
   - 按 CLAUDE.md §七 检查所有目录是否存在

5. Package 完整性：
   - packages/app/package.json（含所有必要依赖声明）
   - packages/core/package.json

报告格式：每个检查项 ✅ 或 ❌ + 缺失文件的完整路径。`,
  { label: 'verify' }
)

log(`验证完成:\n${verifyResult}`)

// ============================================================================
// 返回摘要
// ============================================================================
return {
  fastConfig: fastConfigResults.filter(Boolean).length,
  fastSkeleton: fastSkeletonResults.filter(Boolean).length,
  store: !!storeResult,
  verify: verifyResult,
  summary: `M0 脚手架: ${fastConfigResults.filter(Boolean).length + fastSkeletonResults.filter(Boolean).length}/11 Fast 任务 + Zustand store + 集成验证`
}
```

## 执行方式

```bash
# 在 PlotFlow 项目中，用户只需说：
"执行 M0 工作流"
```

AI 会自动调用 `Workflow` 工具，执行上述脚本：
- 9 个 haiku agent 并行跑配置文件
- 2 个 sonnet agent 并行跑骨架代码
- 1 个主模型 agent 做 Zustand store 设计
- 1 个主模型 agent 做集成验证

## 预期效果

| 指标 | 值 |
|------|------|
| 总 agent 数 | 13 |
| V4Flash agent | 11（并行，wall-clock ≈ 单个 agent） |
| V4Pro agent | 2（串行，store 设计 + 验证） |
| 预计总 wall-clock | 2-5 分钟（vs 串行 20-40 分钟） |
| Resume 缓存 | 修改任务后重跑，未修改的 agent 结果免重算 |
