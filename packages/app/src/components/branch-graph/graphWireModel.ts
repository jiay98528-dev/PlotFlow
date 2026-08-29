import type { Node, OnConnectStartParams } from '@xyflow/react';
import type { Option, StoryNode } from '@plotflow/core';
import type { StoryIdentity } from '../../services/storySnapshot';
import { NEXT_EDGE_OPTION_INDEX } from '../../stores/edgeStore';
import { resolveStoryFullIdForFlowNodeId } from './adapter';

export interface ClientPoint {
  readonly x: number;
  readonly y: number;
}

export type ScreenToFlowPosition = (position: ClientPoint) => ClientPoint;

export interface GraphRouteReference {
  readonly sourceFullId: string;
  readonly optionIndex: number;
}

export interface ResolvedNextRoute {
  readonly kind: 'next';
  readonly sourceNode: StoryNode;
}

export interface ResolvedOptionRoute {
  readonly kind: 'option';
  readonly sourceNode: StoryNode;
  readonly option: Option;
}

export type ResolvedGraphRoute = ResolvedNextRoute | ResolvedOptionRoute;

export interface WireDropContext {
  readonly mode: 'connect' | 'reconnect';
  readonly position: ClientPoint;
  readonly flowPosition: ClientPoint;
  readonly route: GraphRouteReference;
  readonly identity: StoryIdentity;
  readonly trigger: HTMLElement | null;
}

export interface ManualWireDrag {
  readonly route: GraphRouteReference;
  readonly identity: StoryIdentity;
  readonly pointerId: number;
  readonly startPoint: ClientPoint;
  readonly trigger: HTMLElement | null;
}

export interface LiveWirePreview extends ManualWireDrag {
  readonly currentPoint: ClientPoint;
}

export function isNextRoute(reference: GraphRouteReference): boolean {
  return reference.optionIndex === NEXT_EDGE_OPTION_INDEX;
}

export function routeReferenceFromStart(
  params: Pick<OnConnectStartParams, 'nodeId' | 'handleId'>,
): GraphRouteReference | null {
  const sourceFullId = params.nodeId ?? '';
  const optionIndex = Number.parseInt(
    params.handleId === 'next'
      ? String(NEXT_EDGE_OPTION_INDEX)
      : (params.handleId?.replace('option-', '') ?? ''),
    10,
  );
  if (
    !sourceFullId ||
    !Number.isInteger(optionIndex) ||
    optionIndex < NEXT_EDGE_OPTION_INDEX
  ) {
    return null;
  }
  return { sourceFullId, optionIndex };
}

export function resolveGraphRoute(
  reference: GraphRouteReference,
  getNodeByFullId: (fullId: string) => StoryNode | undefined,
): ResolvedGraphRoute | null {
  const sourceNode = getNodeByFullId(reference.sourceFullId);
  if (!sourceNode) return null;
  if (isNextRoute(reference)) return { kind: 'next', sourceNode };
  const option = sourceNode.options[reference.optionIndex];
  return option ? { kind: 'option', sourceNode, option } : null;
}

export function eventToClientPoint(event: unknown): ClientPoint {
  if (
    typeof MouseEvent !== 'undefined' &&
    event instanceof MouseEvent
  ) {
    return { x: event.clientX, y: event.clientY };
  }
  if (
    typeof TouchEvent !== 'undefined' &&
    event instanceof TouchEvent
  ) {
    const touch = event.changedTouches[0] ?? event.touches[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
  }
  if (
    typeof event === 'object' &&
    event !== null &&
    'clientX' in event &&
    'clientY' in event &&
    typeof event.clientX === 'number' &&
    typeof event.clientY === 'number'
  ) {
    return { x: event.clientX, y: event.clientY };
  }
  return {
    x: typeof window === 'undefined' ? 0 : window.innerWidth / 2,
    y: typeof window === 'undefined' ? 0 : window.innerHeight / 2,
  };
}

export function getStoryNodeIdFromPoint(
  point: ClientPoint,
  graphNodes: readonly Pick<Node, 'id' | 'data'>[],
): string | null {
  const element = document.elementFromPoint(point.x, point.y);
  const nodeElement = element instanceof Element ? element.closest('.react-flow__node') : null;
  if (!(nodeElement instanceof HTMLElement)) return null;

  const rawId =
    nodeElement.dataset['id'] ??
    nodeElement.getAttribute('data-id') ??
    nodeElement.getAttribute('aria-label') ??
    nodeElement.id.replace(/^react-flow__node-/, '');
  const normalized = rawId.trim();
  if (!normalized || normalized.includes('collapse')) return null;
  return resolveStoryFullIdForFlowNodeId(normalized, graphNodes);
}

export function isPointInsideReactFlow(point: ClientPoint): boolean {
  const element = document.elementFromPoint(point.x, point.y);
  return element instanceof Element && Boolean(element.closest('.react-flow'));
}

export function getWireDragSourceFromTarget(
  target: EventTarget | null,
): { readonly route: GraphRouteReference; readonly trigger: HTMLElement } | null {
  if (!(target instanceof Element)) return null;
  const handle = target.closest('.story-node-connect-handle');
  if (!(handle instanceof HTMLElement)) return null;

  const sourceFullId =
    handle.dataset['sourceFullId'] ??
    handle.dataset['nodeid'] ??
    handle.getAttribute('data-nodeid') ??
    '';
  const optionIndexRaw =
    handle.dataset['optionIndex'] ??
    handle.dataset['handleid']?.replace('option-', '') ??
    handle.getAttribute('data-handleid')?.replace('option-', '') ??
    '';
  const optionIndex = Number.parseInt(optionIndexRaw, 10);
  if (
    !sourceFullId ||
    !Number.isInteger(optionIndex) ||
    optionIndex < NEXT_EDGE_OPTION_INDEX
  ) {
    return null;
  }
  return { route: { sourceFullId, optionIndex }, trigger: handle };
}
