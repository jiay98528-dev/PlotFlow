import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import type { Event as ElectronEvent, MessageBoxOptions, OpenDialogOptions, SaveDialogOptions } from 'electron';
import { basename, isAbsolute, join, normalize, relative, resolve } from 'node:path';
import { readFile, stat, readdir } from 'node:fs/promises';
import { existsSync, watch, type FSWatcher } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildMenu, type AppMenuLanguage } from './menu';
import { IPC_CHANNELS } from '../src/shared/ipcChannels';
import { createOrderedAsyncDispatcher } from '../src/shared/orderedAsyncDispatcher';
import { getMainProcessMessages } from './mainProcessI18n';
import { resolvePendingOpenFile } from './pendingOpenFile';
import { arbitrateClose } from './closeGuard';
import { assertTrustedIpcSender, developmentRendererUrl, isAllowedExternalUrl, isTrustedRendererUrl, trustedRendererUrls } from './ipcSecurity';
import {
  assertWritableContent,
  findStoryFileArgument,
  preflightFileSaveHash,
  sanitizeExportDefaultPath,
  withTimeout,
  writeTextFileAndVerify,
} from './mainProcessUtils';
import {
  downloadOfficialTheme,
  listInstalledOfficialThemes,
  listOfficialRemoteThemeViews,
  registerOfficialThemeProtocolHandler,
  registerOfficialThemeProtocolScheme,
} from './official-theme-service';

// Note: electron-squirrel-startup check is skipped in M0 (dependency not installed).
// Will be enabled in M7 when electron-builder packaging is set up.
// See: https://github.com/mongodb-js/electron-squirrel-startup

let mainWindow: BrowserWindow | null = null;
let currentMenuLanguage: AppMenuLanguage = 'zh-CN';

registerOfficialThemeProtocolScheme();

/** 褰撶敤鎴峰湪鑴忔鏌ョ‘璁ゅ悗锛屽己鍒堕€€鍑烘祦绋嬩腑璺宠繃閲嶅纭鐨勬爣璁?*/
let forceQuitting = false;

