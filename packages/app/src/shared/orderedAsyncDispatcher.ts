export interface OrderedAsyncDispatcher<T> {
  readonly enqueue: (value: T) => Promise<void>;
  readonly whenIdle: () => Promise<void>;
}

export function createOrderedAsyncDispatcher<T>(
  handler: (value: T) => void | Promise<void>,
): OrderedAsyncDispatcher<T> {
  let tail = Promise.resolve();
  return {
    enqueue: (value) => {
      const task = tail.then(() => handler(value));
      tail = task.catch(() => undefined);
      return task;
    },
    whenIdle: () => tail,
  };
}
