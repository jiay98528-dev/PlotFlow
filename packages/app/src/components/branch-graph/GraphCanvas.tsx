/**
 * GraphCanvas — React Flow 分支图画布组件
 *
 * 职责：渲染 PlotFlow 故事节点的可视化分支图。与 Monaco 编辑器
 * 并排显示，支持节点点击联动编辑器和拖拽交互。
 *
 * 对应 TAD.md §2.1 组件树 RightPanel → ReactFlowGraph 和 §2.4 React Flow 集成。
 *
 * 约束（CLAUDE.md §6.1）：
 * - 节点状态着色通过 className 注入，不在组件内硬编码颜色
 * - 所有颜色引用 Design Token CSS 变量
 *
 * 状态映射（TAD.md §2.4.1 STATUS_CLASS_MAP）：
 * - 'normal'   → node-status-normal   (绿色边框)
 * - 'orphan'   → node-status-orphan   (黄色边框)
 * - 'deadend'  → node-status-deadend  (灰色边框)
 * - 'error'    → node-status-error    (红色边框)
 * - 'root'     → node-status-root     (蓝色加粗边框)
 *
 * @module components/branch-graph/GraphCanvas
 */

import React, { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  SelectionMode,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../stores/graphStore';
import { useEditorStore } from '../../stores/editorStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { useThemePlatform } from '../ThemePlatformProvider';
import { useAppText } from '../../i18n/appI18n';
import { type StoryFlowNodeData } from './adapter';
import { GraphContextMenu } from './GraphContextMenu';
import { CollapseNode } from './CollapseNode';
import {
  collapseSiblingNodes,
  COLLAPSE_THRESHOLD,
  LARGE_GRAPH_LAYOUT_THRESHOLD,
} from './layout';
import type { CollapseNodeData } from './layout';
import { useGraphGestureController } from './graphGestureController';
import { useGraphMenuController } from './graphMenuController';
import { useGraphLayoutController } from './graphLayoutController';
import { useGraphInteractionLease } from './graphInteractionLease';
import { useGraphWireController } from './graphWireController';
import { GraphWireDropMenu } from './GraphWireDropMenu';
import { useGraphNodeController } from './graphNodeController';
import { useGraphEdgeController } from './graphEdgeController';
import type { ScreenToFlowPosition } from './graphWireModel';
import {
  AutoViewportOnGraphChange,
  GRAPH_AUTO_FIT_MAX_ZOOM,
  GraphFocusController,
  ReactFlowRuntimeBridge,
  ZoomResetShortcut,
} from './GraphViewportControllers';

// ============================================================================
// 自定义节点类型注册表
// ============================================================================

function readCssToken(name: string): string {
  if (typeof window === 'undefined') return `var(${name})`;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || `var(${name})`;
}

// ============================================================================
// GraphCanvas 主组件
// ============================================================================

export interface GraphCanvasProps {
  readonly viewMode?: 'split' | 'graphLab' | 'minimap';
}

export function GraphCanvas({ viewMode = 'split' }: GraphCanvasProps): React.ReactElement {
  const isSplit = viewMode === 'split';
  const isGraphLab = viewMode === 'graphLab';
  const canEditGraph = viewMode !== 'minimap';
  const { activeTheme } = useThemePlatform();
  const text = useAppText();
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const collapsedGroups = useGraphStore((state) => state.collapsedGroups);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const selectNode = useGraphStore((state) => state.selectNode);
  const setZoom = useGraphStore((state) => state.setZoom);
  const renamingNodeId = useGraphStore((state) => state.renamingNodeId);
  const setRenamingNodeId = useGraphStore((state) => state.setRenamingNodeId);
  const setEditing = useGraphStore((state) => state.setEditing);
  const setNodes = useGraphStore((state) => state.setNodes);
  const setEdges = useGraphStore((state) => state.setEdges);

  const editorInstance = useEditorStore((state) => state.editorInstance);
  const activeNodeId = useEditorStore((state) => state.activeNodeId);
  const storySessionId = useEditorStore((state) => state.storySessionId);

  // V02-033: 解析器错误诊断 — 驱动分支图错误横幅和空状态提示
  const diagnostics = useEditorStore((s) => s.diagnostics);
  const parseError = useStoryStore((state) => state.parseError);

  // StoryStore — 用于查找 AST 节点信息（选项行号、targetNodeId 等）
  const getNodeByFullId = useStoryStore((state) => state.getNodeByFullId);
  const hasAnyManualLayout = useStoryStore(
    (state) => (state.plotFlowData?.layout?.graph.nodes.length ?? 0) > 0,
  );

  // UIStore — 条件编辑器面板控制
  const openConditionEditor = useUIStore((state) => state.openConditionEditor);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const activeChapterId = useUIStore((state) => state.activeChapterId);

  const screenToFlowPositionRef = React.useRef<ScreenToFlowPosition | null>(null);
  const {
    altPressedRef,
    suppressAutoFitRef,
    suppressAutoFitForUserViewportChange,
    suppressNextPaneClick,
    consumeSuppressedPaneClick,
  } = useGraphGestureController();
  const interactionLease = useGraphInteractionLease({ storySessionId, setEditing });
  const {
    contextMenu,
    handleNodeContextMenu,
    handlePaneContextMenu,
    handleEdgeContextMenu,
    handleContextMenuClose,
  } = useGraphMenuController({ canEditGraph, renamingNodeId });
  const {
    liveWirePreview,
    wireDropContext,
    handleConnectStart,
    handleConnect,
    handleConnectEnd,
    handleReconnectStart,
    handleReconnect,
    handleReconnectEnd,
    handleIsValidConnection,
    handleManualWirePointerDown,
    handleManualWirePointerUp,
    handleManualWirePointerCancel,
    handleManualWireMouseDown,
    handleManualWireMouseUp,
    executeWireDropAction,
    closeWireDrop,
  } = useGraphWireController({
    canEditGraph,
    renamingNodeId,
    nodes,
    edges,
    getNodeByFullId,
    setEdges,
    setStatusMessage,
    text,
    screenToFlowPositionRef,
    interactionLease,
    suppressNextPaneClick,
  });
  const {
    handleNodesChange,
    handleNodeClick,
    handleNodeDoubleClick,
    handlePaneClick,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
  } = useGraphNodeController({
    canEditGraph,
    nodes,
    selectedNodeId,
    renamingNodeId,
    editorInstance,
    getNodeByFullId,
    selectNode,
    setRenamingNodeId,
    setStatusMessage,
    text,
    interactionLease,
    suppressAutoFitRef,
    suppressAutoFitForUserViewportChange,
    consumeSuppressedPaneClick,
    closeWireDrop,
  });
  const { handleEdgeClick, handleEdgeHitAreaClickCapture, handleEdgeDoubleClick } =
    useGraphEdgeController({
      canEditGraph,
      renamingNodeId,
      altPressedRef,
      getNodeByFullId,
      openConditionEditor,
      setStatusMessage,
      text,
    });

  const nodeTypes = useMemo(
    () => ({
      storyNode: activeTheme.slots.StoryNodeCard,
      collapseNode: CollapseNode,
    }),
    [activeTheme.slots.StoryNodeCard],
  );

  const edgeTypes = useMemo(
    () => ({
      default: activeTheme.slots.StoryEdge,
      conditional: activeTheme.slots.StoryEdge,
    }),
    [activeTheme.slots.StoryEdge],
  );

  const visibleGraph = useMemo(() => {
    if (!isGraphLab || !activeChapterId) return { nodes, edges };
    const visibleNodeIds = new Set(
      nodes
        .filter(
          (node) => (node.data as StoryFlowNodeData | undefined)?.chapterId === activeChapterId,
        )
        .map((node) => node.id),
    );
    return {
      nodes: nodes.filter((node) => visibleNodeIds.has(node.id)),
      edges: edges.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      ),
    };
  }, [activeChapterId, edges, isGraphLab, nodes]);

  // ==========================================================================
  // 性能模式检测 (M2-14)
  // ==========================================================================

  /** 节点数超过 200 时自动启用性能模式 */
  const isPerfMode = nodes.length > 200;

  /** 性能模式下 fitView 动画时长（更大值 = 更低帧率体感） */
  const fitViewDuration = isGraphLab ? 0 : isPerfMode ? 120 : 200;

  useGraphLayoutController({
    nodes,
    edges,
    setNodes,
    setStatusMessage,
    text,
  });

  // ==========================================================================
  // 同层折叠 + 节点高亮派生 (M2-15, M2-04)
  // ==========================================================================

  /**
   * 第一步：应用同层节点折叠。
   * 使用 collapsedGroups 状态决定哪些组处于折叠状态。
   */
  const collapsedResult = useMemo(() => {
    if (visibleGraph.nodes.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] };
    return collapseSiblingNodes(
      visibleGraph.nodes,
      visibleGraph.edges,
      COLLAPSE_THRESHOLD,
      collapsedGroups,
    );
  }, [visibleGraph.nodes, visibleGraph.edges, collapsedGroups]);

  /**
   * 第二步：将 activeNodeId 映射到节点的 selected 标志，
   * 驱动 StoryNodeCard 的 node-status-selected className。
   */
  const displayedNodes = useMemo(() => {
    if (!activeNodeId) return collapsedResult.nodes;

    return collapsedResult.nodes.map((node) => {
      // 对于 storyNode 类型：检查 fullId
      const nodeData = node.data as StoryFlowNodeData | CollapseNodeData | undefined;
      if (node.type === 'storyNode' && nodeData && 'fullId' in nodeData) {
        const isSelected = nodeData.fullId === activeNodeId;
        return isSelected ? { ...node, selected: true } : node;
      }
      return node;
    });
  }, [collapsedResult.nodes, activeNodeId]);

  const displayedGraphLayoutKey = useMemo(() => {
    return displayedNodes
      .map((node) => `${node.id}:${Math.round(node.position.x)}:${Math.round(node.position.y)}`)
      .join('|');
  }, [displayedNodes]);

  /** 当前显示的连线（已折叠过滤后的） */
  const displayedEdges = collapsedResult.edges;

  /** 是否显示空状态 */
  const isEmpty = visibleGraph.nodes.length === 0;

  // V02-033: 解析器错误诊断 — 区分"无文件"和"解析失败"两种空状态
  const errorDiagnostics = diagnostics.filter((d) => d.severity === 'error');
  const hasParseErrors = errorDiagnostics.length > 0 || parseError !== null;

  // --- 空状态渲染 ---
  if (isEmpty) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-bg-secondary)',
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm, 14px)',
          gap: 'var(--space-2, 8px)',
          userSelect: 'none',
        }}
      >
        {/* 简单图标：分支示意 */}
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ opacity: 0.4 }}>
          <circle cx="24" cy="10" r="4" stroke="currentColor" strokeWidth="2" />
          <line x1="24" y1="14" x2="24" y2="22" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="30" r="4" stroke="currentColor" strokeWidth="2" />
          <circle cx="36" cy="30" r="4" stroke="currentColor" strokeWidth="2" />
          <line x1="24" y1="22" x2="12" y2="26" stroke="currentColor" strokeWidth="2" />
          <line x1="24" y1="22" x2="36" y2="26" stroke="currentColor" strokeWidth="2" />
        </svg>
        {hasParseErrors ? (
          <>
            <span style={{ color: 'var(--color-diagnostic-error)' }}>
              {text('graphCanvas.parseErrorTitle', { count: Math.max(1, errorDiagnostics.length) })}
            </span>
            <span style={{ fontSize: 'var(--text-xs, 12px)', opacity: 0.7 }}>
              {text('graphCanvas.parseErrorHint')}
            </span>
          </>
        ) : (
          <>
            <span>{text('graphCanvas.emptyTitle')}</span>
            <span style={{ fontSize: 'var(--text-xs, 12px)', opacity: 0.7 }}>
              {text('graphCanvas.emptyHint')}
            </span>
          </>
        )}
      </div>
    );
  }

  // --- 正常渲染：React Flow 画布 ---
  return (
    <>
      <ReactFlowProvider>
        <div
          className={`graph-canvas-runtime${liveWirePreview ? ' graph-canvas-runtime--wire-dragging' : ''}`}
          style={{ width: '100%', height: '100%', position: 'relative' }}
          onPointerDownCapture={canEditGraph ? handleManualWirePointerDown : undefined}
          onPointerUpCapture={canEditGraph ? handleManualWirePointerUp : undefined}
          onPointerCancelCapture={canEditGraph ? handleManualWirePointerCancel : undefined}
          onMouseDownCapture={canEditGraph ? handleManualWireMouseDown : undefined}
          onMouseUpCapture={canEditGraph ? handleManualWireMouseUp : undefined}
          onWheelCapture={canEditGraph ? suppressAutoFitForUserViewportChange : undefined}
          onClickCapture={canEditGraph ? handleEdgeHitAreaClickCapture : undefined}
        >
          <ReactFlowRuntimeBridge projectRef={screenToFlowPositionRef} />
          <ZoomResetShortcut />
          <GraphFocusController nodes={displayedNodes} />
          <ReactFlow
            nodes={displayedNodes}
            edges={displayedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={canEditGraph ? handleNodeClick : undefined}
            onNodeDoubleClick={canEditGraph ? handleNodeDoubleClick : undefined}
            onNodesChange={canEditGraph ? handleNodesChange : undefined}
            onNodeDrag={canEditGraph ? handleNodeDrag : undefined}
            onNodeDragStart={canEditGraph ? handleNodeDragStart : undefined}
            onNodeDragStop={canEditGraph ? handleNodeDragStop : undefined}
            onNodeContextMenu={canEditGraph ? handleNodeContextMenu : undefined}
            onPaneClick={canEditGraph ? handlePaneClick : undefined}
            onPaneContextMenu={canEditGraph ? handlePaneContextMenu : undefined}
            onEdgeClick={canEditGraph ? handleEdgeClick : undefined}
            onEdgeDoubleClick={canEditGraph ? handleEdgeDoubleClick : undefined}
            onEdgeContextMenu={canEditGraph ? handleEdgeContextMenu : undefined}
            onConnectStart={canEditGraph ? handleConnectStart : undefined}
            onConnect={canEditGraph ? handleConnect : undefined}
            onConnectEnd={canEditGraph ? handleConnectEnd : undefined}
            onReconnectStart={canEditGraph ? handleReconnectStart : undefined}
            onReconnect={canEditGraph ? handleReconnect : undefined}
            onReconnectEnd={canEditGraph ? handleReconnectEnd : undefined}
            isValidConnection={canEditGraph ? handleIsValidConnection : undefined}
            selectionMode={SelectionMode.Partial}
            elevateNodesOnSelect={false}
            fitView={!isGraphLab && displayedNodes.length <= LARGE_GRAPH_LAYOUT_THRESHOLD}
            fitViewOptions={{
              padding: 0.2,
              duration: fitViewDuration,
              maxZoom: GRAPH_AUTO_FIT_MAX_ZOOM,
            }}
            minZoom={canEditGraph ? 0.1 : 0.05}
            maxZoom={canEditGraph ? 2.0 : 0.5}
            onViewportChange={(viewport) => setZoom(viewport.zoom)}
            attributionPosition="bottom-left"
            proOptions={{ hideAttribution: true }}
            connectionLineStyle={{
              stroke: 'var(--color-accent)',
              strokeWidth: 2,
              strokeDasharray: '5,4',
            }}
            style={{ background: isGraphLab ? 'transparent' : 'var(--color-bg-secondary)' }}
          >
            <AutoViewportOnGraphChange
              enabled={
                (isGraphLab || !hasAnyManualLayout) &&
                displayedNodes.length <= LARGE_GRAPH_LAYOUT_THRESHOLD
              }
              isGraphLab={isGraphLab}
              layoutKey={displayedGraphLayoutKey}
              nodes={displayedNodes}
              suppressRef={suppressAutoFitRef}
            />
            {/* 网格背景 — 仅 split 模式 */}
            {canEditGraph && <Background color="var(--color-border-light)" gap={20} size={1} />}

            {/* 缩放/适应/锁定控件 — 仅 split 模式 */}
            {canEditGraph && (
              <Controls
                position="bottom-right"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-1, 4px)',
                }}
              />
            )}

            {/* 迷你地图 — 仅 split 模式（minimap 下自身就是小地图） */}
            {isSplit && (
              <MiniMap
                position="bottom-left"
                style={{
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-default)',
                }}
                maskColor={readCssToken('--color-overlay-subtle')}
                nodeColor={(node: Node) => {
                  if (node.type === 'collapseNode') return readCssToken('--color-text-muted');
                  const nodeData = node.data as unknown as StoryFlowNodeData | undefined;
                  const status = nodeData?.status;
                  switch (status) {
                    case 'error':
                      return readCssToken('--color-diagnostic-error');
                    case 'orphan':
                      return readCssToken('--color-diagnostic-warning');
                    case 'deadend':
                      return readCssToken('--color-text-muted');
                    case 'root':
                      return readCssToken('--color-accent');
                    default:
                      return readCssToken('--color-success');
                  }
                }}
              />
            )}
          </ReactFlow>
          {canEditGraph && liveWirePreview && (
            <svg
              className="graph-live-wire-preview"
              data-testid="graph-live-wire-preview"
              aria-hidden="true"
            >
              <path
                className="graph-live-wire-preview__path"
                d={`M ${liveWirePreview.startPoint.x} ${liveWirePreview.startPoint.y} C ${liveWirePreview.startPoint.x + 120} ${liveWirePreview.startPoint.y}, ${liveWirePreview.currentPoint.x - 120} ${liveWirePreview.currentPoint.y}, ${liveWirePreview.currentPoint.x} ${liveWirePreview.currentPoint.y}`}
              />
            </svg>
          )}
          {hasParseErrors && canEditGraph && (
            <div
              className="graph-canvas-diagnostic-strip"
              data-severity="error"
              role="status"
              aria-live="polite"
            >
              <span className="graph-canvas-diagnostic-strip__dot" aria-hidden="true" />
              <span>{text('parse.graphIncomplete', { count: errorDiagnostics.length })}</span>
            </div>
          )}
        </div>
      </ReactFlowProvider>

      {/* 右键菜单 — 仅 split 模式 */}
      {canEditGraph && (
        <GraphContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          type={contextMenu.type}
          node={contextMenu.node}
          edge={contextMenu.edge}
          onClose={handleContextMenuClose}
        />
      )}

      {canEditGraph && wireDropContext && (
        <GraphWireDropMenu
          key={`${wireDropContext.identity.storySessionId}:${wireDropContext.identity.contentRevision}:${wireDropContext.route.sourceFullId}:${wireDropContext.route.optionIndex}`}
          context={wireDropContext}
          onAction={executeWireDropAction}
          onClose={closeWireDrop}
        />
      )}
    </>
  );
}
