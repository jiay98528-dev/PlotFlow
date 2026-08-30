import { describe, expect, it } from 'vitest';
import { registerTheme, getTheme, getThemeOrDefault, DEFAULT_THEME_ID } from '../theme-platform/registry';
import { resolveMonacoTheme } from '../theme-platform/bridge';
import { builtinThemes } from './builtin/index';
import type { ThemeDescriptor } from '../theme-platform/types';

// Register builtin themes before registry assertions.
function registerAllBuiltin(): void {
  for (const raw of builtinThemes) {
    registerTheme(raw as unknown as ThemeDescriptor);
  }
}

describe('builtin theme definitions', () => {
  it('ships Prism Foundry alongside the existing bundled official themes', () => {
    const ids = builtinThemes.map((theme) => theme.id);

    expect(ids).toEqual([
      'plotflow-prism-foundry',
      'plotflow-narrative-workbench',
      'plotflow-engine-telemetry',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('provides a complete light Prism Foundry descriptor and Monaco definition', () => {
    const prismFoundry = builtinThemes.find((theme) => theme.id === 'plotflow-prism-foundry');

    expect(prismFoundry).toBeDefined();
    expect(prismFoundry).toMatchObject({
      id: 'plotflow-prism-foundry',
      defaultMode: 'light',
      storeMeta: { availability: 'bundled' },
      layoutRecipe: {
        graphLab: expect.objectContaining({
          nodeCardStyle: expect.any(String),
          cableStyle: expect.any(String),
        }),
      },
      assets: { preview: expect.any(String) },
    });
    expect(prismFoundry!.name['zh-CN']).toBeTruthy();
    expect(prismFoundry!.name['en-US']).toBeTruthy();
    const prismLightTokens = {
      ...prismFoundry!.tokens.shared,
      ...prismFoundry!.tokens.light,
    };
    expect(prismLightTokens).toEqual(expect.objectContaining({
      '--theme-graph-lab-paper': expect.any(String),
      '--theme-node-ink': expect.any(String),
      '--theme-graph-cable-default': expect.any(String),
    }));

    const monaco = resolveMonacoTheme(prismFoundry!, 'light');
    expect(monaco).toMatchObject({
      base: 'vs',
      colors: expect.objectContaining({
        'editor.background': expect.any(String),
        'editor.foreground': expect.any(String),
      }),
    });
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
      expect(theme.assets.preview).not.toMatch(/\.svg(?:$|\?)/u);
      expect(theme.storeMeta.availability).toBe('bundled');
      expect(theme.storeMeta.storeUrl).toContain('/themes');
      expect(theme.slots.StoryNodeCard).toBeTypeOf('function');
      expect(theme.slots.StoryEdge).toBeTypeOf('function');
      expect(theme.slots.ThemePreview).toBeTypeOf('function');
      expect(theme.slots.HomePreview).toBeTypeOf('function');
      expect(theme.surfaces.AppShell).toBeTypeOf('function');
      expect(theme.surfaces.Toolbar).toBeTypeOf('function');
      expect(theme.surfaces.SplitShell).toBeTypeOf('function');
      expect(theme.surfaces.GraphLabShell).toBeTypeOf('function');
      expect(theme.surfaces.HomeSurface).toBeTypeOf('function');
      expect(theme.surfaces.ThemeCenterSurface).toBeTypeOf('function');
      expect(theme.surfaces.PanelFrame).toBeTypeOf('function');
      expect(theme.surfaces.DockFrame).toBeTypeOf('function');
      expect(theme.slots.StoryNodeCard.displayName).toContain('OfficialGraphNode');
      expect(theme.slots.StoryEdge.displayName).toContain('OfficialGraphEdge');
    }
  });

  it('runtime registry returns default for unknown theme id', () => {
    registerAllBuiltin();

    expect(getTheme('plotflow-prism-foundry')).toBeTruthy();
    expect(getTheme('plotflow-narrative-workbench')).toBeTruthy();
    expect(getTheme('plotflow-engine-telemetry')).toBeTruthy();
    expect(getTheme('unknown-theme')).toBeUndefined();

    const fallback = getThemeOrDefault('unknown-theme');
    expect(fallback.id).toBe(DEFAULT_THEME_ID);
  });

  it('DEFAULT_THEME_ID is Prism Foundry', () => {
    expect(DEFAULT_THEME_ID).toBe('plotflow-prism-foundry');
  });

});
