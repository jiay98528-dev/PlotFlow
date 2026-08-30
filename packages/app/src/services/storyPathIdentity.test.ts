import { describe, expect, it } from 'vitest';
import { sameStoryPath } from './storyPathIdentity';

describe('sameStoryPath', () => {
  it('normalizes separators and Windows path casing', () => {
    expect(sameStoryPath('D:\\Stories\\Main.MDSTORY', 'd:/stories/main.mdstory', 'win32')).toBe(true);
  });

  it('keeps case-sensitive platforms distinct', () => {
    expect(sameStoryPath('/stories/Main.mdstory', '/stories/main.mdstory', 'linux')).toBe(false);
  });
});
