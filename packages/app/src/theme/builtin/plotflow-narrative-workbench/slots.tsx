import React from 'react';
import { ThemeAssetPreview } from '../../../components/theme/ThemeAssetPreview';
import { WorkbenchNodeCard } from '../../themes/WorkbenchNodeCard';
import { WorkbenchEdge } from '../../themes/WorkbenchEdge';
import type { ThemeSlots } from '../../../theme-platform/types';

const previewUrl = new URL('./assets/preview.png', import.meta.url).href;

function WorkbenchPreview({ compact = false, active = false }: { readonly compact?: boolean; readonly active?: boolean }): React.ReactElement {
  return (
    <ThemeAssetPreview
      themeId="plotflow-narrative-workbench"
      src={previewUrl}
      label="叙事工作台 Graph Lab"
      compact={compact}
      active={active}
    />
  );
}

export const narrativeWorkbenchSlots = {
  StoryNodeCard: WorkbenchNodeCard,
  StoryEdge: WorkbenchEdge,
  ThemePreview: WorkbenchPreview,
  HomePreview: WorkbenchPreview,
} as const satisfies ThemeSlots;
