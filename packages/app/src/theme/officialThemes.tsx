import { THEME_MARKET_URL } from './themePack';
import type { OfficialThemeDefinition } from './officialThemeTypes';
import { blueprintNightwatchSlots, narrativeWorkbenchSlots } from './officialThemeSlots';

const workbenchMonaco = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '1f5f91', fontStyle: 'bold' },
    { token: 'string', foreground: '8b5e34' },
    { token: 'comment', foreground: '7b735f', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#fbf4e4',
    'editor.foreground': '#2d2a22',
    'editorLineNumber.foreground': '#9b917b',
    'editorCursor.foreground': '#1f5f91',
    'editor.selectionBackground': '#b8d6e866',
  },
} as const;

const nightwatchMonaco = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: '74d6ff', fontStyle: 'bold' },
    { token: 'string', foreground: 'f0b77a' },
    { token: 'comment', foreground: '8093a7', fontStyle: 'italic' },
  ],
  colors: {
    'editor.background': '#07111f',
    'editor.foreground': '#d6e7f5',
    'editorLineNumber.foreground': '#53657a',
    'editorCursor.foreground': '#74d6ff',
    'editor.selectionBackground': '#1b77ad66',
  },
} as const;

export const officialThemes: readonly OfficialThemeDefinition[] = [
  {
    id: 'plotflow-narrative-workbench',
    name: {
      'zh-CN': '叙事工作台',
      'en-US': 'Narrative Workbench',
    },
    tagline: {
      'zh-CN': '暖纸工作台与蓝图线缆',
      'en-US': 'Warm paper workspace with blueprint cables',
    },
    description: {
      'zh-CN': '面向长时间叙事编辑的默认官方主题，强调纸面层级、清晰端口和低噪声工作台。',
      'en-US': 'The default official theme for long-form narrative editing, with paper layers, clear ports, and a quiet workbench.',
    },
    version: '1.0.0',
    defaultMode: 'light',
    tokens: {
      shared: {
        '--theme-blueprint-canvas': 'linear-gradient(90deg, oklch(0.79 0.022 83 / 0.24) 1px, transparent 1px), linear-gradient(0deg, oklch(0.79 0.022 83 / 0.24) 1px, transparent 1px)',
        '--theme-graph-lab-paper': 'oklch(0.96 0.03 86)',
        '--theme-graph-lab-surface': 'oklch(0.985 0.016 88)',
        '--theme-node-surface': 'oklch(0.99 0.01 90)',
        '--theme-node-border': 'oklch(0.78 0.038 82)',
        '--theme-node-ink': 'oklch(0.23 0.028 78)',
        '--theme-node-muted': 'oklch(0.48 0.035 78)',
        '--theme-graph-cable-default': 'oklch(0.47 0.12 236)',
        '--theme-graph-cable-conditional': 'oklch(0.58 0.11 44)',
        '--theme-port-fill': 'oklch(0.58 0.12 158)',
        '--theme-panel-surface': 'oklch(0.985 0.018 88 / 0.94)',
        '--theme-workbench-shadow': '0 18px 46px oklch(0.29 0.05 80 / 0.16)',
      },
      light: {},
      dark: {
        '--theme-graph-lab-paper': 'oklch(0.21 0.025 78)',
        '--theme-graph-lab-surface': 'oklch(0.25 0.025 76)',
        '--theme-node-surface': 'oklch(0.28 0.025 76)',
        '--theme-node-ink': 'oklch(0.91 0.02 84)',
        '--theme-node-muted': 'oklch(0.72 0.025 80)',
      },
    },
    monacoTheme: {
      light: workbenchMonaco,
      dark: nightwatchMonaco,
    },
    assets: {
      preview: 'builtin://themes/narrative-workbench/preview',
      workbenchTexture: 'builtin://themes/narrative-workbench/paper',
      nodeSurface: 'builtin://themes/narrative-workbench/node-surface',
    },
    layoutRecipe: {
      density: 'cinematic',
      graphLab: {
        paletteWidth: 292,
        railWidth: 292,
        inspectorWidth: 388,
        sourceDockHeight: 330,
        sourceDock: 'bottom',
        nodeCardStyle: 'paper-card',
        cableStyle: 'blueprint-cable',
        motionIntensity: 'subtle',
      },
    },
    entryRecipe: {
      graphLabDefaultEntry: 'contentBrowserFirst',
      sourceDockDefault: 'collapsed',
      primaryActionLabel: {
        'zh-CN': '从章节与文件开始',
        'en-US': 'Start with chapters and files',
      },
    },
    interactionRecipe: {
      density: 'calm',
      realtimeWirePreview: true,
      highlightConnectTargets: true,
      prominentPorts: true,
    },
    motionRecipe: {
      intensity: 'subtle',
      nodeHoverLift: true,
      cableGlow: false,
      backgroundDrift: true,
    },
    storeMeta: {
      availability: 'bundled',
      priceLabel: '已随 PlotFlow 内置',
      storeUrl: THEME_MARKET_URL,
    },
    slots: narrativeWorkbenchSlots,
  },
  {
    id: 'plotflow-blueprint-nightwatch',
    name: {
      'zh-CN': '夜航蓝图',
      'en-US': 'Blueprint Nightwatch',
    },
    tagline: {
      'zh-CN': '低光编辑室与发光线缆',
      'en-US': 'Low-light studio with luminous blueprint cables',
    },
    description: {
      'zh-CN': '面向夜间和高密度图形编辑的官方深色主题，突出线缆、端口、焦点态和诊断状态。',
      'en-US': 'An official dark theme for night work and dense graph editing, emphasizing cables, ports, focus, and diagnostics.',
    },
    version: '1.0.0',
    defaultMode: 'dark',
    tokens: {
      shared: {
        '--theme-blueprint-canvas': 'radial-gradient(circle at 18% 18%, oklch(0.58 0.12 236 / 0.18), transparent 30%), linear-gradient(90deg, oklch(0.47 0.11 236 / 0.22) 1px, transparent 1px), linear-gradient(0deg, oklch(0.47 0.11 236 / 0.2) 1px, transparent 1px)',
        '--theme-graph-lab-paper': 'oklch(0.16 0.032 250)',
        '--theme-graph-lab-surface': 'oklch(0.19 0.038 249)',
        '--theme-node-surface': 'oklch(0.22 0.05 248 / 0.96)',
        '--theme-node-border': 'oklch(0.58 0.15 235)',
        '--theme-node-ink': 'oklch(0.9 0.035 230)',
        '--theme-node-muted': 'oklch(0.72 0.055 230)',
        '--theme-graph-cable-default': 'oklch(0.76 0.16 226)',
        '--theme-graph-cable-conditional': 'oklch(0.78 0.13 55)',
        '--theme-port-fill': 'oklch(0.75 0.18 215)',
        '--theme-panel-surface': 'oklch(0.18 0.036 250 / 0.94)',
        '--theme-workbench-shadow': '0 22px 70px oklch(0.05 0.02 260 / 0.55)',
      },
      light: {
        '--theme-graph-lab-paper': 'oklch(0.23 0.045 250)',
        '--theme-graph-lab-surface': 'oklch(0.25 0.052 249)',
      },
      dark: {},
    },
    monacoTheme: {
      light: nightwatchMonaco,
      dark: nightwatchMonaco,
    },
    assets: {
      preview: 'builtin://themes/blueprint-nightwatch/preview',
      workbenchTexture: 'builtin://themes/blueprint-nightwatch/grid',
      nodeSurface: 'builtin://themes/blueprint-nightwatch/node-surface',
    },
    layoutRecipe: {
      density: 'compact',
      graphLab: {
        paletteWidth: 280,
        railWidth: 280,
        inspectorWidth: 400,
        sourceDockHeight: 312,
        sourceDock: 'bottom',
        nodeCardStyle: 'blueprint-card',
        cableStyle: 'blueprint-cable',
        motionIntensity: 'expressive',
      },
    },
    entryRecipe: {
      graphLabDefaultEntry: 'canvasFirst',
      sourceDockDefault: 'collapsed',
      primaryActionLabel: {
        'zh-CN': '从蓝图画布开始',
        'en-US': 'Start from the blueprint canvas',
      },
    },
    interactionRecipe: {
      density: 'dense',
      realtimeWirePreview: true,
      highlightConnectTargets: true,
      prominentPorts: true,
    },
    motionRecipe: {
      intensity: 'expressive',
      nodeHoverLift: true,
      cableGlow: true,
      backgroundDrift: false,
    },
    storeMeta: {
      availability: 'bundled',
      priceLabel: '已随 PlotFlow 内置',
      storeUrl: THEME_MARKET_URL,
    },
    slots: blueprintNightwatchSlots,
  },
] as const;

export function listOfficialThemes(): readonly OfficialThemeDefinition[] {
  return officialThemes;
}
