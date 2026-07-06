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
  clearPendingSave,
  overwritePendingExternalChange,
  saveAsCurrentFile,
  saveOrSaveAs,
} from '../services/autoSaveService';
import { parsePipelineNow } from '../services/parsePipeline';
import { rememberOpenedStory, rememberRecentStory } from '../services/recentFileService';
import type { StoryFlowNodeData } from '../components/branch-graph/adapter';
import { useAppText } from '../i18n/appI18n';

// ============================================================================
// P0-5: 鏆撮湶缁欎富杩涚▼鐨勮剰鐘舵€佹煡璇笌寮哄埗淇濆瓨鎺ュ彛
// ============================================================================
//
// 涓昏繘绋嬮€氳繃 mainWindow.webContents.executeJavaScript 璋冪敤杩欎簺鍑芥暟锛?
// 鐢ㄤ簬绐楀彛鍏抽棴/搴旂敤閫€鍑烘椂鐨勮剰鐘舵€佹鏌ヤ笌淇濆瓨娴佺▼銆?
// 娓叉煋杩涚▼閫氳繃 window.plotflow.dialog.confirm() 璋冪敤鍘熺敓瀵硅瘽妗嗗鐞?
// 鏂板缓/鎵撳紑鏂囦欢鏃剁殑鑴忕姸鎬佺‘璁ゃ€?

window.__getEditorDirtyState__ = () => {
  const editor = useEditorStore.getState();
  return { isDirty: editor.isDirty, filePath: editor.filePath };
};

