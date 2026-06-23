import React, { useCallback, useEffect } from 'react';
import {
  Database,
  Download,
  FilePlus2,
  Languages,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Sun,
} from 'lucide-react';
import { t } from '@plotflow/core';
import { MonacoEditor } from '../components/editor/MonacoEditor';
import { OutlinePanel } from '../components/layout/OutlinePanel';
import { GraphCanvas } from '../components/branch-graph/GraphCanvas';
import { ThemeProvider } from '../components/ThemeProvider';
import { NewFileDialog } from '../components/panels/NewFileDialog';
import { useEditorStore } from '../stores/editorStore';
import { useStoryStore } from '../stores/storyStore';
import { useGraphStore } from '../stores/graphStore';
import { useUIStore, type Language } from '../stores/uiStore';
import { useMenuEvents } from '../hooks/useMenuEvents';
import { useOutlineSync } from '../hooks/useOutlineSync';
import { ExportDialog } from '../components/panels/ExportDialog';
import { ConditionEditor } from '../components/panels/ConditionEditor';
import { StatusBar } from '../components/layout/StatusBar';
import { ProblemPanel } from '../components/panels/ProblemPanel';
import { CorpusManager } from '../components/panels/CorpusManager';
import { clearPendingSave, saveOrSaveAs } from '../services/autoSaveService';
import { parsePipelineNow } from '../services/parsePipeline';
import type { StoryFlowNodeData } from '../components/branch-graph/adapter';

// ============================================================================
// P0-5: 暴露给主进程的脏状态查询与强制保存接口
// ============================================================================
//
// 主进程通过 mainWindow.webContents.executeJavaScript 调用这些函数，
// 用于窗口关闭/应用退出时的脏状态检查与保存流程。
// 渲染进程通过 window.plotflow.dialog.confirm() 调用原生对话框处理
// 新建/打开文件时的脏状态确认。

window.__getEditorDirtyState__ = () => {
  const editor = useEditorStore.getState();
  return { isDirty: editor.isDirty, filePath: editor.filePath };
};

window.__forceSave__ = async () => {
  await saveOrSaveAs();
};

/**
 * PlotFlow Application Root
 *
 * M6 adds the product shell: template creation, theme switching and local i18n.
 * The parser/graph synchronization flow remains the same as M2/M3.
 */
