import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import AdmZip from 'adm-zip';
import { app, protocol } from 'electron';
import type {
  InstalledOfficialThemeRuntime,
  InstalledOfficialThemeSummary,
  OfficialThemeCatalogResult,
  OfficialThemeDownloadResult,
  OfficialThemeRegistryEntry,
  OfficialThemeRemoteView,
  OfficialThemeRuntimeManifest,
} from '../src/theme-platform/types';

const DEFAULT_OFFICIAL_THEME_REGISTRY_URL = 'https://plotflow.app/data/official-themes.json';
const MAX_OFFICIAL_THEME_BUNDLE_BYTES = 12 * 1024 * 1024;
const MAX_OFFICIAL_THEME_EXTRACTED_BYTES = 18 * 1024 * 1024;
const OFFICIAL_THEME_PROTOCOL = 'plotflow-theme';
export const OFFICIAL_THEME_API_VERSION = 1;

let protocolHandlerRegistered = false;
let protocolSchemeRegistered = false;

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
  if (rel.startsWith('..') || rel === '..' || isAbsolute(rel)) {
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

export function normalizeOfficialThemePackagePath(input: string): string {
  const raw = input.trim();
  if (raw.length === 0 || raw.includes('\0')) {
    throw new Error('官方主题包路径为空或非法');
  }
  if (
    raw.startsWith('/') ||
    raw.startsWith('\\') ||
    /^[a-zA-Z]:/.test(raw) ||
    raw.includes('://')
  ) {
    throw new Error(`官方主题包路径不能是绝对路径: ${input}`);
  }

  const parts = raw.replace(/\\/g, '/').split('/').filter((part) => part.length > 0);
  if (parts.length === 0) {
    throw new Error('官方主题包路径为空');
  }
  for (const part of parts) {
    if (part === '.' || part === '..') {
      throw new Error(`官方主题包路径越界: ${input}`);
    }
  }
  return parts.join('/');
}

function createOfficialThemeProtocolUrl(themeId: string, version: string, packagePath: string): string {
  const normalizedPath = normalizeOfficialThemePackagePath(packagePath);
  const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
  return `${OFFICIAL_THEME_PROTOCOL}://official/${encodeURIComponent(themeId)}/${encodeURIComponent(version)}/${encodedPath}`;
}

function createOfficialThemeAssetBaseUrl(themeId: string, version: string, assetsBase: string | undefined): string {
  const basePath = normalizeOfficialThemePackagePath(assetsBase ?? 'assets');
  return `${createOfficialThemeProtocolUrl(themeId, version, basePath)}/`;
}

function createRuntime(entry: OfficialThemeRegistryEntry, manifest: OfficialThemeRuntimeManifest): InstalledOfficialThemeRuntime {
  return {
    moduleUrl: createOfficialThemeProtocolUrl(entry.id, entry.version, manifest.entry),
    styleUrls: (manifest.styles ?? []).map((style) => createOfficialThemeProtocolUrl(entry.id, entry.version, style)),
    assetBaseUrl: createOfficialThemeAssetBaseUrl(entry.id, entry.version, manifest.assetsBase),
  };
}

function parseOfficialThemeProtocolUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== `${OFFICIAL_THEME_PROTOCOL}:` || parsed.hostname !== 'official') {
    throw new Error('非法官方主题协议 URL');
  }
  const parts = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const themeId = parts[0];
  const version = parts[1];
  const rest = parts.slice(2);
  if (!themeId || !version || rest.length === 0) {
    throw new Error('官方主题协议 URL 缺少路径');
  }
  assertOfficialThemeId(themeId);
  const packagePath = normalizeOfficialThemePackagePath(rest.join('/'));
  const root = getOfficialThemeRootPath();
  const filePath = normalize(join(root, themeId, version, packagePath));
  assertPathInside(root, filePath);
  return filePath;
}

