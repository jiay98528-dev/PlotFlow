import { useLayoutEffect, useRef } from 'react';
import {
  registerInspectorDraft,
  type InspectorDraftReason,
} from '../services/inspectorDraftCoordinator';

export function useInspectorDraft(
  flush: (reason: InspectorDraftReason) => boolean,
  isDirty: () => boolean = () => false,
): void {
  const current = useRef(flush);
  const dirty = useRef(isDirty);
  current.current = flush;
  dirty.current = isDirty;
  useLayoutEffect(
    () =>
      registerInspectorDraft(
        (reason) => current.current(reason),
        () => dirty.current(),
      ),
    [],
  );
}
