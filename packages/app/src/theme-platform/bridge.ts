/**
 * PlotFlow Theme Platform — Monaco 编辑器桥接
 *
 * 提供 Monaco 编辑器主题名称生成和主题解析工具。
 * 不直接调用 monaco.editor API（由 Provider 负责）。
 *
 * @module theme-platform/bridge
 */

import type { ThemeDescriptor, ThemeMonacoDefinition, ThemeId } from './types';

/**
 * 生成 Monaco 编辑器主题名称。
 * 格式："{themeId}-{mode}-monaco"
 */
export function createMonacoThemeName(themeId: ThemeId, mode: string): string {
  return `${themeId}-${mode}-monaco`;
}

/**
 * 从 ThemeDescriptor 解析 Monaco 主题定义。
 *
 * 回退逻辑：
 * - 优先使用匹配 mode 的主题
 * - dark 模式无定义时回退到 light
 * - light 模式无定义时回退到 dark
 * - 都没有返回 null（Provider 使用默认亮/暗 Monaco 主题）
 */
export function resolveMonacoTheme(
  theme: ThemeDescriptor,
  mode: 'light' | 'dark',
): ThemeMonacoDefinition | null {
  const themes = theme.monacoTheme;
  if (!themes) return null;

  const exact = themes[mode];
  if (exact) return exact;

  const fallbackMode = mode === 'dark' ? 'light' : 'dark';
  const fallback = themes[fallbackMode];
  if (fallback) return fallback;

  return null;
}
