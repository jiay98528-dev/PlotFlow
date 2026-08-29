import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import {
  MAX_WRITE_BYTES,
  assertWritableContent,
  findStoryFileArgument,
  isStoryFilePath,
  preflightFileSaveHash,
  resolveExistingFilePath,
  resolveWritableFilePath,
  sanitizeExportDefaultPath,
  withTimeout,
  watchFileByDirectory,
  writeTextFileAtomically,
  writeTextFileAndVerify,
} from '../../src-electron/mainProcessUtils';

describe('main process boundaries', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates IPC content by UTF-8 byte length', () => {
    expect(() => assertWritableContent('safe content')).not.toThrow();
    expect(() => assertWritableContent(123)).toThrow('必须是字符串');
    expect(() => assertWritableContent('你'.repeat(Math.floor(MAX_WRITE_BYTES / 3) + 1))).toThrow(
      '50MB',
    );
  });

  it('rejects an operation that exceeds its deadline', async () => {
    vi.useFakeTimers();
    const operation = withTimeout(new Promise<never>(() => undefined), 100, '操作超时');
    const assertion = expect(operation).rejects.toThrow('操作超时');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('extracts a story file argument without treating flags as files', () => {
    expect(findStoryFileArgument(['plotflow.exe', '--inspect', 'D:/story/Test.MDSTORY'])).toBe(
      'D:/story/Test.MDSTORY',
    );
    expect(findStoryFileArgument(['plotflow.exe', '--no-sandbox'])).toBeNull();
  });

  it('recognizes story file extensions consistently across platform entry points', () => {
    expect(isStoryFilePath('D:/story/Story.mdstory')).toBe(true);
    expect(isStoryFilePath('D:/story/Story.MDSTORY')).toBe(true);
    expect(isStoryFilePath('/stories/Story.MdStOrY')).toBe(true);
    expect(isStoryFilePath('/stories/Story.mdstory.txt')).toBe(false);
    expect(isStoryFilePath('/stories/Story.md')).toBe(false);
  });

  it('sanitizes invalid export default names before opening the save dialog', () => {
    expect(sanitizeExportDefaultPath('{{title}}.json', 'json')).toBe('plotflow-story.json');
    expect(sanitizeExportDefaultPath('Act 1: A/B*Test?.json', 'json')).toBe(
      'Act 1_ A_B_Test_.json',
    );
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

  it('atomically replaces a file without leaving temporary files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-atomic-write-'));
    try {
      const filePath = join(dir, 'story.mdstory');
      await writeFile(filePath, 'before', 'utf-8');

      const result = await writeTextFileAtomically(filePath, 'after', {
        hashContent: (content) => content,
      });

      expect(result.written).toBe(true);
      await expect(readFile(filePath, 'utf-8')).resolves.toBe('after');
      expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps observing the target when it is replaced atomically', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-directory-watch-'));
    let watcher: ReturnType<typeof watchFileByDirectory> | null = null;
    try {
      const filePath = join(dir, 'story.mdstory');
      await writeFile(filePath, 'before', 'utf-8');
      let notifyChange: (() => void) | undefined;
      const changed = new Promise<void>((resolve) => {
        notifyChange = resolve;
      });
      watcher = watchFileByDirectory(filePath, () => notifyChange?.());

      await writeTextFileAtomically(filePath, 'after', {
        hashContent: (content) => content,
      });

      await expect(
        withTimeout(changed, 2_000, 'directory watcher did not observe replacement'),
      ).resolves.toBeUndefined();
    } finally {
      watcher?.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the external version when the final hash changes before commit', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-atomic-conflict-'));
    try {
      const filePath = join(dir, 'story.mdstory');
      await writeFile(filePath, 'expected disk', 'utf-8');

      const result = await writeTextFileAtomically(filePath, 'local edit', {
        expectedHash: 'expected disk',
        hashContent: (content) => content,
        beforeCommit: () => writeFile(filePath, 'new external edit', 'utf-8'),
      });

      expect(result).toMatchObject({
        written: false,
        conflict: true,
        content: 'new external edit',
        hash: 'new external edit',
      });
      await expect(readFile(filePath, 'utf-8')).resolves.toBe('new external edit');
      expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the original target present until the final atomic replacement', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-target-presence-'));
    try {
      const filePath = join(dir, 'story.mdstory');
      await writeFile(filePath, 'expected disk', 'utf-8');

      const result = await writeTextFileAtomically(filePath, 'local edit', {
        expectedHash: 'expected disk',
        hashContent: (content) => content,
        beforeCommit: async () => {
          await expect(readFile(filePath, 'utf-8')).resolves.toBe('expected disk');
        },
      });

      expect(result.written).toBe(true);
      await expect(readFile(filePath, 'utf-8')).resolves.toBe('local edit');
      expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('cleans the temporary file when the target cannot be replaced', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-atomic-failure-'));
    try {
      const targetDirectory = join(dir, 'story.mdstory');
      await mkdir(targetDirectory);

      await expect(
        writeTextFileAtomically(targetDirectory, 'content', {
          hashContent: (content) => content,
        }),
      ).rejects.toThrow();

      expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps the original file intact when commit preparation fails', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-atomic-before-commit-failure-'));
    try {
      const filePath = join(dir, 'story.mdstory');
      await writeFile(filePath, 'original story', 'utf-8');

      await expect(
        writeTextFileAtomically(filePath, 'new story', {
          hashContent: (content) => content,
          beforeCommit: () => {
            throw new Error('simulated flush failure');
          },
        }),
      ).rejects.toThrow('simulated flush failure');

      await expect(readFile(filePath, 'utf-8')).resolves.toBe('original story');
      expect((await readdir(dir)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('canonicalizes existing and new files through a linked parent directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'plotflow-realpath-'));
    try {
      const realDirectory = join(dir, 'real');
      const linkedDirectory = join(dir, 'linked');
      await mkdir(realDirectory);
      await symlink(realDirectory, linkedDirectory, 'junction');
      await writeFile(join(realDirectory, 'existing.mdstory'), 'story', 'utf-8');

      await expect(
        resolveExistingFilePath(join(linkedDirectory, 'existing.mdstory')),
      ).resolves.toBe(normalize(join(realDirectory, 'existing.mdstory')));
      await expect(resolveWritableFilePath(join(linkedDirectory, 'new.mdstory'))).resolves.toBe(
        normalize(join(realDirectory, 'new.mdstory')),
      );
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

      await expect(
        preflightFileSaveHash({
          filePath,
          expectedHash: 'external version',
          overwriteConflict: true,
          hashContent,
        }),
      ).resolves.toEqual({ canWrite: true });

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
      await expect(
        preflightFileSaveHash({
          filePath,
          expectedHash: 'known hash',
          overwriteConflict: true,
          hashContent: (content) => content,
        }),
      ).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
