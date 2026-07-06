/**
 * Monaco Editor 组件 — M1 起升级为真实 Monaco 实例
 *
 * M0: textarea 占位
 * M1: 注入 Monarch tokenizer + 7 色语法高亮 + 自动闭合 + 折叠
 * M2: 连接解析管线 (parse → validate → syncFromAST)
 * M3: 诊断装饰器 (波浪线 + 侧标 + Tooltip)
 *
 * 快捷键：
 * - Ctrl+S 由主进程菜单 accelerator (menu.ts) 捕获并发送 IPC 事件
 */

import React, { useCallback, useEffect, useRef } from 'react';
import type * as monaco from 'monaco-editor';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useUIStore } from '../../stores/uiStore';
import { debouncedSave, saveOrSaveAs } from '../../services/autoSaveService';
import { debouncedParsePipeline, parsePipelineNow } from '../../services/parsePipeline';
import {
  initMonacoEditor,
  applyDiagnostics,
  clearDiagnostics,
  THEME_DARK,
  THEME_LIGHT,
} from '../../editor/setupEditor';
import { getThemeOrDefault } from '../../theme-platform/registry';

export function MonacoEditor(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const filePathRef = useRef<string | null>(null);

  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const filePath = useEditorStore((s) => s.filePath);
  const diagnostics = useEditorStore((s) => s.diagnostics);
  const setEditorInstance = useEditorStore((s) => s.setEditorInstance);

  // V02-033: isEditing 锁自动恢复 — 拖拽连线期间管线被阻塞，锁释放后自动重解析
  const isEditing = useGraphStore((s) => s.isEditing);
  const isEditingPrevRef = useRef(isEditing);
  const hasPendingParseRef = useRef(false);

  // 追踪内容变更来源：true=用户编辑器中输入，false=外部（文件打开/模板新建）
  const isUserEditRef = useRef(false);

  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);

  // ── 初始化 Monaco 编辑器 ──
  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;

    // 读取当前主题，确保冷启动时 Monaco 编辑器主题与 app 主题一致
    const activeThemeId = useUIStore.getState().activeThemeId;
    const activeTheme = getThemeOrDefault(activeThemeId);
    const monacoTheme = activeTheme.defaultMode === 'dark' ? THEME_DARK : THEME_LIGHT;

    initMonacoEditor(container, content, monacoTheme).then((editor) => {
      if (disposed) {
        editor.dispose();
        return;
      }
      editorRef.current = editor;
      setEditorInstance(editor);

      // 内容变更 → store + pipeline
      editor.onDidChangeModelContent(() => {
        const newContent = editor.getValue();
        // 标记为编辑器内用户操作（阻止 useEffect 覆盖为旧内容）
        isUserEditRef.current = true;
        setContent(newContent);

        debouncedSave(newContent, filePathRef.current);

        // M2-09: 操作锁检查 — 仅阻挡解析管线，auto-save 不受限
        // V02-033: 标记待解析，锁释放后自动重解析
        if (useGraphStore.getState().isEditing) {
          hasPendingParseRef.current = true;
          return;
        }

        hasPendingParseRef.current = false;
        debouncedParsePipeline(newContent);
      });

      // 初始解析 — 用 store 最新值而非闭包（解决异步竞态）
      const latestContent = useEditorStore.getState().content;
      if (latestContent) {
        parsePipelineNow(latestContent);
      }
    });

    return () => {
      disposed = true;
      if (editorRef.current) {
        editorRef.current.dispose();
        editorRef.current = null;
        setEditorInstance(null);
      }
    };
  }, []); // 仅挂载时初始化 — 刻意不依赖 content 避免重建编辑器

  // ── 外部内容变更（打开文件 / 模板新建）→ Monaco Model ──
  // Graph context menu operations use editorInstance.executeEdits() directly,
  // flowing through onDidChangeModelContent -> setContent() to keep store in sync.
  // This useEffect only fires on file-open / template-new where
  // editor.setValue() clearing the old file's undo stack is correct behavior.
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const editorValue = editor.getValue();

    // 若内容变更来源于编辑器自身且 Monaco 已经是同一份内容，不覆盖编辑器状态。
    // 外部测试桥、文件打开和模板切换可能紧跟在用户编辑之后；若内容不同，仍必须同步。
    if (isUserEditRef.current && editorValue === content) {
      isUserEditRef.current = false;
      return;
    }
    isUserEditRef.current = false;

    // 外部内容变更（打开文件 / 模板新建）→ 同步到 Monaco
    if (editorValue !== content) {
      editor.setValue(content);
      if (content) {
        parsePipelineNow(content);
      } else {
        clearDiagnostics(editor);
      }
    }
  }, [content]);

  // ── 诊断装饰器 ──
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (diagnostics.length > 0) {
      applyDiagnostics(editor, diagnostics);
    } else {
      clearDiagnostics(editor);
    }
  }, [diagnostics]);

  // ── isEditing 锁自动恢复：连线拖拽结束后重解析 (V02-033) ──
  useEffect(() => {
    const wasEditing = isEditingPrevRef.current;
    isEditingPrevRef.current = isEditing;

    if (wasEditing && !isEditing && hasPendingParseRef.current) {
      // 操作锁刚刚释放，且期间有编辑器变更 → 立即重新解析
      hasPendingParseRef.current = false;
      const editor = editorRef.current;
      if (editor) {
        const currentContent = editor.getValue();
        if (currentContent) {
          parsePipelineNow(currentContent);
        }
      }
    }
  }, [isEditing]);

  // ── 文件打开时触发解析管线 ──
  const prevFilePath = useRef(filePath);
  useEffect(() => {
    if (filePath && filePath !== prevFilePath.current) {
      prevFilePath.current = filePath;
      if (content) parsePipelineNow(content);
    }
  }, [filePath, content]);

  // ── 全局 Ctrl+S（阻止浏览器默认保存对话框） ──
  // 实际写入由 Electron 菜单 accelerator 通过 IPC menu:file:save 触发，
  // 最终调用 autoSaveService.forceSave()。此处仅 preventDefault 防止
  // 浏览器弹出"保存网页"对话框干扰编辑器操作。
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveOrSaveAs();
      }
    },
    [],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}
