/**
 * PlotFlow Electron IPC Type Declarations
 *
 * 澹版槑閫氳繃 contextBridge 鏆撮湶鍒版覆鏌撹繘绋嬬殑 window.plotflow API 绫诲瀷銆?
 * 瀵瑰簲 TAD.md 搂1.1 IPC Bridge 灞傚拰 preload.ts 瀹炵幇銆?
 *
 * @module types/electron
 */

import type { Diagnostic } from '@plotflow/core';
import type {
  InstalledOfficialThemeSummary,
  OfficialThemeDownloadResult,
  OfficialThemeRemoteView,
} from '../theme-platform/types';

// ============================================================================
// 鏂囦欢鎿嶄綔绫诲瀷
// ============================================================================

/** 鏂囦欢鎵撳紑鎿嶄綔鐨勭粨鏋?*/
export interface FileOpenResult {
  readonly filePath: string;
  readonly content: string;
}

/** 鏂囦欢淇濆瓨鎿嶄綔鐨勭粨鏋?*/
export interface FileSaveResult {
  readonly success: boolean;
  readonly timestamp: number;
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

/** 鏂囦欢鎿嶄綔 API */
export interface FileAPI {
  open: () => Promise<FileOpenResult | null>;
  save: (path: string, content: string) => Promise<FileSaveResult>;
  saveAs: (content: string) => Promise<{ filePath: string } | null>;

  /**
   * 瀵煎嚭鏂囦欢瀵硅瘽妗?鈥?鏄剧ず绯荤粺淇濆瓨瀵硅瘽妗嗗苟鏍规嵁鎵╁睍鍚嶈繃婊ゆ枃浠剁被鍨嬨€?
   *
   * @param options - 瀵煎嚭閫夐」锛屽寘鍚鍑哄唴瀹瑰拰鏂囦欢绫诲瀷杩囨护鍣?
   * @returns 鐢ㄦ埛閫夋嫨鐨勬枃浠惰矾寰勶紝鍙栨秷鎿嶄綔杩斿洖 null
   */
  saveExport: (options: {
    content: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
    format: string;
  }) => Promise<{ filePath: string } | null>;

  /**
   * 鑾峰彇绯荤粺锛堝弻鍑?.mdstory / open-file 浜嬩欢锛変紶閫掔殑寰呮墦寮€鏂囦欢 (M7-08)銆?
   *
   * 绐楀彛鎸傝浇鍚庤皟鐢紝杩斿洖 { filePath, content } 鎴?null銆?
   * 杩斿洖鍚?pending 鐘舵€佽娓呴櫎锛岄伩鍏嶉噸澶嶆墦寮€銆?
   */
  getPendingOpenFile: () => Promise<{ filePath: string; content: string } | null>;

  /**
   * 鐩戝惉绯荤粺鏂囦欢鎵撳紑閫氱煡锛堝綋搴旂敤宸茶繍琛屼笖鐢ㄦ埛鍙屽嚮 .mdstory 鏃惰Е鍙戯級銆?
   *
   * macOS 鐨?open-file 浜嬩欢鍙殢鏃跺彂鐢燂紝姝ゅ洖璋冪敤浜庣獥鍙ｆ劅鐭ユ柊鏂囦欢銆?
   * 杩斿洖涓€涓竻鐞嗗嚱鏁帮紙缁勪欢鍗歌浇鏃惰皟鐢級銆?
   *
   * @param callback - 鏂囦欢璺緞鍥炶皟
   * @returns 娓呯悊鍑芥暟锛岀敤浜庣Щ闄や簨浠剁洃鍚櫒
   */
  onSystemOpenFile: (callback: (filePath: string) => void) => () => void;

  /**
   * 鎸夎矾寰勮鍙?.mdstory 鏂囦欢鍐呭 (M7-08)銆?
   * 鐢ㄤ簬杩愯鏃剁郴缁熸枃浠舵墦寮€閫氱煡鍚庡姞杞芥枃浠跺唴瀹广€?
   *
   * @param path - 鏂囦欢缁濆璺緞
   * @returns 鏂囦欢鍐呭鍙婅矾寰勶紝璇诲彇澶辫触杩斿洖 null
   */
  readByPath: (path: string) => Promise<{ filePath: string; content: string } | null>;

