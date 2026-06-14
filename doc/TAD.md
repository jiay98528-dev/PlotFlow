# PlotFlow 技术架构设计 (TAD)

**版本**：V0.1 | **日期**：2026-06-10 | **状态**：MVP 实现蓝图

---

## 1. 架构总览

### 1.1 三层架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                    Electron Main Process                         │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ FileService  │  │ AutoSaver    │  │ NativeMenuBuilder     │  │
│  │              │  │              │  │                       │  │
│  │ read(path)   │  │ debounce     │  │ buildTemplateMenu()   │  │
│  │ write(path,  │  │ (500ms)      │  │ buildEditMenu()       │  │
│  │   content)   │  │ queue        │  │ buildHelpMenu()       │  │
│  │ watch(path)  │  │ flush()      │  │ registerShortcuts()   │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                 │                      │               │
│  ┌──────┴─────────────────┴──────────────────────┴───────────┐  │
│  │                    IPC Bridge (contextBridge)              │  │
│  │  exposeInMainWorld('plotflow', { file, menu, dialog, ...})│  │
│  └──────────────────────────┬───────────────────────────────┘  │
├─────────────────────────────┼──────────────────────────────────┤
│   Electron Renderer Process │                                  │
│  ┌──────────────────────────┴───────────────────────────────┐  │
│  │               UI Layer (React 18 + TypeScript 5)          │  │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌──────────────────┐   │  │
│  │  │ AppShell │  │  LeftPanel   │  │   RightPanel     │   │  │
│  │  │          │  │ (OutlineView)│  │ (ReactFlowGraph) │   │  │
│  │  │ TopBar   │  │              │  │                  │   │  │
│  │  │ StatusBar│  └──────┬───────┘  └────────┬─────────┘   │  │
│  │  └──────────┘         │                   │              │  │
│  │                       ▼                   ▼              │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │            CenterPanel                             │  │  │
│  │  │  ┌──────────────────────────┐  ┌────────────────┐  │  │  │
│  │  │  │   MonacoEditor          │  │ CompletionGhost│  │  │  │
│  │  │  │   (code-editor)         │  │ Text (overlay) │  │  │  │
│  │  │  └──────────────────────────┘  └────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                           │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │     状态管理 (Zustand Stores)                       │  │  │
│  │  │  useStoryStore  useEditorStore  useGraphStore      │  │  │
│  │  │  useValidatorStore  useCompletionStore  useThemeStore│  │  │
│  │  └───────────────────────┬────────────────────────────┘  │  │
│  └──────────────────────────┼───────────────────────────────┘  │
│                             │                                   │
│  ┌──────────────────────────┴───────────────────────────────┐  │
│  │            Core Layer (Pure TypeScript — 零 UI 依赖)      │  │
│  │                                                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │  │
│  │  │ Parser   │  │Validator │  │Exporter  │  │Completion│ │  │
│  │  │          │  │          │  │          │  │ Engine   │ │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │  │
│  │       │             │             │             │        │  │
│  │  ┌────┴─────────────┴─────────────┴─────────────┴────┐   │  │
│  │  │         PlotFlowData AST (中间表示)                │   │  │
│  │  └───────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 部署矩阵

| 模式 | 运行环境 | 入口 | 文件读写 | 变量来源 | 适用场景 |
|------|---------|------|---------|---------|---------|
| **Web 开发模式** | Vite Dev Server (localhost:5173) | `index.html` | 浏览器 File System Access API（实验性） / Mock FileService | 本地开发/调试 |
| **桌面打包模式** | Electron 28 独立窗口 | `packages/app/src-electron/main.ts` | Node.js `fs` 模块（通过 IPC） | 生产发布 |
| **插件模式 (Godot)** | Godot 编辑器 Dock 内嵌 WebView | Godot 插件触发启动 | 引擎项目目录写入 | 从 Godot 引擎同步变量 | 引擎深度整合 |
| **插件模式 (Unity)** | Unity 编辑器窗口 | Unity 插件触发 | 引擎项目目录写入 | 从 Unity 引擎同步 | V0.2 完整实现 |
| **插件模式 (Unreal)** | Unreal 编辑器面板 | 接口定义（V0.1 无运行） | — | — | V0.3 完整实现 |

### 1.3 关键不可变决策

| # | 决策 | 约束力 | 说明 |
|---|------|--------|------|
| D-IMM-01 | **文件即数据源** | 绝对 | `.mdstory` 是唯一数据源。绝不引入数据库（SQLite/IndexedDB）存储脚本内容。只能用于存储元数据（语料索引、用户偏好）。 |
| D-IMM-02 | **文本格式双向同步** | 绝对 | 图形化编辑和 Markdown 文本始终保持一致。文本是真实来源，图形是视图。所有修改最终落回文本。 |
| D-IMM-03 | **离线优先** | 绝对 | 零网络依赖。本地运行，本地补全，本地导出。V0.3 之前不考虑任何云端功能。 |
| D-IMM-04 | **补全隐私安全** | 绝对 | N-gram 统计模型，数据不离开本地进程。不上传、不收集、不联网。 |
| D-IMM-05 | **插件模式变量由引擎定义** | 条件 | 从 Godot/Unity 启动时，编辑器变量从引擎同步，不可自由创建新变量。独立模式下不受此限制。 |
| D-IMM-06 | **Electron（非 Tauri）** | V0.1 锁定 | Electron 28+，复用现有编辑器资产，Monaco Editor 官方支持。Tauri 作为 V0.3 迁移选项。 |
| D-IMM-07 | **Monarch Tokenizer（非 TextMate）** | 绝对 | Monaco 语法高亮通过 Monarch 声明式 tokenizer 实现。TextMate 语法作为可选的增强（V0.2+）。 |
| D-IMM-08 | **Design Token 强制** | 绝对 | 所有组件颜色必须引用 CSS 变量 Design Token，禁止裸 hex 色值（`#fff`、`#eee` 等）。主题切换通过 CSS 变量驱动。 |

---

## 2. 前端架构 (Renderer Process) `[V0.1]`

### 2.1 组件树

```
AppShell
├── TitleBar (自定义窗口标题栏，Windows 无边框模式)
│   ├── AppLogo
│   ├── WindowControls (最小化/最大化/关闭)
│   └── FileIndicator (当前文件名 + 修改标记 ●)
│
├── MenuBar (Electron 原生菜单，macOS 置顶，Windows/Linux 内嵌)
│   ├── FileMenu (新建/打开/保存/另存为/最近文件)
│   ├── EditMenu (撤销/重做/查找/替换/跳转节点)
│   ├── ViewMenu (大纲视图/分支图/问题面板 显隐切换)
│   ├── ExportMenu (JSON/HTML/TXT/引擎插件)
│   └── HelpMenu (语法手册/模板指南/反馈/关于)
│
├── Toolbar
│   ├── NewFileButton
│   ├── OpenFileButton
│   ├── SaveButton (含保存状态指示)
│   ├── ExportDropdown
│   ├── Separator
│   ├── InsertNodeButton (Ctrl+Shift+N)
│   ├── InsertOptionButton (Ctrl+Shift+O)
│   ├── OpenConditionEditorButton (Ctrl+Shift+C)
│   ├── Separator
│   ├── UndoButton / RedoButton
│   ├── ThemeToggleButton (Ctrl+Shift+T, 暗色/亮色)
│   └── SearchButton (Ctrl+F)
│
├── LayoutContainer (可拖拽分隔条的三栏布局)
│   ├── LeftPanel (可折叠, 默认宽度 200px, 最小 120px, 最大 400px)
│   │   └── OutlineView
│   │       ├── OutlineSearchBar (节点/章节过滤)
│   │       ├── OutlineTree (递归渲染)
│   │       │   └── OutlineNode (每个章节/节点，含状态图标)
│   │       │       ├── ChapterNode (H1, 可折叠)
│   │       │       ├── StoryNodeItem (H2, 可点击跳转)
│   │       │       └── DiagnosticBadge (错误/警告/建议计数)
│   │       └── OutlineToolbar (全部展开/折叠)
│   │
│   ├── CenterPanel (弹性宽度, 占剩余 60%, 最小 300px)
│   │   ├── MonacoEditor
│   │   │   ├── EditorContainer (Monaco 挂载点)
│   │   │   ├── MonarchTokensProvider (语法高亮提供者)
│   │   │   ├── InlineCompletionProvider (幽灵补全提供者)
│   │   │   ├── DiagnosticMarkers (setModelMarkers 注入)
│   │   │   ├── FoldingProvider (节点块折叠)
│   │   │   └── HoverProvider (诊断信息 tooltip)
│   │   ├── CompletionGhostText (Monaco overlay, 幽灵字符渲染)
│   │   └── ConditionEditorPanel (内联弹出, 绝对定位)
│   │       ├── ConditionRow (单条条件)
│   │       │   ├── VariableDropdown
│   │       │   ├── OperatorDropdown
│   │       │   └── ValueInput
│   │       ├── LogicToggle (AND / OR 切换按钮)
│   │       ├── AddConditionGroupButton
│   │       ├── ExpressionPreview
│   │       └── ActionButtons (应用 / 取消)
│   │
│   └── RightPanel (弹性宽度, 占剩余 40%, 最小 250px)
│       └── ReactFlowGraph
│           ├── ReactFlowProvider (React Flow 上下文)
│           ├── ReactFlowCanvas
│           │   ├── StoryNode (自定义节点组件)
│           │   │   ├── NodeStatusIndicator (彩色圆点)
│           │   │   ├── NodeTitle (节点标题)
│           │   │   ├── NodePreview (前30字摘要)
│           │   │   └── OptionCountBadge (选项数量徽章)
│           │   ├── ConditionEdge (条件连线: 虚线样式)
│           │   └── UnconditionalEdge (无条件连线: 实线样式)
│           ├── Minimap (右下角小地图)
│           ├── Controls (缩放/适应/锁定)
│           └── Background (网格背景)
│
├── ProblemsPanel (底部可切换面板, Ctrl+Shift+M)
│   ├── ProblemsToolbar (按严重度筛选: 错误/警告/建议)
│   └── ProblemsList
│       └── ProblemItem (图标 + 编号 + 描述 + 文件位置 + 修复建议按钮)
│
└── StatusBar
    ├── SaveStatus (✅ 已保存 / ⏳ 保存中 / ● 未保存)
    ├── NodeStats (12节点 / 28选项)
    ├── DiagnosticSummary (🔴3 🟡2 🔵1)
    ├── CursorPosition (行:列)
    ├── ZoomLevel (100%)
    └── LanguageSelector (中文 / English)
```

### 2.1.1 关键组件 Props 接口

```typescript
// AppShell — 根组件, 无 props, 通过 stores 获取全局状态
interface AppShellProps {} // 无 props, 内部消费 stores

// LayoutContainer — 三栏可拖拽布局
interface LayoutContainerProps {
  defaultLeftWidth: number;      // 默认 200
  minLeftWidth: number;          // 最小 120
  maxLeftWidth: number;          // 最大 400
  centerRatio: number;           // 中栏占比 0.6
  minCenterWidth: number;        // 最小 300
  minRightWidth: number;         // 最小 250
}

// OutlineView — 大纲视图面板
interface OutlineViewProps {
  chapters: Chapter[];                              // from useStoryStore
  activeNodeId: string | null;                      // from useEditorStore
  diagnosticCounts: Map<string, DiagnosticCounts>;  // from useValidatorStore
  onNodeClick: (fullId: string) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

// MonacoEditor — 编辑器主组件
interface MonacoEditorProps {
  initialValue: string;             // 文件内容
  language: string;                 // 'plotflow'
  theme: 'plotflow-dark' | 'plotflow-light';  // from useThemeStore
  diagnostics: Diagnostic[];        // from useValidatorStore
  completions: InlineCompletion[];  // from useCompletionStore
  onContentChange: (content: string) => void;   // → useEditorStore
  onCursorMove: (position: Position) => void;   // → useEditorStore
  onNodeFocused: (nodeId: string) => void;       // → useGraphStore
}

// ReactFlowGraph — 分支可视化图
interface ReactFlowGraphProps {
  nodes: StoryFlowNode[];           // from useGraphStore (React Flow 格式)
  edges: StoryFlowEdge[];           // from useGraphStore (React Flow 格式)
  onNodeClick: (nodeId: string) => void;        // → scroll editor
  onEdgeUpdate: (edgeId: string, newTarget: string) => void;  // → modify AST
  onLayoutReset: () => void;                     // Dagre 重排
  theme: 'dark' | 'light';          // from useThemeStore
}

// StoryNode (React Flow 自定义节点)
interface StoryNodeProps extends NodeProps {
  data: {
    id: string;
    title: string;
    preview: string;               // 前30字
    optionCount: number;
    status: NodeStatus;            // 'normal' | 'orphan' | 'deadend' | 'error' | 'selected'
    isRoot: boolean;
    onClick: (id: string) => void;
    onDoubleClick: (id: string) => void;
  };
}

// ConditionEdge (React Flow 自定义边)
interface ConditionEdgeProps extends EdgeProps {
  data: {
    isConditional: boolean;         // true = 虚线, false = 实线
    conditionText?: string;
  };
}

// ConditionEditorPanel — 内联条件编辑器
interface ConditionEditorPanelProps {
  optionIndex: number;              // 当前编辑的选项索引
  nodeId: string;                   // 所属节点
  initialConditions: Condition | null;
  variables: VariableDefinition[];  // from useStoryStore (Frontmatter)
  engineVariables?: string[];       // from plugin mode
  position: { top: number; left: number };  // 弹出位置
  onApply: (conditions: Condition | null) => void;
  onCancel: () => void;
}

// CompletionGhostText — 幽灵文本覆盖层
interface CompletionGhostTextProps {
  text: string;                     // 补全文本
  position: Position;               // 光标位置
  visible: boolean;
}
```

### 2.2 状态管理

