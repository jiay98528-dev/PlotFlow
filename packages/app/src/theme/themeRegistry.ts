import type { ThemePackManifest, ThemePackSummary, ThemeMode } from './themePack';
import {
  DEFAULT_THEME_PACK_ID,
  summarizeThemePack,
  validateThemePackManifest,
} from './themePack';
import { builtinThemePacks } from './builtinThemePacks';

export interface RegisteredThemePack {
  readonly manifest: ThemePackManifest;
  readonly source: 'builtin' | 'local';
}

const registry = new Map<string, RegisteredThemePack>();

for (const manifest of builtinThemePacks) {
  registry.set(manifest.id, { manifest, source: 'builtin' });
}

export function registerThemePack(manifest: ThemePackManifest, source: 'local' | 'builtin' = 'local'): ThemePackSummary {
  const validation = validateThemePackManifest(manifest);
  if (!validation.ok) {
    return summarizeThemePack(manifest, source, validation.errors);
  }

  registry.set(manifest.id, { manifest, source });
  return summarizeThemePack(manifest, source);
}

export function registerThemePacks(manifests: readonly ThemePackManifest[], source: 'local' | 'builtin' = 'local'): ThemePackSummary[] {
  return manifests.map((manifest) => registerThemePack(manifest, source));
}

export function getThemePack(id: string): RegisteredThemePack | undefined {
  return registry.get(id);
}

export function getThemePackOrDefault(id: string): RegisteredThemePack {
  return registry.get(id) ?? registry.get(DEFAULT_THEME_PACK_ID)!;
}

export function listThemePackSummaries(): ThemePackSummary[] {
  return [...registry.values()].map(({ manifest, source }) => summarizeThemePack(manifest, source));
}

export function getThemePackMonacoName(packId: string, mode: ThemeMode): string | null {
  const pack = registry.get(packId);
  if (!pack?.manifest.monacoTheme?.[mode]) return null;
  return `${pack.manifest.id}-${mode}-monaco`;
}

export function applyThemePackToRoot(root: HTMLElement, manifest: ThemePackManifest, mode: ThemeMode): void {
  root.dataset['themePack'] = manifest.id;
  root.dataset['themeDensity'] = manifest.layoutRecipe?.density ?? 'comfortable';
  root.dataset['themeNodeCard'] = manifest.layoutRecipe?.graphLab?.nodeCardStyle ?? 'paper-card';
  root.dataset['themeSourceDock'] = manifest.layoutRecipe?.graphLab?.sourceDock ?? 'bottom';
  root.dataset['themeCable'] = manifest.layoutRecipe?.graphLab?.cableStyle ?? 'soft-bezier';

  const tokens = {
    ...(manifest.tokens?.shared ?? {}),
    ...(manifest.tokens?.[mode] ?? {}),
  };

  for (const name of Array.from(root.style)) {
    if (name.startsWith('--theme-')) {
      root.style.removeProperty(name);
    }
  }

  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }

  const graphLab = manifest.layoutRecipe?.graphLab;
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
  if (graphLab?.motionIntensity) {
    root.dataset['themeMotion'] = graphLab.motionIntensity;
  }
}
