# PlotFlow TypeScript + React 编码规范

> **版本**：V0.1 | **日期**：2026-06-12 | **强制执行**：ESLint + Prettier 自动检查
> **关联**：`CLAUDE.md`（代码约束）| `doc/TAD.md`（架构设计）

---

## 1. TypeScript 规范

### 1.1 严格模式

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 1.2 类型优先原则

- ✅ **必须**为所有函数参数和返回值显式标注类型
- ✅ **必须**为所有 Zustand store 定义显式 interface
- ❌ **禁止**使用 `any`（ESLint: `@typescript-eslint/no-explicit-any: error`）
- ❌ **禁止**使用 `as` 类型断言绕过类型检查（`@typescript-eslint/consistent-type-assertions`）
- ⚠️ **例外**：`as const` 允许；第三方库类型缺失时使用 `unknown` 而非 `any`

```typescript
// ❌ 禁止
function parseStory(raw: any): any { ... }
const nodes = data as PlotFlowNode[];

// ✅ 正确
function parseStory(raw: string): ParseResult<PlotFlowData> { ... }
const nodes: PlotFlowNode[] = validateNodes(data);
```

### 1.3 类型定义位置

| 类型范围 | 位置 | 示例 |
|----------|------|------|
| 跨包共享 | `packages/core/src/types/` | `PlotFlowData`, `StoryNode`, `Option` |
| 组件 Props | 与组件同文件，顶部导出 | `interface MonacoEditorProps { ... }` |
| Store 类型 | `src/stores/types.ts` | `EditorState`, `GraphState` |
| 工具函数签名 | 与函数同文件 | `function debounce<T>(fn: T, ms: number): T` |

### 1.4 禁止模式

```typescript
// ❌ 可选链滥用（隐藏问题）
const title = node?.body?.text?.substring?.(0, 10);
// ✅ 提前返回 + 明确处理
if (!node?.body?.text) return '';
const title = node.body.text.substring(0, 10);

// ❌ 枚举（使用 union type + const 断言替代）
enum NodeStatus { Normal, Orphan, DeadEnd }
// ✅
const NODE_STATUS = { Normal: 'normal', Orphan: 'orphan', DeadEnd: 'deadend' } as const;
type NodeStatus = (typeof NODE_STATUS)[keyof typeof NODE_STATUS];

// ❌ 默认导出（命名导出便于重构和 tree-shaking）
export default function Editor() { ... }
// ✅
export function Editor() { ... }
```

### 1.5 错误处理

```typescript
// ✅ Result 模式（不抛异常，返回可联合类型）
type ParseResult<T> = 
  | { ok: true; data: T }
  | { ok: false; errors: Diagnostic[] };

// ❌ 裸 try-catch 吞错误
try { parseStory(raw); } catch (e) {}
// ✅ 明确处理
try {
  parseStory(raw);
} catch (error) {
  logger.error('Parse failed', { error, file: path });
  setDiagnostics([createFatalError(error)]);
}
```

---

## 2. React 组件规范

### 2.1 组件声明

```typescript
// ✅ 函数声明 + 显式 Props 类型 + 命名导出
interface EditorToolbarProps {
  readonly onSave: () => void;
  readonly isDirty: boolean;
  readonly wordCount: number;
}

export function EditorToolbar({ onSave, isDirty, wordCount }: EditorToolbarProps) {
  // ...
}

// ❌ 匿名函数 + 内联类型
export const EditorToolbar = ({ onSave, isDirty }: { onSave: () => void; isDirty: boolean }) => { ... };
```

### 2.2 Props 约束

- ✅ 所有 Props 使用 `readonly` 修饰
- ✅ 事件回调以 `on` 开头（`onSave`, `onNodeClick`）
- ✅ 布尔 Props 以 `is`/`has`/`should` 开头（`isDirty`, `hasErrors`）
- ❌ 禁止传递整个 store 作为 Props（粒度太粗）
- ❌ 禁止在 Props 中使用 `any`

### 2.3 Hooks 使用顺序

```typescript
export function MyComponent({ onSave }: Props) {
  // 1. Store hooks
  const nodes = useStoryStore(s => s.nodes);
  
  // 2. Local state
  const [isOpen, setIsOpen] = useState(false);
  
  // 3. Refs
  const editorRef = useRef<EditorRef>(null);
  
  // 4. Derived values
  const errorCount = useMemo(() => nodes.filter(n => n.hasError).length, [nodes]);
  
  // 5. Callbacks
  const handleSave = useCallback(() => { onSave(); }, [onSave]);
  
  // 6. Effects
  useEffect(() => { /* ... */ }, [nodes]);
  
  // 7. Render
  return ( /* ... */ );
}
```

