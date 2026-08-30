import { describe, expect, it } from 'vitest';
import type { Connection, Edge, OnConnectStartParams } from '@xyflow/react';
import {
  createGraphConnectionController,
  isGraphConnectionValid,
} from './graphConnectionController';
import type { StoryIdentity } from '../../services/storySnapshot';

const IDENTITY: StoryIdentity = {
  storySessionId: 1,
  contentRevision: 2,
  sourceDraftRevision: 3,
};

describe('graph connection controller', () => {
  it('consumes connect and reconnect attempt state exactly once', () => {
    const controller = createGraphConnectionController();
    const start = {
      nodeId: 'chapter::start',
      handleId: 'option-0',
      handleType: 'source',
    } as OnConnectStartParams;
    const edge = { id: 'edge-1', source: 'start', target: 'old-target' } as Edge;

    controller.beginConnect(start, IDENTITY);
    controller.markConnectSucceeded();
    expect(controller.finishConnect()).toEqual({
      outcome: 'succeeded',
      startParams: start,
      identity: IDENTITY,
    });
    expect(controller.finishConnect()).toEqual({
      outcome: 'idle',
      startParams: null,
      identity: null,
    });

    controller.beginReconnect(edge, IDENTITY);
    controller.markReconnectSucceeded();
    expect(controller.finishReconnect(edge)).toEqual({
      outcome: 'succeeded',
      edge,
      identity: IDENTITY,
    });
    expect(controller.finishReconnect(edge)).toEqual({
      outcome: 'idle',
      edge,
      identity: null,
    });
  });

  it('tracks failed attempts without treating them as blank drops', () => {
    const controller = createGraphConnectionController();
    const start = {
      nodeId: 'chapter::start',
      handleId: 'option-0',
      handleType: 'source',
    } as OnConnectStartParams;
    const edge = { id: 'edge-1', source: 'start', target: 'old-target' } as Edge;

    controller.beginConnect(start, IDENTITY);
    controller.markConnectFailed();
    expect(controller.finishConnect().outcome).toBe('failed');

    controller.beginReconnect(edge, IDENTITY);
    controller.markReconnectFailed();
    expect(controller.finishReconnect(edge).outcome).toBe('failed');
  });

  it('rejects self, duplicate, and missing-node connections', () => {
    const existing = {
      id: 'edge-1',
      source: 'start',
      target: 'target',
      sourceHandle: 'option-0',
    } as Edge;
    const knownNodes = new Set(['start', 'target', 'other']);
    const hasStoryNode = (nodeId: string): boolean => knownNodes.has(nodeId);
    const connection = (source: string, target: string, sourceHandle = 'option-0'): Connection => ({
      source,
      target,
      sourceHandle,
      targetHandle: null,
    });

    expect(isGraphConnectionValid(connection('start', 'start'), [existing], hasStoryNode)).toBe(
      false,
    );
    expect(isGraphConnectionValid(connection('start', 'target'), [existing], hasStoryNode)).toBe(
      false,
    );
    expect(isGraphConnectionValid(connection('missing', 'target'), [], hasStoryNode)).toBe(false);
    expect(isGraphConnectionValid(connection('start', 'other'), [existing], hasStoryNode)).toBe(
      true,
    );
  });
});
