import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from './uiStore';

describe('GraphFocusRequest requestId', () => {
  beforeEach(() => useUIStore.setState({ graphFocusRequest: null }));

  it('remains strictly monotonic after requests are consumed', () => {
    useUIStore.getState().requestGraphFocus('chapter/one');
    const first = useUIStore.getState().graphFocusRequest!;
    useUIStore.getState().consumeGraphFocus(first.requestId);
    useUIStore.getState().requestGraphFocus('chapter/two');
    const second = useUIStore.getState().graphFocusRequest!;
    expect(second.requestId).toBeGreaterThan(first.requestId);
  });
});
