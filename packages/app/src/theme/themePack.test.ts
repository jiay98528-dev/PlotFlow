/* @vitest-environment jsdom */

import { describe, expect, it, beforeEach } from 'vitest';
import { builtinThemePacks } from './builtinThemePacks';
import {
  applyThemePackToRoot,
  getThemePackOrDefault,
  registerThemePack,
} from './themeRegistry';
import {
  DEFAULT_THEME_PACK_ID,
  validateThemePackManifest,
  type ThemePackManifest,
} from './themePack';

const validTheme: ThemePackManifest = {
  schemaVersion: 1,
  id: 'community.paper-night',
  name: 'Paper Night',
  version: '1.0.0',
  plotflowVersion: '>=0.1.0',
  author: 'Theme Author',
  license: 'MIT',
  capabilities: ['tokens', 'layout'],
  tokens: {
    light: {
      '--theme-test-token': 'var(--color-accent)',
    },
  },
  layoutRecipe: {
    density: 'compact',
    graphLab: {
      paletteWidth: 240,
      railWidth: 252,
      inspectorWidth: 380,
      sourceDockHeight: 320,
      sourceDock: 'bottom',
      nodeCardStyle: 'paper-card',
      cableStyle: 'soft-bezier',
      motionIntensity: 'subtle',
    },
  },
};

describe('theme pack contract', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme-pack');
    document.documentElement.removeAttribute('data-theme-density');
    document.documentElement.style.cssText = '';
  });

  it('accepts built-in 叙事工作台 theme pack', () => {
    const builtin = builtinThemePacks[0]!;
    const result = validateThemePackManifest(builtin);
    expect(result.ok).toBe(true);
    expect(builtin.id).toBe(DEFAULT_THEME_PACK_ID);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects executable declarations and remote urls', () => {
    const unsafeTheme = {
      ...validTheme,
      id: 'unsafe.theme',
      scripts: ['theme.js'],
      assets: {
        preview: 'https://example.com/preview.png',
      },
    };

    const result = validateThemePackManifest(unsafeTheme);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('scripts');
    expect(result.errors.join('\n')).toContain('URL');
  });

  it('rejects traversal asset paths', () => {
    const traversalTheme = {
      ...validTheme,
      id: 'unsafe.traversal',
      assets: {
        preview: '../outside.png',
      },
    };

    const result = validateThemePackManifest(traversalTheme);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('路径穿越');
  });

  it('registers a local theme and applies tokens plus layout recipe', () => {
    const summary = registerThemePack(validTheme, 'local');
    expect(summary.status).toBe('ready');

    const registered = getThemePackOrDefault(validTheme.id);
    applyThemePackToRoot(document.documentElement, registered.manifest, 'light');

    expect(document.documentElement.dataset['themePack']).toBe(validTheme.id);
    expect(document.documentElement.dataset['themeDensity']).toBe('compact');
    expect(document.documentElement.dataset['themeCable']).toBe('soft-bezier');
    expect(document.documentElement.style.getPropertyValue('--theme-test-token')).toBe('var(--color-accent)');
    expect(document.documentElement.style.getPropertyValue('--theme-graph-lab-palette-width')).toBe('240px');
    expect(document.documentElement.style.getPropertyValue('--theme-graph-lab-rail-width')).toBe('252px');
    expect(document.documentElement.style.getPropertyValue('--theme-graph-lab-source-dock-height')).toBe('320px');
  });
});
