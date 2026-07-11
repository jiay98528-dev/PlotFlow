import React from 'react';
import { WorkbenchNodeCard } from '../../themes/WorkbenchNodeCard';
import { WorkbenchEdge } from '../../themes/WorkbenchEdge';
import type { ThemeSlots } from '../../../theme-platform/types';

function WorkbenchPreview({ compact = false, active = false }: { readonly compact?: boolean; readonly active?: boolean }): React.ReactElement {
  return (
    <div
      className={`official-theme-preview official-theme-preview--workbench${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`}
      data-preview-theme-id="plotflow-narrative-workbench"
    >
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

export const narrativeWorkbenchSlots = {
  StoryNodeCard: WorkbenchNodeCard,
  StoryEdge: WorkbenchEdge,
  ThemePreview: WorkbenchPreview,
  HomePreview: WorkbenchPreview,
} as const satisfies ThemeSlots;
