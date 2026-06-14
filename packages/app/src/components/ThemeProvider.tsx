import React, { useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { THEME_DARK, THEME_LIGHT } from '../editor/setupEditor';
import { useUIStore } from '../stores/uiStore';

export interface ThemeProviderProps {
  readonly children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  const theme = useUIStore((state) => state.theme);
  const accent = useUIStore((state) => state.accent);
  const language = useUIStore((state) => state.language);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset['theme'] = theme;
    root.dataset['accent'] = accent;

    const monacoTheme = theme === 'dark' ? THEME_DARK : THEME_LIGHT;
    monaco.editor.setTheme(monacoTheme);
  }, [theme, accent]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <>{children}</>;
}
