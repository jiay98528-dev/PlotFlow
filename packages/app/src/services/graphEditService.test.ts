import { describe, expect, it } from 'vitest';
import { createFullId, parseStory, validateAll, type PlotFlowData, type StoryNode } from '@plotflow/core';
import { BUILTIN_TEMPLATES } from '../templates/builtinTemplates';
import {
  addOptionText,
  createNodeAndConnectText,
  createNodeAndConnectNextText,
  createNodeText,
  deleteOptionText,
  deleteNodeText,
  deleteVariableText,
  migrateGraphLayoutNodeText,
  removeGraphLayoutNodesText,
  reorderOptionText,
  updateMetaText,
  updateNodeNextTargetText,
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

const RPG_STORY = BUILTIN_TEMPLATES.find((template) => template.id === 'rpg-dialogue')?.content ?? '';

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

  it('renames incoming option targets when renaming a referenced node', () => {
    const forest = findNode(BASE_STORY, '森林');
    const result = updateNodeText(BASE_STORY, forest, { title: '深林营地' });

    expect(result.content).toContain('## 节点：深林营地');
    expect(result.content).toContain('[选项] 去森林 -> 节点：深林营地');
    expect(result.content).not.toContain('-> 节点：森林');

    const validation = validateAll(parse(result.content));
    expect(validation.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain('E001');
  });

  it('renames only full-id-matched option and next targets across chapters', () => {
    const story = [
      '---',
      'plotflow: 0.1',
      '---',
      '',
      '# 第一章',
      '',
      '## 节点：入口',
      '[选项] 第一章结局 -> 第一章/节点：终点',
      '',
      '## 节点：自动路线',
      '下一步: 第一章/节点：终点',
      '',
      '## 节点：终点',
      '第一章结束。',
      '',
      '# 第二章',
      '',
      '## 节点：入口',
      '[选项] 第二章结局 -> 节点：终点',
      '',
      '## 节点：终点',
      '第二章结束。',
      '',
    ].join('\n');
    const firstEnding = parse(story).chapters[0]!.nodes.find((node) => node.title === '终点')!;
    const renamed = updateNodeText(story, firstEnding, { title: '真终点' });

    expect(renamed.content).toContain('[选项] 第一章结局 -> 第一章/节点：真终点');
    expect(renamed.content).toContain('下一步: 第一章/节点：真终点');
    expect(renamed.content).toContain('[选项] 第二章结局 -> 节点：终点');

    const data = parse(renamed.content);
    expect(data.chapters[0]!.nodes[0]!.options[0]!.targetFullId).toBe(createFullId('第一章', '真终点'));
    expect(data.chapters[0]!.nodes[1]!.nextTarget?.targetFullId).toBe(createFullId('第一章', '真终点'));
    expect(data.chapters[1]!.nodes[0]!.options[0]!.targetFullId).toBe(createFullId('第二章', '终点'));
  });

  it('adds, edits, reorders and deletes options through source text patches', () => {
    const node = findNode(BASE_STORY, '森林');
    const added = addOptionText(BASE_STORY, node, {
      description: '回到村口',
      targetNodeId: '村口',
      targetChapterId: null,
      conditionRaw: '金币 >= 1',
      effectsRaw: '金币 -1',
    });
    expect(added.content).toContain('[选项] 回到村口 -> 节点：村口\n  条件: 金币 >= 1\n  效果: 金币 -1');
    const addedOption = findNode(added.content, '森林').options[0]!;
    expect(addedOption.conditionRaw).toBe('金币 >= 1');
    expect(addedOption.effectsRaw).toBe('金币 -1');

    const editedNode = findNode(added.content, '森林');
    const editedOption = editedNode.options[0]!;
    const edited = updateOptionText(added.content, editedOption, {
      description: '谨慎返回',
      conditionRaw: null,
      effectsRaw: null,
    });
    expect(edited.content).toContain('[选项] 谨慎返回 -> 节点：村口');
    expect(edited.content).not.toContain('条件: 金币 >= 1');
    expect(edited.content).not.toContain('效果: 金币 -1');

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
    expect(result.content).toContain(`      - id: ${JSON.stringify(createFullId('第一章', '井边'))}`);
    expect(result.content).toContain('        x: 320');
    expect(result.content).toContain('        y: 180');
    expect(findNode(result.content, '井边').title).toBe('井边');
    expect(findNode(result.content, '井边').position).toEqual({ x: 320, y: 180 });
  });

  it('writes and clears node-level next target flow exits', () => {
    const story = [
      '---',
      'plotflow: 0.1',
      '---',
      '',
      '# Chapter',
      '',
      '## \u8282\u70b9\uff1aA',
      'Body.',
      '',
      '## \u8282\u70b9\uff1aB',
      'Done.',
      '',
    ].join('\n');
    const node = findNode(story, 'A');
    const connected = updateNodeNextTargetText(story, node, 'B');

    expect(connected.changed).toBe(true);
    expect(connected.content).toContain('\u4e0b\u4e00\u6b65: \u8282\u70b9\uff1aB');
    expect(findNode(connected.content, 'A').nextTarget?.targetNodeId).toBe('B');

    const created = createNodeAndConnectNextText(story, node, 'C', { x: 160, y: 80 });
    expect(created.content).toContain('## \u8282\u70b9\uff1aC');
    expect(findNode(created.content, 'A').nextTarget?.targetNodeId).toBe('C');
    expect(findNode(created.content, 'C').position).toEqual({ x: 160, y: 80 });

    const cleared = updateNodeNextTargetText(connected.content, findNode(connected.content, 'A'), null);
    expect(cleared.content).not.toContain('\u4e0b\u4e00\u6b65:');
    expect(findNode(cleared.content, 'A').nextTarget).toBeNull();
  });

  it('writes cross-chapter next targets and preserves adjacent effects', () => {
    const story = [
      '---',
      'plotflow: 0.1',
      'vars:',
      '  coins: int',
      '---',
      '',
      '# Chapter One',
      '',
      '## 节点：A',
      'Body.',
      '',
      '# Chapter Two',
      '',
      '## 节点：B',
      'Done.',
      '',
    ].join('\n');
    const node = findNode(story, 'A');
    const connected = updateNodeNextTargetText(story, node, 'B', 'coins+1', 'Chapter Two');

    expect(connected.content).toContain('下一步: Chapter Two/节点：B\n  效果: coins+1');
    const parsed = findNode(connected.content, 'A');
    expect(parsed.nextTarget?.targetChapterId).toBe('Chapter Two');
    expect(parsed.nextTarget?.targetFullId).toBe(createFullId('Chapter Two', 'B'));
    expect(parsed.nextTarget?.effectsRaw).toBe('coins+1');

    const bodyUpdated = updateNodeText(connected.content, parsed, { body: 'Updated body.' });
    expect(bodyUpdated.content).toContain('下一步: Chapter Two/节点：B\n  效果: coins+1');
    expect(findNode(bodyUpdated.content, 'A').nextTarget?.effectsRaw).toBe('coins+1');
  });

  it('updates frontmatter meta and writes variables using supported vars syntax', () => {
    const withMeta = updateMetaText(BASE_STORY, 'author', '叙事组');
    const withEngine = updateMetaText(withMeta.content, 'engine', 'godot');
    const withVariable = upsertVariableText(withEngine.content, {
      name: '声望',
      type: 'float',
      defaultValue: 2.5,
      scope: 'chapter',
      chapterId: '第一章',
      description: '本章声望',
    });
    const data = parse(withVariable.content);

    expect(data.meta.author).toBe('叙事组');
    expect(data.meta.engine).toBe('godot');
    expect(data.meta.plotflow).toBe('0.1');
    expect(withVariable.content).toContain('vars:');
    expect(withVariable.content).toContain('  声望:\n    type: float\n    default: 2.5\n    scope: chapter\n    chapter: "第一章"\n    description: "本章声望"');
    expect(data.variables.find((variable) => variable.name === '声望')).toMatchObject({
      type: 'float',
      defaultValue: 2.5,
      scope: 'chapter',
      chapterId: '第一章',
      description: '本章声望',
    });
  });

  it('quotes every YAML-sensitive meta scalar, including quotes, newlines and empty strings', () => {
    const specialTitle = 'A: #B "quoted"\nsecond line';
    const withTitle = updateMetaText(BASE_STORY, 'title', specialTitle);
    const withAuthor = updateMetaText(withTitle.content, 'author', '');
    const data = parse(withAuthor.content);

    expect(withAuthor.content).toContain(`title: ${JSON.stringify(specialTitle)}`);
    expect(withAuthor.content).toContain('author: ""');
    expect(data.meta.title).toBe(specialTitle);
    expect(data.meta.author).toBe('');
  });

  it('round-trips enum and three-level object variable declarations', () => {
    const withEnum = upsertVariableText(BASE_STORY, {
      name: '职业',
      type: 'enum',
      enumValues: ['战士', '法师', '盗贼'],
    });
    const withObject = upsertVariableText(withEnum.content, {
      name: '装备',
      type: 'object',
      fields: [
        { name: '武器', type: 'enum', enumValues: ['剑', '弓'] },
        {
          name: '状态',
          type: 'object',
          fields: [
            { name: '生命', type: 'int' },
            {
              name: '增益',
              type: 'object',
              fields: [{ name: '火焰', type: 'bool' }],
            },
          ],
        },
      ],
    });

    expect(withObject.content).toContain('  职业:\n    type: enum\n    values: ["战士","法师","盗贼"]');
    expect(withObject.content).toContain('  装备:\n    type: object');
    expect(withObject.content).toContain('    fields:\n      武器:\n        type: enum');
    expect(withObject.content).toContain('      状态:\n        type: object');

    const data = parse(withObject.content);
    const role = data.variables.find((variable) => variable.name === '职业');
    const equipment = data.variables.find((variable) => variable.name === '装备');
    expect(role?.enumValues).toEqual(['战士', '法师', '盗贼']);
    expect(equipment?.fields?.find((field) => field.name === '武器')?.enumValues).toEqual(['剑', '弓']);
    expect(equipment?.fields?.find((field) => field.name === '状态')?.fields
      ?.find((field) => field.name === '增益')?.fields?.[0]).toMatchObject({ name: '火焰', type: 'bool' });

    const replaced = upsertVariableText(withObject.content, { name: '装备', type: 'string' });
    expect(replaced.content).not.toContain('      状态:');
    expect(parse(replaced.content).variables.find((variable) => variable.name === '装备')?.type).toBe('string');

    const deleted = deleteVariableText(withObject.content, '装备');
    expect(deleted.content).not.toContain('  装备:');
    expect(parse(deleted.content).variables.some((variable) => variable.name === '装备')).toBe(false);
  });

  it('deletes a variable from supported vars syntax', () => {
    const story = [
      '---',
      'plotflow: 0.1',
      'vars:',
      '  score: int',
      '---',
      '',
      '# Chapter',
      '',
      '## \u8282\u70b9\uff1aA',
      'Body.',
      '',
    ].join('\n');
    const deleted = deleteVariableText(story, 'score');

    expect(deleted.changed).toBe(true);
    expect(deleted.content).not.toContain('score: int');
    expect(parse(deleted.content).variables).toHaveLength(0);
  });

  it('upserts, migrates and removes Graph Lab layout nodes in frontmatter', () => {
    const village = findNode(BASE_STORY, '村口');
    const positioned = updateNodePositionText(BASE_STORY, village, { x: 123.4, y: 88.6 });

    expect(positioned.content).toContain('layout:');
    expect(positioned.content.indexOf('layout:')).toBeLessThan(positioned.content.indexOf('vars:'));
    expect(positioned.content).toContain(`      - id: ${JSON.stringify(createFullId('第一章', '村口'))}`);
    expect(positioned.content).toContain('        x: 123');
    expect(positioned.content).toContain('        y: 89');
    expect(findNode(positioned.content, '村口').position).toEqual({ x: 123, y: 89 });

    const villageId = createFullId('第一章', '村口');
    const squareId = createFullId('第一章', '村口广场');
    const migrated = migrateGraphLayoutNodeText(positioned.content, villageId, squareId);
    expect(migrated.content).not.toContain(`      - id: ${JSON.stringify(villageId)}`);
    expect(migrated.content).toContain(`      - id: ${JSON.stringify(squareId)}`);

    const removed = removeGraphLayoutNodesText(migrated.content, [squareId]);
    expect(removed.content).not.toContain('layout:');
  });

  it('cleans layout entries when deleting or renaming nodes', () => {
    const withLayout = upsertGraphLayoutText(BASE_STORY, [
      { id: '第一章-村口', position: { x: 10, y: 20 } },
      { id: '第一章-森林', position: { x: 220, y: 30 } },
    ]).content;

    const village = findNode(withLayout, '村口');
    const renamed = updateNodeText(withLayout, village, { title: '村口广场' });
    expect(renamed.content).toContain(`      - id: ${JSON.stringify(createFullId('第一章', '村口广场'))}`);
    expect(renamed.content).not.toContain(`      - id: ${JSON.stringify(createFullId('第一章', '村口'))}`);

    const forest = findNode(renamed.content, '森林');
    const deleted = deleteNodeText(renamed.content, forest);
    expect(deleted.content).not.toContain(`      - id: ${JSON.stringify(createFullId('第一章', '森林'))}`);
    expect(deleted.content).toContain(`      - id: ${JSON.stringify(createFullId('第一章', '村口广场'))}`);
  });

  it('deletes a node from the RPG dialogue template by parsed line range', () => {
    const guard = findNode(RPG_STORY, '守卫盘问');
    const deleted = deleteNodeText(RPG_STORY, guard);

    expect(deleted.changed).toBe(true);
    expect(deleted.content).not.toContain('## 节点：守卫盘问');
    expect(findNode(deleted.content, '侧门').title).toBe('侧门');
  });
});
