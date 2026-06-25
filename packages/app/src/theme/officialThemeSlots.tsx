import React, { useMemo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  getBezierPath,
  type EdgeProps,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { useStoryStore } from '../stores/storyStore';
import { useEditorStore } from '../stores/editorStore';
import { useGraphStore } from '../stores/graphStore';
import type { StoryFlowNodeData } from '../components/branch-graph/adapter';
import type { StoryEdgeType } from '../components/branch-graph/StoryEdge';
import type { OfficialThemeId } from './officialThemeIds';

type StoryNodeRenderer = React.FC<NodeProps<Node<StoryFlowNodeData>>>;
type StoryEdgeRenderer = React.FC<EdgeProps<StoryEdgeType>>;
type ThemeVariant = 'workbench' | 'nightwatch';

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/>\s+/g, '')
    .replace(/[-*+]\s+/g, '')
    .replace(/\d+\.\s+/g, '')
    .replace(/\n/g, ' ')
    .trim();
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

const STATUS_LABEL: Record<StoryFlowNodeData['status'], string> = {
  normal: '节点',
  orphan: '孤立',
  deadend: '死胡同',
  error: '错误',
  root: '起点',
};

function createNodeSlot(themeId: OfficialThemeId, variant: ThemeVariant): StoryNodeRenderer {
  const OfficialNodeSlot: StoryNodeRenderer = ({ data, selected, isConnectable }) => {
    const storyNode = useStoryStore((state) => state.getNodeByFullId(data.fullId));
    const selectNode = useGraphStore((state) => state.selectNode);
    const setActiveNodeId = useEditorStore((state) => state.setActiveNodeId);
    const options = storyNode?.options ?? [];
    const bodyPreview = truncate(stripMarkdown(storyNode?.body ?? data.body ?? ''), variant === 'nightwatch' ? 44 : 68);
    const targetCount = options.filter((option) => option.targetNodeId).length;
    const hasConditions = options.some((option) => option.conditionRaw);

    const nodeClass = [
      'official-graph-node',
      `official-graph-node--${variant}`,
      `official-graph-node--${data.status}`,
      selected ? 'is-selected' : '',
    ].filter(Boolean).join(' ');

    return (
      <article
        className={nodeClass}
        data-official-node-theme={themeId}
        data-official-node-variant={variant}
        data-node-status={data.status}
        onClick={() => {
          selectNode(data.fullId);
          setActiveNodeId(data.fullId);
        }}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="official-node-port official-node-port--target"
          isConnectable={isConnectable}
        />

        <header className="official-graph-node__header">
          <span className="official-graph-node__status">{STATUS_LABEL[data.status]}</span>
          <span className="official-graph-node__chapter">{storyNode?.chapterId ?? data.fullId.split('-')[0]}</span>
        </header>

        <div className="official-graph-node__title-row">
          <h3>{truncate(data.title || '未命名节点', 34)}</h3>
          <span className="official-graph-node__count">{options.length}</span>
        </div>

        {variant === 'workbench' ? (
          <p className="official-graph-node__body">{bodyPreview || '还没有正文，选中后在 Inspector 中补写。'}</p>
        ) : (
          <div className="official-graph-node__telemetry">
            <span>{targetCount} linked</span>
            <span>{hasConditions ? 'conditions' : 'open'}</span>
          </div>
        )}

        <div className="official-graph-node__options">
          {options.length === 0 ? (
            <div className="official-graph-node__empty">结局或待补分支</div>
          ) : (
            options.map((option, index) => (
              <div className="official-graph-node__option" key={`${option.lineNumber}-${index}`}>
                <span className="official-graph-node__option-text">
                  {truncate(option.description || `选项 ${index + 1}`, variant === 'nightwatch' ? 22 : 30)}
                </span>
                {option.conditionRaw && <span className="official-graph-node__condition">条件</span>}
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`option-${index}`}
                  className="story-node-connect-handle official-node-port official-node-port--source"
                  data-source-full-id={data.fullId}
                  data-option-index={index}
                  data-nodeid={data.fullId}
                  data-handleid={`option-${index}`}
                  isConnectable={isConnectable}
                />
              </div>
            ))
          )}
        </div>
      </article>
    );
  };

  OfficialNodeSlot.displayName = `OfficialGraphNode(${themeId})`;
  return OfficialNodeSlot;
}

