/**
 * 学习数据持久化 (M5-16)
 *
 * 将 NGramEngine 模型快照和 DecayStore 持久化到磁盘 JSON 文件中。
 *
 * ## 存储位置
 * - 默认路径: `{basePath}/learner-data.json`
 * - Electron 应用应传入 `app.getPath('userData') + '/learner/'`
 * - 可通过环境变量 `PLOTFLOW_LEARNER_PATH` 覆盖
 *
 * ## 文件格式
 * ```json
 * {
 *   "version": 1,
 *   "schema": "plotflow-learner-v1",
 *   "savedAt": "2026-06-13T12:00:00.000Z",
 *   "totalTokens": 12345,
 *   "model": { "version": 1, "totalTokens": 12345, "store": {...} },
 *   "timestamps": { "1": {...}, "2": {...} }
 * }
 * ```
 *
 * ## 线程安全
 * - 持久化操作应在 Electron **主进程**中执行（通过 IPC 桥接）
 * - 避免在渲染进程或 Worker 线程中直接访问文件系统
 * - 通过 `setFileReader` / `setFileWriter` 可注入自定义文件操作实现
 *
 * @packageDocumentation
 * @version 0.1.0
 */

import { NGramEngine } from './NGramEngine.js';
import type { NGramModel } from './types.js';
import type { DecayStore } from './Learner.js';

// ============================================================================
// 常量
// ============================================================================

/** 当前持久化格式版本 */
const PERSISTENCE_VERSION = 1;

/** 默认数据文件名 */
const DEFAULT_FILENAME = 'learner-data.json';

/** 默认存储目录名（当未指定 basePath 时使用） */
const DEFAULT_DIR = '.plotflow-learner';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 持久化文件顶层结构。
 */
export interface LearnerPersistedData {
  /** 格式版本号 */
  version: number;
  /** Schema 标识符（用于版本兼容检测） */
  schema: string;
  /** 保存时间 (ISO 8601) */
  savedAt: string;
  /** 训练总 token 数快照 */
  totalTokens: number;
  /** N-gram 模型快照 */
  model: NGramModel;
  /** 衰减跟踪时间戳 */
  timestamps: DecayStore;
}

/** Persistence 构造选项 */
export interface PersistenceOptions {
  /**
   * 存储基础目录路径。
   * Electron 环境应传入: `path.join(app.getPath('userData'), 'learner')`
   */
  basePath?: string;
  /** 文件名（默认 'learner-data.json'） */
  filename?: string;
}

/** 加载结果 */
export interface LoadResult {
  /** 恢复的引擎实例 */
  engine: NGramEngine;
  /** 衰减跟踪数据 */
  timestamps: DecayStore;
  /** 快照时的总 token 数 */
  totalTokens: number;
  /** 上次保存时间 (ISO 8601) */
  savedAt: string;
}

// ============================================================================
// 文件操作接口
// ============================================================================

/** 自定义文件读取函数（用于测试或浏览器环境注入） */
export type FileReader = (filePath: string) => Promise<string | null>;

/** 自定义文件写入函数（用于测试或浏览器环境注入） */
export type FileWriter = (filePath: string, content: string) => Promise<void>;

// ============================================================================
// Persistence 类
// ============================================================================

/**
 * 学习数据持久化管理器。
 *
 * 使用 JSON 文件存储 NGramEngine 状态和 DecayStore，轻量无外部依赖。
 *
 * @example
 * ```typescript
 * // Electron 主进程
 * import { app } from 'electron';
 * import path from 'node:path';
 *
 * const basePath = path.join(app.getPath('userData'), 'learner');
 * const persistence = new Persistence({ basePath });
 *
 * // 保存
 * await persistence.save(engine, timestamps);
 *
 * // 加载（启动时）
 * const data = await persistence.load();
 * if (data) {
 *   applyWeightDecay(data.engine, data.timestamps);
 *   // 使用 data.engine 进行补全预测
 * }
 * ```
 */
export class Persistence {
  /** 完整文件路径 */
  private filePath: string;

  /** 自定义读取器（可选，用于测试或浏览器注入） */
  private fileReader?: FileReader;

  /** 自定义写入器（可选，用于测试或浏览器注入） */
  private fileWriter?: FileWriter;

  /**
   * @param options - 配置选项
   */
  constructor(options?: PersistenceOptions) {
    const basePath = options?.basePath ?? getDefaultBasePath();
    const filename = options?.filename ?? DEFAULT_FILENAME;
    this.filePath = `${basePath}/${filename}`;
  }

  // ==========================================================================
  // 公共 API
  // ==========================================================================

  /**
   * 保存学习数据到磁盘。
   *
   * 序列化流程:
   * `engine.toModel()` + `timestamps` → `LearnerPersistedData` → `JSON.stringify` → `writeFile`
   *
   * @param engine - NGramEngine 实例
   * @param timestamps - DecayStore 实例
   */
  async save(engine: NGramEngine, timestamps: DecayStore): Promise<void> {
    const model = engine.toModel();

    const data: LearnerPersistedData = {
      version: PERSISTENCE_VERSION,
      schema: 'plotflow-learner-v1',
      savedAt: new Date().toISOString(),
      totalTokens: engine.totalTokens,
      model,
      timestamps,
    };

    const json = JSON.stringify(data, null, 2);
    await this.writeFile(this.filePath, json);
  }

