import { describe, expect, it } from 'vitest';
import { analyzeStorySource } from '../../parser/source.js';
import { parseStory } from '../../parser/parser.js';

describe('analyzeStorySource', () => {
  it('uses one frontmatter boundary for parser and edit layers', () => {
    const raw = [
      '---',
      'plotflow: 0.1',
      'title: Boundary',
      '---',
      '',
      '# 第一章',
      '',
      '## 节点：开始',
      '正文里的水平线应保留。',
      '---',
      '仍是正文。',
      '',
    ].join('\n');

    const source = analyzeStorySource(raw);

    expect(source.frontmatter).toMatchObject({
      startLine: 1,
      endLine: 4,
      contentStartLine: 2,
      contentEndLine: 3,
    });
    expect(source.bodyStartLine).toBe(5);
    expect(raw.slice(source.bodyStartOffset)).toContain('正文里的水平线应保留');

    const result = parseStory(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.chapters[0]?.nodes[0]?.body).toContain('仍是正文');
    }
  });

  it('detects CRLF as the dominant newline style', () => {
    const raw = '---\r\nplotflow: 0.1\r\n---\r\n# 第一章\r\n';
    const source = analyzeStorySource(raw);

    expect(source.newline).toBe('\r\n');
    expect(source.frontmatter?.content).toBe('plotflow: 0.1');
    expect(source.bodyStartLine).toBe(4);
  });

  it('does not treat indented fences as frontmatter delimiters', () => {
    const raw = [
      '---',
      'title: Block Scalar',
      'note: |',
      '  ---',
      '  body marker',
      '---',
      '# 第一章',
    ].join('\n');

    const source = analyzeStorySource(raw);

    expect(source.frontmatter?.endLine).toBe(6);
    expect(source.frontmatter?.content).toContain('  ---');
  });

  it('returns layout, chapter, node and option source ranges', () => {
    const raw = [
      '---',
      'plotflow: 0.1',
      'layout:',
      '  graph:',
      '    version: 1',
      '---',
      '',
      '# 第一章',
      '',
      '## 节点：开始',
      '正文',
      '[选项] 继续 -> 节点：结束',
      '  条件: $金币 >= 1',
      '  效果: 金币 -1',
      '',
      '## 节点：结束',
      '完',
    ].join('\n');

    const source = analyzeStorySource(raw);
    const chapter = source.chapters[0]!;
    const node = chapter.nodes[0]!;
    const option = node.options[0]!;

    expect(source.layout).toMatchObject({ startLine: 3, endLine: 5 });
    expect(chapter.title).toBe('第一章');
    expect(chapter.titleRange).toMatchObject({ startLine: 8 });
    expect(node.title).toBe('开始');
    expect(node.fullId).toBe('%E7%AC%AC%E4%B8%80%E7%AB%A0/%E5%BC%80%E5%A7%8B');
    expect(node.titleRange).toMatchObject({ startLine: 10 });
    expect(option.descriptionRange).toMatchObject({ startLine: 12 });
    expect(option.targetRange).toMatchObject({ startLine: 12 });
    expect(option.conditionRange).toMatchObject({ startLine: 13 });
    expect(option.effectsRange).toMatchObject({ startLine: 14 });
    expect(raw.slice(option.conditionRange!.startOffset, option.conditionRange!.endOffset)).toBe('$金币 >= 1');
  });

  it('reports additional frontmatter-like documents explicitly', () => {
    const raw = [
      '---',
      'plotflow: 0.1',
      '---',
      '# 第一章',
      '---',
      'title: second',
      '---',
    ].join('\n');

    const source = analyzeStorySource(raw);

    expect(source.frontmatterDocuments).toHaveLength(2);
    expect(source.diagnostics).toEqual([
      expect.objectContaining({
        code: 'FRONTMATTER_MULTIPLE_DOCUMENTS',
        range: expect.objectContaining({ startLine: 5, endLine: 7 }),
      }),
    ]);
  });

  it('keeps the next chapter heading outside the current chapter source range', () => {
    const raw = [
      '# 第一章',
      '',
      '## 节点：起点',
      '',
      '第一章正文。',
      '',
      '# 第二章',
      '',
      '## 节点：终点',
      '',
      '第二章正文。',
      '',
    ].join('\n');

    const source = analyzeStorySource(raw);
    const firstChapter = source.chapters[0]!;
    const firstSlice = raw.slice(firstChapter.startOffset, firstChapter.endOffset);

    expect(firstSlice).toContain('第一章正文。');
    expect(firstSlice).not.toContain('# 第二章');
    expect(raw.slice(firstChapter.endOffset).startsWith('\n# 第二章')).toBe(true);
  });

  it('keeps CRLF chapter separators outside the editable chapter source range', () => {
    const raw = [
      '# 第一章',
      '',
      '## 节点：起点',
      '',
      '第一章正文。',
      '',
      '# 第二章',
      '',
      '## 节点：终点',
      '',
      '第二章正文。',
      '',
    ].join('\r\n');

    const source = analyzeStorySource(raw);
    const firstChapter = source.chapters[0]!;
    const nextContent = `${raw.slice(0, firstChapter.startOffset)}${raw
      .slice(firstChapter.startOffset, firstChapter.endOffset)
      .replace('第一章正文。', '第一章正文更新。')}${raw.slice(firstChapter.endOffset)}`;

    expect(raw.slice(firstChapter.endOffset).startsWith('\r\n# 第二章')).toBe(true);
    expect(analyzeStorySource(nextContent).chapters.map((chapter) => chapter.title)).toEqual(['第一章', '第二章']);
    expect(nextContent).toContain('\r\n# 第二章\r\n');
  });

  it('does not consume the next chapter after replacing an empty chapter slice', () => {
    const raw = [
      '# 第一章',
      '',
      '',
      '# 第二章',
      '',
      '## 节点：终点',
      '',
      '第二章正文。',
      '',
    ].join('\n');

    const source = analyzeStorySource(raw);
    const firstChapter = source.chapters[0]!;
    const nextContent = `${raw.slice(0, firstChapter.startOffset)}# 第一章\n\n## 节点：新增\n\n新增正文。\n${raw.slice(firstChapter.endOffset)}`;
    const nextSource = analyzeStorySource(nextContent);

    expect(raw.slice(firstChapter.endOffset).startsWith('\n\n# 第二章')).toBe(true);
    expect(nextSource.chapters.map((chapter) => chapter.title)).toEqual(['第一章', '第二章']);
    expect(nextContent).toContain('\n# 第二章\n\n## 节点：终点');
  });

  it('round-trips the last chapter source range without changing chapter count', () => {
    const raw = [
      '# 第一章',
      '',
      '## 节点：起点',
      '',
      '第一章正文。',
      '',
      '# 第二章',
      '',
      '## 节点：终点',
      '',
      '第二章正文。',
      '',
      '',
    ].join('\n');

    const source = analyzeStorySource(raw);
    const lastChapter = source.chapters[1]!;
    const nextContent = `${raw.slice(0, lastChapter.startOffset)}${raw
      .slice(lastChapter.startOffset, lastChapter.endOffset)
      .replace('第二章正文。', '第二章正文更新。')}${raw.slice(lastChapter.endOffset)}`;
    const nextSource = analyzeStorySource(nextContent);

    expect(nextSource.chapters).toHaveLength(2);
    expect(nextSource.chapters[1]?.title).toBe('第二章');
    expect(nextContent.endsWith('\n\n')).toBe(true);
  });
});
