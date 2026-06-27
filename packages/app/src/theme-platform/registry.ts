/**
 * PlotFlow Theme Platform — 主题注册表
 *
 * 基于 Map 的运行时注册表。支持注册、查找、列表。
 * DEFAULT_THEME_ID 定义了未指定主题时的回退值。
 *
 * @module theme-platform/registry
 */

import type { ThemeDescriptor, ThemeId } from './types';

// ============================================================================
// 注册表
// ============================================================================

const registry = new Map<ThemeId, ThemeDescriptor>();

// ============================================================================
// 常量
// ============================================================================

export const DEFAULT_THEME_ID: ThemeId = 'plotflow-narrative-workbench';

// ============================================================================
// 公开 API
// ============================================================================

/** 注册一个主题。相同 ID 重复注册会覆盖（幂等）。 */
export function registerTheme(theme: ThemeDescriptor): void {
  registry.set(theme.id, theme);
}

/** 按 ID 查找主题，不存在返回 undefined。 */
export function getTheme(id: ThemeId): ThemeDescriptor | undefined {
  return registry.get(id);
}

/** 按 ID 查找主题，不存在返回默认主题。 */
export function getThemeOrDefault(id: ThemeId): ThemeDescriptor {
  return registry.get(id) ?? registry.get(DEFAULT_THEME_ID)!;
}

/** 列出所有已注册主题。 */
export function listThemes(): readonly ThemeDescriptor[] {
  return Array.from(registry.values());
}

/** 检查指定 ID 的主题是否已注册。 */
export function hasTheme(id: ThemeId): boolean {
  return registry.has(id);
}
