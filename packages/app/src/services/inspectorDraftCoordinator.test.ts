import { expect, it, vi } from 'vitest';
import { flushInspectorDrafts, registerInspectorDraft } from './inspectorDraftCoordinator';

it('blocks a boundary on rejected input and accepts the corrected draft', () => {
  let valid = false;
  const remove = registerInspectorDraft(() => valid);
  try {
    expect(flushInspectorDrafts()).toBe(false);
    valid = true;
    expect(flushInspectorDrafts()).toBe(true);
  } finally { remove(); }
});

it('does not recursively resubmit a draft through a graph transaction', () => {
  const submit = vi.fn(() => flushInspectorDrafts());
  const remove = registerInspectorDraft(submit);
  try { expect(flushInspectorDrafts()).toBe(true); expect(submit).toHaveBeenCalledTimes(1); }
  finally { remove(); }
});
