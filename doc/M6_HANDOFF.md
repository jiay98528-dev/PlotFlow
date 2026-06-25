# M6 模板与主题 — GPT Codex 交接文档

> **目标读者**：GPT (Codex)，上下文窗口有限
> **创建日期**：2026-06-13
> **完成日期**：2026-06-13
> **当前状态**：M6 已完成，18/18 任务通过本地验证
> **快照说明**：本文是 2026-06-13 的 M6 历史交接快照，当前真实进度以 `spec/progress.md` 为准。

---

## 一、项目现状（GPT 需要知道的）

PlotFlow 是 Electron 桌面应用——面向独立游戏开发者的叙事分支编辑器。按本历史快照，M0-M6 已完成（当时统计为 125/142，88%），M7 待启动。当前真实进度不要使用本段数字，请以 `spec/progress.md` 为准。

```
历史快照已完成 (125/142 tasks):
  M0: pnpm workspace + Electron + React + CI/CD
  M1: .mdstory 解析器 (5 个递归下降解析器, 458 tests)
  M2: React Flow 分支图 (Dagre 布局, 拖拽连线)
  M3: 条件编辑器 + 17 种诊断规则 (544 tests)
  M4: JSON/HTML/TXT 导出器 + Godot/Unity/Unreal 接口 (676 tests)
  M5: N-gram 补全引擎 + GhostText Monaco 插件 (742 tests)
  M6: 模板系统 + 主题切换 + 中英双语 + toolbar UI polish

L1-L3 全绿: tsc ✅ | eslint ✅ | stylelint ✅ | 746 tests ✅ | Playwright 2/2 ✅ | build ✅
```

**当前项目文件结构（只列 M6 相关）**：
```
packages/app/src/
  components/panels/          ← 条件编辑器, 问题面板, 导出对话框
  components/layout/          ← 大纲面板, 状态栏
  components/editor/          ← MonacoEditor (真实实例, 解析管线已接通)
  editor/                     ← tokenizer, themes, setup, GhostText
  services/                   ← 解析管线, 自动保存, 文件服务
  stores/                     ← Zustand (editor, story, graph, ui)
  styles/                     ← global.css, diagnostics.css, branch-graph.css
packages/core/src/
  parser/                     ← 5 个解析器 (frontmatter, parser, options, conditions, effects)
  validator/                  ← 17 种诊断规则
  exporter/                   ← JSON/HTML/TXT 导出器
  completion/                 ← N-gram 引擎
  types/                      ← AST + Diagnostic 类型合同
```

---

## 二、M6 任务清单（18 项，89% Fast）

### 模板系统 (6 项)

| # | 任务 | 输入 | 产出文件 |
|---|------|------|---------|
| M6-01 | 模板引擎 | 无 | `packages/core/src/template/TemplateEngine.ts` |
| M6-02 | RPG 对话模板 (8 节点) | 模板引擎 | `templates/rpg-dialogue.mdstory` |
| M6-03 | 视觉小说模板 (6 节点) | 模板引擎 | `templates/visual-novel.mdstory` |
| M6-04 | 解谜游戏模板 (10 节点) | 模板引擎 | `templates/puzzle-escape.mdstory` |
| M6-05 | Godot 示例项目 (10 节点) | 模板引擎 | `templates/godot-example/` |
| M6-06 | 新建文件对话框 | 模板引擎 | `packages/app/src/components/panels/NewFileDialog.tsx` |

### 主题系统 (8 项)

| # | 任务 | 产出文件 |
|---|------|---------|
| M6-07 | 暗色主题 CSS 变量 | `packages/app/src/styles/tokens-dark.css` |
| M6-08 | 暗色 Monaco 主题 | `packages/app/src/editor/monaco-theme-dark.json` (已存在, 验证) |
| M6-09 | 暗色分支图节点样式 | `packages/app/src/styles/branch-graph.css` (追加 .theme-dark 规则) |
| M6-10 | 亮色主题 CSS 变量 | `packages/app/src/styles/tokens-light.css` |
| M6-11 | 亮色 Monaco 主题 | `packages/app/src/editor/monaco-theme-light.json` (已存在, 验证) |
| M6-12 | 亮色分支图节点样式 | 同上，默认即亮色 (验证即可) |
| M6-13 | ThemeProvider + 切换机制 | `packages/app/src/components/ThemeProvider.tsx` |
| M6-14 | 工具栏切换按钮 | 更新 `App.tsx` |

