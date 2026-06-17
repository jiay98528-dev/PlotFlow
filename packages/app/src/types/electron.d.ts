/**
 * PlotFlow Electron IPC Type Declarations
 *
 * 声明通过 contextBridge 暴露到渲染进程的 window.plotflow API 类型。
 * 对应 TAD.md §1.1 IPC Bridge 层和 preload.ts 实现。
 *
 * @module types/electron
 */

// ============================================================================
// 文件操作类型
// ============================================================================

/** 文件打开操作的结果 */
export interface FileOpenResult {
  readonly filePath: string;
  readonly content: string;
}

/** 文件保存操作的结果 */
export interface FileSaveResult {
  readonly success: boolean;
  readonly timestamp: number;
}

/** 文件操作 API */
export interface FileAPI {
  open: () => Promise<FileOpenResult | null>;
  save: (path: string, content: string) => Promise<FileSaveResult>;
  saveAs: (content: string) => Promise<{ filePath: string } | null>;

  /**
   * 导出文件对话框 — 显示系统保存对话框并根据扩展名过滤文件类型。
   *
   * @param options - 导出选项，包含导出内容和文件类型过滤器
   * @returns 用户选择的文件路径，取消操作返回 null
   */
  saveExport: (options: {
    content: string;
    defaultPath: string;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ filePath: string } | null>;

  /**
   * 获取系统（双击 .mdstory / open-file 事件）传递的待打开文件 (M7-08)。
   *
   * 窗口挂载后调用，返回 { filePath, content } 或 null。
   * 返回后 pending 状态被清除，避免重复打开。
   */
  getPendingOpenFile: () => Promise<{ filePath: string; content: string } | null>;

  /**
   * 监听系统文件打开通知（当应用已运行且用户双击 .mdstory 时触发）。
   *
   * macOS 的 open-file 事件可随时发生，此回调用于窗口感知新文件。
   * 返回一个清理函数（组件卸载时调用）。
   *
   * @param callback - 文件路径回调
   * @returns 清理函数，用于移除事件监听器
   */
  onSystemOpenFile: (callback: (filePath: string) => void) => () => void;
}

/** Electron 版本信息 */
export interface Versions {
  readonly node: string;
  readonly electron: string;
  readonly chrome: string;
}

// ============================================================================
// 菜单事件类型 (M1-17)
// ============================================================================

/** 菜单事件频道名称 */
export type MenuEventChannel =
  | 'menu:file:new'
  | 'menu:file:open'
  | 'menu:file:save'
  | 'menu:file:saveAs'
  | 'menu:edit:find'
  | 'menu:edit:replace'
  | 'menu:view:toggleOutline'
  | 'menu:view:toggleGraph'
  | 'menu:view:toggleProblems'
  | 'menu:view:toggleTheme'
  | 'menu:export:json'
  | 'menu:export:html'
  | 'menu:export:txt'
  | 'menu:help:about'
  | 'menu:help:docs';

/** 菜单事件 API — 注册/移除主进程菜单触发的 IPC 事件监听器 */
export interface MenuAPI {
  /**
   * 注册一个菜单事件监听器。
   * 相同 channel 的旧监听器会被自动移除（防止重复注册）。
   *
   * @param channel - 菜单事件频道名称
   * @param callback - 事件触发时执行的回调（无参数）
   */
  onEvent: (channel: MenuEventChannel, callback: () => void) => void;

  /**
   * 移除指定 channel 的菜单事件监听器。
   *
   * @param channel - 菜单事件频道名称
   */
  removeEventListener: (channel: MenuEventChannel) => void;

  /**
   * 移除所有已注册的菜单事件监听器。
   * 应用卸载时调用。
   */
  removeAllEventListeners: () => void;
}

// ============================================================================
// 主 API 类型
// ============================================================================

/** 暴露到 window 的 PlotFlow 主 API */
export interface PlotFlowAPI {
  readonly platform: NodeJS.Platform;
  readonly versions: Versions;
  readonly file: FileAPI;
  readonly menu: MenuAPI;
}

// ============================================================================
// 全局 Window 声明
// ============================================================================

declare global {
  interface Window {
    readonly plotflow: PlotFlowAPI;
  }
}
