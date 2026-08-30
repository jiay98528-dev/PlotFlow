/**
 * ThemePlatformProvider — 平台统一主题 Provider
 *
 * 本组件是主题系统的唯一运行时 owner。职责：
 * 1. 将内置主题注册到 ThemeRegistry（mount 时）
 * 2. 调用 engine.applyThemeToRoot 应用 CSS 变量和 data-* 属性
 * 3. 注册并激活 Monaco 编辑器主题
 * 4. 设置 document.documentElement.lang
 * 5. 通过 React Context 暴露 { activeTheme, themes, activeThemeId }
 *
 * 三个 useEffect 各自独立职责，单一依赖。
 *
 * @module components/ThemePlatformProvider
 */

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import * as monaco from 'monaco-editor';
import { THEME_DARK, THEME_LIGHT } from '../editor/setupEditor';
import { useUIStore, type Language } from '../stores/uiStore';
import { applyThemeToRoot } from '../theme-platform/engine';
import { registerTheme, getThemeOrDefault, listThemes } from '../theme-platform/registry';
import { createMonacoThemeName, resolveMonacoTheme } from '../theme-platform/bridge';
import type { ThemeDescriptor, ThemeId } from '../theme-platform/types';
import { builtinThemes } from '../theme/builtin/index';

// ============================================================================
// Context
// ============================================================================

export interface ThemePlatformContextValue {
  readonly activeTheme: ThemeDescriptor;
  readonly themes: readonly ThemeDescriptor[];
  readonly activeThemeId: ThemeId;
}

const ThemePlatformContext = createContext<ThemePlatformContextValue | null>(null);

export function useThemePlatform(): ThemePlatformContextValue {
  const value = useContext(ThemePlatformContext);
  if (!value) {
    throw new Error('useThemePlatform must be used within ThemePlatformProvider');
  }
  return value;
}

// ============================================================================
// 模块初始化 — 注册内置主题（首次 import 时执行，先于任何组件 render）
// ============================================================================

for (const theme of builtinThemes) {
  registerTheme(theme);
}

// ============================================================================
// Provider
// ============================================================================

export interface ThemePlatformProviderProps {
  readonly children: React.ReactNode;
}

export function ThemePlatformProvider({ children }: ThemePlatformProviderProps): React.ReactElement {
  const language: Language = useUIStore((state) => state.language);
  const activeThemeId: ThemeId = useUIStore((state) => state.activeThemeId);
  const setActiveThemeId = useUIStore((state) => state.setActiveThemeId);
  const themes = useMemo<readonly ThemeDescriptor[]>(() => listThemes(), []);

  const activeTheme = useMemo(() => getThemeOrDefault(activeThemeId), [activeThemeId]);

  // Persisted remote/unknown IDs are corrected to the bundled default. Existing
  // theme directories on disk are deliberately ignored and left untouched.
  useEffect(() => {
    if (activeThemeId !== activeTheme.id) setActiveThemeId(activeTheme.id);
  }, [activeTheme.id, activeThemeId, setActiveThemeId]);

  // --- Effect 1: CSS 应用 ---
  useEffect(() => {
    const root = document.documentElement;
    applyThemeToRoot(root, activeTheme, activeTheme.defaultMode);
  }, [activeTheme]);

  // --- Effect 2: Monaco 主题 ---
  useEffect(() => {
    const mode = activeTheme.defaultMode;
    const monacoThemeData = resolveMonacoTheme(activeTheme, mode);

    if (monacoThemeData) {
      const monacoThemeName = createMonacoThemeName(activeTheme.id, mode);
      monaco.editor.defineTheme(
        monacoThemeName,
        monacoThemeData as unknown as monaco.editor.IStandaloneThemeData,
      );
      monaco.editor.setTheme(monacoThemeName);
    } else {
      monaco.editor.setTheme(mode === 'dark' ? THEME_DARK : THEME_LIGHT);
    }
  }, [activeTheme]);

  // --- Effect 3: 语言 ---
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // --- Context value ---
  const value = useMemo<ThemePlatformContextValue>(
    () => ({
      activeTheme,
      themes,
      activeThemeId: activeTheme.id,
    }),
    [activeTheme, themes],
  );

  return (
    <ThemePlatformContext.Provider value={value}>
      {children}
    </ThemePlatformContext.Provider>
  );
}
