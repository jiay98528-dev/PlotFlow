import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import { IPC_CHANNELS } from '../src/shared/ipcChannels';
import type { FeedbackSubmitRequest, FeedbackSubmitResult } from '../src/shared/feedback';
import { createBufferedResultListener } from './systemOpenBuffer';
import type {
  DialogConfirmOptions,
  FileExternalChangeEvent,
  FileExportRequest,
  FileOpenResult,
  FileSaveRequest,
  MenuEventChannel,
  PendingOpenFileResult,
  PlotFlowAPI,
  WorkspaceStoriesResult,
} from '../src/types/electron';

const systemOpenResults = createBufferedResultListener<PendingOpenFileResult>();

ipcRenderer.on(IPC_CHANNELS.file.systemOpenNotify, (_event, result: PendingOpenFileResult) => {
  systemOpenResults.push(result);
});

// One renderer listener is retained per menu channel so remounts cannot stack callbacks.

const menuListeners = new Map<MenuEventChannel, () => void>();

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

  dialog: {
    confirm: (options: DialogConfirmOptions): Promise<number> =>
      ipcRenderer.invoke(IPC_CHANNELS.dialog.confirm, options),
  },

  feedback: {
    send: (request: FeedbackSubmitRequest): Promise<FeedbackSubmitResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.feedback.send, request),
  },

  file: {
    open: (): Promise<FileOpenResult | null> => ipcRenderer.invoke(IPC_CHANNELS.file.open),
    save: (request: FileSaveRequest) => ipcRenderer.invoke(IPC_CHANNELS.file.save, request),
    saveAs: (content: string) => ipcRenderer.invoke(IPC_CHANNELS.file.saveAs, { content }),
    saveExport: (options: FileExportRequest) =>
      ipcRenderer.invoke(IPC_CHANNELS.file.export, options),

    /** Consume a story queued by a system file-open event during startup. */
    getPendingOpenFile: (): Promise<PendingOpenFileResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.getPendingOpenFile),

    /** Subscribe to stories opened by the OS after renderer startup. */
    onSystemOpenFile: (callback: (result: PendingOpenFileResult) => void): (() => void) => {
      return systemOpenResults.register(callback);
    },

    onExternalChange: (callback: (event: FileExternalChangeEvent) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: FileExternalChangeEvent,
      ): void => {
        callback(payload);
      };
      ipcRenderer.on(IPC_CHANNELS.file.externalChange, listener);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.file.externalChange, listener);
      };
    },

    readByPath: (path: string): Promise<FileOpenResult | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.readByPath, { path }),
    chooseWorkspaceFolder: (): Promise<WorkspaceStoriesResult | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.chooseWorkspaceFolder),
    listWorkspaceStories: (rootPath: string): Promise<WorkspaceStoriesResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.listWorkspaceStories, { rootPath }),
    readWorkspaceStory: (
      rootPath: string,
      filePath: string,
    ): Promise<{ filePath: string; content: string; hash: string; modifiedAt: number } | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.file.readWorkspaceStory, { rootPath, filePath }),
  },

  menu: {
    /** Register one listener, replacing an earlier callback on the same channel. */
    onEvent: (channel: MenuEventChannel, callback: () => void): void => {
      const existing = menuListeners.get(channel);
      if (existing) {
        existing();
        menuListeners.delete(channel);
      }

      const listener = (_event: IpcRendererEvent): void => {
        callback();
      };

      ipcRenderer.on(channel, listener);

      menuListeners.set(channel, () => {
        ipcRenderer.removeListener(channel, listener);
      });
    },

    removeEventListener: (channel: MenuEventChannel): void => {
      const remove = menuListeners.get(channel);
      if (remove) {
        remove();
        menuListeners.delete(channel);
      }
    },

    removeAllEventListeners: (): void => {
      menuListeners.forEach((remove) => remove());
      menuListeners.clear();
    },

    setLanguage: (language: 'zh-CN' | 'en-US'): void => {
      ipcRenderer.send(IPC_CHANNELS.menu.setLanguage, language);
    },
  },
} satisfies PlotFlowAPI;

contextBridge.exposeInMainWorld('plotflow', plotflowApi);
