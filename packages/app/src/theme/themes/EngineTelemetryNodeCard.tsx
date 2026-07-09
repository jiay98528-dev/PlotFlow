import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { StoryFlowNodeData } from '../../components/branch-graph/adapter';
import { NodeRoutePreview } from '../../components/branch-graph/NodeRoutePreview';
import { buildNodeRouteSummaries } from '../../components/branch-graph/nodeRouteSummary';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useAppText } from '../../i18n/appI18n';
import { stripMarkdown, truncate } from './utils';

const THEME_ID = 'plotflow-engine-telemetry';
const VARIANT = 'engine-telemetry';

const STATUS_LABEL: Record<string, string> = {
  normal: 'SYNC',
  orphan: 'OPEN',
  deadend: 'END',
  error: 'ERR',
  root: 'ROOT',
};

export const EngineTelemetryNodeCard: React.FC<NodeProps> = ({ data, selected, isConnectable }) => {
  const nodeData = data as StoryFlowNodeData;
  const text = useAppText();
  const storyNode = useStoryStore((state) => state.getNodeByFullId(nodeData.fullId));
  const plotFlowData = useStoryStore((state) => state.plotFlowData);
  const selectNode = useGraphStore((state) => state.selectNode);
  const setActiveNodeId = useEditorStore((state) => state.setActiveNodeId);
  const renamingNodeId = useGraphStore((state) => state.renamingNodeId);
  const setRenamingNodeId = useGraphStore((state) => state.setRenamingNodeId);
  const editorInstance = useEditorStore((state) => state.editorInstance);
  const options = storyNode?.options ?? [];
  const bodyPreview = truncate(stripMarkdown(storyNode?.body ?? nodeData.body ?? ''), 76);
  const conditionCount = options.filter((option) => Boolean(option.conditionRaw)).length;
  const allNodes = useMemo(
    () => plotFlowData?.chapters.flatMap((chapter) => chapter.nodes) ?? [],
    [plotFlowData],
  );
  const routeSummaries = useMemo(
    () => buildNodeRouteSummaries(storyNode, allNodes, text),
    [allNodes, storyNode, text],
  );
  const hasDefaultRoute = routeSummaries.length === 1 && routeSummaries[0]?.sourceHandleId === 'next';
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isCommitting = useRef(false);
  const isRenaming = renamingNodeId === nodeData.fullId;

  const commitRename = useCallback(() => {
    if (isCommitting.current) return;
    isCommitting.current = true;
    const newTitle = editValue.trim() || (nodeData.title || text('themeNode.untitled'));
    const activeStoryNode = useStoryStore.getState().getNodeByFullId(nodeData.fullId);

    if (editorInstance && activeStoryNode) {
      const lineNumber = activeStoryNode.lineNumber;
      const lineContent = editorInstance.getModel()?.getLineContent(lineNumber) ?? '';
      const oldTitle = nodeData.title;
      let newLine = lineContent;

      if (oldTitle && lineContent.includes(oldTitle)) {
        newLine = lineContent.replace(oldTitle, newTitle);
      } else {
        const replaced = lineContent.replace(/^(#{1,6}\s*[^:：]*[:：]\s*).*$/, `$1${newTitle}`);
        newLine = replaced === lineContent ? `## 节点：${newTitle}` : replaced;
      }

      editorInstance.executeEdits('plotflow-rename-node', [
        {
          range: {
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: lineContent.length + 1,
          },
          text: newLine,
        },
      ]);
    }

    setIsEditing(false);
    setEditValue('');
    setRenamingNodeId(null);
    isCommitting.current = false;
  }, [editValue, editorInstance, nodeData.fullId, nodeData.title, setRenamingNodeId, text]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
    setRenamingNodeId(null);
  }, [setRenamingNodeId]);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    setIsEditing(true);
    setEditValue(nodeData.title || '');
    setRenamingNodeId(nodeData.fullId);
  }, [nodeData.fullId, nodeData.title, setRenamingNodeId]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEditKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitRename();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }, [cancelEdit, commitRename]);

  const handleInputMouseDown = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);

  const nodeClass = [
    'official-graph-node',
    `official-graph-node--${VARIANT}`,
    `official-graph-node--${nodeData.status}`,
    hasDefaultRoute ? 'official-graph-node--default-route' : '',
    selected ? 'is-selected' : '',
  ].filter(Boolean).join(' ');

  return (
    <article
      className={nodeClass}
      data-official-node-theme={THEME_ID}
      data-official-node-variant={VARIANT}
      data-node-status={nodeData.status}
      onClick={() => {
        selectNode(nodeData.fullId);
        setActiveNodeId(nodeData.fullId);
      }}
    >
      {!hasDefaultRoute && (
        <Handle
          type="target"
          position={Position.Left}
          className="official-node-port official-node-port--target"
          isConnectable={isConnectable}
        />
      )}

      <header className="official-graph-node__header official-graph-node__telemetry-header">
        <span className="official-graph-node__status">{STATUS_LABEL[nodeData.status] ?? 'SYNC'}</span>
        <span className="official-graph-node__chapter">{storyNode?.chapterId ?? nodeData.fullId.split('-')[0]}</span>
      </header>

      <div className="official-graph-node__title-row" onDoubleClick={handleDoubleClick}>
        {isRenaming ? (
          <input
            ref={inputRef}
            className="story-node-rename-input"
            type="text"
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={commitRename}
            onMouseDown={handleInputMouseDown}
          />
        ) : (
          <h3>{truncate(nodeData.title || text('themeNode.untitled'), 34)}</h3>
        )}
        <span className="official-graph-node__count">{options.length}</span>
      </div>

      <div className="official-graph-node__telemetry" aria-label={text(`themeNode.status.${nodeData.status}`)}>
        <span>{text(`themeNode.status.${nodeData.status}`)}</span>
        <span>{conditionCount > 0 ? text('themeNode.gatedCount', { count: conditionCount }) : text('themeNode.clearRoute')}</span>
      </div>

      <p className="official-graph-node__body">
        {bodyPreview || text('themeNode.noBody')}
      </p>

      <NodeRoutePreview
        summaries={routeSummaries}
        variant="official"
        renderLeadingHandle={(summary) => {
          if (!hasDefaultRoute || summary.sourceHandleId !== 'next') {
            return null;
          }

          return (
            <Handle
              type="target"
              position={Position.Left}
              className="official-node-port official-node-port--target official-node-port--inline"
              isConnectable={isConnectable}
            />
          );
        }}
        renderHandle={(summary) => {
          if (!summary.sourceHandleId) {
            return null;
          }

          const isDefaultNextRoute = summary.sourceHandleId === 'next';
          const optionIndex = isDefaultNextRoute ? -1 : summary.optionIndex;
          if (optionIndex === null) {
            return null;
          }

          return (
            <div
              className={[
                'story-node-connect-handle',
                'official-node-port',
                'official-node-port--source',
                isDefaultNextRoute ? 'story-node-connect-handle--next' : 'story-node-connect-handle--option',
                'nodrag',
                'nopan',
              ].join(' ')}
              data-source-full-id={nodeData.fullId}
              data-option-index={optionIndex}
              data-testid={isDefaultNextRoute ? 'story-node-default-next-handle' : `story-node-option-handle-${optionIndex}`}
              data-nodeid={nodeData.fullId}
              data-handleid={summary.sourceHandleId}
              title={summary.ariaLabel}
            >
              <Handle
                type="source"
                position={Position.Right}
                id={summary.sourceHandleId}
                className="story-node-connect-port nodrag nopan"
                isConnectable={isConnectable}
              />
            </div>
          );
        }}
      />
    </article>
  );
};

EngineTelemetryNodeCard.displayName = `OfficialGraphNode(${THEME_ID})`;