function createEdgeSlot(themeId: OfficialThemeId, variant: ThemeVariant): StoryEdgeRenderer {
  const OfficialEdgeSlot: StoryEdgeRenderer = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    type,
    selected,
  }) => {
    const [hovered, setHovered] = useState(false);
    const isConditional = type === 'conditional' || Boolean(data?.isConditional);
    const [edgePath, labelX, labelY] = useMemo(
      () => getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }),
      [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition],
    );

    const className = [
      'official-graph-edge',
      `official-graph-edge--${variant}`,
      isConditional ? 'official-graph-edge--conditional' : 'official-graph-edge--default',
      selected ? 'is-selected' : '',
      hovered ? 'is-hovered' : '',
    ].filter(Boolean).join(' ');

    return (
      <g
        className={className}
        data-official-edge-theme={themeId}
        data-official-edge-variant={variant}
      >
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={variant === 'nightwatch' ? 26 : 22}
          className="official-graph-edge__hit-area"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        />
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={MarkerType.ArrowClosed}
          className="official-graph-edge__path"
        />
        {isConditional && data?.conditionText && (
          <EdgeLabelRenderer>
            <div
              className="official-graph-edge__label nodrag nopan"
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            >
              {truncate(String(data.conditionText), 28)}
            </div>
          </EdgeLabelRenderer>
        )}
      </g>
    );
  };

  OfficialEdgeSlot.displayName = `OfficialGraphEdge(${themeId})`;
  return OfficialEdgeSlot;
}

function WorkbenchPreview({ compact = false, active = false }: { readonly compact?: boolean; readonly active?: boolean }): React.ReactElement {
  return (
    <div className={`official-theme-preview official-theme-preview--workbench${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`}>
      <div className="official-theme-preview__canvas">
        <div className="official-theme-preview__node official-theme-preview-node-main">
          <span />
          <strong>章节入口</strong>
          <em>内容浏览优先</em>
        </div>
        <div className="official-theme-preview__node official-theme-preview-node-leaf">
          <span />
          <strong>剧情卡片</strong>
        </div>
        <svg viewBox="0 0 220 120" aria-hidden="true">
          <path d="M80 58 C115 24 138 30 164 47" />
          <path d="M82 70 C124 94 147 93 174 82" />
        </svg>
      </div>
    </div>
  );
}

function NightwatchPreview({ compact = false, active = false }: { readonly compact?: boolean; readonly active?: boolean }): React.ReactElement {
  return (
    <div className={`official-theme-preview official-theme-preview--nightwatch${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`}>
      <div className="official-theme-preview__canvas">
        <div className="official-theme-preview__node official-theme-preview-node-main">
          <span />
          <strong>蓝图画布</strong>
          <em>线缆优先</em>
        </div>
        <div className="official-theme-preview__node official-theme-preview-node-leaf">
          <span />
          <strong>高密节点</strong>
        </div>
        <svg viewBox="0 0 220 120" aria-hidden="true">
          <path d="M78 52 C110 18 139 24 170 45" />
          <path d="M78 74 C115 103 151 101 178 80" />
        </svg>
      </div>
    </div>
  );
}

export const narrativeWorkbenchSlots = {
  StoryNodeCard: createNodeSlot('plotflow-narrative-workbench', 'workbench'),
  StoryEdge: createEdgeSlot('plotflow-narrative-workbench', 'workbench'),
  ThemePreview: WorkbenchPreview,
  HomePreview: WorkbenchPreview,
} as const;

export const blueprintNightwatchSlots = {
  StoryNodeCard: createNodeSlot('plotflow-blueprint-nightwatch', 'nightwatch'),
  StoryEdge: createEdgeSlot('plotflow-blueprint-nightwatch', 'nightwatch'),
  ThemePreview: NightwatchPreview,
  HomePreview: NightwatchPreview,
} as const;
