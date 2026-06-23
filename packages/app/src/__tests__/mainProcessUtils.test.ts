import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_WRITE_BYTES,
  assertWritableContent,
  findStoryFileArgument,
  withTimeout,
} from '../../src-electron/mainProcessUtils';

describe('main process boundaries', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates IPC content by UTF-8 byte length', () => {
    expect(() => assertWritableContent('safe content')).not.toThrow();
    expect(() => assertWritableContent(123)).toThrow('必须是字符串');
    expect(() => assertWritableContent('你'.repeat(Math.floor(MAX_WRITE_BYTES / 3) + 1)))
      .toThrow('50MB');
  });

  it('rejects an operation that exceeds its deadline', async () => {
    vi.useFakeTimers();
    const operation = withTimeout(new Promise<never>(() => undefined), 100, '操作超时');
    const assertion = expect(operation).rejects.toThrow('操作超时');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('extracts a story file argument without treating flags as files', () => {
    expect(findStoryFileArgument(['plotflow.exe', '--inspect', 'D:/story/Test.MDSTORY']))
      .toBe('D:/story/Test.MDSTORY');
    expect(findStoryFileArgument(['plotflow.exe', '--no-sandbox'])).toBeNull();
  });
});