#### 2.2.1 Zustand Store 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Zustand Store 层                      │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  useStoryStore   │    │  useEditorStore  │          │
│  │                  │    │                  │          │
│  │ plotFlowData     │◄──►│ rawMarkdown      │          │
│  │ variables        │    │ cursorPosition   │          │
│  │ chapters[]       │    │ activeNodeId     │          │
│  │ setPlotFlowData()│    │ isDirty          │          │
│  │ updateVariable() │    │ selections[]     │          │
│  └───────┬──────────┘    └────────┬─────────┘          │
│          │                        │                     │
│          │    ┌───────────────────┼──────────┐          │
│          │    │                   ▼          │          │
│          │    │  ┌──────────────────────┐   │          │
│          │    │  │   useGraphStore      │   │          │
│          │    │  │                      │   │          │
│          │    │  │  nodes: StoryFlowNode[]  │          │
│          │    │  │  edges: StoryFlowEdge[]  │          │
│          │    │  │  selectedNodeId      │   │          │
│          │    │  │  viewport: Viewport   │   │          │
│          │    │  │  syncFromAST()        │   │          │
│          │    │  └──────────────────────┘   │          │
│          │    └─────────────────────────────┘          │
│          │                        │                     │
│          ▼                        ▼                     │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │useValidatorStore │    │useCompletionStore│          │
│  │                  │    │                  │          │
│  │ diagnostics[]    │    │ currentSuggestion│          │
│  │ errorCount       │    │ candidates[]     │          │
│  │ warningCount     │    │ isComputing      │          │
│  │ infoCount        │    │ triggerContext   │          │
│  │ validate()       │    │ requestCompletion│          │
│  │ clearForNode()   │    │ accept()         │          │
│  └──────────────────┘    │ reject()         │          │
│                          │ importCorpus()   │          │
│                          └──────────────────┘          │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────┐          │
│  │  useThemeStore   │    │  useUIStore      │          │
│  │                  │    │                  │          │
│  │ theme: ThemeKind  │    │ leftPanelOpen    │          │
│  │ language: Lang    │    │ leftPanelWidth   │          │
│  │ toggleTheme()    │    │ problemsPanelOpen│          │
│  │ setLanguage()    │    │ recentFiles[]    │          │
│  └──────────────────┘    └──────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

#### 2.2.2 Store 接口定义

```typescript
// ============================================================
// useStoryStore — 故事数据（AST 的真实来源）
// ============================================================
interface StoryState {
  plotFlowData: PlotFlowData | null;
  rawFrontmatter: string;           // 原始 YAML 文本（用于保留注释/格式）
  variables: Map<string, VariableDefinition>;

  // Actions
  setPlotFlowData: (data: PlotFlowData) => void;
  updateVariable: (name: string, def: Partial<VariableDefinition>) => void;
  getNodeById: (fullId: string) => StoryNode | undefined;
  getChapterById: (id: string) => Chapter | undefined;
  getAllNodeIds: () => string[];
  clear: () => void;
}

// ============================================================
// useEditorStore — 编辑器状态
// ============================================================
interface EditorState {
  rawMarkdown: string;              // Monaco 中的原始文本
  cursorPosition: { line: number; column: number };
  activeNodeId: string | null;      // 光标所在节点的 fullId
  isDirty: boolean;                 // 自上次保存后是否有修改
  selections: Selection[];          // Monaco 选区
  monacoModel: MonacoEditorModel | null;
  monacoEditor: MonacoEditorInstance | null;

  // Actions
  setRawMarkdown: (text: string) => void;
  setCursorPosition: (pos: { line: number; column: number }) => void;
  setActiveNodeId: (id: string | null) => void;
  markClean: () => void;
  markDirty: () => void;
  insertTextAtCursor: (text: string) => void;
  scrollToLine: (line: number) => void;
  setMonacoModel: (model: MonacoEditorModel) => void;
  setMonacoEditor: (editor: MonacoEditorInstance) => void;
}

// ============================================================
// useGraphStore — 分支图状态
// ============================================================
interface GraphState {
  nodes: StoryFlowNode[];           // React Flow 节点
  edges: StoryFlowEdge[];           // React Flow 连线
  selectedNodeId: string | null;
  viewport: { x: number; y: number; zoom: number };
  layoutVersion: number;            // 布局版本号（每次重新布局递增）

  // Actions
  syncFromAST: (data: PlotFlowData) => void;
  setSelectedNode: (id: string | null) => void;
  updateEdgeTarget: (edgeId: string, newTargetNodeId: string) => void;
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  resetLayout: () => void;
  getNodePosition: (id: string) => { x: number; y: number } | undefined;
}

// ============================================================
// useValidatorStore — 诊断状态
// ============================================================
interface ValidatorState {
  diagnostics: Diagnostic[];        // 完整诊断列表
  diagnosticsByNode: Map<string, Diagnostic[]>;  // 按节点分组
  diagnosticsByLine: Map<number, Diagnostic[]>;  // 按行号分组
  errorCount: number;
  warningCount: number;
  infoCount: number;

  // Actions
  validate: (data: PlotFlowData, rawText: string) => void;
  clearForNode: (nodeId: string) => void;
  clearAll: () => void;
  getDiagnosticsForLine: (line: number) => Diagnostic[];
  getDiagnosticsForNode: (nodeId: string) => Diagnostic[];
}

// ============================================================
// useCompletionStore — 补全状态
// ============================================================
interface CompletionState {
  currentSuggestion: CompletionSuggestion | null;
  candidates: CompletionSuggestion[];  // Ctrl+Space 下拉候选
  isComputing: boolean;
  triggerContext: CompletionContext | null;
  engineStatus: 'idle' | 'training' | 'ready' | 'error';

  // Actions
  requestCompletion: (context: CompletionContext) => Promise<void>;
  accept: () => void;               // Tab — 接受当前幽灵建议
  reject: () => void;               // Esc — 忽略
  cycleNext: () => void;            // 切换候选
  openCandidates: () => void;       // Ctrl+Space
  importCorpus: (files: File[]) => Promise<void>;
  getCorpusList: () => CorpusEntry[];
  removeCorpus: (id: string) => void;
  setEngineStatus: (status: CompletionState['engineStatus']) => void;
}

// ============================================================
// useThemeStore — 主题和语言
// ============================================================
interface ThemeState {
  theme: 'dark' | 'light';
  language: 'zh-CN' | 'en';

  // Actions
  toggleTheme: () => void;
  setTheme: (t: 'dark' | 'light') => void;
  setLanguage: (l: 'zh-CN' | 'en') => void;
}

// ============================================================
// useUIStore — UI 布局和杂项
// ============================================================
interface UIState {
  leftPanelOpen: boolean;
  leftPanelWidth: number;
  problemsPanelOpen: boolean;
  problemsPanelHeight: number;
  recentFiles: RecentFileEntry[];
  activeFilePath: string | null;

  // Actions
  toggleLeftPanel: () => void;
  setLeftPanelWidth: (w: number) => void;
  toggleProblemsPanel: () => void;
  setProblemsPanelHeight: (h: number) => void;
  addRecentFile: (entry: RecentFileEntry) => void;
  setActiveFilePath: (path: string | null) => void;
}
```

#### 2.2.3 单向数据流

```
                           文本是唯一真实来源
                           ====================
用户输入 (Monaco Editor)
       │
       ▼ (500ms debounce)
rawMarkdown (useEditorStore)
       │
       ▼ (Parser 解析)
PlotFlowData AST (useStoryStore)
       │
       ├──→ useValidatorStore.validate()  → diagnostics[]  → Monaco setModelMarkers()
       │                                                     → ProblemsPanel 列表
       │                                                     → OutlineView 状态标记
       │
       ├──→ useGraphStore.syncFromAST()   → nodes[]/edges[] → ReactFlowGraph 渲染
       │                                                     → 节点状态着色
       │
       ├──→ OutlineView (直接从 useStoryStore 读取章节/节点)
       │
       ├──→ useCompletionStore.requestCompletion()
       │     → 异步 Worker 计算
       │     → currentSuggestion → CompletionGhostText
       │
       └──→ Exporter (按需, 从 PlotFlowData 导出)

反向流（图形编辑 → 文本同步）:
ReactFlowGraph.onEdgeUpdate()
       │
       ▼
useGraphStore.updateEdgeTarget()
       │
       ▼
PlotFlowData AST 修改 (useStoryStore)
       │
       ▼
生成新的 Markdown 文本 (AST → Markdown serialization)
       │
       ▼
Monaco Editor 文本替换 (保留光标位置和撤销栈)
```

### 2.3 Monaco Editor 集成

#### 2.3.1 Monarch Tokenizer — PlotFlow 语法高亮

```typescript
// monarch-tokens.ts
// 通过 monaco.languages.setMonarchTokensProvider('plotflow', tokenizer) 注册

const plotFlowTokenizer: monaco.languages.IMonarchLanguage = {
  tokenizer: {
    root: [
      // YAML Frontmatter
      [/^---\s*$/, 'frontmatter-delimiter'],
      [/^---\s*$/, { token: 'frontmatter-delimiter', next: '@frontmatter' }],
      [/^[a-zA-Z_一-鿿][a-zA-Z0-9_一-鿿]*\s*:/, 'frontmatter-key'],

      // 章节标题 H1: # 第一章：xxx
      [/^#\s+(?!节点：)[^\n]+/, 'chapter-heading'],

      // 节点标题 H2: ## 节点：xxx
      [/^##\s+节点：/, 'node-heading-keyword'],
      [/(?<=^##\s+节点：)[^\n]+/, 'node-heading-title'],

      // H3-H6 子标题（选项区标记等）
      [/^(#{3,6})\s+(?!节点：)[^\n]+/, 'section-heading'],

      // 选项行 [选项] 文本 -> 节点：目标
      [/^\[选项\]/, 'option-keyword'],
      [/(?<=^\[选项\]\s+)[^\n]+?(?=\s*->)/, 'option-description'],
      [/->/, 'option-arrow'],
      [/节点：/, 'option-target-keyword'],
      [/(?<=节点：)[^\n]+/, 'option-target-name'],

      // 条件子行: 条件: (expr)
      [/^\s+条件:/, 'condition-keyword'],
      [/(?<=条件:\s*).+/, 'condition-expression'],

      // 效果子行: 效果: (ops)
      [/^\s+效果:/, 'effect-keyword'],
      [/(?<=效果:\s*).+/, 'effect-expression'],

      // 变量引用: $变量名
      [/\$[a-zA-Z_一-鿿][a-zA-Z0-9_.一-鿿]*/, 'variable-reference'],

      // 分隔线
      [/^---\s*$/, 'separator'],

      // 加粗/斜体
      [/\*\*[^*]+\*\*/, 'bold'],
      [/\*[^*]+\*/, 'italic'],
    ],

    frontmatter: [
      [/^[a-zA-Z_一-鿿][a-zA-Z0-9_一-鿿]*\s*:/, 'frontmatter-key'],
      [/^---\s*$/, { token: 'frontmatter-delimiter', next: '@pop' }],
      [/./, 'frontmatter-value'],
    ],
  },

  // Token 到 CSS 类的映射
  // 暗色主题色值由 CSS 变量控制, 此处仅定义语义 token
};
```

#### 2.3.2 主题定义（Monaco `defineTheme`）

```typescript
// monaco-themes.ts

// 暗色主题: plotflow-dark
monaco.editor.defineTheme('plotflow-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'frontmatter-delimiter', foreground: '808080', fontStyle: 'bold' },
    { token: 'frontmatter-key', foreground: '9CDCFE' },
    { token: 'frontmatter-value', foreground: 'CE9178' },
    { token: 'chapter-heading', foreground: 'D7BA7D', fontStyle: 'bold' },
    { token: 'node-heading-keyword', foreground: '569CD6', fontStyle: 'bold' },
    { token: 'node-heading-title', foreground: '4FC1FF' },
    { token: 'option-keyword', foreground: '6A9955' },
    { token: 'option-description', foreground: 'D4D4D4' },
    { token: 'option-arrow', foreground: '4EC9B0' },
    { token: 'option-target-keyword', foreground: '4EC9B0' },
    { token: 'option-target-name', foreground: '9CDCFE' },
    { token: 'condition-keyword', foreground: 'CE9178' },
    { token: 'condition-expression', foreground: 'CE9178' },
    { token: 'effect-keyword', foreground: 'DCDCAA' },
    { token: 'effect-expression', foreground: 'DCDCAA' },
    { token: 'variable-reference', foreground: 'C586C0' },
    { token: 'separator', foreground: '808080' },
  ],
  colors: {
    'editor.background': '#1E1E1E',
    'editor.foreground': '#D4D4D4',
    'editor.lineHighlightBackground': '#2A2D2E',
    'editor.selectionBackground': '#264F78',
    'editorCursor.foreground': '#AEAFAD',
  },
});

// 亮色主题: plotflow-light (略, 同理对调色值)
monaco.editor.defineTheme('plotflow-light', {
  base: 'vs',
  inherit: true,
  rules: [
    // ... 亮色色值
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#333333',
    // ...
  },
});
```

#### 2.3.3 InlineCompletionItemProvider — 幽灵补全

```typescript
// inline-completion-provider.ts
// 通过 monaco.languages.registerInlineCompletionsProvider('plotflow', provider) 注册

const inlineCompletionProvider: monaco.languages.InlineCompletionsProvider = {
  provideInlineCompletions: async (
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.InlineCompletions> => {
    // 1. 从 useCompletionStore 获取当前建议
    const { currentSuggestion, triggerContext } = useCompletionStore.getState();

    if (!currentSuggestion || !triggerContext) {
      return { items: [] };
    }

    // 2. 验证触发条件是否仍然有效
    if (!isTriggerStillValid(model, position, triggerContext)) {
      return { items: [] };
    }

    // 3. 构建 InlineCompletionItem
    const item: monaco.languages.InlineCompletion = {
      insertText: currentSuggestion.text,
      range: {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      },
      // 可选: 提供命令在按下时执行（如记录接受事件用于学习）
      command: {
        id: 'plotflow.completion.accepted',
        title: 'Completion Accepted',
        arguments: [currentSuggestion.id, triggerContext],
      },
    };

    return { items: [item] };
  },

  // 用于释放资源
  freeInlineCompletions: (_completions: monaco.languages.InlineCompletions) => {},
};
```

#### 2.3.4 Diagnostic Markers (setModelMarkers)

