import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, FileText, GitBranch, PanelBottomClose, PanelBottomOpen } from 'lucide-react';
import { analyzeStorySource } from '@plotflow/core';
import { GraphCanvas } from '../branch-graph/GraphCanvas';
import { GraphLabPalette } from './GraphLabPalette';
import { GraphInspector } from './GraphInspector';
import { SourceDrawer } from './SourceDrawer';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { useThemePlatform } from '../ThemePlatformProvider';
import { useAppText } from '../../i18n/appI18n';
import { parsePipelineNow } from '../../services/parsePipeline';
import { graphEditService } from '../../services/graphEditService';

function getFileName(path: string | null, fallback: string): string {
  if (!path) return fallback;
  return path.split(/[/\\]/).pop() || path;
}

function ChapterSourceSliceEditor(): React.ReactElement {
  const content = useEditorStore((state) => state.content);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const activeChapterId = useUIStore((state) => state.activeChapterId);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const [draft, setDraft] = useState('');

  const activeChapter = useMemo(() => {
    if (!plotFlowData) return null;
    return plotFlowData.chapters.find((chapter) => chapter.id === activeChapterId) ?? plotFlowData.chapters[0] ?? null;
  }, [activeChapterId, plotFlowData]);

  const slice = useMemo(() => {
    if (!activeChapter) return null;
    const source = analyzeStorySource(content);
    const chapterRange = source.chapters.find((chapter) => chapter.title === activeChapter.title);
    if (!chapterRange) return null;
    return {
      startOffset: chapterRange.startOffset,
      endOffset: chapterRange.endOffset,
      text: content.slice(chapterRange.startOffset, chapterRange.endOffset),
      newline: source.newline,
    };
  }, [activeChapter, content]);

  useEffect(() => {
    setDraft(slice?.text ?? content);
  }, [content, slice?.text]);

  const commit = useCallback(() => {
    if (!slice) return;
    const nextSlice = slice.newline === '\n' ? draft : draft.replace(/\n/g, slice.newline);
    if (nextSlice === slice.text) return;
    const nextContent = `${content.slice(0, slice.startOffset)}${nextSlice}${content.slice(slice.endOffset)}`;
    useEditorStore.getState().setContent(nextContent);
    parsePipelineNow(nextContent);
    setStatusMessage(`Source slice saved: ${activeChapter?.title ?? 'chapter'}`);
  }, [activeChapter?.title, content, draft, setStatusMessage, slice]);

  return (
    <textarea
      className="source-drawer__slice-editor"
      data-testid="graph-lab-chapter-source-slice"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      spellCheck={false}
      aria-label="Chapter source"
    />
  );
}

