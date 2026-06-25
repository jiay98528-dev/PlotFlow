/**
 * PlotFlow Zustand Stores — 统一导出入口
 *
 * Store 架构一览：
 * ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
 * │ useEditorStore │  │ useStoryStore │  │ useGraphStore │  │  useUIStore   │
 * │               │  │               │  │               │  │               │
 * │ isDirty        │  │ plotFlowData  │  │ nodes[]       │  │ theme         │
 * │ content        │  │ isParsing     │  │ edges[]       │  │ language      │
 * │ filePath       │  │ parseError    │  │ selectedNodeId│  │ statusMessage │
 * │ cursorPosition │  │               │  │ zoomLevel     │  │ ...           │
 * │ diagnostics[]  │  │               │  │ viewMode      │  │               │
 * └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘
 *         │                  │                  │                  │
 *         ▼                  ▼                  ▼                  ▼
 *    Monaco Editor      Parser (Core)    React Flow Graph     AppShell / Layout
 *
 * 单向数据流（TAD.md §2.2.3）：
 * Monaco change → useEditorStore.setContent()
 *   → Parser → useStoryStore.setPlotFlowData()
 *     → useGraphStore.setNodes/setEdges() + useEditorStore.setDiagnostics()
 *
 * @module stores
 */

export { useEditorStore } from './editorStore';
export type { EditorState, CursorPosition } from './editorStore';

export { useStoryStore } from './storyStore';
export type { StoryState } from './storyStore';

export { useGraphStore, ZOOM_CONSTRAINTS } from './graphStore';
export type { GraphState, ViewMode } from './graphStore';

export { useUIStore } from './uiStore';
export type { UIState, Language, RightPanel } from './uiStore';