```typescript
// diagnostic-markers.ts

function syncDiagnosticsToMonaco(
  model: monaco.editor.ITextModel,
  diagnostics: Diagnostic[],
  rawText: string
): void {
  const markers: monaco.editor.IMarkerData[] = diagnostics.map((d) => {
    const severity = diagnosticSeverityToMonaco(d.level);
    // 通过行号/列号计算 startColumn/endColumn
    const { startLineNumber, startColumn, endLineNumber, endColumn } =
      calculateRange(rawText, d.location);

    return {
      severity,
      message: formatDiagnosticMessage(d),
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
      source: 'PlotFlow',
      code: d.code, // e.g. 'E001', 'W002', 'I001'
    };
  });

  monaco.editor.setModelMarkers(model, 'plotflow-diagnostics', markers);
}

function diagnosticSeverityToMonaco(level: DiagnosticLevel): monaco.MarkerSeverity {
  switch (level) {
    case 'error':   return monaco.MarkerSeverity.Error;   // 红色波浪线
    case 'warning': return monaco.MarkerSeverity.Warning; // 黄色波浪线
    case 'info':    return monaco.MarkerSeverity.Info;    // 蓝色下划线
  }
}
```

#### 2.3.5 防抖策略

```typescript
// editor-debounce.ts

// Monaco Change Event → 500ms debounce → 触发全管线
const DEBOUNCE_MS = 500;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function onEditorContentChanged(newContent: string): void {
  if (debounceTimer) clearTimeout(debounceTimer);

  // 立即更新编辑器 store（响应式 UI 即时反馈）
  useEditorStore.getState().setRawMarkdown(newContent);
  useEditorStore.getState().markDirty();

  debounceTimer = setTimeout(() => {
    // 1. 解析
    const parseResult = parsePlotFlow(newContent);
    useStoryStore.getState().setPlotFlowData(parseResult.data);

    // 2. 验证
    useValidatorStore.getState().validate(parseResult.data, newContent);

    // 3. 同步分支图
    useGraphStore.getState().syncFromAST(parseResult.data);

    // 4. 触发补全
    const ctx = buildCompletionContext(parseResult.data, newContent);
    useCompletionStore.getState().requestCompletion(ctx);

    // 5. 同步 Monaco Markers
    const model = useEditorStore.getState().monacoModel;
    if (model) {
      syncDiagnosticsToMonaco(model, useValidatorStore.getState().diagnostics, newContent);
    }
  }, DEBOUNCE_MS);
}

// 补全触发有独立的更短防抖 (200ms, 仅当输入停顿)
const COMPLETION_DEBOUNCE_MS = 200;
```

### 2.4 React Flow 集成

#### 2.4.1 自定义节点组件 (StoryNode)

```typescript
// StoryNode.tsx
const StoryNode: React.FC<NodeProps<StoryNodeData>> = ({ data, selected }) => {
  const statusClass = STATUS_CLASS_MAP[data.status];
  // STATUS_CLASS_MAP:
  //   'normal'    → 'node-status-normal'    (绿色边框)
  //   'orphan'    → 'node-status-orphan'    (黄色边框)
  //   'deadend'   → 'node-status-deadend'   (灰色边框)
  //   'error'     → 'node-status-error'     (红色边框)
  //   'selected'  → 'node-status-selected'  (蓝色光晕)

  return (
    <div
      className={cn('story-node', statusClass, { selected })}
      onClick={() => data.onClick(data.id)}
      onDoubleClick={() => data.onDoubleClick(data.id)}
    >
      <div className="story-node-header">
        <span className="node-status-dot" />
        <span className="node-title">{data.title}</span>
        <span className="node-badge">{data.optionCount}</span>
      </div>
      <div className="story-node-preview">{data.preview}</div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};
```

#### 2.4.2 自定义边组件

```typescript
// ConditionEdge.tsx — 条件连线 (虚线橙色)
const ConditionEdge: React.FC<EdgeProps> = (props) => {
  const edgePath = getBezierPath(props);
  return (
    <>
      <BaseEdge path={edgePath} style={{ stroke: 'var(--color-edge-conditional)', strokeDasharray: '5,5' }} />
      <EdgeLabelRenderer>
        <div className="edge-condition-label">{props.data?.conditionText}</div>
      </EdgeLabelRenderer>
    </>
  );
};

// UnconditionalEdge.tsx — 无条件连线 (实线青色)
const UnconditionalEdge: React.FC<EdgeProps> = (props) => {
  const edgePath = getBezierPath(props);
  return <BaseEdge path={edgePath} style={{ stroke: 'var(--color-edge-unconditional)' }} />;
};
```

#### 2.4.3 Dagre 布局配置

```typescript
// dagre-layout.ts
import dagre from '@dagrejs/dagre';

function layoutNodes(chapters: Chapter[]): { nodes: StoryFlowNode[]; edges: StoryFlowEdge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',          // Top-to-Bottom
    align: 'UL',
    nodesep: 150,           // 同层节点水平间距 (px)
    ranksep: 120,           // 父子层垂直间距 (px)
    edgesep: 30,
    marginx: 50,
    marginy: 50,
  });

  // 节点尺寸
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 80;

  const allNodes = chapters.flatMap(ch => ch.nodes);

  // 添加节点
  for (const node of allNodes) {
    g.setNode(node.fullId, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // 添加边（从选项的 targetFullId）
  for (const node of allNodes) {
    for (const option of node.options) {
      g.setEdge(node.fullId, option.targetFullId);
    }
  }

  dagre.layout(g);

  // 转换为 React Flow 格式
  const nodes: StoryFlowNode[] = allNodes.map((node) => {
    const pos = g.node(node.fullId);
    return {
      id: node.fullId,
      type: 'storyNode',
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
      data: { /* ... 节点数据 */ },
    };
  });

  const edges: StoryFlowEdge[] = allNodes.flatMap((node) =>
    node.options.map((opt, idx) => ({
      id: `${node.fullId}->${opt.targetFullId}#${idx}`,
      source: node.fullId,
      target: opt.targetFullId,
      type: opt.conditions ? 'conditionEdge' : 'unconditionalEdge',
      data: {
        isConditional: !!opt.conditions,
        conditionText: opt.conditions?.expression,
      },
    }))
  );

  // 孤立节点处理：放在画布右侧独立区域
  const connectedIds = new Set(edges.flatMap(e => [e.source, e.target]));
  let orphanX = Math.max(...nodes.map(n => n.position.x + NODE_WIDTH)) + 200;
  for (const node of nodes) {
    if (!connectedIds.has(node.id) && node.data.optionCount > 0) {
      // 根节点可在任意位置
    } else if (!connectedIds.has(node.id)) {
      node.position = { x: orphanX, y: node.position.y };
      orphanX += NODE_WIDTH + 150;
    }
  }

  return { nodes, edges };
}
```

#### 2.4.4 事件处理：图形编辑 → 文本同步

```typescript
// 拖拽连线端点修改跳转目标
function onEdgeUpdate(edgeId: string, newTargetNodeId: string): void {
  // 1. 解析 edgeId 获取来源节点和选项索引
  const { sourceNodeId, optionIndex } = parseEdgeId(edgeId);

  // 2. 修改 AST 中选项的 targetNodeId
  const data = useStoryStore.getState().plotFlowData;
  const node = data?.chapters.flatMap(ch => ch.nodes).find(n => n.fullId === sourceNodeId);
  if (!node) return;
  const oldTarget = node.options[optionIndex].targetNodeId;

  // 3. 更新 AST
  node.options[optionIndex].targetNodeId = newTargetNodeId;

  // 4. 重新生成 Markdown 文本
  const newMarkdown = serializePlotFlowData(data!);

  // 5. 替换 Monaco 编辑器内容（保留光标和撤销栈）
  const editor = useEditorStore.getState().monacoEditor;
  if (editor) {
    const model = editor.getModel()!;
    editor.executeEdits('graph-edge-update', [{
      range: model.getFullModelRange(),
      text: newMarkdown,
    }]);
  }

  // 6. 刷新 branch graph（AST 已变，需要重新 sync）
  useGraphStore.getState().syncFromAST(data!);

  // 7. 触发重新验证
  useValidatorStore.getState().validate(data!, newMarkdown);
}
```

### 2.5 条件编辑器

#### 2.5.1 组件结构

```
ConditionEditorPanel
├── ConditionGroupList (可嵌套, 最多3层)
│   └── ConditionGroup
│       ├── GroupHeader (AND / OR 切换)
│       ├── ConditionRow[] (多条条件)
│       │   ├── VariableDropdown (数据源: Frontmatter 变量 或 引擎变量)
│       │   ├── OperatorDropdown (==, !=, >, <, >=, <=)
│       │   └── ValueInput (类型感知: int/float 数字框, bool 复选框, enum 下拉, string 文本框)
│       ├── AddConditionButton (在当前组添加条件)
│       └── RemoveGroupButton (移除当前条件组)
├── AddGroupButton (添加 AND 组)
├── AddOrGroupButton (添加 OR 组)
├── ExpressionPreview (实时预览生成的文本表达式)
└── ActionButtons
    ├── ApplyButton
    └── CancelButton
```

#### 2.5.2 双向同步机制

```
面板修改 → 生成条件表达式字符串 → 更新 AST
                                    │
                                    ▼
                              serializeOptionText()
                                    │
                                    ▼
                              替换 Monaco 中对应选项的条件子行文本

文本手动编辑 → 编辑器 change event → Parser 解析
                                        │
                                        ▼
                                  更新 AST
                                        │
                                        ▼
                                  面板重新读取 AST 中的 conditions 字段
                                        │
                                        ▼
                                  面板刷新显示
```

#### 2.5.3 变量下拉数据源

```typescript
// 独立模式: 从 Frontmatter YAML 解析的变量列表
// 插件模式: 从引擎同步的变量列表 (只读, 不可创建新变量)

function getAvailableVariables(): VariableOption[] {
  const mode = detectRunMode(); // 'standalone' | 'plugin'

  if (mode === 'standalone') {
    const vars = useStoryStore.getState().variables;
    return Array.from(vars.entries()).map(([name, def]) => ({
      name,
      type: def.type,
      enumValues: def.type === 'enum' ? def.values : undefined,
      scope: def.scope,
    }));
  } else {
    // 插件模式: 从引擎获取
    return window.plotflow.getEngineVariables();
  }
}
```

---

---

## 3. 核心层 (Core / Pure TypeScript) `[V0.1 全部, §3.3.6 插件接口 V0.1-V0.3]`

核心层是零 UI 依赖的纯 TypeScript 代码，可独立测试、独立发布为 npm 包。

### 3.1 解析器 (Parser)

#### 3.1.1 Pipeline 架构

```
.mdstory 文本
      │
      ▼
┌─────────────────────────────────────────┐
│         unified() 处理管道               │
│                                         │
│  .use(remarkParse)         ← 基础 Markdown → mdast     │
│  .use(frontmatterPlugin)   ← 提取 YAML Frontmatter     │
│  .use(nodeParserPlugin)    ← 识别 ## 节点：             │
│  .use(optionParserPlugin)  ← 识别 [选项] + 条件/效果    │
│  .use(variableRefPlugin)   ← 识别 $变量 引用            │
│  .use(diagnosticTagPlugin) ← 标记语法错误位置            │
│                                         │
└────────────────────┬────────────────────┘
                     │
                     ▼
              PlotFlowData AST
```

#### 3.1.2 Plugin 1: frontmatter-parser

```typescript
// frontmatter-plugin.ts
// 职责: 提取 YAML Frontmatter, 解析变量定义, 返回 VariableDefinition[]

function frontmatterPlugin(): Transformer {
  return (tree: Root, file: VFile) => {
    // 1. 查找第一个 YAML delim node (---)
    const firstChild = tree.children[0];
    if (firstChild?.type !== 'yaml') {
      file.message('Missing Frontmatter', { line: 1, column: 1 }, 'plotflow:no-frontmatter');
      return;
    }

    // 2. 使用 js-yaml 解析
    const yamlContent = firstChild.value;
    let frontmatter: FrontmatterData;
    try {
      frontmatter = yaml.load(yamlContent) as FrontmatterData;
    } catch (e) {
      file.message(`YAML parse error: ${(e as Error).message}`, firstChild.position!, 'plotflow:yaml-error');
      return;
    }

    // 3. 提取变量定义
    const variables: VariableDefinition[] = [];
    if (frontmatter.vars) {
      for (const [name, def] of Object.entries(frontmatter.vars)) {
        variables.push(parseVariableDefinition(name, def, file));
      }
    }

    // 4. 存入 VFile data
    (file.data as any).frontmatter = {
      plotflow: frontmatter.plotflow ?? '0.1',
      title: frontmatter.title ?? 'Untitled',
      author: frontmatter.author,
      engine: frontmatter.engine ?? 'none',
      variables,
      raw: frontmatter,
    };

    // 5. 从 AST 中移除 frontmatter, 后续处理不再遇到它
    tree.children.shift();
  };
}

function parseVariableDefinition(
  name: string,
  def: any,
  file: VFile
): VariableDefinition {
  // 解析类型: int, float, bool, string, enum[...], object{...}
  if (typeof def === 'string') {
    return { name, type: def as any, default: getDefaultValue(def), scope: 'global' };
  }
  if (typeof def === 'object' && def !== null) {
    // enum
    if (Array.isArray(def)) {
      return { name, type: 'enum', values: def, default: def[0] ?? '', scope: 'global' };
    }
    // object
    if (!Array.isArray(def)) {
      const fields: Record<string, VariableDefinition> = {};
      for (const [fieldName, fieldDef] of Object.entries(def)) {
        fields[fieldName] = parseVariableDefinition(fieldName, fieldDef, file);
      }
      return { name, type: 'object', fields, scope: 'global' };
    }
  }
  file.message(`Invalid variable definition for "${name}"`, {}, 'plotflow:invalid-var-def');
  return { name, type: 'string', default: '', scope: 'global' };
}
```

#### 3.1.3 Plugin 2: node-parser

```typescript
// node-parser-plugin.ts
// 职责: 识别 ## 节点：xxx 标题, 提取节点定义

