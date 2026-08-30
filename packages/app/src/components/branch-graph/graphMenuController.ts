import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useGraphStore } from '../../stores/graphStore';
import { isGraphShortcutBlocked } from '../../services/graphKeyboardGuard';
import type { StoryFlowNodeData } from './adapter';
import type { ContextMenuType } from './GraphContextMenu';
import type { StoryEdgeData } from './StoryEdge';

export interface GraphMenuState {
  readonly isOpen: boolean;
  readonly position: { readonly x: number; readonly y: number };
  readonly type: ContextMenuType;
  readonly node: Node<StoryFlowNodeData> | null;
  readonly edge: Edge<StoryEdgeData> | null;
}

interface GraphMenuControllerOptions {
  readonly canEditGraph: boolean;
  readonly renamingNodeId: string | null;
}

const CLOSED_MENU: GraphMenuState = {
  isOpen: false,
  position: { x: 0, y: 0 },
  type: 'pane',
  node: null,
  edge: null,
};

export function useGraphMenuController({
  canEditGraph,
  renamingNodeId,
}: GraphMenuControllerOptions): {
  readonly contextMenu: GraphMenuState;
  readonly handleNodeContextMenu: (event: React.MouseEvent, node: Node) => void;
  readonly handlePaneContextMenu: (event: React.MouseEvent | MouseEvent) => void;
  readonly handleEdgeContextMenu: (event: React.MouseEvent, edge: Edge<StoryEdgeData>) => void;
  readonly handleContextMenuClose: (restoreFocus?: boolean) => void;
} {
  const [contextMenu, setContextMenu] = useState<GraphMenuState>(CLOSED_MENU);
  const triggerRef = useRef<HTMLElement | null>(null);

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (renamingNodeId !== null) return;
      triggerRef.current =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('.react-flow__node')
          : null;
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

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      if (renamingNodeId !== null) return;
      triggerRef.current = event.target instanceof HTMLElement ? event.target : null;
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

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge<StoryEdgeData>) => {
      event.preventDefault();
      if (renamingNodeId !== null) return;
      triggerRef.current = event.target instanceof HTMLElement ? event.target : null;
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

  const handleContextMenuClose = useCallback((restoreFocus = false) => {
    setContextMenu((previous) => ({ ...previous, isOpen: false }));
    if (!restoreFocus) return;
    const trigger = triggerRef.current;
    if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!canEditGraph) return undefined;

    const handleKeyboardContextMenu = (event: KeyboardEvent): void => {
      if (isGraphShortcutBlocked(event)) return;
      if (!(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))) return;
      const eventTarget = event.target;
      if (
        !(eventTarget instanceof Element) ||
        !eventTarget.closest('.react-flow, .react-flow__node')
      )
        return;
      if (eventTarget.closest('input, textarea, select, [contenteditable="true"]')) return;

      const current = useGraphStore.getState();
      const selected = current.nodes.find(
        (candidate) =>
          candidate.id === current.selectedNodeId ||
          (candidate.data as StoryFlowNodeData | undefined)?.fullId === current.selectedNodeId,
      );
      if (!selected || selected.type === 'collapseNode') return;

      const selector = `.react-flow__node[data-id="${CSS.escape(selected.id)}"]`;
      const trigger = document.querySelector<HTMLElement>(selector);
      if (!trigger) return;
      event.preventDefault();
      const rect = trigger.getBoundingClientRect();
      triggerRef.current = trigger;
      setContextMenu({
        isOpen: true,
        position: {
          x: rect.left + Math.min(24, rect.width / 2),
          y: rect.top + Math.min(24, rect.height / 2),
        },
        type: 'node',
        node: selected as Node<StoryFlowNodeData>,
        edge: null,
      });
    };

    window.addEventListener('keydown', handleKeyboardContextMenu);
    return () => window.removeEventListener('keydown', handleKeyboardContextMenu);
  }, [canEditGraph]);

  return {
    contextMenu,
    handleNodeContextMenu,
    handlePaneContextMenu,
    handleEdgeContextMenu,
    handleContextMenuClose,
  };
}
