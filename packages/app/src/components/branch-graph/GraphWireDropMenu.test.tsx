// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createFullId, parseStory } from '@plotflow/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStoryStore } from '../../stores/storyStore';
import { GraphWireDropMenu, type GraphWireDropAction } from './GraphWireDropMenu';
import type { WireDropContext } from './graphWireModel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const STORY = `---
plotflow: 0.1
---

# 第一章

## 节点：起点

[选项] 出发

## 节点：树林

树林。

## 节点：河边

河边。
`;

function key(target: Element, value: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }),
  );
}

describe('GraphWireDropMenu', () => {
  let container: HTMLDivElement;
  let root: Root;
  let trigger: HTMLButtonElement;
  let context: WireDropContext;
  let onAction: ReturnType<typeof vi.fn<(action: GraphWireDropAction) => void>>;
  let onClose: ReturnType<typeof vi.fn<(restoreFocus: boolean) => void>>;

  beforeEach(() => {
    const parsed = parseStory(STORY);
    if (!parsed.ok) throw new Error('fixture parse failed');
    useStoryStore.getState().setPlotFlowData(parsed.data);
    container = document.createElement('div');
    trigger = document.createElement('button');
    document.body.append(trigger, container);
    root = createRoot(container);
    context = {
      mode: 'connect',
      position: { x: 100, y: 120 },
      flowPosition: { x: 10, y: 20 },
      route: { sourceFullId: createFullId('第一章', '起点'), optionIndex: 0 },
      identity: { storySessionId: 1, contentRevision: 1, sourceDraftRevision: 1 },
      trigger,
    };
    onAction = vi.fn();
    onClose = vi.fn();
    act(() => {
      root.render(
        <GraphWireDropMenu context={context} onAction={onAction} onClose={onClose} />,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    useStoryStore.getState().clearParseData();
    document.body.replaceChildren();
  });

  it('supports listbox navigation and activates the selected candidate', () => {
    const input = container.querySelector<HTMLInputElement>('[data-testid="wire-drop-search"]')!;
    const options = container.querySelectorAll<HTMLElement>('[role="option"]');
    expect(document.activeElement).toBe(input);
    expect(options).toHaveLength(2);
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]!.id);

    act(() => key(input, 'End'));
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]!.id);
    act(() => key(input, 'Enter'));
    expect(onAction).toHaveBeenLastCalledWith({
      type: 'connect',
      targetFullId: createFullId('第一章', '河边'),
      targetTitle: '河边',
    });

    act(() => key(input, 'Home'));
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]!.id);
    act(() => key(input, 'ArrowDown'));
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]!.id);
    act(() => key(input, 'ArrowUp'));
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]!.id);
  });

  it('requests focus restoration on Escape and lets outside pointer actions continue', () => {
    const input = container.querySelector<HTMLInputElement>('[data-testid="wire-drop-search"]')!;
    act(() => key(input, 'Escape'));
    expect(onClose).toHaveBeenLastCalledWith(true);

    onClose.mockClear();
    const outside = document.createElement('button');
    document.body.append(outside);
    act(() => {
      outside.dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 2 }),
      );
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
    });
    expect(onClose).toHaveBeenLastCalledWith(false);
  });

  it('keeps keyboard navigation inert when the search has no candidates', () => {
    const input = container.querySelector<HTMLInputElement>('[data-testid="wire-drop-search"]')!;
    const valueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;
    act(() => {
      valueSetter?.call(input, 'not-a-story-node');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(input.getAttribute('aria-activedescendant')).toBeNull();

    act(() => {
      key(input, 'ArrowDown');
      key(input, 'ArrowUp');
      key(input, 'Home');
      key(input, 'End');
      key(input, 'Enter');
    });
    expect(input.getAttribute('aria-activedescendant')).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });
});
