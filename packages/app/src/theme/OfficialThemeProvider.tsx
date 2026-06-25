import React, { createContext, useContext, useEffect, useMemo } from 'react';
import * as monaco from 'monaco-editor';
import { THEME_DARK, THEME_LIGHT } from '../editor/setupEditor';
import { useUIStore } from '../stores/uiStore';
import { DEFAULT_OFFICIAL_THEME_ID, normalizeOfficialThemeId, type OfficialThemeId } from './officialThemeIds';
import { officialThemes } from './officialThemes';
import type { OfficialThemeDefinition } from './officialThemeTypes';

interface OfficialThemeContextValue {
  readonly activeTheme: OfficialThemeDefinition;
  readonly themes: readonly OfficialThemeDefinition[];
  readonly activeThemeId: OfficialThemeId;
}

const OfficialThemeContext = createContext<OfficialThemeContextValue | null>(null);

const themeMap = new Map<OfficialThemeId, OfficialThemeDefinition>(
  officialThemes.map((theme) => [theme.id, theme]),
);

export function getOfficialTheme(themeId: string | null | undefined): OfficialThemeDefinition {
  const normalized = normalizeOfficialThemeId(themeId);
  return themeMap.get(normalized) ?? themeMap.get(DEFAULT_OFFICIAL_THEME_ID)!;
}

export function useOfficialTheme(): OfficialThemeContextValue {
  const value = useContext(OfficialThemeContext);
  if (!value) {
    throw new Error('useOfficialTheme must be used within OfficialThemeProvider');
  }
  return value;
}

function applyOfficialThemeToRoot(
  root: HTMLElement,
  definition: OfficialThemeDefinition,
): void {
  const mode = definition.defaultMode;
  root.dataset['theme'] = mode;
  delete root.dataset['accent'];
  root.dataset['officialTheme'] = definition.id;
  root.dataset['themePack'] = definition.id;
  root.dataset['themeDensity'] = definition.layoutRecipe.density ?? 'comfortable';
  root.dataset['themeNodeCard'] = definition.layoutRecipe.graphLab?.nodeCardStyle ?? 'paper-card';
  root.dataset['themeSourceDock'] = definition.layoutRecipe.graphLab?.sourceDock ?? 'bottom';
  root.dataset['themeCable'] = definition.layoutRecipe.graphLab?.cableStyle ?? 'soft-bezier';
  root.dataset['themeMotion'] = definition.layoutRecipe.graphLab?.motionIntensity ?? definition.motionRecipe.intensity;

  for (const name of Array.from(root.style)) {
    if (name.startsWith('--theme-')) {
      root.style.removeProperty(name);
    }
  }

  const tokens = {
    ...(definition.tokens.shared ?? {}),
    ...(definition.tokens[mode] ?? {}),
  };

  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }

  const graphLab = definition.layoutRecipe.graphLab;
  if (graphLab?.paletteWidth) {
    root.style.setProperty('--theme-graph-lab-palette-width', `${graphLab.paletteWidth}px`);
  }
  if (graphLab?.railWidth) {
    root.style.setProperty('--theme-graph-lab-rail-width', `${graphLab.railWidth}px`);
  }
  if (graphLab?.inspectorWidth) {
    root.style.setProperty('--theme-graph-lab-inspector-width', `${graphLab.inspectorWidth}px`);
  }
  if (graphLab?.sourceDockHeight) {
    root.style.setProperty('--theme-graph-lab-source-dock-height', `${graphLab.sourceDockHeight}px`);
  }
}

export interface OfficialThemeProviderProps {
  readonly children: React.ReactNode;
}

export function OfficialThemeProvider({ children }: OfficialThemeProviderProps): React.ReactElement {
  const language = useUIStore((state) => state.language);
  const activeOfficialThemeId = useUIStore((state) => state.activeOfficialThemeId);

  const activeTheme = useMemo(
    () => getOfficialTheme(activeOfficialThemeId),
    [activeOfficialThemeId],
  );

  useEffect(() => {
    const root = document.documentElement;
    applyOfficialThemeToRoot(root, activeTheme);

    const mode = activeTheme.defaultMode;
    const monacoThemeData = activeTheme.monacoTheme[mode];
    if (monacoThemeData) {
      const monacoThemeName = `${activeTheme.id}-${mode}-monaco`;
      monaco.editor.defineTheme(monacoThemeName, monacoThemeData as unknown as monaco.editor.IStandaloneThemeData);
      monaco.editor.setTheme(monacoThemeName);
      return;
    }

    monaco.editor.setTheme(mode === 'dark' ? THEME_DARK : THEME_LIGHT);
  }, [activeTheme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<OfficialThemeContextValue>(
    () => ({
      activeTheme,
      activeThemeId: activeTheme.id,
      themes: officialThemes,
    }),
    [activeTheme],
  );

  return (
    <OfficialThemeContext.Provider value={value}>
      {children}
    </OfficialThemeContext.Provider>
  );
}
