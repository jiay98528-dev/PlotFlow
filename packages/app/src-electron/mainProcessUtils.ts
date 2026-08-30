import { randomUUID } from 'node:crypto';
import { basename, dirname, join, normalize } from 'node:path';
import { watch, type FSWatcher } from 'node:fs';
import { open, readFile, realpath, rename, rm, stat } from 'node:fs/promises';

const MEBIBYTE = 1024 * 1024;

/** Renderer-to-main write operations are capped to prevent unbounded IPC allocation. */
export const MAX_WRITE_BYTES = 50 * MEBIBYTE;

export function assertWritableContent(content: unknown): asserts content is string {
  if (typeof content !== 'string') {
    throw new Error('文件内容必须是字符串');
  }

  const byteLength = Buffer.byteLength(content, 'utf8');
  if (byteLength > MAX_WRITE_BYTES) {
    throw new Error(`文件内容超出大小限制 (50MB)，当前大小 ${byteLength} 字节`);
  }
}

export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Return whether a path uses the PlotFlow story extension, regardless of case. */
export function isStoryFilePath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.mdstory');
}

export function findStoryFileArgument(args: readonly string[]): string | null {
  for (let index = 1; index < args.length; index++) {
    const argument = args[index];
    if (!argument || argument.startsWith('-')) continue;
    if (isStoryFilePath(argument)) return argument;
  }
  return null;
}

export type SaveHashPreflightResult =
  | { readonly canWrite: true }
  | {
      readonly canWrite: false;
      readonly filePath: string;
      readonly content: string;
      readonly hash: string;
      readonly modifiedAt: number;
    };

export async function preflightFileSaveHash(params: {
  readonly filePath: string;
  readonly expectedHash: string | null;
  readonly overwriteConflict?: boolean;
  readonly hashContent: (content: string) => string;
}): Promise<SaveHashPreflightResult> {
  if (typeof params.expectedHash !== 'string') {
    return { canWrite: true };
  }

  const content = await readFile(params.filePath, 'utf-8');
  const fileStat = await stat(params.filePath);
  const hash = params.hashContent(content);
  if (hash === params.expectedHash) {
    return { canWrite: true };
  }

  return {
    canWrite: false,
    filePath: params.filePath,
    content,
    hash,
    modifiedAt: fileStat.mtimeMs,
  };
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

/** Resolve an existing path through symlinks so all later checks use the I/O target. */
export async function resolveExistingFilePath(filePath: string): Promise<string> {
  return normalize(await realpath(normalize(filePath)));
}

/**
 * Resolve a writable target through symlinks. A new file inherits the canonical
 * parent directory while an existing file resolves to its final target.
 */
export async function resolveWritableFilePath(filePath: string): Promise<string> {
  const normalizedPath = normalize(filePath);
  try {
    return normalize(await realpath(normalizedPath));
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error;
    const canonicalParent = normalize(await realpath(dirname(normalizedPath)));
    return join(canonicalParent, basename(normalizedPath));
  }
}

/** Watch the containing directory so atomic replacement does not detach the watcher. */
export function watchFileByDirectory(
  filePath: string,
  onChange: () => void,
  onError?: (error: Error) => void,
): FSWatcher {
  const normalizedPath = normalize(filePath);
  const targetName = basename(normalizedPath);
  const watcher = watch(
    dirname(normalizedPath),
    { persistent: false },
    (_eventType, changedName) => {
      if (changedName !== null) {
        const actualName = changedName.toString();
        const matches =
          process.platform === 'win32'
            ? actualName.toLowerCase() === targetName.toLowerCase()
            : actualName === targetName;
        if (!matches) return;
      }
      onChange();
    },
  );
  if (onError) watcher.on('error', onError);
  return watcher;
}

export type AtomicTextWriteResult =
  | { readonly written: true; readonly modifiedAt: number }
  | {
      readonly written: false;
      readonly conflict: true;
      readonly filePath: string;
      readonly content: string;
      readonly hash: string;
      readonly modifiedAt: number;
    }
  | {
      readonly written: false;
      readonly conflict: false;
      readonly message: string;
    };

export interface AtomicTextWriteOptions {
  readonly expectedHash?: string | null;
  readonly hashContent: (content: string) => string;
  /** Test-only hook before the final hash check and atomic replacement. */
  readonly beforeCommit?: () => void | Promise<void>;
}

const UNSUPPORTED_SYNC_CODES = new Set(['EINVAL', 'ENOSYS', 'ENOTSUP', 'EOPNOTSUPP']);

function isUnsupportedSyncError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false;
  const code = error.code;
  return typeof code === 'string' && UNSUPPORTED_SYNC_CODES.has(code);
}

