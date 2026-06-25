import type React from 'react';
import type { EdgeProps, Node, NodeProps } from '@xyflow/react';
import type { MonacoThemeDefinition, ThemePackLayoutRecipe, ThemePackTokens } from './themePack';
import type { StoryFlowNodeData } from '../components/branch-graph/adapter';
import type { StoryEdgeType } from '../components/branch-graph/StoryEdge';
import type { OfficialThemeId } from './officialThemeIds';

export interface OfficialThemeStoreMeta {
  readonly availability: 'bundled' | 'store';
  readonly priceLabel: string;
  readonly storeUrl: string;
}

export interface OfficialThemeMotionRecipe {
  readonly intensity: 'quiet' | 'subtle' | 'expressive';
  readonly nodeHoverLift: boolean;
  readonly cableGlow: boolean;
  readonly backgroundDrift: boolean;
}

export interface ThemeEntryRecipe {
  readonly graphLabDefaultEntry: 'contentBrowserFirst' | 'canvasFirst' | 'inspectorFirst';
  readonly sourceDockDefault: 'collapsed' | 'expanded' | 'hidden';
  readonly primaryActionLabel: {
    readonly 'zh-CN': string;
    readonly 'en-US': string;
  };
}

export interface ThemeInteractionRecipe {
  readonly density: 'calm' | 'balanced' | 'dense';
  readonly realtimeWirePreview: boolean;
  readonly highlightConnectTargets: boolean;
  readonly prominentPorts: boolean;
}

export interface OfficialThemeAssets {
  readonly preview: string;
  readonly workbenchTexture: string;
  readonly nodeSurface: string;
}

export interface OfficialThemeSlots {
  readonly StoryNodeCard: React.FC<NodeProps<Node<StoryFlowNodeData>>>;
  readonly StoryEdge: React.FC<EdgeProps<StoryEdgeType>>;
  readonly ThemePreview: React.FC<{ readonly compact?: boolean; readonly active?: boolean }>;
  readonly HomePreview: React.FC<{ readonly active?: boolean }>;
}

export interface OfficialWorkspaceTheme {
  readonly id: OfficialThemeId;
  readonly name: {
    readonly 'zh-CN': string;
    readonly 'en-US': string;
  };
  readonly tagline: {
    readonly 'zh-CN': string;
    readonly 'en-US': string;
  };
  readonly description: {
    readonly 'zh-CN': string;
    readonly 'en-US': string;
  };
  readonly version: string;
  readonly defaultMode: 'light' | 'dark';
  readonly tokens: ThemePackTokens;
  readonly monacoTheme: Partial<Record<'light' | 'dark', MonacoThemeDefinition>>;
  readonly assets: OfficialThemeAssets;
  readonly layoutRecipe: ThemePackLayoutRecipe;
  readonly entryRecipe: ThemeEntryRecipe;
  readonly interactionRecipe: ThemeInteractionRecipe;
  readonly motionRecipe: OfficialThemeMotionRecipe;
  readonly storeMeta: OfficialThemeStoreMeta;
  readonly slots: OfficialThemeSlots;
}

export type OfficialThemeDefinition = OfficialWorkspaceTheme;
