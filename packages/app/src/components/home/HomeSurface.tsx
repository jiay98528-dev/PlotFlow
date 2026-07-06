import React, { useCallback } from 'react';
import { ExternalLink, FilePlus2, FolderOpen, GitBranch, Palette, Play } from 'lucide-react';
import { useThemePlatform } from '../ThemePlatformProvider';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { clearPendingSave, saveOrSaveAs } from '../../services/autoSaveService';
import { parsePipelineNow } from '../../services/parsePipeline';
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

  const openFile = useCallback(async () => {
    const editor = useEditorStore.getState();
    if (editor.isDirty) {
      const choice = await window.plotflow.dialog.confirm({
        type: 'warning',
        message: text('home.unsavedConfirmTitle'),
        detail: text('home.unsavedConfirmDetail'),
        buttons: [text('home.saveAndOpen'), text('home.discardAndOpen'), text('common.cancel')],
      });
      if (choice === 0) {
        const saved = await saveOrSaveAs();
        if (!saved) return;
      } else if (choice === 2) {
        return;
      }
    }

    const { FileService } = await import('../../services/fileService');
    const result = await new FileService().openFile();
    clearPendingSave();
    const freshEditor = useEditorStore.getState();
    freshEditor.setDiagnostics([]);
    freshEditor.setActiveNodeId(null);
    freshEditor.setCursorPosition(1, 1);
    freshEditor.setContent(result.content);
    freshEditor.setFilePath(result.path);
    freshEditor.setFileBaseline(result.hash, result.modifiedAt);
    freshEditor.clearPendingExternalChange();
    freshEditor.markSaved();
    useStoryStore.getState().clearParseData();
    useGraphStore.getState().syncFromAST(null);
    parsePipelineNow(result.content);
    setHomeSurfaceOpen(false);
    setStatusMessage(text('status.opened', { path: result.path }));
  }, [setHomeSurfaceOpen, setStatusMessage, text]);

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
          <button type="button" className="button button--primary" onClick={() => setHomeSurfaceOpen(false)}>
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
