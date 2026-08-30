import { useCallback, useEffect } from 'react';
import type React from 'react';
import type { Edge } from '@xyflow/react';
import type { StoryNode } from '@plotflow/core';
import type { AppTextKey } from '../../i18n/appI18n';
import { graphEditService } from '../../services/graphEditService';
import { parseEdgeId } from '../../stores/edgeStore';
import type { StoryEdgeData } from './StoryEdge';

const EDGE_HIT_FALLBACK_RADIUS = 24;
const EDGE_HIT_SAMPLE_COUNT = 24;

type GraphText = (
  key: AppTextKey,
  params?: Readonly<Record<string, string | number>>,
) => string;

function getScreenPointOnPath(path: SVGPathElement, length: number): DOMPoint | null {
  try {
    const screenTransform = path.getScreenCTM();
    if (!screenTransform) return null;
    return path.getPointAtLength(length).matrixTransform(screenTransform);
  } catch {
    return null;
  }
}

export function findOfficialEdgeIdAtPoint(clientX: number, clientY: number): string | null {
  let best: { edgeId: string; distance: number } | null = null;
  const paths = document.querySelectorAll<SVGPathElement>(
    '.official-graph-edge__hit-area[data-edge-id]',
  );
  for (const path of paths) {
    const edgeId = path.dataset['edgeId'];
    if (!edgeId) continue;
    let totalLength = 0;
    try {
      totalLength = path.getTotalLength();
    } catch {
      continue;
    }
    for (let index = 0; index <= EDGE_HIT_SAMPLE_COUNT; index++) {
      const screenPoint = getScreenPointOnPath(
        path,
        totalLength * (index / EDGE_HIT_SAMPLE_COUNT),
      );
      if (!screenPoint) continue;
      const distance = Math.hypot(screenPoint.x - clientX, screenPoint.y - clientY);
      if (!best || distance < best.distance) best = { edgeId, distance };
    }
  }
  return best && best.distance <= EDGE_HIT_FALLBACK_RADIUS ? best.edgeId : null;
}

interface GraphEdgeControllerOptions {
  readonly canEditGraph: boolean;
  readonly renamingNodeId: string | null;
  readonly altPressedRef: React.MutableRefObject<boolean>;
  readonly getNodeByFullId: (fullId: string) => StoryNode | undefined;
  readonly openConditionEditor: (sourceFullId: string, optionIndex: number) => void;
  readonly setStatusMessage: (message: string) => void;
  readonly text: GraphText;
}

export function useGraphEdgeController({
  canEditGraph,
  renamingNodeId,
  altPressedRef,
  getNodeByFullId,
  openConditionEditor,
  setStatusMessage,
  text,
}: GraphEdgeControllerOptions): {
  readonly handleEdgeClick: (event: React.MouseEvent, edge: Edge<StoryEdgeData>) => void;
  readonly handleEdgeHitAreaClickCapture: (event: React.MouseEvent<HTMLDivElement>) => void;
  readonly handleEdgeDoubleClick: (event: React.MouseEvent, edge: Edge<StoryEdgeData>) => void;
} {
  const disconnectEdgeById = useCallback(
    (edgeId: string): boolean => {
      try {
        const { sourceFullId, optionIndex } = parseEdgeId(edgeId);
        const sourceNode = getNodeByFullId(sourceFullId);
        if (!sourceNode) return false;
        const committed =
          optionIndex < 0
            ? graphEditService.connectNextTarget(sourceNode, null)
            : sourceNode.options[optionIndex]
              ? graphEditService.connectOption(sourceNode.options[optionIndex]!, null)
              : false;
        if (!committed) setStatusMessage(text('graphCanvas.changeNotApplied'));
        return committed;
      } catch {
        setStatusMessage(text('graphCanvas.changeNotApplied'));
        return false;
      }
    },
    [getNodeByFullId, setStatusMessage, text],
  );

  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge<StoryEdgeData>): void => {
      if (renamingNodeId !== null || !(event.altKey || altPressedRef.current)) return;
      event.preventDefault();
      disconnectEdgeById(edge.id);
    },
    [altPressedRef, disconnectEdgeById, renamingNodeId],
  );

  const handleEdgeHitAreaClickCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      if (renamingNodeId !== null || !(event.altKey || altPressedRef.current)) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const edgeElement = target.closest<HTMLElement>(
        '[data-edge-id].official-graph-edge__hit-area, [data-edge-id].official-graph-edge',
      );
      const edgeId =
        edgeElement?.dataset['edgeId'] ?? findOfficialEdgeIdAtPoint(event.clientX, event.clientY);
      if (!edgeId) return;
      event.preventDefault();
      event.stopPropagation();
      disconnectEdgeById(edgeId);
    },
    [altPressedRef, disconnectEdgeById, renamingNodeId],
  );

  useEffect(() => {
    if (!canEditGraph) return undefined;
    const handleDocumentClick = (event: MouseEvent): void => {
      if (renamingNodeId !== null || !(event.altKey || altPressedRef.current)) return;
      const edgeId = findOfficialEdgeIdAtPoint(event.clientX, event.clientY);
      if (!edgeId) return;
      event.preventDefault();
      event.stopPropagation();
      disconnectEdgeById(edgeId);
    };
    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [altPressedRef, canEditGraph, disconnectEdgeById, renamingNodeId]);

  const handleEdgeDoubleClick = useCallback(
    (_event: React.MouseEvent, edge: Edge<StoryEdgeData>): void => {
      if (renamingNodeId !== null) return;
      try {
        const { sourceFullId, optionIndex } = parseEdgeId(edge.id);
        if (optionIndex < 0) return;
        openConditionEditor(sourceFullId, optionIndex);
      } catch {
        setStatusMessage(text('graphCanvas.changeNotApplied'));
      }
    },
    [openConditionEditor, renamingNodeId, setStatusMessage, text],
  );

  return { handleEdgeClick, handleEdgeHitAreaClickCapture, handleEdgeDoubleClick };
}
