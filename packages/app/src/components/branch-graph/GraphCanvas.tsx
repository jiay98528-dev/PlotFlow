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

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  SelectionMode,
  applyNodeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type OnConnectStartParams,
  reconnectEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../stores/graphStore';
import { useEditorStore } from '../../stores/editorStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { useThemePlatform } from '../ThemePlatformProvider';
import { parsePipelineNow } from '../../services/parsePipeline';
import { graphEditService } from '../../services/graphEditService';
import { parseEdgeId } from '../../stores/edgeStore';
import {
  resolveStoryFullIdForFlowNodeId,
  type StoryFlowNodeData,
} from './adapter';
import { type StoryEdgeData } from './StoryEdge';
import { GraphContextMenu } from './GraphContextMenu';
import type { ContextMenuType } from './GraphContextMenu';
import { CollapseNode } from './CollapseNode';
import { collapseSiblingNodes, COLLAPSE_THRESHOLD } from './layout';
import type { CollapseNodeData } from './layout';
import { layoutNodesInWorker } from './graphLayoutClient';

// ============================================================================
// 自定义节点类型注册表
// ============================================================================

type ScreenToFlowPosition = (position: { readonly x: number; readonly y: number }) => { x: number; y: number };

interface WireDropContext {
  readonly mode: 'connect' | 'reconnect';
  readonly position: { readonly x: number; readonly y: number };
  readonly flowPosition: { readonly x: number; readonly y: number };
  readonly sourceFullId: string;
  readonly optionIndex: number;
}

interface WireDragSource {
  readonly sourceFullId: string;
  readonly optionIndex: number;
}

interface ManualWireDrag extends WireDragSource {
  readonly pointerId: number;
  readonly startPoint: { readonly x: number; readonly y: number };
}

interface LiveWirePreview extends ManualWireDrag {
  readonly currentPoint: { readonly x: number; readonly y: number };
}

function eventToClientPoint(event: globalThis.MouseEvent | globalThis.TouchEvent | unknown): { x: number; y: number } {
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }
  if (event instanceof TouchEvent) {
    const touch = event.changedTouches[0] ?? event.touches[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function readCssToken(name: string): string {
  if (typeof window === 'undefined') return `var(${name})`;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || `var(${name})`;
}

const EDGE_HIT_FALLBACK_RADIUS = 24;
const EDGE_HIT_SAMPLE_COUNT = 24;

function getScreenPointOnPath(path: SVGPathElement, length: number): DOMPoint | null {
  const svg = path.closest('svg');
  const svgCTM = svg?.getScreenCTM();
  if (!svg || !svgCTM) return null;

  const localPoint = path.getPointAtLength(length);
  const groupTransform = path.closest('g')?.getAttribute('transform') ?? '';
  const match = groupTransform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  const tx = match ? Number.parseFloat(match[1]!) : 0;
  const ty = match ? Number.parseFloat(match[2]!) : 0;

  const point = svg.createSVGPoint();
  point.x = localPoint.x + tx;
  point.y = localPoint.y + ty;
  return point.matrixTransform(svgCTM);
}

function findOfficialEdgeIdAtPoint(clientX: number, clientY: number): string | null {
  let best: { edgeId: string; distance: number } | null = null;
  const paths = document.querySelectorAll<SVGPathElement>('.official-graph-edge__hit-area[data-edge-id]');

  for (const path of paths) {
    const edgeId = path.dataset['edgeId'];
    if (!edgeId) continue;

    const totalLength = path.getTotalLength();
    for (let i = 0; i <= EDGE_HIT_SAMPLE_COUNT; i++) {
      const screenPoint = getScreenPointOnPath(path, totalLength * (i / EDGE_HIT_SAMPLE_COUNT));
      if (!screenPoint) continue;

      const distance = Math.hypot(screenPoint.x - clientX, screenPoint.y - clientY);
      if (!best || distance < best.distance) {
        best = { edgeId, distance };
      }
    }
  }

  return best && best.distance <= EDGE_HIT_FALLBACK_RADIUS ? best.edgeId : null;
}

function getStoryNodeIdFromPoint(
  point: { readonly x: number; readonly y: number },
  graphNodes: readonly Pick<Node, 'id' | 'data'>[],
): string | null {
  const element = document.elementFromPoint(point.x, point.y);
  const nodeElement = element instanceof Element
    ? element.closest('.react-flow__node')
    : null;
  if (!(nodeElement instanceof HTMLElement)) return null;

  const rawId =
    nodeElement.dataset['id'] ??
    nodeElement.getAttribute('data-id') ??
    nodeElement.getAttribute('aria-label') ??
    nodeElement.id.replace(/^react-flow__node-/, '');

  const normalized = rawId.trim();
  if (!normalized || normalized.includes('collapse')) return null;
  return resolveStoryFullIdForFlowNodeId(normalized, graphNodes);
}

function isPointInsideReactFlow(point: { readonly x: number; readonly y: number }): boolean {
  const element = document.elementFromPoint(point.x, point.y);
  return element instanceof Element && Boolean(element.closest('.react-flow'));
}

function getWireDragSourceFromTarget(target: EventTarget | null): WireDragSource | null {
  if (!(target instanceof Element)) return null;
  const handle = target.closest('.story-node-connect-handle');
  if (!(handle instanceof HTMLElement)) return null;

  const sourceFullId =
    handle.dataset['sourceFullId'] ??
    handle.dataset['nodeid'] ??
    handle.getAttribute('data-nodeid') ??
    '';
  const optionIndexRaw =
    handle.dataset['optionIndex'] ??
    handle.dataset['handleid']?.replace('option-', '') ??
    handle.getAttribute('data-handleid')?.replace('option-', '') ??
    '';
  const optionIndex = Number.parseInt(optionIndexRaw, 10);

  if (!sourceFullId || !Number.isInteger(optionIndex) || optionIndex < 0) return null;
  return { sourceFullId, optionIndex };
}

function ReactFlowRuntimeBridge({
  projectRef,
}: {
  readonly projectRef: React.MutableRefObject<ScreenToFlowPosition | null>;
}): null {
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    projectRef.current = screenToFlowPosition;
    return () => {
      projectRef.current = null;
    };
  }, [projectRef, screenToFlowPosition]);

  return null;
}

