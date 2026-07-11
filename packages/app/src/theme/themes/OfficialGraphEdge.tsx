/**
 * OfficialGraphEdge — 官方主题连线的共享交互骨架。
 *
 * 主题只配置身份与命中区宽度；条件路线、hover、选中、标签和 React Flow
 * hit area 保持单一实现，避免第三个主题复制状态化 SVG 逻辑。
 */

import React, { useMemo, useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  MarkerType,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react';
import { truncate } from './utils';

export interface OfficialGraphEdgeConfig {
  readonly themeId: string;
  readonly variant: string;
  readonly hitAreaWidth: number;
  readonly testId?: string;
}

interface EdgeDataLike {
  readonly isConditional?: boolean;
  readonly conditionText?: string;
}

export function createOfficialGraphEdge(config: OfficialGraphEdgeConfig): React.FC<EdgeProps> {
  const OfficialGraphEdge: React.FC<EdgeProps> = ({
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
    const edgeData = data as EdgeDataLike | undefined;
    const isConditional = type === 'conditional' || Boolean(edgeData?.isConditional);
    const [edgePath, labelX, labelY] = useMemo(
      () => getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }),
      [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition],
    );

    const className = [
      'official-graph-edge',
      `official-graph-edge--${config.variant}`,
      isConditional ? 'official-graph-edge--conditional' : 'official-graph-edge--default',
      selected ? 'is-selected' : '',
      hovered ? 'is-hovered' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <g
        className={className}
        data-official-edge-theme={config.themeId}
        data-official-edge-variant={config.variant}
        data-edge-id={id}
        {...(config.testId ? { 'data-testid': config.testId } : {})}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={config.hitAreaWidth}
          className="official-graph-edge__hit-area"
          data-edge-id={id}
          style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        />
        <BaseEdge
          id={id}
          path={edgePath}
          markerEnd={MarkerType.ArrowClosed}
          className="official-graph-edge__path"
        />
        {isConditional && edgeData?.conditionText && (
          <EdgeLabelRenderer>
            <div
              className="official-graph-edge__label nodrag nopan"
              style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            >
              {truncate(String(edgeData.conditionText), 28)}
            </div>
          </EdgeLabelRenderer>
        )}
      </g>
    );
  };

  OfficialGraphEdge.displayName = `OfficialGraphEdge(${config.themeId})`;
  return OfficialGraphEdge;
}
