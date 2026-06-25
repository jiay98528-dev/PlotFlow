export const OFFICIAL_THEME_IDS = [
  'plotflow-narrative-workbench',
  'plotflow-blueprint-nightwatch',
] as const;

export type OfficialThemeId = (typeof OFFICIAL_THEME_IDS)[number];

export const DEFAULT_OFFICIAL_THEME_ID: OfficialThemeId = 'plotflow-narrative-workbench';

const LEGACY_THEME_ID_MAP: Readonly<Record<string, OfficialThemeId>> = {
  'plotflow-narrative-whiteboard': 'plotflow-narrative-workbench',
  'plotflow-narrative-workbench': 'plotflow-narrative-workbench',
  'plotflow-blueprint-nightwatch': 'plotflow-blueprint-nightwatch',
};

export function normalizeOfficialThemeId(value: string | null | undefined): OfficialThemeId {
  if (!value) return DEFAULT_OFFICIAL_THEME_ID;
  return LEGACY_THEME_ID_MAP[value] ?? DEFAULT_OFFICIAL_THEME_ID;
}