function nodeParserPlugin(): Transformer {
  return (tree: Root, file: VFile) => {
    const chapters: Chapter[] = [];
    let currentChapter: Chapter | null = null;
    let currentNodes: StoryNode[] = [];
    let currentNodeBuilder: NodeBuilder | null = null;
    let hasAnyH1 = false;

    for (const child of tree.children) {
      // H1: 章节标题
      if (child.type === 'heading' && child.depth === 1) {
        hasAnyH1 = true;
        // 保存前一个章节
        if (currentChapter) {
          currentChapter.nodes = currentNodes;
          chapters.push(currentChapter);
        }
        const title = getHeadingText(child);
        currentChapter = { id: title, title, nodes: [] };
        currentNodes = [];
        currentNodeBuilder = null;
        continue;
      }

      // H2: ## 节点：节点名
      if (child.type === 'heading' && child.depth === 2 && child.children[0]?.value?.startsWith('节点：')) {
        // 保存前一个节点
        if (currentNodeBuilder) {
          const node = currentNodeBuilder.build();
          if (node) currentNodes.push(node);
        }
        const nodeTitle = child.children[0].value.replace(/^节点：/, '').trim();
        // 无 H1 时 chapterId 为空，fullId 不包含章节前缀（节点扁平化）
        currentNodeBuilder = new NodeBuilder(nodeTitle, currentChapter?.id ?? '');
        continue;
      }

      // H3+: 子标题（如 ### 选项区）— 解析器忽略
      if (child.type === 'heading' && child.depth >= 3) {
        continue; // 忽略子标题, 继续累积到当前节点
      }

      // 段落: 累积到当前节点 body
      if (child.type === 'paragraph' && currentNodeBuilder) {
        const text = getPlainText(child);
        currentNodeBuilder.addBodyLine(text);
        continue;
      }

      // 分隔线: --- （结束当前节点块, 但不创建新节点）
      if (child.type === 'thematicBreak' && currentNodeBuilder) {
        const node = currentNodeBuilder.build();
        if (node) currentNodes.push(node);
        currentNodeBuilder = null;
        continue;
      }
    }

    // 保存最后一个节点和章节
    if (currentNodeBuilder) {
      const node = currentNodeBuilder.build();
      if (node) currentNodes.push(node);
    }
    // 含章节: 保存最后一个章节
    if (currentChapter) {
      currentChapter.nodes = currentNodes;
      chapters.push(currentChapter);
    }
    // 无 H1 场景: 节点扁平化 — 所有节点归入匿名默认章节, fullId 不含章节前缀
    if (!hasAnyH1 && currentNodes.length > 0) {
      chapters.push({ id: '', title: '', nodes: currentNodes });
    }

    (file.data as any).chapters = chapters;
  };
}
```

#### 3.1.4 Plugin 3: option-parser

```typescript
// option-parser-plugin.ts
// 职责: 识别 [选项] 行 + 条件子行 + 效果子行

class NodeBuilder {
  private options: Option[] = [];
  private currentOptionBuilder: OptionBuilder | null = null;

  addBodyLine(text: string): void {
    // 检测是否为 [选项] 行
    const optionMatch = text.match(/^\[选项\]\s+(.+?)\s*->\s*节点：(.+)$/);
    if (optionMatch) {
      // 保存前一个 option builder
      if (this.currentOptionBuilder) {
        this.options.push(this.currentOptionBuilder.build());
      }
      const [, description, target] = optionMatch;
      this.currentOptionBuilder = new OptionBuilder(description.trim(), target.trim());
      return;
    }
    // 检测不完整的 [选项] 行（缺少 -> 节点：目标标识）
    // 保留为正文不丢弃；validator 生成警告诊断
    const incompleteOption = text.match(/^\[选项\]\s+(.+)$/);
    if (incompleteOption) {
      this.bodyLines.push(text);
      return;
    }

    // 检测条件子行: 条件: (...)
    const conditionMatch = text.match(/^\s+条件:\s*(.+)$/);
    if (conditionMatch && this.currentOptionBuilder) {
      const condExpr = conditionMatch[1].trim();
      const parsedCondition = parseConditionExpression(condExpr);
      this.currentOptionBuilder.setConditions(parsedCondition);
      return;
    }

    // 检测效果子行: 效果: (...)
    const effectMatch = text.match(/^\s+效果:\s*\(\s*(.+?)\s*\)\s*$/);
    if (effectMatch && this.currentOptionBuilder) {
      const effectsStr = effectMatch[1];
      const effects = parseSideEffects(effectsStr);
      this.currentOptionBuilder.setSideEffects(effects);
      return;
    }

    // 其他行: 追加到 body 或当前 option builder 的元数据
    if (this.currentOptionBuilder) {
      // 可能是不标准的子行, 归入前一个 option
      this.currentOptionBuilder.addExtraLine(text);
    } else {
      this.bodyLines.push(text);
    }
  }

  build(): StoryNode | null {
    if (this.currentOptionBuilder) {
      this.options.push(this.currentOptionBuilder.build());
    }
    return {
      id: this.title,
      chapterId: this.chapterId,
      fullId: this.chapterId ? `${this.chapterId}/${this.title}` : this.title,
      title: this.title,
      body: this.bodyLines.filter(Boolean),
      options: this.options,
      position: { x: 0, y: 0 },
      isRoot: false,
      isOrphan: false,
      isDeadEnd: false,
    };
  }
}
```

#### 3.1.5 条件表达式解析器

```typescript
// condition-parser.ts
// 解析条件表达式: ($a>=5) AND ($b==true) OR NOT ($c!='foo')

type ConditionAST =
  | ComparisonNode
  | LogicalAndNode
  | LogicalOrNode
  | LogicalNotNode;

interface ComparisonNode {
  type: 'comparison';
  variable: string;       // e.g. '好感度' 或 '角色状态.魔力'
  operator: '==' | '!=' | '>' | '<' | '>=' | '<=';
  value: string | number | boolean;
}

interface LogicalAndNode {
  type: 'logical_and';
  left: ConditionAST;
  right: ConditionAST;
}

interface LogicalOrNode {
  type: 'logical_or';
  left: ConditionAST;
  right: ConditionAST;
}

interface LogicalNotNode {
  type: 'logical_not';
  operand: ConditionAST;
}

function parseConditionExpression(expr: string): Condition | null {
  if (!expr || expr.trim() === '') return null;

  try {
    const tokens = tokenizeCondition(expr);
    const ast = parseConditionTokens(tokens);
    return {
      expression: expr,
      ast,
    };
  } catch (e) {
    // 解析失败 — 保留原始表达式字符串，AST 为 null
    return {
      expression: expr,
      ast: null,
      parseError: (e as Error).message,
    };
  }
}

// 分词器: 识别 $变量、运算符、括号、字面量
function tokenizeCondition(expr: string): Token[] {
  const tokens: Token[] = [];
  const regex = /(\$[a-zA-Z_一-鿿][a-zA-Z0-9_.一-鿿]*)|(==|!=|>=|<=|>|<)|(AND|OR|NOT|and|or|not)|([()])|('([^']*)')|("([^"]*)")|(\d+\.?\d*)|(true|false)/gi;
  let match;
  while ((match = regex.exec(expr)) !== null) {
    tokens.push(classifyToken(match));
  }
  // 规范化关键字大小写: and→AND, or→OR, not→NOT
  return tokens.map(t => {
    if (t.type === 'keyword') {
      t.value = (t.value as string).toUpperCase();
    }
    return t;
  });
  return tokens;
}
```

#### 3.1.6 错误恢复策略

```typescript
// error-recovery.ts
// 最佳努力解析: 尽可能多地提取有效数据, 标记无法解析的部分

interface ParseResult {
  data: PlotFlowData;
  errors: ParseError[];       // 阻断解析的错误
  warnings: ParseWarning[];   // 可恢复的问题
}

function parsePlotFlow(rawText: string): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];

  // 1. 尝试 Frontmatter 解析
  //    失败 → 记录错误, 使用默认 frontmatter, 继续解析正文

  // 2. 尝试节点解析
  //    某行无法识别 → 记录 ParseError, 跳过该行, 继续下一行

  // 3. 尝试选项解析
  //    选项缺少 -> → 记录 E005, 仍将文本归入 body, 继续

  // 4. 尝试条件/效果解析
  //    表达式格式错误 → 保留原始字符串, ast = null, 继续

  return { data: buildData(frontmatter, chapters), errors, warnings };
}
```

### 3.2 语法检查器 (Validator)

#### 3.2.1 三级诊断体系

```typescript
// types.ts (diagnostic)
type DiagnosticLevel = 'error' | 'warning' | 'info';

interface Diagnostic {
  code: string;                    // e.g. 'E001', 'W002', 'I001'
  level: DiagnosticLevel;
  message: string;                 // 人类可读描述
  location: DiagnosticLocation;    // 行号范围
  nodeId?: string;                 // 关联的节点 fullId (可选)
  suggestion?: string;             // 修复建议 (可选)
  quickFix?: QuickFix;             // 一键修复动作 (可选)
}

interface DiagnosticLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

interface QuickFix {
  label: string;
  action: 'create-node' | 'add-variable' | 'add-default-option' | 'jump-to';
  payload: Record<string, unknown>;
}
```

#### 3.2.2 错误检测器 (8 种)

| 编号 | 检测器 | 检测逻辑 | 标记位置 |
|------|--------|---------|---------|
| E001 | TargetNotFoundDetector | 遍历所有选项的 targetFullId，检查是否存在于所有节点的 fullId 集合中 | `-> 节点：XXX` 行 |
| E002 | UndeclaredVariableDetector | 遍历所有条件/效果中引用的 `$变量`，检查是否在 Frontmatter variables Map 中 | `$变量` 位置 |
| E003 | IllegalEnumDetector | 检查效果中的赋值操作，验证值是否在声明的 enum values 中 | 效果括号内 |
| E004 | TypeMismatchDetector | 检查效果操作的值类型与变量声明类型是否一致（如 bool 不能 +1） | 效果括号内 |
| E005 | ParseFailureDetector | 收集 Parser 返回的 ParseError 列表，转换为 Diagnostic | 解析失败行 |
| E006 | NestingExceededDetector | 遍历 Frontmatter variables，检查 object 嵌套深度是否超过 3 | Frontmatter |
| E007 | DuplicateNodeDetector | 检查所有节点的 fullId 是否有重复 | `## 节点：` 行 |
| E008 | DuplicateVariableDetector | 检查 Frontmatter 变量名是否有重复 | Frontmatter |

```typescript
// validators/error-detectors.ts

function detectTargetNotFound(data: PlotFlowData): Diagnostic[] {
  const allNodeIds = new Set(
    data.chapters.flatMap(ch => ch.nodes.map(n => n.fullId))
  );
  const diagnostics: Diagnostic[] = [];

  for (const chapter of data.chapters) {
    for (const node of chapter.nodes) {
      for (const option of node.options) {
        if (!allNodeIds.has(option.targetFullId)) {
          diagnostics.push({
            code: 'E001',
            level: 'error',
            message: `目标节点「${option.targetFullId}」不存在`,
            location: option.location,  // 选项行的位置
            nodeId: node.fullId,
            suggestion: `可用节点: ${[...allNodeIds].slice(0, 5).join(', ')}...`,
            quickFix: {
              label: `创建节点「${option.targetFullId}」`,
              action: 'create-node',
              payload: { nodeName: option.targetNodeId, chapterId: option.targetChapterId },
            },
          });
        }
      }
    }
  }
  return diagnostics;
}
```

#### 3.2.3 警告检测器 (7 种)

| 编号 | 检测器 | 检测逻辑 |
|------|--------|---------|
| W001 | OrphanNodeDetector | 节点不是根节点，且没有任何选项的 targetFullId 指向它 |
| W002 | DeadEndDetector | 节点没有任何出口选项，且 text 中不含"结局"/"结束"/"END" 关键词 |
| W003 | UnusedVariableDetector | Frontmatter 声明的变量在全文（条件+效果）中未被引用 |
| W004 | DuplicateOptionTextDetector | 同一节点下两个选项的 text 完全相同（trim + toLowerCase 比较） |
| W005 | EmptyDescriptionDetector | 节点 body 为空数组或所有 body 行 trim 后为空 |
| W006 | FormatIrregularDetector | 章节标题不以 `# ` 开头，或节点标题不以 `## 节点：` 开头 |
| W007 | IncompleteOptionDetector | 检测到 `[选项]` 行缺少 `-> 节点：目标` 跳转标记（保留原文为正文，仅警告） |

#### 3.2.4 建议检测器 (3 种)

| 编号 | 检测器 | 检测逻辑 |
|------|--------|---------|
| I001 | PossibleSoftlockDetector | 节点的所有选项都有条件，没有无条件(default)选项 |
| I002 | ShortDescriptionDetector | 节点所有 body 行 join 后长度 < 10 字符 |
| I003 | NoChapterDetector | 根节点之前没有 H1 章节标题 |

#### 3.2.5 验证器主入口

```typescript
// validator.ts

const ERROR_DETECTORS: ErrorDetectorFn[] = [
  detectTargetNotFound,
  detectUndeclaredVariable,
  detectIllegalEnum,
  detectTypeMismatch,
  detectParseFailure,
  detectNestingExceeded,
  detectDuplicateNode,
  detectDuplicateVariable,
];

const WARNING_DETECTORS: WarningDetectorFn[] = [
  detectOrphanNode,
  detectDeadEnd,
  detectUnusedVariable,
  detectDuplicateOptionText,
  detectEmptyDescription,
  detectFormatIrregular,
  detectIncompleteOption,
];

const INFO_DETECTORS: InfoDetectorFn[] = [
  detectPossibleSoftlock,
  detectShortDescription,
  detectNoChapter,
];

function validate(data: PlotFlowData, rawText: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 并行运行所有检测器（纯计算，无副作用）
  for (const detector of ERROR_DETECTORS) {
    diagnostics.push(...detector(data, rawText));
  }
  for (const detector of WARNING_DETECTORS) {
    diagnostics.push(...detector(data, rawText));
  }
  for (const detector of INFO_DETECTORS) {
    diagnostics.push(...detector(data, rawText));
  }

  // 去重: 同一位置的同类型诊断只保留一个
  return deduplicateDiagnostics(diagnostics);
}
```

### 3.3 导出器 (Exporter)

#### 3.3.1 Pipeline 架构

```
PlotFlowData AST
       │
       ▼
┌──────────────────────────────────┐
│         Exporter Pipeline        │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Format-specific Renderer  │  │
│  │                            │  │
│  │  JSONRenderer  → .json     │  │
│  │  HTMLRenderer  → .html     │  │
│  │  TXTRenderer   → .txt      │  │
│  │  GodotRenderer → .json     │  │
│  │  UnityRenderer → .json     │  │
│  │  (plugin formatters)       │  │
│  └────────────────────────────┘  │
└──────────────────────────────────┘
```

#### 3.3.2 导出器接口

