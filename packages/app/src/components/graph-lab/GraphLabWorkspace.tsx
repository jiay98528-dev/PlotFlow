import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileText,
  GitBranch,
  ListChecks,
  PanelBottomClose,
  PanelBottomOpen,
  RotateCcw,
  Save,
} from 'lucide-react';
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
import { graphEditService, StorySourceEditService, type TextEdit } from '../../services/graphEditService';

function getFileName(path: string | null, fallback: string): string {
  if (!path) return fallback;
  return path.split(/[/\\]/).pop() || path;
}

interface ChapterSourceSlice {
  readonly chapterId: string;
  readonly chapterTitle: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly text: string;
  readonly newline: '\n' | '\r\n' | '\r';
}

interface ChapterSourceSliceEditorHandle {
  readonly saveBeforeChapterChange: () => boolean;
}

const ChapterSourceSliceEditor = React.forwardRef<ChapterSourceSliceEditorHandle>(function ChapterSourceSliceEditor(
  _props,
  ref,
): React.ReactElement {
  const content = useEditorStore((state) => state.content);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const activeChapterId = useUIStore((state) => state.activeChapterId);
  const isSourceDrawerOpen = useUIStore((state) => state.isSourceDrawerOpen);
  const setStatusMessage = useUIStore((state) => state.setStatusMessage);
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [baseline, setBaseline] = useState<ChapterSourceSlice | null>(null);
  const baselineRef = useRef<ChapterSourceSlice | null>(null);
  const contentRef = useRef(content);
  const isStaleRef = useRef(false);
  const text = useAppText();
  const setDraftValue = useCallback((value: string) => {
    draftRef.current = value;
    setDraft(value);
  }, []);

  const { activeChapter, activeChapterIndex } = useMemo(() => {
    if (!plotFlowData) return { activeChapter: null, activeChapterIndex: -1 };
    const chapterIndex = Math.max(
      0,
      plotFlowData.chapters.findIndex((chapter) => chapter.id === activeChapterId),
    );
    return {
      activeChapter: plotFlowData.chapters[chapterIndex] ?? null,
      activeChapterIndex: chapterIndex,
    };
  }, [activeChapterId, plotFlowData]);

  const slice = useMemo<ChapterSourceSlice | null>(() => {
    if (!activeChapter) return null;
    const source = analyzeStorySource(content);
    const chapterRange = source.chapters[activeChapterIndex]
      ?? source.chapters.find((chapter) => chapter.title === activeChapter.title);
    if (!chapterRange) return null;
    return {
      chapterId: activeChapter.id,
      chapterTitle: activeChapter.title || activeChapter.id,
      startLine: chapterRange.startLine,
      endLine: chapterRange.endLine,
      startOffset: chapterRange.startOffset,
      endOffset: chapterRange.endOffset,
      text: content.slice(chapterRange.startOffset, chapterRange.endOffset),
      newline: source.newline,
    };
  }, [activeChapter, activeChapterIndex, content]);

  useEffect(() => {
    if (!slice) {
      setBaseline(null);
      setDraftValue('');
      return;
    }

    if (!isSourceDrawerOpen) {
      setDraftValue(slice.text);
      setBaseline(slice);
      return;
    }

    setBaseline((current) => {
      const dirty = current?.chapterId === slice.chapterId && draftRef.current !== current.text;
      if (dirty) return current;
      setDraftValue(slice.text);
      return slice;
    });
  }, [isSourceDrawerOpen, setDraftValue, slice]);

  const isDirty = baseline ? draft !== baseline.text : false;
  const isStale = Boolean(
    baseline
    && slice
    && (
      baseline.chapterId !== slice.chapterId
      || baseline.startOffset !== slice.startOffset
      || baseline.endOffset !== slice.endOffset
      || baseline.text !== slice.text
    ),
  );
  baselineRef.current = baseline;
  contentRef.current = content;
  isStaleRef.current = isStale;
  const diagnosticsInSlice = useMemo(() => {
    if (!slice) return [];
    return diagnostics.filter((diagnostic) =>
      diagnostic.range.startLine >= slice.startLine && diagnostic.range.startLine <= slice.endLine,
    );
  }, [diagnostics, slice]);
  const diagnosticCount = diagnosticsInSlice.length;
  const statusState = isStale ? 'stale' : isDirty ? 'dirty' : diagnosticCount > 0 ? 'warning' : 'saved';

  const commit = useCallback(() => {
    const currentBaseline = baselineRef.current;
    const currentDraft = textareaRef.current?.value ?? draftRef.current;
    const dirtyNow = currentBaseline ? currentDraft !== currentBaseline.text : false;
    if (!currentBaseline || !dirtyNow || isStaleRef.current) return false;
    const currentContent = contentRef.current;
    const nextSlice = currentBaseline.newline === '\n' ? currentDraft : currentDraft.replace(/\n/g, currentBaseline.newline);
    const nextContent = `${currentContent.slice(0, currentBaseline.startOffset)}${nextSlice}${currentContent.slice(currentBaseline.endOffset)}`;
    const edit: TextEdit = {
      range: {
        startOffset: currentBaseline.startOffset,
        endOffset: currentBaseline.endOffset,
      },
      text: nextSlice,
    };
    StorySourceEditService.commit(nextContent, 'graph-lab-save-chapter-source-slice', [edit]);
    setDraftValue(nextSlice);
    setStatusMessage(text('sourceDock.savedSlice', { title: currentBaseline.chapterTitle }));
    setBaseline({
      ...currentBaseline,
      endOffset: currentBaseline.startOffset + nextSlice.length,
      text: nextSlice,
    });
    return true;
  }, [setDraftValue, setStatusMessage, text]);

  useImperativeHandle(ref, () => ({
    saveBeforeChapterChange: () => {
      if (isStaleRef.current) {
        setStatusMessage(text('sourceDock.switchBlockedStale'));
        return false;
      }
      const currentBaseline = baselineRef.current;
      const currentDraft = textareaRef.current?.value ?? draftRef.current;
      const dirtyNow = currentBaseline ? currentDraft !== currentBaseline.text : false;
      if (dirtyNow) return commit();
      return true;
    },
  }), [commit, setStatusMessage, text]);

  const revert = useCallback(() => {
    const nextBaseline = slice ?? baseline;
    if (!nextBaseline) return;
    setDraftValue(nextBaseline.text);
    setBaseline(nextBaseline);
    setStatusMessage(text('sourceDock.revertedSlice', { title: nextBaseline.chapterTitle }));
  }, [baseline, setDraftValue, setStatusMessage, slice, text]);

  const jumpToDiagnostic = useCallback((lineNumber: number) => {
    const editor = useEditorStore.getState();
    editor.setCursorPosition(lineNumber, 1);
    const monaco = editor.editorInstance;
    if (monaco) {
      monaco.revealLineInCenter(lineNumber);
      monaco.setPosition({ lineNumber, column: 1 });
      monaco.focus();
    }
  }, []);

  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === 'Escape' && (isDirty || isStale)) {
      event.preventDefault();
      revert();
    }
  }, [commit, isDirty, isStale, revert]);

  if (!slice && !baseline) {
    return (
      <div className="source-drawer__empty" data-testid="graph-lab-chapter-source-empty">
        <AlertTriangle aria-hidden="true" size={16} strokeWidth={2} />
        <span>{text('sourceDock.noSlice')}</span>
      </div>
    );
  }

  const displaySlice = baseline ?? slice;

  return (
    <div className="source-drawer__slice" data-testid="graph-lab-chapter-source-panel">
      <div className="source-drawer__slice-toolbar">
        <div>
          <strong>{displaySlice?.chapterTitle ?? text('sourceDock.unknownChapter')}</strong>
          <span>
            {displaySlice
              ? text('sourceDock.lineRange', { start: displaySlice.startLine, end: displaySlice.endLine })
              : text('sourceDock.noLineRange')}
          </span>
        </div>
        <div className="source-drawer__slice-status" data-state={statusState} aria-live="polite">
          {statusState === 'saved' ? (
            <CheckCircle2 aria-hidden="true" size={14} strokeWidth={2} />
          ) : statusState === 'warning' ? (
            <ListChecks aria-hidden="true" size={14} strokeWidth={2} />
          ) : (
            <AlertTriangle aria-hidden="true" size={14} strokeWidth={2} />
          )}
          <span>
            {statusState === 'stale'
              ? text('sourceDock.stale')
              : statusState === 'dirty'
                ? text('sourceDock.dirty')
                : statusState === 'warning'
                  ? text('sourceDock.diagnostics', { count: diagnosticCount })
                  : text('sourceDock.saved')}
          </span>
        </div>
        <button type="button" className="source-drawer__slice-action" onClick={revert} disabled={!isDirty && !isStale}>
          <RotateCcw aria-hidden="true" size={14} strokeWidth={2} />
          <span>{text('sourceDock.revert')}</span>
        </button>
        <button type="button" className="source-drawer__slice-action source-drawer__slice-action-primary" onClick={commit} disabled={!isDirty || isStale}>
          <Save aria-hidden="true" size={14} strokeWidth={2} />
          <span>{text('sourceDock.save')}</span>
        </button>
      </div>
      {isStale && <p className="source-drawer__slice-message">{text('sourceDock.staleDetail')}</p>}
      {diagnosticCount > 0 && !isStale && (
        <div id="graph-lab-chapter-source-diagnostics" className="source-drawer__slice-diagnostics" data-testid="graph-lab-chapter-source-diagnostics">
          <strong>{text('sourceDock.diagnosticsInSlice', { count: diagnosticCount })}</strong>
          <ul>
            {diagnosticsInSlice.slice(0, 4).map((diagnostic, index) => (
              <li key={diagnostic.id}>
                <button
                  type="button"
                  className="source-drawer__slice-diagnostic-button"
                  data-severity={diagnostic.severity}
                  data-testid={`graph-lab-source-diagnostic-${index}`}
                  onClick={() => jumpToDiagnostic(diagnostic.range.startLine)}
                >
                  <span>{diagnostic.code}</span>
                  <small>{text('sourceDock.jumpToLine', { line: diagnostic.range.startLine })}</small>
                  <em>{diagnostic.message}</em>
                </button>
              </li>
            ))}
          </ul>
          {diagnosticCount > 4 && <p>{text('sourceDock.moreDiagnostics', { count: diagnosticCount - 4 })}</p>}
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="source-drawer__slice-editor"
        data-testid="graph-lab-chapter-source-slice"
        value={draft}
        onChange={(event) => setDraftValue(event.target.value)}
        onKeyDown={handleEditorKeyDown}
        spellCheck={false}
        aria-label={text('sourceDock.chapterSourceAria')}
        aria-describedby={diagnosticCount > 0 ? 'graph-lab-chapter-source-diagnostics' : undefined}
      />
    </div>
  );
});