  /**
   * 从磁盘加载学习数据。
   *
   * 反序列化流程:
   * `readFile` → `JSON.parse` → `LearnerPersistedData` → `NGramEngine.fromModel()`
   *
   * **错误处理**：
   * - 文件不存在 → 返回 null（首次启动的正常情况）
   * - 格式损坏 → 打印警告并返回 null（不抛出异常）
   *
   * @returns 加载结果，文件不存在或格式损坏时返回 null
   */
  async load(): Promise<LoadResult | null> {
    try {
      const json = await this.readFile(this.filePath);
      if (json === null || json === undefined) {
        return null;
      }

      const data = JSON.parse(json) as LearnerPersistedData;

      // 版本兼容检查（仅警告，不阻止加载）
      if (data.version !== PERSISTENCE_VERSION) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Persistence] 学习数据版本 v${data.version} 与当前版本 v${PERSISTENCE_VERSION} 不匹配，尝试强制加载...`,
        );
      }

      const engine = NGramEngine.fromModel(data.model);
      const timestamps: DecayStore = data.timestamps ?? createEmptyDecayStore();

      return {
        engine,
        timestamps,
        totalTokens: data.totalTokens,
        savedAt: data.savedAt,
      };
    } catch (err) {
      // 文件不存在 → 正常首次启动
      if (isFileNotFound(err)) {
        return null;
      }
      // 其他错误（格式损坏、权限等）→ 记录警告并返回 null
      // eslint-disable-next-line no-console
      console.warn('[Persistence] 加载学习数据失败，将使用空引擎:', err);
      return null;
    }
  }

  /**
   * 获取持久化文件的完整路径。
   */
  get filepath(): string {
    return this.filePath;
  }

  // ==========================================================================
  // 文件操作注入
  // ==========================================================================

  /**
   * 注入自定义文件读取函数。
   *
   * 用于：
   * - **测试环境**：使用内存文件系统，不写磁盘
   * - **浏览器环境**：通过 IPC 桥接至 Electron 主进程读取
   *
   * @param reader - 文件读取函数
   */
  setFileReader(reader: FileReader): void {
    this.fileReader = reader;
  }

  /**
   * 注入自定义文件写入函数。
   *
   * 用于：
   * - **测试环境**：使用内存文件系统，不写磁盘
   * - **浏览器环境**：通过 IPC 桥接至 Electron 主进程写入
   *
   * @param writer - 文件写入函数
   */
  setFileWriter(writer: FileWriter): void {
    this.fileWriter = writer;
  }

  // ==========================================================================
  // 私有文件操作
  // ==========================================================================

  /**
   * 读取文件内容。优先使用自定义 reader，否则 fallback 到 Node.js fs。
   */
  private async readFile(path: string): Promise<string | null> {
    if (this.fileReader) {
      return this.fileReader(path);
    }
    return nodeReadFile(path);
  }

  /**
   * 写入文件内容。优先使用自定义 writer，否则 fallback 到 Node.js fs。
   */
  private async writeFile(path: string, content: string): Promise<void> {
    if (this.fileWriter) {
      return this.fileWriter(path, content);
    }
    return nodeWriteFile(path, content);
  }
}

// ============================================================================
// Node.js fs 默认实现
// ============================================================================

/**
 * 使用 Node.js fs 模块读取文件。
 *
 * @param path - 文件路径
 * @returns 文件内容（UTF-8），文件不存在时返回 null
 */
async function nodeReadFile(path: string): Promise<string | null> {
  try {
    const fs = await import('node:fs');
    return fs.readFileSync(path, 'utf-8');
  } catch (err) {
    if (isFileNotFound(err)) {
      return null;
    }
    throw err;
  }
}

/**
 * 使用 Node.js fs 模块写入文件。
 * 父目录不存在时自动创建。
 *
 * @param path - 文件路径
 * @param content - 文件内容
 */
async function nodeWriteFile(path: string, content: string): Promise<void> {
  const fs = await import('node:fs');
  const nodePath = await import('node:path');

  const dir = nodePath.dirname(path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(path, content, 'utf-8');
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 获取默认基础路径。
 *
 * 优先级：
 * 1. 环境变量 `PLOTFLOW_LEARNER_PATH`
 * 2. 当前工作目录下的 `.plotflow-learner` 目录
 */
function getDefaultBasePath(): string {
  return process.env['PLOTFLOW_LEARNER_PATH'] ?? DEFAULT_DIR;
}

/**
 * 判断错误是否为"文件不存在" (ENOENT)。
 *
 * @param err - 任意错误对象
 * @returns 是否为 ENOENT 错误
 */
function isFileNotFound(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

/**
 * 创建空的 DecayStore（内联实现，避免与 Learner.ts 的循环依赖）。
 */
function createEmptyDecayStore(): DecayStore {
  const store: DecayStore = {};
  for (let n = 1; n <= 5; n++) {
    store[n] = {};
  }
  return store;
}
