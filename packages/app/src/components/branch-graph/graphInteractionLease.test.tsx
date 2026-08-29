// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useGraphInteractionLease,
  type GraphInteractionLease,
} from './graphInteractionLease';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

function LeaseHarness({
  storySessionId,
  setEditing,
  publish,
}: {
  readonly storySessionId: number;
  readonly setEditing: (editing: boolean) => void;
  readonly publish: (lease: GraphInteractionLease) => void;
}): null {
  publish(useGraphInteractionLease({ storySessionId, setEditing }));
  return null;
}

describe('graph interaction lease', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it('holds the global lock until the last token is released', () => {
    const setEditing = vi.fn();
    let lease: GraphInteractionLease | null = null;
    act(() => {
      root.render(
        <LeaseHarness
          storySessionId={1}
          setEditing={setEditing}
          publish={(value) => {
            lease = value;
          }}
        />,
      );
    });

    let connectToken: ReturnType<GraphInteractionLease['acquire']> | null = null;
    let manualToken: ReturnType<GraphInteractionLease['acquire']> | null = null;
    act(() => {
      connectToken = lease?.acquire('connect') ?? null;
      manualToken = lease?.acquire('manual-wire') ?? null;
    });
    expect(setEditing).toHaveBeenCalledTimes(1);
    expect(setEditing).toHaveBeenLastCalledWith(true);

    act(() => {
      if (connectToken) lease?.release(connectToken);
    });
    expect(setEditing).toHaveBeenCalledTimes(1);
    act(() => {
      if (manualToken) lease?.release(manualToken);
    });
    expect(setEditing).toHaveBeenLastCalledWith(false);

    act(() => {
      if (manualToken) lease?.release(manualToken);
    });
    expect(setEditing).toHaveBeenCalledTimes(2);
  });

  it('releases active tokens on story replacement and unmount', () => {
    const setEditing = vi.fn();
    let lease: GraphInteractionLease | null = null;
    const render = (storySessionId: number): void => {
      root.render(
        <LeaseHarness
          storySessionId={storySessionId}
          setEditing={setEditing}
          publish={(value) => {
            lease = value;
          }}
        />,
      );
    };

    act(() => render(1));
    act(() => {
      lease?.acquire('node-drag');
    });
    act(() => render(2));
    expect(setEditing).toHaveBeenLastCalledWith(false);

    act(() => {
      lease?.acquire('reconnect');
    });
    act(() => root.unmount());
    expect(setEditing).toHaveBeenLastCalledWith(false);
    container.remove();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });
});
