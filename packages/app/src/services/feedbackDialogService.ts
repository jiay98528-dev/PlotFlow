import { useUIStore } from '../stores/uiStore';

const MODAL_SELECTOR = '[aria-modal="true"][role="dialog"]';
const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function focusExistingModal(): boolean {
  if (typeof document === 'undefined') return false;
  const modal = document.querySelector<HTMLElement>(MODAL_SELECTOR);
  if (!modal) return false;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && modal.contains(activeElement)) {
    activeElement.focus();
  } else {
    (modal.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? modal).focus();
  }
  return true;
}

/** Opens feedback only when it cannot stack over another modal. */
export function requestFeedbackDialog(): boolean {
  const ui = useUIStore.getState();
  if (
    ui.isFeedbackDialogOpen ||
    ui.isConditionEditorOpen ||
    ui.isExportDialogOpen ||
    ui.isCorpusManagerOpen ||
    ui.isNewFileDialogOpen ||
    ui.isThemeCenterOpen ||
    focusExistingModal()
  ) {
    focusExistingModal();
    return false;
  }
  ui.openFeedbackDialog();
  return true;
}