export function App(): React.ReactElement {
  useMenuEvents();

  const { navigateToNode } = useOutlineSync();

  const theme = useUIStore((state) => state.theme);
  const language = useUIStore((state) => state.language);
  const openNewFileDialog = useUIStore((state) => state.openNewFileDialog);
  const closeNewFileDialog = useUIStore((state) => state.closeNewFileDialog);
  const isNewFileDialogOpen = useUIStore((state) => state.isNewFileDialogOpen);
  const isConditionEditorOpen = useUIStore((state) => state.isConditionEditorOpen);
  const toggleConditionEditor = useUIStore((state) => state.toggleConditionEditor);
  const conditionEditorNodeId = useUIStore((state) => state.conditionEditorNodeId);
  const conditionEditorOptionIndex = useUIStore((state) => state.conditionEditorOptionIndex);
  const openExportDialog = useUIStore((state) => state.openExportDialog);
  const openCorpusManager = useUIStore((state) => state.openCorpusManager);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  const setLanguage = useUIStore((state) => state.setLanguage);
  const activeRightPanel = useUIStore((state) => state.activeRightPanel);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);

  const viewMode = useGraphStore((state) => state.viewMode);
  const toggleViewMode = useGraphStore((state) => state.toggleViewMode);

  // storyStore → graphStore 安全网（parsePipeline 已直接调用 syncFromAST，
  // 此处仅处理直接调用 setPlotFlowData 的旁路路径）
  useEffect(() => {
    const unsubscribe = useStoryStore.subscribe(
      (state, prevState) => {
        if (state.plotFlowData !== prevState.plotFlowData) {
          if (!useGraphStore.getState().isEditing) {
            useGraphStore.getState().syncFromAST(state.plotFlowData);
          }
        }
      },
    );

    return () => { unsubscribe(); };
  }, []);

  // P0-1: graphStore.selectedNodeId → editorStore 单向同步
  // 分支图节点选中时自动联动大纲高亮与光标位置
  // 订阅放在 App.tsx 全局层确保不受 GraphCanvas 条件渲染（minimap/split 切换）影响
  useEffect(() => {
    const unsubscribe = useGraphStore.subscribe(
      (state) => state.selectedNodeId,
      (selectedNodeId, prevSelectedNodeId) => {
        if (selectedNodeId === prevSelectedNodeId) return;
        if (useGraphStore.getState().isEditing) return; // 连线拖拽等操作中跳过

        if (!selectedNodeId) {
          useEditorStore.getState().setActiveNodeId(null);
          return;
        }

        const node = useGraphStore.getState().nodes.find((n) => n.id === selectedNodeId);
        const nodeData = node?.data as StoryFlowNodeData | undefined;
        if (nodeData?.fullId && nodeData?.lineNumber) {
          useEditorStore.getState().setActiveNodeId(nodeData.fullId);
          useEditorStore.getState().setCursorPosition(nodeData.lineNumber, 1);
        }
      },
    );

    return unsubscribe;
  }, []);

  // P0: isEditing 锁释放 → 自动重解析（防止编辑锁期间的内容变更丢失）
  useEffect(() => {
    const unsub = useGraphStore.subscribe(
      (s) => s.isEditing,
      (editing, wasEditing) => {
        if (wasEditing && !editing) {
          const content = useEditorStore.getState().content;
          if (content) {
            parsePipelineNow(content);
          }
        }
      },
    );
    return unsub;
  }, []);

  // P0-6: 挂载时检查系统双击/命令行传入的待打开文件 (M7-08)
  // 窗口首次挂载时调用 getPendingOpenFile()，消费文件打开系统事件。
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!window.plotflow?.file?.getPendingOpenFile) return;

      const pending = await window.plotflow.file.getPendingOpenFile();
      if (!pending || cancelled) return;

      const { filePath, content } = pending;
      const editor = useEditorStore.getState();

      // P0-5: 文件打开前检查是否有未保存的更改
      if (editor.isDirty) {
        const choice = await window.plotflow.dialog.confirm({
          type: 'warning',
          message: '放弃未保存的更改？',
          detail: editor.filePath
            ? `"${editor.filePath}" 有未保存的修改。打开新文件前是否保存？`
            : '未命名的文件有未保存的修改。打开新文件前是否保存？',
          buttons: ['保存并打开', '不保存并打开', '取消'],
        });

        if (cancelled) return;

        if (choice === 0) {
          await saveOrSaveAs();
        } else if (choice === 2) {
          return; // 取消打开
        }
        // choice === 1: 不保存，继续打开
      }

      if (cancelled) return;

      clearPendingSave();
      const freshEditor = useEditorStore.getState();
      freshEditor.setFilePath(filePath);
      freshEditor.setDiagnostics([]);
      freshEditor.setActiveNodeId(null);
      freshEditor.setCursorPosition(1, 1);
      useStoryStore.getState().clearParseData();
      useGraphStore.getState().syncFromAST(null);
      freshEditor.setContent(content);
      freshEditor.markSaved();
      parsePipelineNow(content);
      setStatusMessage(`已打开: ${filePath}`);
    })();

    return () => {
      cancelled = true;
    };
  }, [setStatusMessage]);

  // P0-6: 运行时监听系统文件打开通知（应用已运行，用户双击 .mdstory 文件时触发）
  useEffect(() => {
    if (!window.plotflow?.file?.onSystemOpenFile) return;

    const cleanup = window.plotflow.file.onSystemOpenFile(async (filePath: string) => {
      const editor = useEditorStore.getState();

      // P0-5: 文件打开前检查是否有未保存的更改
      if (editor.isDirty) {
        const choice = await window.plotflow.dialog.confirm({
          type: 'warning',
          message: '放弃未保存的更改？',
          detail: editor.filePath
            ? `"${editor.filePath}" 有未保存的修改。打开新文件前是否保存？`
            : '未命名的文件有未保存的修改。打开新文件前是否保存？',
          buttons: ['保存并打开', '不保存并打开', '取消'],
        });

        if (choice === 0) {
          await saveOrSaveAs();
        } else if (choice === 2) {
          return; // 取消打开
        }
        // choice === 1: 不保存，继续打开
      }

      // 通过 IPC 读取文件内容
      if (!window.plotflow?.file?.readByPath) {
        setStatusMessage('读取文件失败: IPC 接口不可用');
        return;
      }

      const result = await window.plotflow.file.readByPath(filePath);
      if (!result) {
        setStatusMessage(`无法读取文件: ${filePath}`);
        return;
      }

      clearPendingSave();
      const freshEditor = useEditorStore.getState();
      freshEditor.setFilePath(result.filePath);
      freshEditor.setDiagnostics([]);
      freshEditor.setActiveNodeId(null);
      freshEditor.setCursorPosition(1, 1);
      useStoryStore.getState().clearParseData();
      useGraphStore.getState().syncFromAST(null);
      freshEditor.setContent(result.content);
      freshEditor.markSaved();
      parsePipelineNow(result.content);
      setStatusMessage(`已打开: ${result.filePath}`);
    });

    return cleanup;
  }, [setStatusMessage]);

  const handleTemplateSelected = useCallback(
    async (template: string, meta: { readonly title: string; readonly author: string }) => {
      const editor = useEditorStore.getState();

      // P0-5: 新建模板前检查是否有未保存的更改
      if (editor.isDirty) {
        const choice = await window.plotflow.dialog.confirm({
          type: 'warning',
          message: '放弃未保存的更改？',
          detail: editor.filePath
            ? `"${editor.filePath}" 有未保存的修改。创建新文件前是否保存？`
            : '未命名的文件有未保存的修改。创建新文件前是否保存？',
          buttons: ['保存并新建', '不保存并新建', '取消'],
        });

        if (choice === 0) {
          await saveOrSaveAs();
        } else if (choice === 2) {
          return; // 取消新建
        }
        // choice === 1: 不保存，继续新建
      }

      clearPendingSave();
      // 重新获取最新的 editor 引用（saveOrSaveAs 可能已更新状态）
      const freshEditor = useEditorStore.getState();
      freshEditor.setFilePath(null);
      freshEditor.setDiagnostics([]);
      freshEditor.setActiveNodeId(null);
      freshEditor.setCursorPosition(1, 1);
      useStoryStore.getState().clearParseData();
      useGraphStore.getState().syncFromAST(null);
      freshEditor.setContent(template);
      parsePipelineNow(template);
      setStatusMessage(`新建: ${meta.title}`);
    },
    [setStatusMessage],
  );

  const handleLanguageChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setLanguage(event.target.value as Language);
    },
    [setLanguage],
  );

  useEffect(() => {
    if (!window.plotflow?.env?.isTest) {
      return undefined;
    }

    window.__test_store__ = {
      getEditorContent: () => useEditorStore.getState().content,
      setEditorContent: (content: string) => {
        clearPendingSave();

        const editor = useEditorStore.getState();
        editor.setDiagnostics([]);
        editor.setActiveNodeId(null);
        editor.setCursorPosition(1, 1);

        useStoryStore.getState().clearParseData();
        useGraphStore.getState().syncFromAST(null);

        editor.setContent(content);
        parsePipelineNow(content);
      },
      openConditionEditor: (nodeId: string, optionIndex: number) => {
        useUIStore.getState().openConditionEditor(nodeId, optionIndex);
      },
      getUIState: () => {
        const state = useUIStore.getState();
        return {
          isConditionEditorOpen: state.isConditionEditorOpen,
          conditionEditorNodeId: state.conditionEditorNodeId,
          conditionEditorOptionIndex: state.conditionEditorOptionIndex,
          activeRightPanel: state.activeRightPanel,
          isExportDialogOpen: state.isExportDialogOpen,
          isNewFileDialogOpen: state.isNewFileDialogOpen,
        };
      },
    };

    return () => {
      delete window.__test_store__;
    };
  }, []);

  const showSplitGraph = activeRightPanel === 'graph' && viewMode === 'split';
  const showMinimap = activeRightPanel === 'graph' && viewMode === 'minimap';
  const graphModeLabel =
    viewMode === 'split' ? t('toolbar.graphSplit') : t('toolbar.graphMinimap');
  const themeLabel = theme === 'dark' ? t('toolbar.themeDark') : t('toolbar.themeLight');

  return (
    <ThemeProvider>
      <div className="app-shell">
        <header className="app-topbar">
          <div className="app-topbar__brand">
            <span className="app-logo" aria-hidden="true">
              Pf
            </span>
            <div>
              <h1 className="app-title">PlotFlow V0.1</h1>
              <p className="app-subtitle">{t('statusBar.phase')}</p>
            </div>
          </div>

          <nav className="app-toolbar" aria-label="PlotFlow toolbar">
            <div className="toolbar-group" role="group" aria-label={t('menu.file')}>
              <button type="button" className="button button--primary" onClick={openNewFileDialog}>
                <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} />
                <span>{t('toolbar.newFile')}</span>
              </button>
              <button type="button" className="toolbar-button" onClick={() => openExportDialog()}>
                <Download aria-hidden="true" size={15} strokeWidth={2} />
                <span>{t('toolbar.export')}</span>
              </button>
            </div>

            <div className="toolbar-group" role="group" aria-label={t('menu.view')}>
              <button type="button" className="toolbar-button" onClick={openCorpusManager}>
                <Database aria-hidden="true" size={15} strokeWidth={2} />
                <span>{t('toolbar.corpus')}</span>
              </button>
              <button
                type="button"
                className={`toolbar-button toolbar-button--state${viewMode === 'split' ? ' is-active' : ''}`}
                onClick={toggleViewMode}
                title={viewMode === 'split' ? t('toolbar.graphMinimap') : t('toolbar.graphSplit')}
                aria-pressed={viewMode === 'split'}
              >
                {viewMode === 'split' ? (
                  <PanelRightClose aria-hidden="true" size={15} strokeWidth={2} />
                ) : (
                  <PanelRightOpen aria-hidden="true" size={15} strokeWidth={2} />
                )}
                <span>{t('toolbar.graph')}</span>
                <span className="toolbar-button__meta">{graphModeLabel}</span>
              </button>
            </div>

            <div className="toolbar-group" role="group" aria-label={t('toolbar.preferences')}>
              <button
                type="button"
                className="toolbar-button toolbar-button--state"
                onClick={toggleTheme}
                title={themeLabel}
                aria-pressed={theme === 'dark'}
              >
                {theme === 'dark' ? (
                  <Moon aria-hidden="true" size={15} strokeWidth={2} />
                ) : (
                  <Sun aria-hidden="true" size={15} strokeWidth={2} />
                )}
                <span>{themeLabel}</span>
              </button>
              <label className="toolbar-select">
                <Languages aria-hidden="true" size={15} strokeWidth={2} />
                <span className="visually-hidden">{t('toolbar.language')}</span>
                <select
                  className="language-select"
                  aria-label={t('toolbar.language')}
                  value={language}
                  onChange={handleLanguageChange}
                >
                  <option value="zh-CN">中文</option>
                  <option value="en-US">English</option>
                </select>
              </label>
            </div>
          </nav>
        </header>

        <div className="app-main">
          <OutlinePanel onNodeClick={navigateToNode} />

          <main className="editor-pane">
            <MonacoEditor />
          </main>

          {showSplitGraph && (
            <aside className="graph-pane" aria-label={t('toolbar.graph')}>
              <GraphCanvas viewMode="split" />
            </aside>
          )}
        </div>

        {showMinimap && (
          <div className="minimap-shell" aria-label="PlotFlow minimap">
            <GraphCanvas viewMode="minimap" />
          </div>
        )}

        {isConditionEditorOpen && (
          <ConditionEditor
            onClose={toggleConditionEditor}
            nodeId={conditionEditorNodeId ?? undefined}
            optionIndex={conditionEditorOptionIndex ?? undefined}
          />
        )}
        <ExportDialog />
        <ProblemPanel />
        <CorpusManager />

        {isNewFileDialogOpen && (
          <NewFileDialog
            onClose={closeNewFileDialog}
            onTemplateSelected={handleTemplateSelected}
          />
        )}

        <StatusBar />
      </div>
    </ThemeProvider>
  );
}
