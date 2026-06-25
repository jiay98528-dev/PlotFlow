import { describe, expect, it } from 'vitest';
import { parseStory, type PlotFlowData, type StoryNode } from '@plotflow/core';
import {
  addOptionText,
  createNodeAndConnectText,
  createNodeText,
  deleteOptionText,
  deleteNodeText,
  migrateGraphLayoutNodeText,
  removeGraphLayoutNodesText,
  reorderOptionText,
  updateMetaText,
  updateNodeText,
  updateNodePositionText,
  updateOptionText,
  upsertGraphLayoutText,
  upsertVariableText,
} from './graphEditService';

const BASE_STORY = `---
plotflow: 0.1
title: 测试故事
author: QA
vars:
  金币: int
---

# 第一章

## 节点：村口

你站在村口。

[选项] 去森林 -> 节点：森林
[选项] 留下

## 节点：森林

树影很深。
`;

function parse(content: string): PlotFlowData {
  const result = parseStory(content);
  if (!result.ok) {
    throw new Error(`parse failed: ${result.errors.map((error) => error.code).join(',')}`);
  }
  return result.data;
}

function findNode(content: string, title: string): StoryNode {
  const data = parse(content);
  const node = data.chapters.flatMap((chapter) => chapter.nodes).find((candidate) => candidate.title === title);
  if (!node) throw new Error(`node not found: ${title}`);
  return node;
}

describe('graphEditService text commands', () => {
  it('creates a node in the requested chapter and keeps the result parseable', () => {
    const result = createNodeText(BASE_STORY, {
      chapterTitle: '第一章',
      title: '铁匠铺',
      body: '炉火还亮着。',
    });

    expect(result.changed).toBe(true);
    expect(result.content).toContain('## 节点：铁匠铺');
    expect(result.content).toContain('炉火还亮着。');
    expect(findNode(result.content, '铁匠铺').body).toBe('炉火还亮着。');
  });

  it('updates node title and body while preserving options', () => {
    const node = findNode(BASE_STORY, '村口');
    const result = updateNodeText(BASE_STORY, node, {
      title: '村口广场',
      body: '广场上有一口旧井。',
    });

    expect(result.content).toContain('## 节点：村口广场');
    expect(result.content).toContain('广场上有一口旧井。');
    expect(result.content).toContain('[选项] 去森林 -> 节点：森林');
    expect(findNode(result.content, '村口广场').options).toHaveLength(2);
  });

  it('adds, edits, reorders and deletes options through source text patches', () => {
    const node = findNode(BASE_STORY, '森林');
    const added = addOptionText(BASE_STORY, node, {
      description: '回到村口',
      targetNodeId: '村口',
      conditionRaw: '金币 >= 1',
      effectsRaw: '金币 -1',
    });
    expect(added.content).toContain('[选项] 回到村口 [条件：金币 >= 1] [效果：金币 -1] -> 节点：村口');

    const editedNode = findNode(added.content, '森林');
    const editedOption = editedNode.options[0]!;
    const edited = updateOptionText(added.content, editedOption, {
      description: '谨慎返回',
      conditionRaw: null,
      effectsRaw: null,
    });
    expect(edited.content).toContain('[选项] 谨慎返回 -> 节点：村口');

    const village = findNode(edited.content, '村口');
    const reordered = reorderOptionText(edited.content, village, 1, 0);
    const reorderedVillage = findNode(reordered.content, '村口');
    expect(reorderedVillage.options[0]?.description).toBe('留下');

    const deleted = deleteOptionText(reordered.content, reorderedVillage.options[0]!);
    expect(findNode(deleted.content, '村口').options.map((option) => option.description)).toEqual(['去森林']);
  });

  it('creates a blank-target node and connects the dragged option to it', () => {
    const node = findNode(BASE_STORY, '村口');
    const option = node.options[1]!;
    const result = createNodeAndConnectText(BASE_STORY, node, option, '井边', { x: 320, y: 180 });

    expect(result.content).toContain('## 节点：井边');
    expect(result.content).toContain('[选项] 留下 -> 节点：井边');
    expect(result.content).toContain('layout:');
    expect(result.content).toContain('      - id: "第一章-井边"');
    expect(result.content).toContain('        x: 320');
    expect(result.content).toContain('        y: 180');
    expect(findNode(result.content, '井边').title).toBe('井边');
    expect(findNode(result.content, '井边').position).toEqual({ x: 320, y: 180 });
  });

  it('updates frontmatter meta and writes variables using supported vars syntax', () => {
    const withMeta = updateMetaText(BASE_STORY, 'author', '叙事组');
    const withVariable = upsertVariableText(withMeta.content, {
      name: '声望',
      type: 'float',
    });
    const data = parse(withVariable.content);

    expect(data.meta.author).toBe('叙事组');
    expect(withVariable.content).toContain('vars:');
    expect(withVariable.content).toContain('  声望: float');
    expect(data.variables.some((variable) => variable.name === '声望' && variable.type === 'float')).toBe(true);
  });

  it('upserts, migrates and removes Graph Lab layout nodes in frontmatter', () => {
    const village = findNode(BASE_STORY, '村口');
    const positioned = updateNodePositionText(BASE_STORY, village, { x: 123.4, y: 88.6 });

    expect(positioned.content).toContain('layout:');
    expect(positioned.content.indexOf('layout:')).toBeLessThan(positioned.content.indexOf('vars:'));
    expect(positioned.content).toContain('      - id: "第一章-村口"');
    expect(positioned.content).toContain('        x: 123');
    expect(positioned.content).toContain('        y: 89');
    expect(findNode(positioned.content, '村口').position).toEqual({ x: 123, y: 89 });

    const migrated = migrateGraphLayoutNodeText(positioned.content, '第一章-村口', '第一章-村口广场');
    expect(migrated.content).not.toContain('      - id: "第一章-村口"');
    expect(migrated.content).toContain('      - id: "第一章-村口广场"');

    const removed = removeGraphLayoutNodesText(migrated.content, ['第一章-村口广场']);
    expect(removed.content).not.toContain('layout:');
  });

  it('cleans layout entries when deleting or renaming nodes', () => {
    const withLayout = upsertGraphLayoutText(BASE_STORY, [
      { id: '第一章-村口', position: { x: 10, y: 20 } },
      { id: '第一章-森林', position: { x: 220, y: 30 } },
    ]).content;

    const village = findNode(withLayout, '村口');
    const renamed = updateNodeText(withLayout, village, { title: '村口广场' });
    expect(renamed.content).toContain('      - id: "第一章-村口广场"');
    expect(renamed.content).not.toContain('      - id: "第一章-村口"');

    const forest = findNode(renamed.content, '森林');
    const deleted = deleteNodeText(renamed.content, forest);
    expect(deleted.content).not.toContain('      - id: "第一章-森林"');
    expect(deleted.content).toContain('      - id: "第一章-村口广场"');
  });
});