```typescript
// exporter/types.ts

interface IExporter {
  readonly format: ExportFormat;
  readonly extension: string;
  readonly mimeType: string;

  export(data: PlotFlowData, config: ExportConfig): ExportResult;
  exportToString(data: PlotFlowData, config: ExportConfig): string;
}

type ExportFormat = 'json' | 'html' | 'txt' | 'godot' | 'unity' | 'unreal';

interface ExportConfig {
  format: ExportFormat;
  pretty?: boolean;               // JSON: 2-space indent
  includeDiagnostics?: boolean;   // 是否导出 isOrphan/isDeadEnd 等
  targetEngine?: 'godot' | 'unity' | 'unreal';
  htmlTheme?: 'dark' | 'light';
  embedAssets?: boolean;          // HTML: 内嵌 CSS/JS
}

interface ExportResult {
  success: boolean;
  content: string;                // 导出内容
  fileName: string;               // 建议文件名
  warnings?: string[];            // 非阻断警告
  errors?: string[];              // 阻断错误
}
```

#### 3.3.3 JSON 导出器

```typescript
// exporter/json-exporter.ts

class JSONExporter implements IExporter {
  readonly format = 'json';
  readonly extension = '.json';
  readonly mimeType = 'application/json';

  export(data: PlotFlowData, config: ExportConfig): ExportResult {
    const exportData: StoryJSON = {
      $schema: `https://plotflow.dev/schema/${config.formatVersion ?? '0.1'}/story.json`,
      meta: {
        plotflow: data.meta.plotflow,
        title: data.meta.title,
        author: data.meta.author,
        engine: data.meta.engine ?? 'none',
        exportedAt: new Date().toISOString(),
      },
      variables: this.serializeVariables(data.variables),
      chapters: data.chapters.map(ch => ({
        id: ch.id,
        title: ch.title,
        nodes: ch.nodes.map(n => ({
          id: n.id,
          chapterId: n.chapterId,
          fullId: n.fullId,
          title: n.title,
          body: n.body,
          options: n.options.map(opt => ({
            index: opt.index,
            text: opt.text,
            targetNodeId: opt.targetNodeId,
            targetFullId: opt.targetFullId,
            conditions: this.serializeCondition(opt.conditions),
            sideEffects: opt.sideEffects?.map(this.serializeSideEffect) ?? [],
          })),
          position: n.position,
          isRoot: n.isRoot,
          isOrphan: n.isOrphan,
          isDeadEnd: n.isDeadEnd,
        })),
      })),
    };

    const indent = config.pretty !== false ? 2 : 0;
    const content = JSON.stringify(exportData, null, indent);

    return {
      success: true,
      content,
      fileName: `${data.meta.title.replace(/\s+/g, '_')}.json`,
    };
  }

  private serializeCondition(cond: Condition | null): object | null {
    if (!cond) return null;
    return {
      expression: cond.expression,
      ast: cond.ast,  // 直接序列化 AST（JSON 兼容）
    };
  }

  private serializeSideEffect(effect: SideEffect): object {
    return {
      variable: effect.variable,
      operation: effect.operation,
      value: effect.value,
    };
  }
}
```

#### 3.3.4 HTML 导出器

```typescript
// exporter/html-exporter.ts

class HTMLExporter implements IExporter {
  readonly format = 'html';
  readonly extension = '.html';
  readonly mimeType = 'text/html';

  export(data: PlotFlowData, config: ExportConfig): ExportResult {
    const theme = config.htmlTheme ?? 'dark';
    const html = this.buildHTML(data, theme);

    return {
      success: true,
      content: html,
      fileName: `${data.meta.title.replace(/\s+/g, '_')}.html`,
    };
  }

  private buildHTML(data: PlotFlowData, theme: 'dark' | 'light'): string {
    // 生成单文件 HTML，包含:
    // 1. 内嵌 CSS 变量（暗色/亮色主题）
    // 2. JavaScript 内嵌交互引擎（轻量级）:
    //    - 节点渲染函数
    //    - 选项按钮生成（含条件检查和 🔒 标记）
    //    - 面包屑导航
    //    - 变量面板
    //    - localStorage 保存进度
    // 3. 将 PlotFlowData 序列化为 JS 内嵌对象:
    //    <script>const STORY_DATA = {...};</script>

    const storyJSON = JSON.stringify(this.serializeForHTML(data));
    const css = this.getThemeCSS(theme);
    const js = this.getInteractionJS();

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.meta.title)} — PlotFlow</title>
  <style>${css}</style>
</head>
<body>
  <div id="plotflow-app">
    <nav id="breadcrumb"></nav>
    <main id="story-content"></main>
    <div id="options-panel"></div>
    <footer id="variable-panel"></footer>
  </div>
  <script>const STORY_DATA = ${storyJSON};</script>
  <script>${js}</script>
</body>
</html>`;
  }
}
```

#### 3.3.5 TXT 导出器

```typescript
// exporter/txt-exporter.ts

class TXTExporter implements IExporter {
  readonly format = 'txt';
  readonly extension = '.txt';
  readonly mimeType = 'text/plain; charset=utf-8';

  export(data: PlotFlowData, _config: ExportConfig): ExportResult {
    const lines: string[] = [];
    lines.push(`# ${data.meta.title}`);
    lines.push('');

    for (const chapter of data.chapters) {
      lines.push(`## ${chapter.title}`);
      lines.push('');

      for (const node of chapter.nodes) {
        lines.push(`### ${node.title}`);
        for (const line of node.body) {
          lines.push(line);
        }
        lines.push('');

        for (const option of node.options) {
          const cond = option.conditions ? ` [条件: ${option.conditions.expression}]` : '';
          lines.push(`  → ${option.text} (跳转到: ${option.targetNodeId})${cond}`);
        }
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }

    return {
      success: true,
      content: lines.join('\n'),
      fileName: `${data.meta.title.replace(/\s+/g, '_')}.txt`,
    };
  }
}
```

#### 3.3.6 插件接口定义

```typescript
// plugin-api.ts

// 引擎插件通过实现此接口接入 PlotFlow 导出管线
// V0.1: Godot 完整实现, Unity 接口+示例, Unreal 仅接口定义

interface IEnginePlugin {
  /** 插件名称 */
  readonly name: string;

  /** 目标引擎 */
  readonly engine: 'godot' | 'unity' | 'unreal';

  /** 从 PlotFlowData 生成引擎专用格式 */
  exportForEngine(data: PlotFlowData, config: EngineExportConfig): string;

  /** 从引擎项目读取变量列表（插件模式用） */
  readEngineVariables?(projectPath: string): EngineVariable[];

  /** 检查引擎项目是否已安装此插件 */
  isInstalledInProject?(projectPath: string): boolean;
}

interface EngineExportConfig {
  projectPath: string;
  outputDir: string;
  includeRuntimeLibs?: boolean;
  prettyPrint?: boolean;
}

interface EngineVariable {
  name: string;
  type: string;
  defaultValue: unknown;
  description?: string;
}
```

### 3.4 补全引擎 (Completion Engine)

#### 3.4.1 N-gram 引擎架构（移植自 MarkLuck）

```
                    ┌───────────────────────────────┐
                    │     CompletionEngine           │
                    │                                │
  触发上下文 ──────►│  ┌─────────────────────────┐  │
  (CompletionCtx)  │  │ ContextWindowExtractor   │  │
                    │  │ (提取前后N字)            │  │
                    │  └───────────┬─────────────┘  │
                    │              │                 │
                    │  ┌───────────▼─────────────┐  │
                    │  │ InvertedIndex            │  │
                    │  │ (倒排索引: prefix→ngrams)│  │
                    │  └───────────┬─────────────┘  │
                    │              │                 │
                    │  ┌───────────▼─────────────┐  │
                    │  │ Ranker                   │  │
                    │  │ (频率 × 时效 × 语境)     │  │
                    │  └───────────┬─────────────┘  │
                    │              │                 │
                    │  ┌───────────▼─────────────┐  │
                    │  │ CorpusManager            │  │
                    │  │ ┌───────┐ ┌───────────┐ │  │
                    │  │ │预置语料│ │本地学习   │ │  │
                    │  │ │ (5MB) │ │ (增量)   │ │  │
                    │  │ └───────┘ └───────────┘ │  │
                    │  │ ┌───────────────────────┐ │  │
                    │  │ │ 用户导入语料           │ │  │
                    │  │ └───────────────────────┘ │  │
                    │  └───────────────────────────┘  │
                    └───────────────┬───────────────────┘
                                    │
                                    ▼
                          CompletionSuggestion[]
```

#### 3.4.2 四维触发定义

```typescript
// completion/triggers.ts

type CompletionDimension = 'node-title' | 'option-text' | 'body-text' | 'variable-name';

interface CompletionContext {
  dimension: CompletionDimension;
  /** 用户已输入的文本前缀 */
  prefix: string;
  /** 光标前 N 字上下文（根据维度不同） */
  contextBefore: string;
  /** 光标后 N 字上下文 */
  contextAfter?: string;
  /** 当前节点标题（用于正文补全） */
  currentNodeTitle?: string;
  /** 当前节点的已有选项列表（用于句式补全） */
  existingOptions?: string[];
  /** Frontmatter 变量列表（用于变量补全） */
  availableVariables?: string[];
  /** 光标位置 */
  cursorPosition: Position;
}

