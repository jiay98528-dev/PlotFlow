import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import { IPC_CHANNELS } from '../src/shared/ipcChannels';
import { createBufferedResultListener } from './systemOpenBuffer';
import type {
  DialogConfirmOptions,
  FileExternalChangeEvent,
  FileOpenResult,
  MenuEventChannel,
  PendingOpenFileResult,
  PlotFlowAPI,
  WorkspaceStoriesResult,
} from '../src/types/electron';

const systemOpenResults = createBufferedResultListener<PendingOpenFileResult>();

ipcRenderer.on(IPC_CHANNELS.file.systemOpenNotify, (_event, result: PendingOpenFileResult) => {
  systemOpenResults.push(result);
});

// ============================================================================
// 鑿滃崟浜嬩欢鐩戝惉鍣ㄧ鐞?
// ============================================================================
//
// 瀛樺偍宸叉敞鍐岀殑鑿滃崟浜嬩欢鐩戝惉鍣紝鐢ㄤ簬缁勪欢鍗歌浇鏃舵竻鐞嗐€?
// 姣忎釜 channel 鍙繚鐣欎竴涓洃鍚櫒锛屽悗缁敞鍐屼細瑕嗙洊鍓嶄竴涓€?

const menuListeners = new Map<MenuEventChannel, () => void>();

// ============================================================================
// contextBridge API 鏆撮湶
// ============================================================================

