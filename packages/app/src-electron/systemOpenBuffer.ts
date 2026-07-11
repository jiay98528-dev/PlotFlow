export interface BufferedResultListener<T> {
  readonly push: (result: T) => void;
  readonly register: (callback: (result: T) => void) => () => void;
}

export function createBufferedResultListener<T>(): BufferedResultListener<T> {
  const buffered: T[] = [];
  let active: ((result: T) => void) | null = null;
  return {
    push: (result) => {
      if (active) active(result);
      else buffered.push(result);
    },
    register: (callback) => {
      active = callback;
      for (const result of buffered.splice(0)) callback(result);
      return () => {
        if (active === callback) active = null;
      };
    },
  };
}
