/**
 * PlotFlow Theme Platform 鈥?鏍稿績绫诲瀷瀹氫箟
 *
 * 鏈枃浠跺畾涔?ThemeDescriptor 鍙婃墍鏈夊瓙鎺ュ彛銆傝繖鏄钩鍙扮殑瀵瑰绫诲瀷鍚堝悓銆? * 璁捐绾︽潫锛? * - ThemeId = string锛堥潪灏侀棴鑱斿悎锛夛紝杩愯鏃堕€氳繃 Registry.validateId 鏍￠獙
 * - 闆跺鍏ユ潵鑷」鐩唴閮ㄦ棫涓婚鎴?branch-graph 璺緞
 * - ThemeSlots 浣跨敤娉涘瀷 NodeProps / EdgeProps锛屼笉缁戝畾 StoryFlowNodeData 鎴?StoryEdgeType
 *
 * @module theme-platform/types
 */

import type React from 'react';
import type { EdgeProps, NodeProps } from '@xyflow/react';

// ============================================================================
// 鏍稿績 ID
// ============================================================================

/** 涓婚鍞竴鏍囪瘑绗︺€備换浣曞敮涓€瀛楃涓插潎鍙敞鍐岋紝瀹為檯 ID 鐢?Registry.validateId 鏍￠獙銆?*/
export type ThemeId = string;

// ============================================================================
// 澶氳瑷€瀛楃涓?// ============================================================================

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
// Monaco 缂栬緫鍣ㄤ富棰?// ============================================================================

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
// 甯冨眬閰嶆柟
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
// 鍔ㄦ晥閰嶆柟
// ============================================================================

export interface ThemeMotionRecipe {
  readonly intensity: 'quiet' | 'subtle' | 'expressive';
  readonly nodeHoverLift?: boolean;
  readonly cableGlow?: boolean;
  readonly backgroundDrift?: boolean;
}

// ============================================================================
// 浜や簰閰嶆柟
// ============================================================================

export interface ThemeInteractionRecipe {
  readonly density: 'calm' | 'balanced' | 'dense';
  readonly realtimeWirePreview?: boolean;
  readonly highlightConnectTargets?: boolean;
  readonly prominentPorts?: boolean;
}

// ============================================================================
// 鍏ュ彛閰嶆柟
// ============================================================================

export interface ThemeEntryRecipe {
  readonly graphLabDefaultEntry: 'contentBrowserFirst' | 'canvasFirst' | 'inspectorFirst';
  readonly sourceDockDefault: 'collapsed' | 'expanded' | 'hidden';
  readonly primaryActionLabel: ThemeLocaleString;
}

// ============================================================================
// 璧勪骇
// ============================================================================

export interface ThemeAssets {
  readonly preview: string;
  readonly workbenchTexture?: string;
  readonly nodeSurface?: string;
}

// ============================================================================
// 鍟嗗簵鍏冩暟鎹?// ============================================================================

export interface ThemeStoreMeta {
  readonly availability: 'bundled' | 'officialRemote';
  readonly priceLabel: string;
  readonly storeUrl: string;
}

export interface OfficialThemeRegistryEntry {
  readonly id: string;
  readonly name: ThemeLocaleString;
  readonly version: string;
  readonly channel: 'stable' | 'preview';
  readonly priceLabel: '免费主题';
  readonly manifestUrl: string;
  readonly bundleUrl: string;
  readonly sha256: string;
  readonly minAppVersion: string;
  readonly themeApiVersion: number;
  readonly previewUrl: string;
  readonly changelog: string;
}

export interface OfficialThemeCatalogResult {
  readonly ok: boolean;
  readonly entries: readonly OfficialThemeRegistryEntry[];
  readonly message?: string;
}

export interface InstalledOfficialThemeSummary {
  readonly id: string;
  readonly version: string;
  readonly name: ThemeLocaleString;
  readonly priceLabel: '免费主题';
  readonly installedAt: number;
}

export type OfficialThemeRemoteStatus = 'installed' | 'updateAvailable' | 'notInstalled';

export interface OfficialThemeRemoteView extends OfficialThemeRegistryEntry {
  readonly status: OfficialThemeRemoteStatus;
  readonly installedVersion?: string;
}

export interface OfficialThemeDownloadResult {
  readonly ok: boolean;
  readonly id?: string;
  readonly version?: string;
  readonly message: string;
  readonly errors?: readonly string[];
}

// ============================================================================
// React 缁勪欢鎻掓Ы
// ============================================================================

/**
 * 涓婚鍙浛鎹㈢殑 React 缁勪欢鎻掓Ы銆? *
 * 浣跨敤娉涘瀷 NodeProps / EdgeProps 鑰岄潪鍏蜂綋 StoryFlowNodeData / StoryEdgeType锛? * 浣垮钩鍙扮被鍨嬬嫭绔嬩簬浠讳綍鍏蜂綋缁勪欢瀹炵幇銆傜被鍨嬪吋瀹规€у湪 GraphCanvas 鐨?nodeTypes/edgeTypes
 * 璧嬪€煎鐢?TypeScript 妫€鏌ャ€? */
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
  readonly remoteThemes: React.ReactNode;
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
// 涓婚鎻忚堪绗︼紙椤跺眰锛?// ============================================================================

/**
 * 涓€涓畬鏁寸殑涓婚瀹氫箟銆? *
 * 娉ㄥ唽鍒?ThemeRegistry 鍚庨€氳繃 ThemePlatformProvider 婵€娲汇€? * 鎵€鏈夊瓧娈靛繀闇€锛堟棤鍙€夊閿級锛岀‘淇濇敞鍐屾椂鍗冲彲鏍￠獙瀹屾暣鎬с€? */
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
