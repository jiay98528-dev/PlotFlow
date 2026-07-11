import { describe, expect, it } from 'vitest';
import { parseStory, type PlotFlowData } from '@plotflow/core';
import { updateMetaText, updateNodePositionText } from './graphEditService';

const NODE = '\u8282\u70b9';
const OPTION = '\u9009\u9879';

const CRLF_STORY = [
  '---',
  'plotflow: 0.1',
  'author: QA',
  '---',
  '',
  '# Chapter',
  '',
  `## ${NODE}\uFF1AStart`,
  'Body',
  `[${OPTION}] Go -> ${NODE}\uFF1AEnd`,
  '',
  `## ${NODE}\uFF1AEnd`,
  'Done',
  '',
].join('\r\n');

function parse(content: string): PlotFlowData {
  const result = parseStory(content);
  if (!result.ok) {
    throw new Error(`parse failed: ${result.errors.map((error) => error.code).join(',')}`);
  }
  return result.data;
}

describe('graphEditService CRLF source edits', () => {
  it('preserves CRLF newline style when editing frontmatter-backed data', () => {
    const node = parse(CRLF_STORY).chapters[0]!.nodes[0]!;

    const positioned = updateNodePositionText(CRLF_STORY, node, { x: 40, y: 80 });
    const withMeta = updateMetaText(positioned.content, 'author', 'CRLF QA');

    expect(withMeta.content).toContain('\r\n');
    expect(withMeta.content).not.toContain('\r\n\n');
    expect(withMeta.content.split('\r\n').length).toBeGreaterThan(5);
    expect(parse(withMeta.content).meta.author).toBe('CRLF QA');
    expect(parse(withMeta.content).chapters[0]!.nodes[0]!.position).toEqual({ x: 40, y: 80 });
  });
});
