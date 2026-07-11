import { describe, expect, it, vi } from 'vitest';
import { createBufferedResultListener } from './systemOpenBuffer';

describe('createBufferedResultListener', () => {
  it('drains results received before the renderer subscribes in order', () => {
    const listener = createBufferedResultListener<number>();
    listener.push(1);
    listener.push(2);
    const callback = vi.fn();
    listener.register(callback);
    expect(callback.mock.calls).toEqual([[1], [2]]);
  });

  it('buffers again after the active subscriber is removed', () => {
    const listener = createBufferedResultListener<number>();
    const first = vi.fn();
    const cleanup = listener.register(first);
    cleanup();
    listener.push(3);
    const second = vi.fn();
    listener.register(second);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(3);
  });
});