function contentTypeForPath(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case '.mjs':
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

export function registerOfficialThemeProtocolScheme(): void {
  if (protocolSchemeRegistered) return;
  protocol.registerSchemesAsPrivileged([
    {
      scheme: OFFICIAL_THEME_PROTOCOL,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
  protocolSchemeRegistered = true;
}

export function registerOfficialThemeProtocolHandler(): void {
  if (protocolHandlerRegistered) return;
  protocol.handle(OFFICIAL_THEME_PROTOCOL, async (request) => {
    try {
      const filePath = parseOfficialThemeProtocolUrl(request.url);
      const body = await readFile(filePath);
      return new Response(body, {
        headers: {
          'content-type': contentTypeForPath(filePath),
          'cache-control': 'no-store',
        },
      });
    } catch {
      return new Response('Official theme asset not found', { status: 404 });
    }
  });
  protocolHandlerRegistered = true;
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
    if (!bundleUrl.endsWith('.pf-official-theme.zip')) {
      throw new Error(`官方主题 ${id} bundleUrl 必须指向 .pf-official-theme.zip`);
    }
    if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(sha256)) {
      throw new Error(`官方主题 ${id} sha256 非法`);
    }
    if (typeof minAppVersion !== 'string' || minAppVersion.length === 0) throw new Error(`官方主题 ${id} 缺少 minAppVersion`);
    if (themeApiVersion !== OFFICIAL_THEME_API_VERSION) throw new Error(`官方主题 ${id} themeApiVersion 不兼容`);
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

function validateOfficialThemeRuntimeManifest(raw: unknown, entry: OfficialThemeRegistryEntry): OfficialThemeRuntimeManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('官方主题 manifest 必须是对象');
  }
  const data = raw as Record<string, unknown>;
  const id = data['id'];
  const version = data['version'];
  const themeApiVersion = data['themeApiVersion'];
  const rawEntry = data['entry'];
  const rawStyles = data['styles'];
  const rawAssetsBase = data['assetsBase'];

  if (id !== entry.id) throw new Error('官方主题 manifest id 与 registry 不一致');
  if (version !== entry.version) throw new Error('官方主题 manifest version 与 registry 不一致');
  if (themeApiVersion !== OFFICIAL_THEME_API_VERSION) throw new Error('官方主题 manifest themeApiVersion 不兼容');
  if (typeof rawEntry !== 'string') throw new Error('官方主题 manifest 缺少 entry');

  const moduleEntry = normalizeOfficialThemePackagePath(rawEntry);
  if (!moduleEntry.endsWith('.mjs')) {
    throw new Error('官方主题 entry 必须是 .mjs 模块');
  }

  const styles = Array.isArray(rawStyles)
    ? rawStyles.map((style) => {
      if (typeof style !== 'string') throw new Error('官方主题 styles 必须是字符串数组');
      const normalized = normalizeOfficialThemePackagePath(style);
      if (!normalized.endsWith('.css')) throw new Error('官方主题 style 必须是 .css 文件');
      return normalized;
    })
    : undefined;

  const assetsBase = typeof rawAssetsBase === 'string'
    ? normalizeOfficialThemePackagePath(rawAssetsBase)
    : undefined;

  return {
    id: entry.id,
    version: entry.version,
    themeApiVersion: OFFICIAL_THEME_API_VERSION,
    entry: moduleEntry,
    ...(styles ? { styles } : {}),
    ...(assetsBase ? { assetsBase } : {}),
  };
}

function readZipText(entry: AdmZip.IZipEntry): string {
  return entry.getData().toString('utf-8');
}

function readRuntimeManifestFromZip(zip: AdmZip, registryEntry: OfficialThemeRegistryEntry): {
  readonly manifest: OfficialThemeRuntimeManifest;
  readonly files: ReadonlyMap<string, AdmZip.IZipEntry>;
} {
  const files = new Map<string, AdmZip.IZipEntry>();
  let extractedBytes = 0;

  for (const zipEntry of zip.getEntries()) {
    if (zipEntry.isDirectory) continue;
    const normalized = normalizeOfficialThemePackagePath(zipEntry.entryName);
    if (files.has(normalized)) {
      throw new Error(`官方主题包存在重复文件: ${normalized}`);
    }
    extractedBytes += zipEntry.header.size;
    if (extractedBytes > MAX_OFFICIAL_THEME_EXTRACTED_BYTES) {
      throw new Error('官方主题包解压后体积过大');
    }
    files.set(normalized, zipEntry);
  }

  const manifestEntry = files.get('manifest.json');
  if (!manifestEntry) {
    throw new Error('官方主题包缺少 manifest.json');
  }

  const manifest = validateOfficialThemeRuntimeManifest(JSON.parse(readZipText(manifestEntry)) as unknown, registryEntry);
  if (!files.has(manifest.entry)) {
    throw new Error(`官方主题包缺少 entry: ${manifest.entry}`);
  }
  for (const style of manifest.styles ?? []) {
    if (!files.has(style)) {
      throw new Error(`官方主题包缺少 style: ${style}`);
    }
  }

  return { manifest, files };
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
    if (
      !parsed.id ||
      !parsed.version ||
      !parsed.name ||
      !parsed.priceLabel ||
      !parsed.installedAt ||
      !parsed.runtime?.moduleUrl ||
      !parsed.runtime.assetBaseUrl
    ) {
      return null;
    }
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

    const zip = new AdmZip(Buffer.from(bytes));
    const { manifest, files } = readRuntimeManifestFromZip(zip, entry);
    const root = getOfficialThemeRootPath();
    const targetDir = normalize(join(root, entry.id));
    assertPathInside(root, targetDir);
    await mkdir(targetDir, { recursive: true });

    const versionDir = normalize(join(targetDir, entry.version));
    assertPathInside(root, versionDir);
    await rm(versionDir, { recursive: true, force: true });
    await mkdir(versionDir, { recursive: true });

    for (const [packagePath, zipEntry] of files) {
      const targetPath = normalize(join(versionDir, packagePath));
      assertPathInside(versionDir, targetPath);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, zipEntry.getData());
    }

    const installManifest: InstalledOfficialThemeSummary = {
      id: entry.id,
      version: entry.version,
      name: entry.name,
      priceLabel: entry.priceLabel,
      installedAt: deps?.now?.() ?? Date.now(),
      runtime: createRuntime(entry, manifest),
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
  const modulePath = normalize(join(root, themeId, version, 'index.mjs'));
  assertPathInside(root, modulePath);
  if (!existsSync(modulePath)) return null;
  return (await stat(modulePath)).size;
}
