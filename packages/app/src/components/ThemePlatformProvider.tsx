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

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as monaco from 'monaco-editor';
import { THEME_DARK, THEME_LIGHT } from '../editor/setupEditor';
import { useUIStore, type Language } from '../stores/uiStore';
import { applyThemeToRoot } from '../theme-platform/engine';
import { registerTheme, getThemeOrDefault, listThemes } from '../theme-platform/registry';
import { createMonacoThemeName, resolveMonacoTheme } from '../theme-platform/bridge';
import type { ThemeDescriptor, ThemeId } from '../theme-platform/types';
import { builtinThemes } from '../theme/builtin/index';
import { getInstalledOfficialThemeDescriptor } from '../theme/officialRemoteThemes';

// ============================================================================
// Context
// ============================================================================

export interface ThemePlatformContextValue {
  readonly activeTheme: ThemeDescriptor;
  readonly themes: readonly ThemeDescriptor[];
  readonly activeThemeId: ThemeId;
  readonly refreshOfficialThemes: () => Promise<void>;
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
  const [themes, setThemes] = useState<readonly ThemeDescriptor[]>(() => listThemes());
  const refreshOfficialThemes = React.useCallback(async () => {
    const installed = await window.plotflow?.theme?.listOfficialInstalled?.();
    let changed = false;
    for (const summary of installed ?? []) {
      const descriptor = getInstalledOfficialThemeDescriptor(summary);
      if (!descriptor) continue;
      registerTheme(descriptor);
      changed = true;
    }
    if (changed) setThemes(listThemes());
  }, []);

  const activeTheme = useMemo(
    () => getThemeOrDefault(activeThemeId),
    [activeThemeId, themes],
  );

  useEffect(() => {
    let cancelled = false;
    void refreshOfficialThemes()
      .then(() => {
        if (cancelled) return;
      })
      .catch(() => {
        // Remote official themes are optional; builtin themes remain the safe baseline.
      });
    return () => {
      cancelled = true;
    };
  }, [refreshOfficialThemes]);

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
      refreshOfficialThemes,
    }),
    [activeTheme, themes, refreshOfficialThemes],
  );

  return (
    <ThemePlatformContext.Provider value={value}>
      {children}
    </ThemePlatformContext.Provider>
  );
}