### 国际化 (4 项)

| # | 任务 | 产出文件 |
|---|------|---------|
| M6-15 | i18n 框架集成 | `packages/core/src/i18n/i18n.ts` |
| M6-16 | 中文翻译文件 | `locales/zh-CN.json` |
| M6-17 | 英文翻译文件 | `locales/en-US.json` |
| M6-18 | 语言切换器 | 更新 `uiStore.ts` + `App.tsx` |

---

## 三、核心引用（GPT 需要阅读的关键文档）

### 必读（按优先级）

| 优先级 | 文档 | 内容 | M6 为何需要 |
|:---:|------|------|------|
| 🔴 | `doc/standards-css.md` | **Design Token 体系** — 全部 CSS 变量定义 | 创建 tokens-dark.css / tokens-light.css 的直接来源 |
| 🔴 | `doc/standards-ts-react.md` | TS + React 编码规范 | 所有组件需遵守 |
| 🟡 | `spec/design-brief-editor-ux.md` | UX 设计唯一真相源 | 主题切换交互设计 |
| 🟡 | `CLAUDE.md` §六 §八 | 架构约束 + 禁止事项 | 禁止裸 hex / 必须 CSS 变量 / 禁止数据库 |

### 参考（按需查阅）

| 文档 | M6 相关章节 |
|------|------|
| `spec/milestones.md` | M6 完整任务表 (L4 复审清单) |
| `doc/TAD.md` | 组件架构 |
| `packages/app/src/styles/branch-graph.css` | 现有分支图样式，追加暗色规则 |
| `packages/app/src/editor/monaco-theme-dark.json` | 已存在，只需验证与 Token 表对齐 |
| `packages/app/src/editor/monaco-theme-light.json` | 同上 |

---

## 四、关键约束（违反即重做）

1. **禁止裸 hex 色值** — 所有颜色必须用 `var(--color-*)` 引用
2. **主题切换 = CSS 变量驱动** — 在 `<html data-theme="dark">` 上切换属性，所有组件自动跟随
3. **Monaco 主题已存在** — M1-09 已创建 dark.json / light.json，M6 只需**验证色值与 standards-css.md 对齐**，不需要重建
4. **i18n 使用 `react-i18next`** — 已在 M0 package.json 中，`pnpm add react-i18next i18next` 即可
5. **所有 Props 使用 `readonly`** — 参照现有组件模式
6. **命名导出，禁止 `export default`** — 参照现有组件模式
7. **文件路径正斜杠 `/`，UTF-8 编码**

---

## 五、M6-07~12 具体实现指南

### 5.1 M6-07/10: CSS Token 文件

直接在 `doc/standards-css.md` §2.2 中**复制 Token 表** → 写入文件：

```
packages/app/src/styles/tokens-dark.css:
  从 standards-css.md 复制 [data-theme="dark"] 块的全部变量

packages/app/src/styles/tokens-light.css:
  从 standards-css.md 复制 :root 块的全部变量 (即亮色默认值)
```

### 5.2 M6-08/11: Monaco 主题验证

已有文件：
- `packages/app/src/editor/monaco-theme-dark.json` (18 行)
- `packages/app/src/editor/monaco-theme-light.json` (18 行)

验证清单：
- [ ] heading → 暗色 #569CD6 / 亮色 #1A6FB5
- [ ] option → 暗色 #6A9955 / 亮色 #3A8C4A
- [ ] condition → 暗色 #CE9178 / 亮色 #C5662A
- [ ] effect → 暗色 #DCDCAA / 亮色 #A08020
- [ ] variable → 暗色 #C586C0 / 亮色 #7B40A0
- [ ] target → 暗色 #4EC9B0 / 亮色 #1A9090
- [ ] comment → 暗色 #6A6A6A / 亮色 #8A8A8A

