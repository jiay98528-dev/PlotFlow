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
  type Node,
  type Edge,
  type Connection,
  type OnConnectStartParams,
  reconnectEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../stores/graphStore';
import { useEditorStore } from '../../stores/editorStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { parsePipelineNow } from '../../services/parsePipeline';
import { parseEdgeId } from '../../stores/edgeStore';
import type { StoryFlowNodeData } from './adapter';
import { findTargetArrowIndex, closeUnclosedBrackets } from './adapter-helpers';
import type { StoryEdgeData } from './StoryEdge';
import { StoryNodeCard } from './StoryNodeCard';
import { edgeTypes } from './StoryEdge';
import { GraphContextMenu } from './GraphContextMenu';
import type { ContextMenuType } from './GraphContextMenu';
import { CollapseNode } from './CollapseNode';
import { collapseSiblingNodes, COLLAPSE_THRESHOLD } from './layout';
import type { CollapseNodeData } from './layout';

// ============================================================================
// 自定义节点类型注册表
// ============================================================================

const nodeTypes = {
  storyNode: StoryNodeCard,
  collapseNode: CollapseNode,
};

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

// ============================================================================
// 常量
// ============================================================================

// ============================================================================
// GraphCanvas 主组件
// ============================================================================

export interface GraphCanvasProps {
  readonly viewMode?: 'split' | 'minimap';
}