window.__forceSave__ = async () => {
  return saveOrSaveAs();
};

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
  const openExportDialog = useUIStore((state) => state.openExportDialog);
  const openCorpusManager = useUIStore((state) => state.openCorpusManager);
  const openThemeCenter = useUIStore((state) => state.openThemeCenter);
  const setHomeSurfaceOpen = useUIStore((state) => state.setHomeSurfaceOpen);
  const setLanguage = useUIStore((state) => state.setLanguage);
  const activeRightPanel = useUIStore((state) => state.activeRightPanel);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const workspaceMode = useUIStore((state) => state.workspaceMode);
  const setWorkspaceMode = useUIStore((state) => state.setWorkspaceMode);
  const toggleWorkspaceMode = useUIStore((state) => state.toggleWorkspaceMode);
  const text = useAppText();

  const viewMode = useGraphStore((state) => state.viewMode);
  const toggleViewMode = useGraphStore((state) => state.toggleViewMode);

  // storyStore 鈫?graphStore 瀹夊叏缃戯紙parsePipeline 宸茬洿鎺ヨ皟鐢?syncFromAST锛?
  // 姝ゅ浠呭鐞嗙洿鎺ヨ皟鐢?setPlotFlowData 鐨勬梺璺矾寰勶級
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

  // P0-1: graphStore.selectedNodeId 鈫?editorStore 鍗曞悜鍚屾
  // 鍒嗘敮鍥捐妭鐐归€変腑鏃惰嚜鍔ㄨ仈鍔ㄥぇ绾查珮浜笌鍏夋爣浣嶇疆
  // 璁㈤槄鏀惧湪 App.tsx 鍏ㄥ眬灞傜‘淇濅笉鍙?GraphCanvas 鏉′欢娓叉煋锛坢inimap/split 鍒囨崲锛夊奖鍝?
  useEffect(() => {
    const unsubscribe = useGraphStore.subscribe(
      (state) => state.selectedNodeId,
      (selectedNodeId, prevSelectedNodeId) => {
        if (selectedNodeId === prevSelectedNodeId) return;
        if (useGraphStore.getState().isEditing) return; // 杩炵嚎鎷栨嫿绛夋搷浣滀腑璺宠繃

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

  // P0: isEditing 閿侀噴鏀?鈫?鑷姩閲嶈В鏋愶紙闃叉缂栬緫閿佹湡闂寸殑鍐呭鍙樻洿涓㈠け锛?
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

  // P0-6: 鎸傝浇鏃舵鏌ョ郴缁熷弻鍑?鍛戒护琛屼紶鍏ョ殑寰呮墦寮€鏂囦欢 (M7-08)
  // 绐楀彛棣栨鎸傝浇鏃惰皟鐢?getPendingOpenFile()锛屾秷璐规枃浠舵墦寮€绯荤粺浜嬩欢銆?
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!window.plotflow?.file?.getPendingOpenFile) return;

      const pending = await window.plotflow.file.getPendingOpenFile();
      if (!pending || cancelled) return;

      const { filePath, content, hash, modifiedAt } = pending;
      const normalizedPath = normalizeStoryPath(filePath);
      const editor = useEditorStore.getState();

      // P0-5: 鏂囦欢鎵撳紑鍓嶆鏌ユ槸鍚︽湁鏈繚瀛樼殑鏇存敼
      if (editor.isDirty) {
        const choice = await window.plotflow.dialog.confirm({
          type: 'warning',
          message: text('file.unsavedTitle'),
          detail: editor.filePath
            ? text('file.openDirtyNamed', { path: editor.filePath })
            : text('file.openDirtyUnnamed'),
          buttons: [text('home.saveAndOpen'), text('home.discardAndOpen'), text('common.cancel')],
        });

        if (cancelled) return;

        if (choice === 0) {
          const saved = await saveOrSaveAs();
          if (!saved) return;
        } else if (choice === 2) {
          return; // 鍙栨秷鎵撳紑
        }
        // choice === 1: 涓嶄繚瀛橈紝缁х画鎵撳紑
      }

      if (cancelled) return;

      clearPendingSave();
      const freshEditor = useEditorStore.getState();
      freshEditor.setFilePath(normalizedPath);
      freshEditor.setFileBaseline(hash, modifiedAt);
      freshEditor.clearPendingExternalChange();
      freshEditor.setDiagnostics([]);
      freshEditor.setActiveNodeId(null);
      freshEditor.setCursorPosition(1, 1);
      useStoryStore.getState().clearParseData();
      useGraphStore.getState().syncFromAST(null);
      freshEditor.setContent(content);
      freshEditor.markSaved();
      rememberRecentStory(normalizedPath, hash, modifiedAt);
      parsePipelineNow(content);
      setHomeSurfaceOpen(false);
      setStatusMessage(text('status.opened', { path: normalizedPath }));
    })();

    return () => {
      cancelled = true;
    };
  }, [setHomeSurfaceOpen, setStatusMessage, text]);

  // P0-6: 杩愯鏃剁洃鍚郴缁熸枃浠舵墦寮€閫氱煡锛堝簲鐢ㄥ凡杩愯锛岀敤鎴峰弻鍑?.mdstory 鏂囦欢鏃惰Е鍙戯級
  useEffect(() => {
    if (!window.plotflow?.file?.onSystemOpenFile) return;

    const cleanup = window.plotflow.file.onSystemOpenFile(async (filePath: string) => {
      const editor = useEditorStore.getState();

      // P0-5: 鏂囦欢鎵撳紑鍓嶆鏌ユ槸鍚︽湁鏈繚瀛樼殑鏇存敼
      if (editor.isDirty) {
        const choice = await window.plotflow.dialog.confirm({
          type: 'warning',
          message: text('file.unsavedTitle'),
          detail: editor.filePath
            ? text('file.openDirtyNamed', { path: editor.filePath })
            : text('file.openDirtyUnnamed'),
          buttons: [text('home.saveAndOpen'), text('home.discardAndOpen'), text('common.cancel')],
        });

        if (choice === 0) {
          const saved = await saveOrSaveAs();
          if (!saved) return;
        } else if (choice === 2) {
          return; // 鍙栨秷鎵撳紑
        }
        // choice === 1: 涓嶄繚瀛橈紝缁х画鎵撳紑
      }

      // 閫氳繃 IPC 璇诲彇鏂囦欢鍐呭
      if (!window.plotflow?.file?.readByPath) {
        setStatusMessage(text('file.readIpcUnavailable'));
        return;
      }

      const result = await window.plotflow.file.readByPath(filePath);
      if (!result) {
        setStatusMessage(text('file.cannotRead', { path: filePath }));
        return;
      }

      clearPendingSave();
      const freshEditor = useEditorStore.getState();
      const normalizedPath = normalizeStoryPath(result.filePath);
      freshEditor.setFilePath(normalizedPath);
      freshEditor.setFileBaseline(result.hash, result.modifiedAt);
      freshEditor.clearPendingExternalChange();
      freshEditor.setDiagnostics([]);
      freshEditor.setActiveNodeId(null);
      freshEditor.setCursorPosition(1, 1);
      useStoryStore.getState().clearParseData();
      useGraphStore.getState().syncFromAST(null);
      freshEditor.setContent(result.content);
      freshEditor.markSaved();
      rememberOpenedStory(result);
      parsePipelineNow(result.content);
      setHomeSurfaceOpen(false);
      setStatusMessage(text('status.opened', { path: normalizedPath }));
    });

    return cleanup;
  }, [setHomeSurfaceOpen, setStatusMessage, text]);

  useEffect(() => {
    if (!window.plotflow?.file?.onExternalChange) return;

    const cleanup = window.plotflow.file.onExternalChange(async (event) => {
      const normalizedEvent = {
        ...event,
        filePath: event.filePath.replace(/\\/g, '/'),
      };
      const editor = useEditorStore.getState();
      const currentFilePath = editor.filePath ? normalizeStoryPath(editor.filePath) : null;
      if (currentFilePath && currentFilePath !== normalizedEvent.filePath) return;

      if (!editor.isDirty) {
        applyExternalFileContent(normalizedEvent);
        setStatusMessage(`Reloaded external changes: ${normalizedEvent.filePath}`);
        return;
      }

      editor.setPendingExternalChange(normalizedEvent);
      const choice = await window.plotflow.dialog.confirm({
        type: 'warning',
        message: 'File changed on disk',
        detail: `${normalizedEvent.filePath}\n\nThe file was modified outside PlotFlow. Save a copy of your current edits, reload the disk version, overwrite the disk version, or keep editing without reloading.`,
        buttons: ['Save Copy', 'Reload Disk', 'Overwrite Disk', 'Keep Editing'],
      });

      if (choice === 0) {
        const saved = await saveAsCurrentFile();
        if (saved) {
          setStatusMessage('Saved a copy; external change no longer blocks the new file');
        }
      } else if (choice === 1) {
        applyExternalFileContent(normalizedEvent);
        setStatusMessage(`Reloaded external changes: ${normalizedEvent.filePath}`);
      } else if (choice === 2) {
        void overwritePendingExternalChange();
      } else {
        setStatusMessage('External file change kept pending');
      }
    });

    return cleanup;
  }, [setStatusMessage]);

  const handleTemplateSelected = useCallback(
    async (template: string, meta: { readonly title: string; readonly author: string }) => {
      const editor = useEditorStore.getState();

      // P0-5: 鏂板缓妯℃澘鍓嶆鏌ユ槸鍚︽湁鏈繚瀛樼殑鏇存敼
      if (editor.isDirty) {
        const choice = await window.plotflow.dialog.confirm({
          type: 'warning',
          message: text('file.unsavedTitle'),
          detail: editor.filePath
            ? text('file.newDirtyNamed', { path: editor.filePath })
            : text('file.newDirtyUnnamed'),
          buttons: [text('file.saveAndNew'), text('file.discardAndNew'), text('common.cancel')],
        });

        if (choice === 0) {
          const saved = await saveOrSaveAs();
          if (!saved) return;
        } else if (choice === 2) {
          return; // 鍙栨秷鏂板缓
        }
        // choice === 1: 涓嶄繚瀛橈紝缁х画鏂板缓
      }

      clearPendingSave();
      // 閲嶆柊鑾峰彇鏈€鏂扮殑 editor 寮曠敤锛坰aveOrSaveAs 鍙兘宸叉洿鏂扮姸鎬侊級
      const freshEditor = useEditorStore.getState();
      freshEditor.setFilePath(null);
      freshEditor.setDiagnostics([]);
      freshEditor.setActiveNodeId(null);
      freshEditor.setCursorPosition(1, 1);
      useStoryStore.getState().clearParseData();
      useGraphStore.getState().syncFromAST(null);
      freshEditor.setContent(template);
      parsePipelineNow(template);
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
        event.preventDefault();
        void saveOrSaveAs();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
        event.preventDefault();
        toggleWorkspaceMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleWorkspaceMode]);

  useEffect(() => {
    if (!window.plotflow?.env?.isTest) {
      return undefined;
    }

    window.__test_store__ = {
      getEditorContent: () => useEditorStore.getState().content,
      getDiagnostics: () => useEditorStore.getState().diagnostics,
      getGraphNodes: () => useGraphStore.getState().nodes.map((node) => ({
        id: node.id,
        position: { ...node.position },
      })),
      getGraphZoom: () => useGraphStore.getState().zoomLevel,
      setEditorContent: (content: string) => {
        clearPendingSave();

        const editor = useEditorStore.getState();
        editor.setFilePath(null);
        editor.setDiagnostics([]);
        editor.setActiveNodeId(null);
        editor.setCursorPosition(1, 1);

        const ui = useUIStore.getState();
        ui.setSourceDrawerOpen(false);
        ui.setProblemPanelOpen(false);
        ui.closeExportDialog();
        ui.closeThemeCenter();
        ui.setHomeSurfaceOpen(false);
        if (ui.isConditionEditorOpen) {
          ui.toggleConditionEditor();
        }

        useStoryStore.getState().clearParseData();
        useGraphStore.getState().syncFromAST(null);

        editor.setContent(content);
        parsePipelineNow(content);
        useUIStore.getState().setHomeSurfaceOpen(false);
      },
      openConditionEditor: (nodeId: string, optionIndex: number) => {
        useUIStore.getState().openConditionEditor(nodeId, optionIndex);
      },
      setWorkspaceMode: (mode: 'split' | 'graphLab') => {
        useUIStore.getState().setWorkspaceMode(mode);
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
        };
      },
      setTheme: (themeId: string) => {
        useUIStore.getState().setActiveThemeId(themeId);
      },
      getThemeId: () => useUIStore.getState().activeThemeId,
      openThemeCenter: () => useUIStore.getState().openThemeCenter(),
      setHomeSurfaceOpen: (open: boolean) => useUIStore.getState().setHomeSurfaceOpen(open),
      /** 鐩存帴閫変腑鍒嗘敮鍥捐妭鐐瑰苟鑱斿姩缂栬緫鍣紝缁曞紑 DOM 鐐瑰嚮/鍐掓场/浜嬩欢濮旀墭渚濊禆 */
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
          brand={(
            <button
              type="button"
              className="app-topbar__brand app-topbar-brand-button"
              data-testid="toolbar-home"
              onClick={() => setHomeSurfaceOpen(true)}
            >
              <span className="app-logo" aria-hidden="true">
                Pf
              </span>
              <div>
                <h1 className="app-title">PlotFlow V0.1</h1>
                <p className="app-subtitle">{text('toolbar.phase')}</p>
              </div>
              <Home aria-hidden="true" size={15} strokeWidth={2} />
            </button>
          )}
          fileControls={(
            <>
              <button type="button" className="button button--primary" onClick={openNewFileDialog}>
                <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} />
                <span>{text('toolbar.newFile')}</span>
              </button>
              <button type="button" className="toolbar-button" data-testid="toolbar-export" onClick={() => openExportDialog()}>
                <Download aria-hidden="true" size={15} strokeWidth={2} />
                <span>{text('toolbar.export')}</span>
              </button>
            </>
          )}
          viewControls={(
            <>
              <button
                type="button"
                className={`toolbar-button toolbar-button--state${workspaceMode === 'split' ? ' is-active' : ''}`}
                data-testid="workspace-mode-split"
                onClick={() => {
                  setWorkspaceMode('split');
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
                  setWorkspaceMode('graphLab');
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
          )}
          preferenceControls={(
            <label className="toolbar-select">
              <Languages aria-hidden="true" size={15} strokeWidth={2} />
              <span className="visually-hidden">{text('toolbar.language')}</span>
              <select
                className="language-select"
                aria-label={text('toolbar.language')}
                value={language}
                onChange={handleLanguageChange}
              >
                <option value="zh-CN">中文</option>
                <option value="en-US">English</option>
              </select>
            </label>
          )}
        />

        <HomeSurface />
        {workspaceMode === 'graphLab' ? (
          <GraphLabWorkspace />
        ) : (
          <Surfaces.SplitShell
            viewbar={(
              <div className="split-viewbar" aria-label="Split workspace controls">
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
                  <span>{text('toolbar.graph')}: {graphModeLabel}</span>
                </button>
              </div>
            )}
            outline={<OutlinePanel onNodeClick={navigateToNode} />}
            editor={<MonacoEditor />}
            graph={showSplitGraph ? (
              <aside className="graph-pane" aria-label={text('toolbar.graph')}>
                <GraphCanvas viewMode="split" />
              </aside>
            ) : null}
            minimap={showMinimap ? (
              <div className="minimap-shell" aria-label="PlotFlow minimap">
                <GraphCanvas viewMode="minimap" />
              </div>
            ) : null}
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

        {isNewFileDialogOpen && (
          <NewFileDialog
            onClose={closeNewFileDialog}
            onTemplateSelected={handleTemplateSelected}
          />
        )}

        <StatusBar />
      </Surfaces.AppShell>
  );
}
