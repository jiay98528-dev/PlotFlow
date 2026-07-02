import type { ThemeSurfaces } from '../../../theme-platform/types';

function joinClass(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export const engineTelemetrySurfaces: ThemeSurfaces = {
  AppShell({ workspaceMode, topbar, children, overlays, statusBar }) {
    return (
      <div
        className={joinClass(
          'app-shell',
          'engine-telemetry-shell',
          workspaceMode === 'graphLab' && 'app-shell--graph-lab engine-telemetry-shell--graph-lab',
        )}
        data-theme-surface="engine-telemetry-app-shell"
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
      <header className="app-topbar engine-telemetry-toolbar" data-theme-surface="engine-telemetry-toolbar">
        {brand}
        <nav className="app-toolbar engine-telemetry-toolbar__nav" aria-label="PlotFlow command bar">
          <div className="toolbar-group engine-telemetry-toolbar__group" role="group">
            {fileControls}
          </div>
          <div className="toolbar-group engine-telemetry-toolbar__group" role="group">
            {viewControls}
          </div>
          <div className="toolbar-group engine-telemetry-toolbar__group" role="group">
            {preferenceControls}
          </div>
        </nav>
      </header>
    );
  },

  SplitShell({ viewbar, outline, editor, graph, minimap }) {
    return (
      <>
        <div className="split-workspace engine-telemetry-split" data-theme-surface="engine-telemetry-split-shell">
          {viewbar}
          <div className="app-main engine-telemetry-split__deck">
            <aside className="engine-telemetry-split__source-spine" aria-label="Source Spine">
              {outline}
              <main className="editor-pane engine-telemetry-split__editor">
                {editor}
              </main>
            </aside>
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
        className={joinClass(
          'graph-lab',
          'engine-telemetry-graph-lab',
          isSourceDrawerOpen && 'graph-lab--source-open engine-telemetry-graph-lab--source-open',
        )}
        data-testid="graph-lab-workspace"
        data-theme-surface="engine-telemetry-graph-lab-shell"
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
      <main className="home-surface engine-telemetry-home" data-testid="home-surface" data-theme-surface="engine-telemetry-home-surface">
        <section className="home-surface__hero engine-telemetry-home__hero">
          <div className="home-surface__copy engine-telemetry-home__copy">
            {heroCopy}
            <div className="home-surface__actions engine-telemetry-home__actions">{actions}</div>
          </div>
          {preview}
        </section>
        <section className="home-surface__grid engine-telemetry-home__grid">{cards}</section>
        <section className="home-surface__status engine-telemetry-home__status">{status}</section>
      </main>
    );
  },

  ThemeCenterSurface({ header, sidebar, installedThemes, remoteThemes, footer }) {
    return (
      <section
        className="theme-center engine-telemetry-theme-center"
        data-testid="theme-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-center-title"
        data-theme-surface="engine-telemetry-theme-center-surface"
      >
        <div className="theme-center__panel engine-telemetry-theme-center__panel">
          {header}
          <div className="theme-center__body engine-telemetry-theme-center__body">
            {sidebar}
            <div className="theme-center__list engine-telemetry-theme-center__list">
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
      <section
        className={joinClass(className, 'engine-telemetry-panel-frame')}
        data-testid={testId}
        aria-label={ariaLabel}
        data-theme-surface="engine-telemetry-panel-frame"
      >
        {children}
      </section>
    );
  },

  DockFrame({ className, testId, ariaLabel, children }) {
    return (
      <div
        className={joinClass(className, 'engine-telemetry-dock-frame')}
        data-testid={testId}
        aria-label={ariaLabel}
        data-theme-surface="engine-telemetry-dock-frame"
      >
        {children}
      </div>
    );
  },
};
