export type CloseFailureStage = 'query' | 'save' | 'discard';

export interface CloseGuardState {
  readonly isDirty: boolean;
  readonly filePath: string | null;
}

export type UnsavedChoice = 'save' | 'discard' | 'cancel';
export type FailureChoice = 'retry' | 'force-quit' | 'cancel';

export interface CloseGuardAdapter {
  queryState(): Promise<CloseGuardState | null>;
  save(): Promise<boolean>;
  discard(): Promise<boolean>;
  chooseUnsaved(state: CloseGuardState): Promise<UnsavedChoice>;
  chooseFailure(stage: CloseFailureStage, error: unknown): Promise<FailureChoice>;
}

function isCloseGuardState(value: unknown): value is CloseGuardState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate['isDirty'] === 'boolean'
    && (candidate['filePath'] === null || typeof candidate['filePath'] === 'string');
}

/**
 * Runs the close arbitration without owning the BrowserWindow lifecycle.
 * `true` means that destruction was explicitly authorised; all failures are
 * fail-closed unless the user chooses Force Quit.
 */
export async function arbitrateClose(adapter: CloseGuardAdapter): Promise<boolean> {
  for (;;) {
    let state: CloseGuardState | null;
    try {
      state = await adapter.queryState();
      if (!isCloseGuardState(state)) throw new Error('Renderer returned an invalid editor state.');
    } catch (error) {
      const choice = await adapter.chooseFailure('query', error);
      if (choice === 'retry') continue;
      return choice === 'force-quit';
    }

    if (!state.isDirty) return true;
    const choice = await adapter.chooseUnsaved(state);
    if (choice === 'cancel') return false;
    if (choice === 'discard') {
      try {
        if ((await adapter.discard()) === true) return true;
        throw new Error('Renderer did not confirm that destructive exit preparation completed.');
      } catch (error) {
        const failureChoice = await adapter.chooseFailure('discard', error);
        if (failureChoice === 'force-quit') return true;
        if (failureChoice === 'cancel') return false;
        continue;
      }
    }

    try {
      if ((await adapter.save()) === true) return true;
      throw new Error('Renderer did not confirm that the story was saved.');
    } catch (error) {
      const failureChoice = await adapter.chooseFailure('save', error);
      if (failureChoice === 'force-quit') return true;
      if (failureChoice === 'cancel') return false;
      // Retry returns to the dirty-state query so a successful late save is
      // observed before another write is attempted.
    }
  }
}
