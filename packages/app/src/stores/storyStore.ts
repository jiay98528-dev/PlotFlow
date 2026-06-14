/**
 * useStoryStore — 故事数据状态管理
 *
 * 职责：持有解析后的 PlotFlowData AST，管理解析状态和错误信息。
 * AST 是文本编辑器和分支图之间的单向数据流枢纽。
 *
 * 对应 TAD.md §2.2.2 StoryState 接口定义和 §2.2.3 单向数据流。
 *
 * @module stores/storyStore
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import type { PlotFlowData } from '@plotflow/core';

// ============================================================================
// 节点查找缓存 (M2-15 性能优化)
// ============================================================================

/** 缓存的节点 Map（O(1) 查找），在 plotFlowData 引用变化时重建 */
let _nodeMapCache: Map<string, import('@plotflow/core').StoryNode> | null = null;
let _nodeMapCacheAstRef: import('@plotflow/core').PlotFlowData | null = null;

/**
 * 获取节点查找 Map（惰性构建 + 缓存）。
 *
 * 每次 plotFlowData 引用变化时自动重建，确保 Map 始终与当前 AST 同步。
 */
function getNodeMap(data: import('@plotflow/core').PlotFlowData): Map<string, import('@plotflow/core').StoryNode> {
  if (data !== _nodeMapCacheAstRef || !_nodeMapCache) {
    _nodeMapCache = new Map();
    for (const chapter of data.chapters) {
      for (const node of chapter.nodes) {
        _nodeMapCache.set(node.fullId, node);
      }
    }
    _nodeMapCacheAstRef = data;
  }
  return _nodeMapCache;
}

// ============================================================================
// 类型定义
// ============================================================================

/** 故事数据状态 */
export interface StoryState {
  /** 解析后的完整 AST（null 表示尚未解析或无有效数据） */
  readonly plotFlowData: PlotFlowData | null;

  /** 解析器是否正在运行 */
  readonly isParsing: boolean;

  /** 解析错误信息（null 表示解析成功） */
  readonly parseError: string | null;

  // --- Actions ---

  /** 设置解析结果（AST 数据） */
  setPlotFlowData: (data: PlotFlowData) => void;

  /** 清除解析数据（关闭文件或解析失败时调用） */
  clearParseData: () => void;

  /** 设置解析错误信息 */
  setParseError: (error: string) => void;

  /**
   * 根据行号查找所属节点 fullId。
   *
   * 遍历所有章节的所有节点，找到 lineNumber 所在的节点。
   * 若行号不在任何节点范围内，返回 null。
   *
   * @param lineNumber - 1-based 行号
   * @returns 节点 fullId，若未找到则返回 null
   */
  getNodeByLine: (lineNumber: number) => string | null;

  /**
   * 根据 fullId 查找节点。
   *
   * 遍历所有章节的所有节点，查找 fullId 匹配的 StoryNode。
   * 若未找到返回 undefined。
   *
   * @param fullId - 节点完整 ID（如 "第一章-森林入口"）
   * @returns 匹配的 StoryNode，若未找到则返回 undefined
   */
  getNodeByFullId: (fullId: string) => import('@plotflow/core').StoryNode | undefined;

  /**
   * 获取所有节点（扁平化列表）。
   *
   * 遍历所有章节，返回一个包含所有 StoryNode 的扁平数组。
   *
   * @returns 所有 StoryNode 的数组（若无数据则返回空数组）
   */
  getAllNodes: () => import('@plotflow/core').StoryNode[];
}

// ============================================================================
// 初始状态
// ============================================================================

const initialState = {
  plotFlowData: null,
  isParsing: false,
  parseError: null,
} as const satisfies Omit<StoryState, 'setPlotFlowData' | 'clearParseData' | 'setParseError' | 'getNodeByLine' | 'getNodeByFullId' | 'getAllNodes'>;

// ============================================================================
// Store
// ============================================================================

export const useStoryStore = create<StoryState>()(
  devtools(
    subscribeWithSelector(
      (set, get) => ({
      // --- 初始状态 ---
      ...initialState,

      // --- Actions ---

      setPlotFlowData: (data: PlotFlowData) =>
        set(
          { plotFlowData: data, isParsing: false, parseError: null },
          false,
          'story/setPlotFlowData',
        ),

      clearParseData: () =>
        set(
          { plotFlowData: null, isParsing: false, parseError: null },
          false,
          'story/clearParseData',
        ),

      setParseError: (error: string) =>
        set(
          { parseError: error, isParsing: false },
          false,
          'story/setParseError',
        ),

      /**
       * 根据行号查找所属节点 fullId。
       *
       * 算法：
       * 1. 收集所有章节中的节点，按 lineNumber 升序排列
       * 2. 找到 lineNumber >= node.lineNumber 的最大 lineNumber 节点
       * 3. 如果 lineNumber 小于第一个节点的行号，返回 null（光标在第一个节点之前）
       */
      getNodeByLine: (lineNumber: number): string | null => {
        const { plotFlowData } = get();
        if (!plotFlowData) return null;

        // 收集所有节点，记录其起始行号
        const entries: Array<{ fullId: string; lineNumber: number }> = [];
        for (const chapter of plotFlowData.chapters) {
          for (const node of chapter.nodes) {
            entries.push({ fullId: node.fullId, lineNumber: node.lineNumber });
          }
        }

        if (entries.length === 0) return null;

        // 按 lineNumber 升序排序（章节内的节点本身有序，但跨章节需要排序）
        entries.sort((a, b) => a.lineNumber - b.lineNumber);

        // 如果 lineNumber 在第一个节点之前，返回 null
        const firstEntry = entries[0]!;
        if (lineNumber < firstEntry.lineNumber) return null;

        // 从后向前找到第一个 lineNumber <= 给定行号的节点
        for (let i = entries.length - 1; i >= 0; i--) {
          const entry = entries[i]!;
          if (entry.lineNumber <= lineNumber) {
            return entry.fullId;
          }
        }

        return null;
      },

      /**
       * 根据 fullId 查找节点。
       *
       * 遍历所有章节节点，查找 fullId 匹配的 StoryNode。
       */
      /**
       * 根据 fullId 查找节点（O(1) Map 查找，M2-15 优化）。
       */
      getNodeByFullId: (fullId: string) => {
        const { plotFlowData } = get();
        if (!plotFlowData) return undefined;

        const nodeMap = getNodeMap(plotFlowData);
        return nodeMap.get(fullId);
      },

      /**
       * 获取所有节点（扁平化列表）。
       */
      getAllNodes: () => {
        const { plotFlowData } = get();
        if (!plotFlowData) return [];

        const allNodes: import('@plotflow/core').StoryNode[] = [];
        for (const chapter of plotFlowData.chapters) {
          for (const node of chapter.nodes) {
            allNodes.push(node);
          }
        }
        return allNodes;
      },
    }),
  ),
  { name: 'StoryStore' },
),
);
