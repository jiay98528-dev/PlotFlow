import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, ExternalLink, Palette, RefreshCw, RotateCcw, X } from 'lucide-react';
import { DEFAULT_THEME_ID } from '../../theme-platform/registry';
import { useThemePlatform } from '../../components/ThemePlatformProvider';
import { useUIStore } from '../../stores/uiStore';
import type { OfficialThemeRemoteView } from '../../theme-platform/types';

export function ThemeCenter(): React.ReactElement | null {
  const isOpen = useUIStore((state) => state.isThemeCenterOpen);
  const closeThemeCenter = useUIStore((state) => state.closeThemeCenter);
  const setActiveThemeId = useUIStore((state) => state.setActiveThemeId);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const { activeThemeId, themes, refreshOfficialThemes, activeTheme } = useThemePlatform();
  const Surface = activeTheme.surfaces.ThemeCenterSurface;
  const [remoteThemes, setRemoteThemes] = useState<readonly OfficialThemeRemoteView[]>([]);
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [downloadingThemeId, setDownloadingThemeId] = useState<string | null>(null);

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
            <h2 id="theme-center-title">官方主题中心</h2>
            <p>
              PlotFlow 只支持官方主题。免费主题可远程下载、更新并立即生效，不会修改
              <code>.mdstory</code> 内容。
            </p>
          </div>
          <button type="button" className="icon-button" onClick={closeThemeCenter} aria-label="关闭主题中心">
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </button>
        </header>
      )}
      sidebar={(
        <aside className="theme-center__sidebar">
          <div className="theme-center__note">
            <Palette aria-hidden="true" size={18} strokeWidth={2} />
            <div>
              <strong>官方免费主题</strong>
              <p>官方主题可以控制节点、连线、面板、UX 布局、Monaco 配色、透明度、尺寸和动效。</p>
            </div>
          </div>
          <button type="button" className="button button--secondary" data-testid="theme-center-store" onClick={openStore}>
            <ExternalLink aria-hidden="true" size={15} strokeWidth={2} />
            <span>浏览官方免费主题</span>
          </button>
          <button
            type="button"
            className="button button--secondary"
            data-testid="theme-center-refresh-remote"
            onClick={() => void refreshRemoteCatalog()}
          >
            <RefreshCw aria-hidden="true" size={15} strokeWidth={2} />
            <span>{isRemoteLoading ? '正在刷新' : '刷新免费主题库'}</span>
          </button>
          <button
            type="button"
            className="button button--ghost"
            data-testid="theme-center-reset"
            onClick={() => applyTheme(DEFAULT_THEME_ID)}
          >
            <RotateCcw aria-hidden="true" size={15} strokeWidth={2} />
            <span>恢复默认主题</span>
          </button>
        </aside>
      )}
      installedThemes={(
        <>
          <h3 className="theme-center__section-title">已安装官方主题</h3>
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
        </>
      )}
      remoteThemes={(
        <>
          <h3 className="theme-center__section-title">官方免费主题库</h3>
          {remoteThemes.length === 0 ? (
            <p className="theme-center__empty" data-testid="theme-center-remote-empty">
              {isRemoteLoading ? '正在读取官方主题库...' : '当前离线或暂无远程主题；已安装主题不受影响。'}
            </p>
          ) : (
            remoteThemes.map((theme) => {
              const installedDescriptor = themes.find((item) => item.id === theme.id);
              const isActive = theme.id === activeThemeId;
              const isBusy = downloadingThemeId === theme.id;
              const buttonLabel = isActive
                ? '正在使用'
                : theme.status === 'notInstalled'
                  ? '下载'
                  : theme.status === 'updateAvailable'
                    ? '更新'
                    : '启用';

              return (
                <article
                  key={theme.id}
                  className={`official-theme-card official-theme-card--remote${isActive ? ' is-active' : ''}`}
                  data-theme-card-id={theme.id}
                  data-testid="official-remote-theme-card"
                >
                  <div className="official-theme-preview official-theme-preview--remote">
                    <div className="official-theme-preview__canvas">
                      <div className="official-theme-preview__node official-theme-preview-node-main">
                        <span />
                        <strong>{theme.name['zh-CN']}</strong>
                        <em>{theme.channel}</em>
                      </div>
                    </div>
                  </div>
                  <div className="official-theme-card__body">
                    <div className="official-theme-card__title-row">
                      <div>
                        <h3>{theme.name['zh-CN']}</h3>
                        <p>{theme.name['en-US']}</p>
                      </div>
                      <span className="official-theme-card__active">{theme.priceLabel}</span>
                    </div>
                    <p className="official-theme-card__description">{theme.changelog}</p>
                    <dl className="official-theme-card__meta">
                      <div>
                        <dt>远程版本</dt>
                        <dd>{theme.version}</dd>
                      </div>
                      <div>
                        <dt>本地版本</dt>
                        <dd>{theme.installedVersion ?? '未安装'}</dd>
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
                      <span>{isBusy ? '处理中...' : buttonLabel}</span>
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
          <p>仅支持官方主题：内置主题和官方远程免费主题。当前不提供本地导入或非官方来源。</p>
          <button type="button" className="button button--secondary" onClick={closeThemeCenter}>
            完成
          </button>
        </footer>
      )}
    />
  );
}