function WireDropMenu({
  context,
  onClose,
}: {
  readonly context: WireDropContext;
  readonly onClose: () => void;
}): React.ReactElement | null {
  const getNodeByFullId = useStoryStore((state) => state.getNodeByFullId);
  const getAllNodes = useStoryStore((state) => state.getAllNodes);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const [query, setQuery] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  const sourceNode = getNodeByFullId(context.sourceFullId);
  const option = sourceNode?.options[context.optionIndex];
  const candidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return getAllNodes()
      .filter((node) => node.fullId !== context.sourceFullId)
      .filter((node) => (
        normalizedQuery.length === 0 ||
        node.title.toLowerCase().includes(normalizedQuery) ||
        node.fullId.toLowerCase().includes(normalizedQuery)
      ))
      .slice(0, 6);
  }, [context.sourceFullId, getAllNodes, query]);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Enter' && candidates[0] && option) {
        event.preventDefault();
        graphEditService.connectOption(option, candidates[0].id);
        setStatusMessage(`Graph Lab 已连接到「${candidates[0].title}」`);
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [candidates, onClose, option, setStatusMessage]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) return;
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  if (!sourceNode || !option) return null;

  const adjustedX = Math.min(context.position.x, window.innerWidth - 300);
  const adjustedY = Math.min(context.position.y, window.innerHeight - 360);

  const createAndConnect = (title: string): void => {
    graphEditService.createNodeAndConnect(sourceNode, option, title, context.flowPosition);
    setStatusMessage(`Graph Lab 已创建并连接「${title}」`);
    onClose();
  };

  const connectExisting = (targetId: string, targetTitle: string): void => {
    graphEditService.connectOption(option, targetId);
    setStatusMessage(`Graph Lab 已连接到「${targetTitle}」`);
    onClose();
  };

  const disconnect = (): void => {
    graphEditService.connectOption(option, null);
    setStatusMessage(`Graph Lab 已断开「${sourceNode.title}」的选项 ${context.optionIndex + 1}`);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="wire-drop-menu nodrag nopan"
      data-testid="wire-drop-menu"
      role="menu"
      style={{ left: adjustedX, top: adjustedY }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="wire-drop-menu__header">
        {context.mode === 'reconnect' ? '重连或断开线缆' : '创建或连接目标'}
      </div>
      <input
        ref={inputRef}
        className="wire-drop-menu__search"
        data-testid="wire-drop-search"
        value={query}
        placeholder="搜索已有节点"
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="wire-drop-menu__section">
        <button type="button" data-testid="wire-drop-create-node" onClick={() => createAndConnect('新节点')}>
          创建普通节点并连接
        </button>
        <button type="button" data-testid="wire-drop-create-ending" onClick={() => createAndConnect('结局')}>
          创建结局节点并连接
        </button>
        {(context.mode === 'reconnect' || option.targetNodeId) && (
          <button type="button" data-testid="wire-drop-disconnect" className="wire-drop-menu__danger" onClick={disconnect}>
            断开此选项
          </button>
        )}
      </div>
      <div className="wire-drop-menu__section wire-drop-menu__results">
        {candidates.map((candidate) => (
          <button
            type="button"
            key={candidate.fullId}
            data-testid="wire-drop-connect-existing"
            onClick={() => connectExisting(candidate.id, candidate.title)}
          >
            <span>{candidate.title}</span>
            <small>{candidate.chapterId}</small>
          </button>
        ))}
        {candidates.length === 0 && (
          <div className="wire-drop-menu__empty">没有匹配节点</div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 键盘快捷键辅助组件
// ============================================================================

/** Ctrl+0 重置缩放为 100% */
function ZoomResetShortcut(): null {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        fitView({ duration: 200 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitView]);

  return null;
}

function AutoFitOnGraphChange({
  enabled,
  nodeCount,
  suppressRef,
}: {
  readonly enabled: boolean;
  readonly nodeCount: number;
  readonly suppressRef: React.RefObject<boolean>;
}): null {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (!enabled || nodeCount === 0) return;
    const frame = requestAnimationFrame(() => {
      if (suppressRef.current) return;
      fitView({ padding: 0.2, duration: 200 });
    });
    return () => cancelAnimationFrame(frame);
  }, [enabled, fitView, nodeCount, suppressRef]);

  return null;
}

// ============================================================================
// 常量
// ============================================================================

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
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const collapsedGroups = useGraphStore((state) => state.collapsedGroups);
  const selectNode = useGraphStore((state) => state.selectNode);
  const setZoom = useGraphStore((state) => state.setZoom);
  const renamingNodeId = useGraphStore((state) => state.renamingNodeId);
  const setRenamingNodeId = useGraphStore((state) => state.setRenamingNodeId);
  const setEditing = useGraphStore((state) => state.setEditing);
  const setNodes = useGraphStore((state) => state.setNodes);
  const setEdges = useGraphStore((state) => state.setEdges);

  const editorInstance = useEditorStore((state) => state.editorInstance);
  const activeNodeId = useEditorStore((state) => state.activeNodeId);

  // V02-033: 解析器错误诊断 — 驱动分支图错误横幅和空状态提示
  const diagnostics = useEditorStore((s) => s.diagnostics);

  // StoryStore — 用于查找 AST 节点信息（选项行号、targetNodeId 等）
  const getNodeByFullId = useStoryStore((state) => state.getNodeByFullId);
  const hasAnyManualLayout = useStoryStore((state) => (state.plotFlowData?.layout?.graph.nodes.length ?? 0) > 0);

  // UIStore — 条件编辑器面板控制
  const openConditionEditor = useUIStore((state) => state.openConditionEditor);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);

  const connectDidSucceed = React.useRef(false);
  const connectStartParams = React.useRef<OnConnectStartParams | null>(null);
  const reconnectDidSucceed = React.useRef(false);
  const reconnectEdgeRef = React.useRef<Edge | null>(null);
  const screenToFlowPositionRef = React.useRef<ScreenToFlowPosition | null>(null);
  const manualWireDragRef = React.useRef<ManualWireDrag | null>(null);
  const asyncLayoutSignatureRef = React.useRef<string | null>(null);
  const altPressedRef = React.useRef(false);
  const suppressAutoFitRef = React.useRef(false);
  const suppressAutoFitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextPaneClickRef = React.useRef(false);
  const [liveWirePreview, setLiveWirePreview] = useState<LiveWirePreview | null>(null);
  const [wireDropContext, setWireDropContext] = useState<WireDropContext | null>(null);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Alt') altPressedRef.current = true;
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.key === 'Alt') altPressedRef.current = false;
    };
    const handleBlur = (): void => {
      altPressedRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (suppressAutoFitTimerRef.current !== null) {
        clearTimeout(suppressAutoFitTimerRef.current);
      }
    };
  }, []);

  const suppressAutoFitForUserViewportChange = useCallback(() => {
    suppressAutoFitRef.current = true;
    if (suppressAutoFitTimerRef.current !== null) {
      clearTimeout(suppressAutoFitTimerRef.current);
    }
    suppressAutoFitTimerRef.current = setTimeout(() => {
      suppressAutoFitRef.current = false;
      suppressAutoFitTimerRef.current = null;
    }, 800);
  }, []);

  // ==========================================================================
  // 连线连接处理 (M2-09)
  // ==========================================================================

  /**
   * 拖拽连线开始事件 — 设置操作锁。
   * 操作锁阻止编辑器侧的 debounce 文本→图同步覆盖此次更改。
   */
  const handleConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      if (renamingNodeId !== null) return; // M2-08 锁：重命名期间禁止连线操作
      connectDidSucceed.current = false;
      connectStartParams.current = params;
      setEditing(true);
    },
    [renamingNodeId, setEditing],
  );

  /**
   * 连线重连开始事件 — 设置操作锁。
   * React Flow v12: 当用户拖拽已有连线的端点时触发。
   */
  const handleReconnectStart = useCallback(
    (_event: unknown, edge: Edge, _handleType: unknown) => {
      if (renamingNodeId !== null) return;
      reconnectDidSucceed.current = false;
      reconnectEdgeRef.current = edge;
      setEditing(true);
    },
    [renamingNodeId, setEditing],
  );

  /**
   * 连线重连结束事件 — 释放操作锁 + 触发重新解析。
   * React Flow v12: 在 onReconnect 之后触发。
   */
  const handleReconnectEnd = useCallback(
    (event: unknown, edge: Edge, _handleType: unknown) => {
      setEditing(false);
      if (!reconnectDidSucceed.current) {
        const edgeToReconnect = reconnectEdgeRef.current ?? edge;
        reconnectEdgeRef.current = null;
        try {
          const { sourceFullId, optionIndex } = parseEdgeId(edgeToReconnect.id);
          const sourceNode = getNodeByFullId(sourceFullId);
          const option = sourceNode?.options[optionIndex];
          const clientPoint = eventToClientPoint(event);
          const flowPosition = screenToFlowPositionRef.current?.(clientPoint) ?? clientPoint;
          const dropTargetFullId = getStoryNodeIdFromPoint(clientPoint, nodes);
          if (sourceNode && option && dropTargetFullId && dropTargetFullId !== sourceFullId) {
            const targetNode = getNodeByFullId(dropTargetFullId);
            if (targetNode) {
              graphEditService.connectOption(option, targetNode.id);
              setStatusMessage(`Graph Lab 已重连到「${targetNode.title}」`);
              return;
            }
          }
          setWireDropContext({
            mode: 'reconnect',
            position: clientPoint,
            flowPosition,
            sourceFullId,
            optionIndex,
          });
          return;
        } catch {
          // eslint-disable-next-line no-console
          console.warn('[GraphCanvas] reconnect blank drop failed — invalid edge id:', edgeToReconnect.id);
        }
      }
      reconnectDidSucceed.current = false;
      reconnectEdgeRef.current = null;
      const editor = useEditorStore.getState().editorInstance;
      if (editor) { parsePipelineNow(editor.getValue()); }
    },
    [getNodeByFullId, nodes, setEditing, setStatusMessage],
  );

  /**
   * 拖拽连线结束事件 — 释放操作锁。
   * 在 onConnect 之后触发（React Flow 先 onConnect 再 onConnectEnd）。
   */
  const handleConnectEnd = useCallback(() => {
    setEditing(false);
  }, [setEditing]);

  /**
   * 连接验证 — 防止非法连接。
   *
   * 非法连接包括：
   * - 自连接（source === target）
   * - 重复连接（同一 source node 已有指向同一 target node 的连线）
   * - source 或 target 不是有效的 StoryNode
   *
   * React Flow 调用此函数时传入 Edge | Connection，两者均有 source/target。
   */
  const handleIsValidConnection = useCallback(
    (connection: Edge | Connection): boolean => {
      // 验证 1: 不允许自连接
      if (connection.source === connection.target) {
        return false;
      }

      // 验证 2: 不允许重复连接（需区分 sourceHandle — 同一节点的不同选项可指向同一目标）
      const connSourceHandle = connection.sourceHandle ?? '';
      const duplicate = edges.some(
        (e) =>
          e.source === connection.source &&
          e.target === connection.target &&
          (e.sourceHandle ?? '') === connSourceHandle,
      );
      if (duplicate) {
        return false;
      }

      // 验证 3: source 和 target 必须是有效的 StoryNode
      const sourceNode = getNodeByFullId(connection.source);
      const targetNode = getNodeByFullId(connection.target);
      if (!sourceNode || !targetNode) {
        return false;
      }

      return true;
    },
    [edges, getNodeByFullId],
  );

  /**
   * 连线成功事件 — 核心处理逻辑。
   *
   * 当用户从 source node 的选项 handle 拖拽到 target node 时触发。
   * 执行流程：
   * 1. 解析 sourceHandle → optionIndex
   * 2. 查找源节点、目标节点与对应选项
   * 3. 通过 graphEditService 生成 .mdstory patch 并触发解析
   */
  const handleConnect = useCallback(
    (connection: Connection) => {
      // 步骤 1: 解析选项索引
      const optionIndex = parseInt(
        connection.sourceHandle?.replace('option-', '') ?? '-1',
        10,
      );
      if (optionIndex < 0) return;

      // 步骤 2: 查找源节点和目标节点
      const sourceNode = getNodeByFullId(connection.source);
      const targetNode = getNodeByFullId(connection.target);
      if (!sourceNode || !targetNode) return;

      // 步骤 3: 获取对应选项
      const option = sourceNode.options[optionIndex];
      if (!option) return;

      graphEditService.connectOption(option, targetNode.id);
    },
    [getNodeByFullId],
  );

  /**
   * 连线重连事件 — React Flow v12 edge reconnection 核心处理。
   *
   * 当用户将已有连线的端点拖拽到新目标节点时触发。
   * 执行流程：
   * 1. 解析旧 edge.id → sourceFullId + optionIndex
   * 2. 查找新目标节点 → 更新 -> 节点：XXX 文本
   * 3. 调用 reconnectEdge() + setEdges() 实现即时视觉反馈
   */
  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      try {
        // 步骤 1: 解析旧连线 ID
        const { sourceFullId, optionIndex } = parseEdgeId(oldEdge.id);
        const sourceNode = getNodeByFullId(sourceFullId);
        if (!sourceNode) return;

        const option = sourceNode.options[optionIndex];
        if (!option) return;

        // 步骤 2: 查找新目标节点
        const targetNode = getNodeByFullId(newConnection.target);
        if (!targetNode) return;

        reconnectDidSucceed.current = true;
        graphEditService.connectOption(option, targetNode.id);

        // 步骤 4: 即时视觉反馈 — reconnectEdge + setEdges
        const currentEdges = useGraphStore.getState().edges;
        const reconnected = reconnectEdge(oldEdge, newConnection, currentEdges, {
          shouldReplaceId: true,
        });
        setEdges(reconnected);
      } catch {
        // parseEdgeId 解析失败或任何异常 → 日志记录
        // eslint-disable-next-line no-console
        console.warn('[GraphCanvas] handleReconnect failed for edge:', oldEdge.id);
      }
    },
    [getNodeByFullId, setEdges],
  );

  // ==========================================================================
  // 右键菜单状态
  // ==========================================================================

  const [contextMenu, setContextMenu] = useState<{
    readonly isOpen: boolean;
    readonly position: { readonly x: number; readonly y: number };
    readonly type: ContextMenuType;
    readonly node: Node<StoryFlowNodeData> | null;
    /** 右键点击的连线对象（type='edge' 时有效） */
    readonly edge: Edge<StoryEdgeData> | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    type: 'pane',
    node: null,
    edge: null,
  });

  /** 节点右键菜单 */
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      // 操作锁 (M2-08)：内联重命名期间禁用右键菜单
      if (renamingNodeId !== null) return;
      setContextMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        type: 'node',
        node: node as Node<StoryFlowNodeData>,
        edge: null,
      });
    },
    [renamingNodeId],
  );

  /** 空白区域右键菜单 */
  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      // 操作锁 (M2-08)：内联重命名期间禁用右键菜单
      if (renamingNodeId !== null) return;
      setContextMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        type: 'pane',
        node: null,
        edge: null,
      });
    },
    [renamingNodeId],
  );

  /** 关闭右键菜单 */
  const handleContextMenuClose = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // ==========================================================================
  // 连线事件处理器 (V02-014: Edge Interactivity)
  // ==========================================================================

  /**
   * 连线点击 — 选中连线 + Alt+删除检测 (FR-1, V02-016)。
   *
   * 普通点击：选中连线（视觉高亮）
   * Alt+点击：删除连线 → 确认后移除文本中的 -> 节点：XXX
   */
  const deleteEdgeById = useCallback(
    (edgeId: string): void => {
      try {
        const { sourceFullId, optionIndex } = parseEdgeId(edgeId);
        const sourceNode = getNodeByFullId(sourceFullId);
        if (!sourceNode) return;

        const option = sourceNode.options[optionIndex];
        if (!option) return;

        graphEditService.connectOption(option, null);
      } catch {
        // eslint-disable-next-line no-console
        console.warn('[GraphCanvas] Alt+click edge delete failed - invalid edge id:', edgeId);
      }
    },
    [getNodeByFullId],
  );

  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge<StoryEdgeData>) => {
      if (renamingNodeId !== null) return;

      // Alt+点击 → 删除连线 (FR-1)
      if (event.altKey || altPressedRef.current) {
        event.preventDefault();

        try {
          const { sourceFullId, optionIndex } = parseEdgeId(edge.id);
          const sourceNode = getNodeByFullId(sourceFullId);
          if (!sourceNode) return;

          const option = sourceNode.options[optionIndex];
          if (!option) return;

          graphEditService.connectOption(option, null);
        } catch {
          // parseEdgeId 解析失败 → 记录日志，不崩溃
          // eslint-disable-next-line no-console
          console.warn('[GraphCanvas] Alt+click edge delete failed — invalid edge id:', edge.id);
        }
      }
    },
    [renamingNodeId, getNodeByFullId],
  );

  const handleEdgeHitAreaClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!(event.altKey || altPressedRef.current) || renamingNodeId !== null) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const edgeElement = target.closest<HTMLElement>(
        '[data-edge-id].official-graph-edge__hit-area, [data-edge-id].official-graph-edge',
      );
      const edgeId = edgeElement?.dataset['edgeId'] ?? findOfficialEdgeIdAtPoint(event.clientX, event.clientY);
      if (!edgeId) return;

      event.preventDefault();
      event.stopPropagation();
      deleteEdgeById(edgeId);
    },
    [renamingNodeId, deleteEdgeById],
  );

  useEffect(() => {
    if (!canEditGraph) return undefined;

    const handleDocumentClick = (event: MouseEvent): void => {
      if (!(event.altKey || altPressedRef.current) || renamingNodeId !== null) return;

      const edgeId = findOfficialEdgeIdAtPoint(event.clientX, event.clientY);
      if (!edgeId) return;

      event.preventDefault();
      event.stopPropagation();
      deleteEdgeById(edgeId);
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [canEditGraph, renamingNodeId, deleteEdgeById]);

  /**
   * 连线双击 → 打开条件编辑器 (DG-3, V02-017 + V02-030)。
   *
   * 解析 edge.id → 找到对应选项 → 调用 openConditionEditor 打开面板。
   */
  const handleEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge<StoryEdgeData>) => {
      if (renamingNodeId !== null) return;

      try {
        const { sourceFullId, optionIndex } = parseEdgeId(edge.id);
        openConditionEditor(sourceFullId, optionIndex);
      } catch {
        // parseEdgeId 解析失败 → 记录日志，不崩溃
        // eslint-disable-next-line no-console
        console.warn('[GraphCanvas] Edge double-click failed — invalid edge id:', edge.id);
      }
    },
    [renamingNodeId, openConditionEditor],
  );

  /**
   * 连线右键 → EdgeContextMenu (DG-2, V02-015)。
   *
   * 在连线中点弹出右键菜单，包含：
   * - 编辑条件（双击等效）
   * - 删除连线
   * - 跳转到源节点 / 跳转到目标节点
   */
  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge<StoryEdgeData>) => {
      event.preventDefault();
      if (renamingNodeId !== null) return;

      setContextMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        type: 'edge',
        node: null,
        edge,
      });
    },
    [renamingNodeId],
  );

  // ==========================================================================

  /** 节点点击处理：选中节点 → 编辑器跳转到对应行 */
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // 操作锁 (M2-08)：内联重命名期间禁止点击其他节点
      if (renamingNodeId !== null) return;

      // 忽略折叠虚拟节点的点击（由 CollapseNode 组件内部处理）
      if (node.type === 'collapseNode') return;

      const nodeData = node.data as StoryFlowNodeData | undefined;
      if (!nodeData) return;

      const { lineNumber } = nodeData;

      // 1. 设置分支图选中状态 → App.tsx 中的订阅自动同步 editorStore
      selectNode(node.id);

      // 2. 如果编辑器实例可用，执行编程式跳转（必须直接操作 Monaco 实例）
      if (editorInstance) {
        editorInstance.revealLine(lineNumber);
        editorInstance.setPosition({ lineNumber, column: 1 });
        editorInstance.focus();
      }
    },
    [selectNode, editorInstance, renamingNodeId],
  );

  /** 画布点击空白处：取消选中 */
  const handlePaneClick = useCallback(() => {
    // 操作锁 (M2-08)：内联重命名期间忽略空白点击
    if (renamingNodeId !== null) return;
    if (suppressNextPaneClickRef.current) {
      suppressNextPaneClickRef.current = false;
      return;
    }
    setWireDropContext(null);
    selectNode(null);
  }, [selectNode, renamingNodeId]);

  /**
   * 双击节点 → 进入内联重命名模式 (V02-020)。
   *
   * 设置 renamingNodeId 触发 StoryNodeCard 的内联输入框。
   * StoryNodeCard 自身也有 handleDoubleClick，
   * 此处通过 React Flow 的 onNodeDoubleClick 确保事件可靠到达。
   */
  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // 忽略折叠虚拟节点的双击
      if (node.type === 'collapseNode') return;

      const nodeData = node.data as StoryFlowNodeData | undefined;
      if (!nodeData) return;

      setRenamingNodeId(node.id);
    },
    [setRenamingNodeId],
  );

  // ==========================================================================
  // 拖拽创建新节点逻辑 (V02-021)
  // ==========================================================================

  /**
   * 包裹 handleConnect，追踪连接成功。
   */
  const handleConnectWithTrack = useCallback(
    (connection: Connection) => {
      connectDidSucceed.current = true;
      handleConnect(connection);
    },
    [handleConnect],
  );

  /**
   * 包裹 handleConnectEnd，检测拖拽到空白区域。
   *
   * 若用户从选项 handle 拖拽到没有目标节点的空白区域 → 插入新节点 + 自动连接 (FR-2, V02-021)。
   */
  const handleConnectEndWithCreate = useCallback(
    (event: globalThis.MouseEvent | globalThis.TouchEvent) => {
      // 先释放操作锁
      handleConnectEnd();

      // 如果已经成功连接，不需要创建新节点
      if (connectDidSucceed.current) {
        connectDidSucceed.current = false;
        connectStartParams.current = null;
        const editor = useEditorStore.getState().editorInstance;
        if (editor) { parsePipelineNow(editor.getValue()); }
        return;
      }

      const startParams = connectStartParams.current;
      connectStartParams.current = null;
      const sourceNodeId = startParams?.nodeId;
      const sourceHandle = startParams?.handleId;
      const optionIndex = parseInt(sourceHandle?.replace('option-', '') ?? '-1', 10);
      const sourceNode = sourceNodeId ? getNodeByFullId(sourceNodeId) : undefined;
      const option = optionIndex >= 0 ? sourceNode?.options[optionIndex] : undefined;

      if (!sourceNode || !option) {
        setStatusMessage('拖拽到空白 — 未找到可连接的选项');
        return;
      }

      const clientPoint = eventToClientPoint(event);
      const flowPosition = screenToFlowPositionRef.current?.(clientPoint) ?? clientPoint;
      const dropTargetFullId = getStoryNodeIdFromPoint(clientPoint, nodes);
      if (dropTargetFullId && dropTargetFullId !== sourceNode.fullId) {
        const targetNode = getNodeByFullId(dropTargetFullId);
        if (targetNode) {
          graphEditService.connectOption(option, targetNode.id);
          setStatusMessage(`Graph Lab 已连接到「${targetNode.title}」`);
          return;
        }
      }
      setWireDropContext({
        mode: 'connect',
        position: clientPoint,
        flowPosition,
        sourceFullId: sourceNode.fullId,
        optionIndex,
      });
      setStatusMessage('Graph Lab 请选择线缆目标');
    },
    [getNodeByFullId, handleConnectEnd, setStatusMessage],
  );

  // Graph Lab 自有线缆手势兜底：避免 React Flow 节点拖拽抢走端口拖线。
  const handleManualWirePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (renamingNodeId !== null) return;
      const source = getWireDragSourceFromTarget(event.target);
      if (!source) return;

      manualWireDragRef.current = {
        ...source,
        pointerId: event.pointerId,
        startPoint: { x: event.clientX, y: event.clientY },
      };
      setLiveWirePreview({
        ...source,
        pointerId: event.pointerId,
        startPoint: { x: event.clientX, y: event.clientY },
        currentPoint: { x: event.clientX, y: event.clientY },
      });
      setEditing(true);
      setWireDropContext(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    },
    [renamingNodeId, setEditing],
  );

  const handleManualWireMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (renamingNodeId !== null || manualWireDragRef.current) return;
      const source = getWireDragSourceFromTarget(event.target);
      if (!source) return;

      manualWireDragRef.current = {
        ...source,
        pointerId: -1,
        startPoint: { x: event.clientX, y: event.clientY },
      };
      setLiveWirePreview({
        ...source,
        pointerId: -1,
        startPoint: { x: event.clientX, y: event.clientY },
        currentPoint: { x: event.clientX, y: event.clientY },
      });
      setEditing(true);
      setWireDropContext(null);
      event.preventDefault();
      event.stopPropagation();
    },
    [renamingNodeId, setEditing],
  );

  const finishManualWireDrag = useCallback(
    (clientPoint: { readonly x: number; readonly y: number }): boolean => {
      const drag = manualWireDragRef.current;
      if (!drag) return false;

      manualWireDragRef.current = null;
      setLiveWirePreview(null);
      setEditing(false);
      const distance = Math.hypot(clientPoint.x - drag.startPoint.x, clientPoint.y - drag.startPoint.y);
      if (distance < 4) return true;
      suppressNextPaneClickRef.current = true;

      if (!isPointInsideReactFlow(clientPoint)) {
        setStatusMessage('Graph Lab 已取消线缆拖拽');
        return true;
      }

      const sourceNode = getNodeByFullId(drag.sourceFullId);
      const option = sourceNode?.options[drag.optionIndex];
      if (!sourceNode || !option) {
        setStatusMessage('拖拽线缆 — 未找到可连接的选项');
        return true;
      }

      const dropTargetFullId = getStoryNodeIdFromPoint(clientPoint, nodes);
      if (dropTargetFullId && dropTargetFullId !== sourceNode.fullId) {
        const targetNode = getNodeByFullId(dropTargetFullId);
        if (targetNode) {
          graphEditService.connectOption(option, targetNode.id);
          setStatusMessage(`Graph Lab 已连接到「${targetNode.title}」`);
          return true;
        }
      }

      const flowPosition = screenToFlowPositionRef.current?.(clientPoint) ?? clientPoint;
      setWireDropContext({
        mode: option.targetNodeId ? 'reconnect' : 'connect',
        position: clientPoint,
        flowPosition,
        sourceFullId: sourceNode.fullId,
        optionIndex: drag.optionIndex,
      });
      setStatusMessage('Graph Lab 请选择线缆目标');
      return true;
    },
    [getNodeByFullId, nodes, setEditing, setStatusMessage],
  );

  const handleManualWirePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = manualWireDragRef.current;
      if (!drag) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finishManualWireDrag({ x: event.clientX, y: event.clientY });
      event.preventDefault();
      event.stopPropagation();
    },
    [finishManualWireDrag],
  );

  const handleManualWireMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const drag = manualWireDragRef.current;
      if (!drag) return;

      finishManualWireDrag({ x: event.clientX, y: event.clientY });
      event.preventDefault();
      event.stopPropagation();
    },
    [finishManualWireDrag],
  );

  useEffect(() => {
    const handleGlobalPointerMove = (event: PointerEvent): void => {
      if (!manualWireDragRef.current) return;
      setLiveWirePreview((preview) => preview ? {
        ...preview,
        currentPoint: { x: event.clientX, y: event.clientY },
      } : preview);
    };
    const handleGlobalPointerUp = (event: PointerEvent): void => {
      if (!manualWireDragRef.current) return;
      if (finishManualWireDrag({ x: event.clientX, y: event.clientY })) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleGlobalMouseMove = (event: MouseEvent): void => {
      if (!manualWireDragRef.current) return;
      setLiveWirePreview((preview) => preview ? {
        ...preview,
        currentPoint: { x: event.clientX, y: event.clientY },
      } : preview);
    };
    const handleGlobalMouseUp = (event: MouseEvent): void => {
      if (!manualWireDragRef.current) return;
      if (finishManualWireDrag({ x: event.clientX, y: event.clientY })) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, true);
    window.addEventListener('pointerup', handleGlobalPointerUp, true);
    window.addEventListener('mousemove', handleGlobalMouseMove, true);
    window.addEventListener('mouseup', handleGlobalMouseUp, true);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove, true);
      window.removeEventListener('pointerup', handleGlobalPointerUp, true);
      window.removeEventListener('mousemove', handleGlobalMouseMove, true);
      window.removeEventListener('mouseup', handleGlobalMouseUp, true);
    };
  }, [finishManualWireDrag]);

  const handleManualWirePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = manualWireDragRef.current;
      if (!drag) return;
      manualWireDragRef.current = null;
      setLiveWirePreview(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setEditing(false);
    },
    [setEditing],
  );

  // ==========================================================================
  // 节点位置拖拽持久化
  // ==========================================================================

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const nodeIds = new Set(nodes.map((node) => node.id));
      const relevantChanges = changes.filter((change) => !('id' in change) || nodeIds.has(change.id));
      if (relevantChanges.length === 0) return;
      setNodes(applyNodeChanges(relevantChanges, nodes));
    },
    [nodes, setNodes],
  );

  const handleNodeDragStart = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      if (renamingNodeId !== null || node.type === 'collapseNode') return;
      setEditing(true);
    },
    [renamingNodeId, setEditing],
  );

  const persistDraggedNodePosition = useCallback(
    (node: Node, notify: boolean) => {
      if (node.type === 'collapseNode') return;
      const nodeData = node.data as StoryFlowNodeData | undefined;
      if (!nodeData?.fullId) return;
      const storyNode = getNodeByFullId(nodeData.fullId);
      if (!storyNode) return;
      graphEditService.updateNodePosition(storyNode, node.position);
      if (notify) {
        setStatusMessage(`Graph Lab 已保存「${storyNode.title}」的位置`);
      }
    },
    [getNodeByFullId, setStatusMessage],
  );

  const handleNodeDrag = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      persistDraggedNodePosition(node, false);
    },
    [persistDraggedNodePosition],
  );

  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node) => {
      setEditing(false);
      persistDraggedNodePosition(node, true);
    },
    [persistDraggedNodePosition, setEditing],
  );

  // ==========================================================================
  // 性能模式检测 (M2-14)
  // ==========================================================================

  /** 节点数超过 200 时自动启用性能模式 */
  const isPerfMode = nodes.length > 200;

  /** 性能模式下 fitView 动画时长（更大值 = 更低帧率体感） */
  const fitViewDuration = isGraphLab ? 0 : (isPerfMode ? 120 : 200);

  const hasCompleteManualLayout = useMemo(() => {
    return nodes.length > 0 && nodes.every((node) => {
      const data = node.data as StoryFlowNodeData | undefined;
      return Boolean(data?.persistedPosition);
    });
  }, [nodes]);

  useEffect(() => {
    if (hasCompleteManualLayout || nodes.length === 0) return;
    const signature = [
      nodes.map((node) => node.id).join('|'),
      edges.map((edge) => `${edge.source}->${edge.target}`).join('|'),
      nodes
        .map((node) => {
          const data = node.data as StoryFlowNodeData | undefined;
          const persisted = data?.persistedPosition;
          return persisted ? `${node.id}:${persisted.x}:${persisted.y}` : `${node.id}:auto`;
        })
        .join('|'),
    ].join('::');
    if (asyncLayoutSignatureRef.current === signature) return;
    asyncLayoutSignatureRef.current = signature;

    void layoutNodesInWorker(nodes, edges)
      .then((result) => {
        if (result.stale || asyncLayoutSignatureRef.current !== signature) return;
        setNodes(result.nodes.map((node) => {
          const data = node.data as StoryFlowNodeData | undefined;
          const persisted = data?.persistedPosition;
          return persisted ? { ...node, position: { ...persisted } } : node;
        }));
        if (result.elapsedMs > 250) {
          setStatusMessage(`Graph layout completed in ${Math.round(result.elapsedMs)}ms`);
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        setStatusMessage(message);
      });
  }, [edges, hasCompleteManualLayout, nodes, setNodes, setStatusMessage]);

  // ==========================================================================
  // 同层折叠 + 节点高亮派生 (M2-15, M2-04)
  // ==========================================================================

  /**
   * 第一步：应用同层节点折叠。
   * 使用 collapsedGroups 状态决定哪些组处于折叠状态。
   */
  const collapsedResult = useMemo(() => {
    if (nodes.length === 0) return { nodes: [] as Node[], edges: [] as Edge[] };
    return collapseSiblingNodes(nodes, edges, COLLAPSE_THRESHOLD, collapsedGroups);
  }, [nodes, edges, collapsedGroups]);

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

  /** 当前显示的连线（已折叠过滤后的） */
  const displayedEdges = collapsedResult.edges;

  /** 是否显示空状态 */
  const isEmpty = nodes.length === 0;

  // V02-033: 解析器错误诊断 — 区分"无文件"和"解析失败"两种空状态
  const errorDiagnostics = diagnostics.filter((d) => d.severity === 'error');
  const hasParseErrors = errorDiagnostics.length > 0;

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
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          style={{ opacity: 0.4 }}
        >
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
              解析遇到 {errorDiagnostics.length} 个错误
            </span>
            <span style={{ fontSize: 'var(--text-xs, 12px)', opacity: 0.7 }}>
              请修复编辑器中的错误以生成完整分支图
            </span>
          </>
        ) : (
          <>
            <span>打开 .mdstory 文件以查看分支图</span>
            <span style={{ fontSize: 'var(--text-xs, 12px)', opacity: 0.7 }}>
              编写 Markdown 分支剧情后，分支图将在此处自动生成
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
        <AutoFitOnGraphChange enabled={!hasAnyManualLayout} nodeCount={displayedNodes.length} suppressRef={suppressAutoFitRef} />
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
          onConnect={canEditGraph ? handleConnectWithTrack : undefined}
          onConnectEnd={canEditGraph ? handleConnectEndWithCreate : undefined}
          onReconnectStart={canEditGraph ? handleReconnectStart : undefined}
          onReconnect={canEditGraph ? handleReconnect : undefined}
          onReconnectEnd={canEditGraph ? handleReconnectEnd : undefined}
          isValidConnection={canEditGraph ? handleIsValidConnection : undefined}
          selectionMode={SelectionMode.Partial}
          elevateNodesOnSelect={false}
          fitView
          fitViewOptions={{ padding: 0.2, duration: fitViewDuration }}
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
          style={{ background: 'var(--color-bg-secondary)' }}
        >
        {/* 网格背景 — 仅 split 模式 */}
        {canEditGraph && (
          <Background
            color="var(--color-border-light)"
            gap={20}
            size={1}
          />
        )}

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
                case 'error': return readCssToken('--color-diagnostic-error');
                case 'orphan': return readCssToken('--color-diagnostic-warning');
                case 'deadend': return readCssToken('--color-text-muted');
                case 'root': return readCssToken('--color-accent');
                default: return readCssToken('--color-success');
              }
            }}
          />
        )}
      </ReactFlow>
      {canEditGraph && liveWirePreview && (
        <svg className="graph-live-wire-preview" data-testid="graph-live-wire-preview" aria-hidden="true">
          <path
            className="graph-live-wire-preview__path"
            d={`M ${liveWirePreview.startPoint.x} ${liveWirePreview.startPoint.y} C ${liveWirePreview.startPoint.x + 120} ${liveWirePreview.startPoint.y}, ${liveWirePreview.currentPoint.x - 120} ${liveWirePreview.currentPoint.y}, ${liveWirePreview.currentPoint.x} ${liveWirePreview.currentPoint.y}`}
          />
        </svg>
      )}
    </div>
    </ReactFlowProvider>

      {/* ── 解析错误警告横幅 (V02-033) ── */}
      {hasParseErrors && canEditGraph && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: '6px 16px',
            background: 'var(--color-diagnostic-error)',
            color: 'var(--color-text-inverse)',
            fontSize: '12px',
            fontFamily: 'var(--font-ui, system-ui, sans-serif)',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: 0.95,
          }}
        >
          <span>⚠️</span>
          <span>
            编辑器中有 {errorDiagnostics.length} 个语法错误，分支图可能不完整
          </span>
        </div>
      )}

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
        <WireDropMenu
          context={wireDropContext}
          onClose={() => setWireDropContext(null)}
        />
      )}
    </>
  );
}
