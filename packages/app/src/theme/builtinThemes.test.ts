import { describe, expect, it } from 'vitest';
import { registerTheme, getTheme, getThemeOrDefault, DEFAULT_THEME_ID } from '../theme-platform/registry';
import { builtinThemes } from './builtin/index';
import { getInstalledOfficialThemeDescriptor } from './officialRemoteThemes';
import type { ThemeDescriptor } from '../theme-platform/types';

// Register builtin themes before registry assertions.
function registerAllBuiltin(): void {
  for (const raw of builtinThemes) {
    registerTheme(raw as unknown as ThemeDescriptor);
  }
}

describe('builtin theme definitions', () => {
  it('ships at least one built-in theme (narrative-workbench)', () => {
    expect(builtinThemes.length).toBeGreaterThanOrEqual(1);
    expect(builtinThemes[0]!.id).toBe('plotflow-narrative-workbench');
  });

  it('provides full production slots and recipes for every builtin theme', () => {
    for (const theme of builtinThemes) {
      expect(theme.name['zh-CN']).toBeTruthy();
      expect(theme.name['en-US']).toBeTruthy();
      expect(theme.tokens.shared).toBeTruthy();
      expect(theme.monacoTheme?.light ?? theme.monacoTheme?.dark).toBeTruthy();
      expect(theme.layoutRecipe.graphLab?.nodeCardStyle).toBeTruthy();
      expect(theme.uxRecipe?.themeCenter?.layout ?? theme.uxRecipe?.home?.layout).toBeTruthy();
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

  it('runtime registry returns default for unknown theme id', () => {
    registerAllBuiltin();

    expect(getTheme('plotflow-narrative-workbench')).toBeTruthy();
    expect(getTheme('unknown-theme')).toBeUndefined();

    const fallback = getThemeOrDefault('unknown-theme');
    expect(fallback.id).toBe(DEFAULT_THEME_ID);
  });

  it('DEFAULT_THEME_ID is narrative workbench', () => {
    expect(DEFAULT_THEME_ID).toBe('plotflow-narrative-workbench');
  });

  it('maps installed official remote theme summaries to controlled prebuilt descriptors', () => {
    const descriptor = getInstalledOfficialThemeDescriptor({
      id: 'plotflow-neon-dossier',
      version: '1.0.0',
      name: { 'zh-CN': '霓虹档案', 'en-US': 'Neon Dossier' },
      priceLabel: '免费主题',
      installedAt: 123,
    });

    expect(descriptor?.id).toBe('plotflow-neon-dossier');
    expect(descriptor?.storeMeta.availability).toBe('officialRemote');
    expect(descriptor?.uxRecipe?.node?.width).toBeTruthy();
  });
});
