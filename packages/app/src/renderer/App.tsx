import React, { useCallback, useEffect } from 'react';
import {
  Database,
  Download,
  FilePlus2,
  FileText,
  GitBranch,
  Home,
  Languages,
  Palette,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { MonacoEditor } from '../components/editor/MonacoEditor';
import { OutlinePanel } from '../components/layout/OutlinePanel';
import { GraphCanvas } from '../components/branch-graph/GraphCanvas';
import { GraphLabWorkspace } from '../components/graph-lab/GraphLabWorkspace';
import { ThemeProvider } from '../components/ThemeProvider';
import { useThemePlatform } from '../components/ThemePlatformProvider';
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
import { ThemeCenter } from '../components/panels/ThemeCenter';
import { HomeSurface } from '../components/home/HomeSurface';
import {
  applyExternalFileContent,
  hasCurrentStoryUnsavedChanges,
  overwritePendingExternalChange,
  prepareCurrentStoryForDestructiveExit,
  saveAsCurrentFile,
  saveOrSaveAs,
} from '../services/autoSaveService';
import { parsePipelineNow } from '../services/parsePipeline';
import { startUnsavedStorySession } from '../services/storySessionService';
import { runStoryReplacement } from '../services/storyTransactionService';
import { requestExportDialog } from '../services/exportSnapshotService';
import { isGraphShortcutBlocked } from '../services/graphKeyboardGuard';
import type { StoryFlowNodeData } from '../components/branch-graph/adapter';
import { useAppText } from '../i18n/appI18n';
import {
  requestWorkspaceMode,
  toggleRequestedWorkspaceMode,
} from '../services/workspaceModeService';
import type { PendingOpenFileResult } from '../types/electron';
import { createOrderedAsyncDispatcher } from '../shared/orderedAsyncDispatcher';
import { BrandLockup } from '../components/brand/BrandLockup';
import { FeedbackDialogHost } from '../components/feedback/FeedbackDialog';
import { createLatestOnlyExternalChangeCoordinator } from '../services/externalChangeCoordinator';

// ============================================================================
// 暴露给主进程的脏状态查询与保存接口。
// ============================================================================
//
// 主进程在窗口关闭或应用退出时调用这些函数；渲染进程继续复用现有
// 原生确认框处理未保存故事。

window.__getEditorDirtyState__ = () => {
  const editor = useEditorStore.getState();
  return { isDirty: hasCurrentStoryUnsavedChanges(), filePath: editor.filePath };
};

window.__forceSave__ = async () => {
  return saveOrSaveAs();
};

window.__prepareDiscard__ = async () => prepareCurrentStoryForDestructiveExit();

function normalizeStoryPath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * PlotFlow Application Root
 *
 * M6 adds the product shell: template creation, theme switching and local i18n.
 * The parser/graph synchronization flow remains the same as M2/M3.
 */
export function App(): React.ReactElement {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent(): React.ReactElement {
  useMenuEvents();

  const { navigateToNode } = useOutlineSync();

  const language = useUIStore((state) => state.language);
  const openNewFileDialog = useUIStore((state) => state.openNewFileDialog);
  const closeNewFileDialog = useUIStore((state) => state.closeNewFileDialog);
  const isNewFileDialogOpen = useUIStore((state) => state.isNewFileDialogOpen);
  const isConditionEditorOpen = useUIStore((state) => state.isConditionEditorOpen);
  const toggleConditionEditor = useUIStore((state) => state.toggleConditionEditor);
  const conditionEditorNodeId = useUIStore((state) => state.conditionEditorNodeId);
  const conditionEditorOptionIndex = useUIStore((state) => state.conditionEditorOptionIndex);
  const openCorpusManager = useUIStore((state) => state.openCorpusManager);
  const openThemeCenter = useUIStore((state) => state.openThemeCenter);
  const setHomeSurfaceOpen = useUIStore((state) => state.setHomeSurfaceOpen);
  const setLanguage = useUIStore((state) => state.setLanguage);
  const activeRightPanel = useUIStore((state) => state.activeRightPanel);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const workspaceMode = useUIStore((state) => state.workspaceMode);
  const text = useAppText();

  const viewMode = useGraphStore((state) => state.viewMode);
  const toggleViewMode = useGraphStore((state) => state.toggleViewMode);

  // storyStore → graphStore 安全网：覆盖绕过 parsePipeline 直接发布 AST 的路径。
  useEffect(() => {
    const unsubscribe = useStoryStore.subscribe((state, prevState) => {
      if (state.plotFlowData !== prevState.plotFlowData) {
        if (!useGraphStore.getState().isEditing) {
          const projection = useGraphStore.getState().syncFromAST(state.plotFlowData);
          if (!projection.ok) {
            setStatusMessage(text('parse.graphRenderFailed'));
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [setStatusMessage, text]);

  // graphStore.selectedNodeId → editorStore 单向同步。
  // 全局订阅不受 GraphCanvas 条件渲染和视图切换影响。
  useEffect(() => {
    const unsubscribe = useGraphStore.subscribe(
      (state) => state.selectedNodeId,
      (selectedNodeId, prevSelectedNodeId) => {
        if (selectedNodeId === prevSelectedNodeId) return;
        if (useGraphStore.getState().isEditing) return; // 连线拖拽期间跳过联动。

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

  // 操作锁释放后立即重解析，避免锁期间的源码变化丢失。
  useEffect(() => {
    const unsub = useGraphStore.subscribe(
      (s) => s.isEditing,
      (editing, wasEditing) => {
        if (wasEditing && !editing) {
          const content = useEditorStore.getState().content;
          parsePipelineNow(content);
        }
      },
    );
    return unsub;
  }, []);

  // 首次挂载时消费系统双击传入的待打开文件。
  useEffect(() => {
    let cancelled = false;
    const consume = async (result: PendingOpenFileResult): Promise<void> => {
      if (cancelled || result.status === 'none') return;
      if (result.status === 'error') {
        setStatusMessage(text('file.pendingOpenFailed', { path: result.path, code: result.code }));
        return;
      }
      const normalizedPath = normalizeStoryPath(result.story.filePath);
      const replacement = await runStoryReplacement('open', async () => ({
        kind: 'saved',
        filePath: normalizedPath,
        content: result.story.content,
        hash: result.story.hash,
        modifiedAt: result.story.modifiedAt,
        closeHome: true,
      }));
      if (cancelled || replacement.status !== 'committed') return;
      setHomeSurfaceOpen(false);
      setStatusMessage(text('status.opened', { path: normalizedPath }));
    };
    const dispatcher = createOrderedAsyncDispatcher(consume);
    const enqueue = (result: PendingOpenFileResult): void => {
      void dispatcher.enqueue(result);
    };

    const cleanup = window.plotflow?.file?.onSystemOpenFile?.(enqueue);
    void window.plotflow?.file?.getPendingOpenFile?.().then(enqueue);

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [setHomeSurfaceOpen, setStatusMessage, text]);

  // 运行时监听当前 .mdstory 的外部磁盘变化。
  useEffect(() => {
    if (!window.plotflow?.file?.onExternalChange) return;

    const coordinator = createLatestOnlyExternalChangeCoordinator({
      getLease: () => {
        const editor = useEditorStore.getState();
        return {
          storySessionId: editor.storySessionId,
          filePath: editor.filePath ? normalizeStoryPath(editor.filePath) : null,
        };
      },
      hasUnsavedChanges: hasCurrentStoryUnsavedChanges,
      isCurrentFile: (filePath) => {
        const currentPath = useEditorStore.getState().filePath;
        return (
          currentPath !== null && normalizeStoryPath(currentPath) === normalizeStoryPath(filePath)
        );
      },
      setPending: (event) => useEditorStore.getState().setPendingExternalChange(event),
      confirm: (event) =>
        window.plotflow.dialog.confirm({
          type: 'warning',
          message: text('appShell.externalChangeTitle'),
          detail: text('appShell.externalChangeDetail', { path: event.filePath }),
          buttons: [
            text('appShell.saveCopy'),
            text('appShell.reloadDisk'),
            text('appShell.overwriteDisk'),
            text('appShell.keepEditing'),
          ],
        }),
      reload: async (event) => {
        if (await applyExternalFileContent(event)) {
          setStatusMessage(text('appShell.externalReloaded', { path: event.filePath }));
        }
      },
      overwrite: async (event) => {
        await overwritePendingExternalChange(event);
      },
      saveCopy: async () => {
        if (await saveAsCurrentFile()) setStatusMessage(text('appShell.copySaved'));
      },
      showPending: () => setStatusMessage(text('appShell.externalPending')),
    });

    const cleanup = window.plotflow.file.onExternalChange((event) => {
      void coordinator.enqueue({ ...event, filePath: normalizeStoryPath(event.filePath) });
    });

    return () => {
      coordinator.dispose();
      cleanup();
    };
  }, [setStatusMessage, text]);

  const handleTemplateSelected = useCallback(
    async (template: string, meta: { readonly title: string; readonly author: string }) => {
      const replacement = await runStoryReplacement('new', async () => ({
        kind: 'unsaved',
        content: template,
        closeHome: true,
      }));
      if (replacement.status !== 'committed') return;
      setHomeSurfaceOpen(false);
      setStatusMessage(text('file.created', { title: meta.title }));
    },
    [setHomeSurfaceOpen, setStatusMessage, text],
  );

  const handleLanguageChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setLanguage(event.target.value as Language);
    },
    [setLanguage],
  );

  useEffect(() => {
    window.plotflow?.menu?.setLanguage(language);
  }, [language]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 's') {
        if (
          event.defaultPrevented ||
          document.querySelector('[aria-modal="true"], [role="dialog"]')
        )
          return;
        event.preventDefault();
        void saveOrSaveAs();
        return;
      }

      if (isGraphShortcutBlocked(event)) return;

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        toggleRequestedWorkspaceMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!window.plotflow?.env?.isTest) {
      return undefined;
    }

    window.__test_store__ = {
      getEditorContent: () => useEditorStore.getState().content,
      getDiagnostics: () => useEditorStore.getState().diagnostics,
      getGraphNodes: () =>
        useGraphStore.getState().nodes.map((node) => ({
          id: node.id,
          position: { ...node.position },
        })),
      getGraphZoom: () => useGraphStore.getState().zoomLevel,
      setEditorContent: (content: string) => {
        startUnsavedStorySession({ content, closeHome: true });
      },
      setEditorContentPreservingUI: (content: string) => {
        useEditorStore.getState().setContent(content);
        parsePipelineNow(content);
      },
      applyExternalFileContent: (event) => {
        const editor = useEditorStore.getState();
        editor.setFilePath(event.filePath);
        editor.setPendingExternalChange(event);
        return applyExternalFileContent(event);
      },
      openConditionEditor: (nodeId: string, optionIndex: number) => {
        useUIStore.getState().openConditionEditor(nodeId, optionIndex);
      },
      setWorkspaceMode: (mode: 'split' | 'graphLab') => {
        requestWorkspaceMode(mode);
      },
      getUIState: () => {
        const state = useUIStore.getState();
        return {
          workspaceMode: state.workspaceMode,
          isSourceDrawerOpen: state.isSourceDrawerOpen,
          isConditionEditorOpen: state.isConditionEditorOpen,
          conditionEditorNodeId: state.conditionEditorNodeId,
          conditionEditorOptionIndex: state.conditionEditorOptionIndex,
          activeRightPanel: state.activeRightPanel,
          isExportDialogOpen: state.isExportDialogOpen,
          isNewFileDialogOpen: state.isNewFileDialogOpen,
          isThemeCenterOpen: state.isThemeCenterOpen,
          isHomeSurfaceOpen: state.isHomeSurfaceOpen,
          activeThemeId: state.activeThemeId,
          activeChapterId: state.activeChapterId,
          activeNodeId: useEditorStore.getState().activeNodeId,
        };
      },
      setTheme: (themeId: string) => {
        useUIStore.getState().setActiveThemeId(themeId);
      },
      getThemeId: () => useUIStore.getState().activeThemeId,
      openThemeCenter: () => useUIStore.getState().openThemeCenter(),
      setHomeSurfaceOpen: (open: boolean) => useUIStore.getState().setHomeSurfaceOpen(open),
      /** 直接选中图节点并联动编辑器，供测试桥使用。 */
      selectNode: (nodeId: string) => {
        useGraphStore.getState().selectNode(nodeId);
        useEditorStore.getState().setActiveNodeId(nodeId);
      },
    };

    return () => {
      delete window.__test_store__;
    };
  }, []);

  const showSplitGraph = activeRightPanel === 'graph' && viewMode === 'split';
  const showMinimap = activeRightPanel === 'graph' && viewMode === 'minimap';
  const graphModeLabel =
    viewMode === 'split' ? text('toolbar.splitGraph') : text('toolbar.minimap');
  const { activeTheme } = useThemePlatform();
  const Surfaces = activeTheme.surfaces;
  return (
    <Surfaces.AppShell workspaceMode={workspaceMode} topbar={null} overlays={null} statusBar={null}>
      <Surfaces.Toolbar
        brand={
          <button
            type="button"
            className="app-topbar__brand app-topbar-brand-button"
            data-testid="toolbar-home"
            onClick={() => setHomeSurfaceOpen(true)}
          >
            <BrandLockup variant="compact" />
            <span className="app-subtitle">{text('toolbar.phase')}</span>
            <span className="app-version">{text('appShell.version')}</span>
            <Home aria-hidden="true" size={15} strokeWidth={2} />
          </button>
        }
        fileControls={
          <>
            <button type="button" className="button button--primary" onClick={openNewFileDialog}>
              <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} />
              <span>{text('toolbar.newFile')}</span>
            </button>
            <button
              type="button"
              className="toolbar-button"
              data-testid="toolbar-export"
              onClick={() => requestExportDialog()}
            >
              <Download aria-hidden="true" size={15} strokeWidth={2} />
              <span>{text('toolbar.export')}</span>
            </button>
          </>
        }
        viewControls={
          <>
            <button
              type="button"
              className={`toolbar-button toolbar-button--state${workspaceMode === 'split' ? ' is-active' : ''}`}
              data-testid="workspace-mode-split"
              onClick={() => {
                requestWorkspaceMode('split');
                setHomeSurfaceOpen(false);
              }}
              aria-pressed={workspaceMode === 'split'}
            >
              <FileText aria-hidden="true" size={15} strokeWidth={2} />
              <span>Split</span>
            </button>
            <button
              type="button"
              className={`toolbar-button toolbar-button--state${workspaceMode === 'graphLab' ? ' is-active' : ''}`}
              data-testid="workspace-mode-graph-lab"
              onClick={() => {
                requestWorkspaceMode('graphLab');
                setHomeSurfaceOpen(false);
              }}
              aria-pressed={workspaceMode === 'graphLab'}
            >
              <GitBranch aria-hidden="true" size={15} strokeWidth={2} />
              <span>Graph Lab</span>
              <span className="toolbar-button__meta">{text('toolbar.officialTheme')}</span>
            </button>
            <button type="button" className="toolbar-button" onClick={openCorpusManager}>
              <Database aria-hidden="true" size={15} strokeWidth={2} />
              <span>{text('toolbar.corpus')}</span>
            </button>
            <button
              type="button"
              className="toolbar-button"
              data-testid="toolbar-theme-center"
              onClick={openThemeCenter}
              title={text('toolbar.themeCenter')}
            >
              <Palette aria-hidden="true" size={15} strokeWidth={2} />
              <span>{text('toolbar.theme')}</span>
            </button>
          </>
        }
        preferenceControls={
          <label className="toolbar-select">
            <Languages aria-hidden="true" size={15} strokeWidth={2} />
            <span className="visually-hidden">{text('toolbar.language')}</span>
            <select
              className="language-select"
              aria-label={text('toolbar.language')}
              value={language}
              onChange={handleLanguageChange}
            >
              <option value="zh-CN">{text('appShell.languageChinese')}</option>
              <option value="en-US">{text('appShell.languageEnglish')}</option>
            </select>
          </label>
        }
      />

      <HomeSurface />
      {workspaceMode === 'graphLab' ? (
        <GraphLabWorkspace />
      ) : (
        <Surfaces.SplitShell
          viewbar={
            <div className="split-viewbar" aria-label={text('appShell.splitControls')}>
              <div className="split-viewbar__label">
                <GitBranch aria-hidden="true" size={15} strokeWidth={2} />
                <span>{text('toolbar.graph')}</span>
              </div>
              <button
                type="button"
                className={`toolbar-button toolbar-button--state split-viewbar__toggle${viewMode === 'split' ? ' is-active' : ''}`}
                data-testid="toolbar-graph-view-toggle"
                onClick={toggleViewMode}
                title={viewMode === 'split' ? text('toolbar.minimap') : text('toolbar.splitGraph')}
                aria-pressed={viewMode === 'split'}
              >
                {viewMode === 'split' ? (
                  <PanelRightClose aria-hidden="true" size={15} strokeWidth={2} />
                ) : (
                  <PanelRightOpen aria-hidden="true" size={15} strokeWidth={2} />
                )}
                <span>
                  {text('toolbar.graph')}: {graphModeLabel}
                </span>
              </button>
            </div>
          }
          outline={<OutlinePanel onNodeClick={navigateToNode} />}
          editor={<MonacoEditor />}
          graph={
            showSplitGraph ? (
              <aside className="graph-pane" aria-label={text('toolbar.graph')}>
                <GraphCanvas viewMode="split" />
              </aside>
            ) : null
          }
          minimap={
            showMinimap ? (
              <div className="minimap-shell" aria-label={text('appShell.minimap')}>
                <GraphCanvas viewMode="minimap" />
              </div>
            ) : null
          }
        />
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
      <ThemeCenter />
      <FeedbackDialogHost />

      {isNewFileDialogOpen && (
        <NewFileDialog onClose={closeNewFileDialog} onTemplateSelected={handleTemplateSelected} />
      )}

      <StatusBar />
    </Surfaces.AppShell>
  );
}
