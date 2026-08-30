// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import { requestFeedbackDialog } from './feedbackDialogService';
import { useUIStore } from '../stores/uiStore';

describe('requestFeedbackDialog', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    useUIStore.setState({
      isFeedbackDialogOpen: false,
      isConditionEditorOpen: false,
      isExportDialogOpen: false,
      isCorpusManagerOpen: false,
      isNewFileDialogOpen: false,
      isThemeCenterOpen: false,
    });
  });

  it('opens feedback when no modal is active', () => {
    expect(requestFeedbackDialog()).toBe(true);
    expect(useUIStore.getState().isFeedbackDialogOpen).toBe(true);
  });

  it('rejects stacking and focuses the existing modal', () => {
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const button = document.createElement('button');
    modal.append(button);
    document.body.append(modal);

    expect(requestFeedbackDialog()).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(useUIStore.getState().isFeedbackDialogOpen).toBe(false);
  });

  it('rejects a store-owned modal before its DOM has rendered', () => {
    useUIStore.setState({ isNewFileDialogOpen: true });
    expect(requestFeedbackDialog()).toBe(false);
    expect(useUIStore.getState().isFeedbackDialogOpen).toBe(false);
  });

  it('does not stack over Theme Center before its surface reaches the DOM', () => {
    useUIStore.setState({ isThemeCenterOpen: true });
    expect(requestFeedbackDialog()).toBe(false);
    expect(useUIStore.getState().isFeedbackDialogOpen).toBe(false);
  });
});
