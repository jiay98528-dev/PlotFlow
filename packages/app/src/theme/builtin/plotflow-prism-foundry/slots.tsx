import React from 'react';
import type { ThemeSlots } from '../../../theme-platform/types';
import { PrismFoundryEdge } from '../../themes/PrismFoundryEdge';
import { PrismFoundryNodeCard } from '../../themes/PrismFoundryNodeCard';

function PrismFoundryPreview({
  compact = false,
  active = false,
}: {
  readonly compact?: boolean;
  readonly active?: boolean;
}): React.ReactElement {
  return (
    <div
      className={`official-theme-preview official-theme-preview--prism-foundry prism-foundry-preview${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`}
      data-preview-theme-id="plotflow-prism-foundry"
      data-official-preview-theme="plotflow-prism-foundry"
    >
      <div className="official-theme-preview__canvas prism-foundry-preview__canvas">
        <span className="prism-foundry-preview__halo" aria-hidden="true" />
        <div className="official-theme-preview__node official-theme-preview-node-main prism-foundry-preview__node prism-foundry-preview__node--primary">
          <span />
          <strong>棱镜入口</strong>
          <em>Prism control</em>
        </div>
        <div className="official-theme-preview__node official-theme-preview-node-leaf prism-foundry-preview__node prism-foundry-preview__node--signal">
          <span />
          <strong>信号分支</strong>
        </div>
        <svg viewBox="0 0 220 120" aria-hidden="true">
          <path d="M78 54 C112 20 148 26 178 48" />
          <path d="M82 76 C120 96 154 94 188 76" />
        </svg>
      </div>
    </div>
  );
}

export const prismFoundrySlots = {
  StoryNodeCard: PrismFoundryNodeCard,
  StoryEdge: PrismFoundryEdge,
  ThemePreview: PrismFoundryPreview,
  HomePreview: PrismFoundryPreview,
} as const satisfies ThemeSlots;