interface WatchedStoryFile {
  readonly path: string;
  watcher: FSWatcher | null;
  pollingTimer: ReturnType<typeof setInterval> | null;
  lastHash: string;
  lastNotifiedHash: string | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

let watchedStoryFile: WatchedStoryFile | null = null;

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function stopWatchingStoryFile(): void {
  if (watchedStoryFile?.watcher) {
    watchedStoryFile.watcher.close();
  }
  if (watchedStoryFile?.pollingTimer) {
    clearInterval(watchedStoryFile.pollingTimer);
  }
  if (watchedStoryFile?.debounceTimer) {
    clearTimeout(watchedStoryFile.debounceTimer);
  }
  watchedStoryFile = null;
}

async function notifyExternalStoryChange(filePath: string): Promise<void> {
  if (!watchedStoryFile || watchedStoryFile.path !== filePath) return;
  try {
    const content = await readFile(filePath, 'utf-8');
    const fileStat = await stat(filePath);
    const hash = hashContent(content);
    if (!watchedStoryFile || watchedStoryFile.path !== filePath || watchedStoryFile.lastHash === hash) return;
    if (watchedStoryFile.lastNotifiedHash === hash) return;
    watchedStoryFile.lastNotifiedHash = hash;
    mainWindow?.webContents.send(IPC_CHANNELS.file.externalChange, {
      filePath,
      content,
      hash,
      modifiedAt: fileStat.mtimeMs,
    });
  } catch {
    stopWatchingStoryFile();
  }
}

function scheduleExternalStoryCheck(filePath: string): void {
  if (!watchedStoryFile || watchedStoryFile.path !== filePath) return;
  if (watchedStoryFile.debounceTimer) {
    clearTimeout(watchedStoryFile.debounceTimer);
  }
  watchedStoryFile.debounceTimer = setTimeout(() => {
    if (watchedStoryFile) watchedStoryFile.debounceTimer = null;
    void notifyExternalStoryChange(filePath);
  }, 150);
}

function startWatchingStoryFile(filePath: string, content: string): void {
  const normalizedPath = normalize(filePath);
  const hash = hashContent(content);
  if (watchedStoryFile?.path === normalizedPath) {
    watchedStoryFile.lastHash = hash;
    watchedStoryFile.lastNotifiedHash = null;
    return;
  }

  stopWatchingStoryFile();
  watchedStoryFile = {
    path: normalizedPath,
    watcher: null,
    pollingTimer: null,
    lastHash: hash,
    lastNotifiedHash: null,
    debounceTimer: null,
  };

  try {
    watchedStoryFile.watcher = watch(normalizedPath, { persistent: false }, () => {
      scheduleExternalStoryCheck(normalizedPath);
    });
  } catch {
    watchedStoryFile.pollingTimer = setInterval(() => {
      scheduleExternalStoryCheck(normalizedPath);
    }, 2000);
  }
}

/**
 * 绯荤粺锛堝弻鍑?鍛戒护琛岋級鎵撳紑鐨?.mdstory 鏂囦欢璺緞锛圡7-08锛夈€? *
 * 瀛樺偍鏉ヨ嚜浠ヤ笅涓ょ閫斿緞鐨勬枃浠惰矾寰?
 *   - macOS: app.on('open-file', ...) 浜嬩欢
 *   - Windows/Linux: process.argv[1] 鍛戒护琛屽弬鏁? *
 * 绐楀彛灏辩华鍚庯紝娓叉煋杩涚▼閫氳繃 file:getPendingOpenFile IPC 鑾峰彇姝よ矾寰勫苟鍔犺浇銆? */
let pendingFilePath: string | null = null;
let rendererReadyForSystemOpen = false;
const systemOpenDispatcher = createOrderedAsyncDispatcher<string>(async (filePath) => {
    const result = await resolvePendingOpenFile(filePath, readStoryFile);
    const target = mainWindow;
    if (!rendererReadyForSystemOpen || !target || target.isDestroyed()) {
      pendingFilePath = filePath;
      return;
    }
    target.webContents.send(IPC_CHANNELS.file.systemOpenNotify, result);
});

function dispatchSystemOpenFile(filePath: string): void {
  void systemOpenDispatcher.enqueue(filePath).catch((error: unknown) => {
    // eslint-disable-next-line no-console -- main-process system-open failures require durable diagnostics
    console.error('[Fablevia] 系统打开文件分发失败', error);
    pendingFilePath = filePath;
  });
}

const APP_ID = 'com.plotflow.app';
const PRODUCT_NAME = 'Fablevia';
const LEGACY_USER_DATA_DIRECTORY = 'PlotFlow'; // brand-compat: preserve the established user profile directory
const RENDERER_QUERY_TIMEOUT_MS = 5_000;
const RENDERER_SAVE_TIMEOUT_MS = 15_000;
const RENDERER_HTML_PATH = join(__dirname, '../renderer/index.html');
const DEVELOPMENT_RENDERER_URL = developmentRendererUrl(app.isPackaged, process.env['ELECTRON_RENDERER_URL']);
const TRUSTED_RENDERER_URLS = trustedRendererUrls({
  rendererHtmlPath: RENDERER_HTML_PATH,
  developmentUrl: DEVELOPMENT_RENDERER_URL,
});

function assertTrustedIpc(event: { senderFrame?: { url: string } | null }): void {
  assertTrustedIpcSender(event, TRUSTED_RENDERER_URLS);
}

async function openAllowedExternal(url: string): Promise<void> {
  if (!isAllowedExternalUrl(url)) throw new Error('External URL is not allowlisted.');
  await shell.openExternal(url);
}

if (
  process.env['PLOTFLOW_TEST_USER_DATA_DIR']
  && (process.env['NODE_ENV'] === 'test' || process.env['PLOTFLOW_BLACKBOX_E2E'] === '1')
) {
  app.setPath('userData', normalize(process.env['PLOTFLOW_TEST_USER_DATA_DIR']));
} else {
  // Product branding changed in 0.1 without changing the persisted application
  // identity. Keep the established directory so upgrades preserve preferences,
  // recent files, installed themes and the local completion corpus.
  app.setPath('userData', join(app.getPath('appData'), LEGACY_USER_DATA_DIRECTORY));
}
app.setName(PRODUCT_NAME);

function resolveWindowIconPath(): string | undefined {
  const packagedIconPath = join(process.resourcesPath, 'icon.png');
  if (app.isPackaged && existsSync(packagedIconPath)) {
    return packagedIconPath;
  }

  const devIconPath = join(__dirname, '../../build/icon.png');
  if (existsSync(devIconPath)) {
    return devIconPath;
  }

  return undefined;
}

function focusNativeDialogOwner(): BrowserWindow | undefined {
  const owner = mainWindow && !mainWindow.isDestroyed()
    ? mainWindow
    : (BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().find((win) => !win.isDestroyed()));

  if (!owner || owner.isDestroyed()) return undefined;
  if (owner.isMinimized()) owner.restore();
  owner.show();
  owner.focus();
  owner.moveTop();
  return owner;
}

// ============================================================================
// IPC 瀹夊叏鏍￠獙甯搁噺 (V0.3 涓昏繘绋嬪厹搴曟牎楠?
// ============================================================================

/** 鏂囦欢璇诲彇澶у皬涓婇檺锛?0MB锛堥槻姝㈡伓鎰忓ぇ鏂囦欢 OOM锛?*/
const MAX_READ_BYTES = 10 * 1024 * 1024;

/** 瀵煎嚭鏍煎紡鐧藉悕鍗?*/
const ALLOWED_EXPORT_FORMATS = ['json', 'html', 'txt'] as const;
const MAX_WORKSPACE_SCAN_DEPTH = 2;
const MAX_WORKSPACE_STORY_FILES = 300;
const WORKSPACE_IGNORED_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  '.pnpm',
  'release',
  'out',
  'dist',
  'coverage',
  'website',
  'dist-static',
]);
/** 绂佹璁块棶鐨勭郴缁熺洰褰曞墠缂€锛圲nix锛?*/
const FORBIDDEN_UNIX_PREFIXES = ['/etc', '/proc', '/sys', '/dev', '/boot', '/root'];

