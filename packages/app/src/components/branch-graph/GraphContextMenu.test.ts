import { describe, expect, it } from 'vitest';
import type { StoryNode } from '@plotflow/core';
import { contextLayerReducer } from './GraphContextMenu';

describe('GraphContextMenu context layer state machine', () => {
  it('moves through menu and dialog without an intermediate closed state', () => {
    const node = { fullId: 'chapter/node', title: 'Node' } as StoryNode;
    const menu = contextLayerReducer({ kind: 'closed' }, { type: 'open' });
    expect(menu).toEqual({ kind: 'menu', activeIndex: 0 });

    const rename = contextLayerReducer(menu, { type: 'rename', node });
    expect(rename).toEqual({ kind: 'renameDialog', node });

    expect(contextLayerReducer(rename, { type: 'close' })).toEqual({ kind: 'closed' });
  });

  it('keeps one roving menu item index in reducer state', () => {
    const menu = contextLayerReducer({ kind: 'closed' }, { type: 'open', activeIndex: 1 });
    expect(contextLayerReducer(menu, { type: 'focus', activeIndex: 3 }))
      .toEqual({ kind: 'menu', activeIndex: 3 });
  });
});
