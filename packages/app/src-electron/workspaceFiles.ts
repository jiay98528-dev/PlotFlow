import { basename, isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';
import { readdir, realpath, stat } from 'node:fs/promises';
import type { WorkspaceStoriesResult, WorkspaceStoryFile } from '../src/types/electron';
import { isStoryFilePath } from './mainProcessUtils';

export const MAX_READ_BYTES = 10 * 1024 * 1024;
const MAX_WORKSPACE_SCAN_DEPTH = 2;
const MAX_WORKSPACE_STORY_FILES = 300;
const WORKSPACE_IGNORED_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  '.pnpm',
  'release',
  'out',
  'dist',
  'coverage',
  'website',
  'dist-static',
]);
const FORBIDDEN_UNIX_PREFIXES = ['/etc', '/proc', '/sys', '/dev', '/boot', '/root'];

export function isBlockedSystemPath(filePath: string): boolean {
  const lower = normalize(filePath).toLowerCase();
  for (const prefix of FORBIDDEN_UNIX_PREFIXES) {
    if (lower === prefix || lower.startsWith(prefix + '/') || lower.startsWith(prefix + '\\')) {
      return true;
    }
  }
  return lower.includes('\\windows\\') || lower.includes('/windows/');
}

export function assertWorkspacePathInside(root: string, target: string): void {
  const relativePath = relative(resolve(root), resolve(target));
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    throw new Error('工作区文件路径越界');
  }
}

async function collectWorkspaceStories(
  rootPath: string,
  currentPath: string,
  depth: number,
  files: WorkspaceStoryFile[],
): Promise<boolean> {
  if (files.length >= MAX_WORKSPACE_STORY_FILES) return true;
  let truncated = false;
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    if (files.length >= MAX_WORKSPACE_STORY_FILES) {
      truncated = true;
      break;
    }
    if (entry.isSymbolicLink()) continue;

    const surfacePath = join(currentPath, entry.name);
    const canonicalPath = normalize(await realpath(surfacePath));
    try {
      assertWorkspacePathInside(rootPath, canonicalPath);
    } catch {
      continue;
    }

    if (entry.isDirectory()) {
      if (depth >= MAX_WORKSPACE_SCAN_DEPTH) continue;
      if (WORKSPACE_IGNORED_DIRS.has(entry.name.toLowerCase())) continue;
      truncated =
        (await collectWorkspaceStories(rootPath, canonicalPath, depth + 1, files)) || truncated;
      continue;
    }
    if (!entry.isFile() || !isStoryFilePath(entry.name)) continue;

    const fileStat = await stat(canonicalPath);
    if (fileStat.size > MAX_READ_BYTES) continue;
    files.push({
      filePath: canonicalPath,
      relativePath: relative(rootPath, canonicalPath).replace(/\\/g, '/'),
      name: basename(canonicalPath),
      size: fileStat.size,
      modifiedAt: fileStat.mtimeMs,
    });
  }

  return truncated;
}

export async function listWorkspaceStories(rootPath: string): Promise<WorkspaceStoriesResult> {
  const canonicalRoot = normalize(await realpath(normalize(rootPath)));
  if (isBlockedSystemPath(canonicalRoot)) {
    throw new Error('不允许把系统目录作为 PlotFlow 工作区');
  }
  const rootStat = await stat(canonicalRoot);
  if (!rootStat.isDirectory()) throw new Error('请选择文件夹作为 PlotFlow 工作区');

  const files: WorkspaceStoryFile[] = [];
  const truncated = await collectWorkspaceStories(canonicalRoot, canonicalRoot, 0, files);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'));
  return { rootPath: canonicalRoot, files, truncated };
}

export async function resolveWorkspaceStoryPath(
  rootPath: string,
  filePath: string,
): Promise<string> {
  const canonicalRoot = normalize(await realpath(normalize(rootPath)));
  const canonicalFile = normalize(await realpath(normalize(filePath)));
  assertWorkspacePathInside(canonicalRoot, canonicalFile);
  return canonicalFile;
}
