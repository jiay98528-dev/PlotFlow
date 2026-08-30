import { useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { AppTextKey } from '../../i18n/appI18n';
import { getCurrentStoryIdentity } from '../../services/sourceDraftCoordinator';
import { sameCanonicalStoryIdentity, type StoryIdentity } from '../../services/storySnapshot';
import { useEditorStore } from '../../stores/editorStore';
import type { StoryFlowNodeData } from './adapter';
import { layoutNodesInWorker } from './graphLayoutClient';

interface GraphLayoutControllerOptions {
  readonly nodes: Node[];
  readonly edges: Edge[];
  readonly setNodes: (nodes: Node[]) => void;
  readonly setStatusMessage: (message: string) => void;
  readonly text: (key: AppTextKey, params?: Readonly<Record<string, string | number>>) => string;
}

interface LayoutSnapshot {
  readonly graphSignature: string;
  readonly completionKey: string;
  readonly identity: StoryIdentity;
  readonly nodes: Node[];
  readonly edges: Edge[];
}

function graphLayoutSignature(nodes: readonly Node[], edges: readonly Edge[]): string {
  return [
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
}

/**
 * Runs one layout request at a time. Identity changes while a request is in
 * flight replace one queued snapshot, so obsolete results never publish and a
 * burst of source revisions produces at most one follow-up request.
 */
export function useGraphLayoutController({
  nodes,
  edges,
  setNodes,
  setStatusMessage,
  text,
}: GraphLayoutControllerOptions): void {
  const storySessionId = useEditorStore((state) => state.storySessionId);
  const contentRevision = useEditorStore((state) => state.contentRevision);
  const [dispatchRevision, setDispatchRevision] = useState(0);
  const mountedRef = useRef(true);
  const activeRequestRef = useRef<LayoutSnapshot | null>(null);
  const queuedSnapshotRef = useRef<LayoutSnapshot | null>(null);
  const latestSnapshotRef = useRef<LayoutSnapshot | null>(null);
  const completedKeyRef = useRef<string | null>(null);

  const hasCompleteManualLayout = useMemo(
    () =>
      nodes.length > 0 &&
      nodes.every((node) => {
        const data = node.data as StoryFlowNodeData | undefined;
        return Boolean(data?.persistedPosition);
      }),
    [nodes],
  );

  const graphSignature = useMemo(() => graphLayoutSignature(nodes, edges), [edges, nodes]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      queuedSnapshotRef.current = null;
      latestSnapshotRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (hasCompleteManualLayout || nodes.length === 0) {
      latestSnapshotRef.current = null;
      queuedSnapshotRef.current = null;
      return;
    }

    const identity = getCurrentStoryIdentity();
    const snapshot: LayoutSnapshot = {
      graphSignature,
      completionKey: `${identity.storySessionId}:${graphSignature}`,
      identity,
      nodes,
      edges,
    };
    latestSnapshotRef.current = snapshot;

    if (completedKeyRef.current === snapshot.completionKey) return;
    if (activeRequestRef.current) {
      const active = activeRequestRef.current;
      if (
        active.graphSignature !== snapshot.graphSignature ||
        !sameCanonicalStoryIdentity(active.identity, snapshot.identity)
      ) {
        queuedSnapshotRef.current = snapshot;
      }
      return;
    }

    activeRequestRef.current = snapshot;
    queuedSnapshotRef.current = null;
    void layoutNodesInWorker(snapshot.nodes, snapshot.edges)
      .then((result) => {
        if (!mountedRef.current || activeRequestRef.current !== snapshot) return;
        activeRequestRef.current = null;
        const latest = latestSnapshotRef.current;
        const isCurrent =
          latest !== null &&
          latest.graphSignature === snapshot.graphSignature &&
          sameCanonicalStoryIdentity(snapshot.identity, getCurrentStoryIdentity());
        if (!result.stale && isCurrent) {
          completedKeyRef.current = snapshot.completionKey;
          setNodes(
            result.nodes.map((node) => {
              const data = node.data as StoryFlowNodeData | undefined;
              const persisted = data?.persistedPosition;
              return persisted ? { ...node, position: { ...persisted } } : node;
            }),
          );
          if (result.layoutMode === 'fallback-grid') {
            setStatusMessage(
              result.errorMessage
                ? text('graphCanvas.layoutFallbackError', { detail: result.errorMessage })
                : text('graphCanvas.layoutFallbackLarge', { count: snapshot.nodes.length }),
            );
          } else if (result.elapsedMs > 250) {
            setStatusMessage(
              text('graphCanvas.layoutCompleted', { elapsed: Math.round(result.elapsedMs) }),
            );
          }
        } else if (latest) {
          queuedSnapshotRef.current = latest;
        }

        if (queuedSnapshotRef.current && mountedRef.current) {
          setDispatchRevision((revision) => revision + 1);
        }
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || activeRequestRef.current !== snapshot) return;
        activeRequestRef.current = null;
        if (!queuedSnapshotRef.current) completedKeyRef.current = snapshot.completionKey;
        setStatusMessage(error instanceof Error ? error.message : String(error));
        if (queuedSnapshotRef.current) {
          setDispatchRevision((revision) => revision + 1);
        }
      });
  }, [
    contentRevision,
    dispatchRevision,
    edges,
    graphSignature,
    hasCompleteManualLayout,
    nodes,
    setNodes,
    setStatusMessage,
    storySessionId,
    text,
  ]);
}
