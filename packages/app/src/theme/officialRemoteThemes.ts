import { createElement } from 'react';
import type { InstalledOfficialThemeSummary, ThemeDescriptor, ThemeSurfaces } from '../theme-platform/types';
import { narrativeWorkbenchSlots } from './builtin/plotflow-narrative-workbench/slots';
import { defaultThemeSurfaces } from './surfaces/defaultSurfaces';

const neonDossierSurfaces: ThemeSurfaces = {
  ...defaultThemeSurfaces,

  AppShell({ workspaceMode, topbar, children, overlays, statusBar }) {
    return createElement(
      'div',
      {
        className: `app-shell neon-dossier-shell${workspaceMode === 'graphLab' ? ' app-shell--graph-lab neon-dossier-shell--graph-lab' : ''}`,
        'data-theme-surface': 'neon-dossier-app-shell',
      },
      topbar,
      children,
      overlays,
      statusBar,
    );
  },

  GraphLabShell({ isSourceDrawerOpen, commandbar, palette, canvas, inspector, sourceDrawer }) {
    return createElement(
      'main',
      {
        className: `graph-lab neon-dossier-graph-lab${isSourceDrawerOpen ? ' graph-lab--source-open' : ''}`,
        'data-theme-surface': 'neon-dossier-graph-lab-shell',
      },
      commandbar,
      palette,
      canvas,
      inspector,
      sourceDrawer,
    );
  },

  ThemeCenterSurface({ header, sidebar, installedThemes, remoteThemes, footer }) {
    return createElement(
      'div',
      {
        className: 'official-theme-center neon-dossier-theme-center',
        role: 'dialog',
        'aria-modal': 'true',
        'data-theme-surface': 'neon-dossier-theme-center-surface',
      },
      header,
      createElement(
        'div',
        { className: 'official-theme-center__layout neon-dossier-theme-center__layout' },
        sidebar,
        createElement(
          'main',
          { className: 'official-theme-center__content neon-dossier-theme-center__content' },
          installedThemes,
          remoteThemes,
        ),
      ),
      footer,
    );
  },
};

const neonDossierTheme: ThemeDescriptor = {
  id: 'plotflow-neon-dossier',
  name: { 'zh-CN': '霓虹档案', 'en-US': 'Neon Dossier' },
  tagline: { 'zh-CN': '官方免费主题 · 高对比档案工作台', 'en-US': 'Free official theme · high-contrast dossier desk' },
  description: { 'zh-CN': '用于验证官方远程主题下载、更新与注册链路的预置代码主题。', 'en-US': 'Prebuilt code theme used to verify the official remote theme pipeline.' },
  version: '1.0.0',
  defaultMode: 'dark',
  tokens: {
    shared: {
      '--theme-graph-lab-paper': 'var(--theme-workbench-paper)',
      '--theme-graph-lab-surface': 'var(--theme-workbench-panel)',
      '--theme-panel-surface': 'color-mix(in oklch, var(--theme-workbench-panel), transparent 6%)',
      '--theme-grid-size': '24px',
      '--theme-card-radius': '16px',
      '--theme-graph-cable-default': 'var(--theme-blueprint-cable)',
      '--theme-graph-cable-conditional': 'var(--theme-effect-line)',
      '--theme-port-fill': 'var(--theme-blueprint-cable)',
      '--theme-source-dock-height': '360px',
    },
    dark: {
      '--theme-workbench-paper': 'oklch(0.17 0.034 274)',
      '--theme-workbench-panel': 'oklch(0.23 0.042 272)',
      '--theme-blueprint-canvas': 'radial-gradient(circle at 18% 20%, oklch(0.42 0.17 318 / 0.28), transparent 34%), linear-gradient(135deg, oklch(0.16 0.036 268), oklch(0.09 0.028 263))',
      '--theme-blueprint-cable': 'oklch(0.78 0.19 205)',
      '--theme-effect-line': 'oklch(0.76 0.19 335)',
      '--theme-node-surface': 'oklch(0.25 0.045 273)',
      '--theme-node-surface-strong': 'oklch(0.32 0.055 276)',
      '--theme-node-border': 'oklch(0.63 0.13 210)',
      '--theme-node-ink': 'oklch(0.93 0.025 245)',
      '--theme-node-muted': 'oklch(0.75 0.04 248)',
      '--theme-workbench-shadow': '0 24px 70px oklch(0.04 0.02 268 / 0.6)',
    },
  },
  monacoTheme: undefined,
  assets: { preview: 'official-remote://plotflow-neon-dossier/preview.svg' },
  layoutRecipe: {
    density: 'cinematic',
    graphLab: {
      paletteWidth: 304,
      railWidth: 304,
      inspectorWidth: 392,
      sourceDockHeight: 360,
      sourceDock: 'bottom',
      nodeCardStyle: 'neon-dossier-card',
      cableStyle: 'neon-dossier-cable',
      motionIntensity: 'expressive',
    },
  },
  uxRecipe: {
    home: { layout: 'cinematic-archive', inset: '64px 0 26px', opacity: '1' },
    themeCenter: { layout: 'market-catalog', width: 'min(1200px, 100%)', opacity: '1' },
    graphLab: { layout: 'wide-canvas', gap: 'var(--space-4)' },
    node: { width: '280px', minHeight: '158px', radius: '16px', opacity: '1' },
    edge: { width: '40px', opacity: '1' },
  },
  entryRecipe: {
    graphLabDefaultEntry: 'canvasFirst',
    sourceDockDefault: 'collapsed',
    primaryActionLabel: { 'zh-CN': '进入档案', 'en-US': 'Open dossier' },
  },
  interactionRecipe: {
    density: 'balanced',
    realtimeWirePreview: true,
    highlightConnectTargets: true,
    prominentPorts: true,
  },
  motionRecipe: {
    intensity: 'expressive',
    nodeHoverLift: true,
    cableGlow: true,
    backgroundDrift: true,
  },
  storeMeta: {
    availability: 'officialRemote',
    priceLabel: '免费主题',
    storeUrl: 'https://plotflow.app/themes/plotflow-neon-dossier',
  },
  slots: narrativeWorkbenchSlots,
  surfaces: neonDossierSurfaces,
};

const officialRemoteThemeModules: Record<string, ThemeDescriptor> = {
  [neonDossierTheme.id]: neonDossierTheme,
};

export function getInstalledOfficialThemeDescriptor(summary: InstalledOfficialThemeSummary): ThemeDescriptor | null {
  const descriptor = officialRemoteThemeModules[summary.id];
  if (!descriptor) return null;
  if (descriptor.version !== summary.version) return null;
  return descriptor;
}