### 2.4 禁止模式

```typescript
// ❌ 在渲染中直接调用 setState（导致无限循环）
if (nodes.length > 100) setVirtualScroll(true);
// ✅ 放在 useEffect 中
useEffect(() => { setVirtualScroll(nodes.length > 100); }, [nodes.length]);

// ❌ 使用 index 作为 key
{items.map((item, i) => <div key={i}>{item}</div>)}
// ✅ 使用稳定唯一标识
{items.map(item => <div key={item.id}>{item}</div>)}

// ❌ JSX 中内联箭头函数（每次都创建新引用）
<Button onClick={() => handleClick(node.id)} />
// ✅ useCallback 包裹
const handleNodeClick = useCallback((id: string) => { handleClick(id); }, [handleClick]);
<Button onClick={() => handleNodeClick(node.id)} />

// ❌ 派生状态（用 useMemo 替代）
const [fullName, setFullName] = useState(`${firstName} ${lastName}`);
// ✅
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]);
```

---

## 3. Zustand Store 规范

### 3.1 Store 结构

```typescript
// ✅ 标准结构
interface EditorState {
  // 状态
  readonly isDirty: boolean;
  readonly content: string;
  
  // Actions（命名以动词开头）
  setContent: (content: string) => void;
  markSaved: () => void;
  reset: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  isDirty: false,
  content: '',
  
  setContent: (content) => set({ content, isDirty: true }),
  markSaved: () => set({ isDirty: false }),
  reset: () => set({ isDirty: false, content: '' }),
}));
```

### 3.2 Store 规则

- ✅ 每个 store 单一职责（`useEditorStore`, `useGraphStore`, `useStoryStore`）
- ✅ Action 命名以动词开头（`set`, `update`, `add`, `remove`, `reset`, `toggle`）
- ✅ 复杂逻辑抽取为 store 外的纯函数
- ❌ 禁止 store 之间循环引用
- ❌ 禁止在 store 的 set 回调中使用 `get()` 读取其他 store（通过组件层协调）

---

## 4. 文件组织

### 4.1 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| React 组件文件 | PascalCase | `MonacoEditor.tsx`, `GraphCanvas.tsx` |
| Hook 文件 | camelCase，`use` 前缀 | `useAutoSave.ts`, `useKeyboard.ts` |
| Store 文件 | camelCase，`Store` 后缀 | `editorStore.ts`, `graphStore.ts` |
| 工具函数 | camelCase | `debounce.ts`, `formatDiagnostic.ts` |
| 类型文件 | camelCase | `ast.ts`, `diagnostic.ts` |
| 测试文件 | 同源文件 + `.test` | `parser.test.ts`, `validator.test.ts` |
| 目录 | kebab-case | `branch-graph/`, `condition-editor/` |

### 4.2 导入顺序

```typescript
// 1. Node 内置
import { join } from 'node:path';

// 2. 第三方库
import { create } from 'zustand';
import { NodeProps } from '@xyflow/react';

// 3. workspace 包
import { parseStory, type PlotFlowData } from '@plotflow/core';

// 4. 项目内绝对导入
import { useEditorStore } from '@/stores/editorStore';
import { EditorToolbar } from '@/components/editor/EditorToolbar';

// 5. 相对导入
import { formatPath } from '../utils/formatPath';
```

---

## 5. 注释规范

```typescript
// ✅ JSDoc 用于公共 API
/**
 * 解析 .mdstory 原始文本为 PlotFlowData 中间表示。
 * @param raw - .mdstory 文件原始 UTF-8 文本
 * @returns ParseResult — ok 携带 AST，fail 携带诊断信息
 * @throws 不抛异常，所有错误通过返回值的 ok: false 表示
 */
export function parseStory(raw: string): ParseResult<PlotFlowData> { ... }

// ✅ 行内注释解释"为什么"（不是"是什么"）
// 使用 desc 而非 asc 排序，因为大多数场景下最新节点在底部
const sortedNodes = nodes.sort((a, b) => a.lineNumber - b.lineNumber);

// ❌ 冗余注释
// 设置内容
setContent(content); // ← 废话
```

---

*本规范由 ESLint + Prettier 自动执行。CI 中 L1 检查零警告为合并前提。*
