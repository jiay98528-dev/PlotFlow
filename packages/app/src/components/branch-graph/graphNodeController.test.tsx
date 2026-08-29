// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { parseStory, type StoryNode } from '@plotflow/core';
import type { Node, NodeChange } from '@xyflow/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import type { GraphInteractionLease } from './graphInteractionLease';
import { useGraphNodeController } from './graphNodeController';

const graphEditMocks = vi.hoisted(() => ({ updateNodePositions: vi.fn() }));
vi.mock('../../services/graphEditService', () => ({ graphEditService: graphEditMocks }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const STORY = `---
plotflow: 0.1
---

# Chapter

## 节点：Start

Start.

## 节点：Target

Target.
`;

type NodeController = ReturnType<typeof useGraphNodeController>;

function NodeHarness({
  nodes,
  storyNodes,
  lease,
  publish,
}: {
  readonly nodes: Node[];
  readonly storyNodes: ReadonlyMap<string, StoryNode>;
  readonly lease: GraphInteractionLease;
  readonly publish: (controller: NodeController) => void;
}): null {
  publish(
    useGraphNodeController({
      canEditGraph: true,
      nodes,
      selectedNodeId: null,
      renamingNodeId: null,
      editorInstance: null,
      getNodeByFullId: (fullId) => storyNodes.get(fullId),
      selectNode: vi.fn(),
      setRenamingNodeId: vi.fn(),
      setStatusMessage: vi.fn(),
      text: (key) => key,
      interactionLease: lease,
      suppressAutoFitRef: { current: false },
      suppressAutoFitForUserViewportChange: vi.fn(),
      consumeSuppressedPaneClick: () => false,
      closeWireDrop: vi.fn(),
    }),
  );
  return null;
}

describe('graph node controller', () => {
  let container: HTMLDivElement;
  let root: Root;
  let controller: NodeController | null;
  let nodes: Node[];
  let storyNodes: ReadonlyMap<string, StoryNode>;
  let lease: GraphInteractionLease;

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().reset();
    useEditorStore.getState().setContent(STORY);
    const parsed = parseStory(STORY);
    if (!parsed.ok) throw new Error('fixture parse failed');
    const parsedNodes = parsed.data.chapters.flatMap((chapter) => chapter.nodes);
    storyNodes = new Map(parsedNodes.map((node) => [node.fullId, node]));
    nodes = parsedNodes.map((node, index) => ({
      id: node.fullId,
      position: { x: index * 100, y: 0 },
      data: { fullId: node.fullId, lineNumber: node.lineNumber },
      type: 'storyNode',
    }));
    useGraphStore.setState({ nodes });
    lease = {
      acquire: vi.fn((kind) => ({ id: 1, kind })),
      release: vi.fn(),
      releaseAll: vi.fn(),
      isActive: vi.fn(() => false),
    };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    controller = null;
    act(() => {
      root.render(
        <NodeHarness
          nodes={nodes}
          storyNodes={storyNodes}
          lease={lease}
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
  });

  it('applies consecutive node changes to the latest store state', () => {
    act(() => {
      controller?.handleNodesChange([
        { type: 'position', id: nodes[0]!.id, position: { x: 25, y: 35 } } as NodeChange,
      ]);
      controller?.handleNodesChange([
        { type: 'position', id: nodes[1]!.id, position: { x: 225, y: 45 } } as NodeChange,
      ]);
    });
    const current = useGraphStore.getState().nodes;
    expect(current[0]?.position).toEqual({ x: 25, y: 35 });
    expect(current[1]?.position).toEqual({ x: 225, y: 45 });
  });

  it('rolls a transient node position back when source commit fails', () => {
    graphEditMocks.updateNodePositions.mockReturnValue(false);
    const original = nodes[0]!;
    const moved = { ...original, position: { x: 180, y: 140 } };
    act(() => {
      controller?.handleNodeDragStart(new MouseEvent('mousedown'), original);
      useGraphStore.setState({
        nodes: useGraphStore
          .getState()
          .nodes.map((node) => (node.id === original.id ? moved : node)),
      });
      controller?.handleNodeDragStop(new MouseEvent('mouseup'), moved);
    });
    expect(graphEditMocks.updateNodePositions).toHaveBeenCalledTimes(1);
    expect(useGraphStore.getState().nodes[0]?.position).toEqual(original.position);
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'node-drag' }));
  });

  it('rolls a transient node position back when the source commit throws', () => {
    graphEditMocks.updateNodePositions.mockImplementationOnce(() => {
      throw new Error('commit failed');
    });
    const original = nodes[0]!;
    const moved = { ...original, position: { x: 210, y: 165 } };
    act(() => {
      controller?.handleNodeDragStart(new MouseEvent('mousedown'), original);
      useGraphStore.setState({
        nodes: useGraphStore
          .getState()
          .nodes.map((node) => (node.id === original.id ? moved : node)),
      });
      controller?.handleNodeDragStop(new MouseEvent('mouseup'), moved);
    });
    expect(useGraphStore.getState().nodes[0]?.position).toEqual(original.position);
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'node-drag' }));
  });

  it('does not commit an in-flight drag after the story revision changes', () => {
    act(() => controller?.handleNodeDragStart(new MouseEvent('mousedown'), nodes[0]!));
    act(() => useEditorStore.getState().setContent(`${STORY}\nchanged`));
    expect(graphEditMocks.updateNodePositions).not.toHaveBeenCalled();
    expect(lease.release).toHaveBeenCalledWith(expect.objectContaining({ kind: 'node-drag' }));
  });
});
