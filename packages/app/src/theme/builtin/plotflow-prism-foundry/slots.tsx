import React from 'react';
import type { ThemeSlots } from '../../../theme-platform/types';
import { ThemeAssetPreview } from '../../../components/theme/ThemeAssetPreview';
import { PrismFoundryEdge } from '../../themes/PrismFoundryEdge';
import { PrismFoundryNodeCard } from '../../themes/PrismFoundryNodeCard';

const previewUrl = new URL('./assets/preview.png', import.meta.url).href;

function PrismFoundryPreview({
  compact = false,
  active = false,
}: {
  readonly compact?: boolean;
  readonly active?: boolean;
}): React.ReactElement {
  return (
    <ThemeAssetPreview
      themeId="plotflow-prism-foundry"
      src={previewUrl}
      label="棱镜铸造台 Graph Lab"
      compact={compact}
      active={active}
    />
  );
}

export const prismFoundrySlots = {
  StoryNodeCard: PrismFoundryNodeCard,
  StoryEdge: PrismFoundryEdge,
  ThemePreview: PrismFoundryPreview,
  HomePreview: PrismFoundryPreview,
} as const satisfies ThemeSlots;