与 standards-css.md 的 `--color-syntax-*` Token 表逐项对照。**如果一致，M6-08 和 M6-11 直接标记完成。**

### 5.3 M6-09/12: 分支图主题样式

在 `packages/app/src/styles/branch-graph.css` 文件末尾追加：

```css
/* ── 暗色主题覆盖 ── */
[data-theme="dark"] .node-card {
  background: var(--color-bg-tertiary);  /* #2D2D2D */
  border-color: var(--color-border-strong);
}
[data-theme="dark"] .node-status-normal { border-color: var(--color-node-normal); }
/* ... 其他状态同理 */
```

亮色是默认值，已有样式即为亮色，M6-12 直接标记完成。

### 5.4 M6-13: ThemeProvider

```tsx
// packages/app/src/components/ThemeProvider.tsx
import { useEffect } from 'react';
import { useUIStore } from '../stores/uiStore';

export function ThemeProvider({ children }: { readonly children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <>{children}</>;
}
```

在 `App.tsx` 中包裹根组件。

### 5.5 M6-14: 切换按钮

在 `uiStore.ts` 中 `toggleTheme()` 已实现。只需在工具栏添加按钮：
```tsx
<button onClick={() => useUIStore.getState().toggleTheme()}>
  {theme === 'light' ? '🌙' : '☀️'}
</button>
```

---

## 六、M6-01~06 模板系统指南

### 6.1 模板引擎 (M6-01)

创建 `packages/core/src/template/TemplateEngine.ts`：

```typescript
// 简单 {{var}} 占位符替换
export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
```

### 6.2 模板文件结构 (M6-02~05)

每个 `.mdstory` 模板包含：
```markdown
---
plotflow: "0.1"
title: {{title}}
author: {{author}}
engine: {{engine}}
vars:
  变量名: 类型
---

# 章节：章节名

## 节点：节点名
正文描述...
[选项] 选项描述 -> 节点：目标
```

创建 4 个模板文件到 `templates/` 目录。参考 `PRD.md` 的示例场景。

### 6.3 NewFileDialog (M6-06)

Props: `{ readonly onClose: () => void; readonly onTemplateSelected: (template: string, meta: { title: string; author: string }) => void }`

UI 流程：
1. 显示 4 个模板卡片（标题 + 描述 + 节点数）
2. 选择后 → 填写标题/作者输入框
3. 确认 → 调用 `onTemplateSelected` → 编辑器加载渲染后的模板内容

---

## 七、M6-15~18 i18n 指南

### 7.1 安装依赖

```bash
pnpm add react-i18next i18next --filter @plotflow/app
```

### 7.2 i18n 框架 (M6-15)

创建 `packages/core/src/i18n/i18n.ts`：
```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from '../../../locales/zh-CN.json';
import en from '../../../locales/en-US.json';

i18n.use(initReactI18next).init({
  resources: { 'zh-CN': { translation: zh }, 'en-US': { translation: en } },
  lng: 'zh-CN',
  fallbackLng: 'en-US',
  interpolation: { escapeValue: false },
});

export default i18n;
```

### 7.3 翻译文件 (M6-16/17)

创建 `locales/zh-CN.json` 和 `locales/en-US.json`，覆盖全部 UI 文本：

```json
{
  "menu": { "file": "文件", "edit": "编辑", "view": "视图", "export": "导出", "help": "帮助" },
  "toolbar": { "save": "保存", "undo": "撤销", "redo": "重做" },
  "statusBar": { "saved": "已保存", "unsaved": "未保存", "nodes": "节点", "options": "选项" },
  "panels": { "outline": "大纲", "problems": "问题", "conditions": "条件编辑器" },
  "dialogs": { "newFile": "新建文件", "export": "导出", "settings": "设置" },
  "errors": {
    "E001": "目标节点未定义",
    "E002": "变量未声明",
    "E003": "枚举值非法",
    "E004": "类型不匹配",
    "E005": "语法解析失败",
    "E006": "嵌套深度超限",
    "E007": "节点ID重名",
    "E008": "变量重复声明"
  },
  "warnings": {
    "W001": "孤立节点",
    "W002": "死胡同节点",
    "W003": "未使用变量",
    "W004": "重复选项描述",
    "W005": "空描述节点",
    "W006": "格式不规范"
  },
  "suggestions": {
    "I001": "可能卡关",
    "I002": "描述过短",
    "I003": "无章节归属"
  }
}
```

