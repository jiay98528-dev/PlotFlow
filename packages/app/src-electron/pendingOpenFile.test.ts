import { describe, expect, it, vi } from 'vitest';
import { resolvePendingOpenFile } from './pendingOpenFile';

const story = {
  filePath: 'C:/stories/demo.mdstory',
  content: '# Demo',
  hash: 'hash',
  modifiedAt: 42,
};

describe('resolvePendingOpenFile', () => {
  it('returns none without invoking the reader when no path is pending', async () => {
    const reader = vi.fn();
    await expect(resolvePendingOpenFile(null, reader)).resolves.toEqual({ status: 'none' });
    expect(reader).not.toHaveBeenCalled();
  });

  it('wraps a successfully opened story in a tagged result', async () => {
    await expect(resolvePendingOpenFile(story.filePath, async () => story)).resolves.toEqual({
      status: 'opened',
      story,
    });
  });

  it('preserves the failed path and Node error code', async () => {
    const error = Object.assign(new Error('missing'), { code: 'ENOENT' });
    await expect(resolvePendingOpenFile(story.filePath, async () => Promise.reject(error))).resolves.toEqual({
      status: 'error',
      path: story.filePath,
      code: 'ENOENT',
    });
  });

  it.each(['EACCES', 'EPERM'])('preserves %s permission errors', async (code) => {
    const error = Object.assign(new Error('denied'), { code });
    await expect(resolvePendingOpenFile(story.filePath, async () => Promise.reject(error))).resolves.toEqual({
      status: 'error',
      path: story.filePath,
      code,
    });
  });

  it('uses UNKNOWN when the thrown value has no Node error code', async () => {
    await expect(resolvePendingOpenFile(story.filePath, async () => Promise.reject(new Error('broken')))).resolves.toEqual({
      status: 'error',
      path: story.filePath,
      code: 'UNKNOWN',
    });
  });
});
