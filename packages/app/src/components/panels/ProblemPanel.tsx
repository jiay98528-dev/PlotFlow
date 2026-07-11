import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import type { Diagnostic, DiagnosticSeverity } from '@plotflow/core';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';
import { useAppText } from '../../i18n/appI18n';
import { localizeDiagnostic } from '../../i18n/localizeDiagnostic';

type SeverityFilter = 'all' | DiagnosticSeverity;
type SeverityIcon = typeof AlertCircle;
type ProblemPanelStyle = React.CSSProperties & { readonly '--theme-problem-panel-height'?: string };

const SEVERITY_ICON: Readonly<Record<DiagnosticSeverity, SeverityIcon>> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const PANEL_MIN_HEIGHT = 120;
const PANEL_DEFAULT_HEIGHT = 236;

function findChapterIdByLine(lineNumber: number): string | null {
  const chapters = useStoryStore.getState().plotFlowData?.chapters ?? [];
  let match: string | null = null;
  for (const chapter of chapters) {
    if (chapter.lineNumber <= lineNumber) {
      match = chapter.id;
    }
  }
  return match;
}

function getSeverityLabel(severity: DiagnosticSeverity, text: ReturnType<typeof useAppText>): string {
  if (severity === 'error') return text('problemPanel.severityError');
  if (severity === 'warning') return text('problemPanel.severityWarning');
  return text('problemPanel.severityInfo');
}