  /**
   * 閫夋嫨 PlotFlow 宸ヤ綔鍖哄苟娴呴€掑綊鎵弿 .mdstory 鏂囦欢銆?
   * 鍙繑鍥炲彈闄愭壂鎻忕粨鏋滐紝涓嶈鍙栨枃浠跺唴瀹广€?
   */
  chooseWorkspaceFolder: () => Promise<WorkspaceStoriesResult | null>;

  /**
   * 鍒锋柊宸查€夋嫨宸ヤ綔鍖哄唴鐨?.mdstory 鏂囦欢鍒楄〃銆?
   */
  listWorkspaceStories: (rootPath: string) => Promise<WorkspaceStoriesResult>;

  /**
   * 璇诲彇宸ヤ綔鍖哄唴鐨?.mdstory 鏂囦欢銆備富杩涚▼浼氶獙璇?filePath 浣嶄簬 rootPath 鍐呫€?
   */
  readWorkspaceStory: (rootPath: string, filePath: string) => Promise<{ filePath: string; content: string } | null>;
}

/** Electron 鐗堟湰淇℃伅 */
export interface Versions {
  readonly node: string;
  readonly electron: string;
  readonly chrome: string;
}

// ============================================================================
// 鑿滃崟浜嬩欢绫诲瀷 (M1-17)
// ============================================================================

/** 鑿滃崟浜嬩欢棰戦亾鍚嶇О */
export type MenuEventChannel =
  | 'menu:file:new'
  | 'menu:file:open'
  | 'menu:file:save'
  | 'menu:file:saveAs'
  | 'menu:edit:undo'
  | 'menu:edit:redo'
  | 'menu:edit:find'
  | 'menu:edit:replace'
  | 'menu:view:toggleOutline'
  | 'menu:view:toggleGraph'
  | 'menu:view:toggleProblems'
  | 'menu:view:themeBrowser'
  | 'menu:export:json'
  | 'menu:export:html'
  | 'menu:export:txt'
  | 'menu:help:about'
  | 'menu:help:docs';

/** 鑿滃崟浜嬩欢 API 鈥?娉ㄥ唽/绉婚櫎涓昏繘绋嬭彍鍗曡Е鍙戠殑 IPC 浜嬩欢鐩戝惉鍣?*/
export interface MenuAPI {
  /**
   * 娉ㄥ唽涓€涓彍鍗曚簨浠剁洃鍚櫒銆?
   * 鐩稿悓 channel 鐨勬棫鐩戝惉鍣ㄤ細琚嚜鍔ㄧЩ闄わ紙闃叉閲嶅娉ㄥ唽锛夈€?
   *
   * @param channel - 鑿滃崟浜嬩欢棰戦亾鍚嶇О
   * @param callback - 浜嬩欢瑙﹀彂鏃舵墽琛岀殑鍥炶皟锛堟棤鍙傛暟锛?
   */
  onEvent: (channel: MenuEventChannel, callback: () => void) => void;

  /**
   * 绉婚櫎鎸囧畾 channel 鐨勮彍鍗曚簨浠剁洃鍚櫒銆?
   *
   * @param channel - 鑿滃崟浜嬩欢棰戦亾鍚嶇О
   */
  removeEventListener: (channel: MenuEventChannel) => void;

  /**
   * 绉婚櫎鎵€鏈夊凡娉ㄥ唽鐨勮彍鍗曚簨浠剁洃鍚櫒銆?
   * 搴旂敤鍗歌浇鏃惰皟鐢ㄣ€?
   */
  removeAllEventListeners: () => void;

