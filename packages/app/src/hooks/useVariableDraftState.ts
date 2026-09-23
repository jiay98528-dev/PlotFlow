import { useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

// A workspace switch unmounts Graph Lab. Explicitly saved variable forms keep
// their draft in this session-only cache; no draft is written to disk or another story.
const values = new Map<string, unknown>();
let owner = -1;

export function useVariableDraftState<T>(
  session: number,
  key: string,
  initial: T,
  persist: boolean,
): [T, Dispatch<SetStateAction<T>>] {
  if (owner !== session) {
    values.clear();
    owner = session;
  }
  const [value, setValue] = useState<T>(() =>
    persist && values.has(key) ? (values.get(key) as T) : initial,
  );
  const sessionRef = useRef(session);
  useLayoutEffect(() => {
    if (sessionRef.current !== session) {
      sessionRef.current = session;
      setValue(initial);
      return;
    }
    if (persist) values.set(key, value);
  }, [session, key, persist, value, initial]);
  return [value, setValue];
}
