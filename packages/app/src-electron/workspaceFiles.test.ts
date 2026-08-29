import { afterEach, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { listWorkspaceStories, resolveWorkspaceStoryPath } from './workspaceFiles';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('workspace canonical paths', () => {
  it('returns the same canonical identity when the selected root is a junction', async () => {
    const container = await mkdtemp(join(tmpdir(), 'plotflow-workspace-root-'));
    temporaryDirectories.push(container);
    const realRoot = join(container, 'real-workspace');
    const linkedRoot = join(container, 'linked-workspace');
    await mkdir(realRoot);
    await writeFile(join(realRoot, 'Story.MDSTORY'), 'story', 'utf-8');
    await symlink(realRoot, linkedRoot, 'junction');

    const result = await listWorkspaceStories(linkedRoot);
    const canonicalRoot = normalize(await realpath(realRoot));
    const canonicalFile = normalize(await realpath(join(realRoot, 'Story.MDSTORY')));

    expect(result.rootPath).toBe(canonicalRoot);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.filePath).toBe(canonicalFile);
    await expect(resolveWorkspaceStoryPath(linkedRoot, result.files[0]!.filePath)).resolves.toBe(
      canonicalFile,
    );
  });

  it('rejects a surface path inside the workspace when its real target is outside', async () => {
    const container = await mkdtemp(join(tmpdir(), 'plotflow-workspace-boundary-'));
    temporaryDirectories.push(container);
    const root = join(container, 'workspace');
    const outside = join(container, 'outside');
    await mkdir(root);
    await mkdir(outside);
    await writeFile(join(outside, 'outside.mdstory'), 'outside', 'utf-8');
    const linkedOutside = join(root, 'linked-outside');
    await symlink(outside, linkedOutside, 'junction');

    await expect(
      resolveWorkspaceStoryPath(root, join(linkedOutside, 'outside.mdstory')),
    ).rejects.toThrow('工作区文件路径越界');
    await expect(listWorkspaceStories(root)).resolves.toMatchObject({ files: [] });
  });
});
