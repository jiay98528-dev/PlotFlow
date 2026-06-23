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