英文版对应翻译。

### 7.4 语言切换 (M6-18)

在 `uiStore.ts` 中：
```typescript
setLanguage: (lang: 'zh-CN' | 'en-US') => {
  i18n.changeLanguage(lang);
  set({ language: lang });
}
```

---

## 八、验证清单（GPT 完成后自查）

- [x] `pnpm.cmd exec tsc --noEmit` — 零错误
- [x] `pnpm.cmd exec eslint . --ext .ts,.tsx` — 零错误；保留 `scripts/preprocess-corpus.ts` 既有 25 个 `no-console` warnings
- [x] `pnpm.cmd exec stylelint "packages/app/src/styles/**/*.css"` — 零错误
- [x] `pnpm.cmd exec vitest run` — 25 files / 746 tests PASS
- [x] `pnpm.cmd exec playwright test` — 2/2 PASS
- [x] `pnpm.cmd exec electron-vite build` — PASS；保留 `CorpusLoader.ts` 浏览器打包路径的既有 Vite warning
- [x] 4 个 `.mdstory` 模板文件存在且可被 `parseStory()` 成功解析
- [x] `tokens-dark.css` + `tokens-light.css` 使用 CSS 变量驱动；强调色按 UX brief 恢复为 CTA/选中态蓝色
- [x] 切换 `data-theme` 属性后主题即时变化、无闪烁
- [x] 中英文切换后工具栏与标题即时更新

---

## 九、M6 实际交付摘要

### 9.1 代码与资源

| 范围 | 文件 |
|------|------|
| 模板引擎 | `packages/core/src/template/TemplateEngine.ts`、`packages/core/src/index.ts` |
| 内置模板 | `templates/rpg-dialogue.mdstory`、`templates/visual-novel.mdstory`、`templates/puzzle-escape.mdstory`、`templates/godot-example/` |
| 应用模板数据 | `packages/app/src/templates/builtinTemplates.ts`、`packages/app/src/templates/builtinTemplates.test.ts` |
| 新建文件 UI | `packages/app/src/components/panels/NewFileDialog.tsx`、`packages/app/src/styles/new-file-dialog.css` |
| 主题系统 | `packages/app/src/components/ThemeProvider.tsx`、`packages/app/src/styles/tokens-light.css`、`packages/app/src/styles/tokens-dark.css`、`packages/app/src/styles/app-shell.css` |
| i18n | `packages/core/src/i18n/i18n.ts`、`locales/zh-CN.json`、`locales/en-US.json` |
| E2E | `packages/app/e2e/m6-template-theme.spec.ts` |
| UI polish | `lucide-react` 图标、工具栏分组控件、按钮状态、模板卡选中状态、移动宽度无横向溢出 |

### 9.2 截图证据

| 场景 | 文件 |
|------|------|
| 亮色主界面 | `test-results/m6-polish-shell-light.png` |
| 新建模板对话框 | `test-results/m6-polish-new-file-dialog.png` |
| 暗色主界面 | `test-results/m6-polish-shell-dark.png` |
| 窄屏宽度 | `test-results/m6-polish-mobile.png` |
| E2E 模板对话框 | `test-results/m6-template-dialog-e2e.png` |

### 9.3 已知残留

| 项 | 状态 |
|----|------|
| `scripts/preprocess-corpus.ts` `console` warnings | 既有脚本输出行为，ESLint 0 errors，未在 M6 中改动 |
| Vite `CorpusLoader.ts` Node module externalized warnings | 既有浏览器打包路径警告，build 通过，建议在 M7 前单独处理 |
| UX brief 中的欢迎页/游戏化任务面板 | 属于 M6 原扩展设想，本轮未实现；M7 首次启动引导可承接 |

---

*文档结束。M6 已完成，下一阶段进入 M7 Electron 打包与发布。*
