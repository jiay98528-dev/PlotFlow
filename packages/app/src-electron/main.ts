import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join, normalize } from 'node:path';
import { writeFile, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { buildMenu } from './menu';
import {
  assertWritableContent,
  findStoryFileArgument,
  withTimeout,
} from './mainProcessUtils';

// Note: electron-squirrel-startup check is skipped in M0 (dependency not installed).
// Will be enabled in M7 when electron-builder packaging is set up.
// See: https://github.com/mongodb-js/electron-squirrel-startup

let mainWindow: BrowserWindow | null = null;

/** 当用户在脏检查确认后，强制退出流程中跳过重复确认的标记 */
let forceQuitting = false;

/**
 * 系统（双击/命令行）打开的 .mdstory 文件路径（M7-08）。
 *
 * 存储来自以下两种途径的文件路径:
 *   - macOS: app.on('open-file', ...) 事件
 *   - Windows/Linux: process.argv[1] 命令行参数
 *
 * 窗口就绪后，渲染进程通过 file:getPendingOpenFile IPC 获取此路径并加载。
 */
let pendingFilePath: string | null = null;

const RENDERER_QUERY_TIMEOUT_MS = 5_000;
const RENDERER_SAVE_TIMEOUT_MS = 15_000;

// ============================================================================
// IPC 安全校验常量 (V0.3 主进程兜底校验)
// ============================================================================

/** 文件读取大小上限：10MB（防止恶意大文件 OOM） */
const MAX_READ_BYTES = 10 * 1024 * 1024;

/** 导出格式白名单 */
const ALLOWED_EXPORT_FORMATS = ['json', 'html', 'txt'] as const;

/** 禁止访问的系统目录前缀（Unix） */
const FORBIDDEN_UNIX_PREFIXES = ['/etc', '/proc', '/sys', '/dev', '/boot', '/root'];

/**
 * 检测路径是否位于系统敏感目录内。
 * 不替代操作系统权限控制，仅作为主进程兜底校验。
 */
function isBlockedSystemPath(filePath: string): boolean {
  const normalized = normalize(filePath);
  const lower = normalized.toLowerCase();

  // Unix 系统目录
  for (const prefix of FORBIDDEN_UNIX_PREFIXES) {
    if (lower === prefix || lower.startsWith(prefix + '/') || lower.startsWith(prefix + '\\')) {
      return true;
    }
  }

  // Windows 系统目录 (C:\Windows, /Windows/ 及其子目录)
  if (lower.includes('\\windows\\') || lower.includes('/windows/')) {
    return true;
  }

  return false;
}

// ============================================================================
// IPC Handlers
// ============================================================================

/**
 * file:save — 将内容写入指定文件
 *
 * 由渲染进程通过 window.plotflow.file.save(path, content) 触发。
 * 对应 TAD.md §4.2 AutoSaveManager 的主进程写文件逻辑。
 */
ipcMain.handle('file:save', async (_event, payload: { path: string; content: string }) => {
  try {
    const rawPath = payload?.path;
    const content = payload?.content;
    assertWritableContent(content);
    // ── 路径安全验证（P0-4: 三层防护）──

    // 第1层：非空 + 类型检查
    if (!rawPath || typeof rawPath !== 'string') {
      throw new Error('无效的文件路径');
    }

    // 第2层：路径遍历检测（normalize 前检测原始字符串中的 ..）
    if (rawPath.includes('..')) {
      throw new Error('路径包含非法遍历组件');
    }

    const normalizedPath = normalize(rawPath);

    // 第3层：扩展名白名单
    if (!normalizedPath.toLowerCase().endsWith('.mdstory')) {
      throw new Error('仅支持保存 .mdstory 文件');
    }

    await writeFile(normalizedPath, content, 'utf-8');
    return { success: true, timestamp: Date.now() };
  } catch (error) {
    throw new Error(`无法保存文件: ${(error as Error).message}`);
  }
});

/**
 * file:open — 打开文件对话框 + 读取内容
 *
 * 由渲染进程通过 window.plotflow.file.open() 触发。
 * 对应 TAD.md §4.1 File I/O 服务的 FILE_OPEN 通道。
 */
ipcMain.handle('file:open', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '打开 PlotFlow 故事文件',
      filters: [
        { name: 'PlotFlow Story', extensions: ['mdstory'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const filePath = result.filePaths[0]!;

    // ── 主进程兜底校验 1：扩展名 ──
    if (!filePath.toLowerCase().endsWith('.mdstory')) {
      throw new Error('仅支持打开 .mdstory 文件');
    }

    // ── 主进程兜底校验 2：系统目录 ──
    if (isBlockedSystemPath(filePath)) {
      throw new Error('不允许从系统目录打开文件');
    }

    // ── 主进程兜底校验 3：文件大小上限 10MB ──
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_READ_BYTES) {
      const sizeMB = (fileStat.size / 1024 / 1024).toFixed(1);
      throw new Error(`文件过大（${sizeMB}MB），上限为 10MB`);
    }

    const content = await readFile(filePath, 'utf-8');
    return { filePath, content };
  } catch (error) {
    throw new Error(`文件打开失败: ${(error as Error).message}`);
  }
});

/**
 * file:saveAs — 另存为对话框 + 写入文件
 *
 * 由渲染进程通过 window.plotflow.file.saveAs(content) 触发。
 * 对应 TAD.md §4.1 File I/O 服务的 FILE_SAVE_AS 通道。
 */
ipcMain.handle('file:saveAs', async (_event, payload: { content: string }) => {
  try {
    assertWritableContent(payload?.content);
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '保存 PlotFlow 故事文件',
      filters: [{ name: 'PlotFlow Story', extensions: ['mdstory'] }],
      defaultPath: 'untitled.mdstory',
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    // ── 主进程兜底校验：自动追加 .mdstory 扩展名 ──
    let filePath = result.filePath;
    if (!filePath.toLowerCase().endsWith('.mdstory')) {
      filePath += '.mdstory';
    }

    await writeFile(filePath, payload.content, 'utf-8');
    return { filePath };
  } catch (error) {
    throw new Error(`文件另存为失败: ${(error as Error).message}`);
  }
});

/**
 * file:export — 导出文件对话框 + 写入文件
 *
 * 由渲染进程通过 window.plotflow.file.saveExport(options) 触发。
 * 支持指定文件类型过滤器（如 .json / .html / .txt）和建议文件名。
 * 被取消时返回 null。
 */
ipcMain.handle('file:export', async (_event, payload: {
  content: string;
  defaultPath: string;
  filters: Array<{ name: string; extensions: string[] }>;
  format: string;
}) => {
  try {
    assertWritableContent(payload?.content);

    // ── 主进程兜底校验 1：format 白名单 ──
    if (!payload.format || !(ALLOWED_EXPORT_FORMATS as readonly string[]).includes(payload.format)) {
      throw new Error(`不支持的导出格式: ${payload.format || '(未指定)'}`);
    }

    // ── 主进程兜底校验 2：filters 扩展名白名单 ──
    if (payload.filters && Array.isArray(payload.filters)) {
      for (const filter of payload.filters) {
        for (const ext of filter.extensions) {
          if (!(ALLOWED_EXPORT_FORMATS as readonly string[]).includes(ext)) {
            throw new Error(`不支持的导出扩展名: .${ext}`);
          }
        }
      }
    }

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出文件',
      filters: payload.filters,
      defaultPath: payload.defaultPath,
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await writeFile(result.filePath, payload.content, 'utf-8');
    return { filePath: result.filePath };
  } catch (error) {
    throw new Error(`导出失败: ${(error as Error).message}`);
  }
});

/**
 * file:getPendingOpenFile — 获取系统打开的文件路径与内容（M7-08）
 *
 * 渲染进程在窗口挂载后调用此 IPC，
 * 检查是否有系统（双击 .mdstory / open-file 事件）传递的文件待打开。
 *
 * 返回 { filePath, content } 或 null（无待打开文件）。
 * 返回后清除 pending 状态，避免重复打开。
 */
ipcMain.handle('file:getPendingOpenFile', async () => {
  if (!pendingFilePath) {
    return null;
  }

  const path = pendingFilePath;
  pendingFilePath = null; // 一次性消费

  try {
    const content = await readFile(path, 'utf-8');
    return { filePath: path, content };
  } catch (error) {
    console.error(`[PlotFlow] 读取系统打开文件失败: ${path}`, error);
    return null;
  }
});

/**
 * file:readByPath — 按路径读取文件内容 (M7-08)
 *
 * 渲染进程在收到系统文件打开通知后调用此 IPC，
 * 读取指定路径的 .mdstory 文件内容。
 */
ipcMain.handle('file:readByPath', async (_event, payload: { path: string }) => {
  try {
    const content = await readFile(payload.path, 'utf-8');
    return { filePath: payload.path, content };
  } catch (error) {
    console.error(`[PlotFlow] 读取文件失败: ${payload.path}`, error);
    return null;
  }
});

/**
 * dialog:confirm — 从渲染进程调用原生消息对话框
 *
 * 供渲染进程通过 window.plotflow.dialog.confirm(options) 触发。
 * 返回用户点击的按钮索引（0-based），dialog 关闭时返回 -1。
 */
ipcMain.handle('dialog:confirm', async (_event, options: {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  message: string;
  detail: string;
  buttons: string[];
}) => {
  const result = await dialog.showMessageBox(mainWindow!, {
    type: options.type ?? 'warning',
    message: options.message,
    detail: options.detail,
    buttons: [...options.buttons],
    defaultId: 0,
    cancelId: options.buttons.length - 1,
  });
  return result.response;
});

// ============================================================================
// Window Management
// ============================================================================

function createWindow(): void {
  forceQuitting = false;
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'PlotFlow',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  // In development, load from Vite dev server
  // eslint-disable-next-line dot-notation
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']!);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[PlotFlow] 渲染进程退出:', details.reason, details.exitCode);
    if (details.reason === 'clean-exit' || mainWindow === null) return;

    const affectedWindow = mainWindow;
    void dialog.showMessageBox(affectedWindow, {
      type: 'error',
      title: 'PlotFlow',
      message: '编辑器渲染进程意外退出',
      detail: '可以尝试重新加载编辑器。尚未写入磁盘的内容可能无法恢复。',
      buttons: ['重新加载', '关闭'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (affectedWindow.isDestroyed()) return;
      if (response === 0) affectedWindow.reload();
      else affectedWindow.close();
    });
  });

  /**
   * 窗口关闭拦截 — P0-5 脏状态检查
   *
   * 当用户点击关闭按钮或按 Alt+F4 时，先检查渲染进程的编辑器
   * 是否有未保存的更改。如果有，显示保存/不保存/取消对话框。
   * forceQuitting 标志防止对话框自身的关闭操作被重复拦截。
   */
  mainWindow.on('close', async (event) => {
    if (forceQuitting || mainWindow === null) return;
    event.preventDefault();

    try {
      const state = await withTimeout(
        mainWindow.webContents.executeJavaScript(
          `(function() {
            try { return window.__getEditorDirtyState__(); } catch(e) { return null; }
          })()`,
        ),
        RENDERER_QUERY_TIMEOUT_MS,
        '读取编辑器状态超时',
      );

      if (state && state.isDirty) {
        const result = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['保存', '不保存', '取消'],
          defaultId: 0,
          cancelId: 2,
          title: 'PlotFlow',
          message: '有未保存的更改',
          detail: state.filePath
            ? `"${state.filePath}" 有未保存的更改。退出前是否保存？`
            : '未命名的文件有未保存的更改。退出前是否保存？',
        });

        if (result.response === 0) {
          // 用户选择「保存」— 触发渲染进程强制保存，然后关闭
          await withTimeout(
            mainWindow.webContents.executeJavaScript(
              `window.__forceSave__ && window.__forceSave__()`,
            ),
            RENDERER_SAVE_TIMEOUT_MS,
            '保存操作超时',
          );
        } else if (result.response === 2) {
          // 用户选择「取消」— 中止关闭
          return;
        }
        // result.response === 1: 用户选择「不保存」— 允许关闭，继续往下
      }
    } catch {
      // 渲染进程可能已崩溃或无响应 — 允许关闭
    }

    forceQuitting = true;
    mainWindow.close();
  });
}

