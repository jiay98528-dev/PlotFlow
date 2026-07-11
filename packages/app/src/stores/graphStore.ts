/**
 * useGraphStore — 分支图状态管理
 *
 * 职责：管理 React Flow 可视化分支图的节点、连线、选中状态、
 * 缩放级别和视图模式。
 *
 * 对应 TAD.md §2.2.2 GraphState 接口定义和 §2.4 React Flow 集成。
 *
 * 约束（CLAUDE.md §2.4）：
 * - 图形编辑回调必须通过 Zustand store 派发，更新 AST 后再触发 Monaco 文本同步
 * - 节点状态着色通过 className 注入，不在组件内硬编码颜色
 *
 * @module stores/graphStore
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { Node, Edge } from '@xyflow/react';
import type { PlotFlowData } from '@plotflow/core';
import { plotFlowDataToFlow } from '../components/branch-graph/adapter';
import {
  STATUS_TO_CLASS_MAP,
  type NodeStatus,
} from '../components/branch-graph/adapter-helpers';
import { useUIStore } from './uiStore';

// ============================================================================
// 类型定义
// ============================================================================

/** 视图模式 */
export type ViewMode = 'minimap' | 'split';

/** 缩放级别范围常量 */
export const ZOOM_CONSTRAINTS = {
  MIN: 0.1,
  MAX: 2.0,
  DEFAULT: 1.0,
} as const;

const EDITING_LOCK_TIMEOUT_MS = 10_000;
let editingLockTimer: ReturnType<typeof setTimeout> | undefined;

function clearEditingLockTimer(): void {
  if (editingLockTimer !== undefined) {
    clearTimeout(editingLockTimer);
    editingLockTimer = undefined;
  }
}

/** 分支图状态 */
export interface GraphState {
  /** React Flow 节点列表 */
  readonly nodes: Node[];

  /** React Flow 连线列表 */
  readonly edges: Edge[];

  /** 当前选中的节点 ID（null 表示无选中） */
  readonly selectedNodeId: string | null;

  /** 缩放级别（范围 0.1 - 2.0，默认 1.0） */
  readonly zoomLevel: number;

  /** 视图模式：minimap = 迷你地图，split = 并排均衡 */
  readonly viewMode: ViewMode;

  /** 正在进行内联重命名的节点 ID（null 表示无重命名操作） */
  readonly renamingNodeId: string | null;

  /**
   * 操作锁标志。
   *
   * 当用户在分支图上拖拽连线修改跳转目标时设置为 true，
   * 阻止编辑器侧的 debounce 文本→图同步覆盖此次更改。
   *
   * 拖拽完成后设置为 false，并触发一次手动解析同步。
   */
  readonly isEditing: boolean;

  /**
   * 同层节点组折叠状态 (M2-15)。
   *
   * key = groupId (如 "sibling-group-第一章-森林入口")，
   * value = true 表示用户已手动展开该组（不折叠）。
   *
   * 初始为空 {} → 所有超过阈值（默认20）的兄弟节点组默认自动折叠。
   * 用户点击 "..." 展开节点后，toggleGroupCollapse 将 groupId 设为 true。
   * 再次点击 "..." 折叠时，从 map 中移除对应 key。
   */
  readonly collapsedGroups: Record<string, boolean>;

  // --- Actions ---

  /** 设置节点列表 */
  setNodes: (nodes: Node[]) => void;

  /** 设置连线列表 */
  setEdges: (edges: Edge[]) => void;

  /** 选中/取消选中节点 */
  selectNode: (id: string | null) => void;

  /** 设置缩放级别（自动钳制到 0.1 - 2.0 范围内） */
  setZoom: (level: number) => void;

  /** 切换视图模式（minimap <-> split） */
  toggleViewMode: () => void;

  /** 设置正在重命名的节点 ID（null 表示清除锁定） */
  setRenamingNodeId: (id: string | null) => void;

  /** 设置操作锁标志（true = 禁用手动同步，false = 恢复同步） */
  setEditing: (editing: boolean) => void;

  /**
   * 切换同层节点组的折叠/展开状态 (M2-15)。
   *
   * 若该组当前在 collapsedGroups 中（已展开）→ 折叠（从 map 中删除）。
   * 若该组当前不在 collapsedGroups 中（已折叠/默认）→ 展开（设为 true）。
   *
   * @param groupId - 节点组 ID（如 "sibling-group-第一章-森林入口"）
   */
  toggleGroupCollapse: (groupId: string) => void;

  /**
   * 从 PlotFlowData AST 同步分支图数据。
   *
   * 调用 plotFlowDataToFlow 适配器将 AST 转换为 React Flow 节点/连线，
   * 然后通过 setNodes/setEdges 更新状态。
   *
   * 若 data 为 null，清空节点和连线。
   *
   * @param data - 解析后的 PlotFlowData AST，或 null 表示清空
   */
  syncFromAST: (data: PlotFlowData | null) => void;

  /**
   * 增量更新单个节点的诊断着色（M3-18）。
   *
   * 当编辑器侧的 diagnostics 变化时，无需完整重新同步 AST，
   * 直接更新单个节点的 className 和 data.status，触发 React Flow 重绘。
   *
   * 若 nodeId 对应的节点不存在，静默忽略。
   *
   * @param nodeId  - 节点的完整 ID（fullId）
   * @param status  - 新的节点状态（由 getNodeStatus() 判定）
   */
  updateNodeStatus: (nodeId: string, status: NodeStatus) => void;
}

