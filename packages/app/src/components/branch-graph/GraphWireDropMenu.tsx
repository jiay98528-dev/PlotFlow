import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useStoryStore } from '../../stores/storyStore';
import { useAppText } from '../../i18n/appI18n';
import { isNextRoute, type WireDropContext } from './graphWireModel';

export type GraphWireDropAction =
  | { readonly type: 'create'; readonly title: string }
  | {
      readonly type: 'connect';
      readonly targetFullId: string;
      readonly targetTitle: string;
    }
  | { readonly type: 'disconnect' };

interface GraphWireDropMenuProps {
  readonly context: WireDropContext;
  readonly onAction: (action: GraphWireDropAction) => void;
  readonly onClose: (restoreFocus: boolean) => void;
}

export function GraphWireDropMenu({
  context,
  onAction,
  onClose,
}: GraphWireDropMenuProps): React.ReactElement | null {
  const getNodeByFullId = useStoryStore((state) => state.getNodeByFullId);
  const getAllNodes = useStoryStore((state) => state.getAllNodes);
  const text = useAppText();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const titleId = `${id}-title`;
  const resultsId = `${id}-results`;

  const sourceNode = getNodeByFullId(context.route.sourceFullId);
  const isNextTarget = isNextRoute(context.route);
  const option = sourceNode?.options[context.route.optionIndex];
  const candidates = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return getAllNodes()
      .filter((node) => node.fullId !== context.route.sourceFullId)
      .filter(
        (node) =>
          normalizedQuery.length === 0 ||
          node.title.toLocaleLowerCase().includes(normalizedQuery) ||
          node.fullId.toLocaleLowerCase().includes(normalizedQuery),
      )
      .slice(0, 6);
  }, [context.route.sourceFullId, getAllNodes, query]);

  useEffect(() => {
    setQuery('');
    setActiveIndex(0);
    inputRef.current?.focus({ preventScroll: true });
  }, [context]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, candidates.length - 1)));
  }, [candidates.length]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const target = event.target;
      if (target instanceof Node && dialogRef.current?.contains(target)) return;
      onClose(false);
    };

    window.addEventListener('pointerdown', handlePointerDown, true);
    return () => window.removeEventListener('pointerdown', handlePointerDown, true);
  }, [onClose]);

  if (!sourceNode || (!option && !isNextTarget)) return null;

  const activeCandidate = candidates[activeIndex];
  const adjustedX = Math.max(8, Math.min(context.position.x, Math.max(8, window.innerWidth - 300)));
  const adjustedY = Math.max(8, Math.min(context.position.y, Math.max(8, window.innerHeight - 360)));

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (candidates.length === 0) return;
      setActiveIndex((current) => Math.min(candidates.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (candidates.length === 0) return;
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      if (candidates.length === 0) return;
      setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      if (candidates.length === 0) return;
      setActiveIndex(Math.max(0, candidates.length - 1));
      return;
    }
    if (event.key === 'Enter' && activeCandidate) {
      event.preventDefault();
      onAction({
        type: 'connect',
        targetFullId: activeCandidate.fullId,
        targetTitle: activeCandidate.title,
      });
    }
  };

  return (
    <div
      ref={dialogRef}
      className="wire-drop-menu nodrag nopan"
      data-testid="wire-drop-menu"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      style={{ left: adjustedX, top: adjustedY }}
      onKeyDownCapture={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onClose(true);
      }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div id={titleId} className="wire-drop-menu__header">
        {text(
          context.mode === 'reconnect'
            ? 'graphCanvas.wireReconnectTitle'
            : 'graphCanvas.wireConnectTitle',
        )}
      </div>
      <input
        ref={inputRef}
        className="wire-drop-menu__search"
        data-testid="wire-drop-search"
        role="combobox"
        aria-label={text('graphCanvas.wireSearchPlaceholder')}
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={resultsId}
        aria-activedescendant={activeCandidate ? `${id}-option-${activeIndex}` : undefined}
        value={query}
        placeholder={text('graphCanvas.wireSearchPlaceholder')}
        onChange={(event) => {
          setQuery(event.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={handleSearchKeyDown}
      />
      <div className="wire-drop-menu__section">
        <button
          type="button"
          data-testid="wire-drop-create-node"
          onClick={() => onAction({ type: 'create', title: text('graphCanvas.newNodeTitle') })}
        >
          {text('graphCanvas.createNodeAndConnect')}
        </button>
        <button
          type="button"
          data-testid="wire-drop-create-ending"
          onClick={() => onAction({ type: 'create', title: text('graphCanvas.endingTitle') })}
        >
          {text('graphCanvas.createEndingAndConnect')}
        </button>
        {(context.mode === 'reconnect' ||
          option?.targetNodeId ||
          (isNextTarget && sourceNode.nextTarget?.targetNodeId)) && (
          <button
            type="button"
            data-testid="wire-drop-disconnect"
            className="wire-drop-menu__danger"
            onClick={() => onAction({ type: 'disconnect' })}
          >
            {text('graphCanvas.disconnectRoute')}
          </button>
        )}
      </div>
      <div
        id={resultsId}
        className="wire-drop-menu__section wire-drop-menu__results"
        role="listbox"
        aria-label={text('graphCanvas.wireSearchPlaceholder')}
      >
        {candidates.map((candidate, index) => (
          <button
            type="button"
            role="option"
            aria-selected={index === activeIndex}
            tabIndex={-1}
            id={`${id}-option-${index}`}
            key={candidate.fullId}
            data-testid="wire-drop-connect-existing"
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() =>
              onAction({
                type: 'connect',
                targetFullId: candidate.fullId,
                targetTitle: candidate.title,
              })
            }
          >
            <span>{candidate.title}</span>
            <small>{candidate.chapterId}</small>
          </button>
        ))}
        {candidates.length === 0 && (
          <div className="wire-drop-menu__empty">{text('graphCanvas.noMatchingNodes')}</div>
        )}
      </div>
    </div>
  );
}
