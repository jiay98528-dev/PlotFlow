import { describe, expect, it } from 'vitest';

import { exportJSON } from '../exporter/json.js';
import { parseStory } from '../parser/parser.js';
import { checkUndefinedTargetNode } from '../validator/validator.js';

function parse(source: string) {
  const result = parseStory(source);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('parseStory unexpectedly failed');
  return result.data;
}

describe('Option 跨章节目标合同', () => {
  it('无章节前缀时优先解析当前章节的同名节点', () => {
    const data = parse(`# 第一章

## 节点：入口

[选项] 继续 -> 节点：终点

## 节点：终点

第一章结局。

# 第二章

## 节点：终点

第二章结局。
`);

    const option = data.chapters[0]!.nodes[0]!.options[0]!;
    expect(option.targetChapterId).toBeNull();
    expect(option.targetNodeId).toBe('终点');
    expect(option.targetFullId).toBe('%E7%AC%AC%E4%B8%80%E7%AB%A0/%E7%BB%88%E7%82%B9');
  });

  it('显式章节前缀精确解析跨章节的同名节点', () => {
    const data = parse(`# 第一章

## 节点：终点

第一章结局。

# 第二章

## 节点：入口

[选项] 返回第一章 -> 第一章/节点：终点

## 节点：终点

第二章结局。
`);

    const option = data.chapters[1]!.nodes[0]!.options[0]!;
    expect(option.targetChapterId).toBe('第一章');
    expect(option.targetNodeId).toBe('终点');
    expect(option.targetFullId).toBe('%E7%AC%AC%E4%B8%80%E7%AB%A0/%E7%BB%88%E7%82%B9');
    expect(checkUndefinedTargetNode(data)).toEqual([]);
  });

  it('无前缀且全局存在多个同名候选时保持未解析并报告 E001', () => {
    const data = parse(`# 序章

## 节点：入口

[选项] 前往终点 -> 节点：终点

# 第一章

## 节点：终点

第一章结局。

# 第二章

## 节点：终点

第二章结局。
`);

    const option = data.chapters[0]!.nodes[0]!.options[0]!;
    expect(option.targetChapterId).toBeNull();
    expect(option.targetFullId).toBeNull();

    const diagnostics = checkUndefinedTargetNode(data);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('E001');
    expect(diagnostics[0]!.detail).toContain('同名节点');
    expect(diagnostics[0]!.detail).toContain('显式指定章节');
  });

  it('显式引用不存在的章节时不得回退到其他章节的同名节点', () => {
    const data = parse(`# 序章

## 节点：入口

[选项] 前往终点 -> 不存在的章节/节点：终点

# 第一章

## 节点：终点

真实结局。
`);

    const option = data.chapters[0]!.nodes[0]!.options[0]!;
    expect(option.targetChapterId).toBe('不存在的章节');
    expect(option.targetFullId).toBeNull();

    const diagnostics = checkUndefinedTargetNode(data);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]!.code).toBe('E001');
    expect(diagnostics[0]!.detail).toContain('%E4%B8%8D%E5%AD%98%E5%9C%A8%E7%9A%84%E7%AB%A0%E8%8A%82/%E7%BB%88%E7%82%B9');
  });

  it('显式跨章节引用 parse→export 保留目标章节合同', () => {
    const data = parse(`# 第一章

## 节点：入口

[选项] 去结局 -> 第二章/节点：结局

# 第二章

## 节点：结局

故事结束。
`);
    const exportResult = exportJSON(data);
    expect(exportResult.ok).toBe(true);
    if (!exportResult.ok) throw new Error('exportJSON unexpectedly failed');

    const json = JSON.parse(exportResult.data) as {
      chapters: Array<{
        nodes: Array<{
          options: Array<Record<string, unknown>>;
        }>;
      }>;
    };
    const option = json.chapters[0]!.nodes[0]!.options[0]!;

    expect(option['targetNodeId']).toBe('结局');
    expect(option['targetChapterId']).toBe('第二章');
    expect(option['targetFullId']).toBe('%E7%AC%AC%E4%BA%8C%E7%AB%A0/%E7%BB%93%E5%B1%80');
  });
});