// 触发检测函数
function detectTrigger(
  text: string,
  cursorPosition: Position
): CompletionContext | null {
  const line = getLineAt(text, cursorPosition.line);
  const textBeforeCursor = line.substring(0, cursorPosition.column);

  // 1. 节点标题触发: 该行以 '# 节点：' 或 '## 节点：' 开头
  if (/^(#{1,2})\s+节点：/.test(line)) {
    const afterKeyword = line.replace(/^(#{1,2})\s+节点：\s*/, '');
    return {
      dimension: 'node-title',
      prefix: afterKeyword,
      contextBefore: textBeforeCursor,
      cursorPosition,
    };
  }

  // 2. 选项句式触发: 该行以 '[选项]' 开头
  if (/^\[选项\]\s+/.test(line)) {
    const afterOption = line.replace(/^\[选项\]\s+/, '');
    return {
      dimension: 'option-text',
      prefix: afterOption,
      contextBefore: textBeforeCursor,
      existingOptions: detectExistingOptions(text),
      cursorPosition,
    };
  }

  // 3. 变量名触发: 光标前最近的非空白字符序列以 '$' 结尾
  const dollarMatch = textBeforeCursor.match(/\$(\w*)$/);
  if (dollarMatch) {
    return {
      dimension: 'variable-name',
      prefix: dollarMatch[1],
      contextBefore: textBeforeCursor,
      availableVariables: getAvailableVariableNames(),
      cursorPosition,
    };
  }

  // 4. 正文描述触发: 在正文段落中（非特殊行）
  if (!isSpecialLine(line)) {
    return {
      dimension: 'body-text',
      prefix: textBeforeCursor,
      contextBefore: textBeforeCursor.slice(-50),  // 前50字
      cursorPosition,
    };
  }

  return null;
}
```

#### 3.4.3 N-gram 引擎核心

```typescript
// completion/ngram-engine.ts
// 移植自 MarkLuck: packages/app/src/utils/ngram-engine.ts

interface NGramEntry {
  context: string[];        // 前 N-1 个 token
  completion: string;       // 补全文本
  frequency: number;        // 出现次数
  lastSeenAt: number;       // 最后出现时间戳
  source: 'baseline' | 'user' | 'imported';  // 语料来源
}

class NGramEngine {
  private ngrams: Map<number, Map<string, NGramEntry[]>> = new Map();
  //                                     ^ prefix → entries

  /** 最大 N-gram 长度 */
  private readonly maxN = 5;

  /** 从语料文本中训练 */
  train(text: string, source: NGramEntry['source']): void {
    const tokens = this.tokenize(text);
    for (let n = 1; n <= this.maxN; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const context = tokens.slice(i, i + n - 1);
        const completion = tokens[i + n - 1];
        const prefix = context.join('');

        if (!this.ngrams.has(n)) {
          this.ngrams.set(n, new Map());
        }
        const levelMap = this.ngrams.get(n)!;
        if (!levelMap.has(prefix)) {
          levelMap.set(prefix, []);
        }

        const entries = levelMap.get(prefix)!;
        const existing = entries.find(e => e.completion === completion);
        if (existing) {
          existing.frequency++;
          existing.lastSeenAt = Date.now();
        } else {
          entries.push({
            context,
            completion,
            frequency: 1,
            lastSeenAt: Date.now(),
            source,
          });
        }
      }
    }
  }

  /** 增量学习（用户保存时触发） */
  incrementalLearn(text: string): void {
    this.train(text, 'user');
  }

  /** 预测补全 */
  predict(context: CompletionContext, topK: number = 5): CompletionSuggestion[] {
    const tokens = this.tokenize(context.contextBefore);
    const results: CompletionSuggestion[] = [];

    // 从最长 N-gram 开始尝试匹配
    for (let n = Math.min(this.maxN, tokens.length); n >= 1; n--) {
      const prefix = tokens.slice(-(n - 1)).join('');
      const entries = this.ngrams.get(n)?.get(prefix);
      if (entries && entries.length > 0) {
        const scored = entries
          .filter(e => e.completion.startsWith(context.prefix))
          .map(e => ({
            text: e.completion,
            score: this.calculateScore(e, context),
            source: e.source,
          }));
        scored.sort((a, b) => b.score - a.score);
        results.push(...scored.slice(0, topK));
        break;  // 最长匹配优先
      }
    }

    return results;
  }

  /** 评分函数: 频率 × 时效性衰减 × 语料来源权重 */
  private calculateScore(entry: NGramEntry, context: CompletionContext): number {
    const frequencyWeight = Math.log2(entry.frequency + 1);

    // 时效性衰减: 90天 half-life
    const daysSinceSeen = (Date.now() - entry.lastSeenAt) / (1000 * 60 * 60 * 24);
    const recencyWeight = Math.pow(0.5, daysSinceSeen / 90);

    // 来源权重: user > imported > baseline
    const sourceWeight = { baseline: 0.5, imported: 1.0, user: 1.5 }[entry.source];

    return frequencyWeight * recencyWeight * sourceWeight;
  }

  /** 分词（中文按字符 + 标点切分，英文按词） */
  private tokenize(text: string): string[] {
    // 简单策略: 按 Unicode 类别切分
    const tokens: string[] = [];
    let current = '';
    for (const char of text) {
      if (/[一-鿿]/.test(char)) {
        if (current) { tokens.push(current); current = ''; }
        tokens.push(char);
      } else if (/[a-zA-Z0-9]/.test(char)) {
        current += char;
      } else {
        if (current) { tokens.push(current); current = ''; }
        tokens.push(char);
      }
    }
    if (current) tokens.push(current);
    return tokens.filter(t => t.trim() !== '');
  }

  /** 权重衰减: 移除 90 天未见且源为 baseline 的条目 */
  prune(olderThanDays: number = 180): void {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    for (const [n, levelMap] of this.ngrams) {
      for (const [prefix, entries] of levelMap) {
        const filtered = entries.filter(e =>
          e.lastSeenAt > cutoff || e.source !== 'baseline'
        );
        if (filtered.length === 0) {
          levelMap.delete(prefix);
        } else {
          levelMap.set(prefix, filtered);
        }
      }
    }
  }

  /** 序列化为紧凑格式（用于持久化） */
  serialize(): ArrayBuffer { /* 自定义紧凑二进制格式 */ }

  /** 从紧凑格式反序列化 */
  static deserialize(buffer: ArrayBuffer): NGramEngine { /* ... */ }
}
```

#### 3.4.4 本地学习器

```typescript
// completion/local-learner.ts

class LocalLearner {
  private engine: NGramEngine;
  private db: Database;  // better-sqlite3（仅存储元数据和语料索引）

  /** 保存文件时增量学习 */
  async learnFromSave(mdstoryContent: string): Promise<void> {
    // 提取用户写作内容（去除 Frontmatter 和标记语法）
    const cleanText = extractPlainText(mdstoryContent);

    // 增量训练
    this.engine.incrementalLearn(cleanText);

    // 异步持久化引擎状态
    await this.persistEngine();
  }

  /** 获取补全建议 */
  getSuggestions(context: CompletionContext): CompletionSuggestion[] {
    // 变量补全有特殊路径
    if (context.dimension === 'variable-name') {
      return this.getVariableCompletions(context);
    }
    return this.engine.predict(context);
  }

  /** 变量名补全 — 直接匹配 Frontmatter */
  private getVariableCompletions(context: CompletionContext): CompletionSuggestion[] {
    const vars = context.availableVariables ?? [];
    return vars
      .filter(v => v.startsWith(context.prefix))
      .map(v => ({
        text: v,
        score: 100,  // 精确匹配优先
        source: 'variable' as const,
      }));
  }

  private async persistEngine(): Promise<void> {
    // 存储到: %APPDATA%/PlotFlow/learner/ngram.dat
  }
}
```

#### 3.4.5 语料管理器

```typescript
// completion/corpus-manager.ts

interface CorpusEntry {
  id: string;
  fileName: string;
  size: number;             // bytes
  importedAt: Date;
  enabled: boolean;
  category: 'rpg' | 'visual-novel' | 'puzzle' | 'general';
}

class CorpusManager {
  private db: Database;     // better-sqlite3: 语料元数据
  private engine: NGramEngine;
  private maxTotalSize = 50 * 1024 * 1024;  // 50MB
  private maxFileSize = 10 * 1024 * 1024;   // 10MB per file

  /** 导入语料文件 */
  async importFile(filePath: string): Promise<CorpusEntry> {
    const stat = await fs.stat(filePath);
    if (stat.size > this.maxFileSize) {
      throw new Error(`文件超过限制 (${this.maxFileSize / 1024 / 1024}MB)`);
    }

    const content = await fs.readFile(filePath, 'utf-8');
    const cleaned = this.preprocess(content, path.extname(filePath));

    // 训练引擎
    this.engine.train(cleaned, 'imported');

    return {
      id: nanoid(),
      fileName: path.basename(filePath),
      size: stat.size,
      importedAt: new Date(),
      enabled: true,
      category: this.detectCategory(cleaned),
    };
  }

  /** 预处理: 去重、分段、清洗 */
  private preprocess(text: string, ext: string): string {
    if (ext === '.mdstory') {
      // 提取正文（去除 Frontmatter 和标记）
      text = extractPlainText(text);
    } else if (ext === '.csv') {
      // 读取第二列（文本列）
      text = parseCSVText(text);
    }
    // 去重（编辑距离 < 3 视为重复）
    text = deduplicateSentences(text);
    // 清洗: 去除 URL, 代码块
    text = cleanText(text);
    return text;
  }

  /** 检测语料类别 */
  private detectCategory(text: string): CorpusEntry['category'] {
    // 关键词启发式分类
    // 含 攻击/防御/血量/经验 → rpg
    // 含 告白/约会/好感 → visual-novel
    // 含 线索/密码/钥匙/密室 → puzzle
    // 其他 → general
    return 'general';
  }
}
```

#### 3.4.6 Monaco InlineCompletionItemProvider 适配

```typescript
// completion/monaco-adapter.ts

class MonacoCompletionAdapter implements monaco.languages.InlineCompletionsProvider {
  private learner: LocalLearner;

  constructor(learner: LocalLearner) {
    this.learner = learner;
  }

  async provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    _context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.InlineCompletions> {
    // 1. 获取编辑器文本
    const text = model.getValue();

    // 2. 检测触发条件
    const triggerCtx = detectTrigger(text, {
      line: position.lineNumber,
      column: position.column,
    });

    if (!triggerCtx) {
      return { items: [] };
    }

    // 3. 注入变量列表（如果需要）
    if (triggerCtx.dimension === 'variable-name') {
      const vars = useStoryStore.getState().variables;
      triggerCtx.availableVariables = Array.from(vars.keys());
    }

    // 4. 获取建议（200ms timeout）
    const suggestions = this.learner.getSuggestions(triggerCtx);

    if (token.isCancellationRequested) {
      return { items: [] };
    }

    // 5. 转换为 Monaco InlineCompletionItem
    return {
      items: suggestions.map(s => ({
        insertText: s.text,
        range: {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        },
      })),
    };
  }
}
```

---

## 4. Electron 主进程 `[V0.1]`

### 4.1 File I/O 服务

```typescript
// src-electron/services/file-service.ts

import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

// IPC 通道定义
const IPC_CHANNELS = {
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:saveAs',
  FILE_WATCH: 'file:watch',
  FILE_READ: 'file:read',
  FILE_EXISTS: 'file:exists',
  FILE_RECENT: 'file:getRecent',
  FILE_NEW_TEMPLATE: 'file:newFromTemplate',
} as const;

interface FileService {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  openDialog(): Promise<string | null>;
  saveDialog(defaultName: string): Promise<string | null>;
  watchFile(filePath: string, callback: (event: string) => void): void;
}

function registerFileService(mainWindow: BrowserWindow): void {
  // 打开文件对话框
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '打开 PlotFlow 文件',
      filters: [
        { name: 'PlotFlow 故事文件', extensions: ['mdstory'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf-8');
    return { filePath, content };
  });

  // 保存文件
  ipcMain.handle(IPC_CHANNELS.FILE_SAVE, async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  });

  // 另存为
  ipcMain.handle(IPC_CHANNELS.FILE_SAVE_AS, async (_event, content: string) => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存 PlotFlow 文件',
      filters: [{ name: 'PlotFlow 故事文件', extensions: ['mdstory'] }],
      defaultPath: 'untitled.mdstory',
    });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(result.filePath, content, 'utf-8');
    return { filePath: result.filePath };
  });

  // 读取文件（已知路径）
  ipcMain.handle(IPC_CHANNELS.FILE_READ, async (_event, filePath: string) => {
    const content = await fs.readFile(filePath, 'utf-8');
    return { content };
  });

  // 检查文件存在
  ipcMain.handle(IPC_CHANNELS.FILE_EXISTS, async (_event, filePath: string) => {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  });
}
```

### 4.2 自动保存管理器

```typescript
// src-electron/services/auto-saver.ts

class AutoSaveManager {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs = 500;
  private pendingContent: string | null = null;
  private pendingPath: string | null = null;

  /** 接收来自 renderer 的保存请求 */
  onContentChanged(filePath: string, content: string): void {
    this.pendingContent = content;
    this.pendingPath = filePath;

    if (this.saveTimer) clearTimeout(this.saveTimer);

    this.saveTimer = setTimeout(() => {
      this.flush();
    }, this.debounceMs);
  }

  /** 强制立即保存 */
  async flush(): Promise<void> {
    if (!this.pendingContent || !this.pendingPath) return;

    try {
      await fs.writeFile(this.pendingPath, this.pendingContent, 'utf-8');
      // 通知 renderer 保存成功
      mainWindow.webContents.send('save:completed', { timestamp: Date.now() });
    } catch (error) {
      mainWindow.webContents.send('save:failed', { error: (error as Error).message });
    }
  }

  /** 外部文件变化检测（如 git pull） */
  startWatch(filePath: string): void {
    fs.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        mainWindow.webContents.send('file:external-change', { filePath });
      }
    });
  }

  dispose(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
  }
}
```

### 4.3 原生菜单构建器

```typescript
// src-electron/services/menu-builder.ts

function buildAppMenu(): Electron.Menu {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'Ctrl+N', click: () => sendToRenderer('menu:new') },
        { label: '打开...', accelerator: 'Ctrl+O', click: () => sendToRenderer('menu:open') },
        { type: 'separator' },
        { label: '保存', accelerator: 'Ctrl+S', click: () => sendToRenderer('menu:save') },
        { label: '另存为...', accelerator: 'Ctrl+Shift+S', click: () => sendToRenderer('menu:saveAs') },
        { type: 'separator' },
        {
          label: '从模板新建',
          submenu: [
            { label: 'RPG 对话模板', click: () => sendToRenderer('menu:new-template', 'rpg') },
            { label: '视觉小说模板', click: () => sendToRenderer('menu:new-template', 'visual-novel') },
            { label: '解谜游戏模板', click: () => sendToRenderer('menu:new-template', 'puzzle') },
            { label: 'Godot 示例项目', click: () => sendToRenderer('menu:new-template', 'godot') },
          ],
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'Ctrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Ctrl+Y', role: 'redo' },
        { type: 'separator' },
        { label: '查找', accelerator: 'Ctrl+F', click: () => sendToRenderer('menu:find') },
        { label: '全局搜索', accelerator: 'Ctrl+Shift+F', click: () => sendToRenderer('menu:searchAll') },
        { label: '跳转到节点...', accelerator: 'Ctrl+G', click: () => sendToRenderer('menu:goto-node') },
        { type: 'separator' },
        {
          label: '插入',
          submenu: [
            { label: '插入选项', accelerator: 'Ctrl+Shift+O', click: () => sendToRenderer('menu:insert-option') },
            { label: '插入节点', accelerator: 'Ctrl+Shift+N', click: () => sendToRenderer('menu:insert-node') },
          ],
        },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '大纲视图', type: 'checkbox', checked: true, click: () => sendToRenderer('menu:toggle-outline') },
        { label: '问题面板', accelerator: 'Ctrl+Shift+M', click: () => sendToRenderer('menu:toggle-problems') },
        { type: 'separator' },
        { label: '切换主题', accelerator: 'Ctrl+Shift+T', click: () => sendToRenderer('menu:toggle-theme') },
        { type: 'separator' },
        { label: '放大', accelerator: 'Ctrl+=', role: 'zoomIn' },
        { label: '缩小', accelerator: 'Ctrl+-', role: 'zoomOut' },
        { label: '重置缩放', accelerator: 'Ctrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: '导出',
      submenu: [
        // V0.1: 导出格式
        { label: '导出 JSON...', accelerator: 'Ctrl+Shift+J', click: () => sendToRenderer('menu:export-json') },
        { label: '导出 HTML...', accelerator: 'Ctrl+Shift+H', click: () => sendToRenderer('menu:export-html') },
        { label: '导出 TXT...', accelerator: 'Ctrl+Shift+E', click: () => sendToRenderer('menu:export-txt') },
        { type: 'separator' },
        // 引擎集成（V0.1 Godot 完整，其余标注版本）
        { label: '导出到 Godot 项目...', click: () => sendToRenderer('menu:export-godot') },
        { label: '导出到 Unity 项目... (V0.2)', enabled: false, click: () => {} },
        { label: '导出到 Unreal 项目... (V0.3)', enabled: false, click: () => {} },
      ],
    },
    {
      label: '帮助',
      submenu: [
        { label: '语法手册', click: () => sendToRenderer('menu:help-syntax') },
        { label: '模板指南', click: () => sendToRenderer('menu:help-templates') },
        { label: '反馈与社群', click: () => sendToRenderer('menu:help-feedback') },
        { type: 'separator' },
        { label: '关于 PlotFlow', click: () => sendToRenderer('menu:help-about') },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
```

### 4.4 文件关联 (.mdstory)

```typescript
// src-electron/services/file-association.ts
// 在 electron-builder 配置中声明文件关联

// package.json (electron-builder config)
// "fileAssociations": [
//   {
//     "ext": "mdstory",
//     "name": "PlotFlow Story File",
//     "description": "PlotFlow 叙事分支脚本",
//     "mimeType": "text/markdown; variant=plotflow",
//     "role": "Editor"
//   }
// ]

// Windows: 注册表 HKEY_CLASSES_ROOT\.mdstory → PlotFlow.exe "%1"
// macOS: Info.plist CFBundleDocumentTypes
// Linux: .desktop 文件 MimeType 条目

function handleFileOpen(app: Electron.App): void {
  // macOS: open-file 事件
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    openFileInWindow(filePath);
  });

  // Windows: process.argv 中的第二个参数
  const filePath = process.argv.find(arg => arg.endsWith('.mdstory'));
  if (filePath) {
    openFileInWindow(filePath);
  }
}
```

### 4.5 窗口状态持久化

```typescript
// src-electron/services/window-state.ts

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized: boolean;
}

class WindowStateManager {
  private statePath: string;
  private defaultState: WindowState = { width: 1400, height: 900, isMaximized: false };

  constructor() {
    this.statePath = path.join(app.getPath('userData'), 'window-state.json');
  }

  async load(): Promise<WindowState> {
    try {
      const data = await fs.readFile(this.statePath, 'utf-8');
      return { ...this.defaultState, ...JSON.parse(data) };
    } catch {
      return { ...this.defaultState };
    }
  }