export function GraphLabWorkspace(): React.ReactElement {
  const isSourceDrawerOpen = useUIStore((state) => state.isSourceDrawerOpen);
  const toggleSourceDrawer = useUIStore((state) => state.toggleSourceDrawer);
  const setProblemPanelOpen = useUIStore((state) => state.setProblemPanelOpen);
  const activeChapterId = useUIStore((state) => state.activeChapterId);
  const setActiveChapterId = useUIStore((state) => state.setActiveChapterId);
  const content = useEditorStore((state) => state.content);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const filePath = useEditorStore((state) => state.filePath);
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const { activeTheme } = useThemePlatform();
  const Surface = activeTheme.surfaces.GraphLabShell;
  const text = useAppText();
  const sourceSliceRef = useRef<ChapterSourceSliceEditorHandle>(null);

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
  const sourceAnalysis = useMemo(() => analyzeStorySource(content), [content]);
  const saveSourceSliceBeforeChapterChange = useCallback(() => (
    sourceSliceRef.current?.saveBeforeChapterChange() ?? true
  ), []);
  const switchActiveChapter = useCallback((chapterId: string) => {
    if (chapterId === activeChapterId) return true;
    if (!saveSourceSliceBeforeChapterChange()) return false;
    setActiveChapterId(chapterId);
    return true;
  }, [activeChapterId, saveSourceSliceBeforeChapterChange, setActiveChapterId]);

  useEffect(() => {
    if (chapters.length === 0) {
      if (activeChapterId !== null) setActiveChapterId(null);
      return;
    }
    if (!activeChapterId || !chapters.some((chapter) => chapter.id === activeChapterId)) {
      if (saveSourceSliceBeforeChapterChange()) setActiveChapterId(chapters[0]!.id);
    }
  }, [activeChapterId, chapters, saveSourceSliceBeforeChapterChange, setActiveChapterId]);

  const handleNodeNavigate = useCallback((nodeId: string, lineNumber: number, chapterId: string) => {
    if (!switchActiveChapter(chapterId)) return;
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
  }, [switchActiveChapter]);

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
      if (!window.confirm(text('inspector.confirmDeleteNode', { title: node.title }))) return;
      event.preventDefault();
      graphEditService.deleteNode(node);
      useGraphStore.getState().selectNode(null);
      useEditorStore.getState().setActiveNodeId(null);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [text]);

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
            aria-label={text('graphLab.chapterTabsLabel')}
            data-testid="graph-lab-chapter-tabs"
          >
            {chapters.length > 0 ? (
              chapters.map((chapter, index) => {
                const chapterSource = sourceAnalysis.chapters[index];
                const chapterDiagnostics = chapterSource
                  ? diagnostics.filter((diagnostic) =>
                    diagnostic.range.startLine >= chapterSource.startLine && diagnostic.range.startLine <= chapterSource.endLine,
                  ).length
                  : 0;
                const selected = chapter.id === activeChapterId;
                return (
                  <button
                    key={chapter.id}
                    id={`graph-lab-chapter-tab-${index}`}
                    type="button"
                    role="tab"
                    data-testid="graph-lab-chapter-tab"
                    className={selected ? 'is-active' : ''}
                    aria-selected={selected}
                    aria-controls="graph-lab-canvas"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => switchActiveChapter(chapter.id)}
                  >
                    <span className="graph-lab__chapter-tab-title">{chapter.title || chapter.id}</span>
                    <span className="graph-lab__chapter-tab-meta">
                      {text('graphLab.chapterNodeCount', { count: chapter.nodes.length })}
                    </span>
                    {chapterDiagnostics > 0 && (
                      <span className="graph-lab__chapter-tab-diagnostics">
                        {text('graphLab.chapterDiagnosticCount', { count: chapterDiagnostics })}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <span className="graph-lab__chapter-tabs-empty">{text('palette.outlineEmpty')}</span>
            )}
          </div>
        </header>
      )}
      palette={(
        <GraphLabPalette
          onNodeNavigate={handleNodeNavigate}
          onBeforeGraphMutation={saveSourceSliceBeforeChapterChange}
        />
      )}
      canvas={(
        <section id="graph-lab-canvas" className="graph-lab__canvas" aria-label={text('graphLab.canvasLabel')}>
          <GraphCanvas viewMode="graphLab" />
        </section>
      )}
      inspector={<GraphInspector />}
      sourceDrawer={(
        <SourceDrawer>
          <div className={isSourceDrawerOpen ? 'source-drawer__editor' : 'source-drawer__editor source-drawer--editor-hidden'}>
            <ChapterSourceSliceEditor ref={sourceSliceRef} />
          </div>
        </SourceDrawer>
      )}
    />
  );
}
