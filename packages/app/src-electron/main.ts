import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join, normalize } from 'node:path';
import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { buildMenu } from './menu';

// Note: electron-squirrel-startup check is skipped in M0 (dependency not installed).
// Will be enabled in M7 when electron-builder packaging is set up.
// See: https://github.com/mongodb-js/electron-squirrel-startup

let mainWindow: BrowserWindow | null = null;

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
  const { path: rawPath, content } = payload;
  try {
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
    const content = await readFile(filePath!, 'utf-8');
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
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '保存 PlotFlow 故事文件',
      filters: [{ name: 'PlotFlow Story', extensions: ['mdstory'] }],
      defaultPath: 'untitled.mdstory',
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    await writeFile(result.filePath, payload.content, 'utf-8');
    return { filePath: result.filePath };
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
}) => {
  try {
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

// ============================================================================
// Window Management
// ============================================================================

function createWindow(): void {
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
function checkCommandLineArgs(): void {
  const args = process.argv;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    // 跳过 electron-vite dev 模式的内部参数
    if (arg.startsWith('--') || arg.startsWith('-')) {
      continue;
    }

    // 检查是否是 .mdstory 文件（路径存在且扩展名匹配）
    if (arg.endsWith('.mdstory') && existsSync(arg)) {
      pendingFilePath = arg;
      console.log(`[PlotFlow] 命令行参数文件: ${arg}`);
      break;
    }
  }
}

// ============================================================================
// App Lifecycle
// ============================================================================

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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 应用退出前，主进程清理（渲染进程的 cleanup 由窗口关闭事件触发）
});
