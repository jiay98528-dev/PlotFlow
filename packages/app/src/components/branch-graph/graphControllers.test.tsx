// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type React from 'react';
import type { Edge, Node } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../../stores/editorStore';
import type { StoryFlowNodeData } from './adapter';

const layoutMocks = vi.hoisted(() => ({ layoutNodesInWorker: vi.fn() }));
vi.mock('./graphLayoutClient', () => layoutMocks);

import { useGraphGestureController, type GraphGestureController } from './graphGestureController';
import { useGraphLayoutController } from './graphLayoutController';
import { useGraphMenuController } from './graphMenuController';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const STORY_DATA: StoryFlowNodeData = {
  fullId: '第一章-开始',
  title: '开始',
  chapterId: '第一章',
  body: '',
  optionCount: 0,
  status: 'root',
  lineNumber: 1,
};

function GestureHarness({
  publish,
}: {
  readonly publish: (controller: GraphGestureController) => void;
}): null {
  publish(useGraphGestureController(800));
  return null;
}

type MenuController = ReturnType<typeof useGraphMenuController>;

function MenuHarness({
  publish,
}: {
  readonly publish: (controller: MenuController) => void;
}): null {
  publish(useGraphMenuController({ canEditGraph: true, renamingNodeId: null }));
  return null;
}

function LayoutHarness({
  nodes,
  edges,
  setNodes,
}: {
  readonly nodes: Node<StoryFlowNodeData>[];
  readonly edges: Edge[];
  readonly setNodes: (nodes: Node[]) => void;
}): null {
  useGraphLayoutController({
    nodes,
    edges,
    setNodes,
    setStatusMessage: vi.fn(),
    text: (key) => key,
  });
  return null;
}

