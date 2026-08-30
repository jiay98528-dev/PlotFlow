import React, { useEffect, useRef } from 'react';
import { type Node, useNodesInitialized, useReactFlow } from '@xyflow/react';
import { isGraphShortcutBlocked } from '../../services/graphKeyboardGuard';
import { useUIStore } from '../../stores/uiStore';
import { NODE_DIMENSIONS } from './layout';
import type { ScreenToFlowPosition } from './graphWireModel';

export const GRAPH_AUTO_FIT_MAX_ZOOM = 1.2;
const GRAPH_LAB_DEFAULT_ZOOM = 0.78;

export function ReactFlowRuntimeBridge({
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

export function ZoomResetShortcut(): null {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (isGraphShortcutBlocked(event)) return;
      if ((event.ctrlKey || event.metaKey) && event.key === '0') {
        event.preventDefault();
        void fitView({ duration: 200 });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitView]);
  return null;
}

export function GraphFocusController({ nodes }: { readonly nodes: readonly Node[] }): null {
  const request = useUIStore((state) => state.graphFocusRequest);
  const consumeGraphFocus = useUIStore((state) => state.consumeGraphFocus);
  const { fitView, getZoom, setCenter } = useReactFlow();

  useEffect(() => {
    if (!request) return;
    const target = nodes.find((node) => {
      const fullId = typeof node.data?.['fullId'] === 'string' ? node.data['fullId'] : node.id;
      return fullId === request.fullId;
    });
    if (!target) {
      consumeGraphFocus(request.requestId);
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (request.behavior === 'fit') {
        void fitView({
          nodes: [target],
          padding: 0.65,
          minZoom: 0.9,
          maxZoom: 1.15,
          duration: 180,
        });
      } else {
        const readableZoom = Math.min(1.15, Math.max(0.9, getZoom()));
        void setCenter(
          target.position.x + NODE_DIMENSIONS.width / 2,
          target.position.y + NODE_DIMENSIONS.height / 2,
          { zoom: readableZoom, duration: 180 },
        );
      }
      document
        .querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(target.id)}"]`)
        ?.focus({ preventScroll: true });
      consumeGraphFocus(request.requestId);
    });
    return () => cancelAnimationFrame(frame);
  }, [consumeGraphFocus, fitView, getZoom, nodes, request, setCenter]);

  return null;
}

export function AutoViewportOnGraphChange({
  enabled,
  isGraphLab,
  layoutKey,
  nodes,
  suppressRef,
}: {
  readonly enabled: boolean;
  readonly isGraphLab: boolean;
  readonly layoutKey: string;
  readonly nodes: readonly Node[];
  readonly suppressRef: React.RefObject<boolean>;
}): null {
  const { fitView, setCenter } = useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const appliedLayoutKeyRef = useRef<string | null>(null);
  const viewportRevision = `${isGraphLab ? 'graph-lab' : 'split'}:${layoutKey}`;

  useEffect(() => {
    if (!enabled || !nodesInitialized || nodes.length === 0) return;
    if (appliedLayoutKeyRef.current === viewportRevision) return;
    appliedLayoutKeyRef.current = viewportRevision;

    const frame = requestAnimationFrame(() => {
      if (suppressRef.current) return;
      if (isGraphLab) {
        const focusNode = nodes[0];
        if (!focusNode) return;
        void setCenter(
          focusNode.position.x + NODE_DIMENSIONS.width / 2,
          focusNode.position.y + NODE_DIMENSIONS.height / 2,
          { zoom: GRAPH_LAB_DEFAULT_ZOOM, duration: 0 },
        );
        return;
      }
      void fitView({ padding: 0.2, duration: 200, maxZoom: GRAPH_AUTO_FIT_MAX_ZOOM });
    });
    return () => cancelAnimationFrame(frame);
  }, [
    enabled,
    fitView,
    isGraphLab,
    nodes,
    nodesInitialized,
    setCenter,
    suppressRef,
    viewportRevision,
  ]);
  return null;
}
