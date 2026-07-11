import type { ThemeDescriptor } from '../../../theme-platform/types';
import { narrativeWorkbenchSlots } from './slots';
import { defaultThemeSurfaces } from '../../surfaces/defaultSurfaces';
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

export const narrativeWorkbenchTheme: ThemeDescriptor = {
  id: asString(data['id'], 'plotflow-narrative-workbench'),
  name: asLocale(data['name'], 'Narrative Workbench', '叙事工作台'),
  tagline: asLocale(data['tagline'], 'Warm paper workspace with blueprint cables', '暖纸工作台与蓝图线缆'),
  description: asLocale(data['description'], 'The default official theme for long-form narrative editing.', 'PlotFlow 默认官方主题。'),
  version: asString(data['version'], '1.0.0'),
  defaultMode: (data['defaultMode'] as 'light' | 'dark') ?? 'light',
  tokens: asRecord(data['tokens'], { shared: {}, light: {}, dark: {} }),
  monacoTheme: data['monacoTheme'] as Record<string, unknown> | undefined,
  assets: asRecord(data['assets'], { preview: '' }),
  layoutRecipe: asRecord(data['layoutRecipe'], { density: 'comfortable' }),
  uxRecipe: asRecord(data['uxRecipe'], {}),
  entryRecipe: asRecord(data['entryRecipe'], {
    graphLabDefaultEntry: 'contentBrowserFirst',
    sourceDockDefault: 'collapsed',
    primaryActionLabel: { 'zh-CN': '开始', 'en-US': 'Start' },
  }),
  interactionRecipe: asRecord(data['interactionRecipe'], {
    density: 'calm',
    realtimeWirePreview: true,
    highlightConnectTargets: true,
    prominentPorts: true,
  }),
  motionRecipe: asRecord(data['motionRecipe'], {
    intensity: 'subtle',
    nodeHoverLift: true,
    cableGlow: false,
    backgroundDrift: true,
  }),
  storeMeta: asRecord(data['storeMeta'], {
    availability: 'bundled',
    priceLabel: '已随 PlotFlow 内置',
    storeUrl: 'https://plotflow.app/themes',
  }),
  slots: narrativeWorkbenchSlots,
  surfaces: defaultThemeSurfaces,
};