describe('Graph controllers', () => {
  let container: HTMLDivElement;
  let root: Root;
  let mounted: boolean;

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().reset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    mounted = false;
  });

  afterEach(() => {
    if (mounted) act(() => root.unmount());
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('cleans gesture timers and consumes pane-click suppression once', () => {
    vi.useFakeTimers();
    const controllerRef: { current: GraphGestureController | null } = { current: null };
    act(() => {
      root.render(<GestureHarness publish={(value) => (controllerRef.current = value)} />);
    });
    mounted = true;

    act(() => controllerRef.current?.suppressAutoFitForUserViewportChange());
    expect(controllerRef.current?.suppressAutoFitRef.current).toBe(true);
    act(() => controllerRef.current?.suppressNextPaneClick());
    expect(controllerRef.current?.consumeSuppressedPaneClick()).toBe(true);
    expect(controllerRef.current?.consumeSuppressedPaneClick()).toBe(false);
    expect(vi.getTimerCount()).toBe(1);

    act(() => root.unmount());
    mounted = false;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('restores focus to the node that opened a graph menu', () => {
    const controllerRef: { current: MenuController | null } = { current: null };
    act(() => {
      root.render(<MenuHarness publish={(value) => (controllerRef.current = value)} />);
    });
    mounted = true;

    const trigger = document.createElement('div');
    trigger.className = 'react-flow__node';
    trigger.tabIndex = 0;
    const child = document.createElement('button');
    trigger.append(child);
    document.body.append(trigger);
    const event = {
      preventDefault: vi.fn(),
      target: child,
      clientX: 24,
      clientY: 32,
    } as unknown as React.MouseEvent;
    const node: Node<StoryFlowNodeData> = {
      id: 'node-1',
      position: { x: 0, y: 0 },
      data: STORY_DATA,
      type: 'storyNode',
    };

    act(() => controllerRef.current?.handleNodeContextMenu(event, node));
    expect(controllerRef.current?.contextMenu.isOpen).toBe(true);
    act(() => controllerRef.current?.handleContextMenuClose(true));

    expect(controllerRef.current?.contextMenu.isOpen).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('drops layout results after story replacement', async () => {
    let resolveLayout:
      | ((result: {
          nodes: Node<StoryFlowNodeData>[];
          edges: Edge[];
          elapsedMs: number;
          stale: boolean;
          layoutMode: 'dagre';
        }) => void)
      | undefined;
    layoutMocks.layoutNodesInWorker.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLayout = resolve;
        }),
    );
    const nodes: Node<StoryFlowNodeData>[] = [
      { id: 'node-1', position: { x: 0, y: 0 }, data: STORY_DATA, type: 'storyNode' },
    ];
    const setNodes = vi.fn();

    act(() => {
      root.render(<LayoutHarness nodes={nodes} edges={[]} setNodes={setNodes} />);
    });
    mounted = true;
    act(() => useEditorStore.getState().setContent('replacement story'));
    await act(async () => {
      resolveLayout?.({
        nodes: [{ ...nodes[0]!, position: { x: 100, y: 200 } }],
        edges: [],
        elapsedMs: 10,
        stale: false,
        layoutMode: 'dagre',
      });
      await Promise.resolve();
    });
    expect(setNodes).not.toHaveBeenCalled();

    act(() => root.unmount());
    mounted = false;
  });

  it('coalesces multiple source revisions into one latest layout retry', async () => {
    type LayoutResult = {
      nodes: Node<StoryFlowNodeData>[];
      edges: Edge[];
      elapsedMs: number;
      stale: boolean;
      layoutMode: 'dagre';
    };
    const resolvers: Array<(result: LayoutResult) => void> = [];
    layoutMocks.layoutNodesInWorker.mockImplementation(
      () =>
        new Promise<LayoutResult>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const nodes: Node<StoryFlowNodeData>[] = [
      { id: 'node-1', position: { x: 0, y: 0 }, data: STORY_DATA, type: 'storyNode' },
    ];
    const setNodes = vi.fn();

    act(() => {
      root.render(<LayoutHarness nodes={nodes} edges={[]} setNodes={setNodes} />);
    });
    mounted = true;
    act(() => {
      useEditorStore.getState().setContent('revision-b');
      useEditorStore.getState().setContent('revision-c');
    });
    expect(layoutMocks.layoutNodesInWorker).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvers[0]?.({
        nodes: [{ ...nodes[0]!, position: { x: 100, y: 200 } }],
        edges: [],
        elapsedMs: 10,
        stale: false,
        layoutMode: 'dagre',
      });
      await Promise.resolve();
    });
    expect(setNodes).not.toHaveBeenCalled();
    expect(layoutMocks.layoutNodesInWorker).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvers[1]?.({
        nodes: [{ ...nodes[0]!, position: { x: 300, y: 400 } }],
        edges: [],
        elapsedMs: 10,
        stale: false,
        layoutMode: 'dagre',
      });
      await Promise.resolve();
    });
    expect(setNodes).toHaveBeenCalledTimes(1);
    expect(setNodes.mock.calls[0]?.[0]?.[0]?.position).toEqual({ x: 300, y: 400 });
  });

  it('does not publish a layout result after controller unmount', async () => {
    let resolveLayout:
      | ((result: {
          nodes: Node<StoryFlowNodeData>[];
          edges: Edge[];
          elapsedMs: number;
          stale: boolean;
          layoutMode: 'dagre';
        }) => void)
      | undefined;
    layoutMocks.layoutNodesInWorker.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLayout = resolve;
        }),
    );
    const nodes: Node<StoryFlowNodeData>[] = [
      { id: 'node-1', position: { x: 0, y: 0 }, data: STORY_DATA, type: 'storyNode' },
    ];
    const setNodes = vi.fn();

    act(() => {
      root.render(<LayoutHarness nodes={nodes} edges={[]} setNodes={setNodes} />);
    });
    mounted = true;
    act(() => root.unmount());
    mounted = false;
    await act(async () => {
      resolveLayout?.({
        nodes: [{ ...nodes[0]!, position: { x: 100, y: 200 } }],
        edges: [],
        elapsedMs: 10,
        stale: false,
        layoutMode: 'dagre',
      });
      await Promise.resolve();
    });

    expect(setNodes).not.toHaveBeenCalled();
  });
});