const plotflowApi = {
  platform: process.platform,
  env: {
    isTest: process.env['NODE_ENV'] === 'test',
  },
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },

  // 鈹€鈹€ 瀵硅瘽妗?鈥?P0-5 鈹€鈹€
  dialog: {
    confirm: (options: DialogConfirmOptions): Promise<number> =>
      ipcRenderer.invoke(IPC_CHANNELS.dialog.confirm, options),
  },

  // 鈹€鈹€ 鏂囦欢鎿嶄綔 鈥?M1-13 鈹€鈹€
  file: {
    open: (): Promise<FileOpenResult | null> => ipcRenderer.invoke(IPC_CHANNELS.file.open),
    save: (request: { path: string; content: string; expectedHash: string | null; overwriteConflict?: boolean }) =>
      ipcRenderer.invoke(IPC_CHANNELS.file.save, request),
    saveAs: (content: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.file.saveAs, { content }),
    saveExport: (options: { content: string; defaultPath: string; filters: Array<{ name: string; extensions: string[] }>; format: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.file.export, options),

    // 鈹€鈹€ 绯荤粺鏂囦欢鎵撳紑 (M7-08) 鈹€鈹€
    /**
     * 鑾峰彇绯荤粺锛堝弻鍑?.mdstory / open-file 浜嬩欢锛変紶閫掔殑寰呮墦寮€鏂囦欢銆?
     * 绐楀彛鎸傝浇鍚庤皟鐢紝杩斿洖 { filePath, content } 鎴?null銆?
     */
    getPendingOpenFile: (): Promise<PendingOpenFileResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.getPendingOpenFile),

    /**
     * 鐩戝惉绯荤粺鏂囦欢鎵撳紑閫氱煡锛堝綋搴旂敤宸茶繍琛屼笖鐢ㄦ埛鍙屽嚮 .mdstory 鏃惰Е鍙戯級銆?
     * macOS 鐨?open-file 浜嬩欢鍙殢鏃跺彂鐢燂紝姝ゅ洖璋冪敤浜庣獥鍙ｆ劅鐭ユ柊鏂囦欢銆?
     * 杩斿洖涓€涓竻鐞嗗嚱鏁帮紙缁勪欢鍗歌浇鏃惰皟鐢級銆?
     */
    onSystemOpenFile: (callback: (result: PendingOpenFileResult) => void): (() => void) => {
      return systemOpenResults.register(callback);
    },

    onExternalChange: (callback: (event: FileExternalChangeEvent) => void): (() => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: FileExternalChangeEvent): void => {
        callback(payload);
      };
      ipcRenderer.on(IPC_CHANNELS.file.externalChange, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.file.externalChange, listener);
      };
    },

    /**
     * 鎸夎矾寰勮鍙?.mdstory 鏂囦欢鍐呭銆?
     * 鐢ㄤ簬杩愯鏃剁郴缁熸枃浠舵墦寮€閫氱煡鍚庡姞杞芥枃浠跺唴瀹广€?
     */
    readByPath: (path: string): Promise<{ filePath: string; content: string; hash: string; modifiedAt: number } | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.readByPath, { path }),
    chooseWorkspaceFolder: (): Promise<WorkspaceStoriesResult | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.chooseWorkspaceFolder),
    listWorkspaceStories: (rootPath: string): Promise<WorkspaceStoriesResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.listWorkspaceStories, { rootPath }),
    readWorkspaceStory: (rootPath: string, filePath: string): Promise<{ filePath: string; content: string; hash: string; modifiedAt: number } | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.readWorkspaceStory, { rootPath, filePath }),
  },

  // 鈹€鈹€ 鑿滃崟浜嬩欢 鈥?M1-17 鈹€鈹€
  //
  // 涓昏繘绋?Menu 鐐瑰嚮閫氳繃 webContents.send() 鍙戦€?IPC 浜嬩欢鍒版覆鏌撹繘绋嬶紝
  // 娓叉煋杩涚▼閫氳繃 menu.onEvent() 娉ㄥ唽鍥炶皟鐩戝惉銆?
  //
  // 浣跨敤鏂瑰紡锛?
  //   window.plotflow.menu.onEvent('menu:file:open', () => { ... });
  //   window.plotflow.menu.removeEventListener('menu:file:open');
  menu: {
    /**
     * 娉ㄥ唽涓€涓彍鍗曚簨浠剁洃鍚櫒銆?
     * 鐩稿悓 channel 鐨勬棫鐩戝惉鍣ㄤ細琚嚜鍔ㄧЩ闄わ紙闃叉閲嶅娉ㄥ唽锛夈€?
     */
    onEvent: (channel: MenuEventChannel, callback: () => void): void => {
      // 绉婚櫎璇?channel 涓婂凡鏈夌殑鐩戝惉鍣紙闃叉閲嶅锛?
      const existing = menuListeners.get(channel);
      if (existing) {
        existing();
        menuListeners.delete(channel);
      }

      const listener = (_event: IpcRendererEvent): void => {
        callback();
      };

      ipcRenderer.on(channel, listener);

      // 瀛樺偍娓呯悊鍑芥暟
      menuListeners.set(channel, () => {
        ipcRenderer.removeListener(channel, listener);
      });
    },

    /**
     * 绉婚櫎鎸囧畾 channel 鐨勮彍鍗曚簨浠剁洃鍚櫒銆?
     */
    removeEventListener: (channel: MenuEventChannel): void => {
      const remove = menuListeners.get(channel);
      if (remove) {
        remove();
        menuListeners.delete(channel);
      }
    },

    /**
     * 绉婚櫎鎵€鏈夊凡娉ㄥ唽鐨勮彍鍗曚簨浠剁洃鍚櫒銆?
     * 搴旂敤鍗歌浇鏃惰皟鐢ㄣ€?
     */
    removeAllEventListeners: (): void => {
      menuListeners.forEach((remove) => remove());
      menuListeners.clear();
    },

    setLanguage: (language: 'zh-CN' | 'en-US'): void => {
      ipcRenderer.send(IPC_CHANNELS.menu.setLanguage, language);
    },
  },

  theme: {
    listOfficialInstalled: () =>
      ipcRenderer.invoke(IPC_CHANNELS.theme.listOfficialInstalled),
    listOfficialRemote: () =>
      ipcRenderer.invoke(IPC_CHANNELS.theme.listOfficialRemote),
    downloadOfficialTheme: (themeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.theme.downloadOfficialTheme, themeId),
    openThemeMarket: () =>
      ipcRenderer.invoke(IPC_CHANNELS.theme.openThemeMarket),
    openOfficialThemeStore: () =>
      ipcRenderer.invoke(IPC_CHANNELS.theme.openOfficialThemeStore),
  },
} satisfies PlotFlowAPI;

contextBridge.exposeInMainWorld('plotflow', plotflowApi);

