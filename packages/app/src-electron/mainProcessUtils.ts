import { readFile, stat, writeFile } from 'node:fs/promises';

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

export function findStoryFileArgument(args: readonly string[]): string | null {
  for (let index = 1; index < args.length; index++) {
    const argument = args[index];
    if (!argument || argument.startsWith('-')) continue;
    if (argument.toLowerCase().endsWith('.mdstory')) return argument;
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
  const isAbsoluteLikePath = /^[a-zA-Z]:[\\/]/.test(trimmedPath)
    || trimmedPath.startsWith('/')
    || trimmedPath.startsWith('\\');
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
  await writeFile(filePath, content, 'utf-8');

  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    throw new Error('写入目标不是文件');
  }

  const written = await readFile(filePath, 'utf-8');
  if (written !== content) {
    throw new Error('写入后读回校验失败');
  }
}
