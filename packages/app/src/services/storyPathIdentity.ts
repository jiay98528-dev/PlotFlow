export function sameStoryPath(
  left: string | null | undefined,
  right: string | null | undefined,
  platform: NodeJS.Platform,
): boolean {
  if (!left || !right) return false;
  const normalizePath = (value: string): string => {
    const normalized = value.replace(/\\/g, '/');
    return platform === 'win32' ? normalized.toLowerCase() : normalized;
  };
  return normalizePath(left) === normalizePath(right);
}
