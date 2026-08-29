/** Electron contextBridge contracts shared by preload and renderer code. */

import type { Diagnostic } from '@plotflow/core';
import type { FeedbackSubmitRequest, FeedbackSubmitResult } from '../shared/feedback';
import type { MenuEventChannel } from '../shared/ipcChannels';

export type { MenuEventChannel } from '../shared/ipcChannels';

export interface FileOpenResult {
  readonly filePath: string;
  readonly content: string;
  readonly hash: string;
  readonly modifiedAt: number;
}

export type PendingOpenFileResult =
  | { readonly status: 'none' }
  | { readonly status: 'opened'; readonly story: FileOpenResult }
  | { readonly status: 'error'; readonly path: string; readonly code: string };

export type SystemOpenFileResult = PendingOpenFileResult;

export type FileSaveResult =
  | {
      readonly success: true;
      readonly timestamp: number;
      readonly hash: string;
      readonly modifiedAt: number;
    }
  | {
      readonly success: false;
      readonly conflict: true;
      readonly filePath: string;
      readonly content: string;
      readonly hash: string;
      readonly modifiedAt: number;
    }
  | {
      readonly success: false;
      readonly conflict?: false;
      readonly timestamp: number;
      readonly message?: string;
    };

export interface FileSaveRequest {
  readonly path: string;
  readonly content: string;
  readonly expectedHash: string | null;
  readonly overwriteConflict?: boolean;
}

export interface FileExportRequest {
  readonly content: string;
  readonly defaultPath: string;
  readonly filters: Array<{ name: string; extensions: string[] }>;
  readonly format: string;
}

export interface FileExternalChangeEvent {
  readonly filePath: string;
  readonly content: string;
  readonly hash: string;
  readonly modifiedAt: number;
}

export interface WorkspaceStoryFile {
  readonly filePath: string;
  readonly relativePath: string;
  readonly name: string;
  readonly size: number;
  readonly modifiedAt: number;
}

export interface WorkspaceStoriesResult {
  readonly rootPath: string;
  readonly files: readonly WorkspaceStoryFile[];
  readonly truncated: boolean;
}

export interface FileAPI {
  open: () => Promise<FileOpenResult | null>;
  save: (request: FileSaveRequest) => Promise<FileSaveResult>;
  saveAs: (content: string) => Promise<FileOpenResult | null>;
  saveExport: (options: FileExportRequest) => Promise<{ filePath: string } | null>;

  /** Consume a story queued by a system file-open event during startup. */
  getPendingOpenFile: () => Promise<PendingOpenFileResult>;

  /** Subscribe to story files opened by the OS after renderer startup. */
  onSystemOpenFile: (callback: (result: SystemOpenFileResult) => void) => () => void;

  /** Subscribe to disk changes for the active story. */
  onExternalChange: (callback: (event: FileExternalChangeEvent) => void) => () => void;

  readByPath: (path: string) => Promise<FileOpenResult | null>;
  chooseWorkspaceFolder: () => Promise<WorkspaceStoriesResult | null>;
  listWorkspaceStories: (rootPath: string) => Promise<WorkspaceStoriesResult>;
  readWorkspaceStory: (rootPath: string, filePath: string) => Promise<FileOpenResult | null>;
}

export interface Versions {
  readonly node: string;
  readonly electron: string;
  readonly chrome: string;
}

export interface MenuAPI {
  /** Register one listener for a menu channel, replacing an earlier listener on that channel. */
  onEvent: (channel: MenuEventChannel, callback: () => void) => void;
  removeEventListener: (channel: MenuEventChannel) => void;
  removeAllEventListeners: () => void;
  setLanguage: (language: 'zh-CN' | 'en-US') => void;
}

export interface DialogConfirmOptions {
  readonly type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  readonly message: string;
  readonly detail: string;
  readonly buttons: readonly string[];
}

export interface DialogAPI {
  confirm: (options: DialogConfirmOptions) => Promise<number>;
}

export interface FeedbackAPI {
  send: (request: FeedbackSubmitRequest) => Promise<FeedbackSubmitResult>;
}

export interface PlotFlowAPI {
  readonly platform: NodeJS.Platform;
  readonly env: {
    readonly isTest: boolean;
  };
  readonly versions: Versions;
  readonly file: FileAPI;
  readonly menu: MenuAPI;
  readonly dialog: DialogAPI;
  readonly feedback: FeedbackAPI;
}

/** Snapshot queried by the main process during the existing close arbitration flow. */
export interface EditorDirtyState {
  readonly isDirty: boolean;
  readonly filePath: string | null;
}

/** Renderer state exposed only while running Playwright/E2E builds. */
export interface TestStoreBridge {
  getEditorContent: () => string;
  getDiagnostics: () => readonly Diagnostic[];
  getGraphNodes: () => ReadonlyArray<{
    readonly id: string;
    readonly position: { readonly x: number; readonly y: number };
  }>;
  getGraphZoom: () => number;
  setEditorContent: (content: string) => void;
  setEditorContentPreservingUI: (content: string) => void;
  applyExternalFileContent: (event: FileExternalChangeEvent) => Promise<boolean>;
  openConditionEditor: (nodeId: string, optionIndex: number) => void;
  setWorkspaceMode: (mode: 'split' | 'graphLab') => void;
  getUIState: () => {
    readonly workspaceMode: 'split' | 'graphLab';
    readonly isSourceDrawerOpen: boolean;
    readonly isConditionEditorOpen: boolean;
    readonly conditionEditorNodeId: string | null;
    readonly conditionEditorOptionIndex: number | null;
    readonly activeRightPanel: string;
    readonly isExportDialogOpen: boolean;
    readonly isNewFileDialogOpen: boolean;
    readonly isThemeCenterOpen: boolean;
    readonly isHomeSurfaceOpen: boolean;
    readonly activeThemeId: string;
    readonly activeChapterId: string | null;
    readonly activeNodeId: string | null;
  };
  setTheme: (themeId: string) => void;
  getThemeId: () => string;
  openThemeCenter: () => void;
  setHomeSurfaceOpen: (open: boolean) => void;
  selectNode: (nodeId: string) => void;
}

declare global {
  interface Window {
    readonly plotflow: PlotFlowAPI;

    /** Return the current dirty-state snapshot for close arbitration. */
    __getEditorDirtyState__?: () => EditorDirtyState;

    /** Save or prepare a discard while the existing native close dialog is resolving. */
    __forceSave__?: () => Promise<boolean>;
    __prepareDiscard__?: () => Promise<boolean>;

    /** Test-only renderer bridge. It is absent from production builds. */
    __test_store__?: TestStoreBridge;
  }
}
