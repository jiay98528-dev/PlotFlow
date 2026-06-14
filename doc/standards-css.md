# PlotFlow CSS / Design Token 规范

> **版本**：V0.1 | **日期**：2026-06-12 | **强制执行**：Stylelint `color-no-hex: true`
> **关联**：`PRD.md §5.5`（色值体系）| `spec/design-brief-editor-ux.md`（UX 唯一真相源）

---

## 1. 核心强制规则

### 1.1 禁止裸 hex 色值

```css
/* ❌ 绝对禁止 */
.my-component {
  color: #333333;
  background: #f5f5f5;
  border: 1px solid #dddddd;
}

/* ✅ 必须使用 Design Token */
.my-component {
  color: var(--color-text-primary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-default);
}
```

**唯一例外**：`doc/standards-css.md`（本文件）和 Design Token 定义文件可以包含 hex 色值（仅用于定义 Token 本身）。

### 1.2 主题切换通过 CSS 变量驱动

```css
/* ❌ 禁止 */
.light .editor { background: #ffffff; color: #333333; }
.dark .editor { background: #1e1e1e; color: #d4d4d4; }

/* ✅ 正确 */
:root, [data-theme="light"] {
  --color-bg-editor: #FFFFFF;
  --color-text-editor: #333333;
}

[data-theme="dark"] {
  --color-bg-editor: #1E1E1E;
  --color-text-editor: #D4D4D4;
}

.editor {
  background: var(--color-bg-editor);
  color: var(--color-text-editor);
}
```

---

## 2. Design Token 体系

### 2.1 Token 命名规范

```
--<category>-<role>-<variant>-<state>
  │         │       │          └── 可选：交互状态 (hover, active, disabled, focus)
  │         │       └── 可选：变体 (muted, subtle, strong, inverse)
  │         └── 必填：语义角色 (bg, text, border, icon, accent)
  └── 必填：类别 (color, space, radius, shadow, font, motion)
```

### 2.2 色值 Token（来自 PRD §5.5）

```css
/* ================================================================
   语义层 Color Tokens
   ================================================================ */

/* 基础中性色 — 亮色主题 */
--color-bg-primary:        #FFFFFF;   /* 编辑器画布背景 */
--color-bg-secondary:      #F5F5F6;   /* 面板/侧边栏背景 */
--color-bg-tertiary:       #EDEDEF;   /* 卡片/悬停背景 */
--color-bg-inverse:        #1E1E1E;   /* 反向背景（tooltip 等） */

--color-text-primary:      #333333;   /* 正文 */
--color-text-secondary:    #5A5A5A;   /* 辅助文字 */
--color-text-muted:        #8A8A8A;   /* 占位/禁用 */
--color-text-inverse:      #FFFFFF;   /* 反向文字 */

--color-border-default:    #E0E0E0;   /* 默认边框 */
--color-border-strong:     #C0C0C0;   /* 强调边框 */
--color-border-focus:      var(--color-accent); /* 聚焦边框 */

/* 语法高亮色 — 7 色（暗色/亮色共用色相，调整亮度） */
/* 亮色主题 */
--color-syntax-heading:    #1A6FB5;   /* # 节点标题 — 蓝 */
--color-syntax-option:     #3A8C4A;   /* [选项] — 绿 */
--color-syntax-condition:  #C5662A;   /* 条件: — 橙 */
--color-syntax-effect:     #A08020;   /* 效果: — 黄褐 */
--color-syntax-variable:   #7B40A0;   /* $变量 — 紫 */
--color-syntax-target:     #1A9090;   /* -> 跳转目标 — 青 */
--color-syntax-comment:    #8A8A8A;   /* 注释 — 灰 */

/* 诊断色 — 3 级 */
--color-diagnostic-error:    #D32F2F; /* 红色波浪线 */
--color-diagnostic-warning:  #F9A825; /* 黄色波浪线 */
--color-diagnostic-info:     #1976D2; /* 蓝色下划线 */

/* 强调色 — 暖金（来自 Design Brief） */
--color-accent:            #A0703A;
--color-accent-hover:      #825A2E;
--color-accent-subtle:     rgba(160, 112, 58, 0.08);
--color-text-on-accent:    #FFFFFF;

/* 分支图节点状态色 */
--color-node-normal:       #4CAF50;
--color-node-orphan:       #FFC107;
--color-node-deadend:      #9E9E9E;
--color-node-error:        #F44336;
--color-node-selected:     #2196F3;

/* 暗色主题覆盖 */
[data-theme="dark"] {
  --color-bg-primary:        #1E1E1E;
  --color-bg-secondary:      #252526;
  --color-bg-tertiary:       #2D2D2D;
  --color-bg-inverse:        #FFFFFF;

  --color-text-primary:      #D4D4D4;
  --color-text-secondary:    #A0A0A0;
  --color-text-muted:        #6A6A6A;
  --color-text-inverse:      #1E1E1E;

  --color-border-default:    #404040;
  --color-border-strong:     #606060;

  /* 暗色语法高亮 — 相同色相，提高亮度 */
  --color-syntax-heading:    #569CD6;
  --color-syntax-option:     #6A9955;
  --color-syntax-condition:  #CE9178;
  --color-syntax-effect:     #DCDCAA;
  --color-syntax-variable:   #C586C0;
  --color-syntax-target:     #4EC9B0;
  --color-syntax-comment:    #6A6A6A;

  --color-diagnostic-error:    #F44747;
  --color-diagnostic-warning:  #FFD54F;
  --color-diagnostic-info:     #64B5F6;

  --color-accent:            #C49050;
  --color-accent-hover:      #D4A860;
  --color-accent-subtle:     rgba(196, 144, 80, 0.12);
}
```

