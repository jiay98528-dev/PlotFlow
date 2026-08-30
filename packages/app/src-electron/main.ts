import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import type {
  Event as ElectronEvent,
  MessageBoxOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from 'electron';
import { join, normalize } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, type FSWatcher } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildMenu, type AppMenuLanguage } from './menu';
import { IPC_CHANNELS } from '../src/shared/ipcChannels';
import { createOrderedAsyncDispatcher } from '../src/shared/orderedAsyncDispatcher';
import type { FeedbackSubmitRequest } from '../src/shared/feedback';
import type { FileExportRequest } from '../src/types/electron';
import { submitFeedbackOverHttps } from './feedbackHttpService';
import { getMainProcessMessages } from './mainProcessI18n';
import { resolvePendingOpenFile } from './pendingOpenFile';
import { arbitrateClose } from './closeGuard';
import {
  MAX_READ_BYTES,
  isBlockedSystemPath,
  listWorkspaceStories,
  resolveWorkspaceStoryPath,
} from './workspaceFiles';
import {
  StoryFileObservationTracker,
  type InternalStoryWriteToken,
} from './storyFileObservation';
import {
  assertTrustedIpcSender,
  developmentRendererUrl,
  isTrustedRendererUrl,
  trustedRendererUrls,
} from './ipcSecurity';
import {
  assertWritableContent,
  findStoryFileArgument,
  isStoryFilePath,
  resolveExistingFilePath,
  resolveWritableFilePath,
  sanitizeExportDefaultPath,
  withTimeout,
  watchFileByDirectory,
  writeTextFileAtomically,
  writeTextFileAndVerify,
} from './mainProcessUtils';

// Note: electron-squirrel-startup check is skipped in M0 (dependency not installed).
// Will be enabled in M7 when electron-builder packaging is set up.
// See: https://github.com/mongodb-js/electron-squirrel-startup

let mainWindow: BrowserWindow | null = null;
let currentMenuLanguage: AppMenuLanguage = 'zh-CN';

/** 用户完成脏状态裁决后，允许退出流程绕过重复确认。 */
let forceQuitting = false;