/**
 * 妫€娴嬭矾寰勬槸鍚︿綅浜庣郴缁熸晱鎰熺洰褰曞唴銆? * 涓嶆浛浠ｆ搷浣滅郴缁熸潈闄愭帶鍒讹紝浠呬綔涓轰富杩涚▼鍏滃簳鏍￠獙銆? */
function isBlockedSystemPath(filePath: string): boolean {
  const normalized = normalize(filePath);
  const lower = normalized.toLowerCase();

  // Unix 绯荤粺鐩綍
  for (const prefix of FORBIDDEN_UNIX_PREFIXES) {
    if (lower === prefix || lower.startsWith(prefix + '/') || lower.startsWith(prefix + '\\')) {
      return true;
    }
  }

  // Windows 绯荤粺鐩綍 (C:\Windows, /Windows/ 鍙婂叾瀛愮洰褰?
  if (lower.includes('\\windows\\') || lower.includes('/windows/')) {
    return true;
  }

  return false;
}


function assertWorkspacePathInside(root: string, target: string): void {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(target);
  const rel = relative(resolvedRoot, resolvedTarget);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('工作区文件路径越界');
  }
}

async function assertReadableStoryFile(filePath: string): Promise<string> {
  const normalizedPath = normalize(filePath);
  if (!normalizedPath.toLowerCase().endsWith('.mdstory')) {
    throw new Error('仅支持读取 .mdstory 文件');
  }
  if (isBlockedSystemPath(normalizedPath)) {
    throw new Error('不允许从系统目录读取文件');
  }

  const fileStat = await stat(normalizedPath);
  if (!fileStat.isFile()) {
    throw new Error('目标不是文件');
  }
  if (fileStat.size > MAX_READ_BYTES) {
    const sizeMB = (fileStat.size / 1024 / 1024).toFixed(1);
    throw new Error(`文件过大（${sizeMB}MB），上限为 10MB`);
  }

  return normalizedPath;
}

async function readStoryFile(filePath: string): Promise<{ filePath: string; content: string; hash: string; modifiedAt: number }> {
  const normalizedPath = await assertReadableStoryFile(filePath);
  const content = await readFile(normalizedPath, 'utf-8');
  const fileStat = await stat(normalizedPath);
  const hash = hashContent(content);
  startWatchingStoryFile(normalizedPath, content);
  return { filePath: normalizedPath, content, hash, modifiedAt: fileStat.mtimeMs };
}

interface WorkspaceStoryFile {
  readonly filePath: string;
  readonly relativePath: string;
  readonly name: string;
  readonly size: number;
  readonly modifiedAt: number;
}

interface WorkspaceStoriesResult {
  readonly rootPath: string;
  readonly files: WorkspaceStoryFile[];
  readonly truncated: boolean;
}

async function collectWorkspaceStories(
  rootPath: string,
  currentPath: string,
  depth: number,
  files: WorkspaceStoryFile[],
): Promise<boolean> {
  if (files.length >= MAX_WORKSPACE_STORY_FILES) return true;

  let truncated = false;
  const entries = await readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    if (files.length >= MAX_WORKSPACE_STORY_FILES) {
      truncated = true;
      break;
    }

    const entryPath = join(currentPath, entry.name);
    assertWorkspacePathInside(rootPath, entryPath);

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      if (depth >= MAX_WORKSPACE_SCAN_DEPTH) continue;
      if (WORKSPACE_IGNORED_DIRS.has(entry.name.toLowerCase())) continue;
      truncated = (await collectWorkspaceStories(rootPath, entryPath, depth + 1, files)) || truncated;
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.mdstory')) {
      continue;
    }

    const fileStat = await stat(entryPath);
    if (fileStat.size > MAX_READ_BYTES) {
      continue;
    }

    files.push({
      filePath: normalize(entryPath),
      relativePath: relative(rootPath, entryPath).replace(/\\/g, '/'),
      name: basename(entryPath),
      size: fileStat.size,
      modifiedAt: fileStat.mtimeMs,
    });
  }

  return truncated;
}

