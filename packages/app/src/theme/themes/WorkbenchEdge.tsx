/**
 * WorkbenchEdge — 叙事工作台主题连线渲染器
 *
 * 独立组件，零 variant 参数。从原 createEdgeSlot('workbench') 分支提取。
 * hit area strokeWidth 36px (widened for larger node cards).
 *
 * @module theme/themes/WorkbenchEdge
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

const THEME_ID = 'plotflow-narrative-workbench';
const VARIANT = 'workbench';
const HIT_AREA_WIDTH = 36;

interface EdgeDataLike {
  isConditional?: boolean;
  conditionText?: string;
}

export const WorkbenchEdge: React.FC<EdgeProps> = ({
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
  const edgeData = data as EdgeDataLike;
  const isConditional = type === 'conditional' || Boolean(edgeData?.isConditional);
  const [edgePath, labelX, labelY] = useMemo(
    () => getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }),
    [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition],
  );

  const className = [
    'official-graph-edge',
    `official-graph-edge--${VARIANT}`,
    isConditional ? 'official-graph-edge--conditional' : 'official-graph-edge--default',
    selected ? 'is-selected' : '',
    hovered ? 'is-hovered' : '',
  ].filter(Boolean).join(' ');

  return (
    <g
      className={className}
      data-official-edge-theme={THEME_ID}
      data-official-edge-variant={VARIANT}
      data-edge-id={id}
    >
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_AREA_WIDTH}
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

WorkbenchEdge.displayName = `OfficialGraphEdge(${THEME_ID})`;
