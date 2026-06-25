export const THEME_PACK_SCHEMA_VERSION = 1;
export const DEFAULT_THEME_PACK_ID = 'plotflow-narrative-workbench';
export const THEME_MARKET_URL = 'https://plotflow.app/themes';

export type ThemePackSource = 'builtin' | 'local' | 'market';
export type ThemeMode = 'light' | 'dark';
export type ThemePackCapability = 'tokens' | 'visual' | 'layout' | 'monaco';
export type ThemeDensity = 'comfortable' | 'compact' | 'cinematic';
export type SourceDockPlacement = 'bottom' | 'right' | 'hidden';
export type NodeCardStyle = 'paper-card' | 'blueprint-card' | 'minimal-card';
export type CableStyle = 'soft-bezier' | 'blueprint-cable' | 'minimal-line';

export type ThemeTokenMap = Readonly<Record<string, string>>;
export type LocalizedThemeName =
  | string
  | {
      readonly 'zh-CN': string;
      readonly 'en-US': string;
      readonly default?: string;
    };

export interface ThemePackTokens {
  readonly light?: ThemeTokenMap;
  readonly dark?: ThemeTokenMap;
  readonly shared?: ThemeTokenMap;
}

export interface MonacoThemeDefinition {
  readonly base: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';
  readonly inherit: boolean;
  readonly rules: readonly Readonly<Record<string, unknown>>[];
  readonly colors?: Readonly<Record<string, string>>;
}

export interface ThemePackLayoutRecipe {
  readonly density?: ThemeDensity;
  readonly graphLab?: {
    readonly paletteWidth?: number;
    readonly inspectorWidth?: number;
    readonly railWidth?: number;
    readonly sourceDockHeight?: number;
    readonly sourceDock?: SourceDockPlacement;
    readonly nodeCardStyle?: NodeCardStyle;
    readonly cableStyle?: CableStyle;
    readonly motionIntensity?: 'none' | 'subtle' | 'expressive';
  };
}

export interface ThemePackAssets {
  readonly icon?: string;
  readonly preview?: string;
  readonly canvasTexture?: string;
  readonly workbenchTexture?: string;
  readonly nodeSurface?: string;
  readonly fonts?: readonly string[];
}

export interface ThemePackManifest {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly name: LocalizedThemeName;
  readonly version: string;
  readonly plotflowVersion: string;
  readonly author: string;
  readonly license: string;
  readonly description?: string;
  readonly homepage?: string;
  readonly capabilities?: readonly ThemePackCapability[];
  readonly tokens?: ThemePackTokens;
  readonly monacoTheme?: Partial<Record<ThemeMode, MonacoThemeDefinition>>;
  readonly layoutRecipe?: ThemePackLayoutRecipe;
  readonly assets?: ThemePackAssets;
  readonly screenshots?: readonly string[];
}

export interface ThemePackSummary {
  readonly id: string;
  readonly name: string;
  readonly localizedName?: Exclude<LocalizedThemeName, string>;
  readonly version: string;
  readonly author: string;
  readonly license: string;
  readonly description?: string;
  readonly source: ThemePackSource;
  readonly capabilities: readonly ThemePackCapability[];
  readonly status: 'ready' | 'invalid' | 'incompatible';
  readonly errors?: readonly string[];
}

export interface ThemePackValidationResult {
  readonly ok: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const TOKEN_NAME_PATTERN = /^--[a-z0-9-]+$/;
const REMOTE_URL_PATTERN = /^(https?:|data:|javascript:|file:)/i;
const FORBIDDEN_CSS_VALUE_PATTERN = /(url\s*\(|@import|expression\s*\(|javascript:|<script)/i;
const FORBIDDEN_KEYS = new Set([
  'script',
  'scripts',
  'javascript',
  'html',
  'ipc',
  'node',
  'preload',
  'remoteUrl',
]);
const ALLOWED_ASSET_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, max = 160): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function isLocalizedName(value: unknown): value is LocalizedThemeName {
  if (isNonEmptyString(value)) return true;
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value['zh-CN']) &&
    isNonEmptyString(value['en-US']) &&
    (value['default'] === undefined || isNonEmptyString(value['default']))
  );
}

export function getThemePackDisplayName(
  name: LocalizedThemeName,
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
): string {
  if (typeof name === 'string') return name;
  return name[locale] || name.default || name['zh-CN'];
}