  setLanguage: (language: 'zh-CN' | 'en-US') => void;
}

// ============================================================================
// 瀵硅瘽妗?API 绫诲瀷
// ============================================================================

/** 瀵硅瘽妗嗙‘璁ら€夐」 */
export interface DialogConfirmOptions {
  readonly type?: 'none' | 'info' | 'error' | 'question' | 'warning';
  readonly message: string;
  readonly detail: string;
  readonly buttons: readonly string[];
}

/** 瀵硅瘽妗?API 鈥?浠庢覆鏌撹繘绋嬭皟鐢ㄥ師鐢熺郴缁熷璇濇 */
export interface DialogAPI {
  /**
   * 鏄剧ず鍘熺敓娑堟伅瀵硅瘽妗嗗苟杩斿洖鐢ㄦ埛鐐瑰嚮鐨勬寜閽储寮曪紙0-based锛夈€?
   *
   * @param options - 瀵硅瘽妗嗛厤缃?
   * @returns 鐢ㄦ埛鐐瑰嚮鐨勬寜閽储寮曪紝鎴?-1 琛ㄧず瀵硅瘽妗嗚鍏抽棴
   */
  confirm: (options: DialogConfirmOptions) => Promise<number>;
}

export interface ThemeAPI {
  listOfficialInstalled: () => Promise<InstalledOfficialThemeSummary[]>;
  listOfficialRemote: () => Promise<OfficialThemeRemoteView[]>;
  downloadOfficialTheme: (themeId: string) => Promise<OfficialThemeDownloadResult>;
  openThemeMarket: () => Promise<void>;
  openOfficialThemeStore: () => Promise<void>;
}

// ============================================================================
// 涓?API 绫诲瀷
// ============================================================================

/** 鏆撮湶鍒?window 鐨?PlotFlow 涓?API */
export interface PlotFlowAPI {
  readonly platform: NodeJS.Platform;
  readonly env: {
    readonly isTest: boolean;
  };
  readonly versions: Versions;
  readonly file: FileAPI;
  readonly menu: MenuAPI;
  readonly dialog: DialogAPI;
  readonly theme: ThemeAPI;
}

// ============================================================================
// 鍏ㄥ眬 Window 澹版槑
// ============================================================================

/**
 * 缂栬緫鍣ㄨ剰鐘舵€佸揩鐓?鈥?鐢辨覆鏌撹繘绋嬫毚闇诧紝涓昏繘绋嬮€氳繃 executeJavaScript 璋冪敤銆?
 *
 * @see App.tsx 鈥?window.__getEditorDirtyState__ 鐨勫疄鐜?
 * @see main.ts 鈥?绐楀彛鍏抽棴鎷︽埅鍣?
 */
export interface EditorDirtyState {
  readonly isDirty: boolean;
  readonly filePath: string | null;
}

/** 浠呮祴璇曟€佹毚闇茬殑妗ユ帴 API */
export interface TestStoreBridge {
  getEditorContent: () => string;
  getDiagnostics: () => readonly Diagnostic[];
  getGraphNodes: () => ReadonlyArray<{
    readonly id: string;
    readonly position: { readonly x: number; readonly y: number };
  }>;
  setEditorContent: (content: string) => void;
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
  };
  setTheme: (themeId: string) => void;
  getThemeId: () => string;
  openThemeCenter: () => void;
  setHomeSurfaceOpen: (open: boolean) => void;
  /** 鐩存帴閫変腑鍒嗘敮鍥捐妭鐐瑰苟鑱斿姩缂栬緫鍣?activeNodeId */
  selectNode: (nodeId: string) => void;
}

declare global {
  interface Window {
    readonly plotflow: PlotFlowAPI;

    /**
     * 杩斿洖缂栬緫鍣ㄥ綋鍓嶈剰鐘舵€佸揩鐓с€?
     * 鐢变富杩涚▼閫氳繃 executeJavaScript 璋冪敤锛岀敤浜庣獥鍙ｅ叧闂墠鐨勮剰妫€鏌ャ€?
     */
    __getEditorDirtyState__?: () => EditorDirtyState;

    /**
     * 瑙﹀彂寮哄埗淇濆瓨锛堝寘鎷柊鏂囦欢鍜屽凡鏈夋枃浠讹級銆?
     * 鐢变富杩涚▼閫氳繃 executeJavaScript 璋冪敤锛岀敤浜庣獥鍙ｅ叧闂椂淇濆瓨鏈繚瀛樺唴瀹广€?
     */
    __forceSave__?: () => Promise<boolean>;

    /**
     * 浠呭湪 Playwright / E2E 娴嬭瘯鐜鏆撮湶鐨勭姸鎬佹ˉ鎺ャ€?
     * 鐢熶骇鐜涓嶄細鎸傝浇銆?
     */
    __test_store__?: TestStoreBridge;
  }
}

