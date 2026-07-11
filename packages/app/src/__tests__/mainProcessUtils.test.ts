import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  MAX_WRITE_BYTES,
  assertWritableContent,
  findStoryFileArgument,
  preflightFileSaveHash,
  sanitizeExportDefaultPath,
  withTimeout,
  writeTextFileAndVerify,
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

  it('sanitizes invalid export default names before opening the save dialog', () => {
    expect(sanitizeExportDefaultPath('{{title}}.json', 'json')).toBe('plotflow-story.json');
    expect(sanitizeExportDefaultPath('Act 1: A/B*Test?.json', 'json')).toBe('Act 1_ A_B_Test_.json');
    expect(sanitizeExportDefaultPath('CON.txt', 'txt')).toBe('plotflow-story.txt');
    expect(sanitizeExportDefaultPath('story', 'html')).toBe('story.html');
  });

  it('verifies text writes by reading the file back from disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-write-verify-'));
    try {
      const filePath = join(dir, 'export.json');
      const content = '{"nodes":[{"id":"start"}]}';
      await writeTextFileAndVerify(filePath, content);
      await expect(readFile(filePath, 'utf-8')).resolves.toBe(content);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('allows conflict overwrite only when disk still matches the confirmed hash', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-save-preflight-'));
    try {
      const filePath = join(dir, 'story.mdstory');
      const hashContent = (content: string) => content;
      await writeFile(filePath, 'external version', 'utf-8');

      await expect(preflightFileSaveHash({
        filePath,
        expectedHash: 'external version',
        overwriteConflict: true,
        hashContent,
      })).resolves.toEqual({ canWrite: true });

      await writeFile(filePath, 'newer external version', 'utf-8');
      const result = await preflightFileSaveHash({
        filePath,
        expectedHash: 'external version',
        overwriteConflict: true,
        hashContent,
      });

      expect(result).toMatchObject({
        canWrite: false,
        filePath,
        content: 'newer external version',
        hash: 'newer external version',
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects hash preflight when the disk file cannot be read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-save-preflight-missing-'));
    try {
      const filePath = join(dir, 'missing.mdstory');
      await expect(preflightFileSaveHash({
        filePath,
        expectedHash: 'known hash',
        overwriteConflict: true,
        hashContent: (content) => content,
      })).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
