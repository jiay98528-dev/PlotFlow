import type { ThemeSurfaces } from '../../../theme-platform/types';

function joinClass(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

const THEME_ID = 'plotflow-prism-foundry';

/**
 * 棱镜铸造台的八个 Surface。
 *
 * Graph Lab 不添加中间包装层，命令栏、Rail、画布、Inspector 与 Source Drawer
 * 保持为 `.graph-lab` 的直系业务区域，确保网格和既有键盘/拖拽合同不变。
 */
export const prismFoundrySurfaces: ThemeSurfaces = {
  AppShell({ workspaceMode, topbar, children, overlays, statusBar }) {
    return (
      <div
        className={joinClass(
          'app-shell',
          'prism-foundry-shell',
          workspaceMode === 'graphLab' && 'app-shell--graph-lab prism-foundry-shell--graph-lab',
        )}
        data-theme-surface="prism-foundry-app-shell"
        data-official-surface-theme={THEME_ID}
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
      <header
        className="app-topbar prism-foundry-toolbar"
        data-theme-surface="prism-foundry-toolbar"
        data-official-surface-theme={THEME_ID}
      >
        {brand}
        <nav
          className="app-toolbar prism-foundry-toolbar__nav"
          aria-label="PlotFlow Prism Foundry command bar"
        >
          <div className="toolbar-group prism-foundry-toolbar__group" role="group">
            {fileControls}
          </div>
          <div className="toolbar-group prism-foundry-toolbar__group" role="group">
            {viewControls}
          </div>
          <div className="toolbar-group prism-foundry-toolbar__group" role="group">
            {preferenceControls}
          </div>
        </nav>
      </header>
    );
  },

  SplitShell({ viewbar, outline, editor, graph, minimap }) {
    return (
      <>
        <div
          className="split-workspace prism-foundry-split"
          data-theme-surface="prism-foundry-split-shell"
          data-official-surface-theme={THEME_ID}
        >
          {viewbar}
          <div className="app-main prism-foundry-split__deck">
            <aside className="prism-foundry-split__rail" aria-label="Narrative rail">
              {outline}
            </aside>
            <main className="editor-pane prism-foundry-split__editor">{editor}</main>
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
          'prism-foundry-graph-lab',
          isSourceDrawerOpen && 'graph-lab--source-open prism-foundry-graph-lab--source-open',
        )}
        data-testid="graph-lab-workspace"
        data-theme-surface="prism-foundry-graph-lab-shell"
        data-official-surface-theme={THEME_ID}
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
      <main
        className="home-surface prism-foundry-home"
        data-testid="home-surface"
        data-theme-surface="prism-foundry-home-surface"
        data-official-surface-theme={THEME_ID}
      >
        <section className="home-surface__hero prism-foundry-home__hero">
          <div className="home-surface__copy prism-foundry-home__copy">
            {heroCopy}
            <div className="home-surface__actions prism-foundry-home__actions">{actions}</div>
          </div>
          {preview}
        </section>
        <section className="home-surface__grid prism-foundry-home__grid">{cards}</section>
        <section className="home-surface__status prism-foundry-home__status">{status}</section>
      </main>
    );
  },

  ThemeCenterSurface({ header, sidebar, installedThemes, remoteThemes, footer }) {
    return (
      <section
        className="theme-center prism-foundry-theme-center"
        data-testid="theme-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-center-title"
        data-theme-surface="prism-foundry-theme-center-surface"
        data-official-surface-theme={THEME_ID}
      >
        <div className="theme-center__panel prism-foundry-theme-center__panel">
          {header}
          <div className="theme-center__body prism-foundry-theme-center__body">
            {sidebar}
            <div className="theme-center__list prism-foundry-theme-center__list">
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
        className={joinClass(className, 'prism-foundry-panel-frame')}
        data-testid={testId}
        aria-label={ariaLabel}
        data-theme-surface="prism-foundry-panel-frame"
        data-official-surface-theme={THEME_ID}
      >
        {children}
      </section>
    );
  },

  DockFrame({ className, testId, ariaLabel, children }) {
    return (
      <div
        className={joinClass(className, 'prism-foundry-dock-frame')}
        data-testid={testId}
        aria-label={ariaLabel}
        data-theme-surface="prism-foundry-dock-frame"
        data-official-surface-theme={THEME_ID}
      >
        {children}
      </div>
    );
  },
};
