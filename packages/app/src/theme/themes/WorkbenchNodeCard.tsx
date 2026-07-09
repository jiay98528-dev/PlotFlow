/**
 * WorkbenchNodeCard — 叙事工作台主题节点卡片
 *
 * 独立组件，零 variant 参数。从原 createNodeSlot('workbench') 分支提取。
 * M4 修复：已添加内联重命名支持（renamingNodeId → input → executeEdits）。
 *
 * @module theme/themes/WorkbenchNodeCard
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { StoryFlowNodeData } from '../../components/branch-graph/adapter';
import { NodeRoutePreview } from '../../components/branch-graph/NodeRoutePreview';
import { buildNodeRouteSummaries } from '../../components/branch-graph/nodeRouteSummary';
import { useStoryStore } from '../../stores/storyStore';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useAppText } from '../../i18n/appI18n';
import { stripMarkdown, truncate } from './utils';

const THEME_ID = 'plotflow-narrative-workbench';
const VARIANT = 'workbench';

const STATUS_LABEL: Record<string, string> = {
  normal: '节点',
  orphan: '孤立',
  deadend: '死胡同',
  error: '错误',
  root: '起点',
};

export const WorkbenchNodeCard: React.FC<NodeProps> = ({ data, selected, isConnectable }) => {
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
  const bodyPreview = truncate(stripMarkdown(storyNode?.body ?? nodeData.body ?? ''), 68);
  const allNodes = useMemo(
    () => plotFlowData?.chapters.flatMap((chapter) => chapter.nodes) ?? [],
    [plotFlowData],
  );
  const routeSummaries = useMemo(
    () => buildNodeRouteSummaries(storyNode, allNodes, text),
    [allNodes, storyNode, text],
  );
  const hasDefaultRoute = routeSummaries.length === 1 && routeSummaries[0]?.sourceHandleId === 'next';

  // --- 内联重命名 ---
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isCommitting = useRef(false);
  const isRenaming = renamingNodeId === nodeData.fullId;

  const commitRename = useCallback(() => {
    if (isCommitting.current) return;
    isCommitting.current = true;
    const newTitle = editValue.trim() || (nodeData.title || '未命名节点');
    const storyNode2 = useStoryStore.getState().getNodeByFullId(nodeData.fullId);
    if (editorInstance && storyNode2) {
      const lineNumber = storyNode2.lineNumber;
      const lineContent = editorInstance.getModel()?.getLineContent(lineNumber) ?? '';
      const oldTitle = nodeData.title;
      const newLine = lineContent.includes(oldTitle)
        ? lineContent.replace(oldTitle, newTitle)
        : lineContent.replace(/## 节点：.*/, `## 节点：${newTitle}`);
      editorInstance.executeEdits('plotflow-rename-node', [
        { range: { startLineNumber: lineNumber, startColumn: 1, endLineNumber: lineNumber, endColumn: lineContent.length + 1 }, text: newLine },
      ]);
    }
    setIsEditing(false);
    setEditValue('');
    setRenamingNodeId(null);
    isCommitting.current = false;
  }, [editValue, nodeData.title, nodeData.fullId, editorInstance, setRenamingNodeId]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
    setRenamingNodeId(null);
  }, [setRenamingNodeId]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditing(true);
    setEditValue(nodeData.title || '');
    setRenamingNodeId(nodeData.fullId);
  }, [nodeData.title, nodeData.fullId, setRenamingNodeId]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }, [commitRename, cancelEdit]);

  const handleInputMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
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

      <header className="official-graph-node__header">
        <span className="official-graph-node__status">{STATUS_LABEL[nodeData.status]}</span>
        <span className="official-graph-node__chapter">{storyNode?.chapterId ?? nodeData.fullId.split('-')[0]}</span>
      </header>

      <div className="official-graph-node__title-row" onDoubleClick={handleDoubleClick}>
        {isRenaming ? (
          <input
            ref={inputRef}
            className="story-node-rename-input"
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onBlur={commitRename}
            onMouseDown={handleInputMouseDown}
          />
        ) : (
          <h3>{truncate(nodeData.title || '未命名节点', 34)}</h3>
        )}
        <span className="official-graph-node__count">{options.length}</span>
      </div>

      {/* Workbench variant: body preview (not telemetry bar) */}
      <p className="official-graph-node__body">
        {bodyPreview || '还没有正文，选中后在 Inspector 中补写。'}
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

WorkbenchNodeCard.displayName = `OfficialGraphNode(${THEME_ID})`;
