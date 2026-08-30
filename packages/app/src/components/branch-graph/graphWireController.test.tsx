// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createFullId, parseStory, type StoryNode } from '@plotflow/core';
import type { Connection, Edge, Node, OnConnectStartParams } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../../stores/editorStore';
import { encodeEdgeId } from '../../stores/edgeStore';
import type { GraphInteractionLease } from './graphInteractionLease';
import { useGraphWireController, type GraphWireController } from './graphWireController';

const graphEditMocks = vi.hoisted(() => ({
  connectOption: vi.fn(),
  connectNextTarget: vi.fn(),
  createNodeAndConnect: vi.fn(),
  createNodeAndConnectNext: vi.fn(),
}));

vi.mock('../../services/graphEditService', () => ({ graphEditService: graphEditMocks }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const STORY = `---
plotflow: 0.1
---

# 第一章

## 节点：起点

[选项] 出发

## 节点：目标

到达。
`;

function WireHarness({
  storyNodes,
  flowNodes,
  lease,
  setEdges,
  setStatusMessage,
  publish,
}: {
  readonly storyNodes: ReadonlyMap<string, StoryNode>;
  readonly flowNodes: Node[];
  readonly lease: GraphInteractionLease;
  readonly setEdges: ReturnType<typeof vi.fn>;
  readonly setStatusMessage: ReturnType<typeof vi.fn>;
  readonly publish: (controller: GraphWireController) => void;
}): null {
  publish(
    useGraphWireController({
      canEditGraph: true,
      renamingNodeId: null,
      nodes: flowNodes,
      edges: [],
      getNodeByFullId: (fullId) => storyNodes.get(fullId),
      setEdges,
      setStatusMessage,
      text: (key) => key,
      screenToFlowPositionRef: { current: null },
      interactionLease: lease,
      suppressNextPaneClick: vi.fn(),
    }),
  );
  return null;
}

describe('graph wire controller', () => {
  let container: HTMLDivElement;
  let root: Root;
  let controller: GraphWireController | null;
  let lease: GraphInteractionLease;
  let storyNodes: ReadonlyMap<string, StoryNode>;
  let flowNodes: Node[];
  let setEdges: ReturnType<typeof vi.fn>;
  let setStatusMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().reset();
    useEditorStore.getState().setContent(STORY);
    const parsed = parseStory(STORY);
    if (!parsed.ok) throw new Error('fixture parse failed');
    const nodes = parsed.data.chapters.flatMap((chapter) => chapter.nodes);
    storyNodes = new Map(nodes.map((node) => [node.fullId, node]));
    flowNodes = nodes.map((node) => ({
      id: node.fullId,
      position: { x: 0, y: 0 },
      data: { fullId: node.fullId },
    }));
    lease = {
      acquire: vi.fn((kind) => ({ id: 1, kind })),
      release: vi.fn(),
      releaseAll: vi.fn(),
      isActive: vi.fn(() => false),
    };
    setEdges = vi.fn();
    setStatusMessage = vi.fn();
    controller = null;
    container = document.createElement('div');
    document.body.append(container);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => null),
    });
    root = createRoot(container);
    act(() => {
      root.render(
        <WireHarness
          storyNodes={storyNodes}
          flowNodes={flowNodes}
          lease={lease}
          setEdges={setEdges}
          setStatusMessage={setStatusMessage}
          publish={(value) => {
            controller = value;
          }}
        />,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  function beginConnect(): void {
    const start = createFullId('第一章', '起点');
    const params = {
      nodeId: start,
      handleId: 'option-0',
      handleType: 'source',
    } as OnConnectStartParams;
    controller?.handleConnectStart(
      new MouseEvent('mousedown', { clientX: 10, clientY: 20 }),
      params,
    );
  }

  function connection(): Connection {
    return {
      source: createFullId('第一章', '起点'),
      target: createFullId('第一章', '目标'),
      sourceHandle: 'option-0',
      targetHandle: null,
    };
  }

  it('marks a connection successful only after the source command commits', () => {
    graphEditMocks.connectOption.mockReturnValue(false);
    act(() => beginConnect());
    act(() => controller?.handleConnect(connection()));
    act(() =>
      controller?.handleConnectEnd(new MouseEvent('mouseup', { clientX: 40, clientY: 50 })),
    );
    expect(graphEditMocks.connectOption).toHaveBeenCalledTimes(1);
    expect(setEdges).not.toHaveBeenCalled();
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.changeNotApplied');
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'connect' }));

    vi.clearAllMocks();
    graphEditMocks.connectOption.mockReturnValue(true);
    act(() => beginConnect());
    act(() => controller?.handleConnect(connection()));
    act(() =>
      controller?.handleConnectEnd(new MouseEvent('mouseup', { clientX: 40, clientY: 50 })),
    );
    expect(graphEditMocks.connectOption).toHaveBeenCalledTimes(1);
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.connected');
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'connect' }));

    vi.clearAllMocks();
    graphEditMocks.connectOption.mockImplementationOnce(() => {
      throw new Error('commit failed');
    });
    act(() => beginConnect());
    act(() => controller?.handleConnect(connection()));
    act(() =>
      controller?.handleConnectEnd(new MouseEvent('mouseup', { clientX: 40, clientY: 50 })),
    );
    expect(setEdges).not.toHaveBeenCalled();
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.changeNotApplied');
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'connect' }));
  });

  it('cancels a pending wire when the canonical source revision changes', () => {
    act(() => beginConnect());
    act(() => useEditorStore.getState().setContent(`${STORY}\nchanged`));
    expect(graphEditMocks.connectOption).not.toHaveBeenCalled();
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'connect' }));
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.interactionStale');
  });

  it('cancels a native blank drop outside the graph surface', () => {
    act(() => beginConnect());
    act(() =>
      controller?.handleConnectEnd(new MouseEvent('mouseup', { clientX: 500, clientY: 500 })),
    );
    expect(controller?.wireDropContext).toBeNull();
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.cancelledWireDrag');
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'connect' }));
  });

  it('commits reconnects once and never publishes an optimistic edge after failure', () => {
    const oldEdge = {
      id: encodeEdgeId(
        createFullId('第一章', '起点'),
        createFullId('第一章', '目标'),
        0,
      ),
      source: createFullId('第一章', '起点'),
      target: createFullId('第一章', '目标'),
      sourceHandle: 'option-0',
    } as Edge;

    graphEditMocks.connectOption.mockReturnValue(false);
    act(() => controller?.handleReconnectStart({}, oldEdge, 'target'));
    act(() => controller?.handleReconnect(oldEdge, connection()));
    act(() => controller?.handleReconnectEnd({}, oldEdge, 'target'));
    expect(graphEditMocks.connectOption).toHaveBeenCalledTimes(1);
    expect(setEdges).not.toHaveBeenCalled();
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.changeNotApplied');
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'reconnect' }));

    vi.clearAllMocks();
    graphEditMocks.connectOption.mockReturnValue(true);
    act(() => controller?.handleReconnectStart({}, oldEdge, 'target'));
    act(() => controller?.handleReconnect(oldEdge, connection()));
    act(() => controller?.handleReconnectEnd({}, oldEdge, 'target'));
    expect(graphEditMocks.connectOption).toHaveBeenCalledTimes(1);
    expect(setEdges).toHaveBeenCalledTimes(1);
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.reconnected');
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'reconnect' }));
  });

  it('closes an open wire menu and cancels a reconnect when story identity changes', () => {
    const flowSurface = document.createElement('div');
    flowSurface.className = 'react-flow';
    vi.mocked(document.elementFromPoint).mockReturnValue(flowSurface);
    act(() => beginConnect());
    act(() =>
      controller?.handleConnectEnd(new MouseEvent('mouseup', { clientX: 80, clientY: 90 })),
    );
    expect(controller?.wireDropContext).not.toBeNull();

    const oldEdge = {
      id: encodeEdgeId(
        createFullId('第一章', '起点'),
        createFullId('第一章', '目标'),
        0,
      ),
      source: createFullId('第一章', '起点'),
      target: createFullId('第一章', '目标'),
    } as Edge;
    act(() => controller?.handleReconnectStart({}, oldEdge, 'target'));
    setStatusMessage.mockClear();
    act(() => useEditorStore.getState().setContent(`${STORY}\nreplacement`));

    expect(controller?.wireDropContext).toBeNull();
    expect(graphEditMocks.connectOption).not.toHaveBeenCalled();
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'reconnect' }));
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.interactionStale');
  });

  it('restores the originating handle focus when a blank-drop menu closes with Escape', () => {
    const flowSurface = document.createElement('div');
    flowSurface.className = 'react-flow';
    const trigger = document.createElement('div');
    trigger.className = 'story-node-connect-handle';
    trigger.tabIndex = -1;
    flowSurface.append(trigger);
    document.body.append(flowSurface);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => flowSurface),
    });
    const params = {
      nodeId: createFullId('第一章', '起点'),
      handleId: 'option-0',
      handleType: 'source',
    } as OnConnectStartParams;
    trigger.addEventListener('mousedown', (event) => {
      controller?.handleConnectStart(event, params);
    });
    act(() => {
      trigger.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX: 10, clientY: 20 }),
      );
      controller?.handleConnectEnd(new MouseEvent('mouseup', { clientX: 80, clientY: 90 }));
    });
    expect(controller?.wireDropContext).not.toBeNull();
    act(() => controller?.closeWireDrop(true));
    expect(document.activeElement).toBe(trigger);
  });

  it('cleans a cancelled manual wire and commits a valid manual drop once', () => {
    const flowSurface = document.createElement('div');
    flowSurface.className = 'react-flow';
    Object.assign(flowSurface, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });
    const sourceHandle = document.createElement('button');
    sourceHandle.className = 'story-node-connect-handle';
    sourceHandle.dataset['sourceFullId'] = createFullId('第一章', '起点');
    sourceHandle.dataset['optionIndex'] = '0';
    flowSurface.append(sourceHandle);
    const targetElement = document.createElement('div');
    targetElement.className = 'react-flow__node';
    targetElement.dataset['id'] = createFullId('第一章', '目标');
    flowSurface.append(targetElement);
    document.body.append(flowSurface);

    const pointerEvent = (
      type: 'down' | 'up' | 'cancel',
      x: number,
      y: number,
    ): React.PointerEvent<HTMLDivElement> =>
      ({
        target: sourceHandle,
        currentTarget: flowSurface,
        pointerId: 7,
        button: 0,
        isPrimary: true,
        clientX: x,
        clientY: y,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        type,
      }) as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => controller?.handleManualWirePointerDown(pointerEvent('down', 10, 20)));
    expect(controller?.liveWirePreview).not.toBeNull();
    act(() => controller?.handleManualWirePointerCancel(pointerEvent('cancel', 10, 20)));
    expect(controller?.liveWirePreview).toBeNull();
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'manual-wire' }));

    vi.clearAllMocks();
    graphEditMocks.connectOption.mockReturnValue(true);
    vi.mocked(document.elementFromPoint).mockReturnValue(targetElement);
    act(() => controller?.handleManualWirePointerDown(pointerEvent('down', 10, 20)));
    act(() => controller?.handleManualWirePointerUp(pointerEvent('up', 100, 120)));
    expect(graphEditMocks.connectOption).toHaveBeenCalledTimes(1);
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.connected');
    expect(controller?.wireDropContext).toBeNull();
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'manual-wire' }));
  });

  it('preserves the drag threshold and distinguishes blank from outside drops', () => {
    const flowSurface = document.createElement('div');
    flowSurface.className = 'react-flow';
    Object.assign(flowSurface, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });
    const sourceHandle = document.createElement('button');
    sourceHandle.className = 'story-node-connect-handle';
    sourceHandle.dataset['sourceFullId'] = createFullId('第一章', '起点');
    sourceHandle.dataset['optionIndex'] = '0';
    flowSurface.append(sourceHandle);
    document.body.append(flowSurface);

    const pointerEvent = (
      type: 'down' | 'up',
      x: number,
      y: number,
    ): React.PointerEvent<HTMLDivElement> =>
      ({
        target: sourceHandle,
        currentTarget: flowSurface,
        pointerId: 9,
        button: 0,
        isPrimary: true,
        clientX: x,
        clientY: y,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        type,
      }) as unknown as React.PointerEvent<HTMLDivElement>;

    vi.mocked(document.elementFromPoint).mockReturnValue(flowSurface);
    act(() => controller?.handleManualWirePointerDown(pointerEvent('down', 10, 20)));
    act(() => controller?.handleManualWirePointerUp(pointerEvent('up', 12, 22)));
    expect(graphEditMocks.connectOption).not.toHaveBeenCalled();
    expect(controller?.wireDropContext).toBeNull();

    act(() => controller?.handleManualWirePointerDown(pointerEvent('down', 10, 20)));
    act(() => controller?.handleManualWirePointerUp(pointerEvent('up', 80, 90)));
    expect(controller?.wireDropContext).not.toBeNull();
    act(() => controller?.closeWireDrop(false));

    vi.mocked(document.elementFromPoint).mockReturnValue(null);
    setStatusMessage.mockClear();
    act(() => controller?.handleManualWirePointerDown(pointerEvent('down', 10, 20)));
    act(() => controller?.handleManualWirePointerUp(pointerEvent('up', 80, 90)));
    expect(controller?.wireDropContext).toBeNull();
    expect(setStatusMessage).toHaveBeenCalledWith('graphCanvas.cancelledWireDrag');
  });

  it('binds a manual wire to one primary pointer for its full lifecycle', () => {
    const flowSurface = document.createElement('div');
    flowSurface.className = 'react-flow';
    Object.assign(flowSurface, {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
    });
    const sourceHandle = document.createElement('button');
    sourceHandle.className = 'story-node-connect-handle';
    sourceHandle.dataset['sourceFullId'] = createFullId('第一章', '起点');
    sourceHandle.dataset['optionIndex'] = '0';
    flowSurface.append(sourceHandle);
    document.body.append(flowSurface);

    const pointerEvent = (
      pointerId: number,
      options: { button?: number; isPrimary?: boolean; x?: number; y?: number } = {},
    ): React.PointerEvent<HTMLDivElement> =>
      ({
        target: sourceHandle,
        currentTarget: flowSurface,
        pointerId,
        button: options.button ?? 0,
        isPrimary: options.isPrimary ?? true,
        clientX: options.x ?? 10,
        clientY: options.y ?? 20,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      }) as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => controller?.handleManualWirePointerDown(pointerEvent(1, { button: 2 })));
    act(() => controller?.handleManualWirePointerDown(pointerEvent(1, { isPrimary: false })));
    expect(controller?.liveWirePreview).toBeNull();
    expect(lease.acquire).not.toHaveBeenCalled();

    act(() => controller?.handleManualWirePointerDown(pointerEvent(7)));
    act(() => controller?.handleManualWirePointerDown(pointerEvent(9)));
    act(() => controller?.handleManualWirePointerUp(pointerEvent(9, { x: 100, y: 120 })));
    expect(controller?.liveWirePreview).not.toBeNull();
    expect(graphEditMocks.connectOption).not.toHaveBeenCalled();
    expect(lease.acquire).toHaveBeenCalledTimes(1);

    act(() => controller?.handleManualWirePointerCancel(pointerEvent(7)));
    expect(controller?.liveWirePreview).toBeNull();
    expect(lease.release).toHaveBeenCalledTimes(1);
  });
});
