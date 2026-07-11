import React from 'react';
import { ThemePlatformProvider } from './ThemePlatformProvider';

export interface ThemeProviderProps {
  readonly children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  return <ThemePlatformProvider>{children}</ThemePlatformProvider>;
}
