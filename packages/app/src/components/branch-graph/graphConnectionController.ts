import type { Connection, Edge, OnConnectStartParams } from '@xyflow/react';
import type { StoryIdentity } from '../../services/storySnapshot';

export type GraphConnectionOutcome = 'pending' | 'succeeded' | 'failed';

export interface ActiveConnectAttempt {
  readonly outcome: GraphConnectionOutcome;
  readonly startParams: OnConnectStartParams;
  readonly identity: StoryIdentity;
}

export interface ActiveReconnectAttempt {
  readonly outcome: GraphConnectionOutcome;
  readonly edge: Edge;
  readonly identity: StoryIdentity;
}

export interface ConnectAttemptResult {
  readonly outcome: GraphConnectionOutcome | 'idle';
  readonly startParams: OnConnectStartParams | null;
  readonly identity: StoryIdentity | null;
}

export interface ReconnectAttemptResult {
  readonly outcome: GraphConnectionOutcome | 'idle';
  readonly edge: Edge;
  readonly identity: StoryIdentity | null;
}

export interface GraphConnectionController {
  beginConnect(params: OnConnectStartParams, identity: StoryIdentity): void;
  markConnectSucceeded(): void;
  markConnectFailed(): void;
  peekConnect(): ActiveConnectAttempt | null;
  finishConnect(): ConnectAttemptResult;
  cancelConnect(): void;
  beginReconnect(edge: Edge, identity: StoryIdentity): void;
  markReconnectSucceeded(): void;
  markReconnectFailed(): void;
  peekReconnect(): ActiveReconnectAttempt | null;
  finishReconnect(fallbackEdge: Edge): ReconnectAttemptResult;
  cancelReconnect(): void;
}

/**
 * Keeps the mutable lifecycle of one React Flow wire gesture out of the canvas component.
 * The controller deliberately has no UI policy: callers still decide how a blank drop is handled.
 */
export function createGraphConnectionController(): GraphConnectionController {
  let connectAttempt: ActiveConnectAttempt | null = null;
  let reconnectAttempt: ActiveReconnectAttempt | null = null;

  return {
    beginConnect(params, identity) {
      connectAttempt = { outcome: 'pending', startParams: params, identity };
    },
    markConnectSucceeded() {
      if (connectAttempt) connectAttempt = { ...connectAttempt, outcome: 'succeeded' };
    },
    markConnectFailed() {
      if (connectAttempt) connectAttempt = { ...connectAttempt, outcome: 'failed' };
    },
    peekConnect() {
      return connectAttempt;
    },
    finishConnect() {
      const result: ConnectAttemptResult = connectAttempt
        ? {
            outcome: connectAttempt.outcome,
            startParams: connectAttempt.startParams,
            identity: connectAttempt.identity,
          }
        : { outcome: 'idle', startParams: null, identity: null };
      connectAttempt = null;
      return result;
    },
    cancelConnect() {
      connectAttempt = null;
    },
    beginReconnect(edge, identity) {
      reconnectAttempt = { outcome: 'pending', edge, identity };
    },
    markReconnectSucceeded() {
      if (reconnectAttempt) reconnectAttempt = { ...reconnectAttempt, outcome: 'succeeded' };
    },
    markReconnectFailed() {
      if (reconnectAttempt) reconnectAttempt = { ...reconnectAttempt, outcome: 'failed' };
    },
    peekReconnect() {
      return reconnectAttempt;
    },
    finishReconnect(fallbackEdge) {
      const result: ReconnectAttemptResult = reconnectAttempt
        ? {
            outcome: reconnectAttempt.outcome,
            edge: reconnectAttempt.edge,
            identity: reconnectAttempt.identity,
          }
        : { outcome: 'idle', edge: fallbackEdge, identity: null };
      reconnectAttempt = null;
      return result;
    },
    cancelReconnect() {
      reconnectAttempt = null;
    },
  };
}

export function isGraphConnectionValid(
  connection: Edge | Connection,
  edges: readonly Edge[],
  hasStoryNode: (nodeId: string) => boolean,
): boolean {
  if (connection.source === connection.target) return false;

  const sourceHandle = connection.sourceHandle ?? '';
  const duplicate = edges.some(
    (edge) =>
      edge.source === connection.source &&
      edge.target === connection.target &&
      (edge.sourceHandle ?? '') === sourceHandle,
  );
  if (duplicate) return false;

  return hasStoryNode(connection.source) && hasStoryNode(connection.target);
}
