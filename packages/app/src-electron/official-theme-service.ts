import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join, normalize, relative, resolve } from 'node:path';
import { app } from 'electron';
import type {
  InstalledOfficialThemeSummary,
  OfficialThemeCatalogResult,
  OfficialThemeDownloadResult,
  OfficialThemeRegistryEntry,
  OfficialThemeRemoteView,
} from '../src/theme-platform/types';

const DEFAULT_OFFICIAL_THEME_REGISTRY_URL = 'https://plotflow.app/data/official-themes.json';
const MAX_OFFICIAL_THEME_BUNDLE_BYTES = 12 * 1024 * 1024;
const THEME_API_VERSION = 1;

export interface OfficialThemeServiceDeps {
  readonly fetchBytes?: (url: string) => Promise<Uint8Array>;
  readonly fetchJson?: (url: string) => Promise<unknown>;
  readonly registryUrl?: string;
  readonly now?: () => number;
}

function getOfficialThemeRootPath(): string {
  return join(app.getPath('userData'), 'official-themes');
}

function getRegistryUrl(deps?: OfficialThemeServiceDeps): string {
  return deps?.registryUrl ?? process.env['PLOTFLOW_OFFICIAL_THEME_REGISTRY_URL'] ?? DEFAULT_OFFICIAL_THEME_REGISTRY_URL;
}

function assertPathInside(root: string, target: string): void {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  const rel = relative(resolvedRoot, resolvedTarget);
  if (rel.startsWith('..') || rel === '..' || rel.includes(`..\\`) || rel.includes('../')) {
    throw new Error('官方主题安装路径越界');
  }
}

function assertOfficialThemeId(id: string): void {
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(id)) {
    throw new Error(`非法官方主题 ID: ${id}`);
  }
}

function assertOfficialUrl(url: string): void {
  const parsed = new URL(url);
  const isOfficial = parsed.protocol === 'https:' && parsed.hostname === 'plotflow.app';
  const isLocalTest = (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
    (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
  if (!isOfficial && !isLocalTest) {
    throw new Error(`官方主题 URL 不在允许来源内: ${url}`);
  }
}

function normalizeLocaleName(value: unknown): { 'zh-CN': string; 'en-US': string } | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const zh = record['zh-CN'];
  const en = record['en-US'];
  if (typeof zh !== 'string' || typeof en !== 'string' || zh.length === 0 || en.length === 0) return null;
  return { 'zh-CN': zh, 'en-US': en };
}

export function validateOfficialThemeRegistry(input: unknown): readonly OfficialThemeRegistryEntry[] {
  const rawEntries = Array.isArray(input)
    ? input
    : (input && typeof input === 'object' ? (input as Record<string, unknown>)['themes'] : undefined);
  if (!Array.isArray(rawEntries)) {
    throw new Error('官方主题目录必须包含 themes 数组');
  }

  return rawEntries.map((raw) => {
    if (!raw || typeof raw !== 'object') {
      throw new Error('官方主题条目必须是对象');
    }
    const item = raw as Record<string, unknown>;
    const id = item['id'];
    const version = item['version'];
    const channel = item['channel'];
    const priceLabel = item['priceLabel'];
    const manifestUrl = item['manifestUrl'];
    const bundleUrl = item['bundleUrl'];
    const sha256 = item['sha256'];
    const minAppVersion = item['minAppVersion'];
    const themeApiVersion = item['themeApiVersion'];
    const previewUrl = item['previewUrl'];
    const changelog = item['changelog'];
    const name = normalizeLocaleName(item['name']);

    if (typeof id !== 'string') throw new Error('官方主题缺少 id');
    assertOfficialThemeId(id);
    if (!name) throw new Error(`官方主题 ${id} 缺少本地化名称`);
    if (typeof version !== 'string' || version.length === 0) throw new Error(`官方主题 ${id} 缺少 version`);
    if (channel !== 'stable' && channel !== 'preview') throw new Error(`官方主题 ${id} channel 非法`);
    if (priceLabel !== '免费主题') throw new Error(`官方主题 ${id} 必须标注为免费主题`);
    if (typeof manifestUrl !== 'string' || typeof bundleUrl !== 'string' || typeof previewUrl !== 'string') {
      throw new Error(`官方主题 ${id} 缺少远程 URL`);
    }
    assertOfficialUrl(manifestUrl);
    assertOfficialUrl(bundleUrl);
    assertOfficialUrl(previewUrl);
    if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256)) {
      throw new Error(`官方主题 ${id} sha256 非法`);
    }
    if (typeof minAppVersion !== 'string' || minAppVersion.length === 0) throw new Error(`官方主题 ${id} 缺少 minAppVersion`);
    if (themeApiVersion !== THEME_API_VERSION) throw new Error(`官方主题 ${id} themeApiVersion 不兼容`);
    if (typeof changelog !== 'string') throw new Error(`官方主题 ${id} 缺少 changelog`);

    return {
      id,
      name,
      version,
      channel,
      priceLabel,
      manifestUrl,
      bundleUrl,
      sha256: sha256.toLowerCase(),
      minAppVersion,
      themeApiVersion,
      previewUrl,
      changelog,
    };
  });
}

