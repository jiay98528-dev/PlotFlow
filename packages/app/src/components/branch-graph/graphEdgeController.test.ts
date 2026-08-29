// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createFullId, parseStory } from '@plotflow/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeEdgeId } from '../../stores/edgeStore';
import {
  findOfficialEdgeIdAtPoint,
  useGraphEdgeController,
} from './graphEdgeController';

const graphEditMocks = vi.hoisted(() => ({
  connectOption: vi.fn(),
  connectNextTarget: vi.fn(),
}));
vi.mock('../../services/graphEditService', () => ({ graphEditService: graphEditMocks }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('graph edge hit testing', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses the path screen transform so pan and zoom are included', () => {
    const matrixTransform = vi.fn(() => ({ x: 120, y: 80 }));
    const path = {
      dataset: { edgeId: 'edge-1' },
      getTotalLength: vi.fn(() => 100),
      getScreenCTM: vi.fn(() => ({ marker: 'path-transform' })),
      getPointAtLength: vi.fn(() => ({ matrixTransform })),
    } as unknown as SVGPathElement;
    vi.spyOn(document, 'querySelectorAll').mockReturnValue([
      path,
    ] as unknown as NodeListOf<SVGPathElement>);

    expect(findOfficialEdgeIdAtPoint(120, 80)).toBe('edge-1');
    expect(path.getScreenCTM).toHaveBeenCalled();
    expect(matrixTransform).toHaveBeenCalledWith({ marker: 'path-transform' });
    expect(findOfficialEdgeIdAtPoint(200, 200)).toBeNull();
  });

  it('disconnects at most once when document and canvas hit paths see the same click', () => {
    const parsed = parseStory(`---
plotflow: 0.1
---

# 第一章

## 节点：起点

[选项] 出发

## 节点：目标

到达。
`);
    if (!parsed.ok) throw new Error('fixture parse failed');
    const storyNodes = parsed.data.chapters.flatMap((chapter) => chapter.nodes);
    const sourceFullId = createFullId('第一章', '起点');
    const targetFullId = createFullId('第一章', '目标');
    const edgeId = encodeEdgeId(sourceFullId, targetFullId, 0);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    graphEditMocks.connectOption.mockReturnValue(true);

    function Harness(): ReturnType<typeof createElement> {
      const controller = useGraphEdgeController({
        canEditGraph: true,
        renamingNodeId: null,
        altPressedRef: { current: false },
        getNodeByFullId: (fullId) => storyNodes.find((node) => node.fullId === fullId),
        openConditionEditor: vi.fn(),
        setStatusMessage: vi.fn(),
        text: (key) => key,
      });
      return createElement(
        'div',
        { onClickCapture: controller.handleEdgeHitAreaClickCapture },
        createElement(
          'svg',
          null,
          createElement('path', {
            className: 'official-graph-edge__hit-area',
            'data-edge-id': edgeId,
          }),
        ),
      );
    }

    act(() => root.render(createElement(Harness)));
    const path = container.querySelector<SVGPathElement>('path')!;
    Object.assign(path, {
      getTotalLength: vi.fn(() => 100),
      getScreenCTM: vi.fn(() => ({ marker: 'screen-transform' })),
      getPointAtLength: vi.fn(() => ({
        matrixTransform: vi.fn(() => ({ x: 40, y: 50 })),
      })),
    });
    act(() => {
      path.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          altKey: true,
          clientX: 40,
          clientY: 50,
        }),
      );
    });

    expect(graphEditMocks.connectOption).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    container.remove();
  });
});
