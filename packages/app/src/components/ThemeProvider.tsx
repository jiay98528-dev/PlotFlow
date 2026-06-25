import React from 'react';
import { OfficialThemeProvider } from '../theme/OfficialThemeProvider';

export interface ThemeProviderProps {
  readonly children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  return <OfficialThemeProvider>{children}</OfficialThemeProvider>;
}
