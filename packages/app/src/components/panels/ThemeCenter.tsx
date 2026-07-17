import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, Palette, RefreshCw, RotateCcw, X } from 'lucide-react';
import { DEFAULT_THEME_ID } from '../../theme-platform/registry';
import { useThemePlatform } from '../../components/ThemePlatformProvider';
import { useUIStore } from '../../stores/uiStore';
import type { OfficialThemeRemoteView } from '../../theme-platform/types';
import { useAppText } from '../../i18n/appI18n';
import { ThemeAssetPreview } from '../theme/ThemeAssetPreview';

export function ThemeCenter(): React.ReactElement | null {
  const isOpen = useUIStore((state) => state.isThemeCenterOpen);
  const closeThemeCenter = useUIStore((state) => state.closeThemeCenter);
  const setActiveThemeId = useUIStore((state) => state.setActiveThemeId);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const language = useUIStore((state) => state.language);
  const { activeThemeId, themes, refreshOfficialThemes, activeTheme } = useThemePlatform();
  const Surface = activeTheme.surfaces.ThemeCenterSurface;
  const [remoteThemes, setRemoteThemes] = useState<readonly OfficialThemeRemoteView[]>([]);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [downloadingThemeId, setDownloadingThemeId] = useState<string | null>(null);
  const text = useAppText();

  const refreshRemoteCatalog = async (): Promise<void> => {
    setIsRemoteLoading(true);
    try {
      setRemoteThemes(await window.plotflow.theme.listOfficialRemote());
    } catch {
      setRemoteThemes([]);
    } finally {
      setIsRemoteLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void refreshRemoteCatalog();
  }, [isOpen]);

  if (!isOpen) return null;

  const applyTheme = (themeId: string): void => {
    setActiveThemeId(themeId);
  };

  const openStore = async (): Promise<void> => {
    await window.plotflow?.theme?.openOfficialThemeStore?.();
  };

  const downloadTheme = async (themeId: string): Promise<void> => {
    setDownloadingThemeId(themeId);
    try {
      const result = await window.plotflow.theme.downloadOfficialTheme(themeId);
      setStatusMessage(result.message);
      if (result.ok) {
        await refreshOfficialThemes();
        await refreshRemoteCatalog();
      }
    } finally {
      setDownloadingThemeId(null);
    }
  };

  return (
    <Surface
      header={(
        <header className="theme-center__header">
          <div>
            <p className="theme-center__eyebrow">Official Free Themes</p>
            <h2 id="theme-center-title">{text('themeCenter.title')}</h2>
            <p>
              {text('themeCenter.intro')}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={closeThemeCenter} aria-label={text('themeCenter.close')}>
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </header>
      )}
      sidebar={(
        <aside className="theme-center__sidebar">
          <div className="theme-center__note">
            <Palette aria-hidden="true" size={18} strokeWidth={2} />
            <div>
              <strong>{text('themeCenter.officialFreeThemes')}</strong>
              <p>{text('themeCenter.note')}</p>
            </div>
          </div>
          <button type="button" className="button button--secondary" data-testid="theme-center-store" onClick={openStore}>
            <ExternalLink aria-hidden="true" size={15} strokeWidth={2} />
            <span>{text('themeCenter.browse')}</span>
          </button>
          <button
            type="button"
            className="button button--secondary"
            data-testid="theme-center-refresh-remote"
            onClick={() => void refreshRemoteCatalog()}
          >
            <RefreshCw aria-hidden="true" size={15} strokeWidth={2} />
            <span>{isRemoteLoading ? text('themeCenter.refreshing') : text('themeCenter.refreshCatalog')}</span>
          </button>
          <button
            type="button"
            className="button button--ghost"
            data-testid="theme-center-reset"
            onClick={() => applyTheme(DEFAULT_THEME_ID)}
          >
            <RotateCcw aria-hidden="true" size={15} strokeWidth={2} />
            <span>{text('themeCenter.resetDefault')}</span>
          </button>
        </aside>
      )}
      installedThemes={(
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
                      <dd>
                        {theme.storeMeta.availability === 'bundled'
                          ? text('themeCenter.bundled')
                          : text('themeCenter.free')}
                      </dd>
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
      )}
      remoteThemes={(
        <>
          <h3 className="theme-center__section-title">{text('themeCenter.remote')}</h3>
          {remoteThemes.length === 0 ? (
            <p className="theme-center__empty" data-testid="theme-center-remote-empty">
              {isRemoteLoading ? text('themeCenter.emptyRemoteLoading') : text('themeCenter.emptyRemote')}
            </p>
          ) : (
            remoteThemes.map((theme) => {
              const installedDescriptor = themes.find((item) => item.id === theme.id);
              const isActive = theme.id === activeThemeId;
              const isBusy = downloadingThemeId === theme.id;
              const buttonLabel = isActive
                ? text('common.inUse')
                : theme.status === 'notInstalled'
                  ? text('common.download')
                  : theme.status === 'updateAvailable'
                    ? text('common.update')
                    : text('common.enableNow');

              return (
                <article
                  key={theme.id}
                  className={`official-theme-card official-theme-card--remote${isActive ? ' is-active' : ''}`}
                  data-theme-card-id={theme.id}
                  data-testid="official-remote-theme-card"
                >
                  {installedDescriptor ? (
                    <ThemeAssetPreview
                      themeId={installedDescriptor.id}
                      src={installedDescriptor.assets.preview}
                      label={`${installedDescriptor.name[language]} Graph Lab`}
                      active={isActive}
                    />
                  ) : (
                    <div
                      className="official-theme-preview official-theme-preview--remote"
                      data-preview-theme-id={theme.id}
                    >
                      <div className="official-theme-preview__fallback" role="img" aria-label={theme.name[language]}>
                        <Download aria-hidden="true" size={22} strokeWidth={1.8} />
                        <span>{theme.name[language]}</span>
                        <small>{text('common.notInstalled')}</small>
                      </div>
                    </div>
                  )}
                  <div className="official-theme-card__body">
                    <div className="official-theme-card__title-row">
                      <div>
                        <h3>{theme.name[language]}</h3>
                        <p>{theme.name['en-US']}</p>
                      </div>
                      <span className="official-theme-card__active">{text('themeCenter.free')}</span>
                    </div>
                    <p className="official-theme-card__description">{theme.changelog}</p>
                    <dl className="official-theme-card__meta">
                      <div>
                        <dt>{text('themeCenter.remoteVersion')}</dt>
                        <dd>{theme.version}</dd>
                      </div>
                      <div>
                        <dt>{text('themeCenter.localVersion')}</dt>
                        <dd>{theme.installedVersion ?? text('common.notInstalled')}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      className="button button--primary"
                      data-testid="theme-center-remote-action"
                      disabled={isActive || isBusy}
                      onClick={() => {
                        if (theme.status === 'installed' && installedDescriptor) {
                          applyTheme(theme.id);
                          return;
                        }
                        void downloadTheme(theme.id);
                      }}
                    >
                      <Download aria-hidden="true" size={15} strokeWidth={2} />
                      <span>{isBusy ? text('common.processing') : buttonLabel}</span>
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </>
      )}
      footer={(
        <footer className="theme-center__footer">
          <p>{text('themeCenter.footer')}</p>
          <button type="button" className="button button--secondary" onClick={closeThemeCenter}>
            {text('common.done')}
          </button>
        </footer>
      )}
    />
  );
}
