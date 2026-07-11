import type { ThemeDescriptor } from '../../../theme-platform/types';
import { engineTelemetrySlots } from './slots';
import { engineTelemetrySurfaces } from './surfaces';
import raw from './theme.json';

const data = raw as Record<string, unknown>;

function asRecord<T = Record<string, unknown>>(val: unknown, fallback: T): T {
  if (val && typeof val === 'object') return val as T;
  return fallback;
}

function asString(val: unknown, fallback: string): string {
  return typeof val === 'string' ? val : fallback;
}

function asLocale(val: unknown, fallbackEn: string, fallbackZh: string): { 'zh-CN': string; 'en-US': string } {
  if (val && typeof val === 'object') {
    const obj = val as Record<string, string>;
    return { 'zh-CN': obj['zh-CN'] ?? fallbackZh, 'en-US': obj['en-US'] ?? fallbackEn };
  }
  return { 'zh-CN': fallbackZh, 'en-US': fallbackEn };
}

export const engineTelemetryTheme: ThemeDescriptor = {
  id: asString(data['id'], 'plotflow-engine-telemetry'),
  name: asLocale(data['name'], 'Engine Telemetry', '引擎遥测台'),
  tagline: asLocale(data['tagline'], 'Dark engine console for topology-first story work', '面向拓扑优先叙事编辑的深色引擎控制台'),
  description: asLocale(data['description'], 'A bundled official theme built around Source Spine, Topology Canvas, and Inspector Rack.', '以内置 Source Spine、Topology Canvas、Inspector Rack 为骨架的官方主题。'),
  version: asString(data['version'], '1.0.0'),
  defaultMode: (data['defaultMode'] as 'light' | 'dark') ?? 'dark',
  tokens: asRecord(data['tokens'], { shared: {}, light: {}, dark: {} }),
  monacoTheme: data['monacoTheme'] as Record<string, unknown> | undefined,
  assets: asRecord(data['assets'], { preview: '' }),
  layoutRecipe: asRecord(data['layoutRecipe'], { density: 'compact' }),
  uxRecipe: asRecord(data['uxRecipe'], {}),
  entryRecipe: asRecord(data['entryRecipe'], {
    graphLabDefaultEntry: 'canvasFirst',
    sourceDockDefault: 'collapsed',
    primaryActionLabel: { 'zh-CN': '进入遥测台', 'en-US': 'Open Console' },
  }),
  interactionRecipe: asRecord(data['interactionRecipe'], {
    density: 'dense',
    realtimeWirePreview: true,
    highlightConnectTargets: true,
    prominentPorts: true,
  }),
  motionRecipe: asRecord(data['motionRecipe'], {
    intensity: 'subtle',
    nodeHoverLift: true,
    cableGlow: true,
    backgroundDrift: false,
  }),
  storeMeta: asRecord(data['storeMeta'], {
    availability: 'bundled',
    priceLabel: '已随 PlotFlow 内置',
    storeUrl: 'https://plotflow.app/themes/plotflow-engine-telemetry',
  }),
  slots: engineTelemetrySlots,
  surfaces: engineTelemetrySurfaces,
};