// ============================================================================
// 工具函数
// ============================================================================

/** 钳制缩放值到合法范围 */
function clampZoom(level: number): number {
  return Math.min(ZOOM_CONSTRAINTS.MAX, Math.max(ZOOM_CONSTRAINTS.MIN, level));
}

// ============================================================================
// 初始状态
// ============================================================================

const initialState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  zoomLevel: ZOOM_CONSTRAINTS.DEFAULT,
  viewMode: 'minimap' as ViewMode,
  renamingNodeId: null,
  isEditing: false,
  collapsedGroups: {} as Record<string, boolean>,
} as const satisfies Omit<GraphState, 'setNodes' | 'setEdges' | 'selectNode' | 'setZoom' | 'toggleViewMode' | 'setRenamingNodeId' | 'setEditing' | 'toggleGroupCollapse' | 'syncFromAST' | 'updateNodeStatus'>;

// ============================================================================
// Store
// ============================================================================

export const useGraphStore = create<GraphState>()(
  devtools(
    subscribeWithSelector(
      (set, get) => ({
      // --- 初始状态 ---
      ...initialState,

      // --- Actions ---

      setNodes: (nodes: Node[]) =>
        set(
          { nodes },
          false,
          'graph/setNodes',
        ),

      setEdges: (edges: Edge[]) =>
        set(
          { edges },
          false,
          'graph/setEdges',
        ),

      selectNode: (id: string | null) =>
        set(
          { selectedNodeId: id },
          false,
          'graph/selectNode',
        ),

      setZoom: (level: number) =>
        set(
          { zoomLevel: clampZoom(level) },
          false,
          'graph/setZoom',
        ),

      toggleViewMode: () =>
        set(
          (state) => ({
            viewMode: state.viewMode === 'minimap' ? 'split' : 'minimap',
          }),
          false,
          'graph/toggleViewMode',
        ),

      setRenamingNodeId: (id: string | null) =>
        set(
          { renamingNodeId: id },
          false,
          'graph/setRenamingNodeId',
        ),

      setEditing: (editing: boolean) => {
        clearEditingLockTimer();
        set({ isEditing: editing }, false, 'graph/setEditing');
        if (editing) {
          editingLockTimer = setTimeout(() => {
            editingLockTimer = undefined;
            set({ isEditing: false }, false, 'graph/setEditing:timeout');
          }, EDITING_LOCK_TIMEOUT_MS);
        }
      },

      /**
       * 切换同层节点组的折叠/展开状态 (M2-15)。
       *
       * 若 groupId 已在 collapsedGroups 中（用户已展开）→ 移除（重新折叠）。
       * 若 groupId 不在 collapsedGroups 中（默认折叠或已折叠）→ 添加（展开）。
       */
      toggleGroupCollapse: (groupId: string) =>
        set(
          (state) => {
            const collapsedGroups = { ...state.collapsedGroups };
            if (collapsedGroups[groupId]) {
              delete collapsedGroups[groupId];
            } else {
              collapsedGroups[groupId] = true;
            }
            return { collapsedGroups };
          },
          false,
          'graph/toggleGroupCollapse',
        ),

      syncFromAST: (data: PlotFlowData | null) => {
        if (!data) {
          clearEditingLockTimer();
          set(
            {
              nodes: [],
              edges: [],
              selectedNodeId: null,
              renamingNodeId: null,
              isEditing: false,
              collapsedGroups: {},
            },
            false,
            'graph/syncFromAST:clear',
          );
          return;
        }

        try {
          const { nodes, edges } = plotFlowDataToFlow(data);
          set(
            { nodes, edges },
            false,
            'graph/syncFromAST',
          );
        } catch (error) {
          // eslint-disable-next-line no-console -- intentional error logging for diagnostics
          console.error('[GraphStore] syncFromAST failed:', error);
          // V02-033: 保留上次有效状态，不清空画布
          // 仅设置状态栏消息告知用户渲染失败
          useUIStore.getState().setStatusMessage(
            '⚠️ 分支图渲染失败 — 已保留当前视图，请检查语法',
          );
        }
      },

      /**
       * 增量更新单个节点的诊断着色（M3-18）。
       *
       * 当编辑器侧的 diagnostics 变化时，无需完整重新同步 AST，
       * 直接更新单个节点的 className 和 data.status，触发 React Flow 重绘。
       *
       * 算法：
       * 1. 在 nodes 列表中查找 nodeId 匹配的节点
       * 2. 若找到，更新其 className 和 data.status
       * 3. 若未找到，静默忽略
       *
       * 状态→className 映射：
       * - normal   → 'node-status-normal'
       * - orphan   → 'node-status-orphan'
       * - deadend  → 'node-status-deadend'
       * - error    → 'node-status-error'
       */
      updateNodeStatus: (nodeId: string, status: NodeStatus) => {
        const { nodes } = get();
        const index = nodes.findIndex((n) => n.id === nodeId);
        if (index === -1) return;

        const node = nodes[index]!;

        const updatedNodes = [...nodes];
        updatedNodes[index] = {
          ...node,
          className: STATUS_TO_CLASS_MAP[status],
          data: {
            ...node.data,
            status,
          },
        };

        set(
          { nodes: updatedNodes },
          false,
          'graph/updateNodeStatus',
        );
      },
    }),
  ),
  { name: 'GraphStore' },
  ),
);