  async save(win: BrowserWindow): Promise<void> {
    const bounds = win.getBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
    };
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    await fs.writeFile(this.statePath, JSON.stringify(state), 'utf-8');
  }
}
```

---

## 5. 数据流图 `[V0.1]`

### 5.1 用户输入到自动保存

```
┌──────────────────────────────────────────────────────────────────┐
│                    用户输入 → 自动保存                            │
│                                                                  │
│  键盘输入                                                        │
│     │                                                            │
│     ▼                                                            │
│  Monaco Editor.onDidChangeModelContent()                         │
│     │                                                            │
│     ├──→ useEditorStore.setRawMarkdown(text)  [即时, 无 debounce]│
│     ├──→ useEditorStore.markDirty()                              │
│     └──→ 启动 500ms debounce timer                               │
│              │                                                   │
│              ▼ (500ms 后)                                        │
│         ┌───────────────────────────────────────┐                │
│         │  debounceHandler()                    │                │
│         │                                       │                │
│         │  1. parsePlotFlow(text)               │                │
│         │     └──→ useStoryStore.setPlotFlowData│                │
│         │                                       │                │
│         │  2. validate(data, text)              │                │
│         │     └──→ useValidatorStore.validate() │                │
│         │                                       │                │
│         │  3. syncDiagnosticsToMonaco()         │                │
│         │     └──→ monaco.setModelMarkers()     │                │
│         │                                       │                │
│         │  4. useGraphStore.syncFromAST(data)   │                │
│         │     └──→ ReactFlow 重新渲染            │                │
│         │                                       │                │
│         │  5. requestCompletion(context)        │                │
│         │     └──→ 异步 Worker 线程计算          │                │
│         │                                       │                │
│         │  6. ipcRenderer.invoke('file:save')   │                │
│         │     └──→ Electron Main Process        │                │
│         │         └──→ fs.writeFile()           │                │
│         └───────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 AST 更新到 UI 刷新

```
PlotFlowData AST (useStoryStore)
        │
        ├──→ 直接驱动 ──→ OutlineView
        │                  (读取 chapters[].nodes[], 渲染节点树)
        │
        ├──→ useGraphStore.syncFromAST()
        │        │
        │        ├──→ Dagre 布局计算
        │        │     │
        │        │     └──→ nodes[] / edges[] (React Flow 格式)
        │        │           │
        │        │           └──→ ReactFlowGraph 重新渲染
        │        │                 ├──→ StoryNode (自定义节点)
        │        │                 ├──→ ConditionEdge / UnconditionalEdge
        │        │                 └──→ 节点状态着色 (检查 diagnostic)
        │        │
        │        └──→ Minimap 更新
        │
        ├──→ useValidatorStore.validate()
        │        │
        │        ├──→ diagnostics[] (完整列表)
        │        ├──→ diagnosticsByNode (按节点分组)
        │        ├──→ diagnosticsByLine (按行号分组)
        │        │
        │        ├──→ syncDiagnosticsToMonaco()
        │        │     └──→ monaco.setModelMarkers() → 波浪线
        │        │
        │        ├──→ ProblemsPanel (列表显示)
        │        │
        │        ├──→ OutlineView (节点状态图标)
        │        │
        │        └──→ StatusBar (diagnosticSummary: 🔴3 🟡2 🔵1)
        │
        ├──→ useCompletionStore.requestCompletion()
        │        │
        │        ├──→ detectTrigger() (基于光标位置+文本)
        │        ├──→ NGramEngine.predict()
        │        │     └──→ CompletionSuggestion[]
        │        │
        │        └──→ MonacoCompletionAdapter
        │              └──→ InlineCompletionItemProvider
        │                    └──→ 幽灵字符显示
        │
        └──→ StatusBar
                 └──→ nodeStats (节点数/选项数)
```

### 5.3 导出 Pipeline 数据流

```
用户触发导出 (Ctrl+E / 菜单)
        │
        ▼
 ExportDialog (选择格式: JSON/HTML/TXT)
        │
        ▼
 useStoryStore.getState().plotFlowData  ← AST
        │
        ▼
 ExportManager.export(data, config)
        │
        ├── config.format === 'json'
        │     └──→ JSONExporter.export()
        │           │
        │           ├──→ serializeVariables()
        │           ├──→ serializeChapters() (含 AST)
        │           └──→ JSON.stringify() → .json 文件
        │
        ├── config.format === 'html'
        │     └──→ HTMLExporter.export()
        │           │
        │           ├──→ 内嵌 CSS (主题变量)
        │           ├──→ 内嵌 JavaScript (交互引擎)
        │           ├──→ 序列化 PlotFlowData → JS 对象
        │           └──→ 拼接完整 HTML → .html 文件
        │
        ├── config.format === 'txt'
        │     └──→ TXTExporter.export()
        │           │
        │           ├──→ 遍历所有节点
        │           ├──→ 提取正文 + 选项文本
        │           └──→ 纯文本拼接 → .txt 文件
        │
        └── config.format === 'godot' | 'unity' | 'unreal'
              └──→ EnginePlugin.exportForEngine()
                    │
                    ├──→ 引擎专属 JSON 转换
                    └──→ 输出到引擎项目目录
```

---

## 6. 类型系统 `[V0.1]`

### 6.1 完整 TypeScript 接口定义

```typescript
// ============================================================
// @plotflow/parser/src/types.ts
// 核心类型 — 与 PRD JSON Schema 对齐
// ============================================================

/** 顶层数据结构 */
interface PlotFlowData {
  meta: PlotFlowMeta;
  variables: VariableDefinitions;       // Map<string, VariableDefinition>
  chapters: Chapter[];
}

interface PlotFlowMeta {
  plotflow: string;                     // 版本号 e.g. '0.1'
  title: string;
  author?: string;
  engine?: 'godot' | 'unity' | 'unreal' | 'none';
}

/** 变量定义 */
interface VariableDefinitions {
  [name: string]: VariableDefinition;
}

type VariableType = 'int' | 'float' | 'bool' | 'string' | 'enum' | 'object';
type VariableScope = 'global' | 'chapter';

interface VariableDefinition {
  name: string;
  type: VariableType;
  scope: VariableScope;
  default?: unknown;
  // enum 专属
  values?: string[];
  // object 专属
  fields?: Record<string, VariableDefinition>;
  // 嵌套深度（计算值，用于检测 E006）
  nestingDepth?: number;
  // 所属章节（scope='chapter' 时）
  chapterId?: string;
  // 元数据
  description?: string;
}

/** 章节 */
interface Chapter {
  id: string;                           // 章节 ID（与 title 相同）
  title: string;                        // 章节标题
  nodes: StoryNode[];                   // 本章的节点列表
}

/** 故事节点 */
interface StoryNode {
  id: string;                           // 节点 ID（不含章节前缀）
  chapterId: string;                    // 所属章节 ID
  fullId: string;                       // 全局唯一 ID: "章节ID/节点ID"
  title: string;                        // 节点标题（纯文本，不含"节点："前缀）
  body: string[];                       // 描述文本数组（按段落）
  options: Option[];                    // 选项列表
  position: { x: number; y: number };  // 分支图位置
  // 诊断标记（由 Validator 计算）
  isRoot: boolean;                      // 是否为第一个节点
  isOrphan: boolean;                    // 是否孤立
  isDeadEnd: boolean;                   // 是否死胡同
}

/** 选项 */
interface Option {
  index: number;                        // 在节点内的序号（0-based）
  text: string;                         // 选项描述文本
  targetNodeId: string;                 // 跳转目标节点 ID（不含章节前缀）
  targetChapterId?: string;             // 跳转目标章节（跨章节引用时）
  targetFullId: string;                 // 跳转目标全局 ID（解析器自动补全）
  // 条件（可选）
  conditions: Condition | null;
  // 变量副作用（可选）
  sideEffects: SideEffect[];
  // 源码位置
  location?: SourceLocation;
}

/** 条件表达式 */
interface Condition {
  /** 原始文本表达式 */
  expression: string;
  /** 解析后的 AST（解析失败时为 null） */
  ast: ConditionAST | null;
  /** 解析错误信息 */
  parseError?: string;
}

/** 条件 AST 节点类型 */
type ConditionAST =
  | ConditionComparison
  | ConditionLogicalAnd
  | ConditionLogicalOr
  | ConditionLogicalNot;

interface ConditionComparison {
  type: 'comparison';
  variable: string;                     // 变量名（支持点号访问: '角色.职业'）
  operator: ComparisonOperator;
  value: string | number | boolean;
}

type ComparisonOperator = '==' | '!=' | '>' | '<' | '>=' | '<=';

interface ConditionLogicalAnd {
  type: 'logical_and';
  left: ConditionAST;
  right: ConditionAST;
}

interface ConditionLogicalOr {
  type: 'logical_or';
  left: ConditionAST;
  right: ConditionAST;
}

interface ConditionLogicalNot {
  type: 'logical_not';
  operand: ConditionAST;
}

/** 变量副作用 */
interface SideEffect {
  variable: string;                     // 变量名（支持点号访问）
  operation: SideEffectOperation;
  value: unknown;                       // 值类型取决于变量类型
}

type SideEffectOperation = 'set' | 'add' | 'subtract' | 'append';

/** 源码位置 */
interface SourceLocation {
  startLine: number;                    // 1-based
  startColumn: number;                  // 1-based
  endLine: number;
  endColumn: number;
}

// ============================================================
// Validator 类型
// ============================================================

type DiagnosticLevel = 'error' | 'warning' | 'info';

interface Diagnostic {
  /** 错误编号: E001-E008, W001-W006, I001-I003 */
  code: string;
  level: DiagnosticLevel;
  /** 人类可读描述 */
  message: string;
  /** 源码位置 */
  location: SourceLocation;
  /** 关联的节点 fullId */
  nodeId?: string;
  /** 修复建议文本 */
  suggestion?: string;
  /** 一键修复动作 */
  quickFix?: QuickFix;
}

interface QuickFix {
  label: string;
  action: 'create-node' | 'add-variable' | 'add-default-option' | 'jump-to' | 'fix-format';
  payload: Record<string, unknown>;
}

interface DiagnosticCounts {
  errors: number;
  warnings: number;
  infos: number;
}

// ============================================================
// Exporter 类型
// ============================================================

type ExportFormat = 'json' | 'html' | 'txt' | 'godot' | 'unity' | 'unreal';

interface ExportConfig {
  format: ExportFormat;
  pretty?: boolean;
  includeDiagnostics?: boolean;
  targetEngine?: 'godot' | 'unity' | 'unreal';
  htmlTheme?: 'dark' | 'light';
  outputPath?: string;
  formatVersion?: string;              // schema 版本
}

interface ExportResult {
  success: boolean;
  content: string;
  fileName: string;
  warnings?: string[];
  errors?: string[];
}

interface IExporter {
  readonly format: ExportFormat;
  readonly extension: string;
  readonly mimeType: string;
  export(data: PlotFlowData, config: ExportConfig): ExportResult;
}

// ============================================================
// JSON 导出 Schema 类型（与 PRD §8.2 对齐）
// ============================================================

interface StoryJSON {
  $schema: string;
  meta: {
    plotflow: string;
    title: string;
    author?: string;
    engine?: string;
    exportedAt: string;
  };
  variables: Record<string, SerializedVariable>;
  chapters: SerializedChapter[];
}

interface SerializedVariable {
  type: string;
  default: unknown;
  scope: 'global' | 'chapter';
  values?: string[];
  fields?: Record<string, SerializedVariable>;
  chapter?: string;
}

interface SerializedChapter {
  id: string;
  title: string;
  nodes: SerializedNode[];
}

interface SerializedNode {
  id: string;
  chapterId: string;
  fullId: string;
  title: string;
  body: string[];
  options: SerializedOption[];
  position: { x: number; y: number };
  isRoot: boolean;
  isOrphan: boolean;
  isDeadEnd: boolean;
}

interface SerializedOption {
  index: number;
  text: string;
  targetNodeId: string;
  targetFullId: string;
  conditions: SerializedCondition | null;
  sideEffects: SerializedSideEffect[];
}

interface SerializedCondition {
  expression: string;
  ast: ConditionAST | null;
}

interface SerializedSideEffect {
  variable: string;
  operation: string;                   // 'set' | 'add' | 'subtract' | 'append'
  value: unknown;
}

// ============================================================
// Completion 类型
// ============================================================

type CompletionDimension = 'node-title' | 'option-text' | 'body-text' | 'variable-name';

interface CompletionContext {
  dimension: CompletionDimension;
  prefix: string;
  contextBefore: string;
  contextAfter?: string;
  currentNodeTitle?: string;
  existingOptions?: string[];
  availableVariables?: string[];
  cursorPosition: { line: number; column: number };
}

interface CompletionSuggestion {
  text: string;                         // 补全文本
  score: number;                        // 置信度分数
  source: 'baseline' | 'user' | 'imported' | 'variable';
  metadata?: {
    frequency?: number;
    dimension?: CompletionDimension;
  };
}

// ============================================================
// React Flow 类型
// ============================================================

type NodeStatus = 'normal' | 'orphan' | 'deadend' | 'error' | 'selected';

interface StoryFlowNode {
  id: string;
  type: 'storyNode';
  position: { x: number; y: number };
  data: {
    id: string;
    title: string;
    preview: string;
    optionCount: number;
    status: NodeStatus;
    isRoot: boolean;
    onClick: (id: string) => void;
    onDoubleClick: (id: string) => void;
  };
}

interface StoryFlowEdge {
  id: string;
  source: string;
  target: string;
  type: 'conditionEdge' | 'unconditionalEdge';
  data: {
    isConditional: boolean;
    conditionText?: string;
    optionIndex?: number;
  };
}

// ============================================================
// Electron / IPC 类型
// ============================================================

interface PlotFlowAPI {
  file: {
    open: () => Promise<{ filePath: string; content: string } | null>;
    save: (filePath: string, content: string) => Promise<{ success: boolean }>;
    saveAs: (content: string) => Promise<{ filePath: string } | null>;
    read: (filePath: string) => Promise<{ content: string }>;
    exists: (filePath: string) => Promise<boolean>;
    getRecent: () => Promise<RecentFileEntry[]>;
  };
  dialog: {
    showExport: (defaultName: string) => Promise<string | null>;
    showConfirm: (message: string) => Promise<boolean>;
  };
  on: (channel: string, callback: (...args: unknown[]) => void) => void;
  removeListener: (channel: string, callback: (...args: unknown[]) => void) => void;
}

interface RecentFileEntry {
  filePath: string;
  fileName: string;
  lastOpenedAt: string;                // ISO 8601
}

// ============================================================
// 引擎插件接口类型
// ============================================================

interface IEnginePlugin {
  readonly name: string;
  readonly engine: 'godot' | 'unity' | 'unreal';
  exportForEngine(data: PlotFlowData, config: EngineExportConfig): string;
  readEngineVariables?(projectPath: string): EngineVariable[];
  isInstalledInProject?(projectPath: string): boolean;
}

interface EngineExportConfig {
  projectPath: string;
  outputDir: string;
  includeRuntimeLibs?: boolean;
}

interface EngineVariable {
  name: string;
  type: string;
  defaultValue: unknown;
  description?: string;
}

// ============================================================
// Frontmatter 解析中间类型
// ============================================================

interface FrontmatterData {
  plotflow?: string;
  title?: string;
  author?: string;
  engine?: string;
  vars?: Record<string, unknown>;
}
```