/**
 * Atomically replace a text file without exposing a partially-written target.
 * The temporary file lives beside the target so rename remains on one volume.
 */
export async function writeTextFileAtomically(
  filePath: string,
  content: string,
  options: AtomicTextWriteOptions,
): Promise<AtomicTextWriteResult> {
  const targetPath = normalize(filePath);
  const temporaryPath = join(
    dirname(targetPath),
    `.${basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  let committed = false;

  try {
    let mode = 0o666;
    try {
      const targetStat = await stat(targetPath);
      if (targetStat.isFile()) mode = targetStat.mode & 0o777;
    } catch (error) {
      if (!hasErrorCode(error, 'ENOENT')) throw error;
    }

    handle = await open(temporaryPath, 'wx', mode);
    await handle.writeFile(content, { encoding: 'utf-8' });
    try {
      await handle.sync();
    } catch (error) {
      if (!isUnsupportedSyncError(error)) throw error;
    }
    await handle.close();
    handle = null;

    const temporaryContent = await readFile(temporaryPath, 'utf-8');
    if (temporaryContent !== content) {
      throw new Error('临时文件写入校验失败');
    }

    await options.beforeCommit?.();

    if (typeof options.expectedHash === 'string') {
      let preflight: SaveHashPreflightResult;
      try {
        preflight = await preflightFileSaveHash({
          filePath: targetPath,
          expectedHash: options.expectedHash,
          hashContent: options.hashContent,
        });
      } catch (error) {
        return {
          written: false,
          conflict: false,
          message: `保存前无法校验磁盘文件: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
      if (!preflight.canWrite) {
        return {
          written: false,
          conflict: true,
          filePath: preflight.filePath,
          content: preflight.content,
          hash: preflight.hash,
          modifiedAt: preflight.modifiedAt,
        };
      }

    }

    await rename(temporaryPath, targetPath);
    committed = true;
    const fileStat = await stat(targetPath);
    if (!fileStat.isFile()) throw new Error('写入目标不是文件');
    return { written: true, modifiedAt: fileStat.mtimeMs };
  } finally {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
    if (!committed) {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
    }
  }
}

const EXPORT_EXTENSIONS = new Set(['json', 'html', 'txt']);
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*]/g;
const TEMPLATE_PLACEHOLDER = /\{\{[^}]+}}/;
const RESERVED_WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function replaceInvalidFileNameChars(value: string): string {
  return value
    .replace(INVALID_FILENAME_CHARS, '_')
    .split('')
    .map((char) => (char.charCodeAt(0) < 32 ? '_' : char))
    .join('');
}

export function sanitizeExportDefaultPath(defaultPath: unknown, format: string): string {
  const extension = EXPORT_EXTENSIONS.has(format) ? format : 'json';
  const fallback = `plotflow-story.${extension}`;

  if (typeof defaultPath !== 'string') return fallback;

  const trimmedPath = defaultPath.trim();
  const isAbsoluteLikePath =
    /^[a-zA-Z]:[\\/]/.test(trimmedPath) ||
    trimmedPath.startsWith('/') ||
    trimmedPath.startsWith('\\');
  const rawName = isAbsoluteLikePath
    ? (trimmedPath.replace(/\\/g, '/').split('/').pop()?.trim() ?? '')
    : trimmedPath;
  const baseName = rawName.replace(/\.[^.]+$/u, '');
  if (!baseName || TEMPLATE_PLACEHOLDER.test(baseName)) return fallback;

  const safeName = replaceInvalidFileNameChars(baseName)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
    .slice(0, 96);

  if (!safeName || RESERVED_WINDOWS_DEVICE_NAME.test(safeName)) return fallback;
  return `${safeName}.${extension}`;
}

export async function writeTextFileAndVerify(filePath: string, content: string): Promise<void> {
  const result = await writeTextFileAtomically(filePath, content, {
    hashContent: (value) => value,
  });
  if (!result.written) {
    throw new Error(result.conflict ? '写入目标在提交前发生冲突' : result.message);
  }
}
