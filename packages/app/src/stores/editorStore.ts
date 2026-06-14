/**
 * useEditorStore — 编辑器状态管理
 *
 * 职责：管理 Monaco 编辑器的运行时状态，包括文本内容、光标位置、
 * 文件路径、脏标记和诊断信息。
 *
 * 对应 TAD.md §2.2.2 EditorState 接口定义。
 *
 * @module stores/editorStore
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type * as monaco from 'monaco-editor';
import type { Diagnostic } from '@plotflow/core';

// ============================================================================
// 类型定义
// ============================================================================

/** 光标位置 */
export interface CursorPosition {
  readonly line: number;
  readonly column: number;
}

/** 编辑器状态 */
export interface EditorState {
  /** 自上次保存后是否有未保存的修改 */
  readonly isDirty: boolean;

  /** 编辑器当前文本内容 */
  readonly content: string;

  /** 当前打开文件的绝对路径（null 表示新建未保存文件） */
  readonly filePath: string | null;

  /** 当前光标位置（1-based 行号/列号） */
  readonly cursorPosition: CursorPosition;

  /** 语法检查诊断信息列表（来自 Validator） */
  readonly diagnostics: Diagnostic[];

  /** 大纲当前高亮的节点 fullId（编辑器和光标联动） */
  readonly activeNodeId: string | null;

  /** Monaco Editor 实例引用（M0 为 null，M1 注入后供 useOutlineSync 等 Hook 使用） */
  readonly editorInstance: monaco.editor.IStandaloneCodeEditor | null;

  // --- Actions ---

  /** 设置编辑器文本内容，同时标记为脏状态 */
  setContent: (content: string) => void;

  /** 标记为已保存（清除脏状态） */
  markSaved: () => void;

  /** 设置当前文件路径 */
  setFilePath: (path: string | null) => void;

  /** 设置光标位置 */
  setCursorPosition: (line: number, column: number) => void;

  /** 设置诊断信息列表 */
  setDiagnostics: (diagnostics: Diagnostic[]) => void;

  /** 设置大纲当前高亮节点 */
  setActiveNodeId: (id: string | null) => void;

  /** 设置 Monaco Editor 实例引用（M1 阶段调用） */
  setEditorInstance: (editor: monaco.editor.IStandaloneCodeEditor | null) => void;

  /** 重置编辑器状态到初始值 */
  reset: () => void;
}

// ============================================================================
// 初始状态
// ============================================================================

const initialState = {
  isDirty: false,
  content: '',
  filePath: null,
  cursorPosition: { line: 1, column: 1 },
  diagnostics: [],
  activeNodeId: null,
  editorInstance: null,
} as const satisfies Omit<EditorState, 'setContent' | 'markSaved' | 'setFilePath' | 'setCursorPosition' | 'setDiagnostics' | 'setActiveNodeId' | 'setEditorInstance' | 'reset'>;

// ============================================================================
// Store
// ============================================================================

export const useEditorStore = create<EditorState>()(
  devtools(
    (set) => ({
      // --- 初始状态 ---
      ...initialState,

      // --- Actions ---

      setContent: (content: string) =>
        set(
          { content, isDirty: true },
          false,
          'editor/setContent',
        ),

      markSaved: () =>
        set(
          { isDirty: false },
          false,
          'editor/markSaved',
        ),

      setFilePath: (path: string | null) =>
        set(
          { filePath: path },
          false,
          'editor/setFilePath',
        ),

      setCursorPosition: (line: number, column: number) =>
        set(
          { cursorPosition: { line, column } },
          false,
          'editor/setCursorPosition',
        ),

      setDiagnostics: (diagnostics: Diagnostic[]) =>
        set(
          { diagnostics },
          false,
          'editor/setDiagnostics',
        ),

      setActiveNodeId: (id: string | null) =>
        set(
          { activeNodeId: id },
          false,
          'editor/setActiveNodeId',
        ),

      setEditorInstance: (editor: monaco.editor.IStandaloneCodeEditor | null) =>
        set(
          { editorInstance: editor },
          false,
          'editor/setEditorInstance',
        ),

      reset: () =>
        set(
          { ...initialState },
          false,
          'editor/reset',
        ),
    }),
    { name: 'EditorStore' },
  ),
);
