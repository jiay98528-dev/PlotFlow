export function shouldBlockGraphShortcut(context: {
  readonly defaultPrevented: boolean;
  readonly hasModal: boolean;
  readonly isEditableTarget: boolean;
}): boolean {
  return context.defaultPrevented || context.hasModal || context.isEditableTarget;
}

export function isGraphShortcutBlocked(event: KeyboardEvent): boolean {
  const target = event.target;
  const isEditableTarget = target instanceof HTMLElement && (
    target.isContentEditable
    || target.matches('input, textarea, select, [contenteditable="true"]')
  );
  return shouldBlockGraphShortcut({
    defaultPrevented: event.defaultPrevented,
    hasModal: Boolean(document.querySelector('[aria-modal="true"], [role="dialog"]')),
    isEditableTarget,
  });
}
