/**
 * OfficialGraphNodeCard — 官方主题节点的共享交互骨架
 *
 * 主题仅传入视觉文案与轻量展示差异；重命名、端口、选中和路线预览
 * 始终通过同一份实现，避免新增官方主题时复制状态逻辑。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GripHorizontal } from 'lucide-react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { StoryFlowNodeData } from '../../components/branch-graph/adapter';
import { NodeRoutePreview } from '../../components/branch-graph/NodeRoutePreview';
import { buildNodeRouteSummaries } from '../../components/branch-graph/nodeRouteSummary';
import { useEditorStore } from '../../stores/editorStore';
import { useGraphStore } from '../../stores/graphStore';
import { useStoryStore } from '../../stores/storyStore';
import { useAppText } from '../../i18n/appI18n';
import { graphEditService } from '../../services/graphEditService';
import { stripMarkdown, truncate } from './utils';

type AppText = ReturnType<typeof useAppText>;
type NodeStatus = StoryFlowNodeData['status'];

export interface OfficialGraphNodeCardConfig {
  readonly themeId: string;
  readonly variant: string;
  readonly statusLabel: (status: NodeStatus, text: AppText) => string | undefined;
  readonly bodyPreviewLength: number;
  readonly untitledTitle: (text: AppText) => string;
  readonly renameFallbackTitle: (nodeTitle: string, text: AppText) => string;
  readonly emptyBody: (text: AppText) => string;
  readonly rewriteHeading: (lineContent: string, oldTitle: string, newTitle: string) => string;
  readonly headerClassName?: string;
  readonly renderNodeMeta?: (context: {
    readonly status: NodeStatus;
    readonly conditionCount: number;
    readonly text: AppText;
  }) => React.ReactNode;
  readonly testId?: string;
}

/**
 * 为一个官方主题创建节点 Slot。
 *
 * 配置对象在模块加载时创建，因此不会在渲染过程中变化；组件内部只负责
 * 共用的 React Flow 行为合同。
 */
