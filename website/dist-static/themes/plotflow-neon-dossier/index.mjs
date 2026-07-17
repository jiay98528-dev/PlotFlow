export function createTheme(host) {
  const h = host.createElement;
  const baseSurfaces = host.defaultThemeSurfaces;
  const baseSlots = host.baseSlots;

  function NeonDossierNodeCard(props) {
    return h(
      'div',
      {
        className: 'neon-dossier-node-slot',
        'data-remote-slot': 'neon-dossier-node',
      },
      h(baseSlots.StoryNodeCard, props),
    );
  }
  NeonDossierNodeCard.displayName = 'NeonDossierRemoteNodeSlot';

  function NeonDossierEdge(props) {
    return h(
      'g',
      {
        className: 'neon-dossier-edge-slot',
        'data-remote-slot': 'neon-dossier-edge',
      },
      h(baseSlots.StoryEdge, props),
    );
  }
  NeonDossierEdge.displayName = 'NeonDossierRemoteEdgeSlot';

  function NeonDossierPreview({ compact = false, active = false } = {}) {
    return h(
      'div',
      {
        className: `official-theme-preview official-theme-preview--remote neon-dossier-preview${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`,
      },
      h(
        'div',
        { className: 'official-theme-preview__canvas neon-dossier-preview__canvas' },
        h(
          'div',
          { className: 'official-theme-preview__node official-theme-preview-node-main neon-dossier-preview__node' },
          h('span'),
          h('strong', null, '霓虹档案'),
          h('em', null, 'Remote code package'),
        ),
        h(
          'svg',
          { viewBox: '0 0 220 120', 'aria-hidden': 'true' },
          h('path', { d: 'M58 70 C92 24 134 28 170 48' }),
          h('path', { d: 'M70 86 C118 106 158 94 190 70' }),
        ),
      ),
    );
  }

  const neonSurfaces = {
    ...baseSurfaces,
    AppShell({ workspaceMode, topbar, children, overlays, statusBar }) {
      return h(
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

    Toolbar({ brand, fileControls, viewControls, preferenceControls }) {
      return h(
        'header',
        {
          className: 'app-topbar neon-dossier-toolbar',
          'data-theme-surface': 'neon-dossier-toolbar',
        },
        h('div', { className: 'neon-dossier-toolbar__brand' }, brand),
        h(
          'nav',
          { className: 'app-toolbar neon-dossier-toolbar__commands', 'aria-label': 'Fablevia toolbar' },
          h('div', { className: 'toolbar-group neon-dossier-toolbar__group', role: 'group' }, fileControls),
          h('div', { className: 'toolbar-group neon-dossier-toolbar__group', role: 'group' }, viewControls),
          h('div', { className: 'toolbar-group neon-dossier-toolbar__group', role: 'group' }, preferenceControls),
        ),
      );
    },

    GraphLabShell({ isSourceDrawerOpen, commandbar, palette, canvas, inspector, sourceDrawer }) {
      return h(
        'main',
        {
          className: `graph-lab neon-dossier-graph-lab${isSourceDrawerOpen ? ' graph-lab--source-open neon-dossier-graph-lab--source-open' : ''}`,
          'data-testid': 'graph-lab-workspace',
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
      return h(
        'section',
        {
          className: 'theme-center neon-dossier-theme-center',
          'data-testid': 'theme-center',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-labelledby': 'theme-center-title',
          'data-theme-surface': 'neon-dossier-theme-center-surface',
        },
        h(
          'div',
          { className: 'theme-center__panel neon-dossier-theme-center__panel' },
          header,
          h(
            'div',
            { className: 'theme-center__body neon-dossier-theme-center__body' },
            sidebar,
            h('div', { className: 'theme-center__list neon-dossier-theme-center__list' }, installedThemes, remoteThemes),
          ),
          footer,
        ),
      );
    },
  };

  return {
    descriptor: {
      id: host.themeId,
      name: { 'zh-CN': '霓虹档案', 'en-US': 'Neon Dossier' },
      tagline: { 'zh-CN': '官方免费主题 · 远程代码包', 'en-US': 'Free official theme · remote code package' },
      description: {
        'zh-CN': '由官方 ZIP 代码包动态加载的高对比档案工作台主题。',
        'en-US': 'A high-contrast dossier workspace loaded from an official ZIP code package.',
      },
      version: host.version,
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
      assets: {
        preview: host.assetUrl('preview.svg'),
      },
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
        toolbar: { height: '72px', padding: '0 var(--space-5)', gap: 'var(--space-4)' },
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
      slots: {
        ...baseSlots,
        StoryNodeCard: NeonDossierNodeCard,
        StoryEdge: NeonDossierEdge,
        ThemePreview: NeonDossierPreview,
        HomePreview: NeonDossierPreview,
      },
      surfaces: neonSurfaces,
    },
  };
}
