import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// ============================================================================
// 菜单事件监听器管理
// ============================================================================
//
// 存储已注册的菜单事件监听器，用于组件卸载时清理。
// 每个 channel 只保留一个监听器，后续注册会覆盖前一个。

const menuListeners = new Map<string, () => void>();

// ============================================================================
// contextBridge API 暴露
// ============================================================================

contextBridge.exposeInMainWorld('plotflow', {
  platform: process.platform,
  env: {
    isTest: process.env['NODE_ENV'] === 'test',
  },
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },

  // ── 对话框 — P0-5 ──
  dialog: {
    confirm: (options: {
      type?: 'none' | 'info' | 'error' | 'question' | 'warning';
      message: string;
      detail: string;
      buttons: readonly string[];
    }): Promise<number> =>
      ipcRenderer.invoke('dialog:confirm', options),
  },

  // ── 文件操作 — M1-13 ──
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    save: (path: string, content: string) =>
      ipcRenderer.invoke('file:save', { path, content }),
    saveAs: (content: string) =>
      ipcRenderer.invoke('file:saveAs', { content }),
    saveExport: (options: { content: string; defaultPath: string; filters: Array<{ name: string; extensions: string[] }>; format: string }) =>
      ipcRenderer.invoke('file:export', options),

    // ── 系统文件打开 (M7-08) ──
    /**
     * 获取系统（双击 .mdstory / open-file 事件）传递的待打开文件。
     * 窗口挂载后调用，返回 { filePath, content } 或 null。
     */
    getPendingOpenFile: () =>
      ipcRenderer.invoke('file:getPendingOpenFile'),

    /**
     * 监听系统文件打开通知（当应用已运行且用户双击 .mdstory 时触发）。
     * macOS 的 open-file 事件可随时发生，此回调用于窗口感知新文件。
     * 返回一个清理函数（组件卸载时调用）。
     */
    onSystemOpenFile: (callback: (filePath: string) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, filePath: string): void => {
        callback(filePath);
      };
      ipcRenderer.on('file:system-open-notify', listener);
      return () => {
        ipcRenderer.removeListener('file:system-open-notify', listener);
      };
    },

    /**
     * 按路径读取 .mdstory 文件内容。
     * 用于运行时系统文件打开通知后加载文件内容。
     */
    readByPath: (path: string): Promise<{ filePath: string; content: string } | null> =>
      ipcRenderer.invoke('file:readByPath', { path }),
    chooseWorkspaceFolder: () =>
      ipcRenderer.invoke('file:chooseWorkspaceFolder'),
    listWorkspaceStories: (rootPath: string) =>
      ipcRenderer.invoke('file:listWorkspaceStories', { rootPath }),
    readWorkspaceStory: (rootPath: string, filePath: string): Promise<{ filePath: string; content: string } | null> =>
      ipcRenderer.invoke('file:readWorkspaceStory', { rootPath, filePath }),
  },

  // ── 菜单事件 — M1-17 ──
  //
  // 主进程 Menu 点击通过 webContents.send() 发送 IPC 事件到渲染进程，
  // 渲染进程通过 menu.onEvent() 注册回调监听。
  //
  // 使用方式：
  //   window.plotflow.menu.onEvent('menu:file:open', () => { ... });
  //   window.plotflow.menu.removeEventListener('menu:file:open');
  menu: {
    /**
     * 注册一个菜单事件监听器。
     * 相同 channel 的旧监听器会被自动移除（防止重复注册）。
     */
    onEvent: (channel: string, callback: () => void): void => {
      // 移除该 channel 上已有的监听器（防止重复）
      const existing = menuListeners.get(channel);
      if (existing) {
        existing();
        menuListeners.delete(channel);
      }

      const listener = (_event: IpcRendererEvent): void => {
        callback();
      };

      ipcRenderer.on(channel, listener);

      // 存储清理函数
      menuListeners.set(channel, () => {
        ipcRenderer.removeListener(channel, listener);
      });
    },

    /**
     * 移除指定 channel 的菜单事件监听器。
     */
    removeEventListener: (channel: string): void => {
      const remove = menuListeners.get(channel);
      if (remove) {
        remove();
        menuListeners.delete(channel);
      }
    },

    /**
     * 移除所有已注册的菜单事件监听器。
     * 应用卸载时调用。
     */
    removeAllEventListeners: (): void => {
      menuListeners.forEach((remove) => remove());
      menuListeners.clear();
    },
  },

  theme: {
    listThemePacks: () =>
      ipcRenderer.invoke('theme:listLocalThemePacks'),
    installThemePack: (sourcePath?: string) =>
      ipcRenderer.invoke('theme:installThemePack', sourcePath),
    openThemeMarket: () =>
      ipcRenderer.invoke('theme:openThemeMarket'),
    openOfficialThemeStore: () =>
      ipcRenderer.invoke('theme:openOfficialThemeStore'),
  },
});
