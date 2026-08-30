/**
 * PlotFlow Theme Platform — 核心类型定义
 *
 * 定义 ThemeDescriptor 及全部子接口，是主题平台的类型合同。
 * - ThemeId 保持开放字符串，并由 Registry.validateId 在运行时校验
 * - 不依赖旧主题或 branch-graph 的具体实现类型
 * - ThemeSlots 使用通用 NodeProps / EdgeProps
 *
 * @module theme-platform/types
 */

import type React from 'react';
import type { EdgeProps, NodeProps } from '@xyflow/react';

// ============================================================================
// 核心 ID
// ============================================================================

/** 主题唯一标识符；具体格式由 Registry.validateId 校验。 */
export type ThemeId = string;

// ============================================================================
// 多语言字符串
// ============================================================================

export interface ThemeLocaleString {
  readonly 'zh-CN': string;
  readonly 'en-US': string;
}

// ============================================================================
// Tokens
// ============================================================================

export interface ThemeTokens {
  readonly shared?: Record<string, string>;
  readonly light?: Record<string, string>;
  readonly dark?: Record<string, string>;
}

// ============================================================================
// Monaco 编辑器主题
// ============================================================================

export interface ThemeMonacoTokenRule {
  readonly token: string;
  readonly foreground?: string;
  readonly fontStyle?: string;
}

export interface ThemeMonacoColors {
  readonly [key: string]: string;
}

export interface ThemeMonacoDefinition {
  readonly base?: 'vs' | 'vs-dark' | 'hc-black';
  readonly inherit?: boolean;
  readonly rules?: readonly ThemeMonacoTokenRule[];
  readonly colors?: ThemeMonacoColors;
}

// ============================================================================
// 布局配方
// ============================================================================

export interface ThemeGraphLabLayout {
  readonly paletteWidth: number;
  readonly railWidth: number;
  readonly inspectorWidth: number;
  readonly sourceDockHeight: number;
  readonly sourceDock: 'bottom' | 'right';
  readonly nodeCardStyle: string;
  readonly cableStyle: string;
  readonly motionIntensity: 'quiet' | 'subtle' | 'expressive';
}

export interface ThemeLayoutRecipe {
  readonly density: 'cinematic' | 'compact' | 'comfortable';
  readonly graphLab?: ThemeGraphLabLayout;
}

export interface ThemeUxScopeRecipe {
  readonly layout?: string;
  readonly position?: string;
  readonly width?: string;
  readonly height?: string;
  readonly minWidth?: string;
  readonly maxWidth?: string;
  readonly minHeight?: string;
  readonly maxHeight?: string;
  readonly inset?: string;
  readonly padding?: string;
  readonly gap?: string;
  readonly opacity?: string;
  readonly zIndex?: string;
  readonly radius?: string;
  readonly shadow?: string;
}

export interface ThemeUxRecipe {
  readonly appShell?: ThemeUxScopeRecipe;
  readonly home?: ThemeUxScopeRecipe;
  readonly themeCenter?: ThemeUxScopeRecipe;
  readonly graphLab?: ThemeUxScopeRecipe;
  readonly split?: ThemeUxScopeRecipe;
  readonly toolbar?: ThemeUxScopeRecipe;
  readonly panel?: ThemeUxScopeRecipe;
  readonly dock?: ThemeUxScopeRecipe;
  readonly node?: ThemeUxScopeRecipe;
  readonly edge?: ThemeUxScopeRecipe;
  readonly typography?: ThemeUxScopeRecipe;
}

// ============================================================================
// 动效配方
// ============================================================================

export interface ThemeMotionRecipe {
  readonly intensity: 'quiet' | 'subtle' | 'expressive';
  readonly nodeHoverLift?: boolean;
  readonly cableGlow?: boolean;
  readonly backgroundDrift?: boolean;
}

// ============================================================================
// 交互配方
// ============================================================================

export interface ThemeInteractionRecipe {
  readonly density: 'calm' | 'balanced' | 'dense';
  readonly realtimeWirePreview?: boolean;
  readonly highlightConnectTargets?: boolean;
  readonly prominentPorts?: boolean;
}

// ============================================================================
// 入口配方
// ============================================================================

export interface ThemeEntryRecipe {
  readonly graphLabDefaultEntry: 'contentBrowserFirst' | 'canvasFirst' | 'inspectorFirst';
  readonly sourceDockDefault: 'collapsed' | 'expanded' | 'hidden';
  readonly primaryActionLabel: ThemeLocaleString;
}

// ============================================================================
// 资产
// ============================================================================

export interface ThemeAssets {
  readonly preview: string;
  readonly workbenchTexture?: string;
  readonly nodeSurface?: string;
}

