export type StoryNewline = '\n' | '\r\n' | '\r';

/** Browser textareas expose line endings as LF regardless of the source file. */
export function normalizeSourceDraftText(value: string): string {
  return value.replace(/\r\n?|\n/gu, '\n');
}

/** Restore the story's original line-ending convention only at commit time. */
export function serializeSourceDraftText(value: string, newline: StoryNewline): string {
  const normalized = normalizeSourceDraftText(value);
  return newline === '\n' ? normalized : normalized.replace(/\n/gu, newline);
}
