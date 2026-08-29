import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  reconnectEdge,
  type Connection,
  type Edge,
  type Node,
  type OnConnectStartParams,
} from '@xyflow/react';
import type { StoryNode } from '@plotflow/core';
import type { AppTextKey } from '../../i18n/appI18n';
import { graphEditService } from '../../services/graphEditService';
import { getCurrentStoryIdentity } from '../../services/sourceDraftCoordinator';
import { sameStoryIdentity, type StoryIdentity } from '../../services/storySnapshot';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { parseEdgeId } from '../../stores/edgeStore';
import {
  createGraphConnectionController,
  isGraphConnectionValid,
} from './graphConnectionController';
import type { GraphInteractionLease, GraphInteractionToken } from './graphInteractionLease';
import type { GraphWireDropAction } from './GraphWireDropMenu';
import {
  eventToClientPoint,
  getStoryNodeIdFromPoint,
  getWireDragSourceFromTarget,
  isPointInsideReactFlow,
  resolveGraphRoute,
  routeReferenceFromStart,
  type ClientPoint,
  type GraphRouteReference,
  type LiveWirePreview,
  type ManualWireDrag,
  type ScreenToFlowPosition,
  type WireDropContext,
} from './graphWireModel';

type GraphText = (
  key: AppTextKey,
  params?: Readonly<Record<string, string | number>>,
) => string;

interface GraphWireControllerOptions {
  readonly canEditGraph: boolean;
  readonly renamingNodeId: string | null;
  readonly nodes: Node[];
  readonly edges: Edge[];
  readonly getNodeByFullId: (fullId: string) => StoryNode | undefined;
  readonly setEdges: (edges: Edge[]) => void;
  readonly setStatusMessage: (message: string) => void;
  readonly text: GraphText;
  readonly screenToFlowPositionRef: React.MutableRefObject<ScreenToFlowPosition | null>;
  readonly interactionLease: GraphInteractionLease;
  readonly suppressNextPaneClick: () => void;
}

export interface GraphWireController {
  readonly liveWirePreview: LiveWirePreview | null;
  readonly wireDropContext: WireDropContext | null;
  readonly handleConnectStart: (
    event: MouseEvent | TouchEvent,
    params: OnConnectStartParams,
  ) => void;
  readonly handleConnect: (connection: Connection) => void;
  readonly handleConnectEnd: (event: globalThis.MouseEvent | globalThis.TouchEvent) => void;
  readonly handleReconnectStart: (event: unknown, edge: Edge, handleType: unknown) => void;
  readonly handleReconnect: (oldEdge: Edge, newConnection: Connection) => void;
  readonly handleReconnectEnd: (event: unknown, edge: Edge, handleType: unknown) => void;
  readonly handleIsValidConnection: (connection: Edge | Connection) => boolean;
  readonly handleManualWirePointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  readonly handleManualWirePointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  readonly handleManualWirePointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
  readonly handleManualWireMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  readonly handleManualWireMouseUp: (event: React.MouseEvent<HTMLDivElement>) => void;
  readonly executeWireDropAction: (action: GraphWireDropAction) => void;
  readonly closeWireDrop: (restoreFocus?: boolean) => void;
}

function currentIdentityMatches(identity: StoryIdentity | null): identity is StoryIdentity {
  return Boolean(identity && sameStoryIdentity(identity, getCurrentStoryIdentity()));
}