// ============================================================================
// 商店元数据
// ============================================================================

export interface ThemeStoreMeta {
  readonly availability: 'bundled';
  readonly priceLabel: string;
  readonly storeUrl: string;
}

// ============================================================================
// React 组件插槽
// ============================================================================

/**
 * 主题可替换的 React 组件插槽。使用通用 Flow 类型，避免平台合同
 * 依赖任一具体节点或连线实现；GraphCanvas 组装时由 TypeScript 校验兼容性。
 */
export interface ThemeSlots {
  readonly StoryNodeCard: React.FC<NodeProps>;
  readonly StoryEdge: React.FC<EdgeProps>;
  readonly ThemePreview: React.FC<{ readonly compact?: boolean; readonly active?: boolean }>;
  readonly HomePreview: React.FC<{ readonly active?: boolean }>;
}

// ============================================================================
// UX Surfaces
// ============================================================================

export interface ThemeAppShellSurfaceProps {
  readonly workspaceMode: 'split' | 'graphLab';
  readonly topbar: React.ReactNode;
  readonly children: React.ReactNode;
  readonly overlays: React.ReactNode;
  readonly statusBar: React.ReactNode;
}

export interface ThemeToolbarSurfaceProps {
  readonly brand: React.ReactNode;
  readonly fileControls: React.ReactNode;
  readonly viewControls: React.ReactNode;
  readonly preferenceControls: React.ReactNode;
}

export interface ThemeSplitShellSurfaceProps {
  readonly viewbar: React.ReactNode;
  readonly outline: React.ReactNode;
  readonly editor: React.ReactNode;
  readonly graph: React.ReactNode;
  readonly minimap: React.ReactNode;
}

export interface ThemeGraphLabShellSurfaceProps {
  readonly isSourceDrawerOpen: boolean;
  readonly commandbar: React.ReactNode;
  readonly palette: React.ReactNode;
  readonly canvas: React.ReactNode;
  readonly inspector: React.ReactNode;
  readonly sourceDrawer: React.ReactNode;
}

export interface ThemeHomeSurfaceProps {
  readonly heroCopy: React.ReactNode;
  readonly preview: React.ReactNode;
  readonly actions: React.ReactNode;
  readonly cards: React.ReactNode;
  readonly status: React.ReactNode;
}

export interface ThemeCenterSurfaceProps {
  readonly header: React.ReactNode;
  readonly sidebar: React.ReactNode;
  readonly installedThemes: React.ReactNode;
  readonly footer: React.ReactNode;
}

export interface ThemeFrameSurfaceProps {
  readonly className?: string;
  readonly testId?: string;
  readonly ariaLabel?: string;
  readonly children: React.ReactNode;
}

export interface ThemeSurfaces {
  readonly AppShell: React.FC<ThemeAppShellSurfaceProps>;
  readonly Toolbar: React.FC<ThemeToolbarSurfaceProps>;
  readonly SplitShell: React.FC<ThemeSplitShellSurfaceProps>;
  readonly GraphLabShell: React.FC<ThemeGraphLabShellSurfaceProps>;
  readonly HomeSurface: React.FC<ThemeHomeSurfaceProps>;
  readonly ThemeCenterSurface: React.FC<ThemeCenterSurfaceProps>;
  readonly PanelFrame: React.FC<ThemeFrameSurfaceProps>;
  readonly DockFrame: React.FC<ThemeFrameSurfaceProps>;
}

// ============================================================================
// 主题描述符（顶层）
// ============================================================================

/**
 * 完整主题定义。注册到 ThemeRegistry 后由 ThemePlatformProvider 激活。
 */
// ============================================================================

export interface ThemeDescriptor {
  readonly id: ThemeId;
  readonly name: ThemeLocaleString;
  readonly tagline: ThemeLocaleString;
  readonly description: ThemeLocaleString;
  readonly version: string;
  readonly defaultMode: 'light' | 'dark';
  readonly tokens: ThemeTokens;
  readonly monacoTheme?: Partial<Record<'light' | 'dark', ThemeMonacoDefinition>>;
  readonly assets: ThemeAssets;
  readonly layoutRecipe: ThemeLayoutRecipe;
  readonly uxRecipe?: ThemeUxRecipe;
  readonly entryRecipe: ThemeEntryRecipe;
  readonly interactionRecipe: ThemeInteractionRecipe;
  readonly motionRecipe: ThemeMotionRecipe;
  readonly storeMeta: ThemeStoreMeta;
  readonly slots: ThemeSlots;
  readonly surfaces: ThemeSurfaces;
}
