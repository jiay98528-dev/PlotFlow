import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRecentStory,
  readRecentStory,
  rememberOpenedStory,
  rememberRecentStory,
} from './recentFileService';

let storage: Map<string, string>;

function installLocalStorage(): Map<string, string> {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => {
          values.delete(key);
        },
        setItem: (key: string, value: string) => {
          values.set(key, value);
        },
      },
    },
  });
  return values;
}

describe('recentFileService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-06T00:00:00.000Z'));
    storage = installLocalStorage();
  });

  it('persists the latest mdstory path with hash metadata', () => {
    rememberRecentStory('D:\\Stories\\Demo.mdstory', 'hash-1', 123);

    expect(readRecentStory()).toEqual({
      filePath: 'D:/Stories/Demo.mdstory',
      hash: 'hash-1',
      modifiedAt: 123,
      savedAt: Date.parse('2026-07-06T00:00:00.000Z'),
    });
  });

  it('ignores unsupported extensions and clears persisted state', () => {
    rememberRecentStory('D:/Stories/Demo.txt', 'hash-1', 123);
    expect(readRecentStory()).toBeNull();

    rememberOpenedStory({
      filePath: 'D:/Stories/Demo.mdstory',
      content: '# Chapter',
      hash: 'hash-2',
      modifiedAt: 456,
    });
    expect(readRecentStory()?.hash).toBe('hash-2');

    clearRecentStory();
    expect(readRecentStory()).toBeNull();
  });

  it('clears malformed or invalid persisted recent records', () => {
    storage.set('plotflow:recent-story', '{bad-json');
    expect(readRecentStory()).toBeNull();
    expect(storage.has('plotflow:recent-story')).toBe(false);

    storage.set('plotflow:recent-story', JSON.stringify({
      filePath: 'D:/Stories/Demo.txt',
      hash: 'hash-3',
      modifiedAt: 1,
      savedAt: 2,
    }));
    expect(readRecentStory()).toBeNull();
    expect(storage.has('plotflow:recent-story')).toBe(false);
  });
});