async function defaultFetchJson(url: string): Promise<unknown> {
  assertOfficialUrl(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`官方主题目录请求失败: ${response.status}`);
  return response.json() as Promise<unknown>;
}

async function defaultFetchBytes(url: string): Promise<Uint8Array> {
  assertOfficialUrl(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`官方主题下载失败: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_OFFICIAL_THEME_BUNDLE_BYTES) {
    throw new Error('官方主题 bundle 过大');
  }
  return bytes;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readInstalledManifest(themeDir: string): Promise<InstalledOfficialThemeSummary | null> {
  try {
    const raw = await readFile(join(themeDir, 'install.json'), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<InstalledOfficialThemeSummary>;
    if (!parsed.id || !parsed.version || !parsed.name || !parsed.priceLabel || !parsed.installedAt) return null;
    return parsed as InstalledOfficialThemeSummary;
  } catch {
    return null;
  }
}

export async function listInstalledOfficialThemes(): Promise<InstalledOfficialThemeSummary[]> {
  const root = getOfficialThemeRootPath();
  if (!existsSync(root)) return [];

  const entries = await readdir(root, { withFileTypes: true });
  const installed: InstalledOfficialThemeSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifest = await readInstalledManifest(join(root, entry.name));
    if (manifest) installed.push(manifest);
  }
  return installed.sort((a, b) => a.id.localeCompare(b.id));
}

export async function listOfficialRemoteThemes(deps?: OfficialThemeServiceDeps): Promise<OfficialThemeCatalogResult> {
  try {
    const raw = await (deps?.fetchJson ?? defaultFetchJson)(getRegistryUrl(deps));
    const entries = validateOfficialThemeRegistry(raw);
    return { ok: true, entries };
  } catch (error) {
    return {
      ok: false,
      entries: [],
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listOfficialRemoteThemeViews(deps?: OfficialThemeServiceDeps): Promise<OfficialThemeRemoteView[]> {
  const catalog = await listOfficialRemoteThemes(deps);
  if (!catalog.ok) return [];

  const installed = await listInstalledOfficialThemes();
  const installedById = new Map(installed.map((item) => [item.id, item]));
  return catalog.entries.map((entry) => {
    const local = installedById.get(entry.id);
    const status = !local
      ? 'notInstalled'
      : (local.version === entry.version ? 'installed' : 'updateAvailable');
    return {
      ...entry,
      status,
      ...(local ? { installedVersion: local.version } : {}),
    };
  });
}

export async function downloadOfficialTheme(themeId: string, deps?: OfficialThemeServiceDeps): Promise<OfficialThemeDownloadResult> {
  try {
    assertOfficialThemeId(themeId);
    const catalog = await listOfficialRemoteThemes(deps);
    if (!catalog.ok) {
      return { ok: false, message: catalog.message ?? '官方主题目录不可用' };
    }

    const entry = catalog.entries.find((item) => item.id === themeId);
    if (!entry) {
      return { ok: false, message: `官方主题不存在: ${themeId}` };
    }

    const bytes = await (deps?.fetchBytes ?? defaultFetchBytes)(entry.bundleUrl);
    const actualHash = sha256(bytes);
    if (actualHash !== entry.sha256) {
      return {
        ok: false,
        id: entry.id,
        version: entry.version,
        message: '官方主题完整性校验失败',
        errors: [`expected ${entry.sha256}`, `actual ${actualHash}`],
      };
    }

    const root = getOfficialThemeRootPath();
    const targetDir = normalize(join(root, entry.id));
    assertPathInside(root, targetDir);
    await mkdir(targetDir, { recursive: true });

    const versionDir = normalize(join(targetDir, entry.version));
    assertPathInside(root, versionDir);
    await mkdir(versionDir, { recursive: true });
    await writeFile(join(versionDir, 'theme.bundle.json'), bytes);

    const installManifest: InstalledOfficialThemeSummary = {
      id: entry.id,
      version: entry.version,
      name: entry.name,
      priceLabel: entry.priceLabel,
      installedAt: deps?.now?.() ?? Date.now(),
    };
    await writeFile(join(targetDir, 'install.json'), `${JSON.stringify(installManifest, null, 2)}\n`, 'utf-8');

    return {
      ok: true,
      id: entry.id,
      version: entry.version,
      message: `已下载官方免费主题: ${entry.name['zh-CN']}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, id: themeId, message, errors: [message] };
  }
}

export async function readOfficialThemeBundleSize(themeId: string, version: string): Promise<number | null> {
  const root = getOfficialThemeRootPath();
  const bundlePath = normalize(join(root, themeId, version, 'theme.bundle.json'));
  assertPathInside(root, bundlePath);
  if (!existsSync(bundlePath)) return null;
  return (await stat(bundlePath)).size;
}
