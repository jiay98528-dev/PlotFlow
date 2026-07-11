/**
 * PlotFlow Theme Platform — 主题应用引擎
 *
 * 提供单一的 applyThemeToRoot 函数，替换旧的 applyThemePackToRoot
 * 和 applyOfficialThemeToRoot。职责范围仅限于 DOM 根元素的 CSS 变量
 * 和 data-* 属性写入。不涉及 Monaco 编辑器或 React 组件。
 *
 * @module theme-platform/engine
 */

import type { ThemeDescriptor } from './types';

// ============================================================================
// 公共函数
// ============================================================================

/**
 * 将主题应用到 document.documentElement。
 *
 * 操作：
 * 1. 设置 data-theme、data-theme-id、data-theme-density、data-theme-card、
 *    data-theme-source-dock、data-theme-cable、data-theme-motion
 * 2. 清除所有现有 --theme-* CSS 自定义属性
 * 3. 合并 shared + mode 特定 tokens 并写入 CSS 自定义属性
 * 4. 写入布局维度变量 (--theme-graph-lab-*)
 *
 * 不操作：
 * - Monaco 编辑器（由 Provider 负责）
 * - document.documentElement.lang（由 Provider 负责）
 * - data-accent（已废弃，不再设置）
 */
export function applyThemeToRoot(
  root: HTMLElement,
  theme: ThemeDescriptor,
  mode: 'light' | 'dark',
): void {
  // ---- 1. data-* 属性 ----
  root.dataset['theme'] = mode;
  root.dataset['themeId'] = theme.id;

  const density = theme.layoutRecipe?.density ?? 'comfortable';
  root.dataset['themeDensity'] = density;

  const graphLab = theme.layoutRecipe?.graphLab;
  if (graphLab) {
    root.dataset['themeCard'] = graphLab.nodeCardStyle;
    root.dataset['themeSourceDock'] = graphLab.sourceDock;
    root.dataset['themeCable'] = graphLab.cableStyle;
    root.dataset['themeMotion'] = graphLab.motionIntensity ?? theme.motionRecipe?.intensity ?? 'subtle';
  } else {
    delete root.dataset['themeCard'];
    delete root.dataset['themeSourceDock'];
    delete root.dataset['themeCable'];
    root.dataset['themeMotion'] = theme.motionRecipe?.intensity ?? 'subtle';
  }

  // ---- 2. 清除现有 --theme-* 变量 ----
  for (const name of Array.from(root.style)) {
    if (name.startsWith('--theme-')) {
      root.style.removeProperty(name);
    }
  }

  // ---- 3. 应用 tokens ----
  const tokens: Record<string, string> = {
    ...(theme.tokens.shared ?? {}),
    ...(theme.tokens[mode] ?? {}),
  };

  for (const [name, value] of Object.entries(tokens)) {
    root.style.setProperty(name, value);
  }

  // ---- 4. 布局维度变量 ----
  if (graphLab) {
    if (graphLab.paletteWidth) {
      root.style.setProperty('--theme-graph-lab-palette-width', `${graphLab.paletteWidth}px`);
    }
    if (graphLab.railWidth) {
      root.style.setProperty('--theme-graph-lab-rail-width', `${graphLab.railWidth}px`);
    }
    if (graphLab.inspectorWidth) {
      root.style.setProperty('--theme-graph-lab-inspector-width', `${graphLab.inspectorWidth}px`);
    }
    if (graphLab.sourceDockHeight) {
      root.style.setProperty('--theme-graph-lab-source-dock-height', `${graphLab.sourceDockHeight}px`);
    }
  }

  const uxRecipe = theme.uxRecipe ?? {};
  for (const [scope, recipe] of Object.entries(uxRecipe)) {
    if (!recipe || typeof recipe !== 'object') continue;
    root.dataset[`themeUx${scope.charAt(0).toUpperCase()}${scope.slice(1)}`] = 'custom';
    for (const [key, value] of Object.entries(recipe)) {
      if (typeof value !== 'string' || value.length === 0) continue;
      const cssName = `--theme-ux-${toKebabCase(scope)}-${toKebabCase(key)}`;
      root.style.setProperty(cssName, value);
    }
  }
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
