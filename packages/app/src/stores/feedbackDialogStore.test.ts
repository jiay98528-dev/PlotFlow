import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from './uiStore';

describe('feedback dialog UI state', () => {
  beforeEach(() => useUIStore.setState({ isFeedbackDialogOpen: false }));

  it('is closed by default and changes only through explicit Help-menu actions', () => {
    expect(useUIStore.getState().isFeedbackDialogOpen).toBe(false);
    useUIStore.getState().openFeedbackDialog();
    expect(useUIStore.getState().isFeedbackDialogOpen).toBe(true);
    useUIStore.getState().closeFeedbackDialog();
    expect(useUIStore.getState().isFeedbackDialogOpen).toBe(false);
  });
});
