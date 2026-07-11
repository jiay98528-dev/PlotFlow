import { describe, expect, it } from 'vitest';
import { getMainProcessMessages } from './mainProcessI18n';

describe('main-process localization', () => {
  it('returns Chinese confirmation and system-open copy', () => {
    const text = getMainProcessMessages('zh-CN');
    expect(text.rendererCrashButtons).toEqual(['重新加载', '关闭']);
    expect(text.unsavedButtons).toEqual(['保存', '不保存', '取消']);
    expect(text.unsavedDetail('C:/stories/demo.mdstory')).toContain('C:/stories/demo.mdstory');
    expect(text.systemOpenFailedDetail('C:/missing.mdstory', 'ENOENT')).toContain('ENOENT');
  });

  it('returns English confirmation and system-open copy', () => {
    const text = getMainProcessMessages('en-US');
    expect(text.rendererCrashButtons).toEqual(['Reload', 'Close']);
    expect(text.unsavedButtons).toEqual(['Save', "Don't Save", 'Cancel']);
    expect(text.unsavedDetail(null)).toContain('untitled');
    expect(text.systemOpenFailedDetail('C:/missing.mdstory', 'ENOENT')).toContain('C:/missing.mdstory');
  });
});

