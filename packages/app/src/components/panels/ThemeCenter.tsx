import React, { useState } from 'react';
import { flushSourceDraft } from '../../services/sourceDraftCoordinator';
import { CheckCircle2, RotateCcw, X } from 'lucide-react';
import { useThemePlatform } from '../../components/ThemePlatformProvider';
import { useAppText } from '../../i18n/appI18n';
import { useUIStore } from '../../stores/uiStore';
import { DEFAULT_THEME_ID } from '../../theme-platform/registry';

export function ThemeCenter(): React.ReactElement | null {
  const isOpen = useUIStore((state) => state.isThemeCenterOpen);
  const closeThemeCenter = useUIStore((state) => state.closeThemeCenter);
  const setActiveThemeId = useUIStore((state) => state.setActiveThemeId);
  const language = useUIStore((state) => state.language);
  const { activeThemeId, themes, activeTheme } = useThemePlatform();
  const Surface = activeTheme.surfaces.ThemeCenterSurface;
  const text = useAppText();
  const [draftBlocked, setDraftBlocked] = useState(false);
  const applyTheme = (id: string) => {
    if (!flushSourceDraft('workspace').ok) {
      setDraftBlocked(true);
      return;
    }
    setDraftBlocked(false);
    setActiveThemeId(id);
  };

  if (!isOpen) return null;

  return (
    <Surface
      header={
        <header className="theme-center__header">
          <div>
            <p className="theme-center__eyebrow">{text('themeCenter.bundled')}</p>
            <h2 id="theme-center-title">{text('themeCenter.title')}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={closeThemeCenter}
            aria-label={text('themeCenter.close')}
          >
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </header>
      }
      sidebar={null}
      installedThemes={
        <>
          <h3 className="theme-center__section-title">{text('themeCenter.installed')}</h3>
          {themes.map((theme) => {
            const Preview = theme.slots.ThemePreview;
            const isActive = theme.id === activeThemeId;

            return (
              <article
                key={theme.id}
                className={`official-theme-card${isActive ? ' is-active' : ''}`}
                data-theme-card-id={theme.id}
              >
                <Preview active={isActive} />
                <div className="official-theme-card__body">
                  <div className="official-theme-card__title-row">
                    <div>
                      <h3>{theme.name[language]}</h3>
                      <p>{theme.name['en-US']}</p>
                    </div>
                    {isActive && (
                      <span className="official-theme-card__active">
                        <CheckCircle2 aria-hidden="true" size={16} strokeWidth={2} />
                        {text('common.enabled')}
                      </span>
                    )}
                  </div>
                  <p className="official-theme-card__tagline">{theme.tagline[language]}</p>
                  <p className="official-theme-card__description">{theme.description[language]}</p>
                  <dl className="official-theme-card__meta">
                    <div>
                      <dt>{text('common.version')}</dt>
                      <dd>{theme.version}</dd>
                    </div>
                    <div>
                      <dt>{text('common.status')}</dt>
                      <dd>{text('themeCenter.bundled')}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="button button--primary"
                    data-testid="theme-center-apply"
                    disabled={isActive}
                    onClick={() => applyTheme(theme.id)}
                  >
                    {isActive ? text('common.inUse') : text('common.enableNow')}
                  </button>
                </div>
              </article>
            );
          })}
        </>
      }
      footer={
        <footer className="theme-center__footer">
          {draftBlocked && (
            <p role="alert" className="ux-error">
              {text('ux.draftDetail')}
            </p>
          )}
          <button
            type="button"
            className="button button--ghost"
            data-testid="theme-center-reset"
            onClick={() => applyTheme(DEFAULT_THEME_ID)}
          >
            <RotateCcw size={15} />
            {text('themeCenter.resetDefault')}
          </button>
          <button type="button" className="button button--secondary" onClick={closeThemeCenter}>
            {text('common.done')}
          </button>
        </footer>
      }
    />
  );
}