export function ProblemPanel(): React.ReactElement {
  const diagnostics = useEditorStore((s) => s.diagnostics);
  const editorInstance = useEditorStore((s) => s.editorInstance);
  const isProblemPanelOpen = useUIStore((s) => s.isProblemPanelOpen);
  const toggleProblemPanel = useUIStore((s) => s.toggleProblemPanel);
  const language = useUIStore((s) => s.language);
  const text = useAppText();

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [panelHeight, setPanelHeight] = useState(PANEL_DEFAULT_HEIGHT);
  const isResizing = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  const counts = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === 'error') errors++;
      else if (diagnostic.severity === 'warning') warnings++;
      else infos++;
    }
    return { errors, warnings, infos, total: diagnostics.length };
  }, [diagnostics]);

  const filteredDiagnostics = useMemo(() => {
    if (severityFilter === 'all') return diagnostics;
    return diagnostics.filter((diagnostic) => diagnostic.severity === severityFilter);
  }, [diagnostics, severityFilter]);

  const filterOptions = useMemo(
    () => [
      { key: 'all' as const, label: text('problemPanel.all'), count: counts.total },
      { key: 'error' as const, label: text('problemPanel.errors'), count: counts.errors },
      { key: 'warning' as const, label: text('problemPanel.warnings'), count: counts.warnings },
      { key: 'info' as const, label: text('problemPanel.infos'), count: counts.infos },
    ],
    [counts.errors, counts.infos, counts.total, counts.warnings, text],
  );

  const handleJumpToLine = useCallback(
    (diagnostic: Diagnostic) => {
      const { startLine, startColumn } = diagnostic.range;
      const editor = useEditorStore.getState();
      const story = useStoryStore.getState();
      const graph = useGraphStore.getState();
      const ui = useUIStore.getState();
      const nodeId = diagnostic.relatedNodeId ?? story.getNodeByLine(startLine);
      const node = nodeId ? story.getNodeByFullId(nodeId) : undefined;
      const chapterId = node?.chapterId ?? findChapterIdByLine(startLine);

      editor.setCursorPosition(startLine, startColumn);
      if (chapterId) {
        ui.setActiveChapterId(chapterId);
      }
      if (node) {
        graph.selectNode(node.fullId);
        editor.setActiveNodeId(node.fullId);
        ui.setStatusMessage(text('problemPanel.jumpedToNode', { title: node.title }));
      } else {
        ui.setStatusMessage(text('problemPanel.jumpedToLine', { line: startLine }));
      }

      if (editorInstance) {
        editorInstance.revealPositionInCenter({ lineNumber: startLine, column: startColumn });
        editorInstance.setPosition({ lineNumber: startLine, column: startColumn });
        if (ui.workspaceMode === 'split') {
          editorInstance.focus();
        }
      }
    },
    [editorInstance, text],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyM') {
        event.preventDefault();
        event.stopPropagation();
        toggleProblemPanel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleProblemPanel]);

  useEffect(() => {
    if (isProblemPanelOpen && !wasOpenRef.current) {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      window.setTimeout(() => closeButtonRef.current?.focus({ preventScroll: true }), 0);
    } else if (!isProblemPanelOpen && wasOpenRef.current) {
      const opener = openerRef.current;
      window.setTimeout(() => opener?.focus({ preventScroll: true }), 0);
    }
    wasOpenRef.current = isProblemPanelOpen;
  }, [isProblemPanelOpen]);

  useEffect(() => {
    if (!isProblemPanelOpen) return undefined;
    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !panelRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      toggleProblemPanel();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isProblemPanelOpen, toggleProblemPanel]);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isResizing.current = true;
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const startY = event.clientY;
      const startHeight = panelHeight;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizing.current) return;
        const delta = startY - moveEvent.clientY;
        setPanelHeight(Math.max(PANEL_MIN_HEIGHT, startHeight + delta));
      };

      const handleMouseUp = () => {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [panelHeight],
  );

  const handleResizeKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 10;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setPanelHeight((current) => Math.min(window.innerHeight - 120, current + step));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setPanelHeight((current) => Math.max(PANEL_MIN_HEIGHT, current - step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setPanelHeight(PANEL_MIN_HEIGHT);
    } else if (event.key === 'End') {
      event.preventDefault();
      setPanelHeight(Math.max(PANEL_MIN_HEIGHT, window.innerHeight - 120));
    }
  }, []);

  useEffect(() => () => {
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, []);

  return (
    <div
      ref={panelRef}
      className={`problem-panel${isProblemPanelOpen ? ' is-open' : ''}`}
      data-testid="problem-panel"
      aria-hidden={!isProblemPanelOpen}
      style={{ '--theme-problem-panel-height': `${panelHeight}px` } as ProblemPanelStyle}
    >
      {isProblemPanelOpen && (
        <>
          <div
            className="problem-panel__resize-handle"
            role="separator"
            aria-orientation="horizontal"
            aria-label={text('problemPanel.resize')}
            aria-valuemin={PANEL_MIN_HEIGHT}
            aria-valuemax={Math.max(PANEL_MIN_HEIGHT, window.innerHeight - 120)}
            aria-valuenow={panelHeight}
            tabIndex={0}
            onMouseDown={handleResizeStart}
            onKeyDown={handleResizeKeyDown}
          />
          <header className="problem-panel__header">
            <div className="problem-panel__title">
              <AlertCircle aria-hidden="true" size={15} strokeWidth={2} />
              <span>{text('problemPanel.title')}</span>
              <small>{text('problemPanel.shortcut')}</small>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="icon-button problem-panel__close"
              onClick={toggleProblemPanel}
              aria-label={text('problemPanel.close')}
            >
              <X aria-hidden="true" size={16} strokeWidth={2} />
            </button>
          </header>

          <div className="problem-panel__filters" role="toolbar" aria-label={text('problemPanel.filtersAria')}>
            {filterOptions.map((option) => {
              const isActive = severityFilter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className="problem-panel__filter-btn"
                  data-filter={option.key}
                  aria-pressed={isActive}
                  onClick={() => setSeverityFilter(option.key)}
                >
                  <span>{option.label}</span>
                  <strong>{option.count}</strong>
                </button>
              );
            })}
          </div>

          <div className="problem-panel__list" role="list" aria-label={text('problemPanel.listAria')}>
            {filteredDiagnostics.length === 0 ? (
              <div className="problem-panel__empty">
                <CheckCircle2 aria-hidden="true" size={18} strokeWidth={2} />
                <span>{text('problemPanel.empty')}</span>
              </div>
            ) : (
              filteredDiagnostics.map((diagnostic) => {
                const Icon = SEVERITY_ICON[diagnostic.severity];
                const localized = localizeDiagnostic(diagnostic, language);
                const message = localized.message;
                const location = text('problemPanel.location', {
                  line: diagnostic.range.startLine,
                  column: diagnostic.range.startColumn,
                });
                const severityLabel = getSeverityLabel(diagnostic.severity, text);

                return (
                  <div key={diagnostic.id} className="problem-panel__list-item" role="listitem">
                    <button
                      type="button"
                      className="problem-panel__item"
                      data-severity={diagnostic.severity}
                      data-testid={`problem-panel-item-${diagnostic.code}`}
                      onClick={() => handleJumpToLine(diagnostic)}
                      title={
                        text('problemPanel.jump', { line: diagnostic.range.startLine }) +
                        (localized.detail ? `\n${localized.detail}` : '')
                      }
                      aria-label={`${severityLabel} ${diagnostic.code}. ${message}. ${location}`}
                    >
                      <span className="problem-panel__severity" data-severity={diagnostic.severity}>
                        <Icon aria-hidden="true" size={14} strokeWidth={2.2} />
                        <span className="visually-hidden">{severityLabel}</span>
                      </span>
                      <span className="problem-panel__code">{diagnostic.code}</span>
                      <span className="problem-panel__message">{message}</span>
                      <span className="problem-panel__location">{location}</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
