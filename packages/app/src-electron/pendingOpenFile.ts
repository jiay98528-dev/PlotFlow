import type { FileOpenResult, PendingOpenFileResult } from '../src/types/electron';

function errorCode(error: unknown): string {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    && error.code.length > 0
  ) {
    return error.code;
  }
  return 'UNKNOWN';
}

export async function resolvePendingOpenFile(
  filePath: string | null,
  readStory: (path: string) => Promise<FileOpenResult>,
): Promise<PendingOpenFileResult> {
  if (filePath === null) return { status: 'none' };

  try {
    return { status: 'opened', story: await readStory(filePath) };
  } catch (error) {
    return { status: 'error', path: filePath, code: errorCode(error) };
  }
}

