import { describe, expect, it } from 'vitest';

import {
  ANONYMOUS_CHAPTER_ID,
  exportHTML,
  exportJSON,
  exportTXT,
  parseStory,
  validateAll,
} from '../index.js';

describe('E009 export structure contract', () => {
  it('rejects a story with no chapters', () => {
    const parsed = parseStory('');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validation = validateAll(parsed.data);
    expect(validation.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'E009',
        severity: 'error',
        messageKey: 'diagnostic.E009.message',
        detailKey: 'diagnostic.E009.detail',
      }),
    ]));

    const exported = exportJSON(parsed.data);
    expect(exported.ok).toBe(false);
    if (exported.ok) return;
    expect(exported.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'E009', severity: 'error' }),
    ]));
    expect(exportHTML(parsed.data).ok).toBe(false);
    expect(exportTXT(parsed.data).ok).toBe(false);
  });

  it('rejects every empty chapter even when another chapter has a node', () => {
    const parsed = parseStory(`# Empty
# Ready
## 节点：Start
Body.
`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validation = validateAll(parsed.data);
    const structuralErrors = validation.diagnostics.filter((item) => item.code === 'E009');
    expect(structuralErrors).toHaveLength(1);
    expect(structuralErrors[0]?.detail).toContain('Empty');

    const exported = exportJSON(parsed.data);
    expect(exported.ok).toBe(false);
    if (exported.ok) return;
    expect(exported.errors[0]?.code).toBe('E009');
    expect(exported.errors[0]?.detail).toContain('Empty');
  });
});

describe('reserved anonymous chapter recovery', () => {
  it('reports E005 and keeps explicit reserved chapter separate from true anonymous nodes', () => {
    const parsed = parseStory(`## 节点：Shared
Anonymous body.
# ${ANONYMOUS_CHAPTER_ID}
## 节点：Shared
Explicit body.
`);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'E005', severity: 'error' }),
    ]));
    expect(parsed.data.chapters).toHaveLength(2);

    const anonymous = parsed.data.chapters.find((chapter) => chapter.isAnonymous);
    const recovered = parsed.data.chapters.find((chapter) => !chapter.isAnonymous);
    expect(anonymous).toMatchObject({ id: ANONYMOUS_CHAPTER_ID, title: '' });
    expect(recovered?.title).toBe(ANONYMOUS_CHAPTER_ID);
    expect(recovered?.id).not.toBe(ANONYMOUS_CHAPTER_ID);
    expect(anonymous?.nodes[0]?.body).toBe('Anonymous body.');
    expect(recovered?.nodes[0]?.body).toBe('Explicit body.');
    expect(anonymous?.nodes[0]?.fullId).not.toBe(recovered?.nodes[0]?.fullId);

    const validation = validateAll(parsed.data);
    expect(validation.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'E005', severity: 'error' }),
    ]));
    const exported = exportJSON(parsed.data);
    expect(exported.ok).toBe(false);
    if (!exported.ok) {
      expect(exported.errors.filter((item) => item.code === 'E005')).toHaveLength(1);
    }
  });
});

describe('all semantic errors block every direct exporter', () => {
  it.each([
    ['E001', `# Chapter\n## 节点：Start\nBody.\n[选项] Missing -> 节点：Nowhere\n`],
    ['E007', `# Chapter\n## 节点：Same\nOne.\n## 节点：Same\nTwo.\n`],
  ])('%s cannot bypass the JSON/HTML/TXT export guard', (code, source) => {
    const parsed = parseStory(source);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(validateAll(parsed.data).diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code, severity: 'error' }),
    ]));
    for (const result of [exportJSON(parsed.data), exportHTML(parsed.data), exportTXT(parsed.data)]) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code })]));
    }
  });
});
