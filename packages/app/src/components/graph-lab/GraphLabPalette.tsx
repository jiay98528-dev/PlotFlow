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
import { layoutNodes } from '../branch-graph/layout';
import { graphEditService } from '../../services/graphEditService';
import { clearPendingSave, saveOrSaveAs } from '../../services/autoSaveService';
import { parsePipelineNow } from '../../services/parsePipeline';

interface GraphLabPaletteProps {
  readonly onNodeNavigate: (nodeId: string, lineNumber: number) => void;
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

function getFileName(path: string | null): string {
  if (!path) return '未保存故事';
  return path.split(/[/\\]/).pop() || path;
}

function getNodeSeverityLabel(severity: NodeSeverity): string {
  switch (severity) {
    case 'error':
      return '错误';
    case 'warning':
      return '警告';
    case 'info':
      return '建议';
    default:
      return '正常';
  }
}

async function confirmBeforeReplacingStory(): Promise<boolean> {
  const editor = useEditorStore.getState();
  if (!editor.isDirty) return true;

  const choice = await window.plotflow.dialog.confirm({
    type: 'warning',
    message: '打开工作区文件前处理未保存更改？',
    detail: editor.filePath
      ? `"${editor.filePath}" 有未保存的修改。`
      : '当前未命名故事有未保存的修改。',
    buttons: ['保存并打开', '不保存并打开', '取消'],
  });

  if (choice === 0) {
    await saveOrSaveAs();
    return true;
  }
  return choice === 1;
}

function loadStoryIntoEditor(filePath: string, content: string): void {
  clearPendingSave();
  const editor = useEditorStore.getState();
  editor.setFilePath(filePath);
  editor.setDiagnostics([]);
  editor.setActiveNodeId(null);
  editor.setCursorPosition(1, 1);
  useStoryStore.getState().clearParseData();
  useGraphStore.getState().syncFromAST(null);
  editor.setContent(content);
  editor.markSaved();
  parsePipelineNow(content);
}

export function GraphLabPalette({ onNodeNavigate }: GraphLabPaletteProps): React.ReactElement {
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const setNodes = useGraphStore((state) => state.setNodes);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const filePath = useEditorStore((state) => state.filePath);
  const activeNodeId = useEditorStore((state) => state.activeNodeId);
  const [workspace, setWorkspace] = useState<WorkspaceStoriesResult | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

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
    graphEditService.createChapter('第一章');
    setStatusMessage('已创建章节');
  }, [setStatusMessage]);

  const handleCreateNode = useCallback(() => {
    graphEditService.createNode({ chapterTitle: '第一章', title: '新节点' });
    setStatusMessage('已创建节点');
  }, [setStatusMessage]);

  const handleCreateEnding = useCallback(() => {
    graphEditService.createNode({ chapterTitle: '第一章', title: '结局', isEnding: true });
    setStatusMessage('已创建结局节点');
  }, [setStatusMessage]);

  const handleRelayout = useCallback(() => {
    if (nodes.length === 0) {
      setStatusMessage('当前没有可布局的节点');
      return;
    }
    const { nodes: layoutedNodes } = layoutNodes(nodes, edges);
    setNodes(layoutedNodes);
    setStatusMessage('Graph Lab 已重新布局');
  }, [edges, nodes, setNodes, setStatusMessage]);

  const refreshWorkspace = useCallback(async (rootPath: string) => {
    setWorkspaceError(null);
    setIsScanning(true);
    try {
      const result = await window.plotflow.file.listWorkspaceStories(rootPath);
      setWorkspace(result);
      setStatusMessage(`已刷新工作区: ${result.files.length} 个故事文件`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkspaceError(message);
      setStatusMessage(message);
    } finally {
      setIsScanning(false);
    }
  }, [setStatusMessage]);

  const handleChooseWorkspace = useCallback(async () => {
    setWorkspaceError(null);
    setIsScanning(true);
    try {
      const result = await window.plotflow.file.chooseWorkspaceFolder();
      if (!result) return;
      setWorkspace(result);
      setStatusMessage(`已选择工作区: ${result.files.length} 个故事文件`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorkspaceError(message);
      setStatusMessage(message);
    } finally {
      setIsScanning(false);
    }
  }, [setStatusMessage]);

  const handleOpenWorkspaceFile = useCallback(async (file: WorkspaceStoryFile) => {
    if (!workspace) return;
    const canReplace = await confirmBeforeReplacingStory();
    if (!canReplace) return;

    const result = await window.plotflow.file.readWorkspaceStory(workspace.rootPath, file.filePath);
    if (!result) {
      setStatusMessage(`无法读取工作区文件: ${file.relativePath}`);
      return;
    }

    loadStoryIntoEditor(result.filePath, result.content);
    setStatusMessage(`已打开: ${file.relativePath}`);
  }, [setStatusMessage, workspace]);

  const hasOutline = (plotFlowData?.chapters.length ?? 0) > 0;

  return (
    <aside className="graph-lab-rail" aria-label="Graph Lab 工作区">
      <section className="graph-lab-rail__block graph-lab-rail__hero">
        <div className="graph-lab-panel__header">
          <span className="graph-lab-panel__eyebrow">PlotFlow</span>
          <h2>叙事工作台</h2>
        </div>
        <p className="graph-lab-rail__current" title={filePath ?? undefined}>
          <FileText aria-hidden="true" size={15} strokeWidth={2} />
          <span>{getFileName(filePath)}</span>
        </p>
      </section>

      <section className="graph-lab-rail__block" data-testid="graph-lab-workspace-browser">
        <div className="graph-lab-section__title">
          <h3>内容浏览器</h3>
          <button
            type="button"
            className="icon-button"
            data-testid="graph-lab-choose-workspace"
            onClick={handleChooseWorkspace}
            title="选择工作区"
            disabled={isScanning}
          >
            <FolderOpen aria-hidden="true" size={15} strokeWidth={2} />
          </button>
        </div>

        {workspace ? (
          <>
            <div className="graph-lab-workspace-summary">
              <FileSearch aria-hidden="true" size={15} strokeWidth={2} />
              <span title={workspace.rootPath}>{workspace.files.length} 个 .mdstory</span>
              <button
                type="button"
                className="icon-button"
                onClick={() => void refreshWorkspace(workspace.rootPath)}
                title="刷新工作区"
                disabled={isScanning}
              >
                <RefreshCw aria-hidden="true" size={14} strokeWidth={2} />
              </button>
            </div>
            {workspace.truncated && (
              <p className="graph-lab-warning">
                <AlertCircle aria-hidden="true" size={14} strokeWidth={2} />
                <span>文件较多，已显示前 300 个。</span>
              </p>
            )}
            <div className="graph-lab-file-list">
              {workspace.files.map((file) => {
                const isActive = file.filePath === filePath;
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
                <p className="graph-lab-empty">当前工作区没有 `.mdstory` 文件。</p>
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
            <span>{isScanning ? '扫描中' : '选择工作区'}</span>
          </button>
        )}
        {workspaceError && <p className="graph-lab-warning">{workspaceError}</p>}
      </section>

      <section className="graph-lab-rail__block">
        <div className="graph-lab-section__title">
          <h3>章节大纲</h3>
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
                      onClick={() => onNodeNavigate(node.fullId, node.lineNumber)}
                      title={`${node.title} · ${getNodeSeverityLabel(severity)}`}
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
          <p className="graph-lab-empty">打开或创建故事后，这里会显示章节和节点。</p>
        )}
      </section>

      <section className="graph-lab-rail__block">
        <div className="graph-lab-section__title">
          <h3>创建</h3>
          <GitBranchPlus aria-hidden="true" size={15} strokeWidth={2} />
        </div>
        <div className="graph-lab-palette__actions">
          <button type="button" className="graph-lab-tool" data-testid="graph-lab-create-chapter" onClick={handleCreateChapter}>
            <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} />
            <span>章节</span>
          </button>
          <button type="button" className="graph-lab-tool graph-lab-tool--primary" data-testid="graph-lab-create-node" onClick={handleCreateNode}>
            <Plus aria-hidden="true" size={16} strokeWidth={2} />
            <span>节点</span>
          </button>
          <button type="button" className="graph-lab-tool" data-testid="graph-lab-create-ending" onClick={handleCreateEnding}>
            <Square aria-hidden="true" size={15} strokeWidth={2} />
            <span>结局</span>
          </button>
          <button type="button" className="graph-lab-tool" data-testid="graph-lab-relayout" onClick={handleRelayout}>
            <LayoutGrid aria-hidden="true" size={16} strokeWidth={2} />
            <span>重新布局</span>
          </button>
        </div>
      </section>
    </aside>
  );
}
