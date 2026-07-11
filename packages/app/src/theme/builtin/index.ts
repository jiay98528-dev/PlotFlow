import { narrativeWorkbenchTheme } from './plotflow-narrative-workbench/index';
import { engineTelemetryTheme } from './plotflow-engine-telemetry/index';
import { prismFoundryTheme } from './plotflow-prism-foundry/index';

export const builtinThemes = [
  prismFoundryTheme,
  narrativeWorkbenchTheme,
  engineTelemetryTheme,
] as const;
