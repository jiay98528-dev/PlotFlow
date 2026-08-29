import { useCallback, useEffect, useRef } from 'react';
import { applyNodeChanges, type Node, type NodeChange } from '@xyflow/react';
import type { StoryNode } from '@plotflow/core';
import type { AppTextKey } from '../../i18n/appI18n';
import { graphEditService } from '../../services/graphEditService';
import { isGraphShortcutBlocked } from '../../services/graphKeyboardGuard';
import { getCurrentStoryIdentity } from '../../services/sourceDraftCoordinator';
import { sameStoryIdentity, type StoryIdentity } from '../../services/storySnapshot';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import type { StoryFlowNodeData } from './adapter';
import type { GraphInteractionLease, GraphInteractionToken } from './graphInteractionLease';

type GraphText = (
  key: AppTextKey,
  params?: Readonly<Record<string, string | number>>,
) => string;

interface NodePositionDrag {
  readonly flowNodeId: string;
  readonly fullId: string;
  readonly startPosition: { readonly x: number; readonly y: number };
  readonly identity: StoryIdentity;
  readonly leaseToken: GraphInteractionToken;
}

interface GraphNodeControllerOptions {
  readonly canEditGraph: boolean;
  readonly nodes: Node[];
  readonly selectedNodeId: string | null;
  readonly renamingNodeId: string | null;
  readonly editorInstance: {
    revealLine(lineNumber: number): void;
    setPosition(position: { lineNumber: number; column: number }): void;
    focus(): void;
  } | null;
  readonly getNodeByFullId: (fullId: string) => StoryNode | undefined;
  readonly selectNode: (id: string | null) => void;
  readonly setRenamingNodeId: (id: string | null) => void;
  readonly setStatusMessage: (message: string) => void;
  readonly text: GraphText;
  readonly interactionLease: GraphInteractionLease;
  readonly suppressAutoFitRef: React.MutableRefObject<boolean>;
  readonly suppressAutoFitForUserViewportChange: () => void;
  readonly consumeSuppressedPaneClick: () => boolean;
  readonly closeWireDrop: (restoreFocus?: boolean) => void;
}

