import { describe, expect, it } from 'vitest';
import { parseStory } from '../parser/parser.js';
import { analyzeStorySource } from '../parser/source.js';
import { exportJSON } from '../exporter/json.js';
import { exportTXT } from '../exporter/txt.js';
import { validate } from '../validator/validator.js';

const NODE = '\u8282\u70b9';
const NEXT = '\u4e0b\u4e00\u6b65';
const EFFECTS = '\u6548\u679c';
const FULL_COLON = '\uff1a';

function parse(content: string) {
  const result = parseStory(content);
  if (!result.ok) {
    throw new Error(`parse failed: ${result.errors.map((error) => error.code).join(',')}`);
  }
  return result.data;
}

describe('node-level next target flow syntax', () => {
  it('parses next target and adjacent effects outside node body', () => {
    const data = parse([
      '---',
      'plotflow: 0.1',
      'vars:',
      '  coins: int',
      '---',
      '',
      '# Chapter',
      '',
      `## ${NODE}${FULL_COLON}A`,
      '',
      'Body text.',
      `${NEXT}: ${NODE}${FULL_COLON}B`,
      `  ${EFFECTS}: coins+1`,
      '',
      `## ${NODE}${FULL_COLON}B`,
      '',
      'Done.',
      '',
    ].join('\n'));

    const node = data.chapters[0]!.nodes[0]!;
    expect(node.body).toBe('Body text.');
    expect(node.options).toHaveLength(0);
    expect(node.nextTarget?.targetNodeId).toBe('B');
    expect(node.nextTarget?.targetFullId).toBe('Chapter-B');
    expect(node.nextTarget?.effectsRaw).toBe('coins+1');
    expect(node.nextTarget?.sideEffects[0]?.variableName).toBe('coins');
  });

  it('exposes source ranges and schema-compatible exports for next targets', () => {
    const source = [
      '# Chapter',
      '',
      `## ${NODE}${FULL_COLON}A`,
      '',
      `${NEXT}: ${NODE}${FULL_COLON}B`,
      '',
      `## ${NODE}${FULL_COLON}B`,
      '',
      'Done.',
      '',
    ].join('\n');
    const analysis = analyzeStorySource(source);
    expect(analysis.chapters[0]?.nodes[0]?.nextTarget?.targetRange.startLine).toBe(5);

    const exported = exportJSON(parse(source));
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const json = JSON.parse(exported.data) as {
      chapters: Array<{
        nodes: Array<{
          nextTarget?: unknown;
          options: Array<{ text: string; targetNodeId: string; targetFullId: string }>;
        }>;
      }>;
    };
    const exportedNode = json.chapters[0]!.nodes[0]!;
    expect(Object.prototype.hasOwnProperty.call(exportedNode, 'nextTarget')).toBe(false);
    expect(exportedNode.options[0]).toMatchObject({
      text: NEXT,
      targetNodeId: 'B',
      targetFullId: 'Chapter-B',
    });

    const txt = exportTXT(parse(source));
    expect(txt.ok).toBe(true);
    if (txt.ok) expect(txt.data).not.toContain('Next:');
  });

  it('keeps malformed next target text in body instead of swallowing adjacent effects', () => {
    const result = parseStory([
      '# Chapter',
      '',
      `## ${NODE}${FULL_COLON}A`,
      '',
      `${NEXT}: B`,
      `  ${EFFECTS}: coins+1`,
      '',
    ].join('\n'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const node = result.data.chapters[0]!.nodes[0]!;
    expect(node.nextTarget).toBeNull();
    expect(node.body).toContain(`${NEXT}: B`);
    expect(node.body).toContain(`${EFFECTS}: coins+1`);
  });

  it('warns on closed cycles and skips cycles with an exit', () => {
    const closed = validate(parse([
      '# Chapter',
      '',
      `## ${NODE}${FULL_COLON}A`,
      '',
      `${NEXT}: ${NODE}${FULL_COLON}B`,
      '',
      `## ${NODE}${FULL_COLON}B`,
      '',
      `${NEXT}: ${NODE}${FULL_COLON}A`,
      '',
    ].join('\n')));
    expect(closed.diagnostics.some((diagnostic) => diagnostic.code === 'W007')).toBe(true);

    const withExit = validate(parse([
      '# Chapter',
      '',
      `## ${NODE}${FULL_COLON}A`,
      '',
      `${NEXT}: ${NODE}${FULL_COLON}B`,
      '',
      `## ${NODE}${FULL_COLON}B`,
      '',
      `${NEXT}: ${NODE}${FULL_COLON}A`,
      `[\u9009\u9879] Leave -> ${NODE}${FULL_COLON}C`,
      '',
      `## ${NODE}${FULL_COLON}C`,
      '',
      'Done.',
      '',
    ].join('\n')));
    expect(withExit.diagnostics.some((diagnostic) => diagnostic.code === 'W007')).toBe(false);
  });
});