export function createOfficialGraphNodeCard(
  config: OfficialGraphNodeCardConfig,
): React.FC<NodeProps> {
  const OfficialGraphNodeCard: React.FC<NodeProps> = ({ data, selected, isConnectable }) => {
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
    const bodyPreview = truncate(
      stripMarkdown(storyNode?.body ?? nodeData.body ?? ''),
      config.bodyPreviewLength,
    );
    const conditionCount = options.filter((option) => Boolean(option.conditionRaw)).length;
    const allNodes = useMemo(
      () => plotFlowData?.chapters.flatMap((chapter) => chapter.nodes) ?? [],
      [plotFlowData],
    );
    const routeSummaries = useMemo(
      () => buildNodeRouteSummaries(storyNode, allNodes, text),
      [allNodes, storyNode, text],
    );
    const hasDefaultRoute =
      routeSummaries.length === 1 && routeSummaries[0]?.sourceHandleId === 'next';
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const isCommitting = useRef(false);
    const isRenaming = renamingNodeId === nodeData.fullId;

    const commitRename = useCallback(() => {
      if (isCommitting.current) return;
      isCommitting.current = true;

      const newTitle = editValue.trim() || config.renameFallbackTitle(nodeData.title, text);
      const activeStoryNode = useStoryStore.getState().getNodeByFullId(nodeData.fullId);
      if (editorInstance && activeStoryNode) {
        const lineNumber = activeStoryNode.lineNumber;
        const lineContent = editorInstance.getModel()?.getLineContent(lineNumber) ?? '';
        const newLine = config.rewriteHeading(lineContent, nodeData.title, newTitle);

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
      } else if (activeStoryNode) {
        graphEditService.updateNode(activeStoryNode, { title: newTitle });
      }

      setIsEditing(false);
      setEditValue('');
      setRenamingNodeId(null);
      isCommitting.current = false;
    }, [
      config,
      editValue,
      editorInstance,
      nodeData.fullId,
      nodeData.title,
      setRenamingNodeId,
      text,
    ]);

    const cancelEdit = useCallback(() => {
      setIsEditing(false);
      setEditValue('');
      setRenamingNodeId(null);
    }, [setRenamingNodeId]);

    const handleDoubleClick = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        setIsEditing(true);
        setEditValue(nodeData.title || '');
        setRenamingNodeId(nodeData.fullId);
      },
      [nodeData.fullId, nodeData.title, setRenamingNodeId],
    );

    useEffect(() => {
      if (!isRenaming || isEditing) return;
      setIsEditing(true);
      setEditValue(nodeData.title || '');
    }, [isEditing, isRenaming, nodeData.title]);

    useEffect(() => {
      if (!isEditing || !isRenaming) return;

      // React Flow 在节点状态变化后会通过 RAF 恢复画布焦点；在其焦点同步之后
      // 进入下一轮任务队列，确保 F2 与双击都能立即开始输入而不新增 Tab 停靠点。
      const timeout = window.setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
        inputRef.current?.select();
      }, 0);
      return () => window.clearTimeout(timeout);
    }, [isEditing, isRenaming]);

    const handleEditKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitRename();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelEdit();
        }
      },
      [cancelEdit, commitRename],
    );

    const handleInputMouseDown = useCallback((event: React.MouseEvent) => {
      event.stopPropagation();
    }, []);

    const nodeClass = [
      'official-graph-node',
      `official-graph-node--${config.variant}`,
      `official-graph-node--${nodeData.status}`,
      hasDefaultRoute ? 'official-graph-node--default-route' : '',
      selected ? 'is-selected' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <article
        className={nodeClass}
        data-official-node-theme={config.themeId}
        data-official-node-variant={config.variant}
        data-node-status={nodeData.status}
        {...(config.testId ? { 'data-testid': config.testId } : {})}
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

        <header
          className={['official-graph-node__header', config.headerClassName]
            .filter(Boolean)
            .join(' ')}
        >
          <span
            className="official-graph-node__drag-affordance"
            role="img"
            aria-label={text('themeNode.dragHint')}
            title={text('themeNode.dragHint')}
          >
            <GripHorizontal aria-hidden="true" size={14} strokeWidth={2} />
          </span>
          <span className="official-graph-node__status">
            {config.statusLabel(nodeData.status, text)}
          </span>
          <span className="official-graph-node__chapter">
            {storyNode?.chapterId ?? nodeData.chapterId}
          </span>
        </header>

        <div
          className="official-graph-node__title-row"
          title={text('themeNode.renameShortcutHint')}
          onDoubleClick={handleDoubleClick}
        >
          {isRenaming ? (
            <input
              ref={inputRef}
              className="story-node-rename-input"
              type="text"
              value={editValue}
              aria-label={text('themeNode.renameField', { title: nodeData.title || config.untitledTitle(text) })}
              onChange={(event) => setEditValue(event.target.value)}
              onKeyDown={handleEditKeyDown}
              onBlur={commitRename}
              onMouseDown={handleInputMouseDown}
            />
          ) : (
            <h3>{truncate(nodeData.title || config.untitledTitle(text), 34)}</h3>
          )}
          <span className="official-graph-node__count">{options.length}</span>
        </div>

        {config.renderNodeMeta?.({ status: nodeData.status, conditionCount, text })}

        <p className="official-graph-node__body">{bodyPreview || config.emptyBody(text)}</p>

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
                  isDefaultNextRoute
                    ? 'story-node-connect-handle--next'
                    : 'story-node-connect-handle--option',
                  'nodrag',
                  'nopan',
                ].join(' ')}
                data-source-full-id={nodeData.fullId}
                data-option-index={optionIndex}
                data-testid={
                  isDefaultNextRoute
                    ? 'story-node-default-next-handle'
                    : `story-node-option-handle-${optionIndex}`
                }
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

  OfficialGraphNodeCard.displayName = `OfficialGraphNode(${config.themeId})`;
  return OfficialGraphNodeCard;
}
