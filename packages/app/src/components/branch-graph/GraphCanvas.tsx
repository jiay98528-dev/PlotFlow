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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../../stores/graphStore';
import { useEditorStore } from '../../stores/editorStore';
import { useStoryStore } from '../../stores/storyStore';
import type { StoryFlowNodeData } from './adapter';
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
  const setEditing = useGraphStore((state) => state.setEditing);

  const editorInstance = useEditorStore((state) => state.editorInstance);
  const editorContent = useEditorStore((state) => state.content);
  const setContent = useEditorStore((state) => state.setContent);
  const activeNodeId = useEditorStore((state) => state.activeNodeId);

  // StoryStore — 用于查找 AST 节点信息（选项行号、targetNodeId 等）
  const getNodeByFullId = useStoryStore((state) => state.getNodeByFullId);

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
      setEditing(true);
      // 记录源节点 ID（后续用于连接验证/无效节点高亮）
      void params.nodeId;
    },
    [renamingNodeId, setEditing],
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

      // 验证 2: 不允许重复连接（同一 source → 同一 target 已存在）
      const duplicate = edges.some(
        (e) => e.source === connection.source && e.target === connection.target,
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
          const arrowIndex = lineContent.indexOf('->');

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
      } else {
        // ---- Fallback: 通过 editorStore.setContent 更新 (M0 textarea 模式) ----
        const lines = editorContent.split('\n');
        const lineIndex = option.lineNumber - 1;
        if (lineIndex >= 0 && lineIndex < lines.length) {
          const line = lines[lineIndex]!;
          const arrowIndex = line.indexOf('->');
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

  // ==========================================================================
  // 右键菜单状态
  // ==========================================================================

  const [contextMenu, setContextMenu] = useState<{
    readonly isOpen: boolean;
    readonly position: { readonly x: number; readonly y: number };
    readonly type: ContextMenuType;
    readonly node: Node<StoryFlowNodeData> | null;
  }>({
    isOpen: false,
    position: { x: 0, y: 0 },
    type: 'pane',
    node: null,
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
      });
    },
    [renamingNodeId],
  );

  /** 关闭右键菜单 */
  const handleContextMenuClose = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

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
        <span>打开 .mdstory 文件以查看分支图</span>
        <span style={{ fontSize: 'var(--text-xs, 12px)', opacity: 0.7 }}>
          编写 Markdown 分支剧情后，分支图将在此处自动生成
        </span>
      </div>
    );
  }

  // --- 正常渲染：React Flow 画布 ---
  return (
    <>
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%' }}>
        <ZoomResetShortcut />
        <ReactFlow
          nodes={displayedNodes}
          edges={displayedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodeClick={isSplit ? handleNodeClick : undefined}
          onNodeContextMenu={isSplit ? handleNodeContextMenu : undefined}
          onPaneClick={isSplit ? handlePaneClick : undefined}
          onPaneContextMenu={isSplit ? handlePaneContextMenu : undefined}
          onConnect={isSplit ? handleConnect : undefined}
          onConnectStart={isSplit ? handleConnectStart : undefined}
          onConnectEnd={isSplit ? handleConnectEnd : undefined}
          isValidConnection={isSplit ? handleIsValidConnection : undefined}
          nodesDraggable={false}
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
          nodeColor={(node) => {
            // 折叠虚拟节点使用灰色
            if (node.type === 'collapseNode') {
              return 'var(--color-text-muted, #8A8A8A)';
            }
            const nodeData = node.data as unknown as StoryFlowNodeData | undefined;
            const status = nodeData?.status;
            switch (status) {
              case 'error': return 'var(--color-error, #C62828)';
              case 'orphan': return 'var(--color-warning, #F9A825)';
              case 'deadend': return 'var(--color-text-muted, #8A8A8A)';
              case 'root': return 'var(--color-accent, #1976D2)';
              default: return 'var(--color-success, #2E7D32)';
            }
          }}
        />
        )}
      </ReactFlow>
    </div>
    </ReactFlowProvider>

      {/* 右键菜单 — 仅 split 模式 */}
      {isSplit && (
        <GraphContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          type={contextMenu.type}
          node={contextMenu.node}
          onClose={handleContextMenuClose}
        />
      )}
    </>
  );
}
