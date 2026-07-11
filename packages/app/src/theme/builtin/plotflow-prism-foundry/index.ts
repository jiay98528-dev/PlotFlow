import type { ThemeDescriptor } from '../../../theme-platform/types';
import { prismFoundrySlots } from './slots';
import { prismFoundrySurfaces } from './surfaces';
import raw from './theme.json';

const data = raw as Record<string, unknown>;

function asRecord<T = Record<string, unknown>>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object') return value as T;
  return fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asLocale(
  value: unknown,
  fallbackEn: string,
  fallbackZh: string,
): { 'zh-CN': string; 'en-US': string } {
  if (value && typeof value === 'object') {
    const locale = value as Record<string, string>;
    return {
      'zh-CN': locale['zh-CN'] ?? fallbackZh,
      'en-US': locale['en-US'] ?? fallbackEn,
    };
  }

  return { 'zh-CN': fallbackZh, 'en-US': fallbackEn };
}

/** PlotFlow 默认的亮色官方主题：冷白棱镜工作台与受控液态玻璃材质。 */
export const prismFoundryTheme: ThemeDescriptor = {
  id: asString(data['id'], 'plotflow-prism-foundry'),
  name: asLocale(data['name'], 'Prism Foundry', '棱镜铸造台'),
  tagline: asLocale(
    data['tagline'],
    'Liquid glass narrative workstation with violet control and cyan signal routes',
    '冷白液态玻璃叙事工作台，紫罗兰主操作与青色信号路线',
  ),
  description: asLocale(
    data['description'],
    'A bright official workstation that layers precise glass structure around an opaque reading surface.',
    '以克制液态玻璃组织工作台层级，并用高不透明阅读面守住长时间创作舒适度的亮色官方主题。',
  ),
  version: asString(data['version'], '1.0.0'),
  defaultMode: (data['defaultMode'] as 'light' | 'dark') ?? 'light',
  tokens: asRecord(data['tokens'], { shared: {}, light: {} }),
  monacoTheme: data['monacoTheme'] as Record<string, unknown> | undefined,
  assets: asRecord(data['assets'], { preview: 'assets/preview.svg' }),
  layoutRecipe: asRecord(data['layoutRecipe'], { density: 'comfortable' }),
  uxRecipe: asRecord(data['uxRecipe'], {}),
  entryRecipe: asRecord(data['entryRecipe'], {
    graphLabDefaultEntry: 'canvasFirst',
    sourceDockDefault: 'collapsed',
    primaryActionLabel: { 'zh-CN': '进入铸造台', 'en-US': 'Enter Foundry' },
  }),
  interactionRecipe: asRecord(data['interactionRecipe'], {
    density: 'balanced',
    realtimeWirePreview: true,
    highlightConnectTargets: true,
    prominentPorts: true,
  }),
  motionRecipe: asRecord(data['motionRecipe'], {
    intensity: 'expressive',
    nodeHoverLift: true,
    cableGlow: true,
    backgroundDrift: false,
  }),
  storeMeta: asRecord(data['storeMeta'], {
    availability: 'bundled',
    priceLabel: '随 PlotFlow 内置',
    storeUrl: 'https://plotflow.app/themes/plotflow-prism-foundry',
  }),
  slots: prismFoundrySlots,
  surfaces: prismFoundrySurfaces,
};
