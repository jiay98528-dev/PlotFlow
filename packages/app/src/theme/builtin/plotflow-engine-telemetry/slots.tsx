import React from 'react';
import type { ThemeSlots } from '../../../theme-platform/types';
import { ThemeAssetPreview } from '../../../components/theme/ThemeAssetPreview';
import { EngineTelemetryEdge } from '../../themes/EngineTelemetryEdge';
import { EngineTelemetryNodeCard } from '../../themes/EngineTelemetryNodeCard';

const previewUrl = new URL('./assets/preview.png', import.meta.url).href;

function EngineTelemetryPreview({ compact = false, active = false }: { readonly compact?: boolean; readonly active?: boolean }): React.ReactElement {
  return (
    <ThemeAssetPreview
      themeId="plotflow-engine-telemetry"
      src={previewUrl}
      label="Engine Telemetry Graph Lab"
      compact={compact}
      active={active}
    />
  );
}

export const engineTelemetrySlots = {
  StoryNodeCard: EngineTelemetryNodeCard,
  StoryEdge: EngineTelemetryEdge,
  ThemePreview: EngineTelemetryPreview,
  HomePreview: EngineTelemetryPreview,
} as const satisfies ThemeSlots;
