import { useCallback, useEffect, useMemo, useRef } from 'react';

export type GraphInteractionKind = 'connect' | 'reconnect' | 'manual-wire' | 'node-drag';

export interface GraphInteractionToken {
  readonly id: number;
  readonly kind: GraphInteractionKind;
}

export interface GraphInteractionLease {
  acquire(kind: GraphInteractionKind): GraphInteractionToken;
  release(token: GraphInteractionToken): void;
  releaseAll(): void;
  isActive(kind: GraphInteractionKind): boolean;
}

interface GraphInteractionLeaseOptions {
  readonly storySessionId: number;
  readonly setEditing: (editing: boolean) => void;
}

/**
 * Owns the global graph editing lock for all gestures mounted by one canvas.
 * Tokens make overlapping React Flow and pointer fallbacks safe: the lock is
 * released only after the final active gesture completes.
 */
export function useGraphInteractionLease({
  storySessionId,
  setEditing,
}: GraphInteractionLeaseOptions): GraphInteractionLease {
  const activeTokensRef = useRef(new Map<number, GraphInteractionKind>());
  const nextTokenIdRef = useRef(1);
  const sessionRef = useRef(storySessionId);

  const releaseAll = useCallback((): void => {
    if (activeTokensRef.current.size === 0) return;
    activeTokensRef.current.clear();
    setEditing(false);
  }, [setEditing]);

  const acquire = useCallback(
    (kind: GraphInteractionKind): GraphInteractionToken => {
      const activeTokens = activeTokensRef.current;
      const shouldAcquireGlobalLock = activeTokens.size === 0;
      const token = { id: nextTokenIdRef.current++, kind };
      activeTokens.set(token.id, kind);
      if (shouldAcquireGlobalLock) setEditing(true);
      return token;
    },
    [setEditing],
  );

  const release = useCallback(
    (token: GraphInteractionToken): void => {
      const activeTokens = activeTokensRef.current;
      if (activeTokens.get(token.id) !== token.kind) return;
      activeTokens.delete(token.id);
      if (activeTokens.size > 0) return;
      setEditing(false);
    },
    [setEditing],
  );

  const isActive = useCallback(
    (kind: GraphInteractionKind): boolean =>
      Array.from(activeTokensRef.current.values()).includes(kind),
    [],
  );

  useEffect(() => {
    if (sessionRef.current === storySessionId) return;
    sessionRef.current = storySessionId;
    releaseAll();
  }, [releaseAll, storySessionId]);

  useEffect(() => releaseAll, [releaseAll]);

  return useMemo(
    () => ({ acquire, release, releaseAll, isActive }),
    [acquire, isActive, release, releaseAll],
  );
}
