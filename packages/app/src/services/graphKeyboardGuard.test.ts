import { describe, expect, it } from 'vitest';
import { shouldBlockGraphShortcut } from './graphKeyboardGuard';

describe('graph keyboard shortcut guard', () => {
  it.each([
    { defaultPrevented: true, hasModal: false, isEditableTarget: false },
    { defaultPrevented: false, hasModal: true, isEditableTarget: false },
    { defaultPrevented: false, hasModal: false, isEditableTarget: true },
  ])('blocks background commands for protected context %#', (context) => {
    expect(shouldBlockGraphShortcut(context)).toBe(true);
  });

  it('allows a canvas command with no modal or editable target', () => {
    expect(shouldBlockGraphShortcut({
      defaultPrevented: false,
      hasModal: false,
      isEditableTarget: false,
    })).toBe(false);
  });
});