async function listWorkspaceStories(rootPath: string): Promise<WorkspaceStoriesResult> {
  const normalizedRoot = normalize(rootPath);
  if (isBlockedSystemPath(normalizedRoot)) {
    throw new Error('不允许把系统目录作为维叙（Fablevia）工作区');
  }

  const rootStat = await stat(normalizedRoot);
  if (!rootStat.isDirectory()) {
    throw new Error('请选择文件夹作为维叙（Fablevia）工作区');
  }

  const files: WorkspaceStoryFile[] = [];
  const truncated = await collectWorkspaceStories(normalizedRoot, normalizedRoot, 0, files);
  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-CN'));
  return { rootPath: normalizedRoot, files, truncated };
}

// ============================================================================

/**
 * file:save 鈥?灏嗗唴瀹瑰啓鍏ユ寚瀹氭枃浠? *
 * 由渲染进程通过 window.plotflow.file.save({ path, content, expectedHash }) 触发。
 * 对应 TAD.md §4.2 AutoSaveManager 的主进程写文件逻辑。
 */
ipcMain.handle(IPC_CHANNELS.file.save, async (event, payload: {
  path: string;
  content: string;
  expectedHash: string | null;
  overwriteConflict?: boolean;
}) => {
  assertTrustedIpc(event);
  try {
    const rawPath = payload?.path;
    const content = payload?.content;
    assertWritableContent(content);
    // 鈹€鈹€ 璺緞瀹夊叏楠岃瘉锛圥0-4: 涓夊眰闃叉姢锛夆攢鈹€

    if (!rawPath || typeof rawPath !== 'string') {
      throw new Error('无效的文件路径');
    }

    if (rawPath.includes('..')) {
      throw new Error('路径包含非法遍历组件');
    }

    const normalizedPath = normalize(rawPath);

    // 绗?灞傦細鎵╁睍鍚嶇櫧鍚嶅崟
    if (!normalizedPath.toLowerCase().endsWith('.mdstory')) {
      throw new Error('仅支持保存 .mdstory 文件');
    }

    if (typeof payload.expectedHash === 'string') {
      try {
        const preflight = await preflightFileSaveHash({
          filePath: normalizedPath,
          expectedHash: payload.expectedHash,
          overwriteConflict: payload.overwriteConflict,
          hashContent,
        });
        if (!preflight.canWrite) {
          return {
            success: false,
            conflict: true,
            filePath: normalizedPath,
            content: preflight.content,
            hash: preflight.hash,
            modifiedAt: preflight.modifiedAt,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          conflict: false,
          timestamp: Date.now(),
          message: `保存前无法校验磁盘文件: ${message}`,
        };
      }
    }

    await writeTextFileAndVerify(normalizedPath, content);
    const fileStat = await stat(normalizedPath);
    const hash = hashContent(content);
    startWatchingStoryFile(normalizedPath, content);
    return { success: true, timestamp: Date.now(), hash, modifiedAt: fileStat.mtimeMs };
  } catch (error) {
    throw new Error(`无法保存文件: ${(error as Error).message}`);
  }
});

/**
 * file:open 鈥?鎵撳紑鏂囦欢瀵硅瘽妗?+ 璇诲彇鍐呭
 *
 * 鐢辨覆鏌撹繘绋嬮€氳繃 window.plotflow.file.open() 瑙﹀彂銆? * 瀵瑰簲 TAD.md 搂4.1 File I/O 鏈嶅姟鐨?FILE_OPEN 閫氶亾銆? */
ipcMain.handle(IPC_CHANNELS.file.open, async (event) => {
  assertTrustedIpc(event);
  try {
    focusNativeDialogOwner();
    const openOptions: OpenDialogOptions = {
      title: getMainProcessMessages(currentMenuLanguage).openStoryTitle,
      filters: [
        { name: getMainProcessMessages(currentMenuLanguage).storyFileType, extensions: ['mdstory'] },
        { name: getMainProcessMessages(currentMenuLanguage).allFiles, extensions: ['*'] },
      ],
      properties: ['openFile'],
    };
    const result = await dialog.showOpenDialog(openOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0]!;

    return readStoryFile(filePath);
  } catch (error) {
    throw new Error(`文件打开失败: ${(error as Error).message}`);
  }
});

/**
 * file:saveAs 鈥?鍙﹀瓨涓哄璇濇 + 鍐欏叆鏂囦欢
 *
 * 鐢辨覆鏌撹繘绋嬮€氳繃 window.plotflow.file.saveAs(content) 瑙﹀彂銆? * 瀵瑰簲 TAD.md 搂4.1 File I/O 鏈嶅姟鐨?FILE_SAVE_AS 閫氶亾銆? */
ipcMain.handle(IPC_CHANNELS.file.saveAs, async (event, payload: { content: string }) => {
  assertTrustedIpc(event);
  try {
    assertWritableContent(payload?.content);
    focusNativeDialogOwner();
    const saveOptions: SaveDialogOptions = {
      title: getMainProcessMessages(currentMenuLanguage).saveStoryTitle,
      filters: [{ name: getMainProcessMessages(currentMenuLanguage).storyFileType, extensions: ['mdstory'] }],
      defaultPath: 'untitled.mdstory',
    };
    const result = await dialog.showSaveDialog(saveOptions);

    if (result.canceled || !result.filePath) {
      return null;
    }

    // 鈹€鈹€ 涓昏繘绋嬪厹搴曟牎楠岋細鑷姩杩藉姞 .mdstory 鎵╁睍鍚?鈹€鈹€
    let filePath = result.filePath;
    if (!filePath.toLowerCase().endsWith('.mdstory')) {
      filePath += '.mdstory';
    }

    await writeTextFileAndVerify(filePath, payload.content);
    const fileStat = await stat(filePath);
    const hash = hashContent(payload.content);
    startWatchingStoryFile(filePath, payload.content);
    return { filePath, content: payload.content, hash, modifiedAt: fileStat.mtimeMs };
  } catch (error) {
    throw new Error(`文件另存为失败: ${(error as Error).message}`);
  }
});

/**
 * file:export 鈥?瀵煎嚭鏂囦欢瀵硅瘽妗?+ 鍐欏叆鏂囦欢
 *
 * 鐢辨覆鏌撹繘绋嬮€氳繃 window.plotflow.file.saveExport(options) 瑙﹀彂銆? * 鏀寔鎸囧畾鏂囦欢绫诲瀷杩囨护鍣紙濡?.json / .html / .txt锛夊拰寤鸿鏂囦欢鍚嶃€? * 琚彇娑堟椂杩斿洖 null銆? */
ipcMain.handle(IPC_CHANNELS.file.export, async (event, payload: {
  content: string;
  defaultPath: string;
  filters: Array<{ name: string; extensions: string[] }>;
  format: string;
}) => {
  assertTrustedIpc(event);
  try {
    assertWritableContent(payload?.content);

    // 鈹€鈹€ 涓昏繘绋嬪厹搴曟牎楠?1锛歠ormat 鐧藉悕鍗?鈹€鈹€
    if (!payload.format || !(ALLOWED_EXPORT_FORMATS as readonly string[]).includes(payload.format)) {
      throw new Error(`不支持的导出格式: ${payload.format || '(未指定)'}`);
    }

    // 鈹€鈹€ 涓昏繘绋嬪厹搴曟牎楠?2锛歠ilters 鎵╁睍鍚嶇櫧鍚嶅崟 鈹€鈹€
    if (payload.filters && Array.isArray(payload.filters)) {
      for (const filter of payload.filters) {
        for (const ext of filter.extensions) {
          if (!(ALLOWED_EXPORT_FORMATS as readonly string[]).includes(ext)) {
            throw new Error(`不支持的导出扩展名: .${ext}`);
          }
        }
      }
    }

    focusNativeDialogOwner();
    const exportOptions: SaveDialogOptions = {
      title: getMainProcessMessages(currentMenuLanguage).exportTitle,
      filters: payload.filters,
      defaultPath: sanitizeExportDefaultPath(payload.defaultPath, payload.format),
    };
    const result = await dialog.showSaveDialog(exportOptions);

    if (result.canceled || !result.filePath) {
      return null;
    }

    await writeTextFileAndVerify(result.filePath, payload.content);
    return { filePath: result.filePath };
  } catch (error) {
    throw new Error(`导出失败: ${(error as Error).message}`);
  }
});

/**
 * file:getPendingOpenFile 鈥?鑾峰彇绯荤粺鎵撳紑鐨勬枃浠惰矾寰勪笌鍐呭锛圡7-08锛? *
 * 娓叉煋杩涚▼鍦ㄧ獥鍙ｆ寕杞藉悗璋冪敤姝?IPC锛? * 妫€鏌ユ槸鍚︽湁绯荤粺锛堝弻鍑?.mdstory / open-file 浜嬩欢锛変紶閫掔殑鏂囦欢寰呮墦寮€銆? *
 * 杩斿洖 { filePath, content } 鎴?null锛堟棤寰呮墦寮€鏂囦欢锛夈€? * 杩斿洖鍚庢竻闄?pending 鐘舵€侊紝閬垮厤閲嶅鎵撳紑銆? */
ipcMain.handle(IPC_CHANNELS.file.getPendingOpenFile, async (event) => {
  assertTrustedIpc(event);
  const path = pendingFilePath;
  pendingFilePath = null;
  const result = await resolvePendingOpenFile(path, readStoryFile);
  if (result.status === 'error') {
    console.error(`[Fablevia] 读取系统打开文件失败: ${result.path} (${result.code})`);
    const text = getMainProcessMessages(currentMenuLanguage);
    const options: MessageBoxOptions = {
      type: 'error',
      title: text.productName,
      message: text.systemOpenFailedMessage,
      detail: text.systemOpenFailedDetail(result.path, result.code),
      buttons: [text.okButton],
    };
    const owner = focusNativeDialogOwner();
    if (owner) await dialog.showMessageBox(owner, options);
    else await dialog.showMessageBox(options);
  }
  return result;
});

/**
 * file:readByPath 鈥?鎸夎矾寰勮鍙栨枃浠跺唴瀹?(M7-08)
 *
 * 娓叉煋杩涚▼鍦ㄦ敹鍒扮郴缁熸枃浠舵墦寮€閫氱煡鍚庤皟鐢ㄦ IPC锛? * 璇诲彇鎸囧畾璺緞鐨?.mdstory 鏂囦欢鍐呭銆? */
ipcMain.handle(IPC_CHANNELS.file.readByPath, async (event, payload: { path: string }) => {
  assertTrustedIpc(event);
  try {
    return await readStoryFile(payload.path);
  } catch (error) {
    console.error(`[Fablevia] 读取文件失败: ${payload.path}`, error);
    return null;
  }
});

ipcMain.handle(IPC_CHANNELS.file.chooseWorkspaceFolder, async (event) => {
  assertTrustedIpc(event);
  try {
    focusNativeDialogOwner();
    const workspaceOptions: OpenDialogOptions = {
      title: getMainProcessMessages(currentMenuLanguage).chooseWorkspaceTitle,
      properties: ['openDirectory'],
    };
    const result = await dialog.showOpenDialog(workspaceOptions);

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return listWorkspaceStories(result.filePaths[0]!);
  } catch (error) {
    throw new Error(`工作区扫描失败: ${(error as Error).message}`);
  }
});

ipcMain.handle(IPC_CHANNELS.file.listWorkspaceStories, async (event, payload: { rootPath: string }) => {
  assertTrustedIpc(event);
  try {
    return listWorkspaceStories(payload.rootPath);
  } catch (error) {
    throw new Error(`工作区刷新失败: ${(error as Error).message}`);
  }
});

ipcMain.handle(IPC_CHANNELS.file.readWorkspaceStory, async (event, payload: { rootPath: string; filePath: string }) => {
  assertTrustedIpc(event);
  try {
    const rootPath = normalize(payload.rootPath);
    const filePath = normalize(payload.filePath);
    assertWorkspacePathInside(rootPath, filePath);
    return readStoryFile(filePath);
  } catch (error) {
    console.error(`[Fablevia] 读取工作区文件失败: ${payload.filePath}`, error);
    return null;
  }
});

/**
 * dialog:confirm 鈥?浠庢覆鏌撹繘绋嬭皟鐢ㄥ師鐢熸秷鎭璇濇
 *
 * 渚涙覆鏌撹繘绋嬮€氳繃 window.plotflow.dialog.confirm(options) 瑙﹀彂銆? * 杩斿洖鐢ㄦ埛鐐瑰嚮鐨勬寜閽储寮曪紙0-based锛夛紝dialog 鍏抽棴鏃惰繑鍥?-1銆? */
ipcMain.handle(IPC_CHANNELS.dialog.confirm, async (event, options: {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  message: string;
  detail: string;
  buttons: string[];
}) => {
  assertTrustedIpc(event);
  const owner = focusNativeDialogOwner();
  const messageBoxOptions: MessageBoxOptions = {
    title: getMainProcessMessages(currentMenuLanguage).productName,
    type: options.type ?? 'warning',
    message: options.message,
    detail: options.detail,
    buttons: [...options.buttons],
    defaultId: 0,
    cancelId: options.buttons.length - 1,
  };
  const result = owner
    ? await dialog.showMessageBox(owner, messageBoxOptions)
    : await dialog.showMessageBox(messageBoxOptions);
  return result.response;
});

ipcMain.handle(IPC_CHANNELS.theme.listOfficialInstalled, async (event) => {
  assertTrustedIpc(event);
  return listInstalledOfficialThemes();
});

ipcMain.handle(IPC_CHANNELS.theme.listOfficialRemote, async (event) => {
  assertTrustedIpc(event);
  return listOfficialRemoteThemeViews();
});

ipcMain.handle(IPC_CHANNELS.theme.downloadOfficialTheme, async (event, themeId: string) => {
  assertTrustedIpc(event);
  return downloadOfficialTheme(themeId);
});

ipcMain.handle(IPC_CHANNELS.theme.openThemeMarket, async (event) => {
  assertTrustedIpc(event);
  await openAllowedExternal('https://plotflow.app/themes');
});

ipcMain.handle(IPC_CHANNELS.theme.openOfficialThemeStore, async (event) => {
  assertTrustedIpc(event);
  await openAllowedExternal('https://plotflow.app/themes');
});

ipcMain.on(IPC_CHANNELS.menu.setLanguage, (event, language: AppMenuLanguage) => {
  assertTrustedIpc(event);
  const nextLanguage = language === 'en-US' ? 'en-US' : 'zh-CN';
  currentMenuLanguage = nextLanguage;
  Menu.setApplicationMenu(buildMenu(nextLanguage));
});

// ============================================================================
// Window Management
// ============================================================================

function createWindow(): void {
  forceQuitting = false;
  let closeArbitrationPending = false;
  const windowIcon = resolveWindowIconPath();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: PRODUCT_NAME,
    ...(windowIcon ? { icon: windowIcon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  rendererReadyForSystemOpen = false;
  mainWindow.webContents.on('did-start-loading', () => {
    rendererReadyForSystemOpen = false;
  });
  mainWindow.webContents.on('did-finish-load', () => {
    rendererReadyForSystemOpen = true;
    const pending = pendingFilePath;
    pendingFilePath = null;
    if (pending) dispatchSystemOpenFile(pending);
  });
  const blockUntrustedNavigation = (event: ElectronEvent, url: string): void => {
    if (!isTrustedRendererUrl(url, TRUSTED_RENDERER_URLS)) event.preventDefault();
  };
  mainWindow.webContents.on('will-navigate', blockUntrustedNavigation);
  mainWindow.webContents.on('will-redirect', blockUntrustedNavigation);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // In development, load from Vite dev server
  // eslint-disable-next-line dot-notation
  if (DEVELOPMENT_RENDERER_URL) {
    mainWindow.loadURL(DEVELOPMENT_RENDERER_URL);
  } else {
    mainWindow.loadFile(RENDERER_HTML_PATH);
  }

  mainWindow.on('closed', () => {
    rendererReadyForSystemOpen = false;
    stopWatchingStoryFile();
    mainWindow = null;
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    rendererReadyForSystemOpen = false;
    console.error('[Fablevia] 渲染进程退出', details.reason, details.exitCode);
    if (details.reason === 'clean-exit' || mainWindow === null) return;

    const affectedWindow = mainWindow;
    const text = getMainProcessMessages(currentMenuLanguage);
    void dialog.showMessageBox(affectedWindow, {
      type: 'error',
      title: text.productName,
      message: text.rendererCrashMessage,
      detail: text.rendererCrashDetail,
      buttons: [...text.rendererCrashButtons],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (affectedWindow.isDestroyed()) return;
      if (response === 0) affectedWindow.reload();
      else affectedWindow.close();
    });
  });

  /**
   * 绐楀彛鍏抽棴鎷︽埅 鈥?P0-5 鑴忕姸鎬佹鏌?   *
   * 褰撶敤鎴风偣鍑诲叧闂寜閽垨鎸?Alt+F4 鏃讹紝鍏堟鏌ユ覆鏌撹繘绋嬬殑缂栬緫鍣?   * 鏄惁鏈夋湭淇濆瓨鐨勬洿鏀广€傚鏋滄湁锛屾樉绀轰繚瀛?涓嶄繚瀛?鍙栨秷瀵硅瘽妗嗐€?   * forceQuitting 鏍囧織闃叉瀵硅瘽妗嗚嚜韬殑鍏抽棴鎿嶄綔琚噸澶嶆嫤鎴€?   */
  mainWindow.on('close', async (event) => {
    if (forceQuitting || mainWindow === null) return;
    event.preventDefault();
    if (closeArbitrationPending) return;
    closeArbitrationPending = true;

    const target = mainWindow;
    let authorised = false;
    try {
      authorised = await arbitrateClose({
        queryState: async () => withTimeout(
          target.webContents.executeJavaScript('window.__getEditorDirtyState__()'),
          RENDERER_QUERY_TIMEOUT_MS,
          '读取编辑器状态超时',
        ),
        save: async () => withTimeout(
          target.webContents.executeJavaScript('window.__forceSave__ && window.__forceSave__()'),
          RENDERER_SAVE_TIMEOUT_MS,
          '保存操作超时',
        ),
        discard: async () => withTimeout(
          target.webContents.executeJavaScript('window.__prepareDiscard__ && window.__prepareDiscard__()'),
          RENDERER_SAVE_TIMEOUT_MS,
          '放弃更改前的磁盘恢复超时',
        ),
        chooseUnsaved: async (state) => {
          const text = getMainProcessMessages(currentMenuLanguage);
          const result = await dialog.showMessageBox(target, {
            type: 'warning',
            buttons: [...text.unsavedButtons],
            defaultId: 0,
            cancelId: 2,
            title: text.productName,
            message: text.unsavedMessage,
            detail: text.unsavedDetail(state.filePath),
          });
          return result.response === 0 ? 'save' : result.response === 1 ? 'discard' : 'cancel';
        },
        chooseFailure: async (stage, error) => {
          const text = getMainProcessMessages(currentMenuLanguage);
          const reason = error instanceof Error ? error.message : String(error);
          // eslint-disable-next-line no-console -- close failures need durable main-process diagnostics
          console.error(`[Fablevia] ${stage === 'query' ? '读取关闭状态' : '关闭前保存'}失败`, error);
          if (target.isDestroyed()) return 'cancel';
          const result = await dialog.showMessageBox(target, {
            type: 'error',
            buttons: [...text.closeFailureButtons],
            defaultId: 0,
            cancelId: 2,
            title: text.productName,
            message: text.closeFailureMessage,
            detail: text.closeFailureDetail(stage, reason),
          });
          return result.response === 0 ? 'retry' : result.response === 1 ? 'force-quit' : 'cancel';
        },
      });
    } catch (error) {
      // Dialog infrastructure itself failed. Keep the window alive; a later
      // close attempt can retry arbitration.
      // eslint-disable-next-line no-console -- main-process close failures require durable diagnostics
      console.error('[Fablevia] 关闭保护流程失败，窗口保持打开', error);
      closeArbitrationPending = false;
      return;
    }

    if (!authorised || target.isDestroyed()) {
      closeArbitrationPending = false;
      return;
    }
    forceQuitting = true;
    target.destroy();
  });
}

// ============================================================================
// 绯荤粺鏂囦欢鎵撳紑浜嬩欢澶勭悊 (M7-08)
// ============================================================================

/**
 * macOS: 閫氳繃绯荤粺 open-file 浜嬩欢鎹曡幏鍙屽嚮鐨?.mdstory 鏂囦欢璺緞銆? *
 * 褰撶敤鎴峰湪 Finder 涓弻鍑?.mdstory 鏂囦欢锛堜笖 PlotFlow 宸叉敞鍐屼负璇ユ墿灞曠殑榛樿搴旂敤锛夋椂锛? * macOS 鍚戝凡杩愯鐨勫疄渚嬪彂閫?open-file 浜嬩欢锛屾垨鍦ㄦ柊鍚姩鏃堕€氳繃姝や簨浠朵紶閫掕矾寰勩€? */
app.on('open-file', (event, path) => {
  event.preventDefault();

  // 浠呭鐞?.mdstory 鏂囦欢
  if (!path.endsWith('.mdstory')) {
    return;
  }

  console.log(`[Fablevia] macOS open-file: ${path}`);

  if (rendererReadyForSystemOpen && mainWindow && !mainWindow.isDestroyed()) dispatchSystemOpenFile(path);
  else pendingFilePath = path;
});

/**
 * Windows / Linux: 閫氳繃鍛戒护琛屽弬鏁版崟鑾峰弻鍑荤殑 .mdstory 鏂囦欢璺緞銆? *
 * 褰撶敤鎴峰弻鍑?.mdstory 鏂囦欢鏃讹紙electron-builder 娉ㄥ唽浜嗘枃浠跺叧鑱斿悗锛夛紝
 * Windows 灏嗘枃浠惰矾寰勪綔涓虹涓€涓懡浠よ鍙傛暟浼犻€掔粰搴旂敤銆? *
 * 娉ㄦ剰: process.argv[0] 鏄彲鎵ц鏂囦欢鑷韩璺緞銆? * 鐢熶骇鐜锛堟墦鍖呭悗锛塧rgv[1] 涓烘枃浠惰矾寰勶紱寮€鍙戠幆澧冿紙electron-vite dev锛塧rgv[1] 鍙兘涓哄叾浠栥€? */
function checkCommandLineArgs(args: readonly string[] = process.argv): boolean {
  const storyPath = findStoryFileArgument(args);
  if (storyPath && existsSync(storyPath)) {
    pendingFilePath = storyPath;
    console.log(`[Fablevia] 命令行参数文件: ${storyPath}`);
    return true;
  }
  return false;
}

// ============================================================================
// App Lifecycle
// ============================================================================

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    const hasStoryFile = checkCommandLineArgs(commandLine);
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (hasStoryFile && pendingFilePath) {
      const path = pendingFilePath;
      pendingFilePath = null;
      if (rendererReadyForSystemOpen) dispatchSystemOpenFile(path);
      else pendingFilePath = path;
    }
  });

  app.whenReady().then(() => {
    checkCommandLineArgs();
    registerOfficialThemeProtocolHandler();
    Menu.setApplicationMenu(buildMenu(currentMenuLanguage));
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

process.on('uncaughtException', (error) => {
  console.error('[Fablevia] 主进程未捕获异常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Fablevia] 主进程未处理 Promise 拒绝:', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopWatchingStoryFile();
  // Keep dirty-state arbitration in BrowserWindow 'close'.
});



