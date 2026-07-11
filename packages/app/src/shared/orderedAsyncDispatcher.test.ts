import { describe, expect, it } from 'vitest';
import { createOrderedAsyncDispatcher } from './orderedAsyncDispatcher';

describe('createOrderedAsyncDispatcher', () => {
  it('preserves input order when earlier work resolves later', async () => {
    const observed: number[] = [];
    const dispatcher = createOrderedAsyncDispatcher<number>(async (value) => {
      await new Promise((resolve) => setTimeout(resolve, value === 1 ? 5 : 0));
      observed.push(value);
    });

    const first = dispatcher.enqueue(1);
    const second = dispatcher.enqueue(2);
    await Promise.all([first, second]);
    expect(observed).toEqual([1, 2]);
  });

  it('continues after a failed item while preserving the rejection for its caller', async () => {
    const observed: number[] = [];
    const dispatcher = createOrderedAsyncDispatcher<number>((value) => {
      if (value === 1) throw new Error('failed');
      observed.push(value);
    });

    await expect(dispatcher.enqueue(1)).rejects.toThrow('failed');
    await expect(dispatcher.enqueue(2)).resolves.toBeUndefined();
    expect(observed).toEqual([2]);
  });
});
