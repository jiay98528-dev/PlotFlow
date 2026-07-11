import { describe, expect, it } from 'vitest';
import {
  createFullId,
  exportJSON,
  legacyFullId,
  parseStory,
  validateAll,
} from '../index.js';

describe('P1 public contracts', () => {
  it('creates collision-safe canonical full IDs', () => {
    const first = createFullId('A-B', 'C');
    const second = createFullId('A', 'B-C');

    expect(first).toBe('A-B/C');
    expect(second).toBe('A/B-C');
    expect(first).not.toBe(second);
    expect(legacyFullId('A-B', 'C')).toBe(legacyFullId('A', 'B-C'));
  });

  it('normalizes malformed UTF-16 instead of throwing during ID creation', () => {
    expect(() => createFullId('Chapter', '\ud800')).not.toThrow();
    expect(createFullId('Chapter', '\ud800')).toBe('Chapter/%EF%BF%BD');
  });

  it('reads a uniquely matched legacy layout key and rejects an ambiguous one', () => {
    const unique = parseStory(`---
layout:
  graph:
    version: 1
    nodes:
      - id: Chapter-Start
        x: 10
        y: 20
---
# Chapter
## 节点：Start
Body.
`);
    expect(unique.ok).toBe(true);
    if (unique.ok) {
      expect(unique.data.chapters[0]?.nodes[0]?.position).toEqual({ x: 10, y: 20 });
    }

    const ambiguous = parseStory(`---
layout:
  graph:
    version: 1
    nodes:
      - id: A-B-C
        x: 10
        y: 20
---
# A-B
## 节点：C
First.
# A
## 节点：B-C
Second.
`);
    expect(ambiguous.ok).toBe(true);
    if (ambiguous.ok) {
      const nodes = ambiguous.data.chapters.flatMap((chapter) => chapter.nodes);
      expect(nodes.every((node) => node.position === undefined)).toBe(true);
      expect(ambiguous.diagnostics.some((diagnostic) => diagnostic.code === 'W006')).toBe(true);
    }

    const canonicalPlusAmbiguous = parseStory(`---
layout:
  graph:
    version: 1
    nodes:
      - id: A-B/C
        x: 1
        y: 2
      - id: A-B-C
        x: 10
        y: 20
---
# A-B
## 节点：C
First.
# A
## 节点：B-C
Second.
`);
    expect(canonicalPlusAmbiguous.ok).toBe(true);
    if (canonicalPlusAmbiguous.ok) {
      const [first, second] = canonicalPlusAmbiguous.data.chapters.flatMap((chapter) => chapter.nodes);
      expect(first?.position).toEqual({ x: 1, y: 2 });
      expect(second?.position).toBeUndefined();
      expect(canonicalPlusAmbiguous.diagnostics.some((diagnostic) => diagnostic.code === 'W006')).toBe(true);
    }
  });

  it('rejects unknown engines and exports a valid empty object declaration', () => {
    const invalidEngine = parseStory(`---
engine: custom
---
# Chapter
## 节点：Start
Body.
`);
    expect(invalidEngine.ok).toBe(true);
    if (invalidEngine.ok) {
      expect(invalidEngine.diagnostics.some((diagnostic) => diagnostic.code === 'E005')).toBe(true);
      expect(invalidEngine.data.meta.engine).toBeUndefined();
    }

    const story = parseStory(`---
vars:
  bag:
    type: object
    fields: {}
---
# Chapter
## 节点：Start
Body.
`);
    expect(story.ok).toBe(true);
    if (!story.ok) return;
    const exported = exportJSON(story.data);
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      expect(JSON.parse(exported.data).variables.bag.fields).toEqual({});
    }
  });

  it('requires a real chapter for chapter-scoped variables and blocks cross-chapter access', () => {
    const missing = parseStory(`---
vars:
  score:
    type: int
    scope: chapter
---
# One
## 节点：Start
Body.
`);
    expect(missing.ok).toBe(true);
    if (missing.ok) expect(missing.diagnostics.some((diagnostic) => diagnostic.code === 'E005')).toBe(true);

    const unknown = parseStory(`---
vars:
  score:
    type: int
    scope: chapter
    chapter: Missing
---
# One
## 节点：Start
Body.
`);
    expect(unknown.ok).toBe(true);
    if (unknown.ok) expect(unknown.diagnostics.some((diagnostic) => diagnostic.code === 'E005')).toBe(true);

    const inaccessible = parseStory(`---
vars:
  score:
    type: int
    scope: chapter
    chapter: One
---
# One
## 节点：Start
Body.
# Two
## 节点：Other
Body.
[选项] Continue
  条件: $score >= 1
`);
    expect(inaccessible.ok).toBe(true);
    if (inaccessible.ok) {
      const diagnostics = validateAll(inaccessible.data).diagnostics;
      expect(diagnostics.some((diagnostic) => (
        diagnostic.code === 'E002' && diagnostic.detail?.includes('仅可在章节')
      ))).toBe(true);
    }
  });
});
