import React, { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  FilePlus2,
  FileSearch,
  FileText,
  FolderOpen,
  GitBranchPlus,
  LayoutGrid,
  ListTree,
  Plus,
  RefreshCw,
  Square,
} from 'lucide-react';
import type { Diagnostic } from '@plotflow/core';
import type { WorkspaceStoriesResult, WorkspaceStoryFile } from '../../types/electron';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { layoutNodesInWorker } from '../branch-graph/graphLayoutClient';
import { graphEditService } from '../../services/graphEditService';
import { clearPendingSave, saveOrSaveAs } from '../../services/autoSaveService';
import { parsePipelineNow } from '../../services/parsePipeline';
import { rememberRecentStory } from '../../services/recentFileService';
import { useAppText } from '../../i18n/appI18n';

interface GraphLabPaletteProps {
  readonly onNodeNavigate: (nodeId: string, lineNumber: number, chapterId: string) => void;
  readonly onBeforeGraphMutation?: () => boolean;
}

type NodeSeverity = Diagnostic['severity'] | 'normal';

const SEVERITY_RANK: Record<NodeSeverity, number> = {
  normal: 0,
  info: 1,
  warning: 2,
  error: 3,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

type TextFn = ReturnType<typeof useAppText>;

function getFileName(path: string | null, fallback: string): string {
  if (!path) return fallback;
  return path.split(/[/\\]/).pop() || path;
}

function getNodeSeverityLabel(severity: NodeSeverity, text: TextFn): string {
  switch (severity) {
    case 'error':
      return text('palette.error');
    case 'warning':
      return text('palette.warning');
    case 'info':
      return text('palette.info');
    default:
      return text('palette.normal');
  }
}

async function confirmBeforeReplacingStory(text: TextFn): Promise<boolean> {
  const editor = useEditorStore.getState();
  if (!editor.isDirty) return true;

  const choice = await window.plotflow.dialog.confirm({
    type: 'warning',
    message: text('palette.beforeReplaceTitle'),
    detail: editor.filePath
      ? text('palette.beforeReplaceNamed', { path: editor.filePath })
      : text('palette.beforeReplaceUnnamed'),
    buttons: [text('home.saveAndOpen'), text('home.discardAndOpen'), text('common.cancel')],
  });

  if (choice === 0) {
    return saveOrSaveAs();
  }
  return choice === 1;
}

function loadStoryIntoEditor(filePath: string, content: string, hash: string, modifiedAt: number): void {
  const normalizedPath = filePath.replace(/\\/g, '/');
  clearPendingSave();
  const editor = useEditorStore.getState();
  editor.setFilePath(normalizedPath);
  editor.setFileBaseline(hash, modifiedAt);
  editor.clearPendingExternalChange();
  editor.setDiagnostics([]);
  editor.setActiveNodeId(null);
  editor.setCursorPosition(1, 1);
  useStoryStore.getState().clearParseData();
  useGraphStore.getState().syncFromAST(null);
  editor.setContent(content);
  editor.markSaved();
  rememberRecentStory(normalizedPath, hash, modifiedAt);
  parsePipelineNow(content);
}

export function GraphLabPalette({ onNodeNavigate, onBeforeGraphMutation }: GraphLabPaletteProps): React.ReactElement {
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const setNodes = useGraphStore((state) => state.setNodes);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const activeChapterId = useUIStore((state) => state.activeChapterId);
  const setActiveChapterId = useUIStore((state) => state.setActiveChapterId);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const filePath = useEditorStore((state) => state.filePath);
  const activeNodeId = useEditorStore((state) => state.activeNodeId);
  const [workspace, setWorkspace] = useState<WorkspaceStoriesResult | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const text = useAppText();

  const severityByNode = useMemo(() => {
    const map = new Map<string, NodeSeverity>();
    for (const diagnostic of diagnostics) {
      const nodeId =
        diagnostic.relatedNodeId ??
        useStoryStore.getState().getNodeByLine(diagnostic.range.startLine);
      if (!nodeId) continue;

      const previous = map.get(nodeId) ?? 'normal';
      if (SEVERITY_RANK[diagnostic.severity] > SEVERITY_RANK[previous]) {
        map.set(nodeId, diagnostic.severity);
      }
    }
    return map;
  }, [diagnostics, plotFlowData]);

  const handleCreateChapter = useCallback(() => {
    if (onBeforeGraphMutation && !onBeforeGraphMutation()) return;
    const baseTitle = text('palette.defaultChapterTitle');
    const existing = new Set((plotFlowData?.chapters ?? []).map((chapter) => chapter.title));
    let title = baseTitle;
    let index = 2;
    while (existing.has(title)) {
      title = `${baseTitle} ${index}`;
      index++;
    }
    graphEditService.createChapter(title);
    setActiveChapterId(title);
    setStatusMessage(text('palette.createdChapter'));
  }, [onBeforeGraphMutation, plotFlowData?.chapters, setActiveChapterId, setStatusMessage, text]);

  const handleCreateNode = useCallback(() => {
    if (onBeforeGraphMutation && !onBeforeGraphMutation()) return;
    graphEditService.createNode({
      chapterTitle: activeChapterId ?? text('palette.defaultChapterTitle'),
      title: text('palette.newNodeTitle'),
    });
    setStatusMessage(text('palette.createdNode'));
  }, [activeChapterId, onBeforeGraphMutation, setStatusMessage, text]);

  const handleCreateEnding = useCallback(() => {
    if (onBeforeGraphMutation && !onBeforeGraphMutation()) return;
    graphEditService.createNode({
      chapterTitle: activeChapterId ?? text('palette.defaultChapterTitle'),
      title: text('palette.endingNodeTitle'),
      isEnding: true,
    });
    setStatusMessage(text('palette.createdEnding'));
  }, [activeChapterId, onBeforeGraphMutation, setStatusMessage, text]);

  const handleRelayout = useCallback(() => {
    if (nodes.length === 0) {
      setStatusMessage(text('palette.noLayoutNodes'));
      return;
    }
    setStatusMessage(text('palette.relayout'));
    void layoutNodesInWorker(nodes, edges)
      .then((result) => {
        if (result.stale) return;
        setNodes(result.nodes);
        setStatusMessage(text('palette.relayoutDone'));
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatusMessage(message);
      });
  }, [edges, nodes, setNodes, setStatusMessage, text]);

  const refreshWorkspace = useCallback(async (rootPath: string) => {
    setWorkspaceError(null);
    setIsScanning(true);
    try {
      const result = await window.plotflow.file.listWorkspaceStories(rootPath);
      setWorkspace(result);
      setStatusMessage(text('palette.workspaceRefreshed', { count: result.files.length }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkspaceError(message);
      setStatusMessage(message);
    } finally {
      setIsScanning(false);
    }
  }, [setStatusMessage, text]);

  const handleChooseWorkspace = useCallback(async () => {
    setWorkspaceError(null);
    setIsScanning(true);
    try {
      const result = await window.plotflow.file.chooseWorkspaceFolder();
      if (!result) return;
      setWorkspace(result);
      setStatusMessage(text('palette.workspaceSelected', { count: result.files.length }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkspaceError(message);
      setStatusMessage(message);
    } finally {
      setIsScanning(false);
    }
  }, [setStatusMessage, text]);

  const handleOpenWorkspaceFile = useCallback(async (file: WorkspaceStoryFile) => {
    if (!workspace) return;
    if (onBeforeGraphMutation && !onBeforeGraphMutation()) return;
    const canReplace = await confirmBeforeReplacingStory(text);
    if (!canReplace) return;

    const result = await window.plotflow.file.readWorkspaceStory(workspace.rootPath, file.filePath);
    if (!result) {
      setStatusMessage(text('palette.cannotRead', { path: file.relativePath }));
      return;
    }

    loadStoryIntoEditor(result.filePath, result.content, result.hash, result.modifiedAt);
    setStatusMessage(text('status.opened', { path: file.relativePath }));
  }, [onBeforeGraphMutation, setStatusMessage, text, workspace]);

  const hasOutline = (plotFlowData?.chapters.length ?? 0) > 0;

  return (
    <aside className="graph-lab-rail" aria-label={text('palette.aria')}>
      <section className="graph-lab-rail__block graph-lab-rail__hero">
        <div className="graph-lab-panel__header">
          <span className="graph-lab-panel__eyebrow">PlotFlow</span>
          <h2>{text('palette.workbench')}</h2>
        </div>
        <p className="graph-lab-rail__current" title={filePath ?? undefined}>
          <FileText aria-hidden="true" size={15} strokeWidth={2} />
          <span>{getFileName(filePath, text('graphLab.unsavedStory'))}</span>
        </p>
      </section>

      <section className="graph-lab-rail__block" data-testid="graph-lab-workspace-browser">
        <div className="graph-lab-section__title">
          <h3>{text('palette.contentBrowser')}</h3>
          <button
            type="button"
            className="icon-button"
            data-testid="graph-lab-choose-workspace"
            onClick={handleChooseWorkspace}
            title={text('palette.chooseWorkspace')}
            disabled={isScanning}
          >
            <FolderOpen aria-hidden="true" size={15} strokeWidth={2} />
          </button>
        </div>

        {workspace ? (
          <>
            <div className="graph-lab-workspace-summary">
              <FileSearch aria-hidden="true" size={15} strokeWidth={2} />
              <span title={workspace.rootPath}>{text('palette.workspaceSummary', { count: workspace.files.length })}</span>
              <button
                type="button"
                className="icon-button"
                onClick={() => void refreshWorkspace(workspace.rootPath)}
                title={text('palette.refreshWorkspace')}
                disabled={isScanning}
              >
                <RefreshCw aria-hidden="true" size={14} strokeWidth={2} />
              </button>
            </div>
            {workspace.truncated && (
              <p className="graph-lab-warning">
                <AlertCircle aria-hidden="true" size={14} strokeWidth={2} />
                <span>{text('palette.workspaceTruncated')}</span>
              </p>
            )}
            <div className="graph-lab-file-list">
              {workspace.files.map((file) => {
                const isActive = file.filePath.replace(/\\/g, '/') === filePath;
                return (
                  <button
                    type="button"
                    key={file.filePath}
                    className={`graph-lab-file${isActive ? ' graph-lab-file--active' : ''}`}
                    data-testid="graph-lab-workspace-file"
                    onClick={() => void handleOpenWorkspaceFile(file)}
                    title={`${file.relativePath} · ${formatBytes(file.size)}`}
                  >
                    <FileText aria-hidden="true" size={14} strokeWidth={2} />
                    <span>{file.relativePath}</span>
                  </button>
                );
              })}
              {workspace.files.length === 0 && (
                <p className="graph-lab-empty">{text('palette.noWorkspaceFiles')}</p>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            className="graph-lab-empty-action"
            onClick={handleChooseWorkspace}
            disabled={isScanning}
          >
            <FolderOpen aria-hidden="true" size={15} strokeWidth={2} />
            <span>{isScanning ? text('palette.scanning') : text('palette.chooseWorkspace')}</span>
          </button>
        )}
        {workspaceError && <p className="graph-lab-warning">{workspaceError}</p>}
      </section>

      <section className="graph-lab-rail__block">
        <div className="graph-lab-section__title">
          <h3>{text('palette.outline')}</h3>
          <ListTree aria-hidden="true" size={15} strokeWidth={2} />
        </div>
        {hasOutline ? (
          <div className="graph-lab-outline">
            {plotFlowData!.chapters.map((chapter) => (
              <div className="graph-lab-outline__chapter" key={chapter.id}>
                {!chapter.isAnonymous && <div className="graph-lab-outline__chapter-title">{chapter.title}</div>}
                {chapter.nodes.map((node) => {
                  const severity = severityByNode.get(node.fullId) ?? 'normal';
                  const isActive = activeNodeId === node.fullId;
                  return (
                    <button
                      type="button"
                      key={node.fullId}
                      className={`graph-lab-outline-node graph-lab-outline-node--${severity}${isActive ? ' graph-lab-outline-node--active' : ''}`}
                      data-testid="graph-lab-outline-node"
                      onClick={() => onNodeNavigate(node.fullId, node.lineNumber, node.chapterId)}
                      title={`${node.title} · ${getNodeSeverityLabel(severity, text)}`}
                    >
                      <span className="graph-lab-outline-node__status" aria-hidden="true" />
                      <span className="graph-lab-outline-node__title">{node.title}</span>
                      <span className="graph-lab-outline-node__meta">{node.options.length}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <p className="graph-lab-empty">{text('palette.outlineEmpty')}</p>
        )}
      </section>

      <section className="graph-lab-rail__block">
        <div className="graph-lab-section__title">
          <h3>{text('palette.create')}</h3>
          <GitBranchPlus aria-hidden="true" size={15} strokeWidth={2} />
        </div>
        <div className="graph-lab-palette__actions">
          <button type="button" className="graph-lab-tool" data-testid="graph-lab-create-chapter" onClick={handleCreateChapter}>
            <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} />
            <span>{text('palette.chapter')}</span>
          </button>
          <button type="button" className="graph-lab-tool graph-lab-tool--primary" data-testid="graph-lab-create-node" onClick={handleCreateNode}>
            <Plus aria-hidden="true" size={16} strokeWidth={2} />
            <span>{text('palette.node')}</span>
          </button>
          <button type="button" className="graph-lab-tool" data-testid="graph-lab-create-ending" onClick={handleCreateEnding}>
            <Square aria-hidden="true" size={15} strokeWidth={2} />
            <span>{text('palette.ending')}</span>
          </button>
          <button type="button" className="graph-lab-tool" data-testid="graph-lab-relayout" onClick={handleRelayout}>
            <LayoutGrid aria-hidden="true" size={16} strokeWidth={2} />
            <span>{text('palette.relayout')}</span>
          </button>
        </div>
      </section>
    </aside>
  );
}