### 2.3 间距 Token

```css
/* 基于 4px 网格 */
--space-0:   0;
--space-1:   4px;
--space-2:   8px;
--space-3:   12px;
--space-4:   16px;
--space-5:   20px;
--space-6:   24px;
--space-8:   32px;
--space-10:  40px;
--space-12:  48px;
--space-16:  64px;

/* 编辑器专用 */
--space-editor-padding:     16px;
--space-panel-padding:      12px;
--space-gutter:             8px;
```

### 2.4 圆角 Token

```css
--radius-none:   0;
--radius-sm:     2px;   /* 内联元素 */
--radius-md:     4px;   /* 按钮/输入框/卡片 */
--radius-lg:     8px;   /* 面板/对话框 */
--radius-xl:     12px;  /* 大型容器 */
--radius-full:   9999px; /* 药丸/徽章 */
```

### 2.5 阴影 Token

```css
/* 亮色 */
--shadow-sm:    0 1px 2px rgba(0, 0, 0, 0.06);
--shadow-md:    0 2px 8px rgba(0, 0, 0, 0.10);
--shadow-lg:    0 4px 16px rgba(0, 0, 0, 0.12);
--shadow-xl:    0 8px 32px rgba(0, 0, 0, 0.16);

/* 暗色 — 阴影在暗色背景下使用白色而非黑色 */
[data-theme="dark"] {
  --shadow-sm:    0 1px 2px rgba(0, 0, 0, 0.20);
  --shadow-md:    0 2px 8px rgba(0, 0, 0, 0.30);
  --shadow-lg:    0 4px 16px rgba(0, 0, 0, 0.40);
  --shadow-xl:    0 8px 32px rgba(0, 0, 0, 0.50);
}
```

### 2.6 字体 Token

```css
--font-sans:    'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono:    'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
--font-editor:  var(--font-mono);  /* 编辑器使用等宽字体 */
--font-ui:      var(--font-sans);  /* UI 组件使用无衬线字体 */

/* 字号层级 — 1.25 比率 */
--text-xs:     0.75rem;   /* 12px */
--text-sm:     0.875rem;  /* 14px */
--text-base:   1rem;      /* 16px */
--text-lg:     1.25rem;   /* 20px */
--text-xl:     1.5rem;    /* 24px */
--text-2xl:    1.875rem;  /* 30px */
--text-3xl:    2.25rem;   /* 36px */
```

