import React, { useCallback } from 'react';
import { ExternalLink, FilePlus2, FolderOpen, GitBranch, Palette, Play } from 'lucide-react';
import { useThemePlatform } from '../ThemePlatformProvider';
import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';
import { clearRecentStory, readRecentStory, rememberOpenedStory } from '../../services/recentFileService';
import { loadSavedStorySession } from '../../services/storySessionService';
import { confirmBeforeReplacingCurrentStory } from '../../services/storyReplaceGuard';
import { useAppText } from '../../i18n/appI18n';

export function HomeSurface(): React.ReactElement | null {
  const isOpen = useUIStore((state) => state.isHomeSurfaceOpen);
  const openNewFileDialog = useUIStore((state) => state.openNewFileDialog);
  const openThemeCenter = useUIStore((state) => state.openThemeCenter);
  const setHomeSurfaceOpen = useUIStore((state) => state.setHomeSurfaceOpen);
  const setWorkspaceMode = useUIStore((state) => state.setWorkspaceMode);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const language = useUIStore((state) => state.language);
  const filePath = useEditorStore((state) => state.filePath);
  const isDirty = useEditorStore((state) => state.isDirty);
  const { activeThemeId, themes, activeTheme } = useThemePlatform();
  const Surface = activeTheme.surfaces.HomeSurface;
  const text = useAppText();

  const loadStory = useCallback((path: string, storyContent: string, hash: string, modifiedAt: number) => {
    loadSavedStorySession({ filePath: path, content: storyContent, hash, modifiedAt, closeHome: true });
  }, []);

  const continueEditing = useCallback(async () => {
    if (filePath) {
      setHomeSurfaceOpen(false);
      return;
    }

    const recent = readRecentStory();
    if (!recent) {
      setStatusMessage('No recent saved .mdstory file found.');
      setHomeSurfaceOpen(false);
      return;
    }

    const canReplace = await confirmBeforeReplacingCurrentStory('open');
    if (!canReplace) return;

    if (!window.plotflow?.file?.readByPath) {
      setStatusMessage(text('file.readIpcUnavailable'));
      return;
    }

    const result = await window.plotflow.file.readByPath(recent.filePath);
    if (!result) {
      clearRecentStory();
      setStatusMessage(text('file.cannotRead', { path: recent.filePath }));
      return;
    }

    rememberOpenedStory(result);
    const normalizedPath = result.filePath.replace(/\\/g, '/');
    loadStory(normalizedPath, result.content, result.hash, result.modifiedAt);
    setStatusMessage(
      result.hash !== recent.hash
        ? `Continue editing loaded the current disk version of ${normalizedPath}.`
        : text('status.opened', { path: normalizedPath }),
    );
  }, [filePath, loadStory, setHomeSurfaceOpen, setStatusMessage, text]);

  const openFile = useCallback(async () => {
    const canReplace = await confirmBeforeReplacingCurrentStory('open');
    if (!canReplace) return;

    const { FileService } = await import('../../services/fileService');
    const result = await new FileService().openFile();
    loadStory(result.path, result.content, result.hash, result.modifiedAt);
    setStatusMessage(text('status.opened', { path: result.path }));
  }, [loadStory, setStatusMessage, text]);

  if (!isOpen) return null;

  const displayedTheme = themes.find((theme) => theme.id === activeThemeId) ?? activeTheme;
  const ActivePreview = displayedTheme.slots.HomePreview;

  return (
    <Surface
      heroCopy={(
        <>
          <p className="home-surface__eyebrow">PlotFlow Official Workbench</p>
          <h2>{text('home.title')}</h2>
          <p>
            {text('home.body')}
          </p>
        </>
      )}
      preview={(
        <div className="home-surface__preview" data-active-official-theme={displayedTheme.id}>
          <ActivePreview active />
          <div className="home-surface__current">
            <span>{text('home.currentTheme')}</span>
            <strong>{displayedTheme.name[language]}</strong>
          </div>
        </div>
      )}
      actions={(
        <>
          <button type="button" className="button button--primary" onClick={() => { void continueEditing(); }}>
            <Play aria-hidden="true" size={16} strokeWidth={2} />
            <span>{text('home.continue')}</span>
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              void (async () => {
                const canReplace = await confirmBeforeReplacingCurrentStory('new');
                if (!canReplace) return;
                openNewFileDialog();
                setHomeSurfaceOpen(false);
              })();
            }}
          >
            <FilePlus2 aria-hidden="true" size={16} strokeWidth={2} />
            <span>{text('home.newStory')}</span>
          </button>
          <button type="button" className="button button--secondary" onClick={openFile}>
            <FolderOpen aria-hidden="true" size={16} strokeWidth={2} />
            <span>{text('home.openFile')}</span>
          </button>
        </>
      )}
      cards={(
        <>
          <button
            type="button"
            className="home-action-card"
            data-testid="home-open-graph-lab"
            onClick={() => {
              setWorkspaceMode('graphLab');
              setHomeSurfaceOpen(false);
            }}
          >
            <GitBranch aria-hidden="true" size={20} strokeWidth={2} />
            <span>{text('home.graphLabTitle')}</span>
            <small>{text('home.graphLabDesc')}</small>
          </button>
          <button type="button" className="home-action-card" data-testid="home-open-theme-center" onClick={openThemeCenter}>
            <Palette aria-hidden="true" size={20} strokeWidth={2} />
            <span>{text('home.themeCenterTitle')}</span>
            <small>{text('home.themeCenterDesc')}</small>
          </button>
          <button type="button" className="home-action-card" data-testid="home-open-theme-store" onClick={openThemeCenter}>
            <ExternalLink aria-hidden="true" size={20} strokeWidth={2} />
            <span>{text('home.themeStoreTitle')}</span>
            <small>{text('home.themeStoreDesc')}</small>
          </button>
        </>
      )}
      status={(
        <>
          <span>{filePath ? text('home.currentFile', { path: filePath }) : text('home.currentFileUnsaved')}</span>
          <span>{isDirty ? text('home.dirty') : text('home.synced')}</span>
        </>
      )}
    />
  );
}
