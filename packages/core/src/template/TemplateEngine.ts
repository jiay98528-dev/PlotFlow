/**
 * Minimal template renderer for built-in .mdstory templates.
 *
 * It intentionally keeps unknown placeholders intact so template authors can
 * spot missing metadata instead of silently losing content.
 */
export function applyTemplate(
  template: string,
  vars: Readonly<Record<string, string>>,
): string {
  if (typeof template !== 'string') return '';
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    return vars[key] ?? match;
  });
}