// ============================================================================
// 系统文件打开事件处理 (M7-08)
// ============================================================================

/**
 * macOS: 通过系统 open-file 事件捕获双击的 .mdstory 文件路径。
 *
 * 当用户在 Finder 中双击 .mdstory 文件（且 PlotFlow 已注册为该扩展的默认应用）时，
 * macOS 向已运行的实例发送 open-file 事件，或在新启动时通过此事件传递路径。
 */
app.on('open-file', (event, path) => {
  event.preventDefault();

  // 仅处理 .mdstory 文件
  if (!path.endsWith('.mdstory')) {
    return;
  }

  pendingFilePath = path;
  console.log(`[PlotFlow] macOS open-file: ${path}`);

  // 如果窗口已存在，通知渲染进程有文件待打开
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('file:system-open-notify', path);
  }
});

/**
 * Windows / Linux: 通过命令行参数捕获双击的 .mdstory 文件路径。
 *
 * 当用户双击 .mdstory 文件时（electron-builder 注册了文件关联后），
 * Windows 将文件路径作为第一个命令行参数传递给应用。
 *
 * 注意: process.argv[0] 是可执行文件自身路径。
 * 生产环境（打包后）argv[1] 为文件路径；开发环境（electron-vite dev）argv[1] 可能为其他。
 */
