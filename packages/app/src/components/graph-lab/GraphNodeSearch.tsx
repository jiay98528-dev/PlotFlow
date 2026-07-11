import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { DiagnosticSeverity, StoryNode } from '@plotflow/core';
import { useAppText } from '../../i18n/appI18n';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useUIStore } from '../../stores/uiStore';

const SEVERITY_RANK: Readonly<Record<DiagnosticSeverity, number>> = {
  info: 1,
  warning: 2,
  error: 3,
};

interface SearchResult {
  readonly node: StoryNode;
  readonly severity: DiagnosticSeverity | null;
}

function searchableText(node: StoryNode): string {
  return [
    node.title,
    node.id,
    node.chapterId,
    node.body,
    ...node.options.map((option) => option.description),
  ].join('\n').toLocaleLowerCase();
}

export function findGraphNodeMatches(
  nodes: readonly StoryNode[],
  query: string,
  limit = 20,
): readonly StoryNode[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return nodes.slice(0, limit);

  return nodes
    .map((node, index) => {
      const title = node.title.toLocaleLowerCase();
      const id = node.id.toLocaleLowerCase();
      let rank = Number.POSITIVE_INFINITY;
      if (title === normalized || id === normalized) rank = 0;
      else if (title.startsWith(normalized) || id.startsWith(normalized)) rank = 1;
      else if (title.includes(normalized) || id.includes(normalized)) rank = 2;
      else if (searchableText(node).includes(normalized)) rank = 3;
      return { node, index, rank };
    })
    .filter((entry) => Number.isFinite(entry.rank))
    .sort((left, right) => left.rank - right.rank || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.node);
}

export function GraphNodeSearch(): React.ReactElement {
  const text = useAppText();
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const setActiveNodeId = useEditorStore((state) => state.setActiveNodeId);
  const selectNode = useGraphStore((state) => state.selectNode);
  const setActiveChapterId = useUIStore((state) => state.setActiveChapterId);
  const setInspectorTab = useUIStore((state) => state.setInspectorTab);
  const setCompactGraphPanel = useUIStore((state) => state.setCompactGraphPanel);
  const requestGraphFocus = useUIStore((state) => state.requestGraphFocus);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const nodes = useMemo(
    () => plotFlowData?.chapters.flatMap((chapter) => chapter.nodes) ?? [],
    [plotFlowData],
  );

  const severityByNode = useMemo(() => {
    const result = new Map<string, DiagnosticSeverity>();
    for (const diagnostic of diagnostics) {
      const fullId = diagnostic.relatedNodeId
        ?? useStoryStore.getState().getNodeByLine(diagnostic.range.startLine);
      if (!fullId) continue;
      const previous = result.get(fullId);
      if (!previous || SEVERITY_RANK[diagnostic.severity] > SEVERITY_RANK[previous]) {
        result.set(fullId, diagnostic.severity);
      }
    }
    return result;
  }, [diagnostics]);

  const results = useMemo<readonly SearchResult[]>(() => {
    return findGraphNodeMatches(nodes, query)
      .map((node) => ({ node, severity: severityByNode.get(node.fullId) ?? null }));
  }, [nodes, query, severityByNode]);

  const close = useCallback((restoreFocus = true) => {
    setIsOpen(false);
    setQuery('');
    setActiveIndex(0);
    if (restoreFocus) {
      window.setTimeout(() => triggerRef.current?.focus({ preventScroll: true }), 0);
    }
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 0);
  }, []);

  const choose = useCallback((result: SearchResult) => {
    const { node } = result;
    setActiveChapterId(node.chapterId);
    selectNode(node.fullId);
    setActiveNodeId(node.fullId);
    setInspectorTab('node');
    if (window.matchMedia?.('(width <= 900px)').matches) {
      setCompactGraphPanel('inspector');
    }
    requestGraphFocus(node.fullId, 'center');
    close(false);
  }, [close, requestGraphFocus, selectNode, setActiveChapterId, setActiveNodeId, setCompactGraphPanel, setInspectorTab]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        isOpen ? close() : open();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [close, isOpen, open]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [close, isOpen]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, results.length - 1)));
  }, [results.length]);

  return (
    <div className="graph-node-search" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="graph-node-search__trigger"
        data-testid="graph-node-search-trigger"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => (isOpen ? close(false) : open())}
      >
        <Search aria-hidden="true" size={15} strokeWidth={2} />
        <span>{text('graphSearch.label')}</span>
        <kbd>Ctrl K</kbd>
      </button>

      {isOpen && (
        <div className="graph-node-search__popover" data-testid="graph-node-search-popover">
          <div className="graph-node-search__input-row">
            <Search aria-hidden="true" size={16} strokeWidth={2} />
            <input
              ref={inputRef}
              role="combobox"
              aria-autocomplete="list"
              aria-label={text('graphSearch.placeholder')}
              aria-controls="graph-node-search-results"
              aria-expanded="true"
              aria-activedescendant={results[activeIndex] ? `graph-node-search-result-${activeIndex}` : undefined}
              value={query}
              placeholder={text('graphSearch.placeholder')}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActiveIndex((current) => Math.min(results.length - 1, current + 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActiveIndex((current) => Math.max(0, current - 1));
                } else if (event.key === 'Enter' && results[activeIndex]) {
                  event.preventDefault();
                  choose(results[activeIndex]);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  close();
                }
              }}
            />
            <span className="visually-hidden" role="status" aria-live="polite">
              {text('graphSearch.resultCount', { count: results.length })}
            </span>
            <button type="button" className="icon-button" aria-label={text('graphSearch.close')} onClick={() => close()}>
              <X aria-hidden="true" size={15} strokeWidth={2} />
            </button>
          </div>

          <div id="graph-node-search-results" role="listbox" className="graph-node-search__results">
            {results.map((result, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                id={`graph-node-search-result-${index}`}
                key={result.node.fullId}
                className={`graph-node-search__result${index === activeIndex ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(result)}
              >
                <span className="graph-node-search__result-main">
                  <strong>{result.node.title}</strong>
                  <small>{result.node.chapterId} / {result.node.id}</small>
                </span>
                {result.severity && (
                  <span className="graph-node-search__severity" data-severity={result.severity}>
                    {text(`graphSearch.severity.${result.severity}`)}
                  </span>
                )}
              </button>
            ))}
            {results.length === 0 && <p className="graph-node-search__empty">{text('graphSearch.empty')}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
