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
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },

  // ── 文件操作 — M1-13 ──
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    save: (path: string, content: string) =>
      ipcRenderer.invoke('file:save', { path, content }),
    saveAs: (content: string) =>
      ipcRenderer.invoke('file:saveAs', { content }),
    saveExport: (options: { content: string; defaultPath: string; filters: Array<{ name: string; extensions: string[] }> }) =>
      ipcRenderer.invoke('file:export', options),
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
});