---

## 7. 性能设计 `[V0.1]`

### 7.1 防抖策略详解

| 事件 | 防抖时间 | 理由 | 处理内容 |
|------|---------|------|---------|
| **编辑器内容变更** | **500ms** | Monaco 变更频繁（每次按键），500ms 是体感"停止输入"的时间点 | 全管线：解析 → 验证 → 分支图 → 补全 → 保存 |
| **补全触发** | **200ms** | 用户输入有停顿才触发，避免每次按键都计算 N-gram 匹配 | 检测触发上下文 → N-gram 预测 |
| **幽灵字符刷新** | 实时（无延迟） | 幽灵字符跟随光标显示，Tab 接受需要即时响应 | 显示/隐藏/替换 ghost text |
| **分支图拖拽** | **50ms** | 拖拽连线需要流畅反馈 | 预览连线 → 松手后才触发 AST 修改 |
| **自动保存** | **500ms** (独立计时器) | 与编辑器 debounce 共用同一个 timer，解析和保存一次完成 | 写入 .mdstory 文件 |

```typescript
// debounce-manager.ts
class DebounceManager {
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  debounce(key: string, fn: () => void, ms: number): void {
    const existing = this.timers.get(key);
    if (existing) clearTimeout(existing);

    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      fn();
    }, ms));
  }

  cancel(key: string): void {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  /** 编辑器变更: 立即执行一部分，延迟执行一部分 */
  onEditorChange(text: string): void {
    // 即时: 更新编辑器 store
    useEditorStore.getState().setRawMarkdown(text);
    useEditorStore.getState().markDirty();

    // 500ms 延迟: 全管线
    this.debounce('editor-parse', () => {
      const data = parsePlotFlow(text).data;
      useStoryStore.getState().setPlotFlowData(data);
      useValidatorStore.getState().validate(data, text);
      useGraphStore.getState().syncFromAST(data);

      // 同步诊断到 Monaco
      const model = useEditorStore.getState().monacoModel;
      if (model) {
        syncDiagnosticsToMonaco(model, useValidatorStore.getState().diagnostics, text);
      }

      // 自动保存
      const filePath = useUIStore.getState().activeFilePath;
      if (filePath) {
        window.plotflow.file.save(filePath, text);
      }
    }, 500);
  }
}
```

### 7.2 React Flow 虚拟化（200+ 节点）

```typescript
// 策略: 利用 React Flow 内置的节点可见性计算 + 自定义优化

// 1. React Flow 默认仅在视口内的节点渲染 DOM
//    → 通过 <ReactFlow onlyRenderVisibleElements={true} /> 启用

// 2. 超过 200 节点时自动启用折叠
//    → 同层节点超过 20 个时，水平折叠为 "N 个节点..." 群组

// 3. 布局缓存: Dagre 布局结果缓存，仅在节点增删时重新计算
let layoutCache: Map<string, { nodes: StoryFlowNode[]; edges: StoryFlowEdge[] }> = new Map();

function getOrComputeLayout(data: PlotFlowData): { nodes: StoryFlowNode[]; edges: StoryFlowEdge[] } {
  const key = hashPlotFlowData(data);  // 基于节点 ID 列表和连接关系的哈希
  if (layoutCache.has(key)) {
    return layoutCache.get(key)!;
  }
  const result = layoutNodes(data.chapters);
  layoutCache.set(key, result);

  // 限制缓存大小
  if (layoutCache.size > 10) {
    const firstKey = layoutCache.keys().next().value;
    layoutCache.delete(firstKey);
  }
  return result;
}

// 4. React Flow 渲染配置
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  onlyRenderVisibleElements={true}   // 仅渲染视口内节点
  minZoom={0.1}
  maxZoom={2.0}
  defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
  fitView={nodes.length <= 50}       // ≤50节点时初始 fitView
  fitViewOptions={{ padding: 0.2 }}
  proOptions={{ hideAttribution: true }}
>
  <Background />
  <Controls />
  <MiniMap
    nodeColor={getMiniMapColor}
    maskColor="rgba(0,0,0,0.2)"
  />
</ReactFlow>

// 5. 性能目标验证
//    200 节点 / 1000 选项 → ≥ 30fps
//    - 布局计算: < 100ms (Dagre 已知快)
//    - React Flow diff: < 50ms
//    - 总管线: parse(50ms) + layout(100ms) + render(50ms) = ~200ms
```

### 7.3 Monaco 大文件处理

```typescript
// Monaco Editor 默认对 10MB 以内的文件性能良好
// PlotFlow 的 .mdstory 文件通常远小于此（<500KB）

// 配置选项:
const monacoOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  // 禁用对超大文件不必要的功能
  wordWrap: 'on',                     // 自动换行，避免水平滚动
  minimap: { enabled: false },        // 关闭小地图（文本编辑器不需要）
  lineNumbers: 'on',
  renderWhitespace: 'selection',
  bracketPairColorization: { enabled: false },  // PlotFlow 语法不需要括号着色
  matchBrackets: 'never',             // 关闭括号匹配（减少开销）
  autoClosingBrackets: 'never',       // 自己管理 `[选项]` 的闭合
  folding: true,                      // 节点折叠
  foldingStrategy: 'indentation',     // 基于缩进折叠（节点块自然缩进）
  scrollBeyondLastLine: false,
  renderLineHighlight: 'line',
  cursorBlinking: 'smooth',
  fontSize: 14,
  fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
};

// 对于超过 1MB 的文件（极少情况）：
// 启用 Monaco 的 largeFileOptimizations
if (content.length > 1024 * 1024) {
  Object.assign(monacoOptions, {
    largeFileOptimizations: true,
    maxTokenizationLineLength: 1000,
    renderIndentGuides: false,
  });
}
```

### 7.4 补全引擎异步 Worker 设计

```typescript
// completion/completion-worker.ts
// 在 Web Worker 中运行 N-gram 引擎，避免阻塞 UI 线程

// 主线程 (Renderer):
class CompletionWorkerManager {
  private worker: Worker;
  private pendingRequests: Map<string, {
    resolve: (result: CompletionSuggestion[]) => void;
    reject: (error: Error) => void;
  }> = new Map();

  constructor() {
    // 使用 Vite 的 Worker 导入语法
    this.worker = new Worker(
      new URL('./completion-worker.ts', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, result, error } = event.data;
      const pending = this.pendingRequests.get(id);
      if (pending) {
        this.pendingRequests.delete(id);
        if (error) {
          pending.reject(new Error(error));
        } else {
          pending.resolve(result!);
        }
      }
    };
  }

  predict(context: CompletionContext): Promise<CompletionSuggestion[]> {
    return new Promise((resolve, reject) => {
      const id = nanoid();
      this.pendingRequests.set(id, { resolve, reject });

      this.worker.postMessage({
        type: 'predict',
        id,
        payload: context,
      } as WorkerRequest);

      // 200ms 超时
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          resolve([]);  // 超时返回空
        }
      }, 200);
    });
  }

  train(text: string, source: string): Promise<void> {
    return new Promise((resolve) => {
      const id = nanoid();
      this.pendingRequests.set(id, {
        resolve: () => resolve(),
        reject: () => resolve(),
      });

      this.worker.postMessage({
        type: 'train',
        id,
        payload: { text, source },
      });
    });
  }

  /** 初始化: 加载预置语料 */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const id = nanoid();
      this.pendingRequests.set(id, {
        resolve: () => resolve(),
        reject: (err) => reject(err),
      });

      this.worker.postMessage({
        type: 'initialize',
        id,
        payload: null,
      });
    });
  }

  terminate(): void {
    this.worker.terminate();
  }
}

// Worker 线程:
// completion/completion-worker.ts
interface WorkerRequest {
  type: 'predict' | 'train' | 'initialize' | 'prune' | 'shutdown';
  id: string;
  payload: unknown;
}

interface WorkerResponse {
  id: string;
  result?: CompletionSuggestion[] | null;
  error?: string;
}

let engine: NGramEngine | null = null;

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, id, payload } = event.data;

  try {
    switch (type) {
      case 'initialize': {
        // 加载预置语料（从 IndexedDB 或压缩二进制文件）
        const corpusData = await loadBaselineCorpus();
        engine = new NGramEngine();

        for (const item of corpusData) {
          engine.train(item.text, 'baseline');
        }
        (self as any).postMessage({ id, result: null });
        break;
      }

      case 'train': {
        const { text, source } = payload as { text: string; source: string };
        engine?.train(text, source as any);
        (self as any).postMessage({ id, result: null });
        break;
      }

      case 'predict': {
        if (!engine) {
          (self as any).postMessage({ id, result: [] });
          break;
        }
        const context = payload as CompletionContext;
        const suggestions = engine.predict(context);
        (self as any).postMessage({ id, result: suggestions });
        break;
      }

      case 'prune': {
        engine?.prune();
        (self as any).postMessage({ id, result: null });
        break;
      }

      case 'shutdown': {
        self.close();
        break;
      }
    }
  } catch (error) {
    (self as any).postMessage({ id, error: (error as Error).message });
  }
};
```

### 7.5 性能目标与监控

| 指标 | 目标值 | 测量方法 |
|------|--------|---------|
| **编辑器响应** | 输入到字符显示 < 16ms (60fps) | Monaco 内置指标 |
| **解析延迟** | 500ms debounce 后，解析 200 节点文件 < 100ms | `performance.now()` 打点 |
| **验证延迟** | 200 节点文件全量验证 < 50ms | `performance.now()` 打点 |
| **Dagre 布局** | 200 节点布局计算 < 100ms | `performance.now()` 打点 |
| **分支图 FPS** | 200 节点视口平移 ≥ 30fps | React DevTools Profiler |
| **补全响应** | Worker 计算 + 显示 < 200ms（含 200ms 超时） | Worker round-trip 计时 |
| **自动保存** | 文件写入 < 50ms（文本文件 < 500KB） | Node.js `fs.writeFile` 计时 |
| **启动时间** | 冷启动 < 3s（含 Electron 启动 + 语料加载） | 进程启动到首帧的时间 |
| **内存占用** | 200 节点文件编辑中 < 300MB | Chrome DevTools Memory |

---

## 附录 A: 依赖图谱

```
@plotflow/monorepo (pnpm workspace)
├── packages/app (Electron + React)
│   ├── dependencies:
│   │   ├── react@18.x
│   │   ├── react-dom@18.x
│   │   ├── reactflow@11.x
│   │   ├── @dagrejs/dagre@1.x
│   │   ├── monaco-editor@0.44+
│   │   ├── @monaco-editor/react@4.x
│   │   ├── zustand@4.x
│   │   ├── unified@11.x
│   │   ├── remark-parse@11.x
│   │   ├── js-yaml@4.x
│   │   ├── better-sqlite3@9.x (语料索引)
│   │   ├── radix-ui (无障碍原语)
│   │   └── nanoid@5.x
│   ├── devDependencies:
│   │   ├── electron@28.x
│   │   ├── electron-builder@24.x
│   │   ├── vite@5.x
│   │   ├── vite-plugin-electron@0.x
│   │   ├── vitest@1.x
│   │   ├── playwright@1.x
│   │   ├── typescript@5.x
│   │   ├── eslint@8.x
│   │   ├── prettier@3.x
│   │   └── @types/* ...
│
├── packages/parser (@plotflow/parser)
│   ├── dependencies:
│   │   ├── unified@11.x
│   │   ├── remark-parse@11.x
│   │   └── js-yaml@4.x
│   └── devDependencies:
│       ├── vitest@1.x
│       └── typescript@5.x
│
└── tests/
    └── fixtures/ (.mdstory 测试文件)
```

## 附录 B: 关键技术选型决策记录

| ADR | 决策 | 理由 |
|-----|------|------|
| ADR-001 | Electron 28 (非 Tauri) | Monaco 官方支持，React Flow 完全兼容，现有资产复用，V0.1 开发效率优先 |
| ADR-002 | React Flow + Dagre | MIT 协议，n8n/TypeForm 同款，可编辑节点图生态最成熟 |
| ADR-003 | Zustand (非 Redux) | 轻量，适合编辑器细粒度状态，TypeScript 推断友好，无 boilerplate |
| ADR-004 | unified + remark (非 marked) | 成熟 AST 生态，插件体系支持自定义语法扩展 |
| ADR-005 | Monarch Tokenizer (非 TextMate) | Monaco 原生声明式方案，开箱即用，TextMate 作为 V0.2 增强 |
| ADR-006 | better-sqlite3 (语料索引仅) | 仅用于补全语料元数据和索引，不存储 .mdstory 内容 |
| ADR-007 | N-gram 统计模型 (非 LLM) | 纯本地，隐私安全，无网络依赖，无需 GPU，5MB 语料即可工作 |
| ADR-008 | Web Worker 补全计算 | 避免阻塞 UI 线程，200ms 超时保证响应性 |
| ADR-009 | pnpm monorepo | 解析器独立为 @plotflow/parser 包，可被 Godot 插件直接引用 |

---

*本文档是 PlotFlow V0.1 的完整实现蓝图。所有模块、接口、数据流和类型定义均已显式定义。开发时以本文档为权威参考，与 PRD 冲突时以 PRD 为准。*