### 2.7 动效 Token

```css
/* 持续时间 */
--motion-fast:      150ms;
--motion-normal:    300ms;
--motion-slow:      500ms;

/* 缓动曲线 — ease-out 为主（expo 曲线） */
--ease-out-quart:   cubic-bezier(0.25, 1, 0.5, 1);
--ease-out-expo:    cubic-bezier(0.19, 1, 0.22, 1);
--ease-in-out:      cubic-bezier(0.65, 0, 0.35, 1);
```

---

## 3. CSS 编写规范

### 3.1 使用 CSS Modules

```css
/* MonacoEditor.module.css */
.editorContainer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
}

.toolbar {
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--color-border-default);
}
```

```typescript
// MonacoEditor.tsx
import styles from './MonacoEditor.module.css';

<div className={styles.editorContainer}>
  <div className={styles.toolbar}>...</div>
</div>
```

### 3.2 布局优先使用 Grid + Flexbox

```css
/* ✅ Grid 用于页面级布局 */
.appShell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: 240px 1fr;
  grid-template-areas:
    "topbar  topbar"
    "sidebar main"
    "status  status";
  height: 100vh;
}

/* ✅ Flexbox 用于组件级布局 */
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
```

### 3.3 响应式

```css
/* ✅ Container queries 优先 */
.panel {
  container-type: inline-size;
}

@container (max-width: 200px) {
  .outlineItem { font-size: var(--text-xs); }
}

/* ✅ 仅在必要时使用媒体查询 */
@media (max-width: 768px) {
  .appShell {
    grid-template-columns: 1fr;
  }
}
```

### 3.4 禁止模式

```css
/* ❌ !important（仅在覆盖第三方库样式时允许，需加注释说明原因） */
.button { color: red !important; }

/* ❌ 动画操作 layout 属性 */
.node { transition: width 300ms; }
/* ✅ */
.node { transition: transform 300ms var(--ease-out-expo); }

/* ❌ 裸 z-index 值（使用 Token） */
.modal { z-index: 9999; }
/* ✅ */
:root { --z-modal: 1000; }
.modal { z-index: var(--z-modal); }

/* ❌ 硬编码滚动条样式（浏览器原生滚动条即可） */
::-webkit-scrollbar { width: 8px; }
```

---

## 4. Monaco Editor 主题

### 4.1 Tokenizer 颜色

Monaco Monarch tokenizer 必须引用上述 `--color-syntax-*` Token。主题定义文件（`.json`）是唯一可以直接包含 hex 色值的文件（除外条款）。

### 4.2 行装饰

```typescript
// ✅ 通过 className 而非内联颜色
const decorations: IModelDeltaDecoration[] = [
  {
    range: errorRange,
    options: {
      className: 'diagnostic-error-underline',  // CSS: border-bottom: 2px wavy var(--color-diagnostic-error)
      hoverMessage: { value: formatDiagnostic(error) },
      glyphMarginClassName: 'diagnostic-error-glyph',  // CSS: color: var(--color-diagnostic-error)
    },
  },
];
```

---

## 5. Stylelint 配置（M0 CI 中启用）

```javascript
// stylelint.config.js
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'color-no-hex': [true, {
      ignore: ['context/standards-css.md', '**/monaco-theme-*.json']
    }],
    'declaration-no-important': true,
    'selector-max-id': 0,
    'number-max-precision': 4,
    'custom-property-pattern': '^(color|space|radius|shadow|font|motion|z)-[a-z]+(-[a-z]+)*$',
  },
};
```

---

*本文件定义的所有 Token 在 `packages/app/src/styles/tokens.css` 中实现。*
