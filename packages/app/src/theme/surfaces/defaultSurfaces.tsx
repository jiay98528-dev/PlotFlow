import type { ThemeSurfaces } from '../../theme-platform/types';

export const defaultThemeSurfaces: ThemeSurfaces = {
  AppShell({ workspaceMode, topbar, children, overlays, statusBar }) {
    return (
      <div
        className={`app-shell${workspaceMode === 'graphLab' ? ' app-shell--graph-lab' : ''}`}
        data-theme-surface="app-shell"
      >
        {topbar}
        {children}
        {overlays}
        {statusBar}
      </div>
    );
  },

  Toolbar({ brand, fileControls, viewControls, preferenceControls }) {
    return (
      <header className="app-topbar" data-theme-surface="toolbar">
        {brand}
        <nav className="app-toolbar" aria-label="PlotFlow toolbar">
          <div className="toolbar-group" role="group">
            {fileControls}
          </div>
          <div className="toolbar-group" role="group">
            {viewControls}
          </div>
          <div className="toolbar-group" role="group">
            {preferenceControls}
          </div>
        </nav>
      </header>
    );
  },

  SplitShell({ viewbar, outline, editor, graph, minimap }) {
    return (
      <>
        <div className="split-workspace" data-theme-surface="split-shell">
          {viewbar}
          <div className="app-main">
            {outline}
            <main className="editor-pane">
              {editor}
            </main>
            {graph}
          </div>
        </div>
        {minimap}
      </>
    );
  },

  GraphLabShell({ isSourceDrawerOpen, commandbar, palette, canvas, inspector, sourceDrawer }) {
    return (
      <main
        className={`graph-lab${isSourceDrawerOpen ? ' graph-lab--source-open' : ''}`}
        data-testid="graph-lab-workspace"
        data-theme-surface="graph-lab-shell"
      >
        {commandbar}
        {palette}
        {canvas}
        {inspector}
        {sourceDrawer}
      </main>
    );
  },

  HomeSurface({ heroCopy, preview, actions, cards, status }) {
    return (
      <main className="home-surface" data-testid="home-surface" data-theme-surface="home-surface">
        <section className="home-surface__hero">
          <div className="home-surface__copy">
            {heroCopy}
            <div className="home-surface__actions">{actions}</div>
          </div>
          {preview}
        </section>
        <section className="home-surface__grid">{cards}</section>
        <section className="home-surface__status">{status}</section>
      </main>
    );
  },

  ThemeCenterSurface({ header, sidebar, installedThemes, remoteThemes, footer }) {
    return (
      <section
        className="theme-center"
        data-testid="theme-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-center-title"
        data-theme-surface="theme-center-surface"
      >
        <div className="theme-center__panel">
          {header}
          <div className="theme-center__body">
            {sidebar}
            <div className="theme-center__list">
              {installedThemes}
              {remoteThemes}
            </div>
          </div>
          {footer}
        </div>
      </section>
    );
  },

  PanelFrame({ className, testId, ariaLabel, children }) {
    return (
      <section className={className} data-testid={testId} aria-label={ariaLabel} data-theme-surface="panel-frame">
        {children}
      </section>
    );
  },

  DockFrame({ className, testId, ariaLabel, children }) {
    return (
      <div className={className} data-testid={testId} aria-label={ariaLabel} data-theme-surface="dock-frame">
        {children}
      </div>
    );
  },
};
