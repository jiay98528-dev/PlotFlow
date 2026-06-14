/**
 * 大纲视图 ↔ 编辑器双向联动 Hook (M1-15)
 *
 * @remarks
 * 双向联动：
 * - **大纲 → 编辑器**：点击 OutlinePanel 节点 → editor.revealLine(lineNumber) + 光标定位
 * - **编辑器 → 大纲**：编辑器滚动 → 检测可见区域第一个节点 → 更新 activeNodeId
 *
 * 防循环更新：
 * - 大纲点击方向设置 isNavigatingFromOutline 标记，阻止反向更新触发
 * - 编辑器→大纲方向使用 500ms debounce 避免频繁更新
 *
 * M0 兼容：
 * - editorInstance 为 null 时（M0 textarea 占位），大纲→编辑器仅更新 store 状态
 * - 编辑器→大纲方向在 editorInstance 为 null 时不监听
 *
 * @see spec/milestones.md — M1-15
 * @see doc/TAD.md §2.2.2 EditorState / StoryState
 */

import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useStoryStore } from '../stores/storyStore';

// ============================================================================
// 常量
// ============================================================================

/** 编辑器→大纲滚动同步 debounce 毫秒数 */
const SCROLL_SYNC_DEBOUNCE_MS = 500;

/**
 * 大纲→编辑器跳转后，阻止反向同步的冷却毫秒数。
 * 需覆盖 debounce 窗口，确保反向监听器不会立即覆盖刚设置的高亮。
 */
const NAVIGATION_COOLDOWN_MS = SCROLL_SYNC_DEBOUNCE_MS + 100;

// ============================================================================
// Hook
// ============================================================================

export interface OutlineSyncAPI {
  /** 点击大纲节点 → 跳转到编辑器对应行 */
  navigateToNode: (nodeFullId: string, lineNumber: number) => void;
}

/**
 * 使用大纲↔编辑器双向联动。
 *
 * @returns 大纲面板可用的 navigateToNode 回调
 *
 * @example
 *   const { navigateToNode } = useOutlineSync();
 *   <OutlinePanel onNodeClick={navigateToNode} />
 */
export function useOutlineSync(): OutlineSyncAPI {
  const setCursorPosition = useEditorStore((s) => s.setCursorPosition);
  const setActiveNodeId = useEditorStore((s) => s.setActiveNodeId);
  const editorInstance = useEditorStore((s) => s.editorInstance);
  const plotFlowData = useStoryStore((s) => s.plotFlowData);

  // ---- 防止循环更新标记 ----
  // 当从大纲点击跳转时，设置此标记阻止 editor→outline 方向反向覆盖
  const isNavigatingFromOutline = useRef(false);
  const navigationCooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- 大纲 → 编辑器：点击跳转 ----

  const navigateToNode = useCallback(
    (nodeFullId: string, lineNumber: number) => {
      // 1. 更新 store 状态
      setActiveNodeId(nodeFullId);
      setCursorPosition(lineNumber, 1);

      // 2. 设置反向同步阻止标记
      isNavigatingFromOutline.current = true;
      if (navigationCooldownTimer.current !== null) {
        clearTimeout(navigationCooldownTimer.current);
      }
      navigationCooldownTimer.current = setTimeout(() => {
        isNavigatingFromOutline.current = false;
        navigationCooldownTimer.current = null;
      }, NAVIGATION_COOLDOWN_MS);

      // 3. 如果编辑器实例可用，执行编程式跳转
      if (editorInstance) {
        editorInstance.revealLineInCenter(lineNumber);
        editorInstance.setPosition({ lineNumber, column: 1 });
        editorInstance.focus();
      }
    },
    [editorInstance, setActiveNodeId, setCursorPosition],
  );

  // ---- 编辑器 → 大纲：滚动同步 ----

  useEffect(() => {
    if (!editorInstance || !plotFlowData) return;

    let debounceTimer: ReturnType<typeof setTimeout>;

    const disposable = editorInstance.onDidScrollChange(() => {
      // 大纲点击方向触发中 → 跳过反向更新
      if (isNavigatingFromOutline.current) return;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const visibleRanges = editorInstance.getVisibleRanges();
        if (visibleRanges.length === 0) return;

        const firstRange = visibleRanges[0];
        if (!firstRange) return;

        const firstVisibleLine = firstRange.startLineNumber;
        const nodeId = useStoryStore.getState().getNodeByLine(firstVisibleLine);

        if (nodeId) {
          setActiveNodeId(nodeId);
        }
      }, SCROLL_SYNC_DEBOUNCE_MS);
    });

    return () => {
      disposable.dispose();
      clearTimeout(debounceTimer);
    };
  }, [editorInstance, plotFlowData, setActiveNodeId]);

  // ---- 清理：组件卸载时清除冷却定时器 ----

  useEffect(() => {
    return () => {
      if (navigationCooldownTimer.current !== null) {
        clearTimeout(navigationCooldownTimer.current);
      }
    };
  }, []);

  return { navigateToNode };
}