export function GraphLabWorkspace(): React.ReactElement {
  const isSourceDrawerOpen = useUIStore((state) => state.isSourceDrawerOpen);
  const toggleSourceDrawer = useUIStore((state) => state.toggleSourceDrawer);
  const setProblemPanelOpen = useUIStore((state) => state.setProblemPanelOpen);
  const activeChapterId = useUIStore((state) => state.activeChapterId);
  const setActiveChapterId = useUIStore((state) => state.setActiveChapterId);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const filePath = useEditorStore((state) => state.filePath);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const { activeTheme } = useThemePlatform();
  const Surface = activeTheme.surfaces.GraphLabShell;
  const text = useAppText();

  const stats = useMemo(() => {
    const chapters = plotFlowData?.chapters.length ?? 0;
    const nodes = plotFlowData?.chapters.reduce((sum, chapter) => sum + chapter.nodes.length, 0) ?? 0;
    const options =
      plotFlowData?.chapters.reduce(
        (sum, chapter) => sum + chapter.nodes.reduce((nodeSum, node) => nodeSum + node.options.length, 0),
        0,
      ) ?? 0;
    return { chapters, nodes, options };
  }, [plotFlowData]);

  const chapters = plotFlowData?.chapters ?? [];

  useEffect(() => {
    if (chapters.length === 0) {
      if (activeChapterId !== null) setActiveChapterId(null);
      return;
    }
    if (!activeChapterId || !chapters.some((chapter) => chapter.id === activeChapterId)) {
      setActiveChapterId(chapters[0]!.id);
    }
  }, [activeChapterId, chapters, setActiveChapterId]);

  const handleNodeNavigate = useCallback((nodeId: string, lineNumber: number) => {
    useGraphStore.getState().selectNode(nodeId);
    const editor = useEditorStore.getState();
    editor.setActiveNodeId(nodeId);
    editor.setCursorPosition(lineNumber, 1);
    const monaco = editor.editorInstance;
    if (monaco) {
      monaco.revealLineInCenter(lineNumber);
      monaco.setPosition({ lineNumber, column: 1 });
      monaco.focus();
    }
  }, []);

  const selectedLabel = selectedNodeId ? selectedNodeId.split('-').slice(1).join('-') || selectedNodeId : text('graphLab.noSelection');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
      const selected = useGraphStore.getState().selectedNodeId ?? useEditorStore.getState().activeNodeId;
      if (!selected) return;
      const node = useStoryStore.getState().getNodeByFullId(selected);
      if (!node) return;
      if (!window.confirm(`Delete node "${node.title}"?`)) return;
      event.preventDefault();
      graphEditService.deleteNode(node);
      useGraphStore.getState().selectNode(null);
      useEditorStore.getState().setActiveNodeId(null);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  return (
    <Surface
      isSourceDrawerOpen={isSourceDrawerOpen}
      commandbar={(
        <header className="graph-lab__commandbar">
          <div className="graph-lab__commandbar-top">
            <div className="graph-lab__commandbar-main">
              <span className="graph-lab__mark" aria-hidden="true">
                <GitBranch size={16} strokeWidth={2.2} />
              </span>
              <div>
                <p className="graph-lab__mode">{text('graphLab.mode')}</p>
                <h2>{getFileName(filePath, text('graphLab.unsavedStory'))}</h2>
              </div>
            </div>

            <div className="graph-lab__commandbar-stats" aria-label={text('graphLab.statsLabel')}>
              <span>{text('graphLab.chapters', { count: stats.chapters })}</span>
              <span>{text('graphLab.nodes', { count: stats.nodes })}</span>
              <span>{text('graphLab.options', { count: stats.options })}</span>
              <button
                type="button"
                className={diagnostics.length > 0 ? 'is-warning' : ''}
                data-testid="graph-lab-diagnostics-button"
                onClick={() => setProblemPanelOpen(true)}
                aria-label={text('graphLab.openProblems', { count: diagnostics.length })}
              >
                {text('graphLab.diagnostics', { count: diagnostics.length })}
              </button>
            </div>

            <div className="graph-lab__commandbar-actions">
              <span className="graph-lab__selection" title={selectedLabel}>
                <Activity aria-hidden="true" size={14} strokeWidth={2} />
                {selectedLabel}
              </span>
              <button
                type="button"
                className="graph-lab-dock-toggle"
                data-testid="graph-lab-source-toggle"
                onClick={toggleSourceDrawer}
                aria-expanded={isSourceDrawerOpen}
              >
                <FileText aria-hidden="true" size={15} strokeWidth={2} />
                <span>{text('graphLab.sourceText')}</span>
                {isSourceDrawerOpen ? (
                  <PanelBottomClose aria-hidden="true" size={15} strokeWidth={2} />
                ) : (
                  <PanelBottomOpen aria-hidden="true" size={15} strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          <div
            className="graph-lab__chapter-tabs"
            role="tablist"
            aria-label="Chapters"
            data-testid="graph-lab-chapter-tabs"
          >
            {chapters.length > 0 ? (
              chapters.map((chapter) => (
                <button
                  key={chapter.id}
                  type="button"
                  role="tab"
                  data-testid="graph-lab-chapter-tab"
                  className={chapter.id === activeChapterId ? 'is-active' : ''}
                  aria-selected={chapter.id === activeChapterId}
                  onClick={() => setActiveChapterId(chapter.id)}
                >
                  {chapter.title || chapter.id}
                </button>
              ))
            ) : (
              <span className="graph-lab__chapter-tabs-empty">{text('palette.outlineEmpty')}</span>
            )}
          </div>
        </header>
      )}
      palette={<GraphLabPalette onNodeNavigate={handleNodeNavigate} />}
      canvas={(
        <section className="graph-lab__canvas" aria-label={text('graphLab.canvasLabel')}>
          <GraphCanvas viewMode="graphLab" />
        </section>
      )}
      inspector={<GraphInspector />}
      sourceDrawer={(
        <SourceDrawer>
          <div className={isSourceDrawerOpen ? 'source-drawer__editor' : 'source-drawer__editor source-drawer--editor-hidden'}>
            <ChapterSourceSliceEditor />
          </div>
        </SourceDrawer>
      )}
    />
  );
}
