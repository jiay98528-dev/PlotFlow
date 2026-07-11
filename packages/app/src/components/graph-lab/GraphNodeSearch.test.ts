import { describe, expect, it } from 'vitest';
import { parseStory } from '@plotflow/core';
import { findGraphNodeMatches } from './GraphNodeSearch';

const parsedStory = parseStory(`---
plotflow: 0.1
title: Search fixture
---

# 第一章
## 节点：Harbor
Quiet water and lanterns.

[选项] Enter the archive → 节点：Archive

## 节点：Archive
Dusty shelves.

## 节点：Garden
The harbor key is buried here.
`);

if (!parsedStory.ok) {
  throw new Error('Search fixture must parse successfully');
}

const nodes = parsedStory.data.chapters.flatMap((chapter) => chapter.nodes);

describe('findGraphNodeMatches', () => {
  it('ranks exact and title matches ahead of body matches', () => {
    expect(findGraphNodeMatches(nodes, 'harbor').map((node) => node.title)).toEqual([
      'Harbor',
      'Garden',
    ]);
  });

  it('matches node ids, body text, and option descriptions', () => {
    expect(findGraphNodeMatches(nodes, 'archive').map((node) => node.title)).toEqual([
      'Archive',
      'Harbor',
    ]);
    expect(findGraphNodeMatches(nodes, 'lanterns').map((node) => node.title)).toEqual(['Harbor']);
  });

  it('applies a stable result limit', () => {
    expect(findGraphNodeMatches(nodes, '', 2)).toHaveLength(2);
  });
});
