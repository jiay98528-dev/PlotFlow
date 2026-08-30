import { describe, expect, it, vi } from 'vitest';
import { arbitrateClose, type CloseGuardAdapter } from './closeGuard';

function adapter(overrides: Partial<CloseGuardAdapter> = {}): CloseGuardAdapter {
  return {
    queryState: vi.fn().mockResolvedValue({ isDirty: false, filePath: null }),
    save: vi.fn().mockResolvedValue(true),
    discard: vi.fn().mockResolvedValue(true),
    chooseUnsaved: vi.fn().mockResolvedValue('cancel'),
    chooseFailure: vi.fn().mockResolvedValue('cancel'),
    ...overrides,
  };
}

describe('arbitrateClose', () => {
  it('fails closed when querying renderer state rejects', async () => {
    expect(await arbitrateClose(adapter({ queryState: vi.fn().mockRejectedValue(new Error('timeout')) }))).toBe(false);
  });

  it('only permits an exceptional close after explicit force quit', async () => {
    expect(await arbitrateClose(adapter({
      queryState: vi.fn().mockRejectedValue(new Error('renderer gone')),
      chooseFailure: vi.fn().mockResolvedValue('force-quit'),
    }))).toBe(true);
  });

  it('keeps the window when save fails and the user cancels', async () => {
    expect(await arbitrateClose(adapter({
      queryState: vi.fn().mockResolvedValue({ isDirty: true, filePath: 'story.mdstory' }),
      chooseUnsaved: vi.fn().mockResolvedValue('save'),
      save: vi.fn().mockRejectedValue(new Error('disk full')),
    }))).toBe(false);
  });

  it('retries query failures and closes after a clean response', async () => {
    const queryState = vi.fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ isDirty: false, filePath: null });
    expect(await arbitrateClose(adapter({
      queryState,
      chooseFailure: vi.fn().mockResolvedValue('retry'),
    }))).toBe(true);
    expect(queryState).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed renderer state instead of treating it as clean', async () => {
    expect(await arbitrateClose(adapter({
      queryState: vi.fn().mockResolvedValue({} as never),
    }))).toBe(false);
  });

  it('requires a literal true save acknowledgement', async () => {
    expect(await arbitrateClose(adapter({
      queryState: vi.fn().mockResolvedValue({ isDirty: true, filePath: 'story.mdstory' }),
      chooseUnsaved: vi.fn().mockResolvedValue('save'),
      save: vi.fn().mockResolvedValue('false' as never),
    }))).toBe(false);
  });

  it('fails closed when discard preparation cannot restore external disk state', async () => {
    expect(await arbitrateClose(adapter({
      queryState: vi.fn().mockResolvedValue({ isDirty: true, filePath: 'story.mdstory' }),
      chooseUnsaved: vi.fn().mockResolvedValue('discard'),
      discard: vi.fn().mockResolvedValue(false),
    }))).toBe(false);
  });

  it('permits discard only after renderer preparation acknowledges success', async () => {
    const discard = vi.fn().mockResolvedValue(true);
    expect(await arbitrateClose(adapter({
      queryState: vi.fn().mockResolvedValue({ isDirty: true, filePath: 'story.mdstory' }),
      chooseUnsaved: vi.fn().mockResolvedValue('discard'),
      discard,
    }))).toBe(true);
    expect(discard).toHaveBeenCalledOnce();
  });
});
