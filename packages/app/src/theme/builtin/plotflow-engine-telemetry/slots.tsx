import React from 'react';
import type { ThemeSlots } from '../../../theme-platform/types';
import { EngineTelemetryEdge } from '../../themes/EngineTelemetryEdge';
import { EngineTelemetryNodeCard } from '../../themes/EngineTelemetryNodeCard';

function EngineTelemetryPreview({ compact = false, active = false }: { readonly compact?: boolean; readonly active?: boolean }): React.ReactElement {
  return (
    <div className={`official-theme-preview official-theme-preview--engine-telemetry${compact ? ' is-compact' : ''}${active ? ' is-active' : ''}`}>
      <div className="official-theme-preview__canvas">
        <div className="official-theme-preview__node official-theme-preview-node-main">
          <span />
          <strong>Runtime Module</strong>
          <em>Source Spine online</em>
        </div>
        <div className="official-theme-preview__node official-theme-preview-node-leaf">
          <span />
          <strong>Inspector Rack</strong>
        </div>
        <svg viewBox="0 0 220 120" aria-hidden="true">
          <path d="M78 54 C112 24 145 26 174 48" />
          <path d="M82 76 C120 94 152 92 184 76" />
        </svg>
      </div>
    </div>
  );
}

export const engineTelemetrySlots = {
  StoryNodeCard: EngineTelemetryNodeCard,
  StoryEdge: EngineTelemetryEdge,
  ThemePreview: EngineTelemetryPreview,
  HomePreview: EngineTelemetryPreview,
} as const satisfies ThemeSlots;
