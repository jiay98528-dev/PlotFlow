import type { FileOpenResult } from '../types/electron';

const RECENT_STORY_KEY = 'plotflow:recent-story';

export interface RecentStoryFile {
  readonly filePath: string;
  readonly hash: string;
  readonly modifiedAt: number;
  readonly savedAt: number;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function isStoryPath(path: string): boolean {
  return /\.mdstory$/i.test(path.trim());
}

function removeRecentStory(): void {
  window.localStorage?.removeItem(RECENT_STORY_KEY);
}

export function rememberRecentStory(filePath: string, hash: string, modifiedAt: number): void {
  const normalizedPath = normalizePath(filePath);
  if (!isStoryPath(normalizedPath)) return;

  try {
    window.localStorage?.setItem(RECENT_STORY_KEY, JSON.stringify({
      filePath: normalizedPath,
      hash,
      modifiedAt,
      savedAt: Date.now(),
    } satisfies RecentStoryFile));
  } catch {
    // Recent-file persistence is best-effort and must not block file I/O.
  }
}

export function readRecentStory(): RecentStoryFile | null {
  try {
    const raw = window.localStorage?.getItem(RECENT_STORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RecentStoryFile>;
    if (
      typeof parsed.filePath !== 'string' ||
      typeof parsed.hash !== 'string' ||
      typeof parsed.modifiedAt !== 'number' ||
      typeof parsed.savedAt !== 'number'
    ) {
      clearRecentStory();
      return null;
    }
    const normalizedPath = normalizePath(parsed.filePath);
    if (!isStoryPath(normalizedPath)) {
      clearRecentStory();
      return null;
    }
    return {
      filePath: normalizedPath,
      hash: parsed.hash,
      modifiedAt: parsed.modifiedAt,
      savedAt: parsed.savedAt,
    };
  } catch {
    clearRecentStory();
    return null;
  }
}

export function clearRecentStory(): void {
  try {
    removeRecentStory();
  } catch {
    // Ignore unavailable storage in browser-preview tests.
  }
}

export function rememberOpenedStory(result: FileOpenResult): void {
  rememberRecentStory(result.filePath, result.hash, result.modifiedAt);
}