interface WatchedStoryFile {
  readonly path: string;
  watcher: FSWatcher | null;
  pollingTimer: ReturnType<typeof setInterval> | null;
  readonly observations: StoryFileObservationTracker;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

let watchedStoryFile: WatchedStoryFile | null = null;

function hashContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

interface PendingWatchedWrite {
  readonly tracker: StoryFileObservationTracker;
  readonly token: InternalStoryWriteToken;
}

function beginWatchedInternalWrite(filePath: string, hash: string): PendingWatchedWrite | null {
  if (!watchedStoryFile || watchedStoryFile.path !== normalize(filePath)) return null;
  const tracker = watchedStoryFile.observations;
  return { tracker, token: tracker.beginInternalWrite(hash) };
}

function settleWatchedInternalWrite(
  pending: PendingWatchedWrite | null,
  written: boolean,
): void {
  pending?.tracker.settleInternalWrite(pending.token, written);
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
    if (!watchedStoryFile || watchedStoryFile.path !== filePath) return;
    if (!watchedStoryFile.observations.observe(hash).shouldNotify) return;
    mainWindow?.webContents.send(IPC_CHANNELS.file.externalChange, {
      filePath,
      content,
      hash,
      modifiedAt: fileStat.mtimeMs,
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'ENOENT' &&
      watchedStoryFile?.path === filePath
    ) {
      scheduleExternalStoryCheck(filePath, 300);
    }
  }
}

function scheduleExternalStoryCheck(filePath: string, delayMs = 150): void {
  if (!watchedStoryFile || watchedStoryFile.path !== filePath) return;
  if (watchedStoryFile.debounceTimer) {
    clearTimeout(watchedStoryFile.debounceTimer);
  }
  watchedStoryFile.debounceTimer = setTimeout(() => {
    if (watchedStoryFile) watchedStoryFile.debounceTimer = null;
    void notifyExternalStoryChange(filePath);
  }, delayMs);
}

function startStoryPolling(state: WatchedStoryFile): void {
  if (state.pollingTimer) return;
  state.pollingTimer = setInterval(() => {
    scheduleExternalStoryCheck(state.path);
  }, 2000);
}

function startWatchingStoryFile(filePath: string, content: string): void {
  const normalizedPath = normalize(filePath);
  const hash = hashContent(content);
  if (watchedStoryFile?.path === normalizedPath) {
    watchedStoryFile.observations.setObserved(hash);
    return;
  }

  stopWatchingStoryFile();
  watchedStoryFile = {
    path: normalizedPath,
    watcher: null,
    pollingTimer: null,
    observations: new StoryFileObservationTracker(hash),
    debounceTimer: null,
  };

  try {
    const state = watchedStoryFile;
    const watcher = watchFileByDirectory(
      normalizedPath,
      () => scheduleExternalStoryCheck(normalizedPath),
      () => {
        if (watchedStoryFile !== state) return;
        watcher.close();
        state.watcher = null;
        startStoryPolling(state);
      },
    );
    state.watcher = watcher;
  } catch {
    startStoryPolling(watchedStoryFile);
  }
}

/**
 * 系统双击或命令行传入、等待渲染进程消费的 .mdstory 路径。
 * macOS 来源是 open-file 事件，Windows/Linux 来源是命令行参数。
 */
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
const DEVELOPMENT_RENDERER_URL = developmentRendererUrl(
  app.isPackaged,
  process.env['ELECTRON_RENDERER_URL'],
);
const TRUSTED_RENDERER_URLS = trustedRendererUrls({
  rendererHtmlPath: RENDERER_HTML_PATH,
  developmentUrl: DEVELOPMENT_RENDERER_URL,
});

function assertTrustedIpc(event: { senderFrame?: { url: string } | null }): void {
  assertTrustedIpcSender(event, TRUSTED_RENDERER_URLS);
}

if (
  process.env['PLOTFLOW_TEST_USER_DATA_DIR'] &&
  (process.env['NODE_ENV'] === 'test' || process.env['PLOTFLOW_BLACKBOX_E2E'] === '1')
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
  const owner =
    mainWindow && !mainWindow.isDestroyed()
      ? mainWindow
      : (BrowserWindow.getFocusedWindow() ??
        BrowserWindow.getAllWindows().find((win) => !win.isDestroyed()));

  if (!owner || owner.isDestroyed()) return undefined;
  if (owner.isMinimized()) owner.restore();
  owner.show();
  owner.focus();
  owner.moveTop();
  return owner;
}

// ============================================================================
// IPC 安全校验常量
// ============================================================================

/** 导出格式白名单。 */
const ALLOWED_EXPORT_FORMATS = ['json', 'html', 'txt'] as const;

async function assertReadableStoryFile(filePath: string): Promise<string> {
  const canonicalPath = await resolveExistingFilePath(filePath);
  if (!isStoryFilePath(canonicalPath)) {
    throw new Error('仅支持读取 .mdstory 文件');
  }
  if (isBlockedSystemPath(canonicalPath)) {
    throw new Error('不允许从系统目录读取文件');
  }

  const fileStat = await stat(canonicalPath);
  if (!fileStat.isFile()) {
    throw new Error('目标不是文件');
  }
  if (fileStat.size > MAX_READ_BYTES) {
    const sizeMB = (fileStat.size / 1024 / 1024).toFixed(1);
    throw new Error(`文件过大（${sizeMB}MB），上限为 10MB`);
  }

  return canonicalPath;
}

async function readStoryFile(
  filePath: string,
): Promise<{ filePath: string; content: string; hash: string; modifiedAt: number }> {
  const normalizedPath = await assertReadableStoryFile(filePath);
  const content = await readFile(normalizedPath, 'utf-8');
  const fileStat = await stat(normalizedPath);
  const hash = hashContent(content);
  startWatchingStoryFile(normalizedPath, content);
  return { filePath: normalizedPath, content, hash, modifiedAt: fileStat.mtimeMs };
}


// ============================================================================

/**
 * file:save — 将内容写入指定故事文件。
 * 由渲染进程通过 window.plotflow.file.save({ path, content, expectedHash }) 触发。
 * 对应 TAD.md §4.2 AutoSaveManager 的主进程写文件逻辑。
 */
ipcMain.handle(
  IPC_CHANNELS.file.save,
  async (
    event,
    payload: {
      path: string;
      content: string;
      expectedHash: string | null;
      overwriteConflict?: boolean;
    },
  ) => {
    assertTrustedIpc(event);
    try {
      const rawPath = payload?.path;
      const content = payload?.content;
      assertWritableContent(content);
      // 路径安全校验：拒绝遍历、错误扩展名和系统目录。

      if (!rawPath || typeof rawPath !== 'string') {
        throw new Error('无效的文件路径');
      }

      if (rawPath.includes('..')) {
        throw new Error('路径包含非法遍历组件');
      }

      const normalizedPath = await resolveWritableFilePath(rawPath);

      // 扩展名白名单
      if (!isStoryFilePath(normalizedPath)) {
        throw new Error('仅支持保存 .mdstory 文件');
      }
      if (isBlockedSystemPath(normalizedPath)) {
        throw new Error('不允许向系统目录保存文件');
      }

      const hash = hashContent(content);
      const pendingWrite = beginWatchedInternalWrite(normalizedPath, hash);
      let writeResult: Awaited<ReturnType<typeof writeTextFileAtomically>>;
      try {
        writeResult = await writeTextFileAtomically(normalizedPath, content, {
          expectedHash: payload.expectedHash,
          hashContent,
        });
      } catch (error) {
        settleWatchedInternalWrite(pendingWrite, false);
        throw error;
      }
      settleWatchedInternalWrite(pendingWrite, writeResult.written);
      if (!writeResult.written) {
        if (!writeResult.conflict) {
          return {
            success: false,
            conflict: false,
            timestamp: Date.now(),
            message: writeResult.message,
          };
        }
        return {
          success: false,
          conflict: true,
          filePath: writeResult.filePath,
          content: writeResult.content,
          hash: writeResult.hash,
          modifiedAt: writeResult.modifiedAt,
        };
      }

      startWatchingStoryFile(normalizedPath, content);
      return { success: true, timestamp: Date.now(), hash, modifiedAt: writeResult.modifiedAt };
    } catch (error) {
      throw new Error(`无法保存文件: ${(error as Error).message}`);
    }
  },
);

/** file:open — 打开文件对话框并读取故事内容。 */
ipcMain.handle(IPC_CHANNELS.file.open, async (event) => {
  assertTrustedIpc(event);
  try {
    focusNativeDialogOwner();
    const openOptions: OpenDialogOptions = {
      title: getMainProcessMessages(currentMenuLanguage).openStoryTitle,
      filters: [
        {
          name: getMainProcessMessages(currentMenuLanguage).storyFileType,
          extensions: ['mdstory'],
        },
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

/** file:saveAs — 打开另存为对话框并原子写入故事文件。 */
ipcMain.handle(IPC_CHANNELS.file.saveAs, async (event, payload: { content: string }) => {
  assertTrustedIpc(event);
  try {
    assertWritableContent(payload?.content);
    focusNativeDialogOwner();
    const saveOptions: SaveDialogOptions = {
      title: getMainProcessMessages(currentMenuLanguage).saveStoryTitle,
      filters: [
        {
          name: getMainProcessMessages(currentMenuLanguage).storyFileType,
          extensions: ['mdstory'],
        },
      ],
      defaultPath: 'untitled.mdstory',
    };
    const result = await dialog.showSaveDialog(saveOptions);

    if (result.canceled || !result.filePath) {
      return null;
    }

    // 主进程兜底：自动补全 .mdstory 扩展名。
    let filePath = result.filePath;
    if (!isStoryFilePath(filePath)) {
      filePath += '.mdstory';
    }
    filePath = await resolveWritableFilePath(filePath);
    if (isBlockedSystemPath(filePath)) {
      throw new Error('不允许向系统目录保存文件');
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

/** file:export — 打开导出对话框并原子写入 JSON、HTML 或 TXT。 */
ipcMain.handle(IPC_CHANNELS.file.export, async (event, payload: FileExportRequest) => {
  assertTrustedIpc(event);
  try {
    assertWritableContent(payload?.content);

    // 主进程兜底 1：格式白名单。
    if (
      !payload.format ||
      !(ALLOWED_EXPORT_FORMATS as readonly string[]).includes(payload.format)
    ) {
      throw new Error(`不支持的导出格式: ${payload.format || '(未指定)'}`);
    }

    // 主进程兜底 2：过滤器扩展名白名单。
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

    const filePath = await resolveWritableFilePath(result.filePath);
    await writeTextFileAndVerify(filePath, payload.content);
    return { filePath };
  } catch (error) {
    throw new Error(`导出失败: ${(error as Error).message}`);
  }
});

/**
 * file:getPendingOpenFile — 消费系统打开事件暂存的故事文件。
 * 返回结构化结果后清空 pending，避免重复打开。
 */
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

/** file:readByPath — 按路径读取系统打开通知指定的 .mdstory 文件。 */
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

ipcMain.handle(
  IPC_CHANNELS.file.listWorkspaceStories,
  async (event, payload: { rootPath: string }) => {
    assertTrustedIpc(event);
    try {
      return listWorkspaceStories(payload.rootPath);
    } catch (error) {
      throw new Error(`工作区刷新失败: ${(error as Error).message}`);
    }
  },
);

ipcMain.handle(
  IPC_CHANNELS.file.readWorkspaceStory,
  async (event, payload: { rootPath: string; filePath: string }) => {
    assertTrustedIpc(event);
    try {
      const filePath = await resolveWorkspaceStoryPath(payload.rootPath, payload.filePath);
      return readStoryFile(filePath);
    } catch (error) {
      console.error(`[Fablevia] 读取工作区文件失败: ${payload.filePath}`, error);
      return null;
    }
  },
);

/** dialog:confirm — 显示渲染进程请求的原生确认框并返回按钮索引。 */
ipcMain.handle(
  IPC_CHANNELS.dialog.confirm,
  async (
    event,
    options: {
      type?: 'none' | 'info' | 'error' | 'question' | 'warning';
      message: string;
      detail: string;
      buttons: string[];
    },
  ) => {
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
  },
);

ipcMain.handle(IPC_CHANNELS.feedback.send, async (event, payload: FeedbackSubmitRequest) => {
  assertTrustedIpc(event);
  return submitFeedbackOverHttps(payload, { isPackaged: app.isPackaged });
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
    void dialog
      .showMessageBox(affectedWindow, {
        type: 'error',
        title: text.productName,
        message: text.rendererCrashMessage,
        detail: text.rendererCrashDetail,
        buttons: [...text.rendererCrashButtons],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (affectedWindow.isDestroyed()) return;
        if (response === 0) affectedWindow.reload();
        else affectedWindow.close();
      });
  });

  /**
   * 窗口关闭保护：检查未保存更改并复用现有保存/放弃/取消裁决。
   * forceQuitting 防止已获准的关闭动作再次进入本处理器。
   */
  mainWindow.on('close', async (event) => {
    if (forceQuitting || mainWindow === null) return;
    event.preventDefault();
    if (closeArbitrationPending) return;
    closeArbitrationPending = true;

    const target = mainWindow;
    let authorised = false;
    try {
      authorised = await arbitrateClose({
        queryState: async () =>
          withTimeout(
            target.webContents.executeJavaScript('window.__getEditorDirtyState__()'),
            RENDERER_QUERY_TIMEOUT_MS,
            '读取编辑器状态超时',
          ),
        save: async () =>
          withTimeout(
            target.webContents.executeJavaScript('window.__forceSave__ && window.__forceSave__()'),
            RENDERER_SAVE_TIMEOUT_MS,
            '保存操作超时',
          ),
        discard: async () =>
          withTimeout(
            target.webContents.executeJavaScript(
              'window.__prepareDiscard__ && window.__prepareDiscard__()',
            ),
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
          console.error(
            `[Fablevia] ${stage === 'query' ? '读取关闭状态' : '关闭前保存'}失败`,
            error,
          );
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
// 系统文件打开事件
// ============================================================================

/** macOS open-file 事件接收 Finder 双击的 .mdstory 文件。 */
app.on('open-file', (event, path) => {
  event.preventDefault();

  // 仅处理 .mdstory 文件
  if (!isStoryFilePath(path)) {
    return;
  }

  console.log(`[Fablevia] macOS open-file: ${path}`);

  if (rendererReadyForSystemOpen && mainWindow && !mainWindow.isDestroyed())
    dispatchSystemOpenFile(path);
  else pendingFilePath = path;
});

/** Windows/Linux 从命令行参数提取文件关联传入的 .mdstory 路径。 */
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
