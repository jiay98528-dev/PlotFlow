import { describe, expect, it } from 'vitest';
import { appT } from '../../i18n/appI18n';
import { buildNodeRouteSummaries } from './nodeRouteSummary';
import { parseStory, type StoryNode } from '@plotflow/core';

const text = (key: string, params?: Readonly<Record<string, string | number>>): string =>
  appT(key, params, 'zh-CN');

function parseNodes(content: string): StoryNode[] {
  const result = parseStory(content);
  if (!result.ok) {
    throw new Error(`parse failed: ${result.errors.map((error) => error.code).join(',')}`);
  }
  return result.data.chapters.flatMap((chapter) => chapter.nodes);
}

describe('buildNodeRouteSummaries', () => {
  it('summarizes option requirements, target previews, and effects', () => {
    const nodes = parseNodes([
      '---',
      'plotflow: 0.1',
      'vars:',
      '  金币: int',
      '  日志: string',
      '  声望: float',
      '---',
      '',
      '# 第一章',
      '',
      '## 节点：起点',
      '',
      '[选项] 进入商店 -> 节点：商店',
      '  条件: 金币 >= 1',
      '  效果: 金币-1, 日志←"发现脚印", 声望+1',
      '',
      '## 节点：商店',
      '',
      '欢迎。',
      '',
    ].join('\n'));

    const summaries = buildNodeRouteSummaries(nodes[0], nodes, text);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: 'option-0',
      kind: 'option',
      optionIndex: 0,
      sourceHandleId: 'option-0',
      label: '进入商店',
      requirementLabel: '需 金币 >= 1',
      targetLabel: '→ 商店',
      targetState: 'linked',
      isConditional: true,
      hasEffects: true,
    });
    expect(summaries[0]?.effectsLabel).toContain('金币 -1');
    expect(summaries[0]?.effectsLabel).toContain('日志←"发现脚印"');
    expect(summaries[0]?.effectsLabel).toContain('+1');
  });

  it('summarizes complex conditions by referenced variables', () => {
    const nodes = parseNodes([
      '---',
      'plotflow: 0.1',
      'vars:',
      '  金币: int',
      '  钥匙: bool',
      '---',
      '',
      '# 第一章',
      '',
      '## 节点：起点',
      '',
      '[选项] 开门 -> 节点：门后',
      '  条件: (金币 >= 1) AND (钥匙 == true)',
      '',
      '## 节点：门后',
      '',
      'Done.',
      '',
    ].join('\n'));

    const summaries = buildNodeRouteSummaries(nodes[0], nodes, text);

    expect(summaries[0]?.requirementLabel).toContain('复杂条件');
    expect(summaries[0]?.requirementLabel).toContain('金币');
    expect(summaries[0]?.requirementLabel).toContain('钥匙');
  });

  it('falls back to raw complex labels when a condition is not parsed', () => {
    const nodes = parseNodes([
      '# 第一章',
      '',
      '## 节点：起点',
      '',
      '[选项] 试探',
      '',
    ].join('\n'));
    const option = nodes[0]!.options[0]!;
    const patchedNode: StoryNode = {
      ...nodes[0]!,
      options: [{
        ...option,
        condition: null,
        conditionRaw: '金币 @ 1',
      }],
    };

    const summaries = buildNodeRouteSummaries(patchedNode, nodes, text);

    expect(summaries[0]?.requirementLabel).toContain('复杂条件');
    expect(summaries[0]?.requirementLabel).toContain('金币');
    expect(summaries[0]?.requirementTitle).toBe('金币 @ 1');
  });

  it('summarizes node-level next targets', () => {
    const nodes = parseNodes([
      '---',
      'plotflow: 0.1',
      'vars:',
      '  coins: int',
      '---',
      '',
      '# Chapter',
      '',
      '## 节点：A',
      '',
      '下一步: 节点：B',
      '  效果: coins+1',
      '',
      '## 节点：B',
      '',
      'Done.',
      '',
    ].join('\n'));

    const summaries = buildNodeRouteSummaries(nodes[0], nodes, text);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      id: 'next',
      kind: 'next',
      optionIndex: null,
      sourceHandleId: 'next',
      label: '下一步',
      requirementLabel: '无条件',
      targetLabel: '→ B',
      targetState: 'linked',
      hasEffects: true,
    });
    expect(summaries[0]?.effectsLabel).toContain('coins +1');
  });
});