function checkCommandLineArgs(args: readonly string[] = process.argv): boolean {
  const storyPath = findStoryFileArgument(args);
  if (storyPath && existsSync(storyPath)) {
    pendingFilePath = storyPath;
    console.log(`[PlotFlow] 命令行参数文件: ${storyPath}`);
    return true;
  }
  return false;
}

// ============================================================================
// App Lifecycle
// ============================================================================

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
      mainWindow.webContents.send('file:system-open-notify', pendingFilePath);
    }
  });

  app.whenReady().then(() => {
  // 检查命令行参数中是否包含 .mdstory 文件路径
  checkCommandLineArgs();

  // 注册应用菜单栏（M1-17）
  // 必须在 createWindow 之前调用，确保窗口创建时菜单已就绪
  Menu.setApplicationMenu(buildMenu());

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  });
}

process.on('uncaughtException', (error) => {
  console.error('[PlotFlow] 主进程未捕获异常:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[PlotFlow] 主进程未处理 Promise 拒绝:', reason);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // P0-5: 如果 forceQuitting 已为 true，说明窗口关闭处理器已完成脏检查
  // —— 此时直接允许退出，不再重复拦截。
  // 渲染进程的清理工作由窗口关闭事件（closed）触发。
  if (!forceQuitting && mainWindow && !mainWindow.isDestroyed()) {
    // 仍有窗口存活但 forceQuitting 未设置 → 来自系统级退出（如关机/登出/CMD+Q）
    // 此时关闭窗口会触发 close 事件，close 处理器会执行脏检查
    // 不回撤系统级退出；如果用户取消，窗口保持打开
  }
});
