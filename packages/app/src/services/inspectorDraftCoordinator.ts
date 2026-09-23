// Separate from source-slice coordination: Inspector commits may themselves use
// the graph transaction path. Re-entrant flushes must not submit a draft twice.
export type InspectorDraftReason =
  | 'select'
  | 'save'
  | 'replace'
  | 'export'
  | 'graph'
  | 'chapter'
  | 'workspace';
type FlushDraft = (reason: InspectorDraftReason) => boolean;
const drafts = new Set<FlushDraft>();
const dirtyStates = new Map<FlushDraft, () => boolean>();
let flushing = false;

export function registerInspectorDraft(
  flush: FlushDraft,
  isDirty: () => boolean = () => false,
): () => void {
  drafts.add(flush);
  dirtyStates.set(flush, isDirty);
  return () => {
    drafts.delete(flush);
    dirtyStates.delete(flush);
  };
}

export function hasInspectorDrafts(): boolean {
  return [...dirtyStates.values()].some((isDirty) => isDirty());
}

export function flushInspectorDrafts(reason: InspectorDraftReason = 'select'): boolean {
  if (flushing) return true;
  flushing = true;
  try {
    for (const flush of drafts) if (!flush(reason)) return false;
    return true;
  } finally {
    flushing = false;
  }
}