export function useGraphNodeController({
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
}: GraphNodeControllerOptions): {
  readonly handleNodesChange: (changes: NodeChange[]) => void;
  readonly handleNodeClick: (event: React.MouseEvent, node: Node) => void;
  readonly handleNodeDoubleClick: (event: React.MouseEvent, node: Node) => void;
  readonly handlePaneClick: () => void;
  readonly handleNodeDragStart: (event: MouseEvent | TouchEvent, node: Node) => void;
  readonly handleNodeDrag: (event: MouseEvent | TouchEvent, node: Node) => void;
  readonly handleNodeDragStop: (event: MouseEvent | TouchEvent, node: Node) => void;
} {
  const storySessionId = useEditorStore((state) => state.storySessionId);
  const contentRevision = useEditorStore((state) => state.contentRevision);
  const sourceDraftRevision = useEditorStore((state) => state.sourceDraftRevision);
  const nodePositionDragRef = useRef<NodePositionDrag | null>(null);

  const rollbackNodePosition = useCallback((drag: NodePositionDrag): void => {
    const currentNodes = useGraphStore.getState().nodes;
    useGraphStore.getState().setNodes(
      currentNodes.map((current) =>
        current.id === drag.flowNodeId
          ? { ...current, position: { ...drag.startPosition } }
          : current,
      ),
    );
  }, []);

  useEffect(() => {
    const handleRenameShortcut = (event: KeyboardEvent): void => {
      if (isGraphShortcutBlocked(event)) return;
      if (
        event.key !== 'F2' ||
        !canEditGraph ||
        renamingNodeId !== null ||
        !selectedNodeId ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }
      const selectedNode = nodes.find((node) => {
        if (node.id === selectedNodeId) return true;
        return (node.data as StoryFlowNodeData | undefined)?.fullId === selectedNodeId;
      });
      const nodeData = selectedNode?.data as StoryFlowNodeData | undefined;
      if (!selectedNode || selectedNode.type === 'collapseNode' || !nodeData) return;

      event.preventDefault();
      setRenamingNodeId(nodeData.fullId);
      setStatusMessage(text('themeNode.renameShortcutAnnounce', { title: nodeData.title }));
    };

    window.addEventListener('keydown', handleRenameShortcut);
    return () => window.removeEventListener('keydown', handleRenameShortcut);
  }, [
    canEditGraph,
    nodes,
    renamingNodeId,
    selectedNodeId,
    setRenamingNodeId,
    setStatusMessage,
    text,
  ]);

  const handleNodesChange = useCallback((changes: NodeChange[]): void => {
    const currentNodes = useGraphStore.getState().nodes;
    const nodeIds = new Set(currentNodes.map((node) => node.id));
    const relevantChanges = changes.filter(
      (change) => !('id' in change) || nodeIds.has(change.id),
    );
    if (relevantChanges.length === 0) return;
    useGraphStore.getState().setNodes(applyNodeChanges(relevantChanges, currentNodes));
  }, []);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node): void => {
      if (
        renamingNodeId !== null ||
        node.type === 'collapseNode' ||
        nodePositionDragRef.current !== null
      )
        return;
      const nodeData = node.data as StoryFlowNodeData | undefined;
      if (!nodeData) return;
      selectNode(nodeData.fullId);
      if (!editorInstance) return;
      editorInstance.revealLine(nodeData.lineNumber);
      editorInstance.setPosition({ lineNumber: nodeData.lineNumber, column: 1 });
      editorInstance.focus();
    },
    [editorInstance, renamingNodeId, selectNode],
  );

  const handlePaneClick = useCallback((): void => {
    if (renamingNodeId !== null || consumeSuppressedPaneClick()) return;
    closeWireDrop(false);
    selectNode(null);
  }, [closeWireDrop, consumeSuppressedPaneClick, renamingNodeId, selectNode]);

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node): void => {
      if (node.type === 'collapseNode') return;
      const nodeData = node.data as StoryFlowNodeData | undefined;
      if (!nodeData) return;
      setRenamingNodeId(nodeData.fullId);
    },
    [setRenamingNodeId],
  );

  const handleNodeDragStart = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node): void => {
      if (renamingNodeId !== null || node.type === 'collapseNode') return;
      const nodeData = node.data as StoryFlowNodeData | undefined;
      if (!nodeData?.fullId) return;
      const leaseToken = interactionLease.acquire('node-drag');
      nodePositionDragRef.current = {
        flowNodeId: node.id,
        fullId: nodeData.fullId,
        startPosition: { ...node.position },
        identity: getCurrentStoryIdentity(),
        leaseToken,
      };
      suppressAutoFitForUserViewportChange();
    },
    [interactionLease, renamingNodeId, suppressAutoFitForUserViewportChange],
  );

  const handleNodeDrag = useCallback((): void => {
    suppressAutoFitRef.current = true;
  }, [suppressAutoFitRef]);

  const handleNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: Node): void => {
      const drag = nodePositionDragRef.current;
      nodePositionDragRef.current = null;
      suppressAutoFitForUserViewportChange();
      // Release the lease before committing the edit: runGraphEdit flushes the
      // Source draft, and that flush refuses to run while isEditing is still
      // true, which would roll the drag back instead of persisting it.
      if (drag) interactionLease.release(drag.leaseToken);
      if (!drag || drag.flowNodeId !== node.id || node.type === 'collapseNode') return;
      if (!sameStoryIdentity(drag.identity, getCurrentStoryIdentity())) return;
      const moved =
        Math.round(drag.startPosition.x) !== Math.round(node.position.x) ||
        Math.round(drag.startPosition.y) !== Math.round(node.position.y);
      if (!moved) return;

      const storyNode = getNodeByFullId(drag.fullId);
      if (!storyNode) {
        rollbackNodePosition(drag);
        return;
      }
      let committed = false;
      try {
        committed = graphEditService.updateNodePositions([
          { fullId: drag.fullId, position: node.position },
        ]);
      } catch {
        rollbackNodePosition(drag);
        setStatusMessage(text('graphCanvas.changeNotApplied'));
        return;
      }
      if (committed) {
        setStatusMessage(text('graphCanvas.positionSaved', { title: storyNode.title }));
        return;
      }
      rollbackNodePosition(drag);
      setStatusMessage(text('graphCanvas.changeNotApplied'));
    },
    [
      getNodeByFullId,
      interactionLease,
      rollbackNodePosition,
      setStatusMessage,
      suppressAutoFitForUserViewportChange,
      text,
    ],
  );

  useEffect(() => {
    const drag = nodePositionDragRef.current;
    if (!drag || sameStoryIdentity(drag.identity, getCurrentStoryIdentity())) return;
    nodePositionDragRef.current = null;
    interactionLease.release(drag.leaseToken);
    setStatusMessage(text('graphCanvas.interactionStale'));
  }, [
    contentRevision,
    interactionLease,
    setStatusMessage,
    sourceDraftRevision,
    storySessionId,
    text,
  ]);

  useEffect(() => {
    if (canEditGraph) return;
    const drag = nodePositionDragRef.current;
    nodePositionDragRef.current = null;
    if (drag && sameStoryIdentity(drag.identity, getCurrentStoryIdentity())) {
      rollbackNodePosition(drag);
    }
    if (drag) interactionLease.release(drag.leaseToken);
  }, [canEditGraph, interactionLease, rollbackNodePosition]);

  useEffect(
    () => () => {
      const drag = nodePositionDragRef.current;
      nodePositionDragRef.current = null;
      if (drag && sameStoryIdentity(drag.identity, getCurrentStoryIdentity())) {
        rollbackNodePosition(drag);
      }
      if (drag) interactionLease.release(drag.leaseToken);
    },
    [interactionLease, rollbackNodePosition],
  );

  return {
    handleNodesChange,
    handleNodeClick,
    handleNodeDoubleClick,
    handlePaneClick,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragStop,
  };
}
