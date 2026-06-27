/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { applyThemeToRoot } from './engine';
import type { ThemeDescriptor } from './types';
import { defaultThemeSurfaces } from '../theme/surfaces/defaultSurfaces';

const theme: ThemeDescriptor = {
  id: 'test.ux-theme',
  name: { 'zh-CN': '测试主题', 'en-US': 'Test Theme' },
  tagline: { 'zh-CN': '测试', 'en-US': 'Test' },
  description: { 'zh-CN': '测试', 'en-US': 'Test' },
  version: '1.0.0',
  defaultMode: 'light',
  tokens: { shared: { '--theme-node-ink': 'oklch(0.3 0.1 200)' } },
  assets: { preview: '' },
  layoutRecipe: {
    density: 'comfortable',
    graphLab: {
      paletteWidth: 300,
      railWidth: 280,
      inspectorWidth: 380,
      sourceDockHeight: 340,
      sourceDock: 'bottom',
      nodeCardStyle: 'test-card',
      cableStyle: 'test-cable',
      motionIntensity: 'expressive',
    },
  },
  uxRecipe: {
    themeCenter: { width: 'min(1200px, 100%)', opacity: '0.96', zIndex: '1000' },
    node: { width: '280px', minHeight: '160px', radius: '18px' },
  },
  entryRecipe: {
    graphLabDefaultEntry: 'canvasFirst',
    sourceDockDefault: 'collapsed',
    primaryActionLabel: { 'zh-CN': '开始', 'en-US': 'Start' },
  },
  interactionRecipe: { density: 'balanced', realtimeWirePreview: true },
  motionRecipe: { intensity: 'expressive' },
  storeMeta: { availability: 'bundled', priceLabel: '免费主题', storeUrl: 'https://plotflow.app/themes' },
  slots: {
    StoryNodeCard: () => null,
    StoryEdge: () => null,
    ThemePreview: () => null,
    HomePreview: () => null,
  },
  surfaces: defaultThemeSurfaces,
};

describe('applyThemeToRoot uxRecipe', () => {
  it('writes full UX recipe variables to root', () => {
    const root = document.documentElement;
    applyThemeToRoot(root, theme, 'light');

    expect(root.dataset['themeUxThemeCenter']).toBe('custom');
    expect(root.style.getPropertyValue('--theme-ux-theme-center-width')).toBe('min(1200px, 100%)');
    expect(root.style.getPropertyValue('--theme-ux-theme-center-opacity')).toBe('0.96');
    expect(root.style.getPropertyValue('--theme-ux-theme-center-z-index')).toBe('1000');
    expect(root.style.getPropertyValue('--theme-ux-node-width')).toBe('280px');
    expect(root.style.getPropertyValue('--theme-ux-node-min-height')).toBe('160px');
    expect(root.style.getPropertyValue('--theme-ux-node-radius')).toBe('18px');
  });
});