export function GraphCanvas({ viewMode = 'split' }: GraphCanvasProps): React.ReactElement {
  const isSplit = viewMode === 'split';
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const collapsedGroups = useGraphStore((state) => state.collapsedGroups);
  const selectNode = useGraphStore((state) => state.selectNode);
  const setZoom = useGraphStore((state) => state.setZoom);
  const renamingNodeId = useGraphStore((state) => state.renamingNodeId);
  const setRenamingNodeId = useGraphStore((state) => state.setRenamingNodeId);
  const setEditing = useGraphStore((state) => state.setEditing);
  const setEdges = useGraphStore((state) => state.setEdges);

  const editorInstance = useEditorStore((state) => state.editorInstance);
  const editorContent = useEditorStore((state) => state.content);
  const setContent = useEditorStore((state) => state.setContent);
  const activeNodeId = useEditorStore((state) => state.activeNodeId);

  // V02-033: 解析器错误诊断 — 驱动分支图错误横幅和空状态提示
  const diagnostics = useEditorStore((s) => s.diagnostics);

  // StoryStore — 用于查找 AST 节点信息（选项行号、targetNodeId 等）
  const getNodeByFullId = useStoryStore((state) => state.getNodeByFullId);

  // UIStore — 条件编辑器面板控制
  const openConditionEditor = useUIStore((state) => state.openConditionEditor);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);

  // ==========================================================================
  // 连线连接处理 (M2-09)
  // ==========================================================================

  /**
   * 拖拽连线开始事件 — 设置操作锁。
   * 操作锁阻止编辑器侧的 debounce 文本→图同步覆盖此次更改。
   */
  const handleConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, _params: OnConnectStartParams) => {
      if (renamingNodeId !== null) return; // M2-08 锁：重命名期间禁止连线操作
      setEditing(true);
    },
    [renamingNodeId, setEditing],
  );

  /**
   * 连线重连开始事件 — 设置操作锁。
   * React Flow v12: 当用户拖拽已有连线的端点时触发。
   */
  const handleReconnectStart = useCallback(
    (_event: unknown, _edge: Edge, _handleType: unknown) => {
      if (renamingNodeId !== null) return;
      setEditing(true);
    },
    [renamingNodeId, setEditing],
  );

  /**
   * 连线重连结束事件 — 释放操作锁 + 触发重新解析。
   * React Flow v12: 在 onReconnect 之后触发。
   */
  const handleReconnectEnd = useCallback(
    (_event: unknown, _edge: Edge, _handleType: unknown) => {
      setEditing(false);
      const editor = useEditorStore.getState().editorInstance;
      if (editor) { parsePipelineNow(editor.getValue()); }
    },
    [setEditing],
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
   * 2. 查找对应选项的文本行
   * 3. 更新 -> 节点：目标 文本
   * 4. 使用 editorInstance.executeEdits()（Monaco）或 setContent()（fallback）
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

      // 步骤 4: 构建新的目标文本
      // 使用目标节点的简单 ID（而非 fullId），因为源文本中用的是简单节点名
      const newTargetText = `-> 节点：${targetNode.id}`;

      // 步骤 5: 更新编辑器文本
      if (editorInstance) {
        // ---- Monaco 编辑器路径 (M1+) ----
        const model = editorInstance.getModel();
        if (model) {
          const lineNumber = option.lineNumber;
          const lineContent = model.getLineContent(lineNumber);
          const arrowIndex = findTargetArrowIndex(lineContent);

          if (arrowIndex >= 0) {
            // 已有目标 → 替换
            editorInstance.executeEdits('plotflow-reconnect', [
              {
                range: {
                  startLineNumber: lineNumber,
                  startColumn: arrowIndex + 1,
                  endLineNumber: lineNumber,
                  endColumn: lineContent.length + 1,
                },
                text: newTargetText,
              },
            ]);
          } else {
            // 无目标（死胡同选项首次连线）→ 追加
            // BUG5 修复：先补齐未闭合括号再追加
            const fixedLine = closeUnclosedBrackets(lineContent);
            if (fixedLine !== lineContent) {
              // 行尾有未闭合括号 → 先替换整行为补全后的行，再追加目标
              editorInstance.executeEdits('plotflow-reconnect', [
                {
                  range: {
                    startLineNumber: lineNumber,
                    startColumn: 1,
                    endLineNumber: lineNumber,
                    endColumn: lineContent.length + 1,
                  },
                  text: `${fixedLine} ${newTargetText}`,
                },
              ]);
            } else {
              editorInstance.executeEdits('plotflow-reconnect', [
                {
                  range: {
                    startLineNumber: lineNumber,
                    startColumn: lineContent.length + 1,
                    endLineNumber: lineNumber,
                    endColumn: lineContent.length + 1,
                  },
                  text: ` ${newTargetText}`,
                },
              ]);
            }
          }
        }
      } else {
        // ---- Fallback: 通过 editorStore.setContent 更新 (M0 textarea 模式) ----
        const lines = editorContent.split('\n');
        const lineIndex = option.lineNumber - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          const line = lines[lineIndex]!;
          const arrowIndex = findTargetArrowIndex(line);
          if (arrowIndex >= 0) {
            // 已有目标 → 替换
            lines[lineIndex] = line.slice(0, arrowIndex) + newTargetText;
          } else {
            // 无目标 → 追加
            lines[lineIndex] = line + ` ${newTargetText}`;
          }
          setContent(lines.join('\n'));
        }
      }
    },
    [editorInstance, editorContent, setContent, getNodeByFullId],
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

        const newTargetText = `-> 节点：${targetNode.id}`;

        // 步骤 3: 更新编辑器文本
        if (editorInstance) {
          const model = editorInstance.getModel();
          if (model) {
            const lineNumber = option.lineNumber;
            const lineContent = model.getLineContent(lineNumber);
            const arrowIndex = findTargetArrowIndex(lineContent);

            if (arrowIndex >= 0) {
              // 已有目标 → 替换
              editorInstance.executeEdits('plotflow-edge-reconnect', [
                {
                  range: {
                    startLineNumber: lineNumber,
                    startColumn: arrowIndex + 1,
                    endLineNumber: lineNumber,
                    endColumn: lineContent.length + 1,
                  },
                  text: newTargetText,
                },
              ]);
            }
          }
        } else {
          // Fallback: 通过 editorStore.setContent
          const lines = editorContent.split('\n');
          const lineIndex = option.lineNumber - 1;
          if (lineIndex >= 0 && lineIndex < lines.length) {
            const line = lines[lineIndex]!;
            const arrowIndex = findTargetArrowIndex(line);
            if (arrowIndex >= 0) {
              lines[lineIndex] = line.slice(0, arrowIndex) + newTargetText;
              setContent(lines.join('\n'));
            }
          }
        }

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
    [editorInstance, editorContent, setContent, getNodeByFullId, setEdges],
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
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge<StoryEdgeData>) => {
      if (renamingNodeId !== null) return;

      // Alt+点击 → 删除连线 (FR-1)
      if (event.altKey) {
        event.preventDefault();

        try {
          const { sourceFullId, optionIndex } = parseEdgeId(edge.id);
          const sourceNode = getNodeByFullId(sourceFullId);
          if (!sourceNode) return;

          const option = sourceNode.options[optionIndex];
          if (!option) return;

          // 更新编辑器文本：移除 -> 节点：XXX 引用
          if (editorInstance) {
            const model = editorInstance.getModel();
            if (model) {
              const lineNumber = option.lineNumber;
              const lineContent = model.getLineContent(lineNumber);
              const arrowIndex = findTargetArrowIndex(lineContent);
              if (arrowIndex >= 0) {
                editorInstance.executeEdits('plotflow-edge-delete', [
                  {
                    range: {
                      startLineNumber: lineNumber,
                      startColumn: arrowIndex + 1,
                      endLineNumber: lineNumber,
                      endColumn: lineContent.length + 1,
                    },
                    text: '', // 清空跳转目标
                  },
                ]);
              }
            }
          } else {
            // Fallback: 通过 editorStore.setContent
            const lines = editorContent.split('\n');
            const lineIndex = option.lineNumber - 1;
            if (lineIndex >= 0 && lineIndex < lines.length) {
              const line = lines[lineIndex]!;
              const arrowIndex = findTargetArrowIndex(line);
              if (arrowIndex >= 0) {
                lines[lineIndex] = line.slice(0, arrowIndex).trimEnd();
                setContent(lines.join('\n'));
              }
            }
          }
        } catch {
          // parseEdgeId 解析失败 → 记录日志，不崩溃
          // eslint-disable-next-line no-console
          console.warn('[GraphCanvas] Alt+click edge delete failed — invalid edge id:', edge.id);
        }
      }
    },
    [renamingNodeId, editorInstance, editorContent, setContent, getNodeByFullId],
  );

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
   * 标记上一次拖拽是否成功创建了连接。
   * onConnect 在成功连接时调用，将标志设为 true。
   * handleConnectEnd 读取此标志，若为 false 则表示拖拽到了空白区域。
   */
  const connectDidSucceed = React.useRef(false);

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
    (_event: globalThis.MouseEvent | globalThis.TouchEvent) => {
      // 先释放操作锁
      handleConnectEnd();

      // 如果已经成功连接，不需要创建新节点
      if (connectDidSucceed.current) {
        connectDidSucceed.current = false;
        const editor = useEditorStore.getState().editorInstance;
        if (editor) { parsePipelineNow(editor.getValue()); }
        return;
      }

      // 拖拽到空白区域 — 不强制创建新节点以避免干扰正常画布操作。
      // 用户可通过右键空白菜单手动添加节点。
      // 未来版本可加入浮动"创建节点"按钮（V0.3+）。
      setStatusMessage('拖拽到空白 — 右键菜单"添加节点"创建新卡片');
    },
    [handleConnectEnd, setStatusMessage],
  );

  // ==========================================================================
  // 性能模式检测 (M2-14)
  // ==========================================================================

  /** 节点数超过 200 时自动启用性能模式 */
  const isPerfMode = nodes.length > 200;

  /** 性能模式下 fitView 动画时长（更大值 = 更低帧率体感） */
  const fitViewDuration = isPerfMode ? 400 : 200;

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
          background: 'var(--color-bg-secondary, #F5F5F6)',
          color: 'var(--color-text-muted, #8A8A8A)',
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
            <span style={{ color: 'var(--color-diagnostic-error, #D32F2F)' }}>
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
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <ZoomResetShortcut />
        <ReactFlow
          nodes={displayedNodes}
          edges={displayedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={isSplit ? handleNodeClick : undefined}
          onNodeDoubleClick={isSplit ? handleNodeDoubleClick : undefined}
          onNodeContextMenu={isSplit ? handleNodeContextMenu : undefined}
          onPaneClick={isSplit ? handlePaneClick : undefined}
          onPaneContextMenu={isSplit ? handlePaneContextMenu : undefined}
          onEdgeClick={isSplit ? handleEdgeClick : undefined}
          onEdgeDoubleClick={isSplit ? handleEdgeDoubleClick : undefined}
          onEdgeContextMenu={isSplit ? handleEdgeContextMenu : undefined}
          onConnect={isSplit ? handleConnectWithTrack : undefined}
          onConnectStart={isSplit ? handleConnectStart : undefined}
          onConnectEnd={isSplit ? handleConnectEndWithCreate : undefined}
          isValidConnection={isSplit ? handleIsValidConnection : undefined}
          edgesReconnectable={isSplit}
          onReconnect={isSplit ? handleReconnect : undefined}
          onReconnectStart={isSplit ? handleReconnectStart : undefined}
          onReconnectEnd={isSplit ? handleReconnectEnd : undefined}
          nodesDraggable={true}
          nodesConnectable={isSplit}
          elementsSelectable={isSplit}
          panOnDrag={[1, 2]}
          panOnScroll={true}
          selectionMode={SelectionMode.Partial}
          onlyRenderVisibleElements={true}
          elevateNodesOnSelect={false}
          fitView
          fitViewOptions={{ padding: 0.2, duration: fitViewDuration }}
          minZoom={isSplit ? 0.1 : 0.05}
          maxZoom={isSplit ? 2.0 : 0.5}
          onViewportChange={(viewport) => setZoom(viewport.zoom)}
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
          connectionLineStyle={{
            stroke: 'var(--color-accent, #1976D2)',
            strokeWidth: 2,
            strokeDasharray: '5,4',
          }}
          style={{ background: 'var(--color-bg-secondary, #F5F5F6)' }}
        >
        {/* 网格背景 — 仅 split 模式 */}
        {isSplit && (
          <Background
            color="var(--color-border-light, #E8E8E8)"
            gap={20}
            size={1}
          />
        )}

        {/* 缩放/适应/锁定控件 — 仅 split 模式 */}
        {isSplit && (
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
            background: 'var(--color-bg-primary, #FFFFFF)',
            border: '1px solid var(--color-border-default, #E0E0E0)',
          }}
          maskColor="rgba(0,0,0,0.2)"
          nodeColor={(node) => {
            // MINIMAP_SVG_COLORS: 字面量色值 — SVG fill 不保证 CSS 变量解析
            if (node.type === 'collapseNode') return '#8A8A8A'; // MINIMAP_SVG
            const nodeData = node.data as unknown as StoryFlowNodeData | undefined;
            const status = nodeData?.status;
            switch (status) {
              case 'error': return '#DC2626'; // MINIMAP_SVG
              case 'orphan': return '#F59E0B'; // MINIMAP_SVG
              case 'deadend': return '#9CA3AF'; // MINIMAP_SVG
              case 'root': return '#2563EB'; // MINIMAP_SVG
              default: return '#4CAF50'; // MINIMAP_SVG
            }
          }}
        />
        )}
      </ReactFlow>
    </div>
    </ReactFlowProvider>

      {/* ── 解析错误警告横幅 (V02-033) ── */}
      {hasParseErrors && isSplit && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: '6px 16px',
            background: 'var(--color-diagnostic-error, #D32F2F)',
            color: 'var(--color-text-inverse, #FFFFFF)',
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
      {isSplit && (
        <GraphContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          type={contextMenu.type}
          node={contextMenu.node}
          edge={contextMenu.edge}
          onClose={handleContextMenuClose}
        />
      )}
    </>
  );
}
