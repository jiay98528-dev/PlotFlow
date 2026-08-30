import React, { useCallback } from 'react';
import { FilePlus2, FolderOpen, GitBranch, Palette, Play } from 'lucide-react';
import { useThemePlatform } from '../ThemePlatformProvider';
import { useEditorStore } from '../../stores/editorStore';
import { useUIStore } from '../../stores/uiStore';
import { clearRecentStory, readRecentStory } from '../../services/recentFileService';
import { FileService } from '../../services/fileService';
import { runStoryReplacement } from '../../services/storyTransactionService';
import { useAppText } from '../../i18n/appI18n';
import { requestWorkspaceMode } from '../../services/workspaceModeService';
import { BrandLockup } from '../brand/BrandLockup';

export function HomeSurface(): React.ReactElement | null {
  const isOpen = useUIStore((state) => state.isHomeSurfaceOpen);
  const openNewFileDialog = useUIStore((state) => state.openNewFileDialog);
  const openThemeCenter = useUIStore((state) => state.openThemeCenter);
  const setHomeSurfaceOpen = useUIStore((state) => state.setHomeSurfaceOpen);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const language = useUIStore((state) => state.language);
  const filePath = useEditorStore((state) => state.filePath);
  const isDirty = useEditorStore((state) => state.isDirty);
  const { activeThemeId, themes, activeTheme } = useThemePlatform();
  const Surface = activeTheme.surfaces.HomeSurface;
  const text = useAppText();

  const continueEditing = useCallback(async () => {
    if (filePath) {
      setHomeSurfaceOpen(false);
      return;
    }

    const recent = readRecentStory();
    if (!recent) {
      setStatusMessage(text('home.noRecentFile'));
      setHomeSurfaceOpen(false);
      return;
    }

    if (!window.plotflow?.file?.readByPath) {
      setStatusMessage(text('file.readIpcUnavailable'));
      return;
    }

    let openedPath = recent.filePath;
    let changedOnDisk = false;
    const replacement = await runStoryReplacement('open', async () => {
      const result = await window.plotflow.file.readByPath(recent.filePath);
      if (!result) {
        clearRecentStory();
        setStatusMessage(text('file.cannotRead', { path: recent.filePath }));
        return null;
      }
      openedPath = result.filePath.replace(/\\/g, '/');
      changedOnDisk = result.hash !== recent.hash;
      return {
        kind: 'saved',
        filePath: openedPath,
        content: result.content,
        hash: result.hash,
        modifiedAt: result.modifiedAt,
        closeHome: true,
      } as const;
    });
    if (replacement.status !== 'committed') return;
    setStatusMessage(
      changedOnDisk
        ? text('home.continueLoadedCurrent', { path: openedPath })
        : text('status.opened', { path: openedPath }),
    );
  }, [filePath, setHomeSurfaceOpen, setStatusMessage, text]);

  const openFile = useCallback(async () => {
    let openedPath = '';
    const replacement = await runStoryReplacement('open', async () => {
      try {
        const result = await new FileService().openFile();
        openedPath = result.path;
        return {
          kind: 'saved',
          filePath: result.path,
          content: result.content,
          hash: result.hash,
          modifiedAt: result.modifiedAt,
          closeHome: true,
        } as const;
      } catch (error) {
        if (error instanceof Error && error.message.includes('取消')) return null;
        throw error;
      }
    });
    if (replacement.status === 'failed') {
      setStatusMessage(replacement.error instanceof Error ? replacement.error.message : String(replacement.error));
    } else if (replacement.status === 'committed') {
      setStatusMessage(text('status.opened', { path: openedPath }));
    }
  }, [setStatusMessage, text]);

  if (!isOpen) return null;

  const displayedTheme = themes.find((theme) => theme.id === activeThemeId) ?? activeTheme;
  const ActivePreview = displayedTheme.slots.HomePreview;

  return (
    <Surface
      heroCopy={(
        <>
          <BrandLockup variant="hero" />
          <span className="home-surface__version">{text('appShell.version')}</span>
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
              openNewFileDialog();
              setHomeSurfaceOpen(false);
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
              requestWorkspaceMode('graphLab');
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
            <small>{text('themeCenter.note')}</small>
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
