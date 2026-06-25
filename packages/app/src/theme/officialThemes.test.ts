import { describe, expect, it } from 'vitest';
import { DEFAULT_OFFICIAL_THEME_ID, normalizeOfficialThemeId } from './officialThemeIds';
import { listOfficialThemes } from './officialThemes';

describe('official theme definitions', () => {
  it('ships only the two official first-party themes', () => {
    const themes = listOfficialThemes();

    expect(themes.map((theme) => theme.id)).toEqual([
      'plotflow-narrative-workbench',
      'plotflow-blueprint-nightwatch',
    ]);
  });

  it('provides full production slots and recipes for every official theme', () => {
    for (const theme of listOfficialThemes()) {
      expect(theme.name['zh-CN']).toBeTruthy();
      expect(theme.name['en-US']).toBeTruthy();
      expect(theme.tokens.shared).toBeTruthy();
      expect(theme.monacoTheme.light ?? theme.monacoTheme.dark).toBeTruthy();
      expect(theme.layoutRecipe.graphLab?.nodeCardStyle).toBeTruthy();
      expect(theme.entryRecipe.graphLabDefaultEntry).toBeTruthy();
      expect(theme.interactionRecipe.realtimeWirePreview).toBe(true);
      expect(theme.motionRecipe.intensity).toBeTruthy();
      expect(theme.assets.preview).toBeTruthy();
      expect(theme.storeMeta.storeUrl).toContain('/themes');
      expect(theme.slots.StoryNodeCard).toBeTypeOf('function');
      expect(theme.slots.StoryEdge).toBeTypeOf('function');
      expect(theme.slots.ThemePreview).toBeTypeOf('function');
      expect(theme.slots.HomePreview).toBeTypeOf('function');
      expect(theme.slots.StoryNodeCard.displayName).toContain('OfficialGraphNode');
      expect(theme.slots.StoryEdge.displayName).toContain('OfficialGraphEdge');
    }
  });

  it('migrates legacy theme-pack ids to the official default', () => {
    expect(normalizeOfficialThemeId('plotflow-narrative-whiteboard')).toBe(DEFAULT_OFFICIAL_THEME_ID);
    expect(normalizeOfficialThemeId('unknown-local-theme')).toBe(DEFAULT_OFFICIAL_THEME_ID);
    expect(normalizeOfficialThemeId('plotflow-blueprint-nightwatch')).toBe('plotflow-blueprint-nightwatch');
  });
});
