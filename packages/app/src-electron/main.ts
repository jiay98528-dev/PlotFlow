import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import { join } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { buildMenu } from './menu';

// Note: electron-squirrel-startup check is skipped in M0 (dependency not installed).
// Will be enabled in M7 when electron-builder packaging is set up.
// See: https://github.com/mongodb-js/electron-squirrel-startup

let mainWindow: BrowserWindow | null = null;

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
  const { path, content } = payload;
  try {
    await writeFile(path, content, 'utf-8');
    return { success: true, timestamp: Date.now() };
  } catch (error) {
    throw new Error(`无法保存文件: ${(error as Error).message}`);
  }
});

/**
 * file:read — 从指定文件读取内容
 *
 * 预留接口（M1 打开文件功能时启用）。
 */
ipcMain.handle('file:read', async (_event, path: string) => {
  try {
    const content = await readFile(path, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
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
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
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
