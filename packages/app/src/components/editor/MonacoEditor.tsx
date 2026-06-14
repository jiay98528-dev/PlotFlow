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
import { debouncedSave } from '../../services/autoSaveService';
import { debouncedParsePipeline, parsePipelineNow } from '../../services/parsePipeline';
import { initMonacoEditor, applyDiagnostics, clearDiagnostics } from '../../editor/setupEditor';

export function MonacoEditor(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const filePathRef = useRef<string | null>(null);

  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const filePath = useEditorStore((s) => s.filePath);
  const diagnostics = useEditorStore((s) => s.diagnostics);
  const setEditorInstance = useEditorStore((s) => s.setEditorInstance);

  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);

  // ── 初始化 Monaco 编辑器 ──
  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) return;

    initMonacoEditor(container, content).then((editor) => {
      if (disposed) {
        editor.dispose();
        return;
      }
      editorRef.current = editor;
      setEditorInstance(editor);

      // 内容变更 → store + pipeline
      editor.onDidChangeModelContent(() => {
        const newContent = editor.getValue();
        setContent(newContent);

        // M2-09: 操作锁检查
        if (useGraphStore.getState().isEditing) return;

        debouncedParsePipeline(newContent);
        debouncedSave(newContent, filePathRef.current);
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
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== content) {
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

  // ── 文件打开时触发解析管线 ──
  const prevFilePath = useRef(filePath);
  useEffect(() => {
    if (filePath && filePath !== prevFilePath.current) {
      prevFilePath.current = filePath;
      if (content) parsePipelineNow(content);
    }
  }, [filePath, content]);

  // ── 全局 Ctrl+S ──
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // forceSave 由 autoSaveService 处理
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
