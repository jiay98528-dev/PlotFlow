import React from 'react';
import { CheckCircle2, ExternalLink, Palette, RotateCcw, X } from 'lucide-react';
import { DEFAULT_OFFICIAL_THEME_ID, type OfficialThemeId } from '../../theme/officialThemeIds';
import { useOfficialTheme } from '../../theme/OfficialThemeProvider';
import { useUIStore } from '../../stores/uiStore';

export function ThemeCenter(): React.ReactElement | null {
  const isOpen = useUIStore((state) => state.isThemeCenterOpen);
  const closeThemeCenter = useUIStore((state) => state.closeThemeCenter);
  const setActiveOfficialThemeId = useUIStore((state) => state.setActiveOfficialThemeId);
  const { activeThemeId, themes } = useOfficialTheme();

  if (!isOpen) return null;

  const applyTheme = (themeId: OfficialThemeId): void => {
    setActiveOfficialThemeId(themeId);
  };

  const openStore = async (): Promise<void> => {
    await window.plotflow?.theme?.openOfficialThemeStore?.();
  };

  return (
    <section className="theme-center" data-testid="theme-center" role="dialog" aria-modal="true" aria-labelledby="theme-center-title">
      <div className="theme-center__panel">
        <header className="theme-center__header">
          <div>
            <p className="theme-center__eyebrow">Official Themes</p>
            <h2 id="theme-center-title">官方主题中心</h2>
            <p>PlotFlow 当前只发行官方主题。切换会立即生效，不会修改 `.mdstory` 内容。</p>
          </div>
          <button type="button" className="icon-button" onClick={closeThemeCenter} aria-label="关闭主题中心">
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </header>

        <div className="theme-center__body">
          <aside className="theme-center__sidebar">
            <div className="theme-center__note">
              <Palette aria-hidden="true" size={18} strokeWidth={2} />
              <div>
                <strong>生产级内置主题</strong>
                <p>每个主题都带有节点、线缆、面板、Monaco 配色、布局配方和动效配方。</p>
              </div>
            </div>
            <button
              type="button"
              className="button button--secondary"
              data-testid="theme-center-store"
              onClick={openStore}
            >
              <ExternalLink aria-hidden="true" size={15} strokeWidth={2} />
              <span>购买更多官方主题</span>
            </button>
            <button
              type="button"
              className="button button--ghost"
              data-testid="theme-center-reset"
              onClick={() => applyTheme(DEFAULT_OFFICIAL_THEME_ID)}
            >
              <RotateCcw aria-hidden="true" size={15} strokeWidth={2} />
              <span>恢复默认主题</span>
            </button>
          </aside>

          <div className="theme-center__list">
            {themes.map((theme) => {
              const Preview = theme.slots.ThemePreview;
              const isActive = theme.id === activeThemeId;

              return (
                <article
                  key={theme.id}
                  className={`official-theme-card${isActive ? ' is-active' : ''}`}
                  data-official-theme-card-id={theme.id}
                >
                  <Preview active={isActive} />
                  <div className="official-theme-card__body">
                    <div className="official-theme-card__title-row">
                      <div>
                        <h3>{theme.name['zh-CN']}</h3>
                        <p>{theme.name['en-US']}</p>
                      </div>
                      {isActive && (
                        <span className="official-theme-card__active">
                          <CheckCircle2 aria-hidden="true" size={16} strokeWidth={2} />
                          已启用
                        </span>
                      )}
                    </div>
                    <p className="official-theme-card__tagline">{theme.tagline['zh-CN']}</p>
                    <p className="official-theme-card__description">{theme.description['zh-CN']}</p>
                    <dl className="official-theme-card__meta">
                      <div>
                        <dt>版本</dt>
                        <dd>{theme.version}</dd>
                      </div>
                      <div>
                        <dt>状态</dt>
                        <dd>{theme.storeMeta.priceLabel}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      className="button button--primary"
                      data-testid="theme-center-apply"
                      disabled={isActive}
                      onClick={() => applyTheme(theme.id)}
                    >
                      {isActive ? '正在使用' : '立即启用'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <footer className="theme-center__footer">
          <p>官方主题采用编译内置模块热插拔；当前不开放社区主题导入。</p>
          <button type="button" className="button button--secondary" onClick={closeThemeCenter}>
            完成
          </button>
        </footer>
      </div>
    </section>
  );
}