function validateAssetPath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.includes('..') || REMOTE_URL_PATTERN.test(normalized)) {
    return '资产路径必须是主题包内的相对路径，且不能包含远程 URL 或路径穿越';
  }

  const dot = normalized.lastIndexOf('.');
  const ext = dot >= 0 ? normalized.slice(dot).toLowerCase() : '';
  if (!ALLOWED_ASSET_EXTENSIONS.has(ext)) {
    return `不支持的主题资产扩展名: ${ext || '(none)'}`;
  }

  return null;
}

function walkForbiddenKeys(value: unknown, errors: string[], path = 'theme'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForbiddenKeys(item, errors, `${path}[${index}]`));
    return;
  }

  if (!isRecord(value)) return;

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) {
      errors.push(`主题包不允许声明 ${path}.${key}`);
    }
    if (typeof nested === 'string' && REMOTE_URL_PATTERN.test(nested)) {
      errors.push(`主题包不允许远程或可执行 URL: ${path}.${key}`);
    }
    walkForbiddenKeys(nested, errors, `${path}.${key}`);
  }
}

function validateTokens(tokens: ThemeTokenMap | undefined, mode: string, errors: string[]): void {
  if (!tokens) return;

  for (const [name, value] of Object.entries(tokens)) {
    if (!TOKEN_NAME_PATTERN.test(name)) {
      errors.push(`${mode} token 名称必须以 CSS 变量形式声明: ${name}`);
    }
    if (typeof value !== 'string' || value.length > 240 || FORBIDDEN_CSS_VALUE_PATTERN.test(value)) {
      errors.push(`${mode} token 值不安全或过长: ${name}`);
    }
  }
}

function validateAssets(manifest: ThemePackManifest, errors: string[]): void {
  const assets = manifest.assets;
  if (!assets) return;

  const paths = [
    assets.icon,
    assets.preview,
    assets.canvasTexture,
    assets.workbenchTexture,
    assets.nodeSurface,
    ...(assets.fonts ?? []),
    ...(manifest.screenshots ?? []),
  ].filter((item): item is string => Boolean(item));

  for (const assetPath of paths) {
    const error = validateAssetPath(assetPath);
    if (error) errors.push(error);
  }
}

export function validateThemePackManifest(manifest: unknown): ThemePackValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(manifest)) {
    return { ok: false, errors: ['theme.json 必须是 JSON 对象'], warnings };
  }

  walkForbiddenKeys(manifest, errors);

  if (manifest['schemaVersion'] !== THEME_PACK_SCHEMA_VERSION) {
    errors.push(`schemaVersion 必须是 ${THEME_PACK_SCHEMA_VERSION}`);
  }

  if (!isNonEmptyString(manifest['id']) || !ID_PATTERN.test(manifest['id'])) {
    errors.push('id 必须是 3-64 位小写字母、数字、点、下划线或短横线');
  }

  if (!isLocalizedName(manifest['name'])) {
    errors.push('name 必须是非空字符串，或包含 zh-CN / en-US 的本地化名称对象');
  }

  for (const field of ['version', 'plotflowVersion', 'author', 'license'] as const) {
    if (!isNonEmptyString(manifest[field])) {
      errors.push(`${field} 为必填字符串`);
    }
  }

  const typedManifest = manifest as Partial<ThemePackManifest>;
  validateTokens(typedManifest.tokens?.shared, 'shared', errors);
  validateTokens(typedManifest.tokens?.light, 'light', errors);
  validateTokens(typedManifest.tokens?.dark, 'dark', errors);
  validateAssets(typedManifest as ThemePackManifest, errors);

  if (!typedManifest.tokens && !typedManifest.monacoTheme && !typedManifest.layoutRecipe && !typedManifest.assets) {
    warnings.push('主题包没有声明 tokens、monacoTheme、layoutRecipe 或 assets');
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function summarizeThemePack(
  manifest: ThemePackManifest,
  source: ThemePackSource,
  errors: readonly string[] = [],
): ThemePackSummary {
  const capabilities = manifest.capabilities ?? [
    ...(manifest.tokens ? ['tokens' as const] : []),
    ...(manifest.assets ? ['visual' as const] : []),
    ...(manifest.layoutRecipe ? ['layout' as const] : []),
    ...(manifest.monacoTheme ? ['monaco' as const] : []),
  ];

  return {
    id: manifest.id,
    name: getThemePackDisplayName(manifest.name),
    ...(typeof manifest.name === 'string' ? {} : { localizedName: manifest.name }),
    version: manifest.version,
    author: manifest.author,
    license: manifest.license,
    description: manifest.description,
    source,
    capabilities,
    status: errors.length > 0 ? 'invalid' : 'ready',
    ...(errors.length > 0 ? { errors } : {}),
  };
}
