/**
 * FileService — 渲染进程文件操作服务 (M1-13)
 *
 * 提供 IFileService 接口，通过 IPC bridge (contextBridge) 调用
 * Electron 主进程的 File I/O 操作。
 *
 * 所有路径统一使用正斜杠，所有文件操作使用 UTF-8 编码。
 *
 * @see doc/TAD.md §1.1 — FileService 架构
 * @see doc/TAD.md §4   — Electron 主进程
 */

// ---------------------------------------------------------------------------
// 类型声明: 见 packages/app/src/types/electron.d.ts（单一真相源）
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 接口定义
// ---------------------------------------------------------------------------

/** 打开文件的结果 */
export interface IFileOpenResult {
  /** 文件绝对路径（正斜杠） */
  path: string;
  /** 文件内容 (UTF-8) */
  content: string;
}

/** 新建文件的结果 */
export interface INewFileResult {
  /** 空字符串表示新建未保存的文件 */
  path: string;
}

/** 文件操作服务接口 */
export interface IFileService {
  /**
   * 打开文件对话框，选择并读取 .mdstory 文件。
   * @throws 用户取消操作时抛出 Error
   */
  openFile(): Promise<IFileOpenResult>;

  /**
   * 保存内容到指定路径。
   * @param path    目标文件路径
   * @param content 文件内容 (UTF-8)
   */
  saveFile(path: string, content: string): Promise<void>;

  /**
   * 另存为对话框，选择路径后保存文件。
   * @param content 文件内容 (UTF-8)
   * @returns 用户选择的保存路径（正斜杠）
   * @throws 用户取消操作时抛出 Error
   */
  saveFileAs(content: string): Promise<string>;

  /**
   * 新建文件（返回空路径，表示未保存的新文件）。
   */
  newFile(): Promise<INewFileResult>;
}

// ---------------------------------------------------------------------------
// 实现
// ---------------------------------------------------------------------------

/**
 * 基于 Electron IPC 的 FileService 实现。
 *
 * 所有方法通过 window.plotflow.file API (contextBridge) 与主进程通信。
 * 路径统一转换为正斜杠。
 */
export class FileService implements IFileService {
  async openFile(): Promise<IFileOpenResult> {
    const api = this.getAPI();
    const result = await api.file.open();
    if (!result) {
      throw new Error('用户取消了文件打开操作');
    }
    return {
      path: result.filePath.replace(/\\/g, '/'),
      content: result.content,
    };
  }

  async saveFile(path: string, content: string): Promise<void> {
    const api = this.getAPI();
    await api.file.save(path, content);
  }

  async saveFileAs(content: string): Promise<string> {
    const api = this.getAPI();
    const result = await api.file.saveAs(content);
    if (!result) {
      throw new Error('用户取消了另存为操作');
    }
    return result.filePath.replace(/\\/g, '/');
  }

  async newFile(): Promise<INewFileResult> {
    return { path: '' };
  }

  /**
   * 获取 window.plotflow 引用，在 preload 未加载时抛出明确错误。
   */
  private getAPI(): Window['plotflow'] {
    const api = window.plotflow;
    if (!api || !api.file) {
      throw new Error(
        'PlotFlow IPC API 不可用。请确认 preload 脚本已正确加载。',
      );
    }
    return api;
  }
}

export default FileService;