export function useGraphWireController({
  canEditGraph,
  renamingNodeId,
  nodes,
  edges,
  getNodeByFullId,
  setEdges,
  setStatusMessage,
  text,
  screenToFlowPositionRef,
  interactionLease,
  suppressNextPaneClick,
}: GraphWireControllerOptions): GraphWireController {
  const storySessionId = useEditorStore((state) => state.storySessionId);
  const contentRevision = useEditorStore((state) => state.contentRevision);
  const sourceDraftRevision = useEditorStore((state) => state.sourceDraftRevision);
  const [connectionController] = useState(createGraphConnectionController);
  const manualWireDragRef = useRef<ManualWireDrag | null>(null);
  const connectLeaseTokenRef = useRef<GraphInteractionToken | null>(null);
  const reconnectLeaseTokenRef = useRef<GraphInteractionToken | null>(null);
  const manualWireLeaseTokenRef = useRef<GraphInteractionToken | null>(null);
  const connectTriggerRef = useRef<HTMLElement | null>(null);
  const reconnectTriggerRef = useRef<HTMLElement | null>(null);
  const wireDropContextRef = useRef<WireDropContext | null>(null);
  const [liveWirePreview, setLiveWirePreview] = useState<LiveWirePreview | null>(null);
  const [wireDropContext, setWireDropContext] = useState<WireDropContext | null>(null);
  const [manualWireActive, setManualWireActive] = useState(false);

  const publishWireDropContext = useCallback((context: WireDropContext | null): void => {
    wireDropContextRef.current = context;
    setWireDropContext(context);
  }, []);

  const closeWireDrop = useCallback(
    (restoreFocus = false): void => {
      const context = wireDropContextRef.current;
      publishWireDropContext(null);
      if (restoreFocus && context?.trigger?.isConnected) {
        context.trigger.focus({ preventScroll: true });
      }
    },
    [publishWireDropContext],
  );

  const reportStaleInteraction = useCallback((): void => {
    setStatusMessage(text('graphCanvas.interactionStale'));
  }, [setStatusMessage, text]);

  const reportFailedInteraction = useCallback((): void => {
    setStatusMessage(text('graphCanvas.changeNotApplied'));
  }, [setStatusMessage, text]);

  const commitRouteTarget = useCallback(
    (reference: GraphRouteReference, targetFullId: string | null): boolean => {
      try {
        const route = resolveGraphRoute(reference, getNodeByFullId);
        if (!route || targetFullId === reference.sourceFullId) return false;
        if (targetFullId && !getNodeByFullId(targetFullId)) return false;
        return route.kind === 'next'
          ? graphEditService.connectNextTarget(route.sourceNode, targetFullId)
          : graphEditService.connectOption(route.option, targetFullId);
      } catch {
        return false;
      }
    },
    [getNodeByFullId],
  );

  const openDropContext = useCallback(
    (
      mode: WireDropContext['mode'],
      position: ClientPoint,
      route: GraphRouteReference,
      identity: StoryIdentity,
      trigger: HTMLElement | null,
    ): void => {
      const flowPosition = screenToFlowPositionRef.current?.(position) ?? position;
      publishWireDropContext({ mode, position, flowPosition, route, identity, trigger });
      setStatusMessage(text('graphCanvas.chooseWireTarget'));
    },
    [publishWireDropContext, screenToFlowPositionRef, setStatusMessage, text],
  );

  const finishPendingDrop = useCallback(
    ({
      mode,
      event,
      route,
      identity,
      trigger,
    }: {
      readonly mode: WireDropContext['mode'];
      readonly event: unknown;
      readonly route: GraphRouteReference | null;
      readonly identity: StoryIdentity | null;
      readonly trigger: HTMLElement | null;
    }): void => {
      if (!route || !identity) {
        setStatusMessage(text('graphCanvas.missingConnectableRoute'));
        return;
      }
      if (!currentIdentityMatches(identity)) {
        reportStaleInteraction();
        return;
      }
      const resolvedRoute = resolveGraphRoute(route, getNodeByFullId);
      if (!resolvedRoute) {
        setStatusMessage(text('graphCanvas.missingConnectableRoute'));
        return;
      }

      const clientPoint = eventToClientPoint(event);
      if (!isPointInsideReactFlow(clientPoint)) {
        setStatusMessage(text('graphCanvas.cancelledWireDrag'));
        return;
      }
      const dropTargetFullId = getStoryNodeIdFromPoint(clientPoint, nodes);
      if (dropTargetFullId && dropTargetFullId !== route.sourceFullId) {
        const targetNode = getNodeByFullId(dropTargetFullId);
        if (!targetNode || !commitRouteTarget(route, targetNode.fullId)) {
          reportFailedInteraction();
          return;
        }
        setStatusMessage(
          text(mode === 'reconnect' ? 'graphCanvas.reconnected' : 'graphCanvas.connected', {
            title: targetNode.title,
          }),
        );
        return;
      }
      openDropContext(mode, clientPoint, route, identity, trigger);
    },
    [
      commitRouteTarget,
      getNodeByFullId,
      nodes,
      openDropContext,
      reportFailedInteraction,
      reportStaleInteraction,
      setStatusMessage,
      text,
    ],
  );

  const handleConnectStart = useCallback(
    (event: MouseEvent | TouchEvent, params: OnConnectStartParams): void => {
      if (renamingNodeId !== null || connectLeaseTokenRef.current) return;
      const identity = getCurrentStoryIdentity();
      connectionController.beginConnect(params, identity);
      connectLeaseTokenRef.current = interactionLease.acquire('connect');
      const route = routeReferenceFromStart(params);
      const trigger =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>('.story-node-connect-handle')
          : null;
      connectTriggerRef.current = trigger;
      if (!route || !resolveGraphRoute(route, getNodeByFullId)) return;
      const startPoint = eventToClientPoint(event);
      setLiveWirePreview({
        route,
        identity,
        trigger,
        pointerId: -1,
        startPoint,
        currentPoint: startPoint,
      });
    },
    [connectionController, getNodeByFullId, interactionLease, renamingNodeId],
  );

  const handleConnect = useCallback(
    (connection: Connection): void => {
      const attempt = connectionController.peekConnect();
      if (!attempt || attempt.outcome !== 'pending') return;
      if (!currentIdentityMatches(attempt.identity)) {
        connectionController.markConnectFailed();
        reportStaleInteraction();
        return;
      }
      const route = routeReferenceFromStart({
        nodeId: connection.source,
        handleId: connection.sourceHandle,
      });
      const targetNode = getNodeByFullId(connection.target);
      if (!route || !targetNode || !commitRouteTarget(route, targetNode.fullId)) {
        connectionController.markConnectFailed();
        reportFailedInteraction();
        return;
      }
      connectionController.markConnectSucceeded();
      setStatusMessage(text('graphCanvas.connected', { title: targetNode.title }));
    },
    [
      commitRouteTarget,
      connectionController,
      getNodeByFullId,
      reportFailedInteraction,
      reportStaleInteraction,
      setStatusMessage,
      text,
    ],
  );

  const handleConnectEnd = useCallback(
    (event: globalThis.MouseEvent | globalThis.TouchEvent): void => {
      const attempt = connectionController.finishConnect();
      const trigger = connectTriggerRef.current;
      connectTriggerRef.current = null;
      setLiveWirePreview(null);
      try {
        if (attempt.outcome !== 'pending') return;
        finishPendingDrop({
          mode: 'connect',
          event,
          route: attempt.startParams ? routeReferenceFromStart(attempt.startParams) : null,
          identity: attempt.identity,
          trigger,
        });
      } finally {
        const token = connectLeaseTokenRef.current;
        connectLeaseTokenRef.current = null;
        if (token) interactionLease.release(token);
      }
    },
    [connectionController, finishPendingDrop, interactionLease],
  );

  const handleReconnectStart = useCallback(
    (event: unknown, edge: Edge, _handleType: unknown): void => {
      if (renamingNodeId !== null || reconnectLeaseTokenRef.current) return;
      connectionController.beginReconnect(edge, getCurrentStoryIdentity());
      reconnectTriggerRef.current =
        typeof event === 'object' &&
        event !== null &&
        'target' in event &&
        event.target instanceof HTMLElement
          ? event.target
          : null;
      reconnectLeaseTokenRef.current = interactionLease.acquire('reconnect');
    },
    [connectionController, interactionLease, renamingNodeId],
  );

  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection): void => {
      const attempt = connectionController.peekReconnect();
      if (!attempt || attempt.outcome !== 'pending') return;
      if (!currentIdentityMatches(attempt.identity)) {
        connectionController.markReconnectFailed();
        reportStaleInteraction();
        return;
      }
      try {
        const { sourceFullId, optionIndex } = parseEdgeId(oldEdge.id);
        const route = { sourceFullId, optionIndex };
        const targetNode = getNodeByFullId(newConnection.target);
        if (!targetNode || !commitRouteTarget(route, targetNode.fullId)) {
          connectionController.markReconnectFailed();
          reportFailedInteraction();
          return;
        }
        connectionController.markReconnectSucceeded();
        const currentEdges = useGraphStore.getState().edges;
        try {
          setEdges(
            reconnectEdge(oldEdge, newConnection, currentEdges, {
              shouldReplaceId: true,
            }),
          );
        } catch {
          // The committed source remains authoritative; parsing restores the edge projection.
        }
        setStatusMessage(text('graphCanvas.reconnected', { title: targetNode.title }));
      } catch {
        connectionController.markReconnectFailed();
        reportFailedInteraction();
      }
    },
    [
      commitRouteTarget,
      connectionController,
      getNodeByFullId,
      reportFailedInteraction,
      reportStaleInteraction,
      setEdges,
      setStatusMessage,
      text,
    ],
  );

  const handleReconnectEnd = useCallback(
    (event: unknown, edge: Edge, _handleType: unknown): void => {
      const attempt = connectionController.finishReconnect(edge);
      const trigger = reconnectTriggerRef.current;
      reconnectTriggerRef.current = null;
      try {
        if (attempt.outcome !== 'pending') return;
        let route: GraphRouteReference | null = null;
        try {
          route = parseEdgeId(attempt.edge.id);
        } catch {
          reportFailedInteraction();
          return;
        }
        finishPendingDrop({
          mode: 'reconnect',
          event,
          route,
          identity: attempt.identity,
          trigger,
        });
      } finally {
        const token = reconnectLeaseTokenRef.current;
        reconnectLeaseTokenRef.current = null;
        if (token) interactionLease.release(token);
      }
    },
    [connectionController, finishPendingDrop, interactionLease, reportFailedInteraction],
  );

  const handleIsValidConnection = useCallback(
    (connection: Edge | Connection): boolean =>
      isGraphConnectionValid(connection, edges, (nodeId) => Boolean(getNodeByFullId(nodeId))),
    [edges, getNodeByFullId],
  );

  const beginManualWire = useCallback(
    ({
      route,
      trigger,
      pointerId,
      point,
    }: {
      readonly route: GraphRouteReference;
      readonly trigger: HTMLElement;
      readonly pointerId: number;
      readonly point: ClientPoint;
    }): void => {
      const identity = getCurrentStoryIdentity();
      const drag: ManualWireDrag = {
        route,
        identity,
        trigger,
        pointerId,
        startPoint: point,
      };
      manualWireDragRef.current = drag;
      setLiveWirePreview({ ...drag, currentPoint: point });
      setManualWireActive(true);
      manualWireLeaseTokenRef.current = interactionLease.acquire('manual-wire');
      closeWireDrop(false);
    },
    [closeWireDrop, interactionLease],
  );

  const handleManualWirePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (
        renamingNodeId !== null ||
        manualWireDragRef.current !== null ||
        event.button !== 0 ||
        !event.isPrimary
      )
        return;
      const source = getWireDragSourceFromTarget(event.target);
      if (!source) return;
      beginManualWire({
        ...source,
        pointerId: event.pointerId,
        point: { x: event.clientX, y: event.clientY },
      });
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        manualWireDragRef.current = null;
        setManualWireActive(false);
        setLiveWirePreview(null);
        const token = manualWireLeaseTokenRef.current;
        manualWireLeaseTokenRef.current = null;
        if (token) interactionLease.release(token);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [beginManualWire, interactionLease, renamingNodeId],
  );

  const handleManualWireMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      if (renamingNodeId !== null || event.button !== 0) return;
      if (manualWireDragRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const source = getWireDragSourceFromTarget(event.target);
      if (!source) return;
      beginManualWire({
        ...source,
        pointerId: -1,
        point: { x: event.clientX, y: event.clientY },
      });
      event.preventDefault();
      event.stopPropagation();
    },
    [beginManualWire, renamingNodeId],
  );

  const finishManualWireDrag = useCallback(
    (clientPoint: ClientPoint): boolean => {
      const drag = manualWireDragRef.current;
      if (!drag) return false;
      manualWireDragRef.current = null;
      setManualWireActive(false);
      setLiveWirePreview(null);
      try {
        const distance = Math.hypot(
          clientPoint.x - drag.startPoint.x,
          clientPoint.y - drag.startPoint.y,
        );
        if (distance < 4) return true;
        suppressNextPaneClick();
        if (!currentIdentityMatches(drag.identity)) {
          reportStaleInteraction();
          return true;
        }
        if (!isPointInsideReactFlow(clientPoint)) {
          setStatusMessage(text('graphCanvas.cancelledWireDrag'));
          return true;
        }
        const route = resolveGraphRoute(drag.route, getNodeByFullId);
        if (!route) {
          setStatusMessage(text('graphCanvas.missingConnectableRoute'));
          return true;
        }
        const dropTargetFullId = getStoryNodeIdFromPoint(clientPoint, nodes);
        if (dropTargetFullId && dropTargetFullId !== drag.route.sourceFullId) {
          const targetNode = getNodeByFullId(dropTargetFullId);
          if (!targetNode || !commitRouteTarget(drag.route, targetNode.fullId)) {
            reportFailedInteraction();
            return true;
          }
          setStatusMessage(text('graphCanvas.connected', { title: targetNode.title }));
          return true;
        }
        openDropContext(
          route.kind === 'next'
            ? route.sourceNode.nextTarget?.targetNodeId
              ? 'reconnect'
              : 'connect'
            : route.option.targetNodeId
              ? 'reconnect'
              : 'connect',
          clientPoint,
          drag.route,
          drag.identity,
          drag.trigger,
        );
        return true;
      } finally {
        const token = manualWireLeaseTokenRef.current;
        manualWireLeaseTokenRef.current = null;
        if (token) interactionLease.release(token);
      }
    },
    [
      commitRouteTarget,
      getNodeByFullId,
      interactionLease,
      nodes,
      openDropContext,
      reportFailedInteraction,
      reportStaleInteraction,
      setStatusMessage,
      suppressNextPaneClick,
      text,
    ],
  );

  const handleManualWirePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const drag = manualWireDragRef.current;
      if (!drag || drag.pointerId < 0 || drag.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      finishManualWireDrag({ x: event.clientX, y: event.clientY });
      event.preventDefault();
      event.stopPropagation();
    },
    [finishManualWireDrag],
  );

  const handleManualWireMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement>): void => {
      if (manualWireDragRef.current?.pointerId !== -1) return;
      finishManualWireDrag({ x: event.clientX, y: event.clientY });
      event.preventDefault();
      event.stopPropagation();
    },
    [finishManualWireDrag],
  );

  const handleManualWirePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const drag = manualWireDragRef.current;
      if (!drag || drag.pointerId < 0 || drag.pointerId !== event.pointerId) return;
      manualWireDragRef.current = null;
      setManualWireActive(false);
      setLiveWirePreview(null);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const token = manualWireLeaseTokenRef.current;
      manualWireLeaseTokenRef.current = null;
      if (token) interactionLease.release(token);
    },
    [interactionLease],
  );

  useEffect(() => {
    if (!manualWireActive) return undefined;
    const handleGlobalPointerMove = (event: PointerEvent): void => {
      const drag = manualWireDragRef.current;
      if (!drag || drag.pointerId < 0 || drag.pointerId !== event.pointerId) return;
      setLiveWirePreview((preview) =>
        preview ? { ...preview, currentPoint: { x: event.clientX, y: event.clientY } } : preview,
      );
    };
    const handleGlobalPointerUp = (event: PointerEvent): void => {
      const drag = manualWireDragRef.current;
      if (!drag || drag.pointerId < 0 || drag.pointerId !== event.pointerId) return;
      if (finishManualWireDrag({ x: event.clientX, y: event.clientY })) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleGlobalMouseMove = (event: MouseEvent): void => {
      if (manualWireDragRef.current?.pointerId !== -1) return;
      setLiveWirePreview((preview) =>
        preview ? { ...preview, currentPoint: { x: event.clientX, y: event.clientY } } : preview,
      );
    };
    const handleGlobalMouseUp = (event: MouseEvent): void => {
      if (manualWireDragRef.current?.pointerId !== -1) return;
      if (finishManualWireDrag({ x: event.clientX, y: event.clientY })) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const handleGlobalPointerCancel = (event: PointerEvent): void => {
      const drag = manualWireDragRef.current;
      if (!drag || drag.pointerId < 0 || drag.pointerId !== event.pointerId) return;
      manualWireDragRef.current = null;
      setManualWireActive(false);
      setLiveWirePreview(null);
      const token = manualWireLeaseTokenRef.current;
      manualWireLeaseTokenRef.current = null;
      if (token) interactionLease.release(token);
    };

    window.addEventListener('pointermove', handleGlobalPointerMove, true);
    window.addEventListener('pointerup', handleGlobalPointerUp, true);
    window.addEventListener('pointercancel', handleGlobalPointerCancel, true);
    window.addEventListener('mousemove', handleGlobalMouseMove, true);
    window.addEventListener('mouseup', handleGlobalMouseUp, true);
    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove, true);
      window.removeEventListener('pointerup', handleGlobalPointerUp, true);
      window.removeEventListener('pointercancel', handleGlobalPointerCancel, true);
      window.removeEventListener('mousemove', handleGlobalMouseMove, true);
      window.removeEventListener('mouseup', handleGlobalMouseUp, true);
    };
  }, [finishManualWireDrag, interactionLease, manualWireActive]);

  useEffect(() => {
    const currentIdentity = getCurrentStoryIdentity();
    const manualDrag = manualWireDragRef.current;
    if (manualDrag && !sameStoryIdentity(manualDrag.identity, currentIdentity)) {
      manualWireDragRef.current = null;
      setManualWireActive(false);
      setLiveWirePreview(null);
      const token = manualWireLeaseTokenRef.current;
      manualWireLeaseTokenRef.current = null;
      if (token) interactionLease.release(token);
      reportStaleInteraction();
    }
    const context = wireDropContextRef.current;
    if (context && !sameStoryIdentity(context.identity, currentIdentity)) {
      closeWireDrop(false);
      reportStaleInteraction();
    }
    const connectAttempt = connectionController.peekConnect();
    if (
      connectAttempt &&
      connectAttempt.outcome === 'pending' &&
      !sameStoryIdentity(connectAttempt.identity, currentIdentity)
    ) {
      connectionController.cancelConnect();
      connectTriggerRef.current = null;
      setLiveWirePreview(null);
      const token = connectLeaseTokenRef.current;
      connectLeaseTokenRef.current = null;
      if (token) interactionLease.release(token);
      reportStaleInteraction();
    }
    const reconnectAttempt = connectionController.peekReconnect();
    if (
      reconnectAttempt &&
      reconnectAttempt.outcome === 'pending' &&
      !sameStoryIdentity(reconnectAttempt.identity, currentIdentity)
    ) {
      connectionController.cancelReconnect();
      reconnectTriggerRef.current = null;
      const token = reconnectLeaseTokenRef.current;
      reconnectLeaseTokenRef.current = null;
      if (token) interactionLease.release(token);
      reportStaleInteraction();
    }
  }, [
    closeWireDrop,
    connectionController,
    contentRevision,
    interactionLease,
    reportStaleInteraction,
    sourceDraftRevision,
    storySessionId,
  ]);

  useEffect(() => {
    if (canEditGraph) return;
    manualWireDragRef.current = null;
    manualWireLeaseTokenRef.current = null;
    connectLeaseTokenRef.current = null;
    reconnectLeaseTokenRef.current = null;
    connectTriggerRef.current = null;
    reconnectTriggerRef.current = null;
    connectionController.cancelConnect();
    connectionController.cancelReconnect();
    setManualWireActive(false);
    setLiveWirePreview(null);
    closeWireDrop(false);
    interactionLease.releaseAll();
  }, [canEditGraph, closeWireDrop, connectionController, interactionLease]);

  useEffect(
    () => () => {
      manualWireDragRef.current = null;
      wireDropContextRef.current = null;
      connectionController.cancelConnect();
      connectionController.cancelReconnect();
    },
    [connectionController],
  );

  const executeWireDropAction = useCallback(
    (action: GraphWireDropAction): void => {
      const context = wireDropContextRef.current;
      if (!context) return;
      if (!currentIdentityMatches(context.identity)) {
        reportStaleInteraction();
        closeWireDrop(false);
        return;
      }
      const route = resolveGraphRoute(context.route, getNodeByFullId);
      if (!route) {
        setStatusMessage(text('graphCanvas.missingConnectableRoute'));
        closeWireDrop(false);
        return;
      }

      let committed = false;
      try {
        if (action.type === 'connect') {
          committed = commitRouteTarget(context.route, action.targetFullId);
          if (committed) {
            setStatusMessage(text('graphCanvas.connected', { title: action.targetTitle }));
          }
        } else if (action.type === 'create') {
          committed =
            route.kind === 'next'
              ? graphEditService.createNodeAndConnectNext(
                  route.sourceNode,
                  action.title,
                  context.flowPosition,
                )
              : graphEditService.createNodeAndConnect(
                  route.sourceNode,
                  route.option,
                  action.title,
                  context.flowPosition,
                );
          if (committed) {
            setStatusMessage(text('graphCanvas.createdAndConnected', { title: action.title }));
          }
        } else {
          committed = commitRouteTarget(context.route, null);
          if (committed) {
            setStatusMessage(
              route.kind === 'next'
                ? text('graphCanvas.disconnectedNext', { title: route.sourceNode.title })
                : text('graphCanvas.disconnectedOption', {
                    title: route.sourceNode.title,
                    index: context.route.optionIndex + 1,
                  }),
            );
          }
        }
      } catch {
        committed = false;
      }
      if (!committed) reportFailedInteraction();
      closeWireDrop(false);
    },
    [
      closeWireDrop,
      commitRouteTarget,
      getNodeByFullId,
      reportFailedInteraction,
      reportStaleInteraction,
      setStatusMessage,
      text,
    ],
  );

  return {
    liveWirePreview,
    wireDropContext,
    handleConnectStart,
    handleConnect,
    handleConnectEnd,
    handleReconnectStart,
    handleReconnect,
    handleReconnectEnd,
    handleIsValidConnection,
    handleManualWirePointerDown,
    handleManualWirePointerUp,
    handleManualWirePointerCancel,
    handleManualWireMouseDown,
    handleManualWireMouseUp,
    executeWireDropAction,
    closeWireDrop,
  };
}
